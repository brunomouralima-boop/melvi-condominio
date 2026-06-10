import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../prisma";
import { hashPassword, verifyPassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { authenticate } from "../middleware/auth";
import { resolveCondominium } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";
import { resolvePermissions, isSuperAdmin, PermissionOverride } from "../auth/permissions";
import { hashResetToken } from "../utils/resetToken";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please try again later." },
});

// Limiter dedicado para os endpoints públicos de recuperação de palavra-passe.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas tentativas. Tente novamente mais tarde." },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || user.deletedAt) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await verifyPassword(password, user.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const payload = { sub: user.id, role: user.role, fractionId: user.fractionId };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      fractionId: user.fractionId,
    },
  });
});

router.post("/refresh", authLimiter, async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: "Missing refresh token" });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: "Refresh token expired" });
    }
    const newAccess = signAccessToken({ sub: payload.sub, role: payload.role, fractionId: payload.fractionId });
    res.json({ accessToken: newAccess });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  res.json({ ok: true });
});

router.get("/me", authenticate, resolveCondominium, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    include: {
      fraction: {
        include: { tower: true },
      },
      permissions: { select: { key: true, effect: true } },
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Condomínios acessíveis (para o selector multi-tenant) + o activo resolvido.
  const ids = req.accessibleCondominiumIds ?? [];
  const condominiums = ids.length
    ? await prisma.condominium.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Permissões efectivas (defaults do papel + overlay GRANT/DENY). Resolvidas no
  // back-end; o front usa-as apenas para mostrar/esconder UI.
  const overrides: PermissionOverride[] = user.permissions.map((p) => ({
    key: p.key,
    effect: p.effect === "DENY" ? "DENY" : "GRANT",
  }));
  const permissions = resolvePermissions(user.role, overrides);

  const { password: _p, permissions: _perms, ...safe } = user;
  res.json({
    ...safe,
    isSuperAdmin: isSuperAdmin(user.role),
    permissions,
    condominiums,
    activeCondominiumId: req.condominiumId ?? null,
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post("/change-password", authenticate, validateBody(changePasswordSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const ok = await verifyPassword(currentPassword, user.password);
  if (!ok) return res.status(400).json({ error: "A senha actual está incorrecta" });

  // Termina TODAS as sessões antigas (revoga os refresh tokens) e emite um par
  // novo para esta sessão — quem mudou a senha continua autenticado; qualquer
  // outro dispositivo deixa de conseguir renovar o acesso.
  const payload = { sub: user.id, role: user.role, fractionId: user.fractionId };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword) },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  res.json({ ok: true, accessToken, refreshToken });
});

// ───────────────────────────────────────────────────────────────────────────
// Recuperação de palavra-passe (público) — via link gerado por um admin.
// O token é validado pelo seu hash; tem de estar não usado e dentro da validade,
// e o utilizador tem de estar activo.
// ───────────────────────────────────────────────────────────────────────────
const validateResetSchema = z.object({ token: z.string().min(10) });

router.post("/reset-password/validate", resetLimiter, validateBody(validateResetSchema), async (req, res) => {
  const { token } = req.body as z.infer<typeof validateResetSchema>;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { name: true, isActive: true, deletedAt: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user || !row.user.isActive || row.user.deletedAt) {
    return res.status(400).json({ valid: false, error: "Token inválido ou expirado" });
  }
  res.json({ valid: true, name: row.user.name });
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});

router.post("/reset-password", resetLimiter, validateBody(resetPasswordSchema), async (req, res) => {
  const { token, newPassword } = req.body as z.infer<typeof resetPasswordSchema>;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { id: true, isActive: true, deletedAt: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user || !row.user.isActive || row.user.deletedAt) {
    return res.status(400).json({ error: "Token inválido ou expirado" });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { password: passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    // invalida outros tokens de reset pendentes do mesmo utilizador
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } }),
    // força re-login em todos os dispositivos (revoga refresh tokens)
    prisma.refreshToken.deleteMany({ where: { userId: row.userId } }),
  ]);
  res.json({ ok: true });
});

export default router;

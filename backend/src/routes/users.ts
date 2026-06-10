import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { resolveCondominium } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";
import { hashPassword } from "../utils/password";
import { isSuperAdmin } from "../auth/permissions";
import { isLastActiveSuperAdmin } from "../auth/superAdmin";

const router = Router();
router.use(authenticate);
router.use(resolveCondominium);

// ───────────────────────────────────────────────────────────────────────────
// Protecção do SUPER_ADMIN nas operações de gestão de utilizadores.
//
// O catálogo de rotas abaixo é acessível a qualquer administrador de condomínio
// (authorize(Role.ADMIN) + users:write). Estas regras impedem que um admin que
// NÃO é super administrador mexa num super admin (ou promova alguém a super
// admin) e garantem que a plataforma nunca fica sem super admin activo.
//
// Devolve uma mensagem de erro (com status) quando a operação deve ser
// bloqueada, ou `null` quando é permitida.
// ───────────────────────────────────────────────────────────────────────────
async function guardSuperAdminMutation(opts: {
  requesterRole: Role;
  targetId: string;
  newRole?: Role; // role a aplicar (em PUT /:id); undefined se não muda
  willDeactivate?: boolean; // true para desactivar/eliminar
}): Promise<{ status: number; error: string } | null> {
  const target = await prisma.user.findUnique({
    where: { id: opts.targetId },
    select: { role: true },
  });
  if (!target) return null; // inexistência é tratada pela própria operação

  const requesterIsSuper = isSuperAdmin(opts.requesterRole);

  // 1) Só um super admin pode mexer noutro super admin.
  if (target.role === Role.SUPER_ADMIN && !requesterIsSuper) {
    return { status: 403, error: "Apenas um super administrador pode gerir outro super administrador." };
  }
  // 2) Só um super admin pode promover alguém a super admin.
  if (opts.newRole === Role.SUPER_ADMIN && !requesterIsSuper) {
    return { status: 403, error: "Apenas um super administrador pode atribuir o papel de super administrador." };
  }
  // 3) Nunca deixar a plataforma sem super admin activo.
  const demoting = opts.newRole !== undefined && opts.newRole !== Role.SUPER_ADMIN;
  if ((opts.willDeactivate || demoting) && (await isLastActiveSuperAdmin(opts.targetId))) {
    return {
      status: 409,
      error: "Não é possível remover, desactivar ou despromover o último super administrador activo.",
    };
  }
  return null;
}

router.get("/", authorize(Role.ADMIN), requirePermission("users:write"), async (req, res) => {
  const { role, search, includeInactive } = req.query as { role?: Role; search?: string; includeInactive?: string };
  // Scoping multi-tenant: o User não tem `condominiumId` próprio, liga-se ao
  // condomínio via Membership. Compomos com AND (a pesquisa já usa OR) e somos
  // tolerantes a nulos (inclui quem ainda não tem membership — pré-backfill).
  const and: any[] = [];
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (req.condominiumId) {
    and.push({
      OR: [
        { memberships: { some: { condominiumId: req.condominiumId } } },
        { memberships: { none: {} } },
      ],
    });
  }
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(includeInactive === "true" ? {} : { isActive: true }),
      ...(role ? { role } : {}),
      ...(and.length ? { AND: and } : {}),
    },
    include: {
      fraction: { include: { tower: true } },
      ownedFractions: { select: { id: true, identifier: true, towerId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(users.map(({ password, ...u }) => u));
});

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
  phone: z.string().optional(),
  fractionId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(), // legacy
});

router.post("/", authorize(Role.ADMIN), requirePermission("users:write"), validateBody(createUserSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createUserSchema>;
  const fractionId = body.fractionId ?? body.unitId ?? null;
  const hashed = await hashPassword(body.password);
  // Cria o utilizador e, se houver condomínio activo, liga-o via Membership
  // (para aparecer no condomínio certo quando o scoping passar a estrito).
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashed,
        role: body.role,
        phone: body.phone,
        fractionId,
      },
    });
    if (req.condominiumId) {
      await tx.membership.create({
        data: { userId: u.id, condominiumId: req.condominiumId, role: body.role },
      });
    }
    return u;
  });
  const { password, ...safe } = user;
  res.status(201).json(safe);
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  fractionId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  role: z.nativeEnum(Role).optional(),
});

router.put("/:id", authorize(Role.ADMIN), requirePermission("users:write"), validateBody(updateUserSchema), async (req, res) => {
  const body = req.body as z.infer<typeof updateUserSchema>;
  const guard = await guardSuperAdminMutation({
    requesterRole: req.user!.role,
    targetId: req.params.id,
    newRole: body.role,
    willDeactivate: body.isActive === false,
  });
  if (guard) return res.status(guard.status).json({ error: guard.error });
  const { unitId, ...data } = body;
  if (unitId !== undefined && data.fractionId === undefined) (data as any).fractionId = unitId;
  const updated = await prisma.user.update({ where: { id: req.params.id }, data });
  const { password, ...safe } = updated;
  res.json(safe);
});

// Activate user
router.patch("/:id/activate", authorize(Role.ADMIN), requirePermission("users:write"), async (req, res) => {
  const guard = await guardSuperAdminMutation({ requesterRole: req.user!.role, targetId: req.params.id });
  if (guard) return res.status(guard.status).json({ error: guard.error });
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: true },
  });
  const { password, ...safe } = updated;
  res.json(safe);
});

// Deactivate user — invalidates tokens and disables active QR codes
router.patch("/:id/deactivate", authorize(Role.ADMIN), requirePermission("users:write"), async (req, res) => {
  if (req.params.id === req.user!.sub) {
    return res.status(400).json({ error: "Não pode desactivar o próprio utilizador." });
  }
  const guard = await guardSuperAdminMutation({ requesterRole: req.user!.role, targetId: req.params.id, willDeactivate: true });
  if (guard) return res.status(guard.status).json({ error: guard.error });
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } }),
    prisma.refreshToken.deleteMany({ where: { userId: req.params.id } }),
    prisma.qRAccessCode.updateMany({
      where: { createdById: req.params.id, isActive: true },
      data: { isActive: false },
    }),
  ]);
  res.json({ ok: true });
});

// DELETE — anonymize + soft delete. Blocks if user owns active fraction.
router.delete("/:id", authorize(Role.ADMIN), requirePermission("users:write"), async (req, res) => {
  if (req.params.id === req.user!.sub) {
    return res.status(400).json({ error: "Não pode eliminar o próprio utilizador." });
  }
  const guard = await guardSuperAdminMutation({ requesterRole: req.user!.role, targetId: req.params.id, willDeactivate: true });
  if (guard) return res.status(guard.status).json({ error: guard.error });
  const ownedActive = await prisma.fraction.count({
    where: { ownerId: req.params.id, isActive: true },
  });
  if (ownedActive > 0) {
    return res.status(409).json({
      error: `Este utilizador é proprietário de ${ownedActive} fracção(ões) activa(s). Reatribua antes de eliminar.`,
    });
  }
  // Remover relação de inquilino (mantém a fracção)
  await prisma.fraction.updateMany({
    where: { tenantId: req.params.id },
    data: { tenantId: null },
  });
  await prisma.user.update({
    where: { id: req.params.id },
    data: {
      name: "Utilizador Removido",
      email: `${crypto.randomUUID()}@deleted.local`,
      phone: null,
      avatar: null,
      isActive: false,
      deletedAt: new Date(),
      fractionId: null,
    },
  });
  await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });
  res.json({ ok: true });
});

router.post("/:id/reset-password", authorize(Role.ADMIN), requirePermission("users:write"), async (req, res) => {
  const newPassword = (req.body as { newPassword?: string }).newPassword;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 chars" });
  }
  const guard = await guardSuperAdminMutation({ requesterRole: req.user!.role, targetId: req.params.id });
  if (guard) return res.status(guard.status).json({ error: guard.error });
  await prisma.user.update({
    where: { id: req.params.id },
    data: { password: await hashPassword(newPassword) },
  });
  res.json({ ok: true });
});

// Update own profile
router.put("/me/profile", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional().nullable(),
    avatar: z.string().optional().nullable(),
  });
  const body = schema.parse(req.body);
  const updated = await prisma.user.update({
    where: { id: req.user!.sub },
    data: body,
  });
  const { password, ...safe } = updated;
  res.json(safe);
});

export default router;

// ────────────────────────────────────────────────────────────────────────────
// Módulo Sistema (Administração da plataforma) — Melvi Condomínio
//
// Gestão transversal de utilizadores, papéis (Role) e permissões individuais
// (overlay GRANT/DENY) a nível de toda a plataforma — não está limitado a um
// condomínio. Reservado a quem tem a permissão "system:*" (por defeito apenas o
// SUPER_ADMIN; pode ser concedida pontualmente por um super admin).
//
// Princípios de segurança aplicados aqui (back-end é a autoridade):
//   - requirePermission("system:read"|"system:write") em todas as rotas.
//   - Só um SUPER_ADMIN pode atribuir/retirar o papel SUPER_ADMIN ou conceder
//     permissões do módulo "system".
//   - Nunca deixar a plataforma sem pelo menos um SUPER_ADMIN activo.
//   - Todas as alterações de papel/permissões/estado ficam registadas em AuditLog.
// ────────────────────────────────────────────────────────────────────────────
import { Router, Request } from "express";
import { z } from "zod";
import { Role, PermissionEffect } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { validateBody } from "../middleware/validate";
import {
  PERMISSION_CATALOG,
  ROLE_DEFAULTS,
  ALL_PERMISSION_KEYS,
  isValidPermissionKey,
  isSuperAdmin,
  resolvePermissions,
  PermissionOverride,
} from "../auth/permissions";
import { activeSuperAdminCount, isLastActiveSuperAdmin } from "../auth/superAdmin";

const router = Router();
router.use(authenticate);

// Registo de auditoria — best-effort: nunca bloqueia a operação por falhar.
async function audit(req: Request, action: string, entityId: string, metadata: any) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.sub ?? null,
        action,
        entity: "User",
        entityId,
        metadata: metadata ?? undefined,
        ip: req.ip ?? null,
      },
    });
  } catch {
    /* ignore */
  }
}

function isRole(v: any): v is Role {
  return Object.values(Role).includes(v);
}

// ===========================================================================
// Catálogo de permissões + estatísticas (para a UI de administração)
// ===========================================================================
router.get("/permissions/catalog", requirePermission("system:read"), (_req, res) => {
  res.json({
    catalog: PERMISSION_CATALOG,
    roleDefaults: ROLE_DEFAULTS,
    allKeys: ALL_PERMISSION_KEYS,
  });
});

router.get("/stats", requirePermission("system:read"), async (_req, res) => {
  const [superAdmins, totalUsers, activeUsers] = await Promise.all([
    activeSuperAdminCount(),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, isActive: true } }),
  ]);
  res.json({ superAdmins, totalUsers, activeUsers });
});

// ===========================================================================
// Utilizadores (visão de plataforma)
// ===========================================================================
router.get("/users", requirePermission("system:read"), async (req, res) => {
  const search = (req.query.search as string | undefined)?.trim();
  const where: any = { deletedAt: null };
  if (req.query.includeInactive !== "true") where.isActive = true;
  if (req.query.role && isRole(req.query.role)) where.role = req.query.role;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  const users = await prisma.user.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true } },
      _count: { select: { memberships: true, permissions: true } },
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });
  res.json(users.map(({ password, ...u }) => u));
});

router.get("/users/:id", requirePermission("system:read"), async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      organization: { select: { id: true, name: true } },
      permissions: { select: { key: true, effect: true } },
      memberships: { select: { condominiumId: true, role: true } },
    },
  });
  if (!user || user.deletedAt) return res.status(404).json({ error: "Utilizador não encontrado" });

  const overrides: PermissionOverride[] = user.permissions.map((p) => ({
    key: p.key,
    effect: p.effect === "DENY" ? "DENY" : "GRANT",
  }));
  const effective = resolvePermissions(user.role, overrides);
  const { password, ...safe } = user;
  res.json({
    user: safe,
    overrides,
    effective,
    roleDefaults: ROLE_DEFAULTS[user.role],
    isSuperAdmin: isSuperAdmin(user.role),
  });
});

// ===========================================================================
// Alterar papel (Role) de um utilizador
// ===========================================================================
const roleSchema = z.object({ role: z.nativeEnum(Role) });

router.put("/users/:id/role", requirePermission("system:write"), validateBody(roleSchema), async (req, res) => {
  const { role } = req.body as z.infer<typeof roleSchema>;
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!target || target.deletedAt) return res.status(404).json({ error: "Utilizador não encontrado" });

  // Só um super admin gere o papel de super admin (atribuir ou retirar).
  if ((role === Role.SUPER_ADMIN || target.role === Role.SUPER_ADMIN) && !isSuperAdmin(req.user!.role)) {
    return res.status(403).json({ error: "Apenas um super administrador pode gerir o papel de super administrador." });
  }
  // Nunca despromover o último super admin activo.
  if (target.role === Role.SUPER_ADMIN && role !== Role.SUPER_ADMIN && (await isLastActiveSuperAdmin(target.id))) {
    return res.status(409).json({ error: "Não é possível despromover o último super administrador activo." });
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data: { role } });
  await audit(req, "user.role.update", target.id, { from: target.role, to: role });
  const { password, ...safe } = updated;
  res.json(safe);
});

// ===========================================================================
// Substituir overlay de permissões individuais (GRANT/DENY) de um utilizador
// ===========================================================================
const permsSchema = z.object({
  overrides: z
    .array(
      z.object({
        key: z.string(),
        effect: z.nativeEnum(PermissionEffect),
      })
    )
    .max(ALL_PERMISSION_KEYS.length * 2),
});

router.put("/users/:id/permissions", requirePermission("system:write"), validateBody(permsSchema), async (req, res) => {
  const { overrides } = req.body as z.infer<typeof permsSchema>;
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!target || target.deletedAt) return res.status(404).json({ error: "Utilizador não encontrado" });

  // O super admin tem sempre todas as permissões → o overlay não tem efeito.
  if (target.role === Role.SUPER_ADMIN) {
    return res.status(400).json({
      error: "O super administrador tem todas as permissões; não é possível configurar permissões individuais.",
    });
  }

  // Validar/deduplicar chaves e proteger a concessão de permissões "system:*".
  const seen = new Set<string>();
  const clean: { key: string; effect: PermissionEffect }[] = [];
  for (const o of overrides) {
    if (!isValidPermissionKey(o.key)) {
      return res.status(400).json({ error: `Permissão inválida: ${o.key}` });
    }
    if ((o.key === "system:read" || o.key === "system:write") && o.effect === "GRANT" && !isSuperAdmin(req.user!.role)) {
      return res.status(403).json({ error: "Apenas um super administrador pode conceder permissões do módulo Sistema." });
    }
    if (seen.has(o.key)) continue;
    seen.add(o.key);
    clean.push({ key: o.key, effect: o.effect });
  }

  await prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { userId: target.id } }),
    ...(clean.length
      ? [
          prisma.userPermission.createMany({
            data: clean.map((c) => ({ userId: target.id, key: c.key, effect: c.effect })),
          }),
        ]
      : []),
  ]);
  await audit(req, "user.permissions.update", target.id, { count: clean.length, overrides: clean });
  res.json({ ok: true, overrides: clean });
});

// ===========================================================================
// Activar / desactivar utilizador (visão de plataforma)
// ===========================================================================
router.patch("/users/:id/activate", requirePermission("system:write"), async (req, res) => {
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!target || target.deletedAt) return res.status(404).json({ error: "Utilizador não encontrado" });
  if (target.role === Role.SUPER_ADMIN && !isSuperAdmin(req.user!.role)) {
    return res.status(403).json({ error: "Apenas um super administrador pode gerir outro super administrador." });
  }
  const updated = await prisma.user.update({ where: { id: target.id }, data: { isActive: true } });
  await audit(req, "user.activate", target.id, null);
  const { password, ...safe } = updated;
  res.json(safe);
});

router.patch("/users/:id/deactivate", requirePermission("system:write"), async (req, res) => {
  if (req.params.id === req.user!.sub) {
    return res.status(400).json({ error: "Não pode desactivar o próprio utilizador." });
  }
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!target || target.deletedAt) return res.status(404).json({ error: "Utilizador não encontrado" });
  if (target.role === Role.SUPER_ADMIN && !isSuperAdmin(req.user!.role)) {
    return res.status(403).json({ error: "Apenas um super administrador pode gerir outro super administrador." });
  }
  if (await isLastActiveSuperAdmin(target.id)) {
    return res.status(409).json({ error: "Não é possível desactivar o último super administrador activo." });
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { isActive: false } }),
    prisma.refreshToken.deleteMany({ where: { userId: target.id } }),
    prisma.qRAccessCode.updateMany({
      where: { createdById: target.id, isActive: true },
      data: { isActive: false },
    }),
  ]);
  await audit(req, "user.deactivate", target.id, null);
  res.json({ ok: true });
});

export default router;

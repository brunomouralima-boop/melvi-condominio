import { Router, Request, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { resolveCondominium } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);
router.use(resolveCondominium);

// Isolamento: o condomínio do path tem de estar entre os acessíveis ao
// utilizador (membership/organização). Pré-backfill, o fallback resolve o
// único condomínio existente, pelo que continua a funcionar em produção 1-condo.
function ensureAccessible(req: Request, res: Response, id: string): boolean {
  if (req.accessibleCondominiumIds && !req.accessibleCondominiumIds.includes(id)) {
    res.status(404).json({ error: "Not found" });
    return false;
  }
  return true;
}

// List all condominiums with counts (scoped aos condomínios acessíveis)
router.get("/", async (req, res) => {
  const items = await prisma.condominium.findMany({
    where: req.accessibleCondominiumIds ? { id: { in: req.accessibleCondominiumIds } } : {},
    include: {
      _count: { select: { towers: true } },
      towers: {
        include: { _count: { select: { fractions: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const enriched = items.map((c) => {
    const fractionsCount = c.towers.reduce((acc, t) => acc + t._count.fractions, 0);
    const { towers: _t, ...rest } = c;
    return { ...rest, _count: { ...c._count, fractions: fractionsCount } };
  });
  res.json(enriched);
});

const createSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(2),
  taxId: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().optional().nullable(),
});

router.post("/", authorize(Role.ADMIN), requirePermission("condominiums:write"), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  // Liga o novo condomínio à organização do criador e garante-lhe acesso
  // (ADMIN_ORG acede via organização, mas um ADMIN precisa de Membership).
  const creator = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { organizationId: true },
  });
  const created = await prisma.$transaction(async (tx) => {
    const condo = await tx.condominium.create({
      data: { ...body, organizationId: creator?.organizationId ?? undefined },
    });
    await tx.membership.create({
      data: { userId: req.user!.sub, condominiumId: condo.id, role: req.user!.role },
    });
    return condo;
  });
  res.status(201).json(created);
});

router.get("/:id", async (req, res) => {
  if (!ensureAccessible(req, res, req.params.id)) return;
  const item = await prisma.condominium.findUnique({
    where: { id: req.params.id },
    include: {
      towers: {
        include: {
          _count: { select: { fractions: true } },
        },
        orderBy: { name: "asc" },
      },
      commonAreas: true,
      meters: true,
    },
  });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
  settings: z.any().optional(),
});

router.put("/:id", authorize(Role.ADMIN), requirePermission("condominiums:write"), validateBody(updateSchema), async (req, res) => {
  if (!ensureAccessible(req, res, req.params.id)) return;
  const updated = await prisma.condominium.update({ where: { id: req.params.id }, data: req.body });
  res.json(updated);
});

router.delete("/:id", authorize(Role.ADMIN), requirePermission("condominiums:write"), async (req, res) => {
  if (!ensureAccessible(req, res, req.params.id)) return;
  const active = await prisma.fraction.count({
    where: { tower: { condominiumId: req.params.id }, isActive: true },
  });
  if (active > 0) {
    return res.status(409).json({ error: `Não pode eliminar: o condomínio tem ${active} fracção(ões) activa(s).` });
  }
  await prisma.condominium.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

// Validação de permilagem: soma de todas as fracções deve aproximar 1000‰
router.get("/:id/permillage-check", async (req, res) => {
  if (!ensureAccessible(req, res, req.params.id)) return;
  const fractions = await prisma.fraction.findMany({
    where: { tower: { condominiumId: req.params.id }, isActive: true },
    select: { permillage: true },
  });
  const total = fractions.reduce((acc, f) => acc + Number(f.permillage), 0);
  const diff = total - 1000;
  res.json({
    total,
    diff,
    ok: Math.abs(diff) <= 0.1,
    warning: Math.abs(diff) > 0.1 ? `Total ${total.toFixed(4)}‰ — divergência de ${diff.toFixed(4)}‰ face a 1000‰.` : null,
  });
});

// ─── Gestão de membros (memberships) ──────────────────────────────
// Quem tem acesso a este condomínio e com que papel. ADMIN_ORG gere todos
// os condomínios da organização; um ADMIN gere o(s) seu(s) (via ensureAccessible).

router.get("/:id/members", authorize(Role.ADMIN), requirePermission("condominiums:write"), async (req, res) => {
  if (!ensureAccessible(req, res, req.params.id)) return;
  const members = await prisma.membership.findMany({
    where: { condominiumId: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, isActive: true, avatar: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(members);
});

const memberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(Role),
});

router.post("/:id/members", authorize(Role.ADMIN), requirePermission("condominiums:write"), validateBody(memberSchema), async (req, res) => {
  if (!ensureAccessible(req, res, req.params.id)) return;
  const { userId, role } = req.body as z.infer<typeof memberSchema>;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });
  const membership = await prisma.membership.upsert({
    where: { userId_condominiumId: { userId, condominiumId: req.params.id } },
    create: { userId, condominiumId: req.params.id, role },
    update: { role },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  res.status(201).json(membership);
});

const memberRoleSchema = z.object({ role: z.nativeEnum(Role) });

router.patch("/:id/members/:userId", authorize(Role.ADMIN), requirePermission("condominiums:write"), validateBody(memberRoleSchema), async (req, res) => {
  if (!ensureAccessible(req, res, req.params.id)) return;
  const { role } = req.body as z.infer<typeof memberRoleSchema>;
  const existing = await prisma.membership.findUnique({
    where: { userId_condominiumId: { userId: req.params.userId, condominiumId: req.params.id } },
  });
  if (!existing) return res.status(404).json({ error: "Membro não encontrado" });
  const updated = await prisma.membership.update({
    where: { userId_condominiumId: { userId: req.params.userId, condominiumId: req.params.id } },
    data: { role },
  });
  res.json(updated);
});

router.delete("/:id/members/:userId", authorize(Role.ADMIN), requirePermission("condominiums:write"), async (req, res) => {
  if (!ensureAccessible(req, res, req.params.id)) return;
  // Impede remover o próprio acesso (evita auto-bloqueio).
  if (req.params.userId === req.user!.sub) {
    return res.status(400).json({ error: "Não pode remover o seu próprio acesso." });
  }
  await prisma.membership.deleteMany({
    where: { userId: req.params.userId, condominiumId: req.params.id },
  });
  res.json({ ok: true });
});

export default router;

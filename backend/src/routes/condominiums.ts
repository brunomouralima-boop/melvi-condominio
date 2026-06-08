import { Router, Request, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
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

router.post("/", authorize(Role.ADMIN), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const created = await prisma.condominium.create({ data: body });
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

router.put("/:id", authorize(Role.ADMIN), validateBody(updateSchema), async (req, res) => {
  if (!ensureAccessible(req, res, req.params.id)) return;
  const updated = await prisma.condominium.update({ where: { id: req.params.id }, data: req.body });
  res.json(updated);
});

router.delete("/:id", authorize(Role.ADMIN), async (req, res) => {
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

export default router;

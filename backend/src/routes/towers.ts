import { Router } from "express";
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

router.get("/", async (req, res) => {
  // O condomínio activo (header x-condominium-id) governa; a query é fallback.
  const cid = req.condominiumId ?? (req.query.condominiumId as string | undefined);
  const towers = await prisma.tower.findMany({
    where: cid ? { condominiumId: cid } : {},
    include: {
      condominium: { select: { id: true, name: true } },
      _count: { select: { fractions: true } },
      fractions: { select: { status: true, isActive: true } },
    },
    orderBy: [{ condominiumId: "asc" }, { name: "asc" }],
  });

  // computed: counts por status
  const enriched = towers.map((t) => {
    const occupied = t.fractions.filter((f) => f.isActive && f.status === "OCCUPIED").length;
    const vacant = t.fractions.filter((f) => f.isActive && f.status === "VACANT").length;
    const total = t.fractions.filter((f) => f.isActive).length;
    const { fractions: _f, ...rest } = t;
    return { ...rest, stats: { total, occupied, vacant } };
  });
  res.json(enriched);
});

const createSchema = z.object({
  condominiumId: z.string().uuid(),
  name: z.string().min(1),
  floors: z.number().int().positive(),
  description: z.string().optional().nullable(),
});

router.post("/", authorize(Role.ADMIN), requirePermission("towers:write"), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  // Força a torre no condomínio activo (impede criar noutro condomínio).
  const created = await prisma.tower.create({
    data: { ...body, condominiumId: req.condominiumId ?? body.condominiumId },
  });
  res.status(201).json(created);
});

router.get("/:id", async (req, res) => {
  const item = await prisma.tower.findUnique({
    where: { id: req.params.id },
    include: {
      condominium: true,
      fractions: {
        include: {
          owner: { select: { id: true, name: true, email: true, avatar: true } },
          tenant: { select: { id: true, name: true, email: true, avatar: true } },
        },
        orderBy: [{ floor: "asc" }, { identifier: "asc" }],
      },
    },
  });
  if (!item) return res.status(404).json({ error: "Not found" });
  if (req.condominiumId && item.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json(item);
});

const updateSchema = z.object({
  name: z.string().optional(),
  floors: z.number().int().positive().optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.put("/:id", authorize(Role.ADMIN), requirePermission("towers:write"), validateBody(updateSchema), async (req, res) => {
  const existing = await prisma.tower.findUnique({ where: { id: req.params.id }, select: { condominiumId: true } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (req.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Not found" });
  }
  const updated = await prisma.tower.update({ where: { id: req.params.id }, data: req.body });
  res.json(updated);
});

router.delete("/:id", authorize(Role.ADMIN), requirePermission("towers:write"), async (req, res) => {
  const existing = await prisma.tower.findUnique({ where: { id: req.params.id }, select: { condominiumId: true } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (req.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Not found" });
  }
  const active = await prisma.fraction.count({ where: { towerId: req.params.id, isActive: true } });
  if (active > 0) {
    return res.status(409).json({ error: `Não pode eliminar: a torre tem ${active} fracção(ões) activa(s).` });
  }
  await prisma.tower.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const { condominiumId } = req.query as { condominiumId?: string };
  const towers = await prisma.tower.findMany({
    where: condominiumId ? { condominiumId } : {},
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

router.post("/", authorize(Role.ADMIN), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const created = await prisma.tower.create({ data: body });
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
  res.json(item);
});

const updateSchema = z.object({
  name: z.string().optional(),
  floors: z.number().int().positive().optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.put("/:id", authorize(Role.ADMIN), validateBody(updateSchema), async (req, res) => {
  const updated = await prisma.tower.update({ where: { id: req.params.id }, data: req.body });
  res.json(updated);
});

router.delete("/:id", authorize(Role.ADMIN), async (req, res) => {
  const active = await prisma.fraction.count({ where: { towerId: req.params.id, isActive: true } });
  if (active > 0) {
    return res.status(409).json({ error: `Não pode eliminar: a torre tem ${active} fracção(ões) activa(s).` });
  }
  await prisma.tower.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

export default router;

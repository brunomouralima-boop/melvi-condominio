import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const where = req.user!.role === Role.ADMIN ? {} : { userId: req.user!.sub };
  const items = await prisma.vehicle.findMany({
    where,
    include: { user: { select: { id: true, name: true, fractionId: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

const createSchema = z.object({
  plate: z.string().min(3),
  brand: z.string().min(1),
  model: z.string().min(1),
  color: z.string().min(1),
  photo: z.string().optional().nullable(),
});

router.post("/", validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const v = await prisma.vehicle.create({
    data: { ...body, userId: req.user!.sub },
  });
  res.status(201).json(v);
});

router.put("/:id", async (req, res) => {
  const v = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
  if (!v) return res.status(404).json({ error: "Not found" });
  if (req.user!.role !== Role.ADMIN && v.userId !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const updated = await prisma.vehicle.update({ where: { id: req.params.id }, data: req.body });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const v = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
  if (!v) return res.status(404).json({ error: "Not found" });
  if (req.user!.role !== Role.ADMIN && v.userId !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await prisma.vehicle.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const where = req.user!.role === Role.ADMIN ? {} : { userId: req.user!.sub };
  const items = await prisma.dependent.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(items);
});

const createSchema = z.object({
  name: z.string().min(2),
  relationship: z.string().min(2),
  document: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
});

router.post("/", validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const dep = await prisma.dependent.create({
    data: { ...body, userId: req.user!.sub },
  });
  res.status(201).json(dep);
});

router.put("/:id", async (req, res) => {
  const dep = await prisma.dependent.findUnique({ where: { id: req.params.id } });
  if (!dep) return res.status(404).json({ error: "Not found" });
  if (req.user!.role !== Role.ADMIN && dep.userId !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const schema = z.object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    document: z.string().optional().nullable(),
    photo: z.string().optional().nullable(),
  });
  const updated = await prisma.dependent.update({
    where: { id: req.params.id },
    data: schema.parse(req.body),
  });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const dep = await prisma.dependent.findUnique({ where: { id: req.params.id } });
  if (!dep) return res.status(404).json({ error: "Not found" });
  if (req.user!.role !== Role.ADMIN && dep.userId !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await prisma.dependent.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;

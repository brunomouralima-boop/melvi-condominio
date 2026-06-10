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
  const items = await prisma.commonArea.findMany({
    where: req.condominiumId ? { condominiumId: req.condominiumId } : {},
    orderBy: { name: "asc" },
  });
  res.json(items);
});

const schema = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  capacity: z.number().int().positive(),
  rules: z.string().optional().nullable(),
  photos: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  condominiumId: z.string().uuid(),
});

router.post("/", authorize(Role.ADMIN), requirePermission("common-areas:write"), validateBody(schema), async (req, res) => {
  const body = req.body as z.infer<typeof schema>;
  const item = await prisma.commonArea.create({
    data: { ...body, condominiumId: req.condominiumId ?? body.condominiumId, photos: body.photos ?? [] },
  });
  res.status(201).json(item);
});

router.put("/:id", authorize(Role.ADMIN), requirePermission("common-areas:write"), async (req, res) => {
  const existing = await prisma.commonArea.findUnique({ where: { id: req.params.id }, select: { condominiumId: true } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (req.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Not found" });
  }
  // condominiumId não é alterável via update (impede mover entre condomínios)
  const { condominiumId: _ignore, ...rest } = req.body ?? {};
  const item = await prisma.commonArea.update({
    where: { id: req.params.id },
    data: rest,
  });
  res.json(item);
});

router.delete("/:id", authorize(Role.ADMIN), requirePermission("common-areas:write"), async (req, res) => {
  const existing = await prisma.commonArea.findUnique({ where: { id: req.params.id }, select: { condominiumId: true } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (req.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Not found" });
  }
  await prisma.commonArea.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

export default router;

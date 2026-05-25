import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);

router.get("/", async (_req, res) => {
  const items = await prisma.commonArea.findMany({ orderBy: { name: "asc" } });
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

router.post("/", authorize(Role.ADMIN), validateBody(schema), async (req, res) => {
  const body = req.body as z.infer<typeof schema>;
  const item = await prisma.commonArea.create({ data: { ...body, photos: body.photos ?? [] } });
  res.status(201).json(item);
});

router.put("/:id", authorize(Role.ADMIN), async (req, res) => {
  const item = await prisma.commonArea.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(item);
});

router.delete("/:id", authorize(Role.ADMIN), async (req, res) => {
  await prisma.commonArea.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

export default router;

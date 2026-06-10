import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authenticate, isAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { resolveCondominium, ownerCondoScope } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);
router.use(resolveCondominium);

router.get("/", async (req, res) => {
  // Admin vê os do condomínio activo (via condomínio do dono); residente só os seus.
  const where = isAdmin(req.user!.role) ? ownerCondoScope(req) : { userId: req.user!.sub };
  const items = await prisma.pet.findMany({
    where,
    include: { user: { select: { id: true, name: true, fractionId: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

const createSchema = z.object({
  name: z.string().min(1),
  species: z.string().min(1),
  breed: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post("/", requirePermission("pets:write"), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const pet = await prisma.pet.create({
    data: {
      name: body.name,
      species: body.species,
      breed: body.breed || null,
      photo: body.photo || null,
      notes: body.notes || null,
      userId: req.user!.sub,
    },
  });
  res.status(201).json(pet);
});

router.put("/:id", requirePermission("pets:write"), async (req, res) => {
  const pet = await prisma.pet.findUnique({ where: { id: req.params.id } });
  if (!pet) return res.status(404).json({ error: "Not found" });
  if (!isAdmin(req.user!.role) && pet.userId !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const updated = await prisma.pet.update({ where: { id: req.params.id }, data: req.body });
  res.json(updated);
});

router.delete("/:id", requirePermission("pets:write"), async (req, res) => {
  const pet = await prisma.pet.findUnique({ where: { id: req.params.id } });
  if (!pet) return res.status(404).json({ error: "Not found" });
  if (!isAdmin(req.user!.role) && pet.userId !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await prisma.pet.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;

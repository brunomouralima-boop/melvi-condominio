import { Router } from "express";
import { z } from "zod";
import { Role, OccurrenceCategory, OccurrenceStatus, OccurrencePriority } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { emitToUser, emitToRole } from "../sockets";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const where: any = {};
  if (req.user!.role === Role.RESIDENT) where.createdById = req.user!.sub;
  const { status, category } = req.query as { status?: OccurrenceStatus; category?: OccurrenceCategory };
  if (status) where.status = status;
  if (category) where.category = category;

  const items = await prisma.occurrence.findMany({
    where,
    include: {
      fraction: { include: { tower: true } },
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

router.get("/:id", async (req, res) => {
  const item = await prisma.occurrence.findUnique({
    where: { id: req.params.id },
    include: {
      fraction: { include: { tower: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  if (!item) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === Role.RESIDENT && item.createdById !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(item);
});

const createSchema = z.object({
  title: z.string().min(3),
  category: z.nativeEnum(OccurrenceCategory),
  description: z.string().min(5),
  priority: z.nativeEnum(OccurrencePriority).optional(),
  photos: z.array(z.string()).optional(),
  fractionId: z.string().uuid().optional(),
});

router.post("/", validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  if (req.user!.role === Role.RESIDENT && !req.user!.fractionId) {
    return res.status(400).json({ error: "You are not associated with a fraction" });
  }
  const fractionId = req.user!.role === Role.RESIDENT ? req.user!.fractionId! : body.fractionId;
  if (!fractionId) return res.status(400).json({ error: "fractionId required" });

  const item = await prisma.occurrence.create({
    data: {
      title: body.title,
      category: body.category,
      description: body.description,
      priority: body.priority ?? OccurrencePriority.MEDIUM,
      photos: body.photos ?? [],
      fractionId,
      createdById: req.user!.sub,
    },
    include: {
      fraction: { include: { tower: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  const admins = await prisma.user.findMany({ where: { role: Role.ADMIN, isActive: true }, select: { id: true } });
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      title: "Nova ocorrência",
      message: `${item.createdBy.name}: ${item.title}`,
      type: "OCCURRENCE" as const,
      relatedId: item.id,
    })),
  });
  emitToRole(Role.ADMIN, "occurrence:new", item);

  res.status(201).json(item);
});

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.nativeEnum(OccurrenceCategory).optional(),
  priority: z.nativeEnum(OccurrencePriority).optional(),
  status: z.nativeEnum(OccurrenceStatus).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
});

router.put("/:id", validateBody(updateSchema), async (req, res) => {
  const item = await prisma.occurrence.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: "Not found" });

  if (req.user!.role === Role.RESIDENT) {
    if (item.createdById !== req.user!.sub) return res.status(403).json({ error: "Forbidden" });
    delete (req.body as any).status;
    delete (req.body as any).assignedToId;
  }

  const updated = await prisma.occurrence.update({
    where: { id: req.params.id },
    data: req.body,
    include: { fraction: true, createdBy: { select: { id: true, name: true } } },
  });
  emitToUser(updated.createdById, "occurrence:updated", updated);
  res.json(updated);
});

const responseSchema = z.object({
  response: z.string().min(2),
  status: z.nativeEnum(OccurrenceStatus).optional(),
});

router.post("/:id/response", authorize(Role.ADMIN), validateBody(responseSchema), async (req, res) => {
  const body = req.body as z.infer<typeof responseSchema>;
  const updated = await prisma.occurrence.update({
    where: { id: req.params.id },
    data: {
      response: body.response,
      status: body.status ?? OccurrenceStatus.IN_PROGRESS,
      assignedToId: req.user!.sub,
    },
    include: { fraction: true, createdBy: { select: { id: true, name: true } } },
  });
  await prisma.notification.create({
    data: {
      userId: updated.createdById,
      title: "Resposta à sua ocorrência",
      message: updated.title,
      type: "OCCURRENCE",
      relatedId: updated.id,
    },
  });
  emitToUser(updated.createdById, "occurrence:updated", updated);
  res.json(updated);
});

export default router;

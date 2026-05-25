import { Router } from "express";
import { z } from "zod";
import { Role, ReservationStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { emitToUser } from "../sockets";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const where: any = {};
  if (req.user!.role === Role.RESIDENT) where.userId = req.user!.sub;
  const items = await prisma.reservation.findMany({
    where,
    include: {
      commonArea: true,
      fraction: { include: { tower: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });
  res.json(items);
});

const createSchema = z.object({
  commonAreaId: z.string().uuid(),
  date: z.string().datetime(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional().nullable(),
  fractionId: z.string().uuid().optional(),
});

router.post("/", validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  if (req.user!.role === Role.RESIDENT && !req.user!.fractionId) {
    return res.status(400).json({ error: "You are not associated with a fraction" });
  }
  const fractionId = req.user!.role === Role.RESIDENT ? req.user!.fractionId! : body.fractionId;
  if (!fractionId) return res.status(400).json({ error: "fractionId required" });

  const item = await prisma.reservation.create({
    data: {
      commonAreaId: body.commonAreaId,
      date: new Date(body.date),
      startTime: body.startTime,
      endTime: body.endTime,
      notes: body.notes ?? null,
      fractionId,
      userId: req.user!.sub,
    },
    include: { commonArea: true },
  });
  res.status(201).json(item);
});

const statusSchema = z.object({
  status: z.nativeEnum(ReservationStatus),
});

router.put("/:id/status", authorize(Role.ADMIN), validateBody(statusSchema), async (req, res) => {
  const updated = await prisma.reservation.update({
    where: { id: req.params.id },
    data: { status: (req.body as any).status },
  });
  emitToUser(updated.userId, "reservation:updated", updated);
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const item = await prisma.reservation.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === Role.RESIDENT && item.userId !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await prisma.reservation.update({
    where: { id: req.params.id },
    data: { status: ReservationStatus.CANCELLED },
  });
  res.json({ ok: true });
});

export default router;

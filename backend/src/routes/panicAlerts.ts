import { Router } from "express";
import { z } from "zod";
import { Role, PanicStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { emitToRole, emitToUser } from "../sockets";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const where: any = {};
  if (req.user!.role === Role.RESIDENT) where.triggeredById = req.user!.sub;
  const { status } = req.query as { status?: PanicStatus };
  if (status) where.status = status;

  const items = await prisma.panicAlert.findMany({
    where,
    include: {
      fraction: { include: { tower: true } },
      triggeredBy: { select: { id: true, name: true, phone: true } },
      acknowledgedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(items);
});

const createSchema = z.object({
  description: z.string().min(10),
});

router.post("/", authorize(Role.RESIDENT), validateBody(createSchema), async (req, res) => {
  const { description } = req.body as z.infer<typeof createSchema>;
  if (!req.user!.fractionId) return res.status(400).json({ error: "You are not associated with a fraction" });

  const alert = await prisma.panicAlert.create({
    data: {
      description,
      fractionId: req.user!.fractionId,
      triggeredById: req.user!.sub,
    },
    include: {
      fraction: { include: { tower: true } },
      triggeredBy: { select: { id: true, name: true, phone: true } },
    },
  });

  const recipients = await prisma.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.DOORMAN] }, isActive: true },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: recipients.map((u) => ({
      userId: u.id,
      title: "🚨 ALERTA DE PÂNICO",
      message: `${alert.triggeredBy.name} (${alert.fraction.tower.name} ${alert.fraction.identifier}): ${description}`,
      type: "PANIC" as const,
      relatedId: alert.id,
    })),
  });

  const payload = {
    id: alert.id,
    unit: `${alert.fraction.tower.name} ${alert.fraction.identifier}`,
    fractionId: alert.fractionId,
    residentName: alert.triggeredBy.name,
    residentPhone: alert.triggeredBy.phone,
    description: alert.description,
    timestamp: alert.createdAt.toISOString(),
    status: alert.status,
  };

  emitToRole(Role.DOORMAN, "panic:alert", payload);
  emitToRole(Role.ADMIN, "panic:alert", payload);

  res.status(201).json(alert);
});

router.put("/:id/acknowledge", authorize(Role.DOORMAN, Role.ADMIN), async (req, res) => {
  const alert = await prisma.panicAlert.findUnique({ where: { id: req.params.id } });
  if (!alert) return res.status(404).json({ error: "Not found" });
  if (alert.status !== PanicStatus.ACTIVE) {
    return res.status(400).json({ error: "Alert already acknowledged or resolved" });
  }

  const updated = await prisma.panicAlert.update({
    where: { id: req.params.id },
    data: {
      status: PanicStatus.ACKNOWLEDGED,
      acknowledgedById: req.user!.sub,
      acknowledgedAt: new Date(),
    },
    include: {
      acknowledgedBy: { select: { id: true, name: true, role: true } },
    },
  });

  emitToUser(alert.triggeredById, "panic:acknowledged", {
    id: updated.id,
    acknowledgedBy: updated.acknowledgedBy,
    acknowledgedAt: updated.acknowledgedAt,
  });
  emitToRole(Role.ADMIN, "panic:updated", updated);
  emitToRole(Role.DOORMAN, "panic:updated", updated);

  res.json(updated);
});

router.put("/:id/resolve", authorize(Role.ADMIN), async (req, res) => {
  const alert = await prisma.panicAlert.findUnique({ where: { id: req.params.id } });
  if (!alert) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.panicAlert.update({
    where: { id: req.params.id },
    data: { status: PanicStatus.RESOLVED, resolvedAt: new Date() },
  });
  emitToUser(alert.triggeredById, "panic:resolved", updated);
  emitToRole(Role.ADMIN, "panic:updated", updated);
  emitToRole(Role.DOORMAN, "panic:updated", updated);
  res.json(updated);
});

export default router;

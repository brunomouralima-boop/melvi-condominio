import { Router } from "express";
import { z } from "zod";
import { Role, AccessLogType, AccessMethod } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { resolveCondominium, tenantWhere } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";
import { emitToRole } from "../sockets";

const router = Router();
router.use(authenticate);
router.use(resolveCondominium);

router.get("/", async (req, res) => {
  const { date, fractionId, unitId, type } = req.query as {
    date?: string;
    fractionId?: string;
    unitId?: string;
    type?: AccessLogType;
  };
  const effectiveFractionId = fractionId ?? unitId; // legacy alias

  const where: any = { ...tenantWhere(req) };
  if (req.user!.role === Role.RESIDENT) where.fractionId = req.user!.fractionId;
  if (effectiveFractionId) where.fractionId = effectiveFractionId;
  if (type) where.type = type;
  if (date) {
    const d = new Date(date);
    const end = new Date(d);
    end.setDate(end.getDate() + 1);
    where.timestamp = { gte: d, lt: end };
  }

  const logs = await prisma.accessLog.findMany({
    where,
    include: {
      fraction: { include: { tower: true } },
      registeredBy: { select: { id: true, name: true } },
      qrCode: { select: { id: true, type: true } },
    },
    orderBy: { timestamp: "desc" },
    take: 500,
  });
  res.json(logs);
});

const createSchema = z.object({
  type: z.nativeEnum(AccessLogType),
  personName: z.string().min(2),
  personDocument: z.string().optional().nullable(),
  fractionId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post("/", authorize(Role.DOORMAN, Role.ADMIN), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const log = await prisma.accessLog.create({
    data: {
      type: body.type,
      personName: body.personName,
      personDocument: body.personDocument ?? null,
      fractionId: body.fractionId ?? null,
      condominiumId: req.condominiumId,
      notes: body.notes ?? null,
      method: AccessMethod.MANUAL,
      registeredById: req.user!.sub,
    },
    include: { fraction: { include: { tower: true } } },
  });
  emitToRole(Role.ADMIN, "access:new", log);
  emitToRole(Role.DOORMAN, "access:new", log);
  res.status(201).json(log);
});

export default router;

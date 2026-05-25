import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { Role, QRAccessType, AccessLogType, AccessMethod } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { signQR, verifyQR, generateQRImage } from "../utils/qr";
import { emitToRole } from "../sockets";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const where = req.user!.role === Role.RESIDENT ? { createdById: req.user!.sub } : {};
  const items = await prisma.qRAccessCode.findMany({
    where,
    include: {
      fraction: { include: { tower: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { accessLogs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

const createSchema = z.object({
  type: z.nativeEnum(QRAccessType),
  guestName: z.string().min(2),
  guestDocument: z.string().optional().nullable(),
  guestCompany: z.string().optional().nullable(),
  serviceType: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  maxUses: z.number().int().positive().default(1),
});

router.post("/", validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  if (req.user!.role !== Role.RESIDENT) {
    return res.status(403).json({ error: "Only residents can create QR codes" });
  }
  if (!req.user!.fractionId) return res.status(400).json({ error: "You are not associated with a fraction" });

  const id = crypto.randomUUID();
  const qrCodeData = signQR({
    id,
    type: body.type,
    fractionId: req.user!.fractionId,
    expiresAt: body.validUntil,
  });

  const created = await prisma.qRAccessCode.create({
    data: {
      id,
      type: body.type,
      guestName: body.guestName,
      guestDocument: body.guestDocument ?? null,
      guestCompany: body.guestCompany ?? null,
      serviceType: body.serviceType ?? null,
      photo: body.photo ?? null,
      validFrom: new Date(body.validFrom),
      validUntil: new Date(body.validUntil),
      maxUses: body.maxUses,
      qrCodeData,
      createdById: req.user!.sub,
      fractionId: req.user!.fractionId,
    },
    include: { fraction: { include: { tower: true } } },
  });

  res.status(201).json(created);
});

router.put("/:id/deactivate", async (req, res) => {
  const qr = await prisma.qRAccessCode.findUnique({ where: { id: req.params.id } });
  if (!qr) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === Role.RESIDENT && qr.createdById !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const updated = await prisma.qRAccessCode.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  res.json(updated);
});

router.get("/:id/image", async (req, res) => {
  const qr = await prisma.qRAccessCode.findUnique({ where: { id: req.params.id } });
  if (!qr) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === Role.RESIDENT && qr.createdById !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const png = await generateQRImage(qr.qrCodeData);
  res.setHeader("Content-Type", "image/png");
  res.send(png);
});

const validateSchema = z.object({
  qrCodeData: z.string().min(1),
});

router.post("/validate", authorize(Role.DOORMAN, Role.ADMIN), validateBody(validateSchema), async (req, res) => {
  const { qrCodeData } = req.body as z.infer<typeof validateSchema>;
  const payload = verifyQR(qrCodeData);
  if (!payload) return res.status(400).json({ valid: false, reason: "Invalid signature" });

  const qr = await prisma.qRAccessCode.findUnique({
    where: { id: payload.id },
    include: {
      fraction: { include: { tower: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!qr) return res.status(404).json({ valid: false, reason: "QR not found" });

  const now = new Date();
  if (!qr.isActive) return res.json({ valid: false, reason: "QR inactive", qr });
  if (now < qr.validFrom) return res.json({ valid: false, reason: "QR not yet valid", qr });
  if (now > qr.validUntil) return res.json({ valid: false, reason: "QR expired", qr });
  if (qr.usedCount >= qr.maxUses) return res.json({ valid: false, reason: "QR usage exceeded", qr });

  const log = await prisma.accessLog.create({
    data: {
      type: AccessLogType.ENTRY,
      personName: qr.guestName,
      personDocument: qr.guestDocument,
      fractionId: qr.fractionId,
      qrCodeId: qr.id,
      method: AccessMethod.QR,
      registeredById: req.user!.sub,
      notes: `Validado por QR — ${qr.type}`,
    },
    include: { fraction: { include: { tower: true } } },
  });

  await prisma.qRAccessCode.update({
    where: { id: qr.id },
    data: { usedCount: { increment: 1 } },
  });

  await prisma.notification.create({
    data: {
      userId: qr.createdById,
      title: "Visitante autorizado entrou",
      message: `${qr.guestName} acaba de entrar no condomínio.`,
      type: "ACCESS",
      relatedId: log.id,
    },
  });

  emitToRole(Role.ADMIN, "access:new", log);
  emitToRole(Role.DOORMAN, "access:new", log);

  res.json({ valid: true, qr, log });
});

export default router;

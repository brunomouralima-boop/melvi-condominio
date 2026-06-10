import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { Role, QRAccessType, AccessLogType, AccessMethod } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { resolveCondominium, tenantWhere } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";
import { signQR, verifyQR, generateQRImage, generateShortCode } from "../utils/qr";
import { verifyAccessToken } from "../utils/jwt";
import { emitToRole } from "../sockets";

const router = Router();

/**
 * Rate limiter para a rota /validate.
 * Com códigos de 4 dígitos (10 000 combinações), limitar tentativas é crítico
 * para impedir ataques de força-bruta. 20 tentativas / minuto / IP é
 * generoso para uso legítimo (porteiro com erros de digitação) mas torna
 * inviável tentar todas as 10 000 combinações em tempo útil.
 */
const validateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, reason: "Demasiadas tentativas. Aguarde 1 minuto." },
});

// ─────────────────────────────────────────────────────────────
// GET /:id/image — DEVE ficar ANTES do middleware authenticate
// porque <img src=""> não envia header Authorization.
// Aceita o token via query string (?token=...) para mantermos segurança.
// ─────────────────────────────────────────────────────────────
router.get("/:id/image", async (req, res) => {
  // Aceita token via query (?token=eyJ...) — usado pelas <img> tags
  const token = (req.query.token as string) || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
  if (!token) return res.status(401).json({ error: "Missing token" });

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  const qr = await prisma.qRAccessCode.findUnique({ where: { id: req.params.id } });
  if (!qr) return res.status(404).json({ error: "Not found" });

  // Residente só pode ver os seus próprios QR
  if (payload.role === Role.RESIDENT && qr.createdById !== payload.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const png = await generateQRImage(qr.qrCodeData);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(png);
});

// A partir daqui todas as rotas exigem auth JWT no header
router.use(authenticate);
router.use(resolveCondominium);

router.get("/", async (req, res) => {
  const where: any = { ...tenantWhere(req) };
  if (req.user!.role === Role.RESIDENT) where.createdById = req.user!.sub;
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

router.post("/", requirePermission("qr-codes:write"), validateBody(createSchema), async (req, res) => {
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

  // Gera um shortCode único (4 dígitos = 10 000 combinações).
  // Tentamos até 50 vezes em caso de colisão. Em produção real, se a base
  // crescer muito, considera implementar nullify de shortCode quando QR é
  // usado/expira para libertar o slot.
  let shortCode = generateShortCode();
  for (let attempt = 0; attempt < 50; attempt++) {
    const exists = await prisma.qRAccessCode.findUnique({ where: { shortCode } });
    if (!exists) break;
    shortCode = generateShortCode();
    if (attempt === 49) {
      return res.status(503).json({ error: "Espaço de códigos esgotado, tente mais tarde." });
    }
  }

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
      shortCode,
      condominiumId: req.condominiumId,
      createdById: req.user!.sub,
      fractionId: req.user!.fractionId,
    },
    include: { fraction: { include: { tower: true } } },
  });

  res.status(201).json(created);
});

router.put("/:id/deactivate", requirePermission("qr-codes:write"), async (req, res) => {
  const qr = await prisma.qRAccessCode.findUnique({ where: { id: req.params.id } });
  if (!qr) return res.status(404).json({ error: "Not found" });
  if (qr.condominiumId && qr.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Not found" });
  }
  if (req.user!.role === Role.RESIDENT && qr.createdById !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const updated = await prisma.qRAccessCode.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────
// Validação — aceita qrCodeData (do scan) OU shortCode (digitação)
// ─────────────────────────────────────────────────────────────
const validateSchema = z
  .object({
    qrCodeData: z.string().optional(),
    shortCode: z.string().optional(),
  })
  .refine((d) => !!d.qrCodeData || !!d.shortCode, {
    message: "qrCodeData ou shortCode obrigatório",
  });

router.post("/validate", validateLimiter, authorize(Role.DOORMAN, Role.ADMIN), requirePermission("qr-codes:write"), validateBody(validateSchema), async (req, res) => {
  const { qrCodeData, shortCode } = req.body as z.infer<typeof validateSchema>;

  let qrId: string | null = null;

  if (qrCodeData) {
    const payload = verifyQR(qrCodeData);
    if (!payload) return res.status(400).json({ valid: false, reason: "QR Code inválido (assinatura)" });
    qrId = payload.id;
  } else if (shortCode) {
    // Normalizar: remover tudo que não seja dígito (espaços, hifens, etc)
    const normalized = shortCode.replace(/\D/g, "");
    if (normalized.length !== 4) {
      return res.status(400).json({ valid: false, reason: "Código deve ter 4 dígitos" });
    }
    const qr = await prisma.qRAccessCode.findUnique({ where: { shortCode: normalized } });
    if (!qr) return res.status(404).json({ valid: false, reason: "Código não encontrado" });
    qrId = qr.id;
  }

  if (!qrId) return res.status(400).json({ valid: false, reason: "Nenhum código fornecido" });

  const qr = await prisma.qRAccessCode.findUnique({
    where: { id: qrId },
    include: {
      fraction: { include: { tower: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!qr) return res.status(404).json({ valid: false, reason: "QR não encontrado" });
  if (qr.condominiumId && qr.condominiumId !== req.condominiumId) {
    return res.status(404).json({ valid: false, reason: "Código não pertence a este condomínio" });
  }

  const now = new Date();
  if (!qr.isActive) return res.json({ valid: false, reason: "Acesso desativado pelo residente", qr });
  if (now < qr.validFrom) return res.json({ valid: false, reason: "Acesso ainda não válido", qr });
  if (now > qr.validUntil) return res.json({ valid: false, reason: "Acesso expirado", qr });
  if (qr.usedCount >= qr.maxUses) return res.json({ valid: false, reason: "Acesso já foi utilizado", qr });

  // Cria AccessLog (evento bruto — audit trail) E Visit (objecto da visita)
  // dentro de uma transacção para garantir consistência.
  const { log, visit } = await prisma.$transaction(async (tx) => {
    const entryAt = new Date();

    const log = await tx.accessLog.create({
      data: {
        type: AccessLogType.ENTRY,
        personName: qr.guestName,
        personDocument: qr.guestDocument,
        fractionId: qr.fractionId,
        condominiumId: qr.condominiumId ?? req.condominiumId,
        qrCodeId: qr.id,
        method: qrCodeData ? AccessMethod.QR : AccessMethod.MANUAL,
        registeredById: req.user!.sub,
        notes: `Validado por ${qrCodeData ? "QR Code" : "código manual"} — ${qr.type}`,
      },
      include: { fraction: { include: { tower: true } } },
    });

    const visit = await tx.visit.create({
      data: {
        guestName: qr.guestName,
        guestDocument: qr.guestDocument,
        status: "INSIDE",
        entryAt,
        fractionId: qr.fractionId,
        condominiumId: qr.condominiumId ?? req.condominiumId,
        qrCodeId: qr.id,
        authorizedById: req.user!.sub,
        notes: `Entrada via ${qrCodeData ? "QR Code" : "código manual"} — ${qr.type}`,
      },
      include: {
        fraction: { include: { tower: true } },
        authorizedBy: { select: { id: true, name: true } },
      },
    });

    await tx.qRAccessCode.update({
      where: { id: qr.id },
      data: { usedCount: { increment: 1 } },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.sub,
        action: "VISIT_ENTRY",
        entity: "Visit",
        entityId: visit.id,
        metadata: { method: qrCodeData ? "QR" : "SHORTCODE", qrCodeId: qr.id },
      },
    });

    return { log, visit };
  });

  await prisma.notification.create({
    data: {
      userId: qr.createdById,
      title: "Visitante autorizado entrou",
      message: `${qr.guestName} acaba de entrar no condomínio.`,
      type: "ACCESS",
      relatedId: visit.id,
    },
  });

  emitToRole(Role.ADMIN, "access:new", log);
  emitToRole(Role.DOORMAN, "access:new", log);
  emitToRole(Role.ADMIN, "visit:entry", visit);
  emitToRole(Role.DOORMAN, "visit:entry", visit);

  res.json({ valid: true, qr, log, visit });
});

export default router;

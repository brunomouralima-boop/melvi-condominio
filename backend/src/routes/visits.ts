import { Router } from "express";
import { z } from "zod";
import { Role, VisitStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { emitToRole, emitToUser } from "../sockets";

const router = Router();
router.use(authenticate);

/**
 * GET /api/visits
 * Filtros: ?status=INSIDE|EXITED|...   &fractionId=xxx   &date=YYYY-MM-DD
 *
 * Permissões:
 *  - ADMIN / DOORMAN: vê todas as visitas
 *  - RESIDENT: só vê visitas à sua fracção
 */
router.get("/", async (req, res) => {
  const { status, fractionId, date } = req.query as {
    status?: VisitStatus | "ALL";
    fractionId?: string;
    date?: string;
  };

  const where: any = {};

  // Residente — só a própria fracção
  if (req.user!.role === Role.RESIDENT) {
    if (!req.user!.fractionId) return res.json([]);
    where.fractionId = req.user!.fractionId;
  } else if (fractionId) {
    where.fractionId = fractionId;
  }

  if (status && status !== "ALL") where.status = status;

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.OR = [
      { entryAt: { gte: start, lt: end } },
      { exitAt: { gte: start, lt: end } },
      { createdAt: { gte: start, lt: end } },
    ];
  }

  const visits = await prisma.visit.findMany({
    where,
    include: {
      fraction: { include: { tower: true } },
      authorizedBy: { select: { id: true, name: true } },
      exitRegisteredBy: { select: { id: true, name: true } },
      qrCode: { select: { id: true, type: true, shortCode: true } },
    },
    orderBy: [{ status: "asc" }, { entryAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  res.json(visits);
});

/**
 * GET /api/visits/active/count
 * Devolve { count: N } — visitantes actualmente DENTRO do condomínio.
 * Usado por badges/contadores em tempo real.
 */
router.get("/active/count", async (_req, res) => {
  const count = await prisma.visit.count({ where: { status: "INSIDE" } });
  res.json({ count });
});

/**
 * GET /api/visits/:id — detalhe duma visita
 */
router.get("/:id", async (req, res) => {
  const visit = await prisma.visit.findUnique({
    where: { id: req.params.id },
    include: {
      fraction: { include: { tower: true, owner: { select: { id: true, name: true } } } },
      authorizedBy: { select: { id: true, name: true, role: true } },
      exitRegisteredBy: { select: { id: true, name: true, role: true } },
      qrCode: true,
    },
  });
  if (!visit) return res.status(404).json({ error: "Not found" });

  if (req.user!.role === Role.RESIDENT && visit.fractionId !== req.user!.fractionId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(visit);
});

/**
 * POST /api/visits/:id/exit — porteiro/admin regista saída
 *
 * Actualiza status=EXITED, exitAt=now, durationMinutes=calculado,
 * exitRegisteredById=quem clicou. Cria entrada no AuditLog.
 */
const exitSchema = z.object({
  notes: z.string().optional().nullable(),
});

router.post(
  "/:id/exit",
  authorize(Role.DOORMAN, Role.ADMIN),
  validateBody(exitSchema),
  async (req, res) => {
    const { notes } = req.body as z.infer<typeof exitSchema>;

    const visit = await prisma.visit.findUnique({ where: { id: req.params.id } });
    if (!visit) return res.status(404).json({ error: "Visita não encontrada" });
    if (visit.status !== "INSIDE") {
      return res.status(400).json({
        error: `Não é possível registar saída — visita está em estado ${visit.status}`,
      });
    }

    const exitAt = new Date();
    const durationMinutes = visit.entryAt
      ? Math.max(0, Math.round((exitAt.getTime() - visit.entryAt.getTime()) / 60000))
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.visit.update({
        where: { id: visit.id },
        data: {
          status: "EXITED",
          exitAt,
          durationMinutes,
          exitRegisteredById: req.user!.sub,
          notes: notes ? `${visit.notes ?? ""}\n[Saída] ${notes}`.trim() : visit.notes,
        },
        include: {
          fraction: { include: { tower: true } },
          authorizedBy: { select: { id: true, name: true } },
          exitRegisteredBy: { select: { id: true, name: true } },
          qrCode: { select: { id: true, type: true, shortCode: true } },
        },
      });

      // AccessLog para audit trail consistente
      await tx.accessLog.create({
        data: {
          type: "EXIT",
          personName: visit.guestName,
          personDocument: visit.guestDocument,
          fractionId: visit.fractionId,
          qrCodeId: visit.qrCodeId,
          method: "MANUAL",
          registeredById: req.user!.sub,
          notes: `Saída registada via /visits/:id/exit (visit ${visit.id})`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.sub,
          action: "VISIT_EXIT",
          entity: "Visit",
          entityId: visit.id,
          metadata: { durationMinutes, exitAt: exitAt.toISOString() },
        },
      });

      return v;
    });

    // Notificação ao residente da fracção (owner ou tenant)
    try {
      const fr = await prisma.fraction.findUnique({
        where: { id: visit.fractionId },
        select: { ownerId: true, tenantId: true },
      });
      const notifyUserId = fr?.tenantId ?? fr?.ownerId;
      if (notifyUserId) {
        await prisma.notification.create({
          data: {
            userId: notifyUserId,
            title: "Visitante saiu",
            message: `${visit.guestName} saiu do condomínio${
              durationMinutes !== null ? ` (visita de ${formatDuration(durationMinutes)})` : ""
            }.`,
            type: "ACCESS",
            relatedId: updated.id,
          },
        });
        emitToUser(notifyUserId, "visit:exit", updated);
      }
    } catch {
      /* ignora — notificação é nice-to-have */
    }

    emitToRole(Role.ADMIN, "visit:exit", updated);
    emitToRole(Role.DOORMAN, "visit:exit", updated);

    res.json(updated);
  }
);

/**
 * POST /api/visits/:id/cancel — cancelar uma visita (por administrador)
 * Só funciona se status ainda for SCHEDULED ou WAITING.
 */
router.post("/:id/cancel", authorize(Role.ADMIN, Role.DOORMAN), async (req, res) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.id } });
  if (!visit) return res.status(404).json({ error: "Não encontrada" });
  if (visit.status === "INSIDE" || visit.status === "EXITED") {
    return res.status(400).json({ error: "Não é possível cancelar uma visita já realizada" });
  }
  const updated = await prisma.visit.update({
    where: { id: visit.id },
    data: { status: "CANCELLED" },
  });
  emitToRole(Role.ADMIN, "visit:updated", updated);
  emitToRole(Role.DOORMAN, "visit:updated", updated);
  res.json(updated);
});

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export default router;

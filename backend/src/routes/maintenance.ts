import { Router } from "express";
import { z } from "zod";
import {
  Role,
  MaintenanceKind,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceFrequency,
} from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { resolveCondominium, tenantWhere } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);
router.use(authorize(Role.ADMIN));
router.use(resolveCondominium);
router.use(requirePermission("maintenance:write"));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addFrequency(base: Date, freq: MaintenanceFrequency): Date {
  const d = new Date(base);
  switch (freq) {
    case "WEEKLY": d.setDate(d.getDate() + 7); break;
    case "MONTHLY": d.setMonth(d.getMonth() + 1); break;
    case "QUARTERLY": d.setMonth(d.getMonth() + 3); break;
    case "SEMIANNUAL": d.setMonth(d.getMonth() + 6); break;
    case "ANNUAL": d.setFullYear(d.getFullYear() + 1); break;
    default: break;
  }
  return d;
}

const orderInclude = {
  supplier: { select: { id: true, name: true, phone: true } },
  tower: { select: { id: true, name: true } },
  fraction: { select: { id: true, identifier: true } },
} as const;

// ===========================================================================
// FORNECEDORES
// ===========================================================================
router.get("/suppliers", async (req, res) => {
  const where: any = { ...tenantWhere(req) };
  if (req.query.active === "true") where.isActive = true;
  const items = await prisma.supplier.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { orders: true } } },
  });
  res.json(items);
});

const supplierSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  taxId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.post("/suppliers", validateBody(supplierSchema), async (req, res) => {
  const body = req.body as z.infer<typeof supplierSchema>;
  const item = await prisma.supplier.create({
    data: {
      name: body.name,
      category: body.category || null,
      contactName: body.contactName || null,
      phone: body.phone || null,
      email: body.email || null,
      taxId: body.taxId || null,
      notes: body.notes || null,
      condominiumId: req.condominiumId,
    },
  });
  res.status(201).json(item);
});

router.put("/suppliers/:id", validateBody(supplierSchema.partial()), async (req, res) => {
  const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Fornecedor não encontrado" });
  if (existing.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Fornecedor não encontrado" });
  }
  const item = await prisma.supplier.update({ where: { id: req.params.id }, data: req.body });
  res.json(item);
});

router.delete("/suppliers/:id", async (req, res) => {
  const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Fornecedor não encontrado" });
  if (existing.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Fornecedor não encontrado" });
  }
  const count = await prisma.maintenanceOrder.count({ where: { supplierId: req.params.id } });
  if (count > 0) {
    // tem ordens associadas → apenas desactivar
    const item = await prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ ok: true, deactivated: true, supplier: item });
  }
  await prisma.supplier.delete({ where: { id: req.params.id } });
  res.json({ ok: true, deactivated: false });
});

// ===========================================================================
// ORDENS DE MANUTENÇÃO
// ===========================================================================
router.get("/orders", async (req, res) => {
  const where: any = { ...tenantWhere(req) };
  if (req.query.status) where.status = req.query.status;
  if (req.query.kind) where.kind = req.query.kind;
  if (req.query.priority) where.priority = req.query.priority;
  const items = await prisma.maintenanceOrder.findMany({
    where,
    include: orderInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500,
  });
  res.json(items);
});

router.get("/orders/stats", async (req, res) => {
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const scope = tenantWhere(req);

  const [open, inProgress, scheduled, doneMonth, preventiveDue] = await Promise.all([
    prisma.maintenanceOrder.count({ where: { ...scope, status: MaintenanceStatus.OPEN } }),
    prisma.maintenanceOrder.count({ where: { ...scope, status: MaintenanceStatus.IN_PROGRESS } }),
    prisma.maintenanceOrder.count({ where: { ...scope, status: MaintenanceStatus.SCHEDULED } }),
    prisma.maintenanceOrder.count({
      where: { ...scope, status: MaintenanceStatus.DONE, completedDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
    }),
    prisma.maintenanceOrder.count({
      where: { ...scope, kind: MaintenanceKind.PREVENTIVE, nextDueDate: { lte: soon } },
    }),
  ]);

  res.json({ open, inProgress, scheduled, doneMonth, preventiveDue });
});

const orderSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  kind: z.nativeEnum(MaintenanceKind).optional(),
  status: z.nativeEnum(MaintenanceStatus).optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
  category: z.string().optional().nullable(),
  cost: z.number().nonnegative().optional().nullable(),
  frequency: z.nativeEnum(MaintenanceFrequency).optional(),
  scheduledDate: z.string().datetime().optional().nullable(),
  nextDueDate: z.string().datetime().optional().nullable(),
  completedDate: z.string().datetime().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  towerId: z.string().uuid().optional().nullable(),
  fractionId: z.string().uuid().optional().nullable(),
});

function toData(body: z.infer<typeof orderSchema>) {
  const d: any = {};
  if (body.title !== undefined) d.title = body.title;
  if (body.description !== undefined) d.description = body.description || null;
  if (body.kind !== undefined) d.kind = body.kind;
  if (body.status !== undefined) d.status = body.status;
  if (body.priority !== undefined) d.priority = body.priority;
  if (body.category !== undefined) d.category = body.category || null;
  if (body.cost !== undefined) d.cost = body.cost ?? null;
  if (body.frequency !== undefined) d.frequency = body.frequency;
  if (body.scheduledDate !== undefined) d.scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null;
  if (body.nextDueDate !== undefined) d.nextDueDate = body.nextDueDate ? new Date(body.nextDueDate) : null;
  if (body.completedDate !== undefined) d.completedDate = body.completedDate ? new Date(body.completedDate) : null;
  if (body.supplierId !== undefined) d.supplierId = body.supplierId || null;
  if (body.towerId !== undefined) d.towerId = body.towerId || null;
  if (body.fractionId !== undefined) d.fractionId = body.fractionId || null;
  return d;
}

router.post("/orders", validateBody(orderSchema), async (req, res) => {
  const body = req.body as z.infer<typeof orderSchema>;
  const item = await prisma.maintenanceOrder.create({
    data: { ...toData(body), title: body.title, condominiumId: req.condominiumId, createdById: req.user!.sub },
    include: orderInclude,
  });
  res.status(201).json(item);
});

router.put("/orders/:id", validateBody(orderSchema.partial()), async (req, res) => {
  const existing = await prisma.maintenanceOrder.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Ordem não encontrada" });
  if (existing.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Ordem não encontrada" });
  }
  const item = await prisma.maintenanceOrder.update({
    where: { id: req.params.id },
    data: toData(req.body),
    include: orderInclude,
  });
  res.json(item);
});

// Marcar como realizada. Para preventivas, avança a próxima data prevista.
router.post("/orders/:id/complete", async (req, res) => {
  const o = await prisma.maintenanceOrder.findUnique({ where: { id: req.params.id } });
  if (!o) return res.status(404).json({ error: "Ordem não encontrada" });
  if (o.condominiumId && o.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Ordem não encontrada" });
  }

  const now = new Date();
  let data: any = { completedDate: now };

  if (o.kind === MaintenanceKind.PREVENTIVE && o.frequency !== MaintenanceFrequency.NONE) {
    const base = o.nextDueDate ?? o.scheduledDate ?? now;
    data.nextDueDate = addFrequency(base < now ? now : base, o.frequency);
    data.status = MaintenanceStatus.SCHEDULED; // plano recorrente continua activo
  } else {
    data.status = MaintenanceStatus.DONE;
  }

  const item = await prisma.maintenanceOrder.update({
    where: { id: req.params.id },
    data,
    include: orderInclude,
  });
  res.json(item);
});

router.delete("/orders/:id", async (req, res) => {
  const existing = await prisma.maintenanceOrder.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Ordem não encontrada" });
  if (existing.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Ordem não encontrada" });
  }
  await prisma.maintenanceOrder.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;

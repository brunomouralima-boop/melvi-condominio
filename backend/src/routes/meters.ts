import { Router } from "express";
import { z } from "zod";
import { Role, MeterType } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { resolveCondominium } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);
router.use(resolveCondominium);

// Isolamento multi-tenant: qualquer rota /:id (e aninhadas /:id/readings/...)
// opera apenas sobre medidores do condomínio activo.
router.param("id", async (req, res, next, id) => {
  try {
    const m = await prisma.meter.findUnique({ where: { id }, select: { condominiumId: true } });
    if (!m) return res.status(404).json({ error: "Not found" });
    if (req.condominiumId && m.condominiumId !== req.condominiumId) {
      return res.status(404).json({ error: "Not found" });
    }
    next();
  } catch (e) {
    next(e);
  }
});

const DEFAULT_UNIT: Record<MeterType, string> = {
  WATER: "m³",
  ELECTRICITY: "kWh",
  GENERATOR: "horas",
  FUEL: "litros",
};

type MaintenanceStatus = "OK" | "WARNING" | "OVERDUE";

function deriveGeneratorMetrics(lastReadingValue: number, lastMaintHours: number, intervalHours: number) {
  const nextMaintenanceHours = lastMaintHours + intervalHours;
  const hoursUntilMaintenance = nextMaintenanceHours - lastReadingValue;
  let status: MaintenanceStatus = "OK";
  if (hoursUntilMaintenance <= 0) status = "OVERDUE";
  else if (hoursUntilMaintenance <= 50) status = "WARNING";
  return { nextMaintenanceHours, hoursUntilMaintenance, maintenanceStatus: status };
}

// LIST
router.get("/", async (req, res) => {
  const { type } = req.query as { condominiumId?: string; type?: MeterType };
  // O condomínio activo (header x-condominium-id) governa; a query é fallback.
  const cid = req.condominiumId ?? (req.query.condominiumId as string | undefined);
  const where: any = {};
  if (cid) where.condominiumId = cid;
  if (type) where.type = type;

  const meters = await prisma.meter.findMany({
    where,
    include: {
      tower: { select: { id: true, name: true } },
      generatorConfig: true,
      readings: { orderBy: { readingDate: "desc" }, take: 1 },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const enriched = meters.map((m) => {
    const last = m.readings[0];
    const lastReading = last
      ? {
          value: Number(last.readingValue),
          date: last.readingDate,
          month: last.readingMonth,
          year: last.readingYear,
          consumption: last.consumption !== null ? Number(last.consumption) : null,
        }
      : null;

    let generator = null;
    if (m.type === "GENERATOR" && m.generatorConfig && lastReading) {
      generator = deriveGeneratorMetrics(
        lastReading.value,
        Number(m.generatorConfig.lastMaintenanceHours),
        Number(m.generatorConfig.maintenanceIntervalHours),
      );
    }
    return { ...m, lastReading, generator };
  });
  res.json(enriched);
});

const generatorConfigSchema = z.object({
  maintenanceIntervalHours: z.number().positive(),
  lastMaintenanceHours: z.number().nonnegative(),
  lastMaintenanceDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createSchema = z.object({
  condominiumId: z.string().uuid(),
  towerId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  type: z.nativeEnum(MeterType),
  serialNumber: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  unit: z.string().optional(),
  capacity: z.number().positive().optional().nullable(),
  generatorConfig: generatorConfigSchema.optional(),
});

router.post("/", authorize(Role.ADMIN), requirePermission("meters:write"), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  if (body.type === "GENERATOR" && !body.generatorConfig) {
    return res.status(400).json({ error: "generatorConfig é obrigatório para medidores do tipo GENERATOR." });
  }
  if (body.type === "FUEL" && !body.capacity) {
    return res.status(400).json({ error: "capacity é obrigatório para depósitos de combustível." });
  }

  const created = await prisma.meter.create({
    data: {
      condominiumId: req.condominiumId ?? body.condominiumId,
      towerId: body.towerId ?? null,
      name: body.name,
      type: body.type,
      serialNumber: body.serialNumber ?? null,
      location: body.location ?? null,
      unit: body.unit ?? DEFAULT_UNIT[body.type],
      capacity: (body.capacity as any) ?? null,
      generatorConfig: body.generatorConfig
        ? {
            create: {
              maintenanceIntervalHours: body.generatorConfig.maintenanceIntervalHours as any,
              lastMaintenanceHours: body.generatorConfig.lastMaintenanceHours as any,
              lastMaintenanceDate: body.generatorConfig.lastMaintenanceDate ? new Date(body.generatorConfig.lastMaintenanceDate) : null,
              notes: body.generatorConfig.notes ?? null,
            },
          }
        : undefined,
    },
    include: { generatorConfig: true },
  });
  res.status(201).json(created);
});

router.get("/:id", async (req, res) => {
  const meter = await prisma.meter.findUnique({
    where: { id: req.params.id },
    include: {
      tower: { select: { id: true, name: true } },
      condominium: { select: { id: true, name: true } },
      generatorConfig: true,
      readings: {
        include: { registeredBy: { select: { id: true, name: true } } },
        orderBy: { readingDate: "desc" },
        take: 12,
      },
    },
  });
  if (!meter) return res.status(404).json({ error: "Not found" });

  let generator = null;
  const last = meter.readings[0];
  if (meter.type === "GENERATOR" && meter.generatorConfig && last) {
    generator = deriveGeneratorMetrics(
      Number(last.readingValue),
      Number(meter.generatorConfig.lastMaintenanceHours),
      Number(meter.generatorConfig.maintenanceIntervalHours),
    );
  }
  res.json({ ...meter, generator });
});

const updateSchema = z.object({
  name: z.string().optional(),
  serialNumber: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  capacity: z.number().positive().optional().nullable(),
  towerId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  generatorConfig: generatorConfigSchema.partial().optional(),
});

router.put("/:id", authorize(Role.ADMIN), requirePermission("meters:write"), validateBody(updateSchema), async (req, res) => {
  const body = req.body as z.infer<typeof updateSchema>;
  const { generatorConfig, ...rest } = body;

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.meter.update({
      where: { id: req.params.id },
      data: { ...rest, capacity: rest.capacity as any },
    });
    if (generatorConfig && m.type === "GENERATOR") {
      await tx.generatorConfig.upsert({
        where: { meterId: m.id },
        update: {
          maintenanceIntervalHours: generatorConfig.maintenanceIntervalHours as any,
          lastMaintenanceHours: generatorConfig.lastMaintenanceHours as any,
          lastMaintenanceDate: generatorConfig.lastMaintenanceDate ? new Date(generatorConfig.lastMaintenanceDate) : undefined,
          notes: generatorConfig.notes ?? undefined,
        },
        create: {
          meterId: m.id,
          maintenanceIntervalHours: (generatorConfig.maintenanceIntervalHours ?? 0) as any,
          lastMaintenanceHours: (generatorConfig.lastMaintenanceHours ?? 0) as any,
          lastMaintenanceDate: generatorConfig.lastMaintenanceDate ? new Date(generatorConfig.lastMaintenanceDate) : null,
          notes: generatorConfig.notes ?? null,
        },
      });
    }
    return m;
  });
  res.json(updated);
});

router.delete("/:id", authorize(Role.ADMIN), requirePermission("meters:write"), async (req, res) => {
  await prisma.meter.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

// ─────────── READINGS (nested under /meters/:id/readings) ───────────

router.get("/:id/readings", async (req, res) => {
  const { year, limit } = req.query as { year?: string; limit?: string };
  const where: any = { meterId: req.params.id };
  if (year) where.readingYear = Number(year);
  const items = await prisma.meterReading.findMany({
    where,
    include: { registeredBy: { select: { id: true, name: true } } },
    orderBy: { readingDate: "desc" },
    take: Math.min(Number(limit) || 24, 200),
  });
  res.json(items);
});

const readingSchema = z.object({
  readingValue: z.number(),
  readingDate: z.string().datetime().optional(),
  readingMonth: z.number().int().min(1).max(12),
  readingYear: z.number().int().min(2000),
  photo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isReset: z.boolean().optional(),
});

router.post("/:id/readings", authorize(Role.ADMIN), requirePermission("meters:write"), validateBody(readingSchema), async (req, res) => {
  const body = req.body as z.infer<typeof readingSchema>;
  const meter = await prisma.meter.findUnique({ where: { id: req.params.id }, include: { generatorConfig: true } });
  if (!meter) return res.status(404).json({ error: "Meter not found" });

  // previous reading
  const prev = await prisma.meterReading.findFirst({
    where: { meterId: req.params.id },
    orderBy: { readingDate: "desc" },
  });
  const previousValue = prev ? Number(prev.readingValue) : null;
  let consumption: number | null = null;
  if (previousValue !== null) {
    consumption = body.readingValue - previousValue;
    if (consumption < 0 && !body.isReset) {
      return res.status(400).json({
        error: `Leitura ${body.readingValue} é inferior à anterior (${previousValue}). Marque isReset=true se substituiu o contador.`,
      });
    }
  }

  const finalNotes = body.isReset
    ? `[Substituição de contador] ${body.notes ?? ""}`.trim()
    : body.notes ?? null;

  try {
    const reading = await prisma.meterReading.create({
      data: {
        meterId: req.params.id,
        readingValue: body.readingValue as any,
        previousValue: previousValue as any,
        consumption: consumption as any,
        readingDate: body.readingDate ? new Date(body.readingDate) : new Date(),
        readingMonth: body.readingMonth,
        readingYear: body.readingYear,
        photo: body.photo ?? null,
        notes: finalNotes,
        isReset: body.isReset ?? false,
        registeredById: req.user!.sub,
      },
    });

    let generator = null;
    if (meter.type === "GENERATOR" && meter.generatorConfig) {
      generator = deriveGeneratorMetrics(
        body.readingValue,
        Number(meter.generatorConfig.lastMaintenanceHours),
        Number(meter.generatorConfig.maintenanceIntervalHours),
      );
    }
    res.status(201).json({ ...reading, generator });
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "Já existe leitura para este mês/ano neste medidor." });
    throw e;
  }
});

router.put("/:id/readings/:readingId", authorize(Role.ADMIN), requirePermission("meters:write"), async (req, res) => {
  const schema = z.object({ readingValue: z.number(), notes: z.string().optional().nullable() });
  const body = schema.parse(req.body);
  const target = await prisma.meterReading.findUnique({ where: { id: req.params.readingId } });
  if (!target) return res.status(404).json({ error: "Not found" });
  const prev = target.previousValue !== null ? Number(target.previousValue) : null;
  const consumption = prev !== null ? body.readingValue - prev : null;
  const updated = await prisma.meterReading.update({
    where: { id: req.params.readingId },
    data: { readingValue: body.readingValue as any, consumption: consumption as any, notes: body.notes ?? target.notes },
  });
  res.json(updated);
});

router.delete("/:id/readings/:readingId", authorize(Role.ADMIN), requirePermission("meters:write"), async (req, res) => {
  // só a leitura mais recente
  const latest = await prisma.meterReading.findFirst({ where: { meterId: req.params.id }, orderBy: { readingDate: "desc" } });
  if (!latest || latest.id !== req.params.readingId) {
    return res.status(400).json({ error: "Apenas a leitura mais recente pode ser eliminada." });
  }
  await prisma.meterReading.delete({ where: { id: req.params.readingId } });
  res.json({ ok: true });
});

// Maintenance recording (GENERATOR only)
const maintenanceSchema = z.object({
  currentHours: z.number().nonnegative(),
  notes: z.string().optional().nullable(),
  maintenanceDate: z.string().datetime().optional(),
});

router.patch("/:id/generator/maintenance", authorize(Role.ADMIN), requirePermission("meters:write"), validateBody(maintenanceSchema), async (req, res) => {
  const { currentHours, notes, maintenanceDate } = req.body as z.infer<typeof maintenanceSchema>;
  const meter = await prisma.meter.findUnique({ where: { id: req.params.id }, include: { generatorConfig: true } });
  if (!meter || meter.type !== "GENERATOR" || !meter.generatorConfig) {
    return res.status(404).json({ error: "Generator config not found" });
  }
  const updated = await prisma.generatorConfig.update({
    where: { id: meter.generatorConfig.id },
    data: {
      lastMaintenanceHours: currentHours as any,
      lastMaintenanceDate: maintenanceDate ? new Date(maintenanceDate) : new Date(),
      notes: notes ?? meter.generatorConfig.notes,
    },
  });

  const lastReading = await prisma.meterReading.findFirst({
    where: { meterId: meter.id },
    orderBy: { readingDate: "desc" },
  });
  let generator = null;
  if (lastReading) {
    generator = deriveGeneratorMetrics(
      Number(lastReading.readingValue),
      Number(updated.lastMaintenanceHours),
      Number(updated.maintenanceIntervalHours),
    );
  }
  res.json({ generatorConfig: updated, generator });
});

export default router;

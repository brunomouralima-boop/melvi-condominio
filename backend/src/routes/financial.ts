import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Role, FinancialType } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-06" -> "Junho/2026" */
function competenceLabel(competence: string): string {
  const [y, m] = competence.split("-");
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return competence;
  return `${MONTHS_PT[idx]}/${y}`;
}

// ---------------------------------------------------------------------------
// Listagem de lançamentos
// ---------------------------------------------------------------------------
router.get("/records", async (req, res) => {
  const where: any = {};
  if (req.user!.role === Role.RESIDENT) where.fractionId = req.user!.fractionId;
  const items = await prisma.financialRecord.findMany({
    where,
    include: { fraction: { include: { tower: true } } },
    orderBy: { dueDate: "desc" },
    take: 500,
  });
  res.json(items);
});

const createSchema = z.object({
  type: z.nativeEnum(FinancialType),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().datetime(),
  paidDate: z.string().datetime().optional().nullable(),
  fractionId: z.string().uuid().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
});

router.post("/records", authorize(Role.ADMIN), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const item = await prisma.financialRecord.create({
    data: {
      type: body.type,
      category: body.category,
      description: body.description,
      amount: body.amount as unknown as number,
      dueDate: new Date(body.dueDate),
      paidDate: body.paidDate ? new Date(body.paidDate) : null,
      fractionId: body.fractionId ?? null,
      receiptUrl: body.receiptUrl ?? null,
      createdById: req.user!.sub,
    },
  });
  res.status(201).json(item);
});

// ---------------------------------------------------------------------------
// Marcar como pago / reverter pagamento
// ---------------------------------------------------------------------------
const paySchema = z.object({
  paidDate: z.string().datetime().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
});

router.post("/records/:id/pay", authorize(Role.ADMIN), validateBody(paySchema), async (req, res) => {
  const body = req.body as z.infer<typeof paySchema>;
  const existing = await prisma.financialRecord.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Lançamento não encontrado" });
  const item = await prisma.financialRecord.update({
    where: { id: req.params.id },
    data: {
      paidDate: body.paidDate ? new Date(body.paidDate) : new Date(),
      receiptUrl: body.receiptUrl ?? existing.receiptUrl,
    },
    include: { fraction: { include: { tower: true } } },
  });
  res.json(item);
});

router.post("/records/:id/unpay", authorize(Role.ADMIN), async (req, res) => {
  const existing = await prisma.financialRecord.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Lançamento não encontrado" });
  const item = await prisma.financialRecord.update({
    where: { id: req.params.id },
    data: { paidDate: null },
    include: { fraction: { include: { tower: true } } },
  });
  res.json(item);
});

// ---------------------------------------------------------------------------
// Cobranças em lote (geração de cotas)
// ---------------------------------------------------------------------------
const batchSchema = z.object({
  mode: z.enum(["FIXED", "PERMILLAGE", "AREA"]),
  amount: z.number().positive(), // valor por fração (FIXED) ou total a ratear (PERMILLAGE/AREA)
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  competence: z.string().regex(/^\d{4}-\d{2}$/, "Competência inválida (YYYY-MM)"),
  dueDate: z.string().datetime(),
  towerId: z.string().uuid().optional().nullable(),
  markPaid: z.boolean().optional().default(false),
  skipExisting: z.boolean().optional().default(true),
});

router.post("/charges/batch", authorize(Role.ADMIN), validateBody(batchSchema), async (req, res) => {
  const body = req.body as z.infer<typeof batchSchema>;

  // 1. Frações activas alvo
  const fractions = await prisma.fraction.findMany({
    where: { isActive: true, ...(body.towerId ? { towerId: body.towerId } : {}) },
    orderBy: [{ towerId: "asc" }, { identifier: "asc" }],
    select: { id: true, identifier: true, permillage: true, areaM2: true, towerId: true },
  });

  if (fractions.length === 0) {
    return res.status(400).json({ error: "Não há frações activas para cobrar." });
  }

  // 2. Calcular valor de cada fração
  const weightOf = (f: (typeof fractions)[number]) =>
    body.mode === "AREA" ? Number(f.areaM2) : Number(f.permillage);

  let amounts: number[] = [];
  if (body.mode === "FIXED") {
    amounts = fractions.map(() => round2(body.amount));
  } else {
    const totalWeight = fractions.reduce((s, f) => s + weightOf(f), 0);
    if (totalWeight <= 0) {
      return res.status(400).json({ error: "A soma dos pesos (permilagem/área) é zero." });
    }
    let allocated = 0;
    amounts = fractions.map((f, i) => {
      let v: number;
      if (i === fractions.length - 1) {
        v = round2(body.amount - allocated); // última recebe o resto do arredondamento
      } else {
        v = round2((body.amount * weightOf(f)) / totalWeight);
        allocated = round2(allocated + v);
      }
      return v;
    });
  }

  // 3. Evitar duplicados: cobranças já existentes na mesma competência + categoria
  let skipIds = new Set<string>();
  if (body.skipExisting) {
    const existing = await prisma.financialRecord.findMany({
      where: {
        type: FinancialType.INCOME,
        competence: body.competence,
        category: body.category,
        fractionId: { in: fractions.map((f) => f.id) },
      },
      select: { fractionId: true },
    });
    skipIds = new Set(existing.map((e) => e.fractionId!).filter(Boolean));
  }

  // 4. Criar registos
  const batchId = randomUUID();
  const label = competenceLabel(body.competence);
  const baseDesc = body.description?.trim() || body.category;
  const dueDate = new Date(body.dueDate);
  const paidDate = body.markPaid ? new Date() : null;

  const toCreate = fractions
    .map((f, i) => ({ f, amount: amounts[i] }))
    .filter(({ f }) => !skipIds.has(f.id))
    .map(({ f, amount }) => ({
      type: FinancialType.INCOME,
      category: body.category,
      description: `${baseDesc} • ${label}`,
      amount: amount as unknown as number,
      dueDate,
      paidDate,
      competence: body.competence,
      batchId,
      fractionId: f.id,
      createdById: req.user!.sub,
    }));

  if (toCreate.length === 0) {
    return res.status(200).json({
      batchId,
      created: 0,
      skipped: skipIds.size,
      totalAmount: 0,
      message: "Todas as frações já tinham cobrança nesta competência.",
    });
  }

  await prisma.financialRecord.createMany({ data: toCreate });
  const totalAmount = round2(toCreate.reduce((s, r) => s + Number(r.amount), 0));

  res.status(201).json({
    batchId,
    created: toCreate.length,
    skipped: skipIds.size,
    totalAmount,
    competence: body.competence,
  });
});

// ---------------------------------------------------------------------------
// Resumo financeiro (KPIs do dashboard / página financeiro)
// ---------------------------------------------------------------------------
router.get("/summary", authorize(Role.ADMIN), async (_req, res) => {
  const now = new Date();
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);

  const [income, expenses, overdueCount, openAgg, overdueAgg, overdueFractions, unitsCount] =
    await Promise.all([
      prisma.financialRecord.aggregate({
        _sum: { amount: true },
        where: { type: FinancialType.INCOME, paidDate: { gte: month } },
      }),
      prisma.financialRecord.aggregate({
        _sum: { amount: true },
        where: { type: FinancialType.EXPENSE, paidDate: { gte: month } },
      }),
      prisma.financialRecord.count({
        where: { type: FinancialType.INCOME, paidDate: null, dueDate: { lt: now } },
      }),
      prisma.financialRecord.aggregate({
        _sum: { amount: true },
        where: { type: FinancialType.INCOME, paidDate: null },
      }),
      prisma.financialRecord.aggregate({
        _sum: { amount: true },
        where: { type: FinancialType.INCOME, paidDate: null, dueDate: { lt: now } },
      }),
      prisma.financialRecord.findMany({
        where: { type: FinancialType.INCOME, paidDate: null, dueDate: { lt: now }, fractionId: { not: null } },
        distinct: ["fractionId"],
        select: { fractionId: true },
      }),
      prisma.fraction.count({ where: { isActive: true } }),
    ]);

  const unitsInArrears = overdueFractions.length;
  const delinquencyRate = unitsCount > 0 ? round2((unitsInArrears / unitsCount) * 100) : 0;

  res.json({
    monthIncome: Number(income._sum.amount ?? 0),
    monthExpenses: Number(expenses._sum.amount ?? 0),
    overdueCount,
    totalOpen: Number(openAgg._sum.amount ?? 0),
    overdueAmount: Number(overdueAgg._sum.amount ?? 0),
    unitsInArrears,
    unitsCount,
    delinquencyRate,
  });
});

// ---------------------------------------------------------------------------
// Inadimplência (agregado por fração)
// ---------------------------------------------------------------------------
router.get("/delinquency", authorize(Role.ADMIN), async (_req, res) => {
  const now = new Date();
  const overdue = await prisma.financialRecord.findMany({
    where: { type: FinancialType.INCOME, paidDate: null, dueDate: { lt: now }, fractionId: { not: null } },
    include: {
      fraction: {
        include: {
          tower: true,
          owner: { select: { id: true, name: true, phone: true, email: true } },
          tenant: { select: { id: true, name: true, phone: true, email: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const map = new Map<string, any>();
  for (const r of overdue) {
    const fid = r.fractionId!;
    if (!map.has(fid)) {
      const f = r.fraction!;
      const responsible = f.tenant || f.owner;
      map.set(fid, {
        fractionId: fid,
        identifier: f.identifier,
        tower: f.tower ? { id: f.tower.id, name: f.tower.name } : null,
        responsibleName: responsible?.name ?? null,
        responsiblePhone: responsible?.phone ?? null,
        count: 0,
        totalOwed: 0,
        oldestDue: r.dueDate,
      });
    }
    const agg = map.get(fid);
    agg.count += 1;
    agg.totalOwed = round2(agg.totalOwed + Number(r.amount));
    if (new Date(r.dueDate) < new Date(agg.oldestDue)) agg.oldestDue = r.dueDate;
  }

  const rows = Array.from(map.values()).sort((a, b) => b.totalOwed - a.totalOwed);
  const grandTotal = round2(rows.reduce((s, r) => s + r.totalOwed, 0));

  res.json({ rows, grandTotal, unitsInArrears: rows.length });
});

// ---------------------------------------------------------------------------
// Extrato por fração (com saldo)
// ---------------------------------------------------------------------------
router.get("/fraction/:id/statement", async (req, res) => {
  if (req.user!.role === Role.RESIDENT && req.user!.fractionId !== req.params.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const items = await prisma.financialRecord.findMany({
    where: { fractionId: req.params.id },
    orderBy: { dueDate: "desc" },
  });
  res.json(items);
});

// Legacy alias para retrocompatibilidade
router.get("/unit/:id/statement", async (req, res) => {
  if (req.user!.role === Role.RESIDENT && req.user!.fractionId !== req.params.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const items = await prisma.financialRecord.findMany({
    where: { fractionId: req.params.id },
    orderBy: { dueDate: "desc" },
  });
  res.json(items);
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { Role, FinancialType } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);

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

router.get("/summary", authorize(Role.ADMIN), async (_req, res) => {
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);

  const [income, expenses, overdue] = await Promise.all([
    prisma.financialRecord.aggregate({
      _sum: { amount: true },
      where: { type: FinancialType.INCOME, paidDate: { gte: month } },
    }),
    prisma.financialRecord.aggregate({
      _sum: { amount: true },
      where: { type: FinancialType.EXPENSE, paidDate: { gte: month } },
    }),
    prisma.financialRecord.count({
      where: { type: FinancialType.INCOME, paidDate: null, dueDate: { lt: new Date() } },
    }),
  ]);

  res.json({
    monthIncome: Number(income._sum.amount ?? 0),
    monthExpenses: Number(expenses._sum.amount ?? 0),
    overdueCount: overdue,
  });
});

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

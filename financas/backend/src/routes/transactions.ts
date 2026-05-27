import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { validateBody } from "../middleware/validate";

const router = Router();

const txSchema = z
  .object({
    date: z.coerce.date(),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    amount: z.number().positive(),
    currencyCode: z.string().min(2),
    accountId: z.string().min(1),
    toAccountId: z.string().nullable().optional(),
    toAmount: z.number().positive().nullable().optional(),
    toCurrencyCode: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    memberId: z.string().min(1),
    description: z.string().default(""),
  })
  .refine((d) => d.type !== "TRANSFER" || !!d.toAccountId, {
    message: "Transferência requer conta de destino",
    path: ["toAccountId"],
  })
  .refine((d) => d.type === "TRANSFER" || !!d.categoryId, {
    message: "Receita/Despesa requer categoria",
    path: ["categoryId"],
  });

router.get("/", async (req, res) => {
  const { from, to, type, accountId, memberId, categoryId, search } = req.query as Record<string, string>;
  const take = Math.min(Number(req.query.take ?? 100), 500);
  const skip = Number(req.query.skip ?? 0);

  const where: Prisma.TransactionWhereInput = {};
  if (from || to) where.date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  if (type) where.type = type;
  if (accountId) where.OR = [{ accountId }, { toAccountId: accountId }];
  if (memberId) where.memberId = memberId;
  if (categoryId) where.categoryId = categoryId;
  if (search) where.description = { contains: search };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { account: true, toAccount: true, category: true, member: true, currency: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take,
      skip,
    }),
    prisma.transaction.count({ where }),
  ]);
  res.json({ items, total });
});

router.post("/", validateBody(txSchema), async (req, res) => {
  const data = req.body as z.infer<typeof txSchema>;
  const tx = await prisma.transaction.create({
    data: {
      ...data,
      categoryId: data.type === "TRANSFER" ? null : data.categoryId,
      toAccountId: data.type === "TRANSFER" ? data.toAccountId : null,
      toAmount: data.type === "TRANSFER" ? data.toAmount ?? data.amount : null,
      toCurrencyCode: data.type === "TRANSFER" ? data.toCurrencyCode : null,
    },
  });
  res.status(201).json(tx);
});

router.put("/:id", validateBody(txSchema), async (req, res) => {
  const data = req.body as z.infer<typeof txSchema>;
  const tx = await prisma.transaction.update({
    where: { id: req.params.id },
    data: {
      ...data,
      categoryId: data.type === "TRANSFER" ? null : data.categoryId,
      toAccountId: data.type === "TRANSFER" ? data.toAccountId : null,
      toAmount: data.type === "TRANSFER" ? data.toAmount ?? data.amount : null,
      toCurrencyCode: data.type === "TRANSFER" ? data.toCurrencyCode : null,
    },
  });
  res.json(tx);
});

router.delete("/:id", async (req, res) => {
  await prisma.transaction.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;

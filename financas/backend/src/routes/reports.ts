import { Router } from "express";
import { prisma } from "../prisma";
import { computeBalances } from "../utils/balances";
import { getRateMap, toBase } from "../utils/currency";

const router = Router();

// Balanço patrimonial: ativos − passivos = património líquido, em AOA, por titular e consolidado.
router.get("/networth", async (_req, res) => {
  const [accounts, assets, liabilities, members, balances, rates] = await Promise.all([
    prisma.account.findMany({ where: { archived: false } }),
    prisma.asset.findMany(),
    prisma.liability.findMany(),
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
    computeBalances(),
    getRateMap(),
  ]);

  const byMember: Record<string, { liquid: number; assets: number; liabilities: number }> = {};
  for (const m of members) byMember[m.id] = { liquid: 0, assets: 0, liabilities: 0 };

  for (const a of accounts) {
    if (!byMember[a.memberId]) byMember[a.memberId] = { liquid: 0, assets: 0, liabilities: 0 };
    byMember[a.memberId].liquid += toBase(balances[a.id] ?? 0, a.currencyCode, rates);
  }
  for (const a of assets) {
    if (!byMember[a.memberId]) byMember[a.memberId] = { liquid: 0, assets: 0, liabilities: 0 };
    byMember[a.memberId].assets += toBase(a.value, a.currencyCode, rates);
  }
  for (const l of liabilities) {
    if (!byMember[l.memberId]) byMember[l.memberId] = { liquid: 0, assets: 0, liabilities: 0 };
    byMember[l.memberId].liabilities += toBase(l.outstandingBalance, l.currencyCode, rates);
  }

  const perMember = members.map((m) => {
    const b = byMember[m.id];
    const totalAssets = b.liquid + b.assets;
    return {
      member: m,
      liquidAssets: b.liquid,
      otherAssets: b.assets,
      totalAssets,
      liabilities: b.liabilities,
      netWorth: totalAssets - b.liabilities,
    };
  });

  const totals = perMember.reduce(
    (acc, p) => ({
      liquidAssets: acc.liquidAssets + p.liquidAssets,
      otherAssets: acc.otherAssets + p.otherAssets,
      totalAssets: acc.totalAssets + p.totalAssets,
      liabilities: acc.liabilities + p.liabilities,
      netWorth: acc.netWorth + p.netWorth,
    }),
    { liquidAssets: 0, otherAssets: 0, totalAssets: 0, liabilities: 0, netWorth: 0 }
  );

  res.json({ baseCurrency: "AOA", perMember, totals });
});

// Fluxo de caixa de um período: receitas/despesas em AOA, por categoria e por titular.
router.get("/cashflow", async (req, res) => {
  const now = new Date();
  const from = req.query.from
    ? new Date(String(req.query.from))
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = req.query.to ? new Date(String(req.query.to)) : now;

  const [txs, rates, categories, members] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: from, lte: to }, type: { in: ["INCOME", "EXPENSE"] } },
    }),
    getRateMap(),
    prisma.category.findMany(),
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  let totalIncome = 0;
  let totalExpense = 0;
  const byCategory: Record<string, number> = {};
  const byMemberIncome: Record<string, number> = {};
  const byMemberExpense: Record<string, number> = {};

  for (const t of txs) {
    const value = toBase(t.amount, t.currencyCode, rates);
    if (t.type === "INCOME") {
      totalIncome += value;
      byMemberIncome[t.memberId] = (byMemberIncome[t.memberId] ?? 0) + value;
    } else {
      totalExpense += value;
      byMemberExpense[t.memberId] = (byMemberExpense[t.memberId] ?? 0) + value;
      if (t.categoryId) byCategory[t.categoryId] = (byCategory[t.categoryId] ?? 0) + value;
    }
  }

  const catName = (id: string) => categories.find((c) => c.id === id);
  const expenseByCategory = Object.entries(byCategory)
    .map(([categoryId, total]) => ({
      categoryId,
      name: catName(categoryId)?.name ?? "Sem categoria",
      color: catName(categoryId)?.color ?? "#64748b",
      total,
    }))
    .sort((a, b) => b.total - a.total);

  const perMember = members.map((m) => ({
    member: m,
    income: byMemberIncome[m.id] ?? 0,
    expense: byMemberExpense[m.id] ?? 0,
    net: (byMemberIncome[m.id] ?? 0) - (byMemberExpense[m.id] ?? 0),
  }));

  res.json({
    baseCurrency: "AOA",
    from,
    to,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    expenseByCategory,
    perMember,
  });
});

// Série mensal de receitas/despesas (em AOA) para os últimos N meses.
router.get("/monthly", async (req, res) => {
  const months = Math.min(Number(req.query.months ?? 12), 36);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [txs, rates] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: start }, type: { in: ["INCOME", "EXPENSE"] } },
    }),
    getRateMap(),
  ]);

  const series: { month: string; income: number; expense: number; net: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    series.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      income: 0,
      expense: 0,
      net: 0,
    });
  }
  const idx = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  for (const t of txs) {
    const key = idx(new Date(t.date));
    const bucket = series.find((s) => s.month === key);
    if (!bucket) continue;
    const value = toBase(t.amount, t.currencyCode, rates);
    if (t.type === "INCOME") bucket.income += value;
    else bucket.expense += value;
  }
  for (const s of series) s.net = s.income - s.expense;

  res.json({ baseCurrency: "AOA", series });
});

export default router;

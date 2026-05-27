import { prisma } from "../prisma";

// Saldo de cada conta (na moeda da própria conta):
// openingBalance + receitas - despesas - transferências enviadas + transferências recebidas.
// Pressuposto: receitas/despesas são registadas na moeda da conta.
export async function computeBalances(): Promise<Record<string, number>> {
  const accounts = await prisma.account.findMany();
  const balances: Record<string, number> = {};
  for (const a of accounts) balances[a.id] = a.openingBalance;

  const txs = await prisma.transaction.findMany();
  for (const t of txs) {
    if (t.type === "INCOME") balances[t.accountId] += t.amount;
    else if (t.type === "EXPENSE") balances[t.accountId] -= t.amount;
    else if (t.type === "TRANSFER") {
      balances[t.accountId] -= t.amount;
      if (t.toAccountId) balances[t.toAccountId] += t.toAmount ?? t.amount;
    }
  }
  return balances;
}

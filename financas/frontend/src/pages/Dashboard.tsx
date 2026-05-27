import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { TrendingUp, TrendingDown, Landmark, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { formatCompact, formatMoney } from "../lib/format";
import { useAccounts } from "../lib/queries";
import { Card } from "../components/ui";
import type { Cashflow, MonthlySeries, NetWorth } from "../lib/types";

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="truncate text-xl font-bold">{value}</div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const nw = useQuery({ queryKey: ["networth"], queryFn: async () => (await api.get<NetWorth>("/reports/networth")).data });
  const cf = useQuery({ queryKey: ["cashflow"], queryFn: async () => (await api.get<Cashflow>("/reports/cashflow")).data });
  const monthly = useQuery({ queryKey: ["monthly"], queryFn: async () => (await api.get<MonthlySeries>("/reports/monthly?months=6")).data });
  const accounts = useAccounts();

  if (nw.isLoading || cf.isLoading) {
    return <div className="text-slate-500">A carregar painel…</div>;
  }

  const totals = nw.data!.totals;
  const cash = cf.data!;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Painel do Agregado</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Património líquido" value={formatMoney(totals.netWorth)} tone="bg-blue-100 text-blue-700" icon={<Landmark className="h-6 w-6" />} />
        <Kpi label="Total de ativos" value={formatMoney(totals.totalAssets)} tone="bg-emerald-100 text-emerald-700" icon={<Wallet className="h-6 w-6" />} />
        <Kpi label="Receitas (mês)" value={formatMoney(cash.totalIncome)} tone="bg-green-100 text-green-700" icon={<TrendingUp className="h-6 w-6" />} />
        <Kpi label="Despesas (mês)" value={formatMoney(cash.totalExpense)} tone="bg-red-100 text-red-700" icon={<TrendingDown className="h-6 w-6" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Receitas vs Despesas (6 meses) — AOA</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly.data?.series ?? []}>
              <XAxis dataKey="month" fontSize={12} />
              <YAxis tickFormatter={(v) => formatCompact(v)} fontSize={11} width={70} />
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Legend />
              <Bar dataKey="income" name="Receitas" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Despesas por categoria (mês)</h2>
          {cash.expenseByCategory.length === 0 ? (
            <p className="text-sm text-slate-400">Sem despesas no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={cash.expenseByCategory} dataKey="total" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {cash.expenseByCategory.map((e) => (
                    <Cell key={e.categoryId} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Balanço por titular (AOA)</h2>
          <div className="space-y-3">
            {nw.data!.perMember.map((p) => (
              <div key={p.member.id} className="rounded-lg border border-slate-100 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="h-3 w-3 rounded-full" style={{ background: p.member.color }} />
                    {p.member.name}
                  </span>
                  <span className="font-bold">{formatMoney(p.netWorth)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <span>Ativos: {formatCompact(p.totalAssets)}</span>
                  <span>Passivos: {formatCompact(p.liabilities)}</span>
                  <span>Líquido: {formatCompact(p.liquidAssets)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Saldos das contas</h2>
          <div className="divide-y divide-slate-100">
            {accounts.data?.filter((a) => !a.archived).map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-slate-400">{a.institution} · {a.member.name}</div>
                </div>
                <span className="font-semibold">{formatMoney(a.balance, a.currencyCode)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

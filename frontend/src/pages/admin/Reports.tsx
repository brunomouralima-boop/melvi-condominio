import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Scale, Receipt, AlertCircle, Download, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

interface MonthRow {
  month: string; // YYYY-MM
  billed: number;
  received: number;
  expense: number;
  overdue: number;
  balance: number;
}
interface CategoryRow { category: string; total: number }
interface ReportResponse {
  year: number;
  months: MonthRow[];
  totals: { billed: number; received: number; expense: number; overdue: number; balance: number };
  byCategoryExpense: CategoryRow[];
  byCategoryIncome: CategoryRow[];
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthLabel(month: string) {
  const m = Number(month.split("-")[1]) - 1;
  return MONTH_LABELS[m] ?? month;
}

export function AdminReports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading } = useQuery({
    queryKey: ["financial-report", year],
    queryFn: () => api.get<ReportResponse>(`/financial/report?year=${year}`).then((r) => r.data),
  });

  const chartData = useMemo(
    () => (data?.months ?? []).map((m) => ({ label: monthLabel(m.month), Recebido: m.received, Despesas: m.expense })),
    [data]
  );

  const maxExpenseCat = Math.max(1, ...(data?.byCategoryExpense ?? []).map((c) => c.total));
  const maxIncomeCat = Math.max(1, ...(data?.byCategoryIncome ?? []).map((c) => c.total));

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  function exportCsv() {
    if (!data) return;
    const header = ["Mês", "Cobrado", "Recebido", "Despesas", "Em atraso", "Saldo"];
    const lines = data.months.map((m) => [
      m.month, String(m.billed), String(m.received), String(m.expense), String(m.overdue), String(m.balance),
    ]);
    lines.push(["TOTAL", String(data.totals.billed), String(data.totals.received), String(data.totals.expense), String(data.totals.overdue), String(data.totals.balance)]);
    const csv = [header, ...lines].map((l) => l.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-financeiro-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Relatórios financeiros</h1>
          <p className="text-slate-500">Mapa de arrecadação, despesas e resultado</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Button variant="outline" onClick={exportCsv} disabled={!data}><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard icon={TrendingUp} color="text-emerald-600" label="Recebido" value={data?.totals.received ?? 0} />
        <KpiCard icon={TrendingDown} color="text-coral-600" label="Despesas" value={data?.totals.expense ?? 0} />
        <KpiCard
          icon={Scale}
          color={(data?.totals.balance ?? 0) >= 0 ? "text-emerald-600" : "text-coral-600"}
          label="Resultado"
          value={data?.totals.balance ?? 0}
          highlight
        />
        <KpiCard icon={Receipt} color="text-brand-600" label="Cobrado" value={data?.totals.billed ?? 0} />
        <KpiCard icon={AlertCircle} color="text-amber-600" label="Em atraso" value={data?.totals.overdue ?? 0} />
      </div>

      {/* Receitas vs Despesas */}
      <Card>
        <CardHeader><CardTitle>Recebido vs Despesas — {year}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="Recebido" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#FF6B6B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Mapa de arrecadação mensal */}
      <Card>
        <CardHeader><CardTitle>Mapa de arrecadação mensal</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Mês</th>
                  <th className="text-right py-2 px-2">Cobrado</th>
                  <th className="text-right py-2 px-2">Recebido</th>
                  <th className="text-right py-2 px-2">% Recebido</th>
                  <th className="text-right py-2 px-2">Despesas</th>
                  <th className="text-right py-2 px-2">Em atraso</th>
                  <th className="text-right py-2 px-2">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {(data?.months ?? []).map((m) => {
                  const pct = m.billed > 0 ? Math.round((m.received / m.billed) * 100) : 0;
                  return (
                    <tr key={m.month} className="border-b border-slate-100">
                      <td className="py-2 px-2 font-medium">{monthLabel(m.month)}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatCurrency(m.billed)}</td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-700">{formatCurrency(m.received)}</td>
                      <td className="py-2 px-2 text-right">{m.billed > 0 ? `${pct}%` : "—"}</td>
                      <td className="py-2 px-2 text-right font-mono text-coral-600">{formatCurrency(m.expense)}</td>
                      <td className="py-2 px-2 text-right font-mono text-amber-600">{formatCurrency(m.overdue)}</td>
                      <td className={`py-2 px-2 text-right font-mono font-semibold ${m.balance >= 0 ? "text-emerald-700" : "text-coral-600"}`}>{formatCurrency(m.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {data && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-semibold">
                    <td className="py-2 px-2">TOTAL</td>
                    <td className="py-2 px-2 text-right font-mono">{formatCurrency(data.totals.billed)}</td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-700">{formatCurrency(data.totals.received)}</td>
                    <td className="py-2 px-2 text-right">{data.totals.billed > 0 ? `${Math.round((data.totals.received / data.totals.billed) * 100)}%` : "—"}</td>
                    <td className="py-2 px-2 text-right font-mono text-coral-600">{formatCurrency(data.totals.expense)}</td>
                    <td className="py-2 px-2 text-right font-mono text-amber-600">{formatCurrency(data.totals.overdue)}</td>
                    <td className={`py-2 px-2 text-right font-mono ${data.totals.balance >= 0 ? "text-emerald-700" : "text-coral-600"}`}>{formatCurrency(data.totals.balance)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {isLoading && <div className="py-4 text-center text-sm text-slate-400">A carregar…</div>}
        </CardContent>
      </Card>

      {/* Por categoria */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Despesas por categoria</CardTitle></CardHeader>
          <CardContent>
            <CategoryList rows={data?.byCategoryExpense ?? []} max={maxExpenseCat} color="bg-coral-400" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Receitas por categoria</CardTitle></CardHeader>
          <CardContent>
            <CategoryList rows={data?.byCategoryIncome ?? []} max={maxIncomeCat} color="bg-emerald-400" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, color, label, value, highlight }: { icon: any; color: string; label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-brand-200 bg-brand-50/40" : ""}>
      <CardContent className="flex items-center gap-3 py-4">
        <Icon className={`h-7 w-7 ${color}`} />
        <div className="min-w-0">
          <div className="text-xl font-bold font-display text-brand-900 truncate">{formatCurrency(value)}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryList({ rows, max, color }: { rows: CategoryRow[]; max: number; color: string }) {
  if (rows.length === 0) return <div className="text-sm text-slate-400">Sem dados no período.</div>;
  return (
    <div className="space-y-3">
      {rows.map((c) => (
        <div key={c.category}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-700">{c.category}</span>
            <span className="font-mono text-slate-900">{formatCurrency(c.total)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, (c.total / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

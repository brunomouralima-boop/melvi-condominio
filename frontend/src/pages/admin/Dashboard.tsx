import { useQuery } from "@tanstack/react-query";
import { Building, Users, AlertTriangle, Siren, ShieldCheck, TrendingUp, TrendingDown, Wallet, Percent } from "lucide-react";
import { PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AdminStats, AccessLog } from "@/types";
import { formatDate, formatCurrency } from "@/lib/utils";

interface FinSummary {
  monthIncome: number;
  monthExpenses: number;
  totalOpen: number;
  overdueAmount: number;
  delinquencyRate: number;
  unitsInArrears: number;
}

const COLORS = ["#FF6B6B", "#0F172A", "#F59E0B", "#10B981", "#6366F1"];

const CATEGORY_LABEL: Record<string, string> = {
  NOISE: "Barulho",
  MAINTENANCE: "Manutenção",
  SECURITY: "Segurança",
  CLEANING: "Limpeza",
  OTHER: "Outro",
};

export function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/condominium/stats").then((r) => r.data),
  });
  const { data: recentLogs = [] } = useQuery({
    queryKey: ["recent-access-logs"],
    queryFn: () => api.get<AccessLog[]>("/access-logs").then((r) => r.data),
  });
  const { data: fin } = useQuery({
    queryKey: ["financial-summary"],
    queryFn: () => api.get<FinSummary>("/financial/summary").then((r) => r.data),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Dashboard</h1>
        <p className="text-slate-500">Visão geral do condomínio</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Stat icon={Building} label="Unidades" value={stats?.units ?? "—"} />
        <Stat icon={Users} label="Residentes" value={stats?.residents ?? "—"} />
        <Stat icon={AlertTriangle} label="Ocorrências abertas" value={stats?.openOccurrences ?? "—"} />
        <Stat icon={ShieldCheck} label="Acessos hoje" value={stats?.todayAccess ?? "—"} />
        <Stat
          icon={Siren}
          label="Alertas pânico activos"
          value={stats?.activePanic ?? 0}
          variant={stats?.activePanic ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={TrendingUp} label="Receita do mês" value={formatCurrency(fin?.monthIncome ?? 0)} />
        <Stat icon={TrendingDown} label="Despesas do mês" value={formatCurrency(fin?.monthExpenses ?? 0)} />
        <Stat
          icon={Wallet}
          label={`Em dívida${fin?.unitsInArrears ? ` · ${fin.unitsInArrears} un.` : ""}`}
          value={formatCurrency(fin?.overdueAmount ?? 0)}
          variant={(fin?.overdueAmount ?? 0) > 0 ? "danger" : "default"}
        />
        <Stat icon={Percent} label="Inadimplência" value={`${(fin?.delinquencyRate ?? 0).toFixed(1)}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ocorrências por categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(stats?.byCategory ?? []).map((c) => ({ name: CATEGORY_LABEL[c.category] ?? c.category, value: c.count }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {(stats?.byCategory ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-600 justify-center">
              {(stats?.byCategory ?? []).map((c, i) => (
                <div key={c.category} className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                  {CATEGORY_LABEL[c.category] ?? c.category} ({c.count})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Entradas — últimos 7 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.accessByDay ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#0F172A" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Actividade recente</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentLogs.slice(0, 8).map((l) => (
              <div key={l.id} className="flex items-center gap-3 text-sm border-b border-slate-100 pb-2">
                <ShieldCheck className="h-4 w-4 text-brand-500" />
                <div className="flex-1">
                  <span className="font-medium text-brand-900">{l.personName}</span>
                  <span className="text-slate-500"> · {l.type === "ENTRY" ? "Entrada" : "Saída"}</span>
                  {l.fraction && <span className="text-slate-500"> · {l.fraction.tower?.name} {l.fraction.identifier}</span>}
                </div>
                <span className="text-xs text-slate-400">{formatDate(l.timestamp)}</span>
              </div>
            ))}
            {recentLogs.length === 0 && <div className="text-sm text-slate-500">Sem actividade recente.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, variant = "default" }: { icon: any; label: string; value: number | string; variant?: "default" | "danger" }) {
  return (
    <Card className={variant === "danger" ? "border-coral-300 bg-coral-50" : ""}>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={variant === "danger" ? "rounded-lg bg-coral-200 p-2.5" : "rounded-lg bg-brand-50 p-2.5"}>
          <Icon className={variant === "danger" ? "h-5 w-5 text-coral-700" : "h-5 w-5 text-brand-700"} />
        </div>
        <div>
          <div className={`text-2xl font-bold font-display ${variant === "danger" ? "text-coral-700" : "text-brand-900"}`}>{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

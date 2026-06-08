import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, CheckCircle2, Trash2, Wrench, Clock, CalendarCheck, CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { MaintenanceOrder, MaintenanceStats, MaintStatus, MaintKind, MaintPriority } from "@/types";
import { OrderDrawer } from "@/components/maintenance/OrderDrawer";
import { KIND_LABEL, STATUS_LABEL, STATUS_VARIANT, PRIORITY_LABEL, PRIORITY_VARIANT } from "@/components/maintenance/labels";
import toast from "react-hot-toast";

export function AdminMaintenance() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"" | MaintStatus>("");
  const [kindFilter, setKindFilter] = useState<"" | MaintKind>("");
  const [priorityFilter, setPriorityFilter] = useState<"" | MaintPriority>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceOrder | null>(null);

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (kindFilter) params.set("kind", kindFilter);
  if (priorityFilter) params.set("priority", priorityFilter);

  const { data: orders = [] } = useQuery({
    queryKey: ["maintenance-orders", statusFilter, kindFilter, priorityFilter],
    queryFn: () => api.get<MaintenanceOrder[]>(`/maintenance/orders?${params.toString()}`).then((r) => r.data),
  });
  const { data: stats } = useQuery({
    queryKey: ["maintenance-stats"],
    queryFn: () => api.get<MaintenanceStats>("/maintenance/orders/stats").then((r) => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["maintenance-orders"] });
    qc.invalidateQueries({ queryKey: ["maintenance-stats"] });
  };

  const complete = useMutation({
    mutationFn: (id: string) => api.post(`/maintenance/orders/${id}/complete`, {}),
    onSuccess: () => { toast.success("Marcada como realizada"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/maintenance/orders/${id}`),
    onSuccess: () => { toast.success("Removida"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Manutenção</h1>
          <p className="text-slate-500">Ordens de serviço corretivas e preventivas</p>
        </div>
        <Button onClick={() => { setEditing(null); setDrawerOpen(true); }}><Plus className="h-4 w-4" /> Nova ordem</Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Stat icon={Wrench} label="Abertas" value={stats?.open ?? 0} color="text-amber-600" />
        <Stat icon={Clock} label="Em curso" value={stats?.inProgress ?? 0} color="text-brand-600" />
        <Stat icon={CalendarClock} label="Agendadas" value={stats?.scheduled ?? 0} color="text-slate-600" />
        <Stat icon={CalendarCheck} label="Preventivas a vencer" value={stats?.preventiveDue ?? 0} color="text-coral-600" />
        <Stat icon={CheckCircle2} label="Concluídas (mês)" value={stats?.doneMonth ?? 0} color="text-emerald-600" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Ordens ({orders.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select className="w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="">Todos os estados</option>
              {(["OPEN", "SCHEDULED", "IN_PROGRESS", "DONE", "CANCELLED"] as MaintStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </Select>
            <Select className="w-auto" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)}>
              <option value="">Todos os tipos</option>
              {(["CORRECTIVE", "PREVENTIVE"] as MaintKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
            <Select className="w-auto" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)}>
              <option value="">Todas as prioridades</option>
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as MaintPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Título</th>
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-left py-2 px-2">Prioridade</th>
                  <th className="text-left py-2 px-2">Fornecedor</th>
                  <th className="text-left py-2 px-2">Local</th>
                  <th className="text-left py-2 px-2">Agendada</th>
                  <th className="text-right py-2 px-2">Custo</th>
                  <th className="text-left py-2 px-2">Estado</th>
                  <th className="text-right py-2 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="py-2 px-2">
                      <div className="font-medium text-brand-900">{o.title}</div>
                      {o.category && <div className="text-xs text-slate-400">{o.category}</div>}
                    </td>
                    <td className="py-2 px-2"><Badge variant={o.kind === "PREVENTIVE" ? "secondary" : "outline"}>{KIND_LABEL[o.kind]}</Badge></td>
                    <td className="py-2 px-2"><Badge variant={PRIORITY_VARIANT[o.priority]}>{PRIORITY_LABEL[o.priority]}</Badge></td>
                    <td className="py-2 px-2 text-slate-700">{o.supplier?.name ?? "—"}</td>
                    <td className="py-2 px-2 text-slate-700">{o.tower?.name ? `${o.tower.name}${o.fraction ? " " + o.fraction.identifier : ""}` : "Geral"}</td>
                    <td className="py-2 px-2 text-slate-500">{o.scheduledDate ? formatDate(o.scheduledDate, { hour: undefined, minute: undefined }) : "—"}</td>
                    <td className="py-2 px-2 text-right font-mono">{o.cost != null ? formatCurrency(o.cost) : "—"}</td>
                    <td className="py-2 px-2"><Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                    <td className="py-2 px-2">
                      <div className="flex justify-end gap-1">
                        {o.status !== "DONE" && o.status !== "CANCELLED" && (
                          <Button size="sm" variant="outline" title="Marcar realizada" disabled={complete.isPending} onClick={() => complete.mutate(o.id)}><CheckCircle2 className="h-4 w-4" /></Button>
                        )}
                        <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditing(o); setDrawerOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" title="Remover" onClick={() => { if (confirm("Remover ordem?")) remove.mutate(o.id); }}><Trash2 className="h-4 w-4 text-coral-600" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-slate-400">Sem ordens de manutenção.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <OrderDrawer open={drawerOpen} order={editing} onClose={() => setDrawerOpen(false)} onSaved={invalidate} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <Icon className={`h-7 w-7 ${color}`} />
        <div>
          <div className="text-2xl font-bold font-display text-brand-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

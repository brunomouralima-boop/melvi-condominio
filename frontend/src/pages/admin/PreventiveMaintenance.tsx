import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2, Pencil, CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { MaintenanceOrder } from "@/types";
import { OrderDrawer } from "@/components/maintenance/OrderDrawer";
import { FREQUENCY_LABEL, STATUS_LABEL, STATUS_VARIANT } from "@/components/maintenance/labels";
import toast from "react-hot-toast";

function dueState(nextDueDate?: string | null): { label: string; variant: "success" | "warning" | "destructive" | "secondary"; days: number | null } {
  if (!nextDueDate) return { label: "Sem data", variant: "secondary", days: null };
  const now = new Date();
  const due = new Date(nextDueDate);
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `Vencida há ${Math.abs(days)}d`, variant: "destructive", days };
  if (days <= 30) return { label: `Em ${days}d`, variant: "warning", days };
  return { label: `Em ${days}d`, variant: "success", days };
}

export function AdminPreventiveMaintenance() {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceOrder | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["maintenance-orders", "PREVENTIVE-plan"],
    queryFn: () => api.get<MaintenanceOrder[]>("/maintenance/orders?kind=PREVENTIVE").then((r) => r.data),
  });

  const sorted = [...orders].sort((a, b) => {
    const da = a.nextDueDate ? new Date(a.nextDueDate).getTime() : Infinity;
    const db = b.nextDueDate ? new Date(b.nextDueDate).getTime() : Infinity;
    return da - db;
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["maintenance-orders"] });
    qc.invalidateQueries({ queryKey: ["maintenance-stats"] });
  };

  const complete = useMutation({
    mutationFn: (id: string) => api.post(`/maintenance/orders/${id}/complete`, {}),
    onSuccess: () => { toast.success("Realizada — próxima data agendada"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Manutenção preventiva</h1>
          <p className="text-slate-500">Planos recorrentes e próximas intervenções</p>
        </div>
        <Button onClick={() => { setEditing(null); setDrawerOpen(true); }}><Plus className="h-4 w-4" /> Novo plano</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Planos preventivos ({sorted.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Plano</th>
                  <th className="text-left py-2 px-2">Periodicidade</th>
                  <th className="text-left py-2 px-2">Fornecedor</th>
                  <th className="text-left py-2 px-2">Local</th>
                  <th className="text-left py-2 px-2">Próxima data</th>
                  <th className="text-left py-2 px-2">Estado</th>
                  <th className="text-right py-2 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((o) => {
                  const ds = dueState(o.nextDueDate);
                  return (
                    <tr key={o.id} className="border-b border-slate-100">
                      <td className="py-2 px-2">
                        <div className="font-medium text-brand-900">{o.title}</div>
                        {o.category && <div className="text-xs text-slate-400">{o.category}</div>}
                      </td>
                      <td className="py-2 px-2 text-slate-700">{FREQUENCY_LABEL[o.frequency]}</td>
                      <td className="py-2 px-2 text-slate-700">{o.supplier?.name ?? "—"}</td>
                      <td className="py-2 px-2 text-slate-700">{o.tower?.name ? `${o.tower.name}${o.fraction ? " " + o.fraction.identifier : ""}` : "Geral"}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">{o.nextDueDate ? formatDate(o.nextDueDate, { hour: undefined, minute: undefined }) : "—"}</span>
                          <Badge variant={ds.variant}>{ds.label}</Badge>
                        </div>
                      </td>
                      <td className="py-2 px-2"><Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                      <td className="py-2 px-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" title="Marcar realizada (agenda próxima)" disabled={complete.isPending} onClick={() => complete.mutate(o.id)}>
                            <CheckCircle2 className="h-4 w-4" /> Realizada
                          </Button>
                          <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditing(o); setDrawerOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-400">Sem planos preventivos. Crie o primeiro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <OrderDrawer open={drawerOpen} order={editing} defaultKind="PREVENTIVE" onClose={() => setDrawerOpen(false)} onSaved={invalidate} />
    </div>
  );
}

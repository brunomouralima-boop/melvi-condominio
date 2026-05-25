import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Siren, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { PanicAlert } from "@/types";
import { useSocketEvent } from "@/contexts/SocketContext";
import toast from "react-hot-toast";

export function AdminPanicAlerts() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["panic-alerts"],
    queryFn: () => api.get<PanicAlert[]>("/panic-alerts").then((r) => r.data),
  });

  useSocketEvent("panic:alert", () => qc.invalidateQueries({ queryKey: ["panic-alerts"] }));
  useSocketEvent("panic:updated", () => qc.invalidateQueries({ queryKey: ["panic-alerts"] }));

  const ack = useMutation({
    mutationFn: (id: string) => api.put(`/panic-alerts/${id}/acknowledge`),
    onSuccess: () => { toast.success("Alerta confirmado"); qc.invalidateQueries({ queryKey: ["panic-alerts"] }); },
  });
  const resolve = useMutation({
    mutationFn: (id: string) => api.put(`/panic-alerts/${id}/resolve`),
    onSuccess: () => { toast.success("Alerta resolvido"); qc.invalidateQueries({ queryKey: ["panic-alerts"] }); },
  });

  const active = items.filter((a) => a.status === "ACTIVE");
  const history = items.filter((a) => a.status !== "ACTIVE");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900 flex items-center gap-2">
          <Siren className="h-7 w-7 text-coral-600" />
          Alertas de Pânico
        </h1>
        <p className="text-slate-500">Acompanhamento de alertas activos e histórico</p>
      </div>

      <Card className={active.length ? "border-coral-300 bg-coral-50" : ""}>
        <CardHeader>
          <CardTitle className="text-coral-800">
            {active.length ? `🚨 ${active.length} alerta(s) ativo(s)` : "Sem alertas ativos"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {active.map((a) => (
            <div key={a.id} className="rounded-lg bg-white border border-coral-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-coral-800">
                    {a.fraction?.tower?.name} {a.fraction?.identifier} · {a.triggeredBy?.name}
                    {a.triggeredBy?.phone && <span className="text-slate-500 ml-2">({a.triggeredBy.phone})</span>}
                  </div>
                  <div className="text-sm text-slate-700 mt-1">{a.description}</div>
                  <div className="text-xs text-slate-500 mt-1">{formatDate(a.createdAt)}</div>
                </div>
                <Button variant="destructive" onClick={() => ack.mutate(a.id)}>
                  <CheckCircle2 className="h-4 w-4" /> Confirmar
                </Button>
              </div>
            </div>
          ))}
          {active.length === 0 && <div className="text-sm text-slate-500">Tudo tranquilo.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="text-left py-2">Data</th>
                <th className="text-left py-2">Unidade</th>
                <th className="text-left py-2">Residente</th>
                <th className="text-left py-2">Descrição</th>
                <th className="text-left py-2">Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2">{formatDate(a.createdAt)}</td>
                  <td className="py-2">{a.fraction?.tower?.name} {a.fraction?.identifier}</td>
                  <td className="py-2">{a.triggeredBy?.name}</td>
                  <td className="py-2 max-w-md truncate" title={a.description}>{a.description}</td>
                  <td className="py-2">
                    <Badge variant={a.status === "RESOLVED" ? "success" : "secondary"}>{a.status}</Badge>
                  </td>
                  <td className="py-2 text-right">
                    {a.status === "ACKNOWLEDGED" && (
                      <Button size="sm" variant="outline" onClick={() => resolve.mutate(a.id)}>Resolver</Button>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-400">Sem histórico.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

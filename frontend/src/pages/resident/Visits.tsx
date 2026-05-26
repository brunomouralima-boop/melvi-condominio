import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSocketEvent } from "@/contexts/SocketContext";
import { formatDate } from "@/lib/utils";
import type { Visit } from "@/types";
import { VisitStatusBadge, formatDuration, elapsedSince } from "@/components/visits/VisitStatusBadge";

/**
 * Histórico de visitas para a fracção do residente.
 * Visitas com status=INSIDE aparecem destacadas em verde no topo.
 */
export function ResidentVisits() {
  const qc = useQueryClient();

  const { data: visits = [] } = useQuery({
    queryKey: ["my-visits"],
    queryFn: () => api.get<Visit[]>("/visits").then((r) => r.data),
    refetchInterval: 60_000,
  });

  useSocketEvent("visit:entry", () => qc.invalidateQueries({ queryKey: ["my-visits"] }));
  useSocketEvent("visit:exit", () => qc.invalidateQueries({ queryKey: ["my-visits"] }));

  const inside = visits.filter((v) => v.status === "INSIDE");
  const history = visits.filter((v) => v.status !== "INSIDE");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900 flex items-center gap-2">
          <Users className="h-7 w-7 text-brand-700" />
          Visitas à minha fracção
        </h1>
        <p className="text-slate-500">Acompanhe quem está / esteve no seu apartamento</p>
      </div>

      {/* Visitantes activos (dentro do condomínio agora) */}
      {inside.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              No condomínio agora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inside.map((v) => (
              <div key={v.id} className="rounded-lg bg-white border border-emerald-200 p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 grid place-items-center shrink-0">
                  <Users className="h-5 w-5 text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-brand-900 truncate">{v.guestName}</div>
                    <VisitStatusBadge status={v.status} size="sm" />
                  </div>
                  <div className="text-xs text-emerald-700 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    Entrou às {v.entryAt && new Date(v.entryAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                    <span className="text-slate-500">· há {v.entryAt ? elapsedSince(v.entryAt) : "—"}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico ({history.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Visitante</th>
                  <th className="text-left py-2 px-2">Entrada</th>
                  <th className="text-left py-2 px-2">Saída</th>
                  <th className="text-left py-2 px-2">Duração</th>
                  <th className="text-left py-2 px-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Sem visitas anteriores.
                    </td>
                  </tr>
                ) : (
                  history.map((v) => (
                    <tr key={v.id} className="border-b border-slate-100">
                      <td className="py-2 px-2">
                        <div className="font-medium text-brand-900">{v.guestName}</div>
                        {v.guestDocument && <div className="text-xs text-slate-500">{v.guestDocument}</div>}
                      </td>
                      <td className="py-2 px-2 text-slate-700 text-xs font-mono">
                        {v.entryAt ? formatDate(v.entryAt) : "—"}
                      </td>
                      <td className="py-2 px-2 text-slate-700 text-xs font-mono">
                        {v.exitAt ? formatDate(v.exitAt) : "—"}
                      </td>
                      <td className="py-2 px-2 text-slate-700 font-mono">
                        {formatDuration(v.durationMinutes)}
                      </td>
                      <td className="py-2 px-2">
                        <VisitStatusBadge status={v.status} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

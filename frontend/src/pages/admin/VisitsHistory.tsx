import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Download, Filter } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Select, Input } from "@/components/ui/input";
import { useSocketEvent } from "@/contexts/SocketContext";
import { formatDate } from "@/lib/utils";
import type { Visit, VisitStatus } from "@/types";
import { VisitStatusBadge, formatDuration } from "@/components/visits/VisitStatusBadge";
import { VisitorsInsidePanel } from "@/components/visits/VisitorsInsidePanel";

/**
 * Página de histórico de visitas para Admin e Doorman.
 * Mostra:
 *  - Painel "Visitantes no Condomínio" no topo (com botão "Saída")
 *  - Tabela filtrável com TODAS as visitas
 */
export function VisitsHistoryPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<VisitStatus | "ALL">("ALL");
  const [date, setDate] = useState("");

  const params: any = {};
  if (status !== "ALL") params.status = status;
  if (date) params.date = date;

  const { data: visits = [] } = useQuery({
    queryKey: ["visits-history", status, date],
    queryFn: () => api.get<Visit[]>("/visits", { params }).then((r) => r.data),
  });

  // Realtime refresh
  useSocketEvent("visit:entry", () => qc.invalidateQueries({ queryKey: ["visits-history"] }));
  useSocketEvent("visit:exit", () => qc.invalidateQueries({ queryKey: ["visits-history"] }));

  function exportCsv() {
    const header = ["ID", "Nome", "Documento", "Estado", "Fracção", "Entrada", "Saída", "Duração", "Autorizado por", "Saída registada por"].join(",");
    const rows = visits.map((v) =>
      [
        v.id,
        `"${v.guestName.replace(/"/g, '""')}"`,
        v.guestDocument ?? "",
        v.status,
        v.fraction ? `${v.fraction.tower?.name ?? ""} ${v.fraction.identifier}` : "",
        v.entryAt ? new Date(v.entryAt).toISOString() : "",
        v.exitAt ? new Date(v.exitAt).toISOString() : "",
        v.durationMinutes ?? "",
        v.authorizedBy?.name ?? "",
        v.exitRegisteredBy?.name ?? "",
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visitas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-brand-700" />
            Histórico de Visitas
          </h1>
          <p className="text-slate-500">Visitantes no condomínio agora e histórico completo</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* Painel em tempo real */}
      <VisitorsInsidePanel readOnly />

      {/* Filtros */}
      <Card>
        <CardContent className="grid gap-3 md:grid-cols-3 py-4">
          <div>
            <Label>Estado</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as VisitStatus | "ALL")}>
              <option value="ALL">Todos</option>
              <option value="INSIDE">Dentro do condomínio</option>
              <option value="EXITED">Saíram</option>
              <option value="SCHEDULED">Agendados</option>
              <option value="CANCELLED">Cancelados</option>
            </Select>
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => { setStatus("ALL"); setDate(""); }}>
              <Filter className="h-4 w-4" /> Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>{visits.length} visita(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Visitante</th>
                  <th className="text-left py-2 px-2">Fracção</th>
                  <th className="text-left py-2 px-2">Entrada</th>
                  <th className="text-left py-2 px-2">Saída</th>
                  <th className="text-left py-2 px-2">Duração</th>
                  <th className="text-left py-2 px-2">Autorizado por</th>
                  <th className="text-left py-2 px-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {visits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      Sem visitas para os filtros seleccionados.
                    </td>
                  </tr>
                )}
                {visits.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="py-2 px-2">
                      <div className="font-medium text-brand-900">{v.guestName}</div>
                      {v.guestDocument && <div className="text-xs text-slate-500">{v.guestDocument}</div>}
                    </td>
                    <td className="py-2 px-2 text-slate-700">
                      {v.fraction ? `${v.fraction.tower?.name} ${v.fraction.identifier}` : "—"}
                    </td>
                    <td className="py-2 px-2 text-slate-700 font-mono text-xs">
                      {v.entryAt ? formatDate(v.entryAt) : "—"}
                    </td>
                    <td className="py-2 px-2 text-slate-700 font-mono text-xs">
                      {v.exitAt ? formatDate(v.exitAt) : "—"}
                    </td>
                    <td className="py-2 px-2 text-slate-700 font-mono">{formatDuration(v.durationMinutes)}</td>
                    <td className="py-2 px-2 text-slate-700">{v.authorizedBy?.name ?? "—"}</td>
                    <td className="py-2 px-2">
                      <VisitStatusBadge status={v.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

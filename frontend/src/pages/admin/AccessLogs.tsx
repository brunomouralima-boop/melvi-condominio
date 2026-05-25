import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AccessLog, Fraction } from "@/types";
import { useSocketEvent } from "@/contexts/SocketContext";

export function AdminAccessLogs() {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [fractionId, setFractionId] = useState("");
  const [type, setType] = useState("");

  const params: any = {};
  if (date) params.date = date;
  if (fractionId) params.fractionId = fractionId;
  if (type) params.type = type;

  const { data: logs = [] } = useQuery({
    queryKey: ["access-logs-admin", { date, fractionId, type }],
    queryFn: () => api.get<AccessLog[]>("/access-logs", { params }).then((r) => r.data),
  });
  const { data: fractions = [] } = useQuery({
    queryKey: ["fractions"],
    queryFn: () => api.get<Fraction[]>("/fractions").then((r) => r.data),
  });

  useSocketEvent("access:new", () => qc.invalidateQueries({ queryKey: ["access-logs-admin"] }));

  const csv = useMemo(() => {
    const header = ["Hora", "Tipo", "Pessoa", "Documento", "Fracção", "Método", "Notas"].join(",");
    const rows = logs.map((l) =>
      [
        new Date(l.timestamp).toISOString(),
        l.type,
        `"${l.personName.replace(/"/g, '""')}"`,
        l.personDocument ?? "",
        l.fraction ? `${l.fraction.tower?.name ?? ""} ${l.fraction.identifier}`.trim() : "",
        l.method,
        `"${(l.notes ?? "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    return [header, ...rows].join("\n");
  }, [logs]);

  function exportCsv() {
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-brand-700" />
            Controlo de Acesso
          </h1>
          <p className="text-slate-500">Histórico completo de entradas e saídas</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Exportar CSV</Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-4 py-4">
          <div>
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Fracção</Label>
            <Select value={fractionId} onChange={(e) => setFractionId(e.target.value)}>
              <option value="">Todas</option>
              {fractions.map((f) => <option key={f.id} value={f.id}>{f.tower?.name} {f.identifier}</option>)}
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Todos</option>
              <option value="ENTRY">Entradas</option>
              <option value="EXIT">Saídas</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => { setDate(""); setFractionId(""); setType(""); }}>Limpar filtros</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{logs.length} registo(s)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Data / Hora</th>
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-left py-2 px-2">Pessoa</th>
                  <th className="text-left py-2 px-2">Documento</th>
                  <th className="text-left py-2 px-2">Fracção</th>
                  <th className="text-left py-2 px-2">Método</th>
                  <th className="text-left py-2 px-2">Registado por</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-400">Sem registos.</td></tr>
                )}
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-2 px-2 font-mono text-slate-700">{formatDate(l.timestamp)}</td>
                    <td className="py-2 px-2">
                      <Badge variant={l.type === "ENTRY" ? "success" : "secondary"}>
                        {l.type === "ENTRY" ? "ENTRADA" : "SAÍDA"}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 font-medium text-brand-900">{l.personName}</td>
                    <td className="py-2 px-2 text-slate-700">{l.personDocument ?? "—"}</td>
                    <td className="py-2 px-2 text-slate-700">
                      {l.fraction ? `${l.fraction.tower?.name ?? ""} ${l.fraction.identifier}`.trim() : "—"}
                    </td>
                    <td className="py-2 px-2"><Badge variant="outline">{l.method}</Badge></td>
                    <td className="py-2 px-2 text-slate-500">{l.registeredBy?.name ?? "—"}</td>
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

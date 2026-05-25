import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, Trash2, History as HistoryIcon } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Meter, MeterReading } from "@/types";
import toast from "react-hot-toast";

interface Props {
  meter: Meter | null;
  open: boolean;
  onClose: () => void;
}

export function HistoryDialog({ meter, open, onClose }: Props) {
  const qc = useQueryClient();

  const { data: readings = [], isLoading } = useQuery({
    queryKey: ["meter-readings", meter?.id],
    queryFn: () => api.get<MeterReading[]>(`/meters/${meter!.id}/readings`, { params: { limit: 60 } }).then((r) => r.data),
    enabled: !!meter && open,
  });

  const deleteMostRecent = useMutation({
    mutationFn: (readingId: string) => api.delete(`/meters/${meter!.id}/readings/${readingId}`),
    onSuccess: () => {
      toast.success("Leitura eliminada");
      qc.invalidateQueries({ queryKey: ["meter-readings", meter?.id] });
      qc.invalidateQueries({ queryKey: ["meters"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  // Chart data: oldest → newest
  const chartData = useMemo(() => {
    return [...readings]
      .reverse()
      .map((r) => ({
        label: `${String(r.readingMonth).padStart(2, "0")}/${String(r.readingYear).slice(-2)}`,
        value: Number(r.readingValue),
        consumption: r.consumption !== null && r.consumption !== undefined ? Number(r.consumption) : null,
      }));
  }, [readings]);

  const mostRecentId = readings[0]?.id;

  function exportCsv() {
    if (!meter) return;
    const header = ["Data", "Mês/Ano", "Valor", "Consumo", "Registado por", "Notas"].join(",");
    const rows = readings.map((r) =>
      [
        new Date(r.readingDate).toISOString(),
        `${r.readingMonth}/${r.readingYear}`,
        Number(r.readingValue),
        r.consumption !== null && r.consumption !== undefined ? Number(r.consumption) : "",
        r.registeredBy?.name ?? "",
        `"${(r.notes ?? "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leituras-${meter.name.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!meter) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-brand-700" />
            Histórico — {meter.name}
          </DialogTitle>
          <DialogDescription>
            {readings.length} leitura(s) registada(s) · unidade: {meter.unit}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-slate-400">A carregar…</div>
        ) : readings.length === 0 ? (
          <div className="py-8 text-center text-slate-400">Sem leituras registadas para este medidor.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs text-slate-500 mb-2">Evolução da leitura</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString("pt-PT")} ${meter.unit}`} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Leitura"
                      stroke="#0F172A"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-slate-500 sticky top-0 bg-white z-10">
                  <tr>
                    <th className="text-left py-2 px-3">Data</th>
                    <th className="text-left py-2 px-3">Mês/Ano</th>
                    <th className="text-right py-2 px-3">Valor</th>
                    <th className="text-right py-2 px-3">Consumo</th>
                    <th className="text-left py-2 px-3">Registado por</th>
                    <th className="text-left py-2 px-3">Notas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-700">
                        {formatDate(r.readingDate, { hour: undefined, minute: undefined })}
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-mono">
                        {String(r.readingMonth).padStart(2, "0")}/{r.readingYear}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium">
                        {Number(r.readingValue).toLocaleString("pt-PT")} {meter.unit}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {r.consumption !== null && r.consumption !== undefined ? (
                          <Badge variant={Number(r.consumption) >= 0 ? "secondary" : "destructive"}>
                            {Number(r.consumption) >= 0 ? "+" : ""}
                            {Number(r.consumption).toLocaleString("pt-PT")}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{r.registeredBy?.name ?? "—"}</td>
                      <td className="py-2 px-3 text-slate-600 text-xs max-w-[160px] truncate" title={r.notes ?? undefined}>
                        {r.isReset && <Badge variant="warning" className="mr-1">Reset</Badge>}
                        {r.notes ?? ""}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {r.id === mostRecentId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Eliminar a leitura mais recente?")) deleteMostRecent.mutate(r.id);
                            }}
                            title="Eliminar leitura mais recente"
                          >
                            <Trash2 className="h-4 w-4 text-coral-600" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 italic">Apenas a leitura mais recente pode ser eliminada.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

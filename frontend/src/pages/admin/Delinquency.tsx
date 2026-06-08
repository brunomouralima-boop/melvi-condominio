import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Users, Percent, FileText, MessageCircle, Download } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { FractionStatementDrawer } from "@/components/financial/FractionStatementDrawer";

interface DelinquencyRow {
  fractionId: string;
  identifier: string;
  tower: { id: string; name: string } | null;
  responsibleName: string | null;
  responsiblePhone: string | null;
  count: number;
  totalOwed: number;
  oldestDue: string;
}
interface DelinquencyResponse {
  rows: DelinquencyRow[];
  grandTotal: number;
  unitsInArrears: number;
}
interface Summary {
  delinquencyRate: number;
  unitsCount: number;
  unitsInArrears: number;
}

function fractionLabel(r: DelinquencyRow) {
  return `${r.tower?.name ? r.tower.name + " " : ""}${r.identifier}`;
}

export function AdminDelinquency() {
  const [statementFor, setStatementFor] = useState<DelinquencyRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["delinquency"],
    queryFn: () => api.get<DelinquencyResponse>("/financial/delinquency").then((r) => r.data),
  });
  const { data: summary } = useQuery({
    queryKey: ["financial-summary"],
    queryFn: () => api.get<Summary>("/financial/summary").then((r) => r.data),
  });

  const rows = data?.rows ?? [];

  function exportCsv() {
    const header = ["Torre", "Fracção", "Responsável", "Telefone", "Cobranças vencidas", "Mais antiga", "Total em dívida"];
    const lines = rows.map((r) => [
      r.tower?.name ?? "",
      r.identifier,
      r.responsibleName ?? "",
      r.responsiblePhone ?? "",
      String(r.count),
      new Date(r.oldestDue).toLocaleDateString("pt-PT"),
      String(r.totalOwed),
    ]);
    const csv = [header, ...lines].map((l) => l.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inadimplencia-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function whatsappLink(r: DelinquencyRow) {
    const phone = (r.responsiblePhone ?? "").replace(/\D/g, "");
    const msg = `Olá ${r.responsibleName ?? ""}. Lembramos que a fracção ${fractionLabel(r)} tem ${formatCurrency(
      r.totalOwed
    )} em cotas por liquidar (${r.count} em atraso). Agradecemos a regularização. — Melvi Condomínio`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Inadimplência</h1>
          <p className="text-slate-500">Frações com cotas em atraso</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-coral-200 bg-coral-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-8 w-8 text-coral-600" />
            <div>
              <div className="text-2xl font-bold font-display text-coral-700">{formatCurrency(data?.grandTotal ?? 0)}</div>
              <div className="text-xs text-slate-500">Total em dívida</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-8 w-8 text-brand-600" />
            <div>
              <div className="text-2xl font-bold font-display text-brand-900">
                {data?.unitsInArrears ?? 0}
                <span className="text-base text-slate-400"> / {summary?.unitsCount ?? "—"}</span>
              </div>
              <div className="text-xs text-slate-500">Unidades em atraso</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Percent className="h-8 w-8 text-amber-600" />
            <div>
              <div className="text-2xl font-bold font-display text-brand-900">{(summary?.delinquencyRate ?? 0).toFixed(1)}%</div>
              <div className="text-xs text-slate-500">Taxa de inadimplência</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Frações em atraso ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Fracção</th>
                  <th className="text-left py-2 px-2">Responsável</th>
                  <th className="text-right py-2 px-2">Vencidas</th>
                  <th className="text-left py-2 px-2">Mais antiga</th>
                  <th className="text-right py-2 px-2">Em dívida</th>
                  <th className="text-right py-2 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.fractionId} className="border-b border-slate-100">
                    <td className="py-2 px-2 font-medium text-brand-900">{fractionLabel(r)}</td>
                    <td className="py-2 px-2 text-slate-700">
                      {r.responsibleName ?? "—"}
                      {r.responsiblePhone && <div className="text-xs text-slate-400">{r.responsiblePhone}</div>}
                    </td>
                    <td className="py-2 px-2 text-right">{r.count}</td>
                    <td className="py-2 px-2 text-slate-500">{formatDate(r.oldestDue, { hour: undefined, minute: undefined })}</td>
                    <td className="py-2 px-2 text-right font-mono font-semibold text-coral-600">{formatCurrency(r.totalOwed)}</td>
                    <td className="py-2 px-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setStatementFor(r)}>
                          <FileText className="h-4 w-4" /> Extrato
                        </Button>
                        {r.responsiblePhone && (
                          <a href={whatsappLink(r)} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" title="Enviar lembrete por WhatsApp">
                              <MessageCircle className="h-4 w-4 text-emerald-600" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && rows.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-emerald-600">🎉 Sem cotas em atraso.</td></tr>
                )}
                {isLoading && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">A carregar…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <FractionStatementDrawer
        open={!!statementFor}
        fractionId={statementFor?.fractionId ?? null}
        fractionLabel={statementFor ? fractionLabel(statementFor) : undefined}
        onClose={() => setStatementFor(null)}
        canManage
      />
    </div>
  );
}

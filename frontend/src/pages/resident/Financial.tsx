import { useQuery } from "@tanstack/react-query";
import { Wallet, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Record {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  amount: string | number;
  dueDate: string;
  paidDate?: string | null;
}

export function ResidentFinancial() {
  const { data: items = [] } = useQuery({
    queryKey: ["financial-mine"],
    queryFn: () => api.get<Record[]>("/financial/records").then((r) => r.data),
  });

  const totalPending = items
    .filter((r) => !r.paidDate && new Date(r.dueDate) <= new Date())
    .reduce((acc, r) => acc + Number(r.amount), 0);
  const totalPaid = items
    .filter((r) => r.paidDate)
    .reduce((acc, r) => acc + Number(r.amount), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Financeiro</h1>
        <p className="text-slate-500">Extrato da sua unidade</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={totalPending > 0 ? "border-coral-200 bg-coral-50" : ""}>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className={`h-8 w-8 ${totalPending > 0 ? "text-coral-600" : "text-emerald-500"}`} />
            <div>
              <div className="text-2xl font-bold font-display text-brand-900">{formatCurrency(totalPending)}</div>
              <div className="text-xs text-slate-500">Em atraso / por pagar</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Wallet className="h-8 w-8 text-brand-600" />
            <div>
              <div className="text-2xl font-bold font-display text-brand-900">{formatCurrency(totalPaid)}</div>
              <div className="text-xs text-slate-500">Total pago (histórico)</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Lançamentos</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="text-left py-2">Descrição</th>
                <th className="text-left py-2">Categoria</th>
                <th className="text-left py-2">Vencimento</th>
                <th className="text-right py-2">Valor</th>
                <th className="text-right py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400">Sem lançamentos.</td></tr>
              )}
              {items.map((r) => {
                const overdue = !r.paidDate && new Date(r.dueDate) < new Date();
                return (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-brand-900">{r.description}</td>
                    <td className="py-2 text-slate-700">{r.category}</td>
                    <td className="py-2 text-slate-500">{formatDate(r.dueDate, { hour: undefined, minute: undefined })}</td>
                    <td className="py-2 text-right font-mono">{formatCurrency(r.amount)}</td>
                    <td className="py-2 text-right">
                      {r.paidDate ? (
                        <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Pago</Badge>
                      ) : overdue ? (
                        <Badge variant="destructive">Em atraso</Badge>
                      ) : (
                        <Badge variant="warning">Pendente</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

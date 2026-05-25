import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Fraction } from "@/types";
import toast from "react-hot-toast";

interface FinRecord {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  amount: string | number;
  dueDate: string;
  paidDate?: string | null;
  fraction?: { identifier: string; tower?: { name: string } } | null;
}

interface Summary { monthIncome: number; monthExpenses: number; overdueCount: number }

export function AdminFinancial() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: records = [] } = useQuery({
    queryKey: ["financial-records"],
    queryFn: () => api.get<FinRecord[]>("/financial/records").then((r) => r.data),
  });
  const { data: summary } = useQuery({
    queryKey: ["financial-summary"],
    queryFn: () => api.get<Summary>("/financial/summary").then((r) => r.data),
  });

  const months: { label: string; key: string; income: number; expense: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ label: d.toLocaleDateString("pt-PT", { month: "short" }), key, income: 0, expense: 0 });
  }
  for (const r of records) {
    const ref = r.paidDate ?? r.dueDate;
    const d = new Date(ref);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((mm) => mm.key === key);
    if (!m) continue;
    if (r.type === "INCOME") m.income += Number(r.amount);
    else m.expense += Number(r.amount);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Financeiro</h1>
          <p className="text-slate-500">Receitas, despesas e extractos</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo lançamento</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <TrendingUp className="h-8 w-8 text-emerald-600" />
            <div>
              <div className="text-2xl font-bold font-display text-brand-900">{formatCurrency(summary?.monthIncome ?? 0)}</div>
              <div className="text-xs text-slate-500">Receitas do mês</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <TrendingDown className="h-8 w-8 text-coral-600" />
            <div>
              <div className="text-2xl font-bold font-display text-brand-900">{formatCurrency(summary?.monthExpenses ?? 0)}</div>
              <div className="text-xs text-slate-500">Despesas do mês</div>
            </div>
          </CardContent>
        </Card>
        <Card className={(summary?.overdueCount ?? 0) > 0 ? "border-coral-200 bg-coral-50" : ""}>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className={`h-8 w-8 ${(summary?.overdueCount ?? 0) > 0 ? "text-coral-600" : "text-slate-400"}`} />
            <div>
              <div className="text-2xl font-bold font-display text-brand-900">{summary?.overdueCount ?? 0}</div>
              <div className="text-xs text-slate-500">Cotas em atraso</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Receitas vs Despesas — últimos 6 meses</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="income" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Despesas" fill="#FF6B6B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lançamentos ({records.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-left py-2 px-2">Descrição</th>
                  <th className="text-left py-2 px-2">Categoria</th>
                  <th className="text-left py-2 px-2">Fracção</th>
                  <th className="text-left py-2 px-2">Vencimento</th>
                  <th className="text-right py-2 px-2">Valor</th>
                  <th className="text-right py-2 px-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const overdue = !r.paidDate && new Date(r.dueDate) < new Date();
                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 px-2">
                        <Badge variant={r.type === "INCOME" ? "success" : "destructive"}>
                          {r.type === "INCOME" ? "RECEITA" : "DESPESA"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 font-medium">{r.description}</td>
                      <td className="py-2 px-2 text-slate-700">{r.category}</td>
                      <td className="py-2 px-2 text-slate-700">{r.fraction ? `${r.fraction.tower?.name} ${r.fraction.identifier}` : "—"}</td>
                      <td className="py-2 px-2 text-slate-500">{formatDate(r.dueDate, { hour: undefined, minute: undefined })}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatCurrency(r.amount)}</td>
                      <td className="py-2 px-2 text-right">
                        {r.paidDate ? <Badge variant="success">Pago</Badge> : overdue ? <Badge variant="destructive">Atraso</Badge> : <Badge variant="warning">Pendente</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-400">Sem lançamentos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <NewRecordDialog open={open} onClose={() => setOpen(false)} onCreated={() => {
        qc.invalidateQueries({ queryKey: ["financial-records"] });
        qc.invalidateQueries({ queryKey: ["financial-summary"] });
      }} />
    </div>
  );
}

function NewRecordDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [category, setCategory] = useState("Cota mensal");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidNow, setPaidNow] = useState(false);
  const [fractionId, setFractionId] = useState("");

  const { data: fractions = [] } = useQuery({
    queryKey: ["fractions"],
    queryFn: () => api.get<Fraction[]>("/fractions").then((r) => r.data),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post("/financial/records", {
        type, category, description, amount,
        dueDate: new Date(dueDate).toISOString(),
        paidDate: paidNow ? new Date().toISOString() : null,
        fractionId: fractionId || null,
      }),
    onSuccess: () => {
      toast.success("Lançamento criado");
      setDescription(""); setAmount(0); setFractionId(""); setPaidNow(false);
      onCreated(); onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="INCOME">Receita</option>
                <option value="EXPENSE">Despesa</option>
              </Select>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} required />
            </div>
          </div>
          <div><Label>Descrição *</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor *</Label><Input type="number" step="0.01" min={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required /></div>
            <div><Label>Vencimento *</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
          </div>
          <div>
            <Label>Fracção (opcional)</Label>
            <Select value={fractionId} onChange={(e) => setFractionId(e.target.value)}>
              <option value="">— Despesa/receita geral —</option>
              {fractions.map((f) => <option key={f.id} value={f.id}>{f.tower?.name} {f.identifier}</option>)}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />
            Marcar como pago agora
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

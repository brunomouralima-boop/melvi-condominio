import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, TrendingUp, TrendingDown, AlertCircle, Layers, CheckCircle2, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { FractionStatementDrawer } from "@/components/financial/FractionStatementDrawer";
import type { Fraction, Tower } from "@/types";
import toast from "react-hot-toast";

interface FinRecord {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  amount: string | number;
  dueDate: string;
  paidDate?: string | null;
  competence?: string | null;
  fraction?: { id: string; identifier: string; tower?: { name: string } } | null;
}

interface Summary {
  monthIncome: number;
  monthExpenses: number;
  overdueCount: number;
  totalOpen: number;
  overdueAmount: number;
  unitsInArrears: number;
  unitsCount: number;
  delinquencyRate: number;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function AdminFinancial() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [statementFor, setStatementFor] = useState<{ id: string; label: string } | null>(null);

  const { data: records = [] } = useQuery({
    queryKey: ["financial-records"],
    queryFn: () => api.get<FinRecord[]>("/financial/records").then((r) => r.data),
  });
  const { data: summary } = useQuery({
    queryKey: ["financial-summary"],
    queryFn: () => api.get<Summary>("/financial/summary").then((r) => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["financial-records"] });
    qc.invalidateQueries({ queryKey: ["financial-summary"] });
    qc.invalidateQueries({ queryKey: ["delinquency"] });
  };

  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/financial/records/${id}/pay`, {}),
    onSuccess: () => { toast.success("Marcado como pago"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Financeiro</h1>
          <p className="text-slate-500">Receitas, despesas e cobranças</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBatchOpen(true)}>
            <Layers className="h-4 w-4" /> Gerar em lote
          </Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo lançamento</Button>
        </div>
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
              <div className="text-2xl font-bold font-display text-brand-900">{formatCurrency(summary?.overdueAmount ?? 0)}</div>
              <div className="text-xs text-slate-500">{summary?.overdueCount ?? 0} cotas em atraso</div>
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
                  <th className="text-right py-2 px-2">Ações</th>
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
                      <td className="py-2 px-2 text-slate-700">{r.fraction ? `${r.fraction.tower?.name ?? ""} ${r.fraction.identifier}` : "—"}</td>
                      <td className="py-2 px-2 text-slate-500">{formatDate(r.dueDate, { hour: undefined, minute: undefined })}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatCurrency(r.amount)}</td>
                      <td className="py-2 px-2 text-right">
                        {r.paidDate ? <Badge variant="success">Pago</Badge> : overdue ? <Badge variant="destructive">Atraso</Badge> : <Badge variant="warning">Pendente</Badge>}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex justify-end gap-1">
                          {r.type === "INCOME" && !r.paidDate && (
                            <Button size="sm" variant="outline" disabled={pay.isPending} onClick={() => pay.mutate(r.id)}>
                              <CheckCircle2 className="h-4 w-4" /> Pagar
                            </Button>
                          )}
                          {r.fraction && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Ver extrato da fracção"
                              onClick={() => setStatementFor({ id: r.fraction!.id, label: `${r.fraction!.tower?.name ?? ""} ${r.fraction!.identifier}` })}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr><td colSpan={8} className="py-6 text-center text-slate-400">Sem lançamentos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <NewRecordDialog open={open} onClose={() => setOpen(false)} onCreated={invalidate} />
      <BatchChargeDialog open={batchOpen} onClose={() => setBatchOpen(false)} onCreated={invalidate} />
      <FractionStatementDrawer
        open={!!statementFor}
        fractionId={statementFor?.id ?? null}
        fractionLabel={statementFor?.label}
        onClose={() => setStatementFor(null)}
        canManage
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Novo lançamento manual
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Gerar cobranças em lote
// ---------------------------------------------------------------------------
type Mode = "FIXED" | "PERMILLAGE" | "AREA";

function BatchChargeDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const defaultDue = new Date();
  defaultDue.setDate(10);
  const [mode, setMode] = useState<Mode>("FIXED");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("Cota de Condomínio");
  const [description, setDescription] = useState("");
  const [competence, setCompetence] = useState(thisMonth);
  const [dueDate, setDueDate] = useState(defaultDue.toISOString().slice(0, 10));
  const [towerId, setTowerId] = useState("");
  const [markPaid, setMarkPaid] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);

  const { data: fractions = [] } = useQuery({
    queryKey: ["fractions"],
    queryFn: () => api.get<Fraction[]>("/fractions").then((r) => r.data),
    enabled: open,
  });
  const { data: towers = [] } = useQuery({
    queryKey: ["towers"],
    queryFn: () => api.get<Tower[]>("/towers").then((r) => r.data),
    enabled: open,
  });

  // Pré-visualização do rateio (replica a lógica do backend)
  const preview = useMemo(() => {
    const target = fractions
      .filter((f) => f.isActive && (!towerId || f.towerId === towerId))
      .sort((a, b) => (a.towerId === b.towerId ? a.identifier.localeCompare(b.identifier) : a.towerId.localeCompare(b.towerId)));

    const weightOf = (f: Fraction) => Number(mode === "AREA" ? f.areaM2 : f.permillage);

    let rows: { f: Fraction; weight: number; amount: number }[] = [];
    if (mode === "FIXED") {
      rows = target.map((f) => ({ f, weight: weightOf(f), amount: round2(amount) }));
    } else {
      const total = target.reduce((s, f) => s + weightOf(f), 0);
      let allocated = 0;
      rows = target.map((f, i) => {
        let v: number;
        if (total <= 0) v = 0;
        else if (i === target.length - 1) v = round2(amount - allocated);
        else { v = round2((amount * weightOf(f)) / total); allocated = round2(allocated + v); }
        return { f, weight: weightOf(f), amount: v };
      });
    }
    const totalAmount = round2(rows.reduce((s, r) => s + r.amount, 0));
    return { rows, totalAmount, count: rows.length };
  }, [fractions, towerId, mode, amount]);

  const generate = useMutation({
    mutationFn: () =>
      api.post("/financial/charges/batch", {
        mode, amount, category,
        description: description || null,
        competence,
        dueDate: new Date(dueDate).toISOString(),
        towerId: towerId || null,
        markPaid, skipExisting,
      }),
    onSuccess: (res) => {
      const d = res.data as { created: number; skipped: number; totalAmount: number };
      toast.success(`${d.created} cobranças geradas${d.skipped ? ` · ${d.skipped} ignoradas` : ""}`);
      onCreated(); onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao gerar"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Gerar cobranças em lote</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); generate.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Critério</Label>
              <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="FIXED">Valor fixo por fracção</option>
                <option value="PERMILLAGE">Ratear por permilagem</option>
                <option value="AREA">Ratear por área (m²)</option>
              </Select>
            </div>
            <div>
              <Label>{mode === "FIXED" ? "Valor por fracção *" : "Valor total a ratear *"}</Label>
              <Input type="number" step="0.01" min={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Categoria *</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} required /></div>
            <div>
              <Label>Torre</Label>
              <Select value={towerId} onChange={(e) => setTowerId(e.target.value)}>
                <option value="">Todas as torres</option>
                {towers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label>Competência *</Label><Input type="month" value={competence} onChange={(e) => setCompetence(e.target.value)} required /></div>
            <div><Label>Vencimento *</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
            <div><Label>Descrição</Label><Input placeholder={category} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
              Ignorar frações já cobradas nesta competência
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} />
              Marcar como pagas
            </label>
          </div>

          {/* Pré-visualização */}
          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-brand-900">
                Pré-visualização · {preview.count} {preview.count === 1 ? "fracção" : "frações"}
              </span>
              <span className="font-mono font-semibold text-emerald-700">Total: {formatCurrency(preview.totalAmount)}</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="text-left py-1.5 px-3">Fracção</th>
                    <th className="text-right py-1.5 px-3">{mode === "AREA" ? "Área m²" : "Permilagem"}</th>
                    <th className="text-right py-1.5 px-3">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map(({ f, weight, amount }) => (
                    <tr key={f.id} className="border-t border-slate-100">
                      <td className="py-1.5 px-3">{f.tower?.name ?? ""} {f.identifier}</td>
                      <td className="py-1.5 px-3 text-right text-slate-500">{mode === "FIXED" ? "—" : weight}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{formatCurrency(amount)}</td>
                    </tr>
                  ))}
                  {preview.count === 0 && (
                    <tr><td colSpan={3} className="py-3 text-center text-slate-400">Sem frações activas para o critério.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={generate.isPending || preview.count === 0 || amount <= 0}>
              {generate.isPending ? "A gerar…" : `Gerar ${preview.count} cobranças`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

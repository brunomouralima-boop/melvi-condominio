import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useAccounts, useCategories, useMembers } from "../lib/queries";
import { formatDate, formatMoney, todayInput } from "../lib/format";
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea } from "../components/ui";
import type { Transaction, TxType } from "../lib/types";

const TYPE_META: Record<TxType, { label: string; color: string; icon: React.ReactNode }> = {
  INCOME: { label: "Receita", color: "#16a34a", icon: <ArrowDownLeft className="h-4 w-4" /> },
  EXPENSE: { label: "Despesa", color: "#dc2626", icon: <ArrowUpRight className="h-4 w-4" /> },
  TRANSFER: { label: "Transferência", color: "#2563eb", icon: <ArrowLeftRight className="h-4 w-4" /> },
};

interface FormState {
  id?: string;
  date: string;
  type: TxType;
  amount: string;
  currencyCode: string;
  accountId: string;
  toAccountId: string;
  toAmount: string;
  categoryId: string;
  memberId: string;
  description: string;
}

const empty = (): FormState => ({
  date: todayInput(), type: "EXPENSE", amount: "", currencyCode: "AOA",
  accountId: "", toAccountId: "", toAmount: "", categoryId: "", memberId: "", description: "",
});

export default function Transactions() {
  const qc = useQueryClient();
  const accounts = useAccounts();
  const categories = useCategories();
  const members = useMembers();

  const [filters, setFilters] = useState({ type: "", accountId: "", memberId: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty());

  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.accountId) params.set("accountId", filters.accountId);
  if (filters.memberId) params.set("memberId", filters.memberId);

  const txQuery = useQuery({
    queryKey: ["transactions", filters],
    queryFn: async () => (await api.get<{ items: Transaction[]; total: number }>(`/transactions?${params}`)).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["networth"] });
    qc.invalidateQueries({ queryKey: ["cashflow"] });
    qc.invalidateQueries({ queryKey: ["monthly"] });
  };

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const account = accounts.data?.find((a) => a.id === f.accountId);
      const payload: Record<string, unknown> = {
        date: f.date,
        type: f.type,
        amount: Number(f.amount),
        currencyCode: account?.currencyCode ?? f.currencyCode,
        accountId: f.accountId,
        memberId: f.memberId,
        description: f.description,
        categoryId: f.type === "TRANSFER" ? null : f.categoryId,
        toAccountId: f.type === "TRANSFER" ? f.toAccountId : null,
        toAmount: f.type === "TRANSFER" && f.toAmount ? Number(f.toAmount) : null,
        toCurrencyCode: f.type === "TRANSFER" ? accounts.data?.find((a) => a.id === f.toAccountId)?.currencyCode : null,
      };
      if (f.id) await api.put(`/transactions/${f.id}`, payload);
      else await api.post("/transactions", payload);
    },
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      toast.success("Lançamento guardado");
    },
    onError: () => toast.error("Erro ao guardar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => { invalidate(); toast.success("Lançamento eliminado"); },
  });

  const openNew = () => {
    const f = empty();
    f.accountId = accounts.data?.[0]?.id ?? "";
    f.memberId = members.data?.[0]?.id ?? "";
    f.categoryId = categories.data?.find((c) => c.kind === "EXPENSE")?.id ?? "";
    setForm(f);
    setModalOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setForm({
      id: t.id, date: t.date.slice(0, 10), type: t.type, amount: String(t.amount),
      currencyCode: t.currencyCode, accountId: t.accountId, toAccountId: t.toAccountId ?? "",
      toAmount: t.toAmount ? String(t.toAmount) : "", categoryId: t.categoryId ?? "",
      memberId: t.memberId, description: t.description,
    });
    setModalOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.accountId || !form.amount || !form.memberId) return toast.error("Preencha os campos obrigatórios");
    if (form.type !== "TRANSFER" && !form.categoryId) return toast.error("Escolha uma categoria");
    if (form.type === "TRANSFER" && !form.toAccountId) return toast.error("Escolha a conta de destino");
    save.mutate(form);
  };

  const filteredCategories = categories.data?.filter((c) => c.kind === (form.type === "INCOME" ? "INCOME" : "EXPENSE")) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Lançamentos</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo lançamento</Button>
      </div>

      <Card className="flex flex-wrap gap-3">
        <Select className="w-auto" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Todos os tipos</option>
          <option value="INCOME">Receitas</option>
          <option value="EXPENSE">Despesas</option>
          <option value="TRANSFER">Transferências</option>
        </Select>
        <Select className="w-auto" value={filters.accountId} onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}>
          <option value="">Todas as contas</option>
          {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select className="w-auto" value={filters.memberId} onChange={(e) => setFilters({ ...filters, memberId: e.target.value })}>
          <option value="">Todos os titulares</option>
          {members.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Titular</th>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {txQuery.data?.items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sem lançamentos.</td></tr>
            )}
            {txQuery.data?.items.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(t.date)}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span style={{ color: TYPE_META[t.type].color }}>{TYPE_META[t.type].icon}</span>
                    {t.description || TYPE_META[t.type].label}
                  </span>
                  {t.type === "TRANSFER" && t.toAccount && (
                    <span className="text-xs text-slate-400">→ {t.toAccount.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">{t.category ? <Badge color={t.category.color}>{t.category.name}</Badge> : "—"}</td>
                <td className="px-4 py-3 text-slate-600">{t.member.name}</td>
                <td className="px-4 py-3 text-slate-600">{t.account.name}</td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: TYPE_META[t.type].color }}>
                  {t.type === "EXPENSE" ? "-" : t.type === "INCOME" ? "+" : ""}{formatMoney(t.amount, t.currencyCode)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(t)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => del.mutate(t.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Editar lançamento" : "Novo lançamento"}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["EXPENSE", "INCOME", "TRANSFER"] as TxType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, type: t, categoryId: t === "TRANSFER" ? "" : form.categoryId })}
                className={`rounded-lg border py-2 text-sm font-medium ${form.type === t ? "border-brand bg-brand/10 text-brand" : "border-slate-300 text-slate-600"}`}
              >
                {TYPE_META[t].label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Valor"><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          </div>
          <Field label={form.type === "TRANSFER" ? "Conta de origem" : "Conta"}>
            <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">—</option>
              {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
            </Select>
          </Field>

          {form.type === "TRANSFER" ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Conta de destino">
                <Select value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}>
                  <option value="">—</option>
                  {accounts.data?.filter((a) => a.id !== form.accountId).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currencyCode})</option>)}
                </Select>
              </Field>
              <Field label="Valor recebido (opcional, se outra moeda)">
                <Input type="number" step="0.01" value={form.toAmount} onChange={(e) => setForm({ ...form, toAmount: e.target.value })} placeholder="igual ao valor" />
              </Field>
            </div>
          ) : (
            <Field label="Categoria">
              <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">—</option>
                {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}

          <Field label="Titular">
            <Select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
              <option value="">—</option>
              {members.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Descrição"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "A guardar…" : "Guardar"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

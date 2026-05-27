import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Archive } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useAccounts, useCurrencies, useMembers } from "../lib/queries";
import { formatMoney } from "../lib/format";
import { Badge, Button, Card, Field, Input, Modal, Select } from "../components/ui";
import type { Account, AccountType } from "../lib/types";

const TYPE_LABEL: Record<AccountType, string> = {
  CHECKING: "Conta à ordem", SAVINGS: "Poupança", CASH: "Dinheiro", INVESTMENT: "Investimento", WALLET: "Carteira",
};

interface FormState {
  id?: string;
  name: string; institution: string; type: AccountType; currencyCode: string;
  memberId: string; openingBalance: string; archived: boolean;
}

const empty = (): FormState => ({
  name: "", institution: "", type: "CHECKING", currencyCode: "AOA", memberId: "", openingBalance: "0", archived: false,
});

export default function Accounts() {
  const qc = useQueryClient();
  const accounts = useAccounts();
  const currencies = useCurrencies();
  const members = useMembers();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["networth"] });
  };

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        name: f.name, institution: f.institution, type: f.type, currencyCode: f.currencyCode,
        memberId: f.memberId, openingBalance: Number(f.openingBalance), archived: f.archived,
      };
      if (f.id) await api.put(`/accounts/${f.id}`, payload);
      else await api.post("/accounts", payload);
    },
    onSuccess: () => { invalidate(); setOpen(false); toast.success("Conta guardada"); },
    onError: () => toast.error("Erro ao guardar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => { invalidate(); toast.success("Conta eliminada"); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error ?? "Erro"),
  });

  const openNew = () => {
    const f = empty();
    f.memberId = members.data?.[0]?.id ?? "";
    setForm(f);
    setOpen(true);
  };
  const openEdit = (a: Account) => {
    setForm({ id: a.id, name: a.name, institution: a.institution, type: a.type, currencyCode: a.currencyCode, memberId: a.memberId, openingBalance: String(a.openingBalance), archived: a.archived });
    setOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.memberId) return toast.error("Preencha nome e titular");
    save.mutate(form);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contas</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova conta</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.data?.map((a) => (
          <Card key={a.id} className={a.archived ? "opacity-60" : ""}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-slate-400">{a.institution || "—"}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(a)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => del.mutate(a.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold">{formatMoney(a.balance, a.currencyCode)}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge color={a.member.color}>{a.member.name}</Badge>
              <Badge>{TYPE_LABEL[a.type]}</Badge>
              <Badge>{a.currencyCode}</Badge>
              {a.archived && <Badge color="#92400e"><Archive className="mr-1 inline h-3 w-3" />Arquivada</Badge>}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Editar conta" : "Nova conta"}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Instituição / Banco"><Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Moeda">
              <Select value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
                {currencies.data?.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Titular">
              <Select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
                {members.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Saldo inicial"><Input type="number" step="0.01" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.archived} onChange={(e) => setForm({ ...form, archived: e.target.checked })} /> Arquivada
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

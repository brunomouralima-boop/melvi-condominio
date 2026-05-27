import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useCurrencies, useMembers } from "../lib/queries";
import { Badge, Button, Card, Field, Input, Modal, Select } from "../components/ui";

export default function Definicoes() {
  const qc = useQueryClient();
  const currencies = useCurrencies();
  const members = useMembers();

  const [rates, setRates] = useState<Record<string, string>>({});
  const [curModal, setCurModal] = useState(false);
  const [memModal, setMemModal] = useState(false);
  const [curForm, setCurForm] = useState({ code: "", name: "", symbol: "", rateToBase: "1" });
  const [memForm, setMemForm] = useState({ name: "", kind: "PERSON", color: "#2563eb" });

  const saveRate = useMutation({
    mutationFn: async ({ code, rateToBase }: { code: string; rateToBase: number }) =>
      api.put(`/currencies/${code}/rate`, { rateToBase }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["currencies"] }); qc.invalidateQueries({ queryKey: ["networth"] }); toast.success("Taxa atualizada"); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const saveCurrency = useMutation({
    mutationFn: async (f: typeof curForm) => api.post("/currencies", { code: f.code, name: f.name, symbol: f.symbol, rateToBase: Number(f.rateToBase) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["currencies"] }); setCurModal(false); toast.success("Moeda guardada"); },
    onError: () => toast.error("Erro ao guardar"),
  });

  const saveMember = useMutation({
    mutationFn: async (f: typeof memForm) => api.post("/members", f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); setMemModal(false); toast.success("Titular guardado"); },
    onError: () => toast.error("Erro ao guardar"),
  });

  const submitCurrency = (e: FormEvent) => { e.preventDefault(); if (!curForm.code || !curForm.name) return toast.error("Preencha código e nome"); saveCurrency.mutate(curForm); };
  const submitMember = (e: FormEvent) => { e.preventDefault(); if (!memForm.name) return toast.error("Indique o nome"); saveMember.mutate(memForm); };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Definições</h1>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Moedas e taxas de câmbio</h2>
            <p className="text-sm text-slate-500">Valor de 1 unidade em Kwanza (AOA). A base é AOA = 1.</p>
          </div>
          <Button variant="secondary" onClick={() => { setCurForm({ code: "", name: "", symbol: "", rateToBase: "1" }); setCurModal(true); }}>
            <Plus className="h-4 w-4" /> Moeda
          </Button>
        </div>
        <div className="space-y-2">
          {currencies.data?.map((c) => (
            <div key={c.code} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 p-3">
              <div className="w-28">
                <span className="font-semibold">{c.code}</span> {c.isBase && <Badge color="#2563eb">base</Badge>}
                <div className="text-xs text-slate-400">{c.name}</div>
              </div>
              {!c.isBase && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">1 {c.code} =</span>
                  <Input
                    type="number" step="0.0001" className="w-32"
                    value={rates[c.code] ?? String(c.rateToBase)}
                    onChange={(e) => setRates({ ...rates, [c.code]: e.target.value })}
                  />
                  <span className="text-sm text-slate-500">AOA</span>
                  <Button variant="secondary" onClick={() => saveRate.mutate({ code: c.code, rateToBase: Number(rates[c.code] ?? c.rateToBase) })}>
                    Atualizar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Titulares</h2>
            <p className="text-sm text-slate-500">Cônjuges e a entidade "Conjunto" (casal) para consolidação.</p>
          </div>
          <Button variant="secondary" onClick={() => { setMemForm({ name: "", kind: "PERSON", color: "#2563eb" }); setMemModal(true); }}>
            <Plus className="h-4 w-4" /> Titular
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.data?.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ background: m.color }} />
              {m.name}
              <Badge>{m.kind === "JOINT" ? "Conjunto" : "Pessoa"}</Badge>
            </span>
          ))}
        </div>
      </Card>

      <Modal open={curModal} onClose={() => setCurModal(false)} title="Nova moeda">
        <form onSubmit={submitCurrency} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código (ex: GBP)"><Input value={curForm.code} onChange={(e) => setCurForm({ ...curForm, code: e.target.value.toUpperCase() })} maxLength={5} /></Field>
            <Field label="Símbolo"><Input value={curForm.symbol} onChange={(e) => setCurForm({ ...curForm, symbol: e.target.value })} /></Field>
          </div>
          <Field label="Nome"><Input value={curForm.name} onChange={(e) => setCurForm({ ...curForm, name: e.target.value })} /></Field>
          <Field label="1 unidade = X AOA"><Input type="number" step="0.0001" value={curForm.rateToBase} onChange={(e) => setCurForm({ ...curForm, rateToBase: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCurModal(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={memModal} onClose={() => setMemModal(false)} title="Novo titular">
        <form onSubmit={submitMember} className="space-y-4">
          <Field label="Nome"><Input value={memForm.name} onChange={(e) => setMemForm({ ...memForm, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select value={memForm.kind} onChange={(e) => setMemForm({ ...memForm, kind: e.target.value })}>
                <option value="PERSON">Pessoa</option>
                <option value="JOINT">Conjunto</option>
              </Select>
            </Field>
            <Field label="Cor"><Input type="color" value={memForm.color} onChange={(e) => setMemForm({ ...memForm, color: e.target.value })} className="h-10 p-1" /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMemModal(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

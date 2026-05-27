import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Home, Car, LineChart, Package, Landmark } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useAssets, useCurrencies, useLiabilities, useMembers } from "../lib/queries";
import { formatMoney } from "../lib/format";
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea } from "../components/ui";
import type { Asset, AssetType, Liability, LiabilityType, NetWorth } from "../lib/types";

const ASSET_META: Record<AssetType, { label: string; icon: React.ReactNode }> = {
  PROPERTY: { label: "Imóvel", icon: <Home className="h-4 w-4" /> },
  VEHICLE: { label: "Viatura", icon: <Car className="h-4 w-4" /> },
  INVESTMENT: { label: "Investimento", icon: <LineChart className="h-4 w-4" /> },
  OTHER: { label: "Outro", icon: <Package className="h-4 w-4" /> },
};
const LIAB_LABEL: Record<LiabilityType, string> = {
  MORTGAGE: "Crédito habitação", LOAN: "Empréstimo", CREDIT: "Cartão de crédito", OTHER: "Outro",
};

interface AssetForm { id?: string; name: string; type: AssetType; memberId: string; currencyCode: string; value: string; notes: string }
interface LiabForm { id?: string; name: string; type: LiabilityType; memberId: string; currencyCode: string; outstandingBalance: string; linkedAssetId: string; notes: string }

export default function Patrimonio() {
  const qc = useQueryClient();
  const assets = useAssets();
  const liabilities = useLiabilities();
  const currencies = useCurrencies();
  const members = useMembers();
  const nw = useQuery({ queryKey: ["networth"], queryFn: async () => (await api.get<NetWorth>("/reports/networth")).data });

  const [assetModal, setAssetModal] = useState(false);
  const [liabModal, setLiabModal] = useState(false);
  const [assetForm, setAssetForm] = useState<AssetForm>({ name: "", type: "PROPERTY", memberId: "", currencyCode: "AOA", value: "0", notes: "" });
  const [liabForm, setLiabForm] = useState<LiabForm>({ name: "", type: "MORTGAGE", memberId: "", currencyCode: "AOA", outstandingBalance: "0", linkedAssetId: "", notes: "" });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["liabilities"] });
    qc.invalidateQueries({ queryKey: ["networth"] });
  };

  const saveAsset = useMutation({
    mutationFn: async (f: AssetForm) => {
      const payload = { name: f.name, type: f.type, memberId: f.memberId, currencyCode: f.currencyCode, value: Number(f.value), notes: f.notes };
      if (f.id) await api.put(`/assets/${f.id}`, payload); else await api.post("/assets", payload);
    },
    onSuccess: () => { invalidate(); setAssetModal(false); toast.success("Ativo guardado"); },
    onError: () => toast.error("Erro ao guardar"),
  });
  const delAsset = useMutation({ mutationFn: async (id: string) => api.delete(`/assets/${id}`), onSuccess: () => { invalidate(); toast.success("Ativo eliminado"); } });

  const saveLiab = useMutation({
    mutationFn: async (f: LiabForm) => {
      const payload = { name: f.name, type: f.type, memberId: f.memberId, currencyCode: f.currencyCode, outstandingBalance: Number(f.outstandingBalance), linkedAssetId: f.linkedAssetId || null, notes: f.notes };
      if (f.id) await api.put(`/liabilities/${f.id}`, payload); else await api.post("/liabilities", payload);
    },
    onSuccess: () => { invalidate(); setLiabModal(false); toast.success("Passivo guardado"); },
    onError: () => toast.error("Erro ao guardar"),
  });
  const delLiab = useMutation({ mutationFn: async (id: string) => api.delete(`/liabilities/${id}`), onSuccess: () => { invalidate(); toast.success("Passivo eliminado"); } });

  const openNewAsset = () => { setAssetForm({ name: "", type: "PROPERTY", memberId: members.data?.[0]?.id ?? "", currencyCode: "AOA", value: "0", notes: "" }); setAssetModal(true); };
  const openEditAsset = (a: Asset) => { setAssetForm({ id: a.id, name: a.name, type: a.type, memberId: a.memberId, currencyCode: a.currencyCode, value: String(a.value), notes: a.notes }); setAssetModal(true); };
  const openNewLiab = () => { setLiabForm({ name: "", type: "MORTGAGE", memberId: members.data?.[0]?.id ?? "", currencyCode: "AOA", outstandingBalance: "0", linkedAssetId: "", notes: "" }); setLiabModal(true); };
  const openEditLiab = (l: Liability) => { setLiabForm({ id: l.id, name: l.name, type: l.type, memberId: l.memberId, currencyCode: l.currencyCode, outstandingBalance: String(l.outstandingBalance), linkedAssetId: l.linkedAssetId ?? "", notes: l.notes }); setLiabModal(true); };

  const submitAsset = (e: FormEvent) => { e.preventDefault(); if (!assetForm.name || !assetForm.memberId) return toast.error("Preencha nome e titular"); saveAsset.mutate(assetForm); };
  const submitLiab = (e: FormEvent) => { e.preventDefault(); if (!liabForm.name || !liabForm.memberId) return toast.error("Preencha nome e titular"); saveLiab.mutate(liabForm); };

  const t = nw.data?.totals;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Património</h1>

      {t && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card><div className="text-sm text-slate-500">Total de ativos</div><div className="text-2xl font-bold text-emerald-600">{formatMoney(t.totalAssets)}</div></Card>
          <Card><div className="text-sm text-slate-500">Total de passivos</div><div className="text-2xl font-bold text-red-600">{formatMoney(t.liabilities)}</div></Card>
          <Card className="bg-slate-900 text-white"><div className="flex items-center gap-2 text-sm text-slate-300"><Landmark className="h-4 w-4" /> Património líquido</div><div className="text-2xl font-bold">{formatMoney(t.netWorth)}</div></Card>
        </div>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Ativos</h2>
          <Button onClick={openNewAsset}><Plus className="h-4 w-4" /> Novo ativo</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {assets.data?.map((a) => {
            const debt = a.liabilities.reduce((s, l) => s + l.outstandingBalance, 0);
            return (
              <div key={a.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <span className="flex items-center gap-2 font-medium">{ASSET_META[a.type].icon}{a.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => openEditAsset(a)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => delAsset.mutate(a.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-2 text-xl font-bold">{formatMoney(a.value, a.currencyCode)}</div>
                {debt > 0 && (
                  <div className="mt-1 text-sm text-slate-500">
                    − dívida {formatMoney(debt, a.currencyCode)} = <span className="font-semibold text-slate-700">{formatMoney(a.value - debt, a.currencyCode)} líquido</span>
                  </div>
                )}
                <div className="mt-2 flex gap-2"><Badge color={a.member.color}>{a.member.name}</Badge><Badge>{ASSET_META[a.type].label}</Badge></div>
              </div>
            );
          })}
          {assets.data?.length === 0 && <p className="text-sm text-slate-400">Sem ativos registados.</p>}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Passivos</h2>
          <Button onClick={openNewLiab}><Plus className="h-4 w-4" /> Novo passivo</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {liabilities.data?.map((l) => (
            <div key={l.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <span className="font-medium">{l.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => openEditLiab(l)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => delLiab.mutate(l.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-red-600">{formatMoney(l.outstandingBalance, l.currencyCode)}</div>
              {l.linkedAsset && <div className="mt-1 text-sm text-slate-500">ligado a {l.linkedAsset.name}</div>}
              <div className="mt-2 flex gap-2"><Badge color={l.member.color}>{l.member.name}</Badge><Badge>{LIAB_LABEL[l.type]}</Badge></div>
            </div>
          ))}
          {liabilities.data?.length === 0 && <p className="text-sm text-slate-400">Sem passivos registados.</p>}
        </div>
      </Card>

      <Modal open={assetModal} onClose={() => setAssetModal(false)} title={assetForm.id ? "Editar ativo" : "Novo ativo"}>
        <form onSubmit={submitAsset} className="space-y-4">
          <Field label="Nome"><Input value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select value={assetForm.type} onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value as AssetType })}>
                {Object.entries(ASSET_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
            <Field label="Titular">
              <Select value={assetForm.memberId} onChange={(e) => setAssetForm({ ...assetForm, memberId: e.target.value })}>
                {members.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (avaliado)"><Input type="number" step="0.01" value={assetForm.value} onChange={(e) => setAssetForm({ ...assetForm, value: e.target.value })} /></Field>
            <Field label="Moeda">
              <Select value={assetForm.currencyCode} onChange={(e) => setAssetForm({ ...assetForm, currencyCode: e.target.value })}>
                {currencies.data?.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Notas"><Textarea rows={2} value={assetForm.notes} onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAssetModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveAsset.isPending}>Guardar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={liabModal} onClose={() => setLiabModal(false)} title={liabForm.id ? "Editar passivo" : "Novo passivo"}>
        <form onSubmit={submitLiab} className="space-y-4">
          <Field label="Nome"><Input value={liabForm.name} onChange={(e) => setLiabForm({ ...liabForm, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select value={liabForm.type} onChange={(e) => setLiabForm({ ...liabForm, type: e.target.value as LiabilityType })}>
                {Object.entries(LIAB_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Titular">
              <Select value={liabForm.memberId} onChange={(e) => setLiabForm({ ...liabForm, memberId: e.target.value })}>
                {members.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Saldo devedor"><Input type="number" step="0.01" value={liabForm.outstandingBalance} onChange={(e) => setLiabForm({ ...liabForm, outstandingBalance: e.target.value })} /></Field>
            <Field label="Moeda">
              <Select value={liabForm.currencyCode} onChange={(e) => setLiabForm({ ...liabForm, currencyCode: e.target.value })}>
                {currencies.data?.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Ligado ao ativo (opcional)">
            <Select value={liabForm.linkedAssetId} onChange={(e) => setLiabForm({ ...liabForm, linkedAssetId: e.target.value })}>
              <option value="">— nenhum —</option>
              {assets.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Notas"><Textarea rows={2} value={liabForm.notes} onChange={(e) => setLiabForm({ ...liabForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setLiabModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveLiab.isPending}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

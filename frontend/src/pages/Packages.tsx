import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Package as PackageIcon, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { Fraction } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

interface PackageItem {
  id: string;
  description: string;
  sender: string;
  status: "PENDING" | "DELIVERED";
  receivedAt: string;
  deliveredAt?: string | null;
  fraction?: { identifier: string; tower?: { name: string } };
  receivedBy?: { id: string; name: string };
}

export function PackagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const canRegister = user?.role === "DOORMAN" || user?.role === "ADMIN";

  const { data: items = [] } = useQuery({
    queryKey: ["packages"],
    queryFn: () => api.get<PackageItem[]>("/packages").then((r) => r.data),
  });

  const deliver = useMutation({
    mutationFn: (id: string) => api.put(`/packages/${id}/deliver`),
    onSuccess: () => {
      toast.success("Encomenda marcada como entregue");
      qc.invalidateQueries({ queryKey: ["packages"] });
    },
  });

  const pending = items.filter((p) => p.status === "PENDING");
  const delivered = items.filter((p) => p.status === "DELIVERED");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Encomendas</h1>
          <p className="text-slate-500">Registo e histórico de encomendas</p>
        </div>
        {canRegister && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Registar encomenda
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Por entregar ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 && <div className="text-sm text-slate-500">Nada por entregar.</div>}
          {pending.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <PackageIcon className="h-5 w-5 text-coral-500" />
                <div>
                  <div className="font-medium text-brand-900">{p.description}</div>
                  <div className="text-xs text-slate-500">
                    De {p.sender} · {p.fraction?.tower?.name} {p.fraction?.identifier} · {formatDate(p.receivedAt)}
                  </div>
                </div>
              </div>
              {canRegister && (
                <Button size="sm" variant="outline" onClick={() => deliver.mutate(p.id)}>
                  <CheckCircle2 className="h-4 w-4" /> Marcar entregue
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entregues ({delivered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="text-left py-2">Descrição</th>
                <th className="text-left py-2">Remetente</th>
                <th className="text-left py-2">Fracção</th>
                <th className="text-left py-2">Recebida</th>
                <th className="text-left py-2">Entregue</th>
              </tr>
            </thead>
            <tbody>
              {delivered.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2">{p.description}</td>
                  <td className="py-2 text-slate-700">{p.sender}</td>
                  <td className="py-2 text-slate-700">{p.fraction?.tower?.name} {p.fraction?.identifier}</td>
                  <td className="py-2 text-slate-500">{formatDate(p.receivedAt)}</td>
                  <td className="py-2 text-slate-500">{p.deliveredAt && formatDate(p.deliveredAt)}</td>
                </tr>
              ))}
              {delivered.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-slate-400">Sem entregas.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {canRegister && <NewPackageDialog open={open} onClose={() => setOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["packages"] })} />}
    </div>
  );
}

function NewPackageDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [description, setDescription] = useState("");
  const [sender, setSender] = useState("");
  const [fractionId, setFractionId] = useState("");

  const { data: fractions = [] } = useQuery({
    queryKey: ["fractions"],
    queryFn: () => api.get<Fraction[]>("/fractions").then((r) => r.data),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () => api.post("/packages", { description, sender, fractionId }),
    onSuccess: () => {
      toast.success("Encomenda registada");
      setDescription(""); setSender(""); setFractionId("");
      onCreated(); onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registar encomenda</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div><Label>Descrição *</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Caixa, envelope…" /></div>
          <div><Label>Remetente *</Label><Input value={sender} onChange={(e) => setSender(e.target.value)} required placeholder="Empresa ou pessoa" /></div>
          <div>
            <Label>Fracção *</Label>
            <Select value={fractionId} onChange={(e) => setFractionId(e.target.value)} required>
              <option value="">— selecionar —</option>
              {fractions.map((f) => <option key={f.id} value={f.id}>{f.tower?.name} {f.identifier}</option>)}
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || !fractionId}>{create.isPending ? "..." : "Registar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

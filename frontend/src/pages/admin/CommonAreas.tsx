import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2, XCircle, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

interface CommonArea { id: string; name: string; description: string; capacity: number; rules?: string | null; isActive: boolean; condominiumId: string }
interface Reservation {
  id: string; date: string; startTime: string; endTime: string; notes?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  commonArea: { name: string };
  user: { id: string; name: string };
  fraction?: { identifier: string; tower?: { name: string } };
}

const STATUS_LABEL: any = { PENDING: "Pendente", APPROVED: "Aprovada", REJECTED: "Rejeitada", CANCELLED: "Cancelada" };
const STATUS_VARIANT: any = { PENDING: "warning", APPROVED: "success", REJECTED: "destructive", CANCELLED: "secondary" };

export function AdminCommonAreas() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);

  const { data: condo } = useQuery({
    queryKey: ["condominium"],
    queryFn: () => api.get("/condominium").then((r) => r.data),
  });
  const { data: areas = [] } = useQuery({
    queryKey: ["common-areas"],
    queryFn: () => api.get<CommonArea[]>("/common-areas").then((r) => r.data),
  });
  const { data: reservations = [] } = useQuery({
    queryKey: ["all-reservations"],
    queryFn: () => api.get<Reservation[]>("/reservations").then((r) => r.data),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/reservations/${id}/status`, { status }),
    onSuccess: () => {
      toast.success("Reserva atualizada");
      qc.invalidateQueries({ queryKey: ["all-reservations"] });
    },
  });

  const pending = reservations.filter((r) => r.status === "PENDING");
  const recent = reservations.filter((r) => r.status !== "PENDING").slice(0, 20);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Áreas Comuns</h1>
          <p className="text-slate-500">Espaços e aprovação de reservas</p>
        </div>
        <Button onClick={() => setOpenNew(true)} disabled={!condo}>
          <Plus className="h-4 w-4" /> Nova área
        </Button>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-brand-900 mb-3">Espaços ({areas.length})</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {areas.map((a) => (
            <Card key={a.id} className={!a.isActive ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  {a.isActive ? <Badge variant="success">Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1"><Users className="h-3 w-3" /> Capacidade {a.capacity}</div>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <p>{a.description}</p>
                {a.rules && <p className="text-xs text-slate-500"><strong>Regras:</strong> {a.rules}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className={pending.length ? "border-coral-200" : ""}>
        <CardHeader>
          <CardTitle>Reservas pendentes de aprovação ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 && <div className="text-sm text-slate-500">Sem reservas pendentes.</div>}
          {pending.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-brand-900">{r.commonArea.name}</div>
                  <div className="text-sm text-slate-700">
                    {r.user.name} ({r.fraction?.tower?.name} {r.fraction?.identifier}) — {formatDate(r.date, { hour: undefined, minute: undefined })} · {r.startTime}–{r.endTime}
                  </div>
                  {r.notes && <div className="text-xs text-slate-500 mt-1">{r.notes}</div>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "APPROVED" })}>
                    <CheckCircle2 className="h-4 w-4" /> Aprovar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: "REJECTED" })}>
                    <XCircle className="h-4 w-4" /> Rejeitar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Histórico recente</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="text-left py-2">Espaço</th>
                <th className="text-left py-2">Residente</th>
                <th className="text-left py-2">Data</th>
                <th className="text-left py-2">Horário</th>
                <th className="text-left py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2">{r.commonArea.name}</td>
                  <td className="py-2 text-slate-700">{r.user.name}</td>
                  <td className="py-2 text-slate-700">{formatDate(r.date, { hour: undefined, minute: undefined })}</td>
                  <td className="py-2 text-slate-700">{r.startTime}–{r.endTime}</td>
                  <td className="py-2"><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-slate-400">Sem histórico.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {condo && (
        <NewAreaDialog open={openNew} onClose={() => setOpenNew(false)} condominiumId={condo.id} onCreated={() => qc.invalidateQueries({ queryKey: ["common-areas"] })} />
      )}
    </div>
  );
}

function NewAreaDialog({ open, onClose, condominiumId, onCreated }: { open: boolean; onClose: () => void; condominiumId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(10);
  const [rules, setRules] = useState("");

  const create = useMutation({
    mutationFn: () => api.post("/common-areas", { name, description, capacity, rules: rules || null, condominiumId }),
    onSuccess: () => {
      toast.success("Área criada");
      setName(""); setDescription(""); setRules(""); setCapacity(10);
      onCreated(); onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova área comum</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><Label>Descrição *</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
          <div><Label>Capacidade *</Label><Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} required /></div>
          <div><Label>Regras</Label><Textarea rows={3} value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Ex.: Reservar com 7 dias de antecedência…" /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

interface CommonArea { id: string; name: string; description: string; capacity: number; rules?: string | null; isActive: boolean }
interface Reservation {
  id: string; date: string; startTime: string; endTime: string; notes?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  commonArea: { name: string };
}

const STATUS_LABEL: Record<string, string> = { PENDING: "Pendente", APPROVED: "Aprovada", REJECTED: "Rejeitada", CANCELLED: "Cancelada" };
const STATUS_VARIANT: any = { PENDING: "warning", APPROVED: "success", REJECTED: "destructive", CANCELLED: "secondary" };

export function ResidentReservations() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: areas = [] } = useQuery({
    queryKey: ["common-areas"],
    queryFn: () => api.get<CommonArea[]>("/common-areas").then((r) => r.data),
  });
  const { data: mine = [] } = useQuery({
    queryKey: ["my-reservations"],
    queryFn: () => api.get<Reservation[]>("/reservations").then((r) => r.data),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.delete(`/reservations/${id}`),
    onSuccess: () => { toast.success("Cancelada"); qc.invalidateQueries({ queryKey: ["my-reservations"] }); },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Reservas</h1>
          <p className="text-slate-500">Reservar áreas comuns do condomínio</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova reserva</Button>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-brand-900 mb-3">Espaços disponíveis</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {areas.filter((a) => a.isActive).map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="text-base">{a.name}</CardTitle>
                <div className="text-xs text-slate-500">Capacidade: {a.capacity} pessoas</div>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <p>{a.description}</p>
                {a.rules && <p className="text-xs text-slate-500"><strong>Regras:</strong> {a.rules}</p>}
              </CardContent>
            </Card>
          ))}
          {areas.length === 0 && <div className="text-sm text-slate-500 col-span-3">Sem áreas disponíveis.</div>}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-brand-900 mb-3">As minhas reservas</h2>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-3 px-4">Espaço</th>
                  <th className="text-left py-3 px-4">Data</th>
                  <th className="text-left py-3 px-4">Horário</th>
                  <th className="text-left py-3 px-4">Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mine.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 px-4 font-medium">{r.commonArea.name}</td>
                    <td className="py-2 px-4">{formatDate(r.date, { hour: undefined, minute: undefined })}</td>
                    <td className="py-2 px-4">{r.startTime} – {r.endTime}</td>
                    <td className="py-2 px-4"><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                    <td className="py-2 px-4 text-right">
                      {(r.status === "PENDING" || r.status === "APPROVED") && (
                        <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}>
                          <Trash2 className="h-4 w-4" /> Cancelar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {mine.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">Sem reservas.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <NewReservationDialog open={open} onClose={() => setOpen(false)} areas={areas.filter((a) => a.isActive)} onCreated={() => qc.invalidateQueries({ queryKey: ["my-reservations"] })} />
    </div>
  );
}

function NewReservationDialog({ open, onClose, areas, onCreated }: { open: boolean; onClose: () => void; areas: CommonArea[]; onCreated: () => void }) {
  const [commonAreaId, setCommonAreaId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => api.post("/reservations", {
      commonAreaId,
      date: new Date(date).toISOString(),
      startTime, endTime,
      notes: notes || null,
    }),
    onSuccess: () => {
      toast.success("Reserva pedida — aguarda aprovação");
      setCommonAreaId(""); setNotes("");
      onCreated(); onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova reserva</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div>
            <Label>Espaço *</Label>
            <Select value={commonAreaId} onChange={(e) => setCommonAreaId(e.target.value)} required>
              <option value="">— selecionar —</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name} (cap. {a.capacity})</option>)}
            </Select>
          </div>
          <div><Label>Data *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início *</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></div>
            <div><Label>Fim *</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></div>
          </div>
          <div><Label>Notas</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ocasião, número de convidados…" /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || !commonAreaId}>{create.isPending ? "..." : "Pedir reserva"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

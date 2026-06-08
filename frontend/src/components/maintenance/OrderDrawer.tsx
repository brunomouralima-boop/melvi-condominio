import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, DrawerTitle, DrawerCloseButton,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { MaintenanceOrder, MaintKind, MaintStatus, MaintPriority, MaintFrequency, Supplier, Tower, Fraction } from "@/types";
import { KIND_LABEL, STATUS_LABEL, PRIORITY_LABEL, FREQUENCY_LABEL } from "./labels";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  order: MaintenanceOrder | null;
  defaultKind?: MaintKind;
  onClose: () => void;
  onSaved: () => void;
}

function toDateInput(v?: string | null) {
  return v ? new Date(v).toISOString().slice(0, 10) : "";
}

export function OrderDrawer({ open, order, defaultKind = "CORRECTIVE", onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<MaintKind>(defaultKind);
  const [priority, setPriority] = useState<MaintPriority>("MEDIUM");
  const [status, setStatus] = useState<MaintStatus>("OPEN");
  const [category, setCategory] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [towerId, setTowerId] = useState("");
  const [fractionId, setFractionId] = useState("");
  const [cost, setCost] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [frequency, setFrequency] = useState<MaintFrequency>("NONE");
  const [nextDueDate, setNextDueDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    if (order) {
      setTitle(order.title);
      setKind(order.kind);
      setPriority(order.priority);
      setStatus(order.status);
      setCategory(order.category ?? "");
      setSupplierId(order.supplierId ?? "");
      setTowerId(order.towerId ?? "");
      setFractionId(order.fractionId ?? "");
      setCost(order.cost != null ? String(order.cost) : "");
      setScheduledDate(toDateInput(order.scheduledDate));
      setFrequency(order.frequency);
      setNextDueDate(toDateInput(order.nextDueDate));
      setDescription(order.description ?? "");
    } else {
      setTitle(""); setKind(defaultKind); setPriority("MEDIUM"); setStatus(defaultKind === "PREVENTIVE" ? "SCHEDULED" : "OPEN");
      setCategory(""); setSupplierId(""); setTowerId(""); setFractionId(""); setCost("");
      setScheduledDate(""); setFrequency(defaultKind === "PREVENTIVE" ? "MONTHLY" : "NONE"); setNextDueDate(""); setDescription("");
    }
  }, [open, order, defaultKind]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", "active"],
    queryFn: () => api.get<Supplier[]>("/maintenance/suppliers?active=true").then((r) => r.data),
    enabled: open,
  });
  const { data: towers = [] } = useQuery({
    queryKey: ["towers"],
    queryFn: () => api.get<Tower[]>("/towers").then((r) => r.data),
    enabled: open,
  });
  const { data: fractions = [] } = useQuery({
    queryKey: ["fractions"],
    queryFn: () => api.get<Fraction[]>("/fractions").then((r) => r.data),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload: any = {
        title,
        kind,
        priority,
        status,
        category: category || null,
        supplierId: supplierId || null,
        towerId: towerId || null,
        fractionId: fractionId || null,
        cost: cost === "" ? null : Number(cost),
        scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        frequency,
        nextDueDate: nextDueDate ? new Date(nextDueDate).toISOString() : null,
        description: description || null,
      };
      return order
        ? api.put(`/maintenance/orders/${order.id}`, payload)
        : api.post("/maintenance/orders", payload);
    },
    onSuccess: () => {
      toast.success(order ? "Ordem atualizada" : "Ordem criada");
      qc.invalidateQueries({ queryKey: ["maintenance-orders"] });
      qc.invalidateQueries({ queryKey: ["maintenance-stats"] });
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  const fractionsForTower = towerId ? fractions.filter((f) => f.towerId === towerId) : fractions;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent size="lg">
        <DrawerHeader>
          <DrawerTitle>{order ? "Editar ordem" : "Nova ordem de manutenção"}</DrawerTitle>
          <DrawerCloseButton />
        </DrawerHeader>
        <form
          className="flex flex-col flex-1 min-h-0"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        >
          <DrawerBody className="space-y-3">
            <div><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={kind} onChange={(e) => setKind(e.target.value as MaintKind)}>
                  {(["CORRECTIVE", "PREVENTIVE"] as MaintKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={priority} onChange={(e) => setPriority(e.target.value as MaintPriority)}>
                  {(["LOW", "MEDIUM", "HIGH", "URGENT"] as MaintPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estado</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value as MaintStatus)}>
                  {(["OPEN", "SCHEDULED", "IN_PROGRESS", "DONE", "CANCELLED"] as MaintStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </Select>
              </div>
              <div><Label>Categoria</Label><Input placeholder="Ex.: Elevadores" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            </div>

            <div>
              <Label>Fornecedor</Label>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— Nenhum —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.category ? ` (${s.category})` : ""}</option>)}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Torre</Label>
                <Select value={towerId} onChange={(e) => { setTowerId(e.target.value); setFractionId(""); }}>
                  <option value="">— Geral —</option>
                  {towers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>Fracção</Label>
                <Select value={fractionId} onChange={(e) => setFractionId(e.target.value)}>
                  <option value="">— Nenhuma —</option>
                  {fractionsForTower.map((f) => <option key={f.id} value={f.id}>{f.tower?.name} {f.identifier}</option>)}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Custo (Kz)</Label><Input type="number" step="0.01" min={0} value={cost} onChange={(e) => setCost(e.target.value)} /></div>
              <div><Label>Data agendada</Label><Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></div>
            </div>

            {kind === "PREVENTIVE" && (
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <Label>Periodicidade</Label>
                  <Select value={frequency} onChange={(e) => setFrequency(e.target.value as MaintFrequency)}>
                    {(["NONE", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"] as MaintFrequency[]).map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
                  </Select>
                </div>
                <div><Label>Próxima data</Label><Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} /></div>
              </div>
            )}

            <div><Label>Descrição</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending || !title}>{save.isPending ? "A guardar…" : "Guardar"}</Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

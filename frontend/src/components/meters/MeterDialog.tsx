import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { MeterType, Tower } from "@/types";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  type: MeterType;
  condominiumId: string;
}

const TYPE_LABEL: Record<MeterType, string> = {
  WATER: "Contador de Água (EPAL)",
  ELECTRICITY: "Contador de Electricidade (ENDE)",
  GENERATOR: "Gerador",
  FUEL: "Depósito de Gasóleo",
};

const DEFAULT_UNIT: Record<MeterType, string> = {
  WATER: "m³",
  ELECTRICITY: "kWh",
  GENERATOR: "horas",
  FUEL: "litros",
};

export function MeterDialog({ open, onClose, type, condominiumId }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [location, setLocation] = useState("");
  const [towerId, setTowerId] = useState("");

  // Generator-only
  const [intervalHours, setIntervalHours] = useState<string>("250");
  const [lastMaintHours, setLastMaintHours] = useState<string>("0");
  const [lastMaintDate, setLastMaintDate] = useState<string>("");
  const [genNotes, setGenNotes] = useState("");

  // Fuel-only
  const [capacity, setCapacity] = useState<string>("");

  const { data: towers = [] } = useQuery({
    queryKey: ["towers", condominiumId],
    queryFn: () => api.get<Tower[]>("/towers", { params: { condominiumId } }).then((r) => r.data),
    enabled: open && !!condominiumId,
  });

  useEffect(() => {
    if (!open) {
      setName(""); setSerialNumber(""); setLocation(""); setTowerId("");
      setIntervalHours("250"); setLastMaintHours("0"); setLastMaintDate(""); setGenNotes("");
      setCapacity("");
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () => {
      const body: any = {
        condominiumId,
        name,
        type,
        serialNumber: serialNumber || null,
        location: location || null,
        unit: DEFAULT_UNIT[type],
        towerId: towerId || null,
      };
      if (type === "GENERATOR") {
        body.generatorConfig = {
          maintenanceIntervalHours: Number(intervalHours),
          lastMaintenanceHours: Number(lastMaintHours),
          lastMaintenanceDate: lastMaintDate ? new Date(lastMaintDate).toISOString() : null,
          notes: genNotes || null,
        };
      }
      if (type === "FUEL") {
        body.capacity = Number(capacity);
      }
      return api.post("/meters", body);
    },
    onSuccess: () => {
      toast.success("Medidor criado");
      qc.invalidateQueries({ queryKey: ["meters"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar {TYPE_LABEL[type]}</DialogTitle>
          <DialogDescription>Unidade padrão: {DEFAULT_UNIT[type]}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name) return toast.error("Nome obrigatório");
            if (type === "FUEL" && (!capacity || Number(capacity) <= 0)) {
              return toast.error("Capacidade do depósito é obrigatória");
            }
            if (type === "GENERATOR") {
              if (!intervalHours || Number(intervalHours) <= 0) return toast.error("Intervalo de manutenção obrigatório");
            }
            create.mutate();
          }}
        >
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex: Contador Bloco A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nº de série</Label>
              <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
            </div>
            <div>
              <Label>Localização</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Cave técnica" />
            </div>
          </div>
          <div>
            <Label>Torre associada (opcional)</Label>
            <Select value={towerId} onChange={(e) => setTowerId(e.target.value)}>
              <option value="">— sem associação a torre —</option>
              {towers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>

          {type === "GENERATOR" && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Configuração de manutenção</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Intervalo (horas) *</Label>
                  <Input type="number" min={1} value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} required />
                </div>
                <div>
                  <Label>Horas actuais</Label>
                  <Input type="number" min={0} value={lastMaintHours} onChange={(e) => setLastMaintHours(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Data da última manutenção</Label>
                <Input type="date" value={lastMaintDate} onChange={(e) => setLastMaintDate(e.target.value)} />
              </div>
              <div>
                <Label>Notas técnicas</Label>
                <Textarea rows={2} value={genNotes} onChange={(e) => setGenNotes(e.target.value)} />
              </div>
            </div>
          )}

          {type === "FUEL" && (
            <div>
              <Label>Capacidade total do depósito (litros) *</Label>
              <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} required placeholder="500" />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "A criar…" : "Criar medidor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

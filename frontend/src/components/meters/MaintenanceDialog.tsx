import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Meter } from "@/types";
import toast from "react-hot-toast";

interface Props {
  meter: Meter | null;
  open: boolean;
  onClose: () => void;
}

export function MaintenanceDialog({ meter, open, onClose }: Props) {
  const qc = useQueryClient();
  const config = meter?.generatorConfig;
  const lastReading = meter?.lastReading?.value;
  const interval = config ? Number(config.maintenanceIntervalHours) : null;

  const [currentHours, setCurrentHours] = useState<string>("");
  const [maintenanceDate, setMaintenanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [newInterval, setNewInterval] = useState<string>(interval !== null ? String(interval) : "");

  const hoursNum = currentHours === "" ? null : Number(currentHours);

  function reset() {
    setCurrentHours("");
    setMaintenanceDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setNewInterval(interval !== null ? String(interval) : "");
  }

  function handleOpenChange(o: boolean) {
    if (!o) {
      reset();
      onClose();
    }
  }

  // If user opens with a different meter, reset interval default
  if (open && meter && newInterval === "" && interval !== null) {
    setNewInterval(String(interval));
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!meter || hoursNum === null) throw new Error("Invalid");
      // 1) record maintenance (updates lastMaintHours + lastMaintDate)
      await api.patch(`/meters/${meter.id}/generator/maintenance`, {
        currentHours: hoursNum,
        maintenanceDate: new Date(maintenanceDate).toISOString(),
        notes: notes || null,
      });
      // 2) if interval changed, update the config
      if (newInterval && Number(newInterval) > 0 && interval !== Number(newInterval)) {
        await api.put(`/meters/${meter.id}`, {
          generatorConfig: {
            maintenanceIntervalHours: Number(newInterval),
            lastMaintenanceHours: hoursNum,
            lastMaintenanceDate: new Date(maintenanceDate).toISOString(),
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Manutenção registada");
      qc.invalidateQueries({ queryKey: ["meters"] });
      qc.invalidateQueries({ queryKey: ["meter-readings"] });
      reset();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao registar manutenção"),
  });

  if (!meter) return null;

  // Pre-fill with last reading as a hint
  const suggestedHours = lastReading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-brand-700" />
            Registar manutenção — {meter.name}
          </DialogTitle>
          <DialogDescription>
            Após a manutenção, o sistema recalcula a próxima data prevista.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (hoursNum === null || hoursNum < 0) {
              toast.error("Indique as horas do hodómetro");
              return;
            }
            submit.mutate();
          }}
        >
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-0.5">
            <div>Última manutenção a: <strong>{config ? Number(config.lastMaintenanceHours).toLocaleString("pt-PT") : "—"} h</strong></div>
            <div>Intervalo actual: <strong>{interval?.toLocaleString("pt-PT") ?? "—"} h</strong></div>
            <div>Última leitura: <strong>{suggestedHours?.toLocaleString("pt-PT") ?? "—"} h</strong></div>
          </div>

          <div>
            <Label>Horas do hodómetro no momento da manutenção *</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                value={currentHours}
                onChange={(e) => setCurrentHours(e.target.value)}
                required
                placeholder={suggestedHours !== undefined ? String(suggestedHours) : ""}
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">h</span>
            </div>
          </div>

          <div>
            <Label>Data da manutenção</Label>
            <Input type="date" value={maintenanceDate} onChange={(e) => setMaintenanceDate(e.target.value)} required />
          </div>

          <div>
            <Label>Próximo intervalo de manutenção (horas)</Label>
            <Input
              type="number"
              min={1}
              value={newInterval}
              onChange={(e) => setNewInterval(e.target.value)}
              placeholder="250"
            />
            <p className="text-xs text-slate-500 mt-1">Pré-preenchido com o intervalo actual. Edite só se quiser alterar.</p>
          </div>

          <div>
            <Label>Trabalhos realizados / notas</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mudou óleo, filtros…" />
          </div>

          {hoursNum !== null && newInterval && Number(newInterval) > 0 && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
              ✓ Próxima manutenção prevista para as{" "}
              <strong>{(hoursNum + Number(newInterval)).toLocaleString("pt-PT")} h</strong>.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "A registar…" : "Registar manutenção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

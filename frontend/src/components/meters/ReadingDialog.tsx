import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Wrench } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import type { Meter } from "@/types";
import toast from "react-hot-toast";

interface Props {
  meter: Meter | null;
  open: boolean;
  onClose: () => void;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function ReadingDialog({ meter, open, onClose }: Props) {
  const qc = useQueryClient();
  const now = new Date();

  const [readingValue, setReadingValue] = useState<string>("");
  const [readingDate, setReadingDate] = useState(now.toISOString().slice(0, 10));
  const [readingMonth, setReadingMonth] = useState(now.getMonth() + 1);
  const [readingYear, setReadingYear] = useState(now.getFullYear());
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState("");
  const [isReset, setIsReset] = useState(false);

  const value = readingValue === "" ? null : Number(readingValue);
  const previousValue = meter?.lastReading?.value ?? null;
  const isGenerator = meter?.type === "GENERATOR";
  const isFuel = meter?.type === "FUEL";
  const capacity = meter?.capacity ? Number(meter.capacity) : null;

  // Derived: consumption preview
  const consumption = useMemo(() => {
    if (value === null || previousValue === null) return null;
    return value - previousValue;
  }, [value, previousValue]);

  // Derived: hours until maintenance for generator (real-time)
  const generatorPreview = useMemo(() => {
    if (!isGenerator || value === null || !meter?.generatorConfig) return null;
    const lastMaint = Number(meter.generatorConfig.lastMaintenanceHours);
    const interval = Number(meter.generatorConfig.maintenanceIntervalHours);
    const nextMaint = lastMaint + interval;
    const remaining = nextMaint - value;
    return { nextMaint, remaining };
  }, [isGenerator, value, meter]);

  // Validation
  const valueIsLower = value !== null && previousValue !== null && value < previousValue;
  const fuelOverCapacity = isFuel && capacity !== null && value !== null && value > capacity;

  const submit = useMutation({
    mutationFn: async () => {
      if (!meter) throw new Error("No meter");
      return api.post(`/meters/${meter.id}/readings`, {
        readingValue: value,
        readingDate: new Date(readingDate).toISOString(),
        readingMonth,
        readingYear,
        notes: notes || null,
        photo: photo || null,
        isReset,
      });
    },
    onSuccess: () => {
      toast.success("Leitura registada");
      qc.invalidateQueries({ queryKey: ["meters"] });
      qc.invalidateQueries({ queryKey: ["meter-readings"] });
      reset();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao registar leitura"),
  });

  function reset() {
    setReadingValue("");
    setReadingDate(now.toISOString().slice(0, 10));
    setReadingMonth(now.getMonth() + 1);
    setReadingYear(now.getFullYear());
    setNotes("");
    setPhoto("");
    setIsReset(false);
  }

  function handleOpenChange(o: boolean) {
    if (!o) {
      reset();
      onClose();
    }
  }

  if (!meter) return null;

  const unit = meter.unit;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registar leitura — {meter.name}</DialogTitle>
          <DialogDescription>
            {meter.serialNumber && <>Nº série {meter.serialNumber} · </>}
            Unidade: {unit}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (value === null) {
              toast.error("Valor obrigatório");
              return;
            }
            if (valueIsLower && !isReset) {
              toast.error("Leitura inferior à anterior — marque 'substituição de contador'");
              return;
            }
            if (fuelOverCapacity) {
              toast.error(`Valor excede a capacidade do depósito (${capacity} L)`);
              return;
            }
            submit.mutate();
          }}
        >
          {previousValue !== null && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
              Leitura anterior:{" "}
              <span className="font-mono font-semibold text-brand-900">
                {previousValue.toLocaleString("pt-PT")} {unit}
              </span>
            </div>
          )}

          <div>
            <Label>
              {isGenerator ? "Horas actuais do hodómetro" : isFuel ? "Nível actual" : "Valor actual"} *
            </Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={readingValue}
                onChange={(e) => setReadingValue(e.target.value)}
                required
                placeholder="0"
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{unit}</span>
            </div>
          </div>

          {/* Real-time hints */}
          {consumption !== null && !isGenerator && !isFuel && !valueIsLower && (
            <div className="text-xs text-slate-600">
              Consumo do período:{" "}
              <Badge variant={consumption >= 0 ? "success" : "destructive"}>
                {consumption >= 0 ? "+" : ""}
                {consumption.toLocaleString("pt-PT")} {unit}
              </Badge>
            </div>
          )}

          {generatorPreview && (
            <div
              className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
                generatorPreview.remaining < 0
                  ? "bg-coral-50 border border-coral-200 text-coral-800"
                  : generatorPreview.remaining <= 50
                  ? "bg-amber-50 border border-amber-200 text-amber-900"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-900"
              }`}
            >
              <Wrench className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                Próxima manutenção a <strong>{generatorPreview.nextMaint.toLocaleString("pt-PT")} h</strong>.
                {generatorPreview.remaining < 0 ? (
                  <> ⚠️ Manutenção em atraso em <strong>{Math.abs(generatorPreview.remaining).toLocaleString("pt-PT")} h</strong>.</>
                ) : (
                  <> Faltam <strong>{generatorPreview.remaining.toLocaleString("pt-PT")} h</strong> para manutenção.</>
                )}
              </div>
            </div>
          )}

          {isFuel && capacity !== null && value !== null && value >= 0 && (
            <div className="text-xs text-slate-600">
              Nível: <strong>{((value / capacity) * 100).toFixed(1)}%</strong> de {capacity} L
            </div>
          )}

          {valueIsLower && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                A leitura é inferior à anterior. Se substituiu o contador, marque a opção abaixo.
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={readingDate} onChange={(e) => setReadingDate(e.target.value)} required />
            </div>
            <div>
              <Label>Mês ref.</Label>
              <Select value={readingMonth} onChange={(e) => setReadingMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Ano ref.</Label>
              <Input type="number" min={2000} max={2100} value={readingYear} onChange={(e) => setReadingYear(Number(e.target.value))} required />
            </div>
          </div>

          <div>
            <Label>Foto do contador (URL opcional)</Label>
            <Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://…" />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {valueIsLower && (
            <label className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg p-2">
              <input type="checkbox" checked={isReset} onChange={(e) => setIsReset(e.target.checked)} />
              <span>Substituição do contador (aceitar leitura inferior)</span>
            </label>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button type="submit" disabled={submit.isPending || value === null}>
              {submit.isPending ? "A registar…" : "Registar leitura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

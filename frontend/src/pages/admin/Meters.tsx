import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Droplets, Zap, Cog, Fuel, Gauge, Plus, History, Wrench, ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Meter, MeterType } from "@/types";
import { ReadingDialog } from "@/components/meters/ReadingDialog";
import { MaintenanceDialog } from "@/components/meters/MaintenanceDialog";
import { HistoryDialog } from "@/components/meters/HistoryDialog";
import { MeterDialog } from "@/components/meters/MeterDialog";

const TITLE: Record<MeterType, string> = {
  WATER: "Contadores EPAL",
  ELECTRICITY: "Contadores ENDE",
  GENERATOR: "Geradores",
  FUEL: "Depósitos de Gasóleo",
};

const ICON: Record<MeterType, any> = {
  WATER: Droplets,
  ELECTRICITY: Zap,
  GENERATOR: Cog,
  FUEL: Fuel,
};

const TYPE_BY_SLUG: Record<string, MeterType> = {
  water: "WATER",
  electricity: "ELECTRICITY",
  generator: "GENERATOR",
  fuel: "FUEL",
};

const ADD_LABEL: Record<MeterType, string> = {
  WATER: "Adicionar contador EPAL",
  ELECTRICITY: "Adicionar contador ENDE",
  GENERATOR: "Adicionar gerador",
  FUEL: "Adicionar depósito",
};

export function AdminMeters() {
  const { type: slug } = useParams<{ type: string }>();
  const type = TYPE_BY_SLUG[slug ?? "water"] ?? "WATER";
  const Icon = ICON[type];

  const { data: condo } = useQuery({
    queryKey: ["condominium"],
    queryFn: () => api.get("/condominium").then((r) => r.data),
  });

  const { data: meters = [] } = useQuery({
    queryKey: ["meters", type],
    queryFn: () => api.get<Meter[]>("/meters", { params: { type } }).then((r) => r.data),
  });

  // Dialog state — kept at page level so it survives meter card unmounts
  const [readingMeter, setReadingMeter] = useState<Meter | null>(null);
  const [maintenanceMeter, setMaintenanceMeter] = useState<Meter | null>(null);
  const [historyMeter, setHistoryMeter] = useState<Meter | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900 flex items-center gap-2">
            <Icon className="h-7 w-7 text-brand-700" />
            {TITLE[type]}
          </h1>
          <p className="text-slate-500">{meters.length} medidor(es)</p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={!condo}>
          <Plus className="h-4 w-4" /> {ADD_LABEL[type]}
        </Button>
      </div>

      {meters.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-400">
            <Gauge className="h-12 w-12 mx-auto mb-2 text-slate-300" />
            Nenhum medidor deste tipo registado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {meters.map((m) => (
            <MeterCard
              key={m.id}
              meter={m}
              onRegisterReading={() => setReadingMeter(m)}
              onRegisterMaintenance={() => setMaintenanceMeter(m)}
              onShowHistory={() => setHistoryMeter(m)}
            />
          ))}
        </div>
      )}

      <ReadingDialog meter={readingMeter} open={!!readingMeter} onClose={() => setReadingMeter(null)} />
      <MaintenanceDialog meter={maintenanceMeter} open={!!maintenanceMeter} onClose={() => setMaintenanceMeter(null)} />
      <HistoryDialog meter={historyMeter} open={!!historyMeter} onClose={() => setHistoryMeter(null)} />
      {condo && (
        <MeterDialog open={addOpen} onClose={() => setAddOpen(false)} type={type} condominiumId={condo.id} />
      )}
    </div>
  );
}

interface CardProps {
  meter: Meter;
  onRegisterReading: () => void;
  onRegisterMaintenance: () => void;
  onShowHistory: () => void;
}

function MeterCard(props: CardProps) {
  if (props.meter.type === "GENERATOR") return <GeneratorCard {...props} />;
  if (props.meter.type === "FUEL") return <FuelCard {...props} />;
  return <SimpleMeterCard {...props} />;
}

function ActionsRow({ onRegisterReading, onShowHistory }: Pick<CardProps, "onRegisterReading" | "onShowHistory">) {
  return (
    <div className="flex gap-2 pt-2 border-t border-slate-100 mt-2">
      <Button size="sm" variant="outline" className="flex-1" onClick={onRegisterReading}>
        <ClipboardList className="h-4 w-4" /> Registar
      </Button>
      <Button size="sm" variant="ghost" onClick={onShowHistory}>
        <History className="h-4 w-4" /> Histórico
      </Button>
    </div>
  );
}

function SimpleMeterCard({ meter, onRegisterReading, onShowHistory }: CardProps) {
  const Icon = ICON[meter.type];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-5 w-5 text-brand-700" />
          {meter.name}
        </CardTitle>
        <div className="text-xs text-slate-500">
          {meter.serialNumber && <>Nº série: {meter.serialNumber} · </>}
          {meter.location && <>{meter.location}</>}
          {meter.tower && <> · {meter.tower.name}</>}
        </div>
      </CardHeader>
      <CardContent>
        {meter.lastReading ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Última leitura</div>
            <div className="font-display text-2xl font-bold text-brand-900">
              {meter.lastReading.value.toLocaleString("pt-PT")} {meter.unit}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {formatDate(meter.lastReading.date, { hour: undefined, minute: undefined })}
              {meter.lastReading.consumption !== null && meter.lastReading.consumption !== undefined && (
                <span className="ml-2 text-emerald-700 font-medium">
                  Consumo: +{Number(meter.lastReading.consumption).toLocaleString("pt-PT")} {meter.unit}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400 py-3">Sem leituras registadas.</div>
        )}
        <ActionsRow onRegisterReading={onRegisterReading} onShowHistory={onShowHistory} />
      </CardContent>
    </Card>
  );
}

function GeneratorCard({ meter, onRegisterReading, onRegisterMaintenance, onShowHistory }: CardProps) {
  const current = meter.lastReading?.value;
  const gen = meter.generator;
  const config = meter.generatorConfig;
  const next = gen?.nextMaintenanceHours;
  const remaining = gen?.hoursUntilMaintenance ?? 0;
  const status = gen?.maintenanceStatus ?? "OK";

  const interval = config ? Number(config.maintenanceIntervalHours) : 0;
  const elapsed = interval > 0 ? Math.min(100, Math.max(0, ((interval - remaining) / interval) * 100)) : 0;

  const statusColor =
    status === "OVERDUE" ? "bg-coral-500" : status === "WARNING" ? "bg-amber-500" : "bg-emerald-500";
  const statusBadge = status === "OVERDUE" ? "destructive" : status === "WARNING" ? "warning" : "success";

  return (
    <Card className={status === "OVERDUE" ? "border-coral-300 bg-coral-50" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cog className="h-5 w-5 text-brand-700" />
            {meter.name}
          </CardTitle>
          <Badge variant={statusBadge as any}>{status === "OVERDUE" ? "VENCIDO" : status === "WARNING" ? "Aviso" : "OK"}</Badge>
        </div>
        <div className="text-xs text-slate-500">
          {meter.serialNumber && <>Nº série: {meter.serialNumber} · </>}
          {meter.location}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-500">Horas actuais</div>
            <div className="font-display text-xl font-bold text-brand-900">{current?.toLocaleString("pt-PT") ?? "—"} h</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Próxima manutenção</div>
            <div className="font-display text-xl font-bold text-brand-900">{next?.toLocaleString("pt-PT") ?? "—"} h</div>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">
            Horas restantes:{" "}
            <strong>
              {remaining > 0
                ? remaining.toLocaleString("pt-PT")
                : `${Math.abs(remaining).toLocaleString("pt-PT")} (em atraso)`}{" "}
              h
            </strong>
          </div>
          <div className="h-2 bg-slate-200 rounded overflow-hidden">
            <div className={`${statusColor} h-full transition-all`} style={{ width: `${elapsed}%` }} />
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-slate-100 mt-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onRegisterReading}>
            <ClipboardList className="h-4 w-4" /> Leitura
          </Button>
          <Button size="sm" variant={status === "OVERDUE" ? "destructive" : "outline"} onClick={onRegisterMaintenance}>
            <Wrench className="h-4 w-4" /> Manutenção
          </Button>
          <Button size="sm" variant="ghost" onClick={onShowHistory}>
            <History className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FuelCard({ meter, onRegisterReading, onShowHistory }: CardProps) {
  const current = meter.lastReading?.value ?? 0;
  const capacity = Number(meter.capacity ?? 0);
  const pct = capacity > 0 ? Math.min(100, (current / capacity) * 100) : 0;
  const color = pct < 20 ? "bg-coral-500" : pct < 50 ? "bg-amber-500" : "bg-emerald-500";
  const badge = pct < 20 ? "destructive" : pct < 50 ? "warning" : "success";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Fuel className="h-5 w-5 text-brand-700" />
            {meter.name}
          </CardTitle>
          <Badge variant={badge as any}>{pct.toFixed(0)}%</Badge>
        </div>
        <div className="text-xs text-slate-500">
          Capacidade: {capacity.toLocaleString("pt-PT")} L · {meter.location}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <div className="text-xs text-slate-500">Nível actual</div>
          <div className="font-display text-2xl font-bold text-brand-900">{Number(current).toLocaleString("pt-PT")} L</div>
        </div>
        <div className="h-3 bg-slate-200 rounded overflow-hidden">
          <div className={`${color} h-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
        {meter.lastReading && (
          <div className="text-xs text-slate-500">
            Última medição: {formatDate(meter.lastReading.date, { hour: undefined, minute: undefined })}
          </div>
        )}
        <ActionsRow onRegisterReading={onRegisterReading} onShowHistory={onShowHistory} />
      </CardContent>
    </Card>
  );
}

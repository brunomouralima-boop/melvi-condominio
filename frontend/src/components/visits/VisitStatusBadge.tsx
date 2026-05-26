import { CheckCircle2, LogOut, Calendar, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VisitStatus } from "@/types";

const CONFIG: Record<VisitStatus, { label: string; variant: any; Icon: any; emoji: string }> = {
  SCHEDULED:  { label: "Agendado",  variant: "outline",     Icon: Calendar,    emoji: "📅" },
  WAITING:    { label: "Aguardando", variant: "warning",    Icon: Clock,       emoji: "⏳" },
  INSIDE:     { label: "Dentro do condomínio", variant: "success", Icon: CheckCircle2, emoji: "✅" },
  EXITED:     { label: "Saiu do condomínio",   variant: "secondary", Icon: LogOut, emoji: "🔴" },
  CANCELLED:  { label: "Cancelado", variant: "destructive", Icon: XCircle,     emoji: "❌" },
};

export function VisitStatusBadge({ status, size = "default" }: { status: VisitStatus; size?: "default" | "sm" }) {
  const cfg = CONFIG[status];
  return (
    <Badge variant={cfg.variant} className={size === "sm" ? "text-[10px] py-0.5" : ""}>
      <cfg.Icon className={size === "sm" ? "h-3 w-3 mr-0.5" : "h-3.5 w-3.5 mr-1"} />
      {cfg.label}
    </Badge>
  );
}

/** Helper para formatar duração em minutos → "1h25" ou "45 min" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Helper para tempo decorrido desde entryAt até agora */
export function elapsedSince(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return formatDuration(minutes);
}

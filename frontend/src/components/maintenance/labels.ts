import type { MaintKind, MaintStatus, MaintPriority, MaintFrequency } from "@/types";

export const KIND_LABEL: Record<MaintKind, string> = {
  CORRECTIVE: "Corretiva",
  PREVENTIVE: "Preventiva",
};

export const STATUS_LABEL: Record<MaintStatus, string> = {
  OPEN: "Aberta",
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em curso",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

export const STATUS_VARIANT: Record<MaintStatus, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  OPEN: "warning",
  SCHEDULED: "secondary",
  IN_PROGRESS: "default",
  DONE: "success",
  CANCELLED: "outline",
};

export const PRIORITY_LABEL: Record<MaintPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const PRIORITY_VARIANT: Record<MaintPriority, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  LOW: "secondary",
  MEDIUM: "outline",
  HIGH: "warning",
  URGENT: "destructive",
};

export const FREQUENCY_LABEL: Record<MaintFrequency, string> = {
  NONE: "Sem recorrência",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};

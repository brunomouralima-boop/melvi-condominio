import type { AssemblyType, AssemblyStatus, AgendaItemStatus, VoteChoice } from "@/types";

type Variant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

export const ASSEMBLY_TYPE_LABEL: Record<AssemblyType, string> = {
  ORDINARY: "Ordinária",
  EXTRAORDINARY: "Extraordinária",
};

export const ASSEMBLY_STATUS_LABEL: Record<AssemblyStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Convocada",
  IN_PROGRESS: "A decorrer",
  CLOSED: "Encerrada",
  CANCELLED: "Cancelada",
};

export const ASSEMBLY_STATUS_VARIANT: Record<AssemblyStatus, Variant> = {
  DRAFT: "outline",
  SCHEDULED: "secondary",
  IN_PROGRESS: "default",
  CLOSED: "success",
  CANCELLED: "destructive",
};

export const AGENDA_STATUS_LABEL: Record<AgendaItemStatus, string> = {
  PENDING: "Por votar",
  VOTING_OPEN: "Votação aberta",
  VOTING_CLOSED: "Votação fechada",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
};

export const AGENDA_STATUS_VARIANT: Record<AgendaItemStatus, Variant> = {
  PENDING: "outline",
  VOTING_OPEN: "warning",
  VOTING_CLOSED: "secondary",
  APPROVED: "success",
  REJECTED: "destructive",
};

export const CHOICE_LABEL: Record<VoteChoice, string> = {
  FOR: "A Favor",
  AGAINST: "Contra",
  ABSTAIN: "Abstenção",
};

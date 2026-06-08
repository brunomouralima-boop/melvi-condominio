import type { DocumentCategory } from "@/types";

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  MINUTES: "Atas de assembleia",
  REGULATION: "Regulamento",
  CONTRACT: "Contratos",
  FINANCIAL: "Financeiro",
  CIRCULAR: "Circulares",
  OTHER: "Outros",
};

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "MINUTES",
  "REGULATION",
  "CONTRACT",
  "FINANCIAL",
  "CIRCULAR",
  "OTHER",
];

export function formatFileSize(bytes?: number | null): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

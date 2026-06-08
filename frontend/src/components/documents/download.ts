import { api } from "@/lib/api";
import toast from "react-hot-toast";

type DownloadableDoc = {
  id: string;
  title?: string;
  fileName?: string | null;
  mimeType?: string | null;
};

// Tipos que o browser renderiza inline (abre em nova aba); o resto descarrega.
const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
]);

/**
 * Descarrega/abre um documento através do endpoint autenticado
 * (GET /documents/:id/download) em vez do URL público /uploads.
 * O ficheiro é obtido como blob com o token de sessão e aberto/guardado no cliente.
 */
export async function openDocument(doc: DownloadableDoc): Promise<void> {
  const inline = doc.mimeType ? INLINE_TYPES.has(doc.mimeType) : false;
  try {
    const res = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
    const blob = res.data as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    if (inline) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else {
      a.download = doc.fileName || doc.title || "documento";
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revogar o object URL depois de o browser o ter consumido.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (e: any) {
    const status = e?.response?.status;
    toast.error(status === 404 ? "Documento não encontrado" : "Não foi possível abrir o documento");
  }
}

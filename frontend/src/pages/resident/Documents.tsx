import { useQuery } from "@tanstack/react-query";
import { FileText, Download } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { DocumentItem } from "@/types";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, formatFileSize } from "@/components/documents/categories";
import { openDocument } from "@/components/documents/download";

export function ResidentDocuments() {
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.get<DocumentItem[]>("/documents").then((r) => r.data),
  });

  const groups = DOCUMENT_CATEGORIES
    .map((cat) => ({ cat, docs: documents.filter((d) => d.category === cat) }))
    .filter((g) => g.docs.length > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Documentos</h1>
        <p className="text-slate-500">Atas, regulamento e outros documentos do condomínio</p>
      </div>

      {isLoading && <div className="text-sm text-slate-400">A carregar…</div>}
      {!isLoading && documents.length === 0 && (
        <Card><CardContent className="py-10 text-center text-slate-400">Ainda não há documentos disponíveis.</CardContent></Card>
      )}

      {groups.map((g) => (
        <Card key={g.cat}>
          <CardHeader><CardTitle>{DOCUMENT_CATEGORY_LABEL[g.cat]}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {g.docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                  <FileText className="h-5 w-5 text-brand-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-brand-900 truncate">{d.title}</div>
                    {d.description && <div className="text-xs text-slate-500 truncate">{d.description}</div>}
                    <div className="text-xs text-slate-400">
                      {formatDate(d.createdAt, { hour: undefined, minute: undefined })}
                      {d.fileSize ? ` · ${formatFileSize(d.fileSize)}` : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openDocument(d)}><Download className="h-4 w-4" /> Abrir</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

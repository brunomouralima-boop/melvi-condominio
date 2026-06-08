import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Download, Trash2, Eye, EyeOff, UploadCloud } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { DocumentItem, DocumentCategory } from "@/types";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, formatFileSize } from "@/components/documents/categories";
import { openDocument } from "@/components/documents/download";
import toast from "react-hot-toast";

export function AdminDocuments() {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.get<DocumentItem[]>("/documents").then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["documents"] });

  const toggleVisibility = useMutation({
    mutationFn: (d: DocumentItem) => api.put(`/documents/${d.id}`, { visibleToResidents: !d.visibleToResidents }),
    onSuccess: () => { toast.success("Visibilidade atualizada"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => { toast.success("Documento removido"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Documentos</h1>
          <p className="text-slate-500">Atas, regulamento, contratos e outros ficheiros</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}><Plus className="h-4 w-4" /> Carregar documento</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Biblioteca ({documents.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Documento</th>
                  <th className="text-left py-2 px-2">Categoria</th>
                  <th className="text-left py-2 px-2">Data</th>
                  <th className="text-left py-2 px-2">Visível a residentes</th>
                  <th className="text-right py-2 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-brand-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-brand-900 truncate">{d.title}</div>
                          <div className="text-xs text-slate-400 truncate">{d.fileName}{d.fileSize ? ` · ${formatFileSize(d.fileSize)}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2"><Badge variant="secondary">{DOCUMENT_CATEGORY_LABEL[d.category]}</Badge></td>
                    <td className="py-2 px-2 text-slate-500">{formatDate(d.createdAt, { hour: undefined, minute: undefined })}</td>
                    <td className="py-2 px-2">
                      <Badge variant={d.visibleToResidents ? "success" : "outline"}>{d.visibleToResidents ? "Sim" : "Só admin"}</Badge>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Abrir / descarregar" onClick={() => openDocument(d)}><Download className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" title={d.visibleToResidents ? "Tornar privado" : "Tornar visível"} onClick={() => toggleVisibility.mutate(d)}>
                          {d.visibleToResidents ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" title="Remover" onClick={() => { if (confirm(`Remover "${d.title}"?`)) remove.mutate(d.id); }}>
                          <Trash2 className="h-4 w-4 text-coral-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">Sem documentos. Carregue o primeiro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={invalidate} />
    </div>
  );
}

function UploadDialog({ open, onClose, onUploaded }: { open: boolean; onClose: () => void; onUploaded: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("MINUTES");
  const [description, setDescription] = useState("");
  const [visible, setVisible] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setTitle(""); setCategory("MINUTES"); setDescription(""); setVisible(true); setFile(null); if (fileRef.current) fileRef.current.value = ""; };

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("file", file!);
      fd.append("title", title);
      fd.append("category", category);
      fd.append("description", description);
      fd.append("visibleToResidents", String(visible));
      return api.post("/documents", fd);
    },
    onSuccess: () => { toast.success("Documento carregado"); reset(); onUploaded(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha no upload"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Carregar documento</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!file) { toast.error("Selecione um ficheiro"); return; } upload.mutate(); }}>
          <div><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div>
            <Label>Categoria</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABEL[c]}</option>)}
            </Select>
          </div>
          <div><Label>Descrição</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div>
            <Label>Ficheiro * (PDF, Word, Excel, imagem — máx. 25 MB)</Label>
            <div
              className="mt-1 flex items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 cursor-pointer hover:bg-slate-50"
              onClick={() => fileRef.current?.click()}
            >
              <UploadCloud className="h-6 w-6 text-slate-400" />
              <div className="text-sm text-slate-600 truncate">{file ? file.name : "Clique para escolher um ficheiro"}</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            Visível aos condóminos
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={upload.isPending || !title || !file}>{upload.isPending ? "A carregar…" : "Carregar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

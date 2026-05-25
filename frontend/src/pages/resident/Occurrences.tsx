import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Occurrence } from "@/types";
import toast from "react-hot-toast";

const CATEGORIES = [
  { value: "NOISE", label: "Barulho" },
  { value: "MAINTENANCE", label: "Manutenção" },
  { value: "SECURITY", label: "Segurança" },
  { value: "CLEANING", label: "Limpeza" },
  { value: "OTHER", label: "Outro" },
];

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em andamento",
  RESOLVED: "Resolvida",
  CLOSED: "Fechada",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  OPEN: "warning",
  IN_PROGRESS: "default",
  RESOLVED: "success",
  CLOSED: "secondary",
};

export function ResidentOccurrences() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useQuery({
    queryKey: ["my-occurrences"],
    queryFn: () => api.get<Occurrence[]>("/occurrences").then((r) => r.data),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Ocorrências</h1>
          <p className="text-slate-500">As suas ocorrências</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova ocorrência</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((o) => (
          <Card key={o.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{o.title}</CardTitle>
                <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
              </div>
              <div className="text-xs text-slate-500">
                {CATEGORIES.find((c) => c.value === o.category)?.label} · {formatDate(o.createdAt)}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700">{o.description}</p>
              {o.response && (
                <div className="mt-3 rounded-lg bg-brand-50 border border-brand-100 p-3">
                  <div className="text-xs font-semibold text-brand-700">Resposta da administração:</div>
                  <div className="text-sm text-brand-900 mt-1">{o.response}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card><CardContent className="py-12 text-center text-slate-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-slate-300" />
            Sem ocorrências.
          </CardContent></Card>
        )}
      </div>

      <NewOccurrenceDialog open={open} onClose={() => setOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["my-occurrences"] })} />
    </div>
  );
}

function NewOccurrenceDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("MAINTENANCE");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      // upload images first
      let photos: string[] = [];
      if (files.length) {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        const { data } = await api.post<{ urls: string[] }>("/uploads/images", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        photos = data.urls;
      }
      await api.post("/occurrences", { title, category, priority, description, photos });
    },
    onSuccess: () => {
      toast.success("Ocorrência criada");
      setTitle(""); setDescription(""); setFiles([]);
      onCreated(); onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao criar"),
    onSettled: () => setSubmitting(false),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova ocorrência</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); setSubmitting(true); create.mutate(); }}
        >
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição *</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required minLength={5} />
          </div>
          <div>
            <Label>Fotos (opcional, máx. 5)</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
            />
            {files.length > 0 && <div className="text-xs text-slate-500 mt-1">{files.length} ficheiro(s)</div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "A enviar…" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pin, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Announcement } from "@/types";
import toast from "react-hot-toast";

export function AdminAnnouncements() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<Announcement[]>("/announcements").then((r) => r.data),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["announcements"] }); },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Comunicados</h1>
          <p className="text-slate-500">Avisos enviados aos residentes</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo comunicado</Button>
      </div>

      <div className="space-y-3">
        {items.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {a.isPinned && <Pin className="h-4 w-4 text-coral-500" />}
                  {a.title}
                  {a.type === "URGENT" && <Badge variant="destructive">Urgente</Badge>}
                  {a.type === "WARNING" && <Badge variant="warning">Aviso</Badge>}
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="text-xs text-slate-500">{formatDate(a.createdAt)} · {a.createdBy?.name}</div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.content}</p>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card><CardContent className="py-10 text-center text-slate-500">Sem comunicados.</CardContent></Card>
        )}
      </div>

      <NewAnnouncementDialog open={open} onClose={() => setOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["announcements"] })} />
    </div>
  );
}

function NewAnnouncementDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"INFO" | "WARNING" | "URGENT">("INFO");
  const [isPinned, setIsPinned] = useState(false);

  const create = useMutation({
    mutationFn: () => api.post("/announcements", { title, content, type, isPinned }),
    onSuccess: () => {
      toast.success("Comunicado enviado");
      setTitle(""); setContent(""); setIsPinned(false); setType("INFO");
      onCreated(); onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo comunicado</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div><Label>Conteúdo *</Label><Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="INFO">Informativo</option>
                <option value="WARNING">Aviso</option>
                <option value="URGENT">Urgente</option>
              </Select>
            </div>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
              <span className="text-sm">Fixar no topo</span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "A enviar…" : "Publicar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Vote, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AssemblyListItem, AssemblyType } from "@/types";
import { ASSEMBLY_TYPE_LABEL, ASSEMBLY_STATUS_LABEL, ASSEMBLY_STATUS_VARIANT } from "@/components/assemblies/labels";
import toast from "react-hot-toast";

export function AdminAssemblies() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: assemblies = [] } = useQuery({
    queryKey: ["assemblies"],
    queryFn: () => api.get<AssemblyListItem[]>("/assemblies").then((r) => r.data),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Assembleias</h1>
          <p className="text-slate-500">Convocatórias, ordem de trabalhos e votação</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova assembleia</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista ({assemblies.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {assemblies.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/admin/assemblies/${a.id}`)}
                className="w-full flex items-center gap-4 rounded-lg border border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
              >
                <Vote className="h-5 w-5 text-brand-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-brand-900 truncate">{a.title}</div>
                  <div className="text-xs text-slate-500">
                    {ASSEMBLY_TYPE_LABEL[a.type]} · {formatDate(a.scheduledAt)} · {a._count?.agendaItems ?? 0} pontos
                  </div>
                </div>
                <Badge variant={ASSEMBLY_STATUS_VARIANT[a.status]}>{ASSEMBLY_STATUS_LABEL[a.status]}</Badge>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            ))}
            {assemblies.length === 0 && (
              <div className="py-8 text-center text-slate-400">Sem assembleias. Cria a primeira.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <NewAssemblyDialog open={open} onClose={() => setOpen(false)} onCreated={(id) => navigate(`/admin/assemblies/${id}`)} />
    </div>
  );
}

function NewAssemblyDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AssemblyType>("ORDINARY");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.post("/assemblies", {
        title,
        type,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        location: location || null,
        description: description || null,
      }),
    onSuccess: (res) => {
      toast.success("Assembleia criada");
      qc.invalidateQueries({ queryKey: ["assemblies"] });
      onClose();
      onCreated((res.data as any).id);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova assembleia</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Assembleia Geral Ordinária 2026" required /></div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as AssemblyType)}>
                <option value="ORDINARY">Ordinária</option>
                <option value="EXTRAORDINARY">Extraordinária</option>
              </Select>
            </div>
            <div><Label>Data *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div><Label>Hora *</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
          </div>
          <div><Label>Local</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Salão de festas" /></div>
          <div><Label>Convocatória / notas</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || !title}>{create.isPending ? "..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

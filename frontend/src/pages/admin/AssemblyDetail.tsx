import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Play, Square, Lock, Unlock, Trash2, Calendar, MapPin, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AssemblyDetail, AgendaItemFull } from "@/types";
import { ResultBar } from "@/components/assemblies/ResultBar";
import {
  ASSEMBLY_TYPE_LABEL, ASSEMBLY_STATUS_LABEL, ASSEMBLY_STATUS_VARIANT,
  AGENDA_STATUS_LABEL, AGENDA_STATUS_VARIANT,
} from "@/components/assemblies/labels";
import toast from "react-hot-toast";

export function AdminAssemblyDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: AgendaItemFull | null }>({ open: false, item: null });

  const { data: a, isLoading } = useQuery({
    queryKey: ["assembly", id],
    queryFn: () => api.get<AssemblyDetail>(`/assemblies/${id}`).then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["assembly", id] });

  const setStatus = useMutation({
    mutationFn: (status: string) => api.put(`/assemblies/${id}`, { status }),
    onSuccess: () => { toast.success("Estado atualizado"); invalidate(); qc.invalidateQueries({ queryKey: ["assemblies"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const removeAssembly = useMutation({
    mutationFn: () => api.delete(`/assemblies/${id}`),
    onSuccess: () => { toast.success("Assembleia removida"); navigate("/admin/assemblies"); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const openVote = useMutation({
    mutationFn: (itemId: string) => api.post(`/assemblies/${id}/agenda/${itemId}/open`, {}),
    onSuccess: () => { toast.success("Votação aberta"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const closeVote = useMutation({
    mutationFn: (itemId: string) => api.post(`/assemblies/${id}/agenda/${itemId}/close`, {}),
    onSuccess: (res) => { toast.success((res.data as any).approved ? "Apurado: Aprovado" : "Apurado: Reprovado"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const deleteItem = useMutation({
    mutationFn: (itemId: string) => api.delete(`/assemblies/${id}/agenda/${itemId}`),
    onSuccess: () => { toast.success("Ponto removido"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  if (isLoading || !a) return <div className="p-6 text-slate-400">A carregar…</div>;

  const canEditFlow = a.status !== "CLOSED" && a.status !== "CANCELLED";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <button onClick={() => navigate("/admin/assemblies")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-900">
        <ArrowLeft className="h-4 w-4" /> Assembleias
      </button>

      {/* Cabeçalho */}
      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-brand-900">{a.title}</h1>
                <Badge variant={ASSEMBLY_STATUS_VARIANT[a.status]}>{ASSEMBLY_STATUS_LABEL[a.status]}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span>{ASSEMBLY_TYPE_LABEL[a.type]}</span>
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDate(a.scheduledAt)}</span>
                {a.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {a.location}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {a.status === "DRAFT" && <Button size="sm" onClick={() => setStatus.mutate("SCHEDULED")}><Unlock className="h-4 w-4" /> Publicar convocatória</Button>}
              {a.status === "SCHEDULED" && <Button size="sm" onClick={() => setStatus.mutate("IN_PROGRESS")}><Play className="h-4 w-4" /> Iniciar</Button>}
              {a.status === "IN_PROGRESS" && <Button size="sm" onClick={() => setStatus.mutate("CLOSED")}><Square className="h-4 w-4" /> Encerrar</Button>}
              {canEditFlow && a.status !== "DRAFT" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate("CANCELLED")}>Cancelar</Button>}
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover esta assembleia?")) removeAssembly.mutate(); }}><Trash2 className="h-4 w-4 text-coral-600" /></Button>
            </div>
          </div>
          {a.description && <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{a.description}</p>}
          <div className="text-xs text-slate-400">Permilagem total do condomínio: {a.totalPermillage.toFixed(2)}‰</div>
        </CardContent>
      </Card>

      {/* Ordem de trabalhos */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-brand-900">Ordem de trabalhos ({a.agendaItems.length})</h2>
        <Button size="sm" variant="outline" onClick={() => setItemDialog({ open: true, item: null })}><Plus className="h-4 w-4" /> Adicionar ponto</Button>
      </div>

      <div className="space-y-3">
        {a.agendaItems.map((item, idx) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <div>
                <CardTitle className="text-base">{idx + 1}. {item.title}</CardTitle>
                {item.description && <p className="mt-1 text-sm text-slate-500 whitespace-pre-line">{item.description}</p>}
              </div>
              <Badge variant={AGENDA_STATUS_VARIANT[item.status]}>{AGENDA_STATUS_LABEL[item.status]}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {(item.tally.totalCount > 0 || item.status !== "PENDING") && (
                <ResultBar tally={item.tally} totalPermillage={a.totalPermillage} />
              )}
              <div className="flex flex-wrap gap-2">
                {item.status === "PENDING" && canEditFlow && (
                  <Button size="sm" onClick={() => openVote.mutate(item.id)}><Unlock className="h-4 w-4" /> Abrir votação</Button>
                )}
                {item.status === "VOTING_OPEN" && (
                  <Button size="sm" onClick={() => closeVote.mutate(item.id)}><Lock className="h-4 w-4" /> Fechar e apurar</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setItemDialog({ open: true, item })}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover ponto?")) deleteItem.mutate(item.id); }}><Trash2 className="h-4 w-4 text-coral-600" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {a.agendaItems.length === 0 && (
          <Card><CardContent className="py-6 text-center text-slate-400">Sem pontos. Adiciona o primeiro.</CardContent></Card>
        )}
      </div>

      <ItemDialog
        assemblyId={id}
        open={itemDialog.open}
        item={itemDialog.item}
        onClose={() => setItemDialog({ open: false, item: null })}
        onSaved={invalidate}
      />
    </div>
  );
}

function ItemDialog({ assemblyId, open, item, onClose, onSaved }: { assemblyId: string; open: boolean; item: AgendaItemFull | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [syncKey, setSyncKey] = useState("");
  const key = `${open}-${item?.id ?? "new"}`;
  if (open && key !== syncKey) {
    setSyncKey(key);
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = { title, description: description || null };
      return item
        ? api.put(`/assemblies/${assemblyId}/agenda/${item.id}`, payload)
        : api.post(`/assemblies/${assemblyId}/agenda`, payload);
    },
    onSuccess: () => { toast.success(item ? "Ponto atualizado" : "Ponto adicionado"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? "Editar ponto" : "Adicionar ponto"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div><Label>Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div><Label>Descrição</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending || !title}>{save.isPending ? "..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

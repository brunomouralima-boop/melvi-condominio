import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Occurrence, OccurrenceStatus } from "@/types";
import toast from "react-hot-toast";

const COLS: { key: OccurrenceStatus; label: string }[] = [
  { key: "OPEN", label: "Abertas" },
  { key: "IN_PROGRESS", label: "Em andamento" },
  { key: "RESOLVED", label: "Resolvidas" },
  { key: "CLOSED", label: "Fechadas" },
];

const PRIORITY_VARIANT: any = { URGENT: "destructive", HIGH: "warning", MEDIUM: "secondary", LOW: "outline" };

export function AdminOccurrences() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Occurrence | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["occurrences-all"],
    queryFn: () => api.get<Occurrence[]>("/occurrences").then((r) => r.data),
  });

  const respond = useMutation({
    mutationFn: ({ id, response, status }: { id: string; response: string; status: OccurrenceStatus }) =>
      api.post(`/occurrences/${id}/response`, { response, status }),
    onSuccess: () => {
      toast.success("Resposta enviada");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["occurrences-all"] });
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Ocorrências</h1>
        <p className="text-slate-500">Quadro de gestão por estado</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLS.map((col) => {
          const colItems = items.filter((o) => o.status === col.key);
          return (
            <Card key={col.key}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  {col.label}
                  <Badge variant="secondary">{colItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {colItems.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setEditing(o)}
                    className="w-full text-left rounded-lg border border-slate-200 p-3 hover:border-brand-400 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm text-brand-900">{o.title}</div>
                      <Badge variant={PRIORITY_VARIANT[o.priority]}>{o.priority}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {o.fraction?.tower?.name} {o.fraction?.identifier} · {o.createdBy?.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{formatDate(o.createdAt)}</div>
                  </button>
                ))}
                {colItems.length === 0 && <div className="text-xs text-slate-400 text-center py-2">vazio</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          {editing && <ResponseForm occurrence={editing} onSubmit={(d) => respond.mutate({ id: editing.id, ...d })} loading={respond.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResponseForm({ occurrence, onSubmit, loading }: { occurrence: Occurrence; onSubmit: (d: { response: string; status: OccurrenceStatus }) => void; loading: boolean }) {
  const [response, setResponse] = useState(occurrence.response || "");
  const [status, setStatus] = useState<OccurrenceStatus>(occurrence.status === "OPEN" ? "IN_PROGRESS" : occurrence.status);

  return (
    <>
      <DialogHeader><DialogTitle>{occurrence.title}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="text-xs font-semibold text-slate-500 mb-1">Descrição do residente</div>
          <div>{occurrence.description}</div>
          <div className="text-xs text-slate-500 mt-2">
            {occurrence.createdBy?.name} · {occurrence.fraction?.tower?.name} {occurrence.fraction?.identifier} · {formatDate(occurrence.createdAt)}
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ response, status }); }} className="space-y-3">
          <div>
            <Label>Resposta</Label>
            <Textarea rows={4} value={response} onChange={(e) => setResponse(e.target.value)} required minLength={2} />
          </div>
          <div>
            <Label>Atualizar estado para</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as OccurrenceStatus)}>
              <option value="OPEN">Aberta</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="RESOLVED">Resolvida</option>
              <option value="CLOSED">Fechada</option>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>{loading ? "A enviar…" : "Enviar resposta"}</Button>
          </DialogFooter>
        </form>
      </div>
    </>
  );
}

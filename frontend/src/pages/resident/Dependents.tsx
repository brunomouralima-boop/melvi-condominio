import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import toast from "react-hot-toast";

interface Dependent { id: string; name: string; relationship: string; document?: string | null; photo?: string | null }

export function ResidentDependents() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useQuery({
    queryKey: ["dependents"],
    queryFn: () => api.get<Dependent[]>("/dependents").then((r) => r.data),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/dependents/${id}`),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["dependents"] }); },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Dependentes</h1>
          <p className="text-slate-500">Familiares e dependentes registados</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => (
          <Card key={d.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{d.name}</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="text-xs text-slate-500">{d.relationship}</div>
            </CardHeader>
            <CardContent className="text-xs text-slate-600">
              {d.document && <div>Doc: {d.document}</div>}
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-slate-400">Sem dependentes.</CardContent>
          </Card>
        )}
      </div>

      <NewDialog open={open} onClose={() => setOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["dependents"] })} />
    </div>
  );
}

function NewDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [doc, setDoc] = useState("");

  const create = useMutation({
    mutationFn: () => api.post("/dependents", { name, relationship, document: doc || null }),
    onSuccess: () => { toast.success("Criado"); setName(""); setRelationship(""); setDoc(""); onCreated(); onClose(); },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo dependente</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><Label>Parentesco *</Label><Input value={relationship} onChange={(e) => setRelationship(e.target.value)} required placeholder="Filho, Cônjuge, etc." /></div>
          <div><Label>Documento</Label><Input value={doc} onChange={(e) => setDoc(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

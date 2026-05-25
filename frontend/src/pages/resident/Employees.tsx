import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Briefcase } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import toast from "react-hot-toast";

interface DomesticEmployee { id: string; name: string; role: string; document?: string | null }

export function ResidentEmployees() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useQuery({
    queryKey: ["domestic-employees"],
    queryFn: () => api.get<DomesticEmployee[]>("/domestic-employees").then((r) => r.data),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/domestic-employees/${id}`),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["domestic-employees"] }); },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Funcionários Domésticos</h1>
          <p className="text-slate-500">Empregados e prestadores regulares</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-brand-600" /> {e.name}
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="text-xs text-slate-500">{e.role}</div>
            </CardHeader>
            <CardContent className="text-xs text-slate-600">
              {e.document && <div>Doc: {e.document}</div>}
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-slate-400">Sem funcionários.</CardContent>
          </Card>
        )}
      </div>

      <NewDialog open={open} onClose={() => setOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["domestic-employees"] })} />
    </div>
  );
}

function NewDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: "", role: "", document: "" });
  const create = useMutation({
    mutationFn: () => api.post("/domestic-employees", { ...f, document: f.document || null }),
    onSuccess: () => { toast.success("Criado"); setF({ name: "", role: "", document: "" }); onCreated(); onClose(); },
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div><Label>Nome *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
          <div><Label>Função *</Label><Input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} required /></div>
          <div><Label>Documento</Label><Input value={f.document} onChange={(e) => setF({ ...f, document: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

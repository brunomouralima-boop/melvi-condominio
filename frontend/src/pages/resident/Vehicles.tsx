import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Car } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import toast from "react-hot-toast";

interface Vehicle { id: string; plate: string; brand: string; model: string; color: string; photo?: string | null }

export function ResidentVehicles() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.get<Vehicle[]>("/vehicles").then((r) => r.data),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/vehicles/${id}`),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["vehicles"] }); },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Viaturas</h1>
          <p className="text-slate-500">Veículos da sua unidade</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => (
          <Card key={v.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="h-5 w-5 text-brand-600" />
                  {v.plate}
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(v.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="text-xs text-slate-500">{v.brand} {v.model} · {v.color}</div>
            </CardHeader>
          </Card>
        ))}
        {items.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-slate-400">Sem viaturas.</CardContent>
          </Card>
        )}
      </div>

      <NewVehicleDialog open={open} onClose={() => setOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["vehicles"] })} />
    </div>
  );
}

function NewVehicleDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ plate: "", brand: "", model: "", color: "" });
  const create = useMutation({
    mutationFn: () => api.post("/vehicles", f),
    onSuccess: () => { toast.success("Criado"); setF({ plate: "", brand: "", model: "", color: "" }); onCreated(); onClose(); },
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova viatura</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div><Label>Matrícula *</Label><Input value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Marca *</Label><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} required /></div>
            <div><Label>Modelo *</Label><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} required /></div>
          </div>
          <div><Label>Cor *</Label><Input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} required /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

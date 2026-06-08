import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, PawPrint, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import toast from "react-hot-toast";

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  notes?: string | null;
}

const SPECIES = ["Cão", "Gato", "Ave", "Peixe", "Roedor", "Réptil", "Outro"];

export function ResidentPets() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pet | null>(null);

  const { data: pets = [] } = useQuery({
    queryKey: ["pets"],
    queryFn: () => api.get<Pet[]>("/pets").then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pets"] });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/pets/${id}`),
    onSuccess: () => { toast.success("Removido"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Animais de estimação</h1>
          <p className="text-slate-500">Registe os seus animais</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4" /> Adicionar animal</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {pets.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-start gap-3 py-4">
              <div className="rounded-lg bg-brand-50 p-2.5"><PawPrint className="h-5 w-5 text-brand-700" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-brand-900">{p.name}</div>
                <div className="text-sm text-slate-500">{p.species}{p.breed ? ` · ${p.breed}` : ""}</div>
                {p.notes && <div className="mt-1 text-xs text-slate-400">{p.notes}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditing(p); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" title="Remover" onClick={() => { if (confirm(`Remover ${p.name}?`)) remove.mutate(p.id); }}><Trash2 className="h-4 w-4 text-coral-600" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {pets.length === 0 && (
          <Card className="sm:col-span-2"><CardContent className="py-8 text-center text-slate-400">Ainda não registou animais.</CardContent></Card>
        )}
      </div>

      <PetDialog open={dialogOpen} pet={editing} onClose={() => setDialogOpen(false)} onSaved={invalidate} />
    </div>
  );
}

function PetDialog({ open, pet, onClose, onSaved }: { open: boolean; pet: Pet | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", species: "Cão", breed: "", notes: "" });

  useEffect(() => {
    if (!open) return;
    setForm({ name: pet?.name ?? "", species: pet?.species ?? "Cão", breed: pet?.breed ?? "", notes: pet?.notes ?? "" });
  }, [open, pet]);

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: form.name, species: form.species, breed: form.breed || null, notes: form.notes || null };
      return pet ? api.put(`/pets/${pet.id}`, payload) : api.post("/pets", payload);
    },
    onSuccess: () => { toast.success(pet ? "Atualizado" : "Adicionado"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{pet ? "Editar animal" : "Adicionar animal"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={set("name")} required /></div>
            <div>
              <Label>Espécie *</Label>
              <Select value={form.species} onChange={set("species")}>
                {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>
          <div><Label>Raça</Label><Input value={form.breed} onChange={set("breed")} /></div>
          <div><Label>Notas</Label><Textarea rows={2} value={form.notes} onChange={set("notes")} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending || !form.name}>{save.isPending ? "..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

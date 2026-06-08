import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Power, Trash2, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Supplier } from "@/types";
import toast from "react-hot-toast";

export function AdminSuppliers() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>("/maintenance/suppliers").then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["suppliers"] });

  const toggle = useMutation({
    mutationFn: (s: Supplier) => api.put(`/maintenance/suppliers/${s.id}`, { isActive: !s.isActive }),
    onSuccess: () => { toast.success("Atualizado"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/maintenance/suppliers/${id}`),
    onSuccess: (res) => {
      toast.success((res.data as any)?.deactivated ? "Tinha ordens — desativado" : "Fornecedor removido");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Fornecedores</h1>
          <p className="text-slate-500">Prestadores de serviços do condomínio</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4" /> Novo fornecedor</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista ({suppliers.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Nome</th>
                  <th className="text-left py-2 px-2">Categoria</th>
                  <th className="text-left py-2 px-2">Contacto</th>
                  <th className="text-left py-2 px-2">NIF</th>
                  <th className="text-right py-2 px-2">Ordens</th>
                  <th className="text-right py-2 px-2">Estado</th>
                  <th className="text-right py-2 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className={`border-b border-slate-100 ${!s.isActive ? "opacity-50" : ""}`}>
                    <td className="py-2 px-2 font-medium text-brand-900">{s.name}</td>
                    <td className="py-2 px-2 text-slate-700">{s.category || "—"}</td>
                    <td className="py-2 px-2 text-slate-700">
                      {s.contactName && <div>{s.contactName}</div>}
                      {s.phone && <div className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</div>}
                      {!s.contactName && !s.phone && "—"}
                    </td>
                    <td className="py-2 px-2 text-slate-500">{s.taxId || "—"}</td>
                    <td className="py-2 px-2 text-right">{s._count?.orders ?? 0}</td>
                    <td className="py-2 px-2 text-right">
                      <Badge variant={s.isActive ? "success" : "outline"}>{s.isActive ? "Ativo" : "Inativo"}</Badge>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditing(s); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" title={s.isActive ? "Desativar" : "Ativar"} onClick={() => toggle.mutate(s)}><Power className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" title="Remover" onClick={() => { if (confirm(`Remover ${s.name}?`)) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-coral-600" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-400">Sem fornecedores.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <SupplierDialog
        open={dialogOpen}
        supplier={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={invalidate}
      />
    </div>
  );
}

function SupplierDialog({ open, supplier, onClose, onSaved }: { open: boolean; supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", category: "", contactName: "", phone: "", email: "", taxId: "", notes: "" });

  // Sincroniza o formulário ao abrir / trocar de fornecedor
  useEffect(() => {
    if (!open) return;
    setForm({
      name: supplier?.name ?? "",
      category: supplier?.category ?? "",
      contactName: supplier?.contactName ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      taxId: supplier?.taxId ?? "",
      notes: supplier?.notes ?? "",
    });
  }, [open, supplier]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        category: form.category || null,
        contactName: form.contactName || null,
        phone: form.phone || null,
        email: form.email || null,
        taxId: form.taxId || null,
        notes: form.notes || null,
      };
      return supplier
        ? api.put(`/maintenance/suppliers/${supplier.id}`, payload)
        : api.post("/maintenance/suppliers", payload);
    },
    onSuccess: () => { toast.success(supplier ? "Atualizado" : "Criado"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{supplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={set("name")} required /></div>
            <div><Label>Categoria</Label><Input placeholder="Ex.: Elevadores" value={form.category} onChange={set("category")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contacto</Label><Input value={form.contactName} onChange={set("contactName")} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={set("phone")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} /></div>
            <div><Label>NIF</Label><Input value={form.taxId} onChange={set("taxId")} /></div>
          </div>
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

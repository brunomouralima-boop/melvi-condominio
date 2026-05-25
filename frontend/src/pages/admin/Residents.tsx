import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, UserX, UserCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { AuthUser, Fraction } from "@/types";
import toast from "react-hot-toast";

export function AdminResidents() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["users", { role: "RESIDENT", search, includeInactive }],
    queryFn: () =>
      api
        .get<AuthUser[]>("/users", {
          params: {
            role: "RESIDENT",
            search: search || undefined,
            includeInactive: includeInactive ? "true" : undefined,
          },
        })
        .then((r) => r.data),
  });
  const { data: fractions = [] } = useQuery({
    queryKey: ["fractions"],
    queryFn: () => api.get<Fraction[]>("/fractions").then((r) => r.data),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/deactivate`),
    onSuccess: () => {
      toast.success("Residente desactivado");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const activate = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/activate`),
    onSuccess: () => {
      toast.success("Residente activado");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success("Residente eliminado (anonimizado)");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Condóminos</h1>
          <p className="text-slate-500">Gestão de residentes</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo condómino</Button>
      </div>

      <Card>
        <CardContent className="py-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Pesquisar por nome ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            Mostrar inactivos
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="text-left py-3 px-4">Nome</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Telefone</th>
                <th className="text-left py-3 px-4">Fracção</th>
                <th className="text-left py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acções</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-2.5 px-4 font-medium text-brand-900">{u.name}</td>
                  <td className="py-2.5 px-4 text-slate-700">{u.email}</td>
                  <td className="py-2.5 px-4 text-slate-700">{u.phone || "—"}</td>
                  <td className="py-2.5 px-4 text-slate-700">
                    {u.fraction ? `${u.fraction.tower?.name} ${u.fraction.identifier}` : "—"}
                  </td>
                  <td className="py-2.5 px-4">
                    {u.isActive ? <Badge variant="success">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                  </td>
                  <td className="py-2.5 px-4 text-right space-x-1">
                    {u.isActive ? (
                      <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(u.id)}>
                        <UserX className="h-4 w-4" /> Desactivar
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => activate.mutate(u.id)}>
                        <UserCheck className="h-4 w-4" /> Activar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Eliminar ${u.name}? Esta acção é irreversível — o utilizador será anonimizado.`)) {
                          remove.mutate(u.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-coral-600" />
                    </Button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">Sem residentes.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <NewResidentDialog open={open} onClose={() => setOpen(false)} fractions={fractions} onCreated={() => qc.invalidateQueries({ queryKey: ["users"] })} />
    </div>
  );
}

function NewResidentDialog({ open, onClose, fractions, onCreated }: { open: boolean; onClose: () => void; fractions: Fraction[]; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [fractionId, setFractionId] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.post("/users", { name, email, password, role: "RESIDENT", phone: phone || null, fractionId: fractionId || null }),
    onSuccess: () => {
      toast.success("Residente criado");
      setName(""); setEmail(""); setPassword(""); setPhone(""); setFractionId("");
      onCreated(); onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao criar"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo condómino</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><Label>Senha inicial *</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
          <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div>
            <Label>Fracção</Label>
            <Select value={fractionId} onChange={(e) => setFractionId(e.target.value)}>
              <option value="">— sem fracção —</option>
              {fractions.map((f) => <option key={f.id} value={f.id}>{f.tower?.name} {f.identifier}</option>)}
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "A criar…" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

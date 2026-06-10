import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Users, Building2, Trash2, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Condominium, Role } from "@/types";
import toast from "react-hot-toast";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Administrador",
  ADMIN_ORG: "Admin Organização",
  ADMIN: "Administrador",
  RESIDENT: "Condómino",
  DOORMAN: "Porteiro",
};
// SUPER_ADMIN é deliberadamente omitido: a gestão de membros de um condomínio
// não atribui o papel de plataforma (feito apenas no módulo Sistema).
const ROLE_OPTIONS: Role[] = ["ADMIN_ORG", "ADMIN", "DOORMAN", "RESIDENT"];

interface Member {
  id: string;
  role: Role;
  user: { id: string; name: string; email: string; role: Role; isActive: boolean; avatar?: string | null };
}
interface UserLite {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export function AdminCondominiums() {
  const qc = useQueryClient();
  const { activeCondominiumId } = useAuth();
  const [editing, setEditing] = useState<Condominium | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersFor, setMembersFor] = useState<Condominium | null>(null);

  const { data: condos = [] } = useQuery({
    queryKey: ["condominiums"],
    queryFn: () => api.get<Condominium[]>("/condominiums").then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["condominiums"] });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Condomínios</h1>
          <p className="text-slate-500">Gestão de condomínios e respectivos acessos</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo condomínio
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista ({condos.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Nome</th>
                  <th className="text-left py-2 px-2">Morada</th>
                  <th className="text-right py-2 px-2">Torres</th>
                  <th className="text-right py-2 px-2">Fracções</th>
                  <th className="text-right py-2 px-2">Estado</th>
                  <th className="text-right py-2 px-2">Acções</th>
                </tr>
              </thead>
              <tbody>
                {condos.map((c) => (
                  <tr key={c.id} className={`border-b border-slate-100 ${!c.isActive ? "opacity-50" : ""}`}>
                    <td className="py-2 px-2 font-medium text-brand-900">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        {c.name}
                        {c.id === activeCondominiumId && <Badge variant="success">Activo</Badge>}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-700">{c.address}</td>
                    <td className="py-2 px-2 text-right">{c._count?.towers ?? 0}</td>
                    <td className="py-2 px-2 text-right">{c._count?.fractions ?? 0}</td>
                    <td className="py-2 px-2 text-right">
                      <Badge variant={c.isActive ? "success" : "outline"}>{c.isActive ? "Activo" : "Inactivo"}</Badge>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Membros" onClick={() => setMembersFor(c)}>
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {condos.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">Sem condomínios.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CondoDialog open={dialogOpen} condo={editing} onClose={() => setDialogOpen(false)} onSaved={invalidate} />
      {membersFor && (
        <MembersDialog condo={membersFor} onClose={() => setMembersFor(null)} />
      )}
    </div>
  );
}

function CondoDialog({ open, condo, onClose, onSaved }: { open: boolean; condo: Condominium | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", address: "", taxId: "", phone: "", email: "", website: "" });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: condo?.name ?? "",
      address: condo?.address ?? "",
      taxId: condo?.taxId ?? "",
      phone: condo?.phone ?? "",
      email: condo?.email ?? "",
      website: condo?.website ?? "",
    });
  }, [open, condo]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        address: form.address,
        taxId: form.taxId || null,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
      };
      return condo ? api.put(`/condominiums/${condo.id}`, payload) : api.post("/condominiums", payload);
    },
    onSuccess: () => { toast.success(condo ? "Actualizado" : "Criado"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{condo ? "Editar condomínio" : "Novo condomínio"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div><Label>Nome *</Label><Input value={form.name} onChange={set("name")} required minLength={2} /></div>
          <div><Label>Morada *</Label><Input value={form.address} onChange={set("address")} required minLength={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>NIF</Label><Input value={form.taxId} onChange={set("taxId")} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={set("phone")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} /></div>
            <div><Label>Website</Label><Input value={form.website} onChange={set("website")} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending || form.name.length < 2 || form.address.length < 2}>
              {save.isPending ? "..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({ condo, onClose }: { condo: Condominium; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<Role>("RESIDENT");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["condo-members", condo.id],
    queryFn: () => api.get<Member[]>(`/condominiums/${condo.id}/members`).then((r) => r.data),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users", "all-for-members"],
    queryFn: () => api.get<UserLite[]>("/users?includeInactive=true").then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["condo-members", condo.id] });

  const memberIds = useMemo(() => new Set(members.map((m) => m.user.id)), [members]);
  const candidates = useMemo(() => users.filter((u) => !memberIds.has(u.id)), [users, memberIds]);

  const addMember = useMutation({
    mutationFn: () => api.post(`/condominiums/${condo.id}/members`, { userId: addUserId, role: addRole }),
    onSuccess: () => { toast.success("Membro adicionado"); setAddUserId(""); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      api.patch(`/condominiums/${condo.id}/members/${userId}`, { role }),
    onSuccess: () => { toast.success("Papel actualizado"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api.delete(`/condominiums/${condo.id}/members/${userId}`),
    onSuccess: () => { toast.success("Acesso removido"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Membros — {condo.name}</DialogTitle></DialogHeader>

        {/* Adicionar membro */}
        <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex-1 min-w-0">
            <Label>Utilizador</Label>
            <Select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
              <option value="">Seleccionar…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Label>Papel</Label>
            <Select value={addRole} onChange={(e) => setAddRole(e.target.value as Role)}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </div>
          <Button onClick={() => addMember.mutate()} disabled={!addUserId || addMember.isPending}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="text-left py-2 px-2">Nome</th>
                <th className="text-left py-2 px-2">Papel neste condomínio</th>
                <th className="text-right py-2 px-2">Acções</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={3} className="py-6 text-center text-slate-400">A carregar…</td></tr>
              )}
              {!isLoading && members.map((m) => {
                const isSelf = m.user.id === user?.id;
                return (
                  <tr key={m.id} className={`border-b border-slate-100 ${!m.user.isActive ? "opacity-50" : ""}`}>
                    <td className="py-2 px-2">
                      <div className="font-medium text-brand-900">{m.user.name}{isSelf && " (você)"}</div>
                      <div className="text-xs text-slate-400">{m.user.email}</div>
                    </td>
                    <td className="py-2 px-2">
                      <Select
                        className="h-9 w-48"
                        value={m.role}
                        onChange={(e) => changeRole.mutate({ userId: m.user.id, role: e.target.value as Role })}
                      >
                        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </Select>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        title={isSelf ? "Não pode remover o próprio acesso" : "Remover acesso"}
                        disabled={isSelf}
                        onClick={() => { if (confirm(`Remover o acesso de ${m.user.name}?`)) removeMember.mutate(m.user.id); }}
                      >
                        <Trash2 className="h-4 w-4 text-coral-600" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && members.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-slate-400">Sem membros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}><Check className="h-4 w-4" /> Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

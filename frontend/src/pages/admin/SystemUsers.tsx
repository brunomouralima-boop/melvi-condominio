import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Search,
  KeyRound,
  Link2,
  UserCheck,
  UserX,
  Copy,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { UserPermissionsDialog } from "@/components/system/UserPermissionsDialog";
import type { Role } from "@/types";
import toast from "react-hot-toast";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Administrador",
  ADMIN_ORG: "Admin Organização",
  ADMIN: "Administrador",
  RESIDENT: "Condómino",
  DOORMAN: "Porteiro",
};
const ROLE_ORDER: Role[] = ["SUPER_ADMIN", "ADMIN_ORG", "ADMIN", "DOORMAN", "RESIDENT"];

function roleBadgeVariant(role: Role): "default" | "secondary" | "success" | "warning" | "outline" {
  if (role === "SUPER_ADMIN") return "warning";
  if (role === "ADMIN_ORG" || role === "ADMIN") return "default";
  return "secondary";
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  organization?: { id: string; name: string } | null;
  _count?: { memberships: number; permissions: number };
}
interface SystemStats {
  superAdmins: number;
  totalUsers: number;
  activeUsers: number;
}
interface ResetLinkResponse {
  resetUrl: string;
  token: string;
  expiresAt: string;
  expiresInMinutes: number;
  user: { id: string; name: string; email: string };
}

export function AdminSystemUsers() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { can, isSuperAdmin } = usePermission();
  const canWrite = can("system:write");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [permsFor, setPermsFor] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<ResetLinkResponse | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["system", "stats"],
    queryFn: () => api.get<SystemStats>("/system/stats").then((r) => r.data),
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["system", "users", { search, roleFilter, includeInactive }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter) params.set("role", roleFilter);
      if (includeInactive) params.set("includeInactive", "true");
      return api.get<SystemUser[]>(`/system/users?${params.toString()}`).then((r) => r.data);
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["system", "users"] });
    qc.invalidateQueries({ queryKey: ["system", "stats"] });
  };

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.put(`/system/users/${id}/role`, { role }),
    onSuccess: () => { toast.success("Papel actualizado"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao alterar papel"),
  });
  const activate = useMutation({
    mutationFn: (id: string) => api.patch(`/system/users/${id}/activate`),
    onSuccess: () => { toast.success("Utilizador activado"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => api.patch(`/system/users/${id}/deactivate`),
    onSuccess: () => { toast.success("Utilizador desactivado"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const genLink = useMutation({
    mutationFn: (id: string) => api.post<ResetLinkResponse>(`/users/${id}/reset-link`).then((r) => r.data),
    onSuccess: (data) => setResetLink(data),
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao gerar link"),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Sistema</h1>
          <p className="text-slate-500">Administração de utilizadores, papéis e permissões da plataforma</p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Super administradores" value={stats?.superAdmins} accent="amber" />
        <StatCard icon={<Users className="h-5 w-5" />} label="Utilizadores (total)" value={stats?.totalUsers} accent="brand" />
        <StatCard icon={<UserCheck className="h-5 w-5" />} label="Utilizadores activos" value={stats?.activeUsers} accent="emerald" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilizadores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label>Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Nome ou email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="w-52">
              <Label>Papel</Label>
              <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as "" | Role)}>
                <option value="">Todos</option>
                {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select>
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Incluir inactivos
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Utilizador</th>
                  <th className="text-left py-2 px-2">Papel</th>
                  <th className="text-left py-2 px-2">Organização</th>
                  <th className="text-right py-2 px-2">Condomínios</th>
                  <th className="text-right py-2 px-2">Excepções</th>
                  <th className="text-right py-2 px-2">Estado</th>
                  <th className="text-right py-2 px-2">Acções</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-400">A carregar…</td></tr>
                )}
                {!isLoading && users.map((u) => {
                  const isSelf = u.id === me?.id;
                  const isSuperTarget = u.role === "SUPER_ADMIN";
                  // Apenas super admins podem mexer noutro super admin.
                  const lockSuperTarget = isSuperTarget && !isSuperAdmin;
                  return (
                    <tr key={u.id} className={`border-b border-slate-100 ${!u.isActive ? "opacity-50" : ""}`}>
                      <td className="py-2 px-2">
                        <div className="font-medium text-brand-900">{u.name}{isSelf && " (você)"}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-2 px-2">
                        {canWrite && !lockSuperTarget && !isSelf ? (
                          <Select
                            className="h-9 w-48"
                            value={u.role}
                            onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value as Role })}
                          >
                            {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </Select>
                        ) : (
                          <Badge variant={roleBadgeVariant(u.role)}>{ROLE_LABELS[u.role]}</Badge>
                        )}
                      </td>
                      <td className="py-2 px-2 text-slate-700">{u.organization?.name ?? "—"}</td>
                      <td className="py-2 px-2 text-right">{u._count?.memberships ?? 0}</td>
                      <td className="py-2 px-2 text-right">
                        {u._count?.permissions ? (
                          <Badge variant="outline">{u._count.permissions}</Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Badge variant={u.isActive ? "success" : "outline"}>{u.isActive ? "Activo" : "Inactivo"}</Badge>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Permissões individuais"
                            disabled={!canWrite || isSuperTarget}
                            onClick={() => setPermsFor(u.id)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Gerar link de recuperação de senha"
                            disabled={!canWrite || !u.isActive || genLink.isPending}
                            onClick={() => genLink.mutate(u.id)}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          {u.isActive ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              title={isSelf ? "Não pode desactivar-se a si próprio" : "Desactivar"}
                              disabled={!canWrite || isSelf || lockSuperTarget || deactivate.isPending}
                              onClick={() => { if (confirm(`Desactivar ${u.name}?`)) deactivate.mutate(u.id); }}
                            >
                              <UserX className="h-4 w-4 text-coral-600" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Activar"
                              disabled={!canWrite || lockSuperTarget || activate.isPending}
                              onClick={() => activate.mutate(u.id)}
                            >
                              <UserCheck className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && users.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-400">Sem utilizadores.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {permsFor && <UserPermissionsDialog userId={permsFor} onClose={() => setPermsFor(null)} />}
      {resetLink && <ResetLinkDialog data={resetLink} onClose={() => setResetLink(null)} />}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  accent: "amber" | "brand" | "emerald";
}) {
  const accents: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700",
    brand: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <div className={`rounded-xl p-2.5 ${accents[accent]}`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold text-brand-900">{value ?? "—"}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResetLinkDialog({ data, onClose }: { data: ResetLinkResponse; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.resetUrl);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Copie manualmente.");
    }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-brand-700" /> Link de recuperação gerado
          </DialogTitle>
          <DialogDescription>
            Partilhe este link com <strong>{data.user.name}</strong> ({data.user.email}). É válido por{" "}
            {data.expiresInMinutes} minutos e só pode ser usado uma vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Link</Label>
          <div className="flex gap-2">
            <Input readOnly value={data.resetUrl} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-amber-700">
            Por segurança, este link não voltará a ser mostrado. Copie-o agora.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

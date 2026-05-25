import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Search, Plus, MoreVertical, Edit, UserPlus, Users, Power, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { FractionDrawer } from "@/components/fractions/FractionDrawer";
import { AssignDialog } from "@/components/fractions/AssignDialog";
import type { Fraction, Tower, FractionStatus } from "@/types";
import toast from "react-hot-toast";

const STATUS_VARIANT: Record<FractionStatus, "success" | "secondary" | "warning" | "destructive"> = {
  OCCUPIED: "success",
  VACANT: "secondary",
  UNDER_RENOVATION: "warning",
  BLOCKED: "destructive",
};

const STATUS_LABEL: Record<FractionStatus, string> = {
  OCCUPIED: "Ocupada",
  VACANT: "Vaga",
  UNDER_RENOVATION: "Em obras",
  BLOCKED: "Bloqueada",
};

export function AdminFractions() {
  const qc = useQueryClient();

  // Filters
  const [towerId, setTowerId] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");

  // Dialog state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Fraction | null>(null);
  const [assigning, setAssigning] = useState<{ fraction: Fraction; role: "owner" | "tenant" } | null>(null);

  const params: any = {};
  if (towerId) params.towerId = towerId;
  if (status) params.status = status;
  if (type) params.type = type;
  if (search) params.search = search;

  const { data: fractions = [] } = useQuery({
    queryKey: ["fractions", params],
    queryFn: () => api.get<Fraction[]>("/fractions", { params }).then((r) => r.data),
  });
  const { data: towers = [] } = useQuery({
    queryKey: ["towers"],
    queryFn: () => api.get<Tower[]>("/towers").then((r) => r.data),
  });

  const totalPermillage = fractions.reduce((acc, f) => acc + Number(f.permillage), 0);

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/fractions/${id}/status`, { isActive }),
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "Fracção activada" : "Fracção desactivada");
      qc.invalidateQueries({ queryKey: ["fractions"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/fractions/${id}`),
    onSuccess: () => {
      toast.success("Fracção eliminada");
      qc.invalidateQueries({ queryKey: ["fractions"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  function handleEdit(f: Fraction) {
    setEditing(f);
    setDrawerOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function handleAssign(fraction: Fraction, role: "owner" | "tenant") {
    setAssigning({ fraction, role });
  }

  function handleToggle(fraction: Fraction) {
    const action = fraction.isActive ? "desactivar" : "activar";
    if (confirm(`Deseja ${action} a fracção ${fraction.identifier}?`)) {
      toggleActive.mutate({ id: fraction.id, isActive: !fraction.isActive });
    }
  }

  function handleDelete(fraction: Fraction) {
    if (fraction.isActive) {
      toast.error("Desactive a fracção antes de eliminar");
      return;
    }
    if (confirm(`Eliminar permanentemente a fracção ${fraction.identifier}? Esta acção é irreversível.`)) {
      remove.mutate(fraction.id);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900 flex items-center gap-2">
            <Home className="h-7 w-7 text-brand-700" />
            Fracções
          </h1>
          <p className="text-slate-500">
            {fractions.length} fracção(ões) — soma de permilagens:{" "}
            <strong>{totalPermillage.toFixed(4)}‰</strong>
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4" /> Nova fracção
        </Button>
      </div>

      {Math.abs(totalPermillage - 1000) > 0.1 && fractions.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          ⚠️ A soma das permilagens é {totalPermillage.toFixed(4)}‰ — diverge de 1000‰ em {(totalPermillage - 1000).toFixed(4)}‰.
        </div>
      )}

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-4 py-4">
          <div>
            <Label>Torre</Label>
            <Select value={towerId} onChange={(e) => setTowerId(e.target.value)}>
              <option value="">Todas</option>
              {towers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Todos</option>
              <option value="APARTMENT">Apartamento</option>
              <option value="COMMERCIAL">Comercial</option>
              <option value="GARAGE">Garagem</option>
              <option value="STORAGE">Arrecadação</option>
              <option value="OTHER">Outro</option>
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="OCCUPIED">Ocupada</option>
              <option value="VACANT">Vaga</option>
              <option value="UNDER_RENOVATION">Em obras</option>
              <option value="BLOCKED">Bloqueada</option>
            </Select>
          </div>
          <div>
            <Label>Identificador</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="1A, Loja 1…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista detalhada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-2">Fracção</th>
                  <th className="text-left py-2 px-2">Torre/Piso</th>
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-right py-2 px-2">Área m²</th>
                  <th className="text-right py-2 px-2">Permilagem</th>
                  <th className="text-left py-2 px-2">Proprietário</th>
                  <th className="text-left py-2 px-2">Inquilino</th>
                  <th className="text-left py-2 px-2">Estado</th>
                  <th className="text-right py-2 px-2">Acções</th>
                </tr>
              </thead>
              <tbody>
                {fractions.map((f) => (
                  <tr key={f.id} className={`border-b border-slate-100 ${!f.isActive ? "opacity-50" : ""}`}>
                    <td className="py-2 px-2 font-medium font-display text-brand-900">{f.identifier}</td>
                    <td className="py-2 px-2 text-slate-700">{f.tower?.name} · Piso {f.floor}</td>
                    <td className="py-2 px-2"><Badge variant="outline">{f.type}</Badge></td>
                    <td className="py-2 px-2 text-right font-mono">{Number(f.areaM2)}</td>
                    <td className="py-2 px-2 text-right font-mono">{Number(f.permillage).toFixed(2)}‰</td>
                    <td className="py-2 px-2 text-slate-700">{f.owner?.name ?? <span className="text-slate-400">—</span>}</td>
                    <td className="py-2 px-2 text-slate-700">{f.tenant?.name ?? <span className="text-slate-400">—</span>}</td>
                    <td className="py-2 px-2">
                      {!f.isActive ? (
                        <Badge variant="secondary">Inactiva</Badge>
                      ) : (
                        <Badge variant={STATUS_VARIANT[f.status]}>{STATUS_LABEL[f.status]}</Badge>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="rounded-md p-1.5 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-900/20"
                            aria-label="Acções"
                          >
                            <MoreVertical className="h-4 w-4 text-slate-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acções</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => handleEdit(f)}>
                            <Edit className="h-4 w-4" /> Editar fracção
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleAssign(f, "owner")}>
                            <UserPlus className="h-4 w-4" /> Atribuir proprietário
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleAssign(f, "tenant")}>
                            <Users className="h-4 w-4" /> Atribuir inquilino
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handleToggle(f)}>
                            <Power className="h-4 w-4" /> {f.isActive ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem danger onSelect={() => handleDelete(f)} disabled={f.isActive}>
                            <Trash2 className="h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {fractions.length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-slate-400">Sem fracções.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <FractionDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        fraction={editing}
      />
      <AssignDialog
        open={!!assigning}
        onClose={() => setAssigning(null)}
        fraction={assigning?.fraction ?? null}
        role={assigning?.role ?? "owner"}
      />
    </div>
  );
}

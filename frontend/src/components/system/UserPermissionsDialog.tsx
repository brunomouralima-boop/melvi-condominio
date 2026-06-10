import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermission } from "@/lib/permissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";
import toast from "react-hot-toast";

type OverrideState = "DEFAULT" | "GRANT" | "DENY";

interface ActionDef {
  action: string;
  label: string;
}
interface ModuleDef {
  module: string;
  label: string;
  actions: ActionDef[];
}
interface CatalogResponse {
  catalog: ModuleDef[];
  roleDefaults: Record<string, string[]>;
  allKeys: string[];
}
interface UserDetailResponse {
  user: { id: string; name: string; email: string; role: Role; isActive: boolean };
  overrides: { key: string; effect: "GRANT" | "DENY" }[];
  effective: string[];
  roleDefaults: string[];
  isSuperAdmin: boolean;
}

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Administrador",
  ADMIN_ORG: "Admin Organização",
  ADMIN: "Administrador",
  RESIDENT: "Condómino",
  DOORMAN: "Porteiro",
};

export function UserPermissionsDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { isSuperAdmin: requesterIsSuper } = usePermission();
  const [state, setState] = useState<Record<string, OverrideState>>({});

  const { data: catalog } = useQuery({
    queryKey: ["system", "catalog"],
    queryFn: () => api.get<CatalogResponse>("/system/permissions/catalog").then((r) => r.data),
  });
  const { data: detail, isLoading } = useQuery({
    queryKey: ["system", "user", userId],
    queryFn: () => api.get<UserDetailResponse>(`/system/users/${userId}`).then((r) => r.data),
  });

  // Inicializa o estado local a partir dos overrides actuais do utilizador.
  useEffect(() => {
    if (!detail) return;
    const next: Record<string, OverrideState> = {};
    for (const o of detail.overrides) next[o.key] = o.effect;
    setState(next);
  }, [detail]);

  const defaultsSet = useMemo(() => new Set(detail?.roleDefaults ?? []), [detail]);

  const save = useMutation({
    mutationFn: () => {
      const overrides = Object.entries(state)
        .filter(([, v]) => v !== "DEFAULT")
        .map(([key, v]) => ({ key, effect: v as "GRANT" | "DENY" }));
      return api.put(`/system/users/${userId}/permissions`, { overrides });
    },
    onSuccess: () => {
      toast.success("Permissões actualizadas");
      qc.invalidateQueries({ queryKey: ["system", "user", userId] });
      qc.invalidateQueries({ queryKey: ["system", "users"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao guardar"),
  });

  const set = (key: string, value: OverrideState) => setState((s) => ({ ...s, [key]: value }));
  const resetAll = () => setState({});

  const isSuper = detail?.isSuperAdmin;
  const overrideCount = Object.values(state).filter((v) => v !== "DEFAULT").length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-700" />
            Permissões — {detail?.user.name ?? "…"}
          </DialogTitle>
          <DialogDescription>
            {detail ? (
              <>
                Papel base: <strong>{ROLE_LABELS[detail.user.role]}</strong>. As permissões começam nos valores
                padrão do papel; pode <strong>Permitir</strong> ou <strong>Negar</strong> individualmente.
              </>
            ) : (
              "A carregar…"
            )}
          </DialogDescription>
        </DialogHeader>

        {isSuper ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            O super administrador tem <strong>todas as permissões</strong> da plataforma. Não é possível (nem
            necessário) configurar permissões individuais.
          </div>
        ) : isLoading || !catalog || !detail ? (
          <div className="py-10 text-center text-slate-400">A carregar permissões…</div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">Módulo</th>
                  <th className="text-left py-2 px-3 font-medium">Permissão</th>
                  <th className="text-right py-2 px-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {catalog.catalog.map((m) =>
                  m.actions.map((a, ai) => {
                    const key = `${m.module}:${a.action}`;
                    const def = defaultsSet.has(key);
                    const value = state[key] ?? "DEFAULT";
                    const isSystemKey = key === "system:read" || key === "system:write";
                    const lockSystemGrant = isSystemKey && !requesterIsSuper;
                    return (
                      <tr key={key} className="border-t border-slate-100">
                        {ai === 0 ? (
                          <td
                            className="py-2 px-3 align-top font-medium text-brand-900"
                            rowSpan={m.actions.length}
                          >
                            {m.label}
                          </td>
                        ) : null}
                        <td className="py-2 px-3 text-slate-700">
                          {a.label}
                          {def ? (
                            <Badge variant="secondary" className="ml-2">padrão: Sim</Badge>
                          ) : (
                            <Badge variant="outline" className="ml-2">padrão: Não</Badge>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex justify-end">
                            <TriToggle
                              value={value}
                              defaultAllowed={def}
                              disableGrant={lockSystemGrant}
                              onChange={(v) => set(key, v)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <div className="text-xs text-slate-400">
            {!isSuper && <>{overrideCount} excepção(ões) sobre o padrão do papel</>}
          </div>
          <div className="flex gap-2">
            {!isSuper && (
              <Button type="button" variant="ghost" onClick={resetAll} disabled={overrideCount === 0}>
                <RotateCcw className="h-4 w-4" /> Repor padrão
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            {!isSuper && (
              <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "A guardar…" : "Guardar permissões"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TriToggle({
  value,
  defaultAllowed,
  disableGrant,
  onChange,
}: {
  value: OverrideState;
  defaultAllowed: boolean;
  disableGrant?: boolean;
  onChange: (v: OverrideState) => void;
}) {
  const options: { v: OverrideState; label: string; cls: string }[] = [
    { v: "DEFAULT", label: `Padrão (${defaultAllowed ? "Sim" : "Não"})`, cls: "data-[on=true]:bg-slate-200 data-[on=true]:text-slate-800" },
    { v: "GRANT", label: "Permitir", cls: "data-[on=true]:bg-emerald-100 data-[on=true]:text-emerald-800" },
    { v: "DENY", label: "Negar", cls: "data-[on=true]:bg-coral-100 data-[on=true]:text-coral-800" },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
      {options.map((o) => {
        const disabled = o.v === "GRANT" && disableGrant;
        return (
          <button
            key={o.v}
            type="button"
            data-on={value === o.v}
            disabled={disabled}
            title={disabled ? "Apenas um super administrador pode conceder esta permissão" : undefined}
            onClick={() => onChange(o.v)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50",
              "border-l border-slate-200 first:border-l-0 disabled:cursor-not-allowed disabled:opacity-40",
              o.cls
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

import { useState } from "react";
import { Building2, ChevronsUpDown, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Selector de condomínio activo (multi-tenant). Só aparece quando o utilizador
 * tem acesso a mais do que um condomínio (ex.: ADMIN_ORG). Trocar invalida a
 * cache e recarrega os dados no contexto do novo condomínio.
 */
export function CondoSwitcher() {
  const { condominiums, activeCondominiumId, setActiveCondominium } = useAuth();
  const [switching, setSwitching] = useState(false);

  if (condominiums.length <= 1) return null;

  const active = condominiums.find((c) => c.id === activeCondominiumId);

  const onSelect = async (id: string) => {
    if (id === activeCondominiumId || switching) return;
    setSwitching(true);
    try {
      await setActiveCondominium(id);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="border-b border-brand-800 px-3 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={switching}
            className={cn(
              "w-full flex items-center gap-2 rounded-lg border border-brand-800 bg-brand-800/40 px-3 py-2 text-left",
              "text-sm text-white hover:bg-brand-800 transition-colors disabled:opacity-60"
            )}
          >
            <Building2 className="h-4 w-4 shrink-0 text-coral-400" />
            <span className="flex-1 min-w-0 truncate font-medium">
              {switching ? "A trocar…" : active?.name ?? "Seleccionar condomínio"}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[232px]">
          <DropdownMenuLabel>Condomínio</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {condominiums.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onSelect={(e) => {
                e.preventDefault();
                onSelect(c.id);
              }}
              className="justify-between"
            >
              <span className="truncate">{c.name}</span>
              {c.id === activeCondominiumId && <Check className="h-4 w-4 text-brand-700" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

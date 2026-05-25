import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, UserCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@/types";

interface Props {
  /** Currently selected user (read-only display). null = nothing selected. */
  value: AuthUser | null;
  onChange: (user: AuthUser | null) => void;
  /** Visual variant for the selected chip */
  variant?: "owner" | "tenant";
  /** Exclude these user IDs from the search results */
  excludeUserIds?: string[];
  label?: string;
  placeholder?: string;
}

const VARIANT_BADGE = {
  owner: "bg-brand-100 text-brand-800 border-brand-200",
  tenant: "bg-emerald-100 text-emerald-800 border-emerald-200",
} as const;

const VARIANT_LABEL = {
  owner: "Proprietário",
  tenant: "Inquilino",
} as const;

export function UserPicker({ value, onChange, variant = "owner", excludeUserIds = [], label, placeholder }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["users-resident-search", search],
    queryFn: () =>
      api
        .get<AuthUser[]>("/users", { params: { role: "RESIDENT", search: search || undefined } })
        .then((r) => r.data),
    enabled: open,
  });

  const filtered = users.filter((u) => !excludeUserIds.includes(u.id));

  if (value) {
    return (
      <div className="space-y-1.5">
        {label && <div className="text-sm font-medium text-slate-700">{label}</div>}
        <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${VARIANT_BADGE[variant]}`}>
          <UserCircle2 className="h-5 w-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{value.name}</div>
            <div className="text-xs opacity-80 truncate">{value.email}</div>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
            {VARIANT_LABEL[variant]}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-0.5 rounded hover:bg-white/40 transition-colors"
            aria-label="Remover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label && <div className="text-sm font-medium text-slate-700">{label}</div>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder={placeholder ?? "Pesquisar residente por nome ou email…"}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && search.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">Nenhum residente encontrado.</div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange(u);
                  setSearch("");
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-2"
              >
                <UserCircle2 className="h-5 w-5 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-brand-900 truncate">{u.name}</div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
      {open && search.length === 0 && (
        <p className="text-xs text-slate-400">Digite o nome ou email para pesquisar.</p>
      )}
      {open && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Fechar pesquisa
        </Button>
      )}
    </div>
  );
}

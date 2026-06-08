import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Cmd { label: string; to: string; role: string }

const COMMANDS: Cmd[] = [
  // Admin
  { label: "Dashboard", to: "/admin", role: "ADMIN" },
  { label: "Condóminos", to: "/admin/residents", role: "ADMIN" },
  { label: "Frações", to: "/admin/fractions", role: "ADMIN" },
  { label: "Torres", to: "/admin/towers", role: "ADMIN" },
  { label: "Configuração do condomínio", to: "/admin/condominium", role: "ADMIN" },
  { label: "Ocorrências", to: "/admin/occurrences", role: "ADMIN" },
  { label: "Alertas de Pânico", to: "/admin/panic-alerts", role: "ADMIN" },
  { label: "Controlo de Acesso", to: "/admin/access", role: "ADMIN" },
  { label: "Visitas", to: "/admin/visits", role: "ADMIN" },
  { label: "Comunicados", to: "/admin/announcements", role: "ADMIN" },
  { label: "Documentos", to: "/admin/documents", role: "ADMIN" },
  { label: "Assembleias", to: "/admin/assemblies", role: "ADMIN" },
  { label: "Áreas Comuns", to: "/admin/common-areas", role: "ADMIN" },
  { label: "Financeiro · Lançamentos & Cobranças", to: "/admin/financial", role: "ADMIN" },
  { label: "Financeiro · Inadimplência", to: "/admin/delinquency", role: "ADMIN" },
  { label: "Financeiro · Relatórios", to: "/admin/financial-reports", role: "ADMIN" },
  { label: "Encomendas", to: "/admin/packages", role: "ADMIN" },
  { label: "Manutenção · Ordens", to: "/admin/maintenance", role: "ADMIN" },
  { label: "Manutenção · Preventiva", to: "/admin/maintenance/preventive", role: "ADMIN" },
  { label: "Manutenção · Fornecedores", to: "/admin/maintenance/suppliers", role: "ADMIN" },
  { label: "Medidores", to: "/admin/meters", role: "ADMIN" },
  { label: "Definições", to: "/admin/settings", role: "ADMIN" },
  // Residente
  { label: "Dashboard", to: "/resident", role: "RESIDENT" },
  { label: "Ocorrências", to: "/resident/occurrences", role: "RESIDENT" },
  { label: "Acessos QR", to: "/resident/access-codes", role: "RESIDENT" },
  { label: "Visitas", to: "/resident/visits", role: "RESIDENT" },
  { label: "Dependentes", to: "/resident/dependents", role: "RESIDENT" },
  { label: "Funcionários", to: "/resident/employees", role: "RESIDENT" },
  { label: "Viaturas", to: "/resident/vehicles", role: "RESIDENT" },
  { label: "Animais", to: "/resident/pets", role: "RESIDENT" },
  { label: "Documentos", to: "/resident/documents", role: "RESIDENT" },
  { label: "Assembleias", to: "/resident/assemblies", role: "RESIDENT" },
  { label: "Financeiro", to: "/resident/financial", role: "RESIDENT" },
  { label: "Reservas", to: "/resident/reservations", role: "RESIDENT" },
  { label: "Informações", to: "/resident/info", role: "RESIDENT" },
  // Porteiro
  { label: "Controlo de Acesso", to: "/doorman", role: "DOORMAN" },
  { label: "Scanner QR", to: "/doorman/scanner", role: "DOORMAN" },
  { label: "Visitas", to: "/doorman/visits", role: "DOORMAN" },
  { label: "Encomendas", to: "/doorman/packages", role: "DOORMAN" },
];

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!user) return [];
    const base = COMMANDS.filter((c) => c.role === user.role);
    const q = norm(query.trim());
    if (!q) return base;
    return base.filter((c) => norm(c.label).includes(q));
  }, [user, query]);

  useEffect(() => setActive(0), [query]);

  if (!open || !user) return null;

  const go = (c: Cmd) => { navigate(c.to); setOpen(false); };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[15vh] animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (results[active]) go(results[active]); }
            }}
            placeholder="Procurar páginas…"
            className="flex-1 bg-transparent py-3 text-sm outline-none"
          />
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {results.map((c, i) => (
            <button
              key={c.to + c.label}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(c)}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${i === active ? "bg-brand-50 text-brand-900" : "text-slate-700"}`}
            >
              <span>{c.label}</span>
              {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-slate-400" />}
            </button>
          ))}
          {results.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Nada encontrado.</div>}
        </div>
      </div>
    </div>
  );
}

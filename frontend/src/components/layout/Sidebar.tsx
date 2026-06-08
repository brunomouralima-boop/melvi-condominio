import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, ChevronDown, ChevronRight, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { CondoSwitcher } from "./CondoSwitcher";

export interface SidebarItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

export interface SidebarGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SidebarItem[];
  defaultOpen?: boolean;
}

export type SidebarEntry = SidebarItem | SidebarGroup;

function isGroup(e: SidebarEntry): e is SidebarGroup {
  return (e as any).items !== undefined;
}

interface SidebarProps {
  items: SidebarEntry[];
  title: string;
  accent?: "default" | "doorman";
  /** Mobile open state (controlled by parent layout) */
  isOpen?: boolean;
  /** Called when user clicks backdrop or close button (mobile only) */
  onClose?: () => void;
}

export function Sidebar({ items, title, accent = "default", isOpen = false, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile backdrop — só aparece quando sidebar está aberta em mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          // Base: 256px de largura, full-height, scroll vertical
          "flex h-screen w-64 flex-col bg-brand-900 text-slate-200",
          // Desktop (md+): posição estática, sempre visível
          "md:static md:translate-x-0 md:flex",
          // Mobile: fixed off-canvas, transição suave
          "fixed top-0 left-0 z-50 transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 px-6 py-5 border-b border-brand-800">
          <div className="flex-1 min-w-0">
            <BrandLogo variant="white" className="h-8" />
            <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-400">{title}</div>
          </div>
          {/* Botão fechar (só visível em mobile, quando aberta) */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 -mr-1.5 rounded-md text-slate-400 hover:text-white hover:bg-brand-800"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Selector de condomínio activo (multi-tenant) — auto-esconde se ≤1 */}
        <CondoSwitcher />
        <nav className={cn("flex-1 overflow-y-auto px-3 py-4 space-y-1", accent === "doorman" && "text-base")}>
          {items.map((entry, idx) =>
            isGroup(entry) ? (
              <SidebarGroupItem key={idx} group={entry} accent={accent} />
            ) : (
              <SidebarLink key={entry.to} item={entry} accent={accent} />
            )
          )}
        </nav>
        <div className="border-t border-brand-800 px-3 py-3">
          <div className="px-3 py-2">
            <div className="text-sm font-medium text-white truncate">{user?.name}</div>
            <div className="text-xs text-slate-400 truncate">{user?.email}</div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-300 hover:bg-brand-800 hover:text-white"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({ item, accent }: { item: SidebarItem; accent: "default" | "doorman" }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-brand-800 text-white" : "text-slate-300 hover:bg-brand-800/60 hover:text-white",
          accent === "doorman" && "py-3 text-base"
        )
      }
    >
      <item.icon className={cn("h-5 w-5", accent === "doorman" && "h-6 w-6")} />
      {item.label}
    </NavLink>
  );
}

function SidebarGroupItem({ group, accent }: { group: SidebarGroup; accent: "default" | "doorman" }) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-brand-800/60 hover:text-white",
          accent === "doorman" && "py-3 text-base"
        )}
      >
        <span className="flex items-center gap-3">
          <group.icon className={cn("h-5 w-5", accent === "doorman" && "h-6 w-6")} />
          {group.label}
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="mt-1 ml-3 pl-3 border-l border-brand-800 space-y-1">
          {group.items.map((it) => (
            <SidebarLink key={it.to} item={it} accent={accent} />
          ))}
        </div>
      )}
    </div>
  );
}

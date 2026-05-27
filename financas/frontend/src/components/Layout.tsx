import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Tags, Landmark, Settings, LogOut, Menu, X, PiggyBank,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../contexts/AuthContext";

const nav = [
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/contas", label: "Contas", icon: Wallet },
  { to: "/categorias", label: "Categorias", icon: Tags },
  { to: "/patrimonio", label: "Património", icon: Landmark },
  { to: "/definicoes", label: "Definições", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 text-slate-200 transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5 text-white">
          <PiggyBank className="h-7 w-7 text-brand" />
          <div>
            <div className="text-base font-bold leading-tight">Finanças</div>
            <div className="text-xs text-slate-400">& Património</div>
          </div>
        </div>
        <nav className="mt-2 space-y-1 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive ? "bg-brand text-white" : "text-slate-300 hover:bg-slate-800"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-slate-800 p-4">
          <div className="mb-2 text-sm text-slate-300">{user?.name}</div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen((v) => !v)} className="text-slate-600">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <span className="font-semibold">Finanças & Património</span>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

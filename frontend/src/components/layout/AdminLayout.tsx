import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building,
  AlertTriangle,
  Siren,
  ShieldCheck,
  Megaphone,
  Calendar,
  Wallet,
  Package,
  Settings,
  Gauge,
  Layers,
  Home,
  Droplets,
  Zap,
  Cog,
  Fuel,
} from "lucide-react";
import { Sidebar, SidebarEntry } from "./Sidebar";
import { MobileTopbar } from "./MobileTopbar";
import { PanicAlertListener } from "../PanicAlertListener";

const entries: SidebarEntry[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  {
    label: "Condomínio",
    icon: Building,
    items: [
      { to: "/admin/condominium", label: "Configuração Geral", icon: Settings },
      { to: "/admin/towers", label: "Torres", icon: Layers },
      { to: "/admin/fractions", label: "Fracções", icon: Home },
    ],
  },
  { to: "/admin/residents", label: "Condóminos", icon: Users },
  { to: "/admin/occurrences", label: "Ocorrências", icon: AlertTriangle },
  { to: "/admin/panic-alerts", label: "Alertas de Pânico", icon: Siren },
  { to: "/admin/access", label: "Controlo de Acesso", icon: ShieldCheck },
  { to: "/admin/announcements", label: "Comunicados", icon: Megaphone },
  { to: "/admin/common-areas", label: "Áreas Comuns", icon: Calendar },
  { to: "/admin/financial", label: "Financeiro", icon: Wallet },
  { to: "/admin/packages", label: "Encomendas", icon: Package },
  {
    label: "Medidores",
    icon: Gauge,
    items: [
      { to: "/admin/meters/water", label: "Contadores EPAL", icon: Droplets },
      { to: "/admin/meters/electricity", label: "Contadores ENDE", icon: Zap },
      { to: "/admin/meters/generator", label: "Geradores", icon: Cog },
      { to: "/admin/meters/fuel", label: "Gasóleo", icon: Fuel },
    ],
  },
  { to: "/admin/settings", label: "Configurações", icon: Settings },
];

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Fechar sidebar quando o utilizador navega para outra página (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={entries}
        title="Administrador"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 overflow-y-auto bg-slate-50 min-w-0">
        <MobileTopbar title="Administrador" onMenuClick={() => setSidebarOpen(true)} />
        <PanicAlertListener />
        <Outlet />
      </main>
    </div>
  );
}

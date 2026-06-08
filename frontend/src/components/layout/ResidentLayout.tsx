import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Briefcase,
  Car,
  QrCode,
  Info,
  Wallet,
  Calendar,
  FolderOpen,
} from "lucide-react";
import { Sidebar, SidebarEntry } from "./Sidebar";
import { MobileTopbar } from "./MobileTopbar";

const items: SidebarEntry[] = [
  { to: "/resident", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/resident/occurrences", label: "Ocorrências", icon: AlertTriangle },
  { to: "/resident/access-codes", label: "Acessos QR", icon: QrCode },
  { to: "/resident/visits", label: "Visitas", icon: Users },
  { to: "/resident/dependents", label: "Dependentes", icon: Users },
  { to: "/resident/employees", label: "Funcionários", icon: Briefcase },
  { to: "/resident/vehicles", label: "Viaturas", icon: Car },
  { to: "/resident/documents", label: "Documentos", icon: FolderOpen },
  { to: "/resident/info", label: "Informações", icon: Info },
  { to: "/resident/financial", label: "Financeiro", icon: Wallet },
  { to: "/resident/reservations", label: "Reservas", icon: Calendar },
];

export function ResidentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={items}
        title="Condómino"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 overflow-y-auto bg-slate-50 min-w-0">
        <MobileTopbar title="Condómino" onMenuClick={() => setSidebarOpen(true)} />
        <Outlet />
      </main>
    </div>
  );
}

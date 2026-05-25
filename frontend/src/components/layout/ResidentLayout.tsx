import { Outlet } from "react-router-dom";
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
} from "lucide-react";
import { Sidebar, SidebarEntry } from "./Sidebar";

const items: SidebarEntry[] = [
  { to: "/resident", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/resident/occurrences", label: "Ocorrências", icon: AlertTriangle },
  { to: "/resident/access-codes", label: "Acessos QR", icon: QrCode },
  { to: "/resident/dependents", label: "Dependentes", icon: Users },
  { to: "/resident/employees", label: "Funcionários", icon: Briefcase },
  { to: "/resident/vehicles", label: "Viaturas", icon: Car },
  { to: "/resident/info", label: "Informações", icon: Info },
  { to: "/resident/financial", label: "Financeiro", icon: Wallet },
  { to: "/resident/reservations", label: "Reservas", icon: Calendar },
];

export function ResidentLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} title="Condómino" />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}

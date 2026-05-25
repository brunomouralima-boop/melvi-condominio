import { Outlet } from "react-router-dom";
import { LayoutDashboard, QrCode, Package } from "lucide-react";
import { Sidebar, SidebarEntry } from "./Sidebar";
import { PanicAlertListener } from "../PanicAlertListener";

const items: SidebarEntry[] = [
  { to: "/doorman", label: "Controlo de Acesso", icon: LayoutDashboard, end: true },
  { to: "/doorman/scanner", label: "Scanner QR", icon: QrCode },
  { to: "/doorman/packages", label: "Encomendas", icon: Package },
];

export function DoormanLayout() {
  return (
    <div className="flex min-h-screen text-lg">
      <Sidebar items={items} title="Porteiro" accent="doorman" />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <PanicAlertListener doormanMode />
        <Outlet />
      </main>
    </div>
  );
}

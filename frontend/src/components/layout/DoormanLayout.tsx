import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, QrCode, Package } from "lucide-react";
import { Sidebar, SidebarEntry } from "./Sidebar";
import { MobileTopbar } from "./MobileTopbar";
import { PanicAlertListener } from "../PanicAlertListener";

const items: SidebarEntry[] = [
  { to: "/doorman", label: "Controlo de Acesso", icon: LayoutDashboard, end: true },
  { to: "/doorman/scanner", label: "Scanner QR", icon: QrCode },
  { to: "/doorman/packages", label: "Encomendas", icon: Package },
];

export function DoormanLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen text-lg">
      <Sidebar
        items={items}
        title="Porteiro"
        accent="doorman"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 overflow-y-auto bg-slate-50 min-w-0">
        <MobileTopbar title="Porteiro" onMenuClick={() => setSidebarOpen(true)} />
        <PanicAlertListener doormanMode />
        <Outlet />
      </main>
    </div>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import { LoginPage } from "@/pages/Login";
import { PackagesPage } from "@/pages/Packages";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { ResidentLayout } from "@/components/layout/ResidentLayout";
import { DoormanLayout } from "@/components/layout/DoormanLayout";

import { AdminDashboard } from "@/pages/admin/Dashboard";
import { AdminResidents } from "@/pages/admin/Residents";
import { AdminUnits } from "@/pages/admin/Units"; // listagem por torre (legacy)
import { AdminOccurrences } from "@/pages/admin/Occurrences";
import { AdminPanicAlerts } from "@/pages/admin/PanicAlerts";
import { AdminAnnouncements } from "@/pages/admin/Announcements";
import { AdminAccessLogs } from "@/pages/admin/AccessLogs";
import { AdminCommonAreas } from "@/pages/admin/CommonAreas";
import { AdminFinancial } from "@/pages/admin/Financial";
import { AdminDelinquency } from "@/pages/admin/Delinquency";
import { AdminReports } from "@/pages/admin/Reports";
import { AdminMaintenance } from "@/pages/admin/Maintenance";
import { AdminPreventiveMaintenance } from "@/pages/admin/PreventiveMaintenance";
import { AdminSuppliers } from "@/pages/admin/Suppliers";
import { AdminDocuments } from "@/pages/admin/Documents";
import { ResidentDocuments } from "@/pages/resident/Documents";
import { AdminAssemblies } from "@/pages/admin/Assemblies";
import { AdminAssemblyDetail } from "@/pages/admin/AssemblyDetail";
import { ResidentAssemblies } from "@/pages/resident/Assemblies";
import { ResidentAssemblyDetail } from "@/pages/resident/AssemblyDetail";
import { ResidentPets } from "@/pages/resident/Pets";
import { AdminSettings } from "@/pages/admin/Settings";
import { AdminCondominium } from "@/pages/admin/Condominium";
import { AdminTowers } from "@/pages/admin/Towers";
import { AdminFractions } from "@/pages/admin/Fractions";
import { AdminMeters } from "@/pages/admin/Meters";
import { VisitsHistoryPage } from "@/pages/admin/VisitsHistory";

import { ResidentDashboard } from "@/pages/resident/Dashboard";
import { ResidentOccurrences } from "@/pages/resident/Occurrences";
import { ResidentAccessCodes } from "@/pages/resident/AccessCodes";
import { ResidentDependents } from "@/pages/resident/Dependents";
import { ResidentEmployees } from "@/pages/resident/Employees";
import { ResidentVehicles } from "@/pages/resident/Vehicles";
import { ResidentInfo } from "@/pages/resident/Info";
import { ResidentFinancial } from "@/pages/resident/Financial";
import { ResidentReservations } from "@/pages/resident/Reservations";
import { ResidentVisits } from "@/pages/resident/Visits";

import { DoormanDashboard } from "@/pages/doorman/Dashboard";
import { CommandPalette } from "@/components/CommandPalette";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30_000, retry: 1 },
  },
});

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-slate-400">A carregar…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "ADMIN" ? "/admin" : user.role === "DOORMAN" ? "/doorman" : "/resident"} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <Toaster position="top-right" />
            <CommandPalette />
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={["ADMIN"]}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="condominium" element={<AdminCondominium />} />
                <Route path="towers" element={<AdminTowers />} />
                <Route path="fractions" element={<AdminFractions />} />
                <Route path="residents" element={<AdminResidents />} />
                <Route path="units" element={<Navigate to="/admin/fractions" replace />} />
                <Route path="units-by-tower" element={<AdminUnits />} />
                <Route path="occurrences" element={<AdminOccurrences />} />
                <Route path="panic-alerts" element={<AdminPanicAlerts />} />
                <Route path="access" element={<AdminAccessLogs />} />
                <Route path="visits" element={<VisitsHistoryPage />} />
                <Route path="announcements" element={<AdminAnnouncements />} />
                <Route path="documents" element={<AdminDocuments />} />
                <Route path="assemblies" element={<AdminAssemblies />} />
                <Route path="assemblies/:id" element={<AdminAssemblyDetail />} />
                <Route path="common-areas" element={<AdminCommonAreas />} />
                <Route path="financial" element={<AdminFinancial />} />
                <Route path="delinquency" element={<AdminDelinquency />} />
                <Route path="financial-reports" element={<AdminReports />} />
                <Route path="packages" element={<PackagesPage />} />
                <Route path="maintenance" element={<AdminMaintenance />} />
                <Route path="maintenance/preventive" element={<AdminPreventiveMaintenance />} />
                <Route path="maintenance/suppliers" element={<AdminSuppliers />} />
                <Route path="meters" element={<Navigate to="/admin/meters/water" replace />} />
                <Route path="meters/:type" element={<AdminMeters />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              <Route
                path="/resident"
                element={
                  <ProtectedRoute roles={["RESIDENT"]}>
                    <ResidentLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<ResidentDashboard />} />
                <Route path="occurrences" element={<ResidentOccurrences />} />
                <Route path="access-codes" element={<ResidentAccessCodes />} />
                <Route path="dependents" element={<ResidentDependents />} />
                <Route path="employees" element={<ResidentEmployees />} />
                <Route path="vehicles" element={<ResidentVehicles />} />
                <Route path="pets" element={<ResidentPets />} />
                <Route path="documents" element={<ResidentDocuments />} />
                <Route path="assemblies" element={<ResidentAssemblies />} />
                <Route path="assemblies/:id" element={<ResidentAssemblyDetail />} />
                <Route path="info" element={<ResidentInfo />} />
                <Route path="financial" element={<ResidentFinancial />} />
                <Route path="reservations" element={<ResidentReservations />} />
                <Route path="visits" element={<ResidentVisits />} />
              </Route>

              <Route
                path="/doorman"
                element={
                  <ProtectedRoute roles={["DOORMAN"]}>
                    <DoormanLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DoormanDashboard />} />
                <Route path="scanner" element={<DoormanDashboard />} />
                <Route path="visits" element={<VisitsHistoryPage />} />
                <Route path="packages" element={<PackagesPage />} />
              </Route>

              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types";

interface Props {
  children: ReactNode;
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        <div>A carregar…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) {
    const isAdmin = user.role === "ADMIN" || user.role === "ADMIN_ORG";
    const home = isAdmin ? "/admin" : user.role === "DOORMAN" ? "/doorman" : "/resident";
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}

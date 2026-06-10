import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminRole, userCan } from "@/lib/permissions";
import type { Role } from "@/types";

interface Props {
  children: ReactNode;
  /** Restringe a rota a estes papéis (o SUPER_ADMIN é sempre admitido). */
  roles?: Role[];
  /** Restringe a rota a quem tem esta permissão `modulo:accao`. */
  permission?: string;
}

export function ProtectedRoute({ children, roles, permission }: Props) {
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

  const isAdmin = isAdminRole(user.role);
  const home = isAdmin ? "/admin" : user.role === "DOORMAN" ? "/doorman" : "/resident";

  // O super admin tem acesso transversal: nunca é barrado por `roles`.
  if (roles && !roles.includes(user.role) && user.role !== "SUPER_ADMIN") {
    return <Navigate to={home} replace />;
  }
  if (permission && !userCan(user, permission)) {
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}

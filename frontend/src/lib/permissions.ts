// ────────────────────────────────────────────────────────────────────────────
// Permissões no front-end (apenas para mostrar/esconder UI).
//
// A AUTORIZAÇÃO REAL é sempre feita no back-end (requirePermission + authorize).
// Aqui usamos as permissões efectivas que o /auth/me devolve (já resolvidas no
// servidor: defaults do papel + overlay GRANT/DENY) para decidir o que renderizar.
// ────────────────────────────────────────────────────────────────────────────
import type { AuthUser, Role } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

/** Papéis considerados "administração" (acedem ao painel /admin). */
export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_ORG", "ADMIN"];

/** true se o papel pertence à administração (síndico, org ou super admin). */
export function isAdminRole(role?: Role | null): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

/** true se o utilizador é super administrador da plataforma. */
export function isSuperAdmin(user?: AuthUser | null): boolean {
  return !!user && (user.isSuperAdmin === true || user.role === "SUPER_ADMIN");
}

/**
 * Verifica se o utilizador tem uma permissão `modulo:accao`.
 * O super admin tem sempre tudo. Caso o back-end (ainda) não envie `permissions`,
 * caímos para uma heurística por papel para não quebrar a UI.
 */
export function userCan(user: AuthUser | null | undefined, key: string): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (Array.isArray(user.permissions)) return user.permissions.includes(key);
  // Fallback defensivo (servidor antigo sem `permissions`): admins de condomínio
  // têm tudo excepto o módulo "system".
  if (isAdminRole(user.role)) return !key.startsWith("system:");
  return false;
}

/** Hook que devolve um predicado `can(key)` ligado ao utilizador autenticado. */
export function usePermission(): {
  can: (key: string) => boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  user: AuthUser | null;
} {
  const { user } = useAuth();
  return {
    can: (key: string) => userCan(user, key),
    isSuperAdmin: isSuperAdmin(user),
    isAdmin: isAdminRole(user?.role),
    user,
  };
}

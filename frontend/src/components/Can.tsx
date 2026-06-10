import { ReactNode } from "react";
import { usePermission } from "@/lib/permissions";

interface CanProps {
  /** Chave de permissão `modulo:accao` (ex.: "system:write"). */
  permission: string;
  /** Conteúdo mostrado quando o utilizador TEM a permissão. */
  children: ReactNode;
  /** Conteúdo alternativo opcional quando NÃO tem a permissão. */
  fallback?: ReactNode;
}

/**
 * Renderiza `children` apenas se o utilizador autenticado tiver a permissão.
 * Apenas para UI — a autorização real é garantida no back-end.
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = usePermission();
  return <>{can(permission) ? children : fallback}</>;
}

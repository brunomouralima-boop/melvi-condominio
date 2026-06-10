import { NextFunction, Request, Response } from "express";
import { prisma } from "../prisma";
import { hasPermission, isSuperAdmin, PermissionOverride } from "../auth/permissions";

/**
 * Middleware de autorização fina por permissão `modulo:accao`.
 *
 * A decisão é SEMPRE feita no back-end (nunca confiar só no front):
 *   - SUPER_ADMIN passa sempre.
 *   - Caso contrário, resolve as permissões efectivas a partir dos defaults do
 *     papel (do JWT) + overlay individual (tabela UserPermission, lido da BD a
 *     cada pedido para não depender de tokens potencialmente desatualizados).
 *
 * Usar DEPOIS de `authenticate`. Tipicamente combinado com `authorize(role)`
 * como rede de segurança a nível de papel.
 */
export function requirePermission(key: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (isSuperAdmin(req.user.role)) return next();

    try {
      const rows = await prisma.userPermission.findMany({
        where: { userId: req.user.sub },
        select: { key: true, effect: true },
      });
      const overrides: PermissionOverride[] = rows.map((r) => ({
        key: r.key,
        effect: r.effect === "DENY" ? "DENY" : "GRANT",
      }));

      if (hasPermission(req.user.role, overrides, key)) {
        return next();
      }
      return res.status(403).json({ error: "Forbidden", missingPermission: key });
    } catch (e) {
      next(e);
    }
  };
}

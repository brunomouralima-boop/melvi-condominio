import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken, JWTPayload } from "../utils/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ADMIN_ORG é, para efeitos de dados, um administrador (do condomínio activo).
// O SUPER_ADMIN (staff da plataforma) é também tratado como administrador.
// Usar em verificações de scope/ownership para não despromover estes papéis a
// "só os seus registos" (a `authorize()` já os deixa passar nestas rotas).
export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN || role === Role.ADMIN_ORG || role === Role.SUPER_ADMIN;
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    // SUPER_ADMIN (plataforma, acima de todas as organizações) passa sempre.
    if (req.user.role === Role.SUPER_ADMIN) {
      return next();
    }
    // ADMIN_ORG herda os poderes de ADMIN: em qualquer rota que permita ADMIN,
    // o ADMIN_ORG também passa (administra qualquer condomínio da sua organização,
    // limitado ao condomínio activo por `resolveCondominium`/`tenantWhere`).
    if (req.user.role === Role.ADMIN_ORG && roles.includes(Role.ADMIN)) {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

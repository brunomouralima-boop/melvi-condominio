import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { config } from "../config";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Condomínio activo do pedido (para scoping multi-tenant). */
      condominiumId?: string;
      /** Todos os condomínios a que o utilizador tem acesso. */
      accessibleCondominiumIds?: string[];
    }
  }
}

/**
 * Resolve o condomínio activo do pedido (multi-tenant).
 *
 * - SUPER_ADMIN → todos os condomínios activos da plataforma (todas as orgs).
 * - ADMIN_ORG → todos os condomínios da sua organização.
 * - Restantes papéis → condomínios em que têm Membership.
 * - Fallback (pré-backfill / 1 condomínio) → o único condomínio existente.
 *
 * O condomínio activo é escolhido por header `x-condominium-id` (ou query
 * `?condominiumId`), validado contra os acessíveis; senão usa o primeiro.
 *
 * Deve correr SEMPRE depois de `authenticate`.
 */
export async function resolveCondominium(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next();
  try {
    let accessible: string[] = [];

    if (req.user.role === Role.SUPER_ADMIN) {
      // Plataforma: vê todos os condomínios activos, de qualquer organização.
      const condos = await prisma.condominium.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      accessible = condos.map((c) => c.id);
    } else if (req.user.role === Role.ADMIN_ORG) {
      const u = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { organizationId: true },
      });
      if (u?.organizationId) {
        const condos = await prisma.condominium.findMany({
          where: { organizationId: u.organizationId, isActive: true },
          select: { id: true },
        });
        accessible = condos.map((c) => c.id);
      }
    } else {
      const memberships = await prisma.membership.findMany({
        where: { userId: req.user.sub },
        select: { condominiumId: true },
      });
      accessible = memberships.map((m) => m.condominiumId);
    }

    // Fallback: ainda sem membership (pré-backfill) e existe só 1 condomínio
    if (accessible.length === 0) {
      const condos = await prisma.condominium.findMany({ select: { id: true }, take: 2 });
      if (condos.length === 1) accessible = [condos[0].id];
    }

    req.accessibleCondominiumIds = accessible;

    const requested = (req.header("x-condominium-id") || (req.query.condominiumId as string | undefined)) || undefined;
    req.condominiumId = requested && accessible.includes(requested) ? requested : accessible[0];

    next();
  } catch (e) {
    next(e);
  }
}

/**
 * WHERE de scoping para listas.
 *
 * - Modo estrito (`config.tenancy.strict`, Fase 4 pós-backfill): só o condomínio
 *   activo. Esconde linhas com `condominiumId` null.
 * - Modo tolerante (default, Fase 1): inclui o condomínio activo E as linhas
 *   ainda sem condomínio (pré-backfill), para não "esconder" dados existentes
 *   se o deploy acontecer antes de correr `db:backfill`.
 */
export function tenantWhere(req: Request): Record<string, unknown> {
  if (!req.condominiumId) return {};
  if (config.tenancy.strict) return { condominiumId: req.condominiumId };
  return { OR: [{ condominiumId: req.condominiumId }, { condominiumId: null }] };
}

/**
 * Aplica scoping de condomínio a um objecto `where` já existente, compondo
 * com `AND` quando o where já usa `OR` (ex.: filtros de data), para não
 * haver colisão de chaves `OR`.
 */
export function scopeWhere<T extends Record<string, any>>(req: Request, where: T): T {
  if (!req.condominiumId) return where;
  const w = where as Record<string, any>;
  const clause = config.tenancy.strict
    ? { condominiumId: req.condominiumId }
    : { OR: [{ condominiumId: req.condominiumId }, { condominiumId: null }] };
  // Se o where já tem OR/AND, compõe via AND para não colidir chaves; senão funde.
  if (w.OR !== undefined || w.AND !== undefined) {
    w.AND = [...(Array.isArray(w.AND) ? w.AND : w.AND ? [w.AND] : []), clause];
  } else {
    Object.assign(w, clause);
  }
  return where;
}

/**
 * WHERE de scoping para entidades pessoais (Pet, Dependent, Vehicle,
 * DomesticEmployee) que NÃO têm `condominiumId` próprio e só se ligam ao
 * condomínio através do dono (`user`).
 *
 * Tolerante a nulos (Fase 1): inclui donos com membership no condomínio activo
 * E donos ainda sem qualquer membership (pré-backfill), para não esconder
 * registos existentes antes de correr `db:backfill`. Igual à lógica de
 * residentes em /condominium/stats, mas embrulhada na relação `user`.
 */
export function ownerCondoScope(req: Request): Record<string, unknown> {
  if (!req.condominiumId) return {};
  if (config.tenancy.strict) {
    // Estrito: só donos com membership no condomínio activo.
    return { user: { memberships: { some: { condominiumId: req.condominiumId } } } };
  }
  return {
    user: {
      OR: [
        { memberships: { some: { condominiumId: req.condominiumId } } },
        { memberships: { none: {} } },
      ],
    },
  };
}

/** Garante que há um condomínio activo (para escritas). */
export function requireCondominium(req: Request, res: Response, next: NextFunction) {
  if (!req.condominiumId) {
    return res.status(400).json({ error: "Condomínio activo não resolvido." });
  }
  next();
}

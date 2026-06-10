// ────────────────────────────────────────────────────────────────────────────
// Protecções do SUPER_ADMIN (staff da plataforma Melvi)
//
// Regra de segurança imposta pelo produto: tem de existir SEMPRE pelo menos um
// SUPER_ADMIN activo. Estas funções permitem bloquear, no back-end, qualquer
// operação (desactivar / eliminar / despromover) que deixasse a plataforma sem
// nenhum super administrador.
// ────────────────────────────────────────────────────────────────────────────
import { Role } from "@prisma/client";
import { prisma } from "../prisma";

/** Conta os SUPER_ADMIN activos (não eliminados). */
export async function activeSuperAdminCount(): Promise<number> {
  return prisma.user.count({
    where: { role: Role.SUPER_ADMIN, isActive: true, deletedAt: null },
  });
}

/**
 * Indica se `userId` é o ÚLTIMO super admin activo: ou seja, o próprio é um
 * SUPER_ADMIN activo e não existe nenhum outro SUPER_ADMIN activo.
 *
 * Devolve `false` quando o utilizador não é super admin (ou está inactivo/
 * eliminado), porque nesse caso a operação sobre ele nunca reduz a contagem de
 * super admins activos.
 */
export async function isLastActiveSuperAdmin(userId: string): Promise<boolean> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true, deletedAt: true },
  });
  if (!target) return false;
  if (target.role !== Role.SUPER_ADMIN || !target.isActive || target.deletedAt) {
    return false;
  }
  const others = await prisma.user.count({
    where: {
      role: Role.SUPER_ADMIN,
      isActive: true,
      deletedAt: null,
      id: { not: userId },
    },
  });
  return others === 0;
}

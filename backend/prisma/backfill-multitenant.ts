/**
 * Backfill multi-tenant (Fase 0) — IDEMPOTENTE.
 *
 * - Cria/garante uma Organization e liga-lhe os condomínios sem organização.
 * - Denormaliza condominiumId em todos os modelos de dados (estado actual:
 *   single-tenant, por isso tudo aponta para o condomínio existente).
 * - Cria Membership de cada utilizador para o condomínio, com o seu papel.
 * - Define organizationId nos utilizadores de staff (ADMIN / ADMIN_ORG).
 *
 * Correr:  npm run db:backfill
 * Em prod: docker compose exec backend npm run db:backfill
 */
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const condo = await prisma.condominium.findFirst({ orderBy: { createdAt: "asc" } });
  if (!condo) {
    console.log("Sem condomínio — nada a fazer.");
    return;
  }
  console.log(`Condomínio base: ${condo.name} (${condo.id})`);

  // 1. Organização
  let org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: "Melvi" } });
    console.log(`Organização criada: ${org.name} (${org.id})`);
  } else {
    console.log(`Organização existente: ${org.name} (${org.id})`);
  }

  // 2. Ligar condomínios sem organização
  const linked = await prisma.condominium.updateMany({
    where: { organizationId: null },
    data: { organizationId: org.id },
  });
  console.log(`Condomínios ligados à organização: ${linked.count}`);

  // 3. Denormalizar condominiumId (tudo para o condomínio existente)
  const steps: { name: string; run: () => Promise<{ count: number }> }[] = [
    { name: "fraction", run: () => prisma.fraction.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "occurrence", run: () => prisma.occurrence.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "qrAccessCode", run: () => prisma.qRAccessCode.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "accessLog", run: () => prisma.accessLog.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "visit", run: () => prisma.visit.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "panicAlert", run: () => prisma.panicAlert.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "reservation", run: () => prisma.reservation.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "financialRecord", run: () => prisma.financialRecord.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "package", run: () => prisma.package.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "announcement", run: () => prisma.announcement.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "maintenanceOrder", run: () => prisma.maintenanceOrder.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "supplier", run: () => prisma.supplier.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "document", run: () => prisma.document.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
    { name: "assembly", run: () => prisma.assembly.updateMany({ where: { condominiumId: null }, data: { condominiumId: condo.id } }) },
  ];
  for (const s of steps) {
    const r = await s.run();
    console.log(`  ${s.name}: ${r.count} linha(s) etiquetada(s)`);
  }

  // 4. Memberships + organizationId para staff
  const users = await prisma.user.findMany({ select: { id: true, role: true, name: true } });
  let count = 0;
  for (const u of users) {
    await prisma.membership.upsert({
      where: { userId_condominiumId: { userId: u.id, condominiumId: condo.id } },
      create: { userId: u.id, condominiumId: condo.id, role: u.role },
      update: { role: u.role },
    });
    count++;
    if (u.role === Role.ADMIN || u.role === Role.ADMIN_ORG) {
      await prisma.user.update({ where: { id: u.id }, data: { organizationId: org.id } });
    }
  }
  console.log(`Memberships criados/actualizados: ${count}`);
  console.log("✅ Backfill multi-tenant concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

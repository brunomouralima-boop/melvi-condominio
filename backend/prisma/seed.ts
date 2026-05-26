import {
  PrismaClient,
  Role,
  FractionType,
  FractionStatus,
  QRAccessType,
  OccurrenceCategory,
  OccurrencePriority,
  AnnouncementType,
  MeterType,
} from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";

const prisma = new PrismaClient();

const QR_SECRET = process.env.QR_HMAC_SECRET || "dev_qr_hmac_secret_change_in_prod";

function signQR(payload: object): string {
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", QR_SECRET).update(json).digest("hex");
  return Buffer.from(JSON.stringify({ ...payload, sig })).toString("base64url");
}

async function main() {
  console.log("🌱 Seeding Melvi Condomínio...");

  // Wipe (dev only) — ordem respeitando dependências
  await prisma.auditLog.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.generatorConfig.deleteMany();
  await prisma.meter.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.package.deleteMany();
  await prisma.financialRecord.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.commonArea.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.panicAlert.deleteMany();
  await prisma.occurrence.deleteMany();
  await prisma.accessLog.deleteMany();
  await prisma.qRAccessCode.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.domesticEmployee.deleteMany();
  await prisma.dependent.deleteMany();
  await prisma.refreshToken.deleteMany();
  // Quebrar FKs antes de eliminar
  await prisma.user.updateMany({ data: { fractionId: null } });
  await prisma.fraction.updateMany({ data: { ownerId: null, tenantId: null } });
  await prisma.fraction.deleteMany();
  await prisma.tower.deleteMany();
  await prisma.user.deleteMany();
  await prisma.condominium.deleteMany();

  // Condominium
  const condo = await prisma.condominium.create({
    data: {
      name: "Condomínio Morabeza",
      address: "Rua das Acácias, 123, Luanda",
      taxId: "5417890123",
      phone: "+244 222 000 000",
      email: "geral@morabeza.ao",
      website: "https://morabeza.ao",
      isActive: true,
      logo: null,
      settings: { theme: "default", currency: "AOA" },
    },
  });

  // Towers — 2 torres
  const towerA = await prisma.tower.create({
    data: { name: "Torre A", floors: 8, description: "Torre principal — bloco residencial", condominiumId: condo.id },
  });
  const towerB = await prisma.tower.create({
    data: { name: "Torre B", floors: 6, description: "Bloco secundário com comércio no R/C", condominiumId: condo.id },
  });

  // Users
  const adminPass = await bcrypt.hash("Admin@123", 12);
  const residentPass = await bcrypt.hash("Residente@123", 12);
  const doormanPass = await bcrypt.hash("Porteiro@123", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Admin Morabeza",
      email: "admin@morabeza.ao",
      password: adminPass,
      role: Role.ADMIN,
      phone: "+244 900 000 001",
    },
  });

  const doorman = await prisma.user.create({
    data: {
      name: "João Porteiro",
      email: "porteiro@morabeza.ao",
      password: doormanPass,
      role: Role.DOORMAN,
      phone: "+244 900 000 002",
    },
  });

  const residentSpecs = [
    { name: "Maria Silva", email: "residente1@morabeza.ao", phone: "+244 923 111 001" },
    { name: "Carlos Mendes", email: "residente2@morabeza.ao", phone: "+244 923 111 002" },
    { name: "Ana Pereira", email: "residente3@morabeza.ao", phone: "+244 923 111 003" },
    { name: "Paulo Rocha", email: "residente4@morabeza.ao", phone: "+244 923 111 004" },
  ];

  const residents = [];
  for (const r of residentSpecs) {
    const user = await prisma.user.create({
      data: { name: r.name, email: r.email, password: residentPass, role: Role.RESIDENT, phone: r.phone },
    });
    residents.push(user);
  }

  console.log(`  ✓ users: 1 admin / 1 doorman / ${residents.length} residents`);

  // Fractions — 10 distribuídas, permilagens somando ~1000‰
  // Permilagens escolhidas: 6 fracções a 110‰ + 4 fracções a 85‰ = 660 + 340 = 1000‰ ✓
  type FSpec = {
    tower: typeof towerA;
    identifier: string;
    floor: number;
    type: FractionType;
    status: FractionStatus;
    permillage: number;
    areaM2: number;
    privateAreaM2: number;
    commonAreaM2: number;
    bedroomsCount: number;
    bathroomsCount: number;
    parkingSpots: number;
    hasBalcony?: boolean;
    hasSuite?: boolean;
    hasStorageRoom?: boolean;
    orientation?: string;
    ownerIdx?: number; // index in residents[]
    tenantIdx?: number;
  };

  const fractionSpecs: FSpec[] = [
    // Torre A — 6 fracções
    { tower: towerA, identifier: "1A", floor: 1, type: FractionType.APARTMENT, status: FractionStatus.OCCUPIED, permillage: 110, areaM2: 120, privateAreaM2: 95, commonAreaM2: 25, bedroomsCount: 3, bathroomsCount: 2, parkingSpots: 1, hasBalcony: true, hasSuite: true, orientation: "Sul", ownerIdx: 0 },
    { tower: towerA, identifier: "1B", floor: 1, type: FractionType.APARTMENT, status: FractionStatus.OCCUPIED, permillage: 110, areaM2: 118, privateAreaM2: 93, commonAreaM2: 25, bedroomsCount: 3, bathroomsCount: 2, parkingSpots: 1, hasBalcony: true, orientation: "Norte", ownerIdx: 1 },
    { tower: towerA, identifier: "2A", floor: 2, type: FractionType.APARTMENT, status: FractionStatus.OCCUPIED, permillage: 110, areaM2: 120, privateAreaM2: 95, commonAreaM2: 25, bedroomsCount: 3, bathroomsCount: 2, parkingSpots: 1, hasBalcony: true, hasSuite: true, orientation: "Sul", ownerIdx: 2 },
    { tower: towerA, identifier: "2B", floor: 2, type: FractionType.APARTMENT, status: FractionStatus.VACANT, permillage: 110, areaM2: 118, privateAreaM2: 93, commonAreaM2: 25, bedroomsCount: 3, bathroomsCount: 2, parkingSpots: 1, hasBalcony: true, orientation: "Norte" },
    { tower: towerA, identifier: "3A", floor: 3, type: FractionType.APARTMENT, status: FractionStatus.OCCUPIED, permillage: 110, areaM2: 145, privateAreaM2: 115, commonAreaM2: 30, bedroomsCount: 4, bathroomsCount: 3, parkingSpots: 2, hasBalcony: true, hasSuite: true, hasStorageRoom: true, orientation: "Sul", ownerIdx: 3 },
    { tower: towerA, identifier: "3B", floor: 3, type: FractionType.APARTMENT, status: FractionStatus.UNDER_RENOVATION, permillage: 110, areaM2: 145, privateAreaM2: 115, commonAreaM2: 30, bedroomsCount: 4, bathroomsCount: 3, parkingSpots: 2, hasBalcony: true, hasSuite: true, orientation: "Norte" },
    // Torre B — 4 fracções
    { tower: towerB, identifier: "Loja 1", floor: 0, type: FractionType.COMMERCIAL, status: FractionStatus.OCCUPIED, permillage: 85, areaM2: 60, privateAreaM2: 55, commonAreaM2: 5, bedroomsCount: 0, bathroomsCount: 1, parkingSpots: 0, orientation: "Nascente" },
    { tower: towerB, identifier: "Loja 2", floor: 0, type: FractionType.COMMERCIAL, status: FractionStatus.VACANT, permillage: 85, areaM2: 65, privateAreaM2: 58, commonAreaM2: 7, bedroomsCount: 0, bathroomsCount: 1, parkingSpots: 0, orientation: "Poente" },
    { tower: towerB, identifier: "1A", floor: 1, type: FractionType.APARTMENT, status: FractionStatus.OCCUPIED, permillage: 85, areaM2: 90, privateAreaM2: 72, commonAreaM2: 18, bedroomsCount: 2, bathroomsCount: 1, parkingSpots: 1, hasBalcony: true, orientation: "Nascente", ownerIdx: 0, tenantIdx: undefined },
    { tower: towerB, identifier: "2A", floor: 2, type: FractionType.APARTMENT, status: FractionStatus.OCCUPIED, permillage: 85, areaM2: 90, privateAreaM2: 72, commonAreaM2: 18, bedroomsCount: 2, bathroomsCount: 1, parkingSpots: 1, hasBalcony: true, orientation: "Poente", ownerIdx: 1 },
  ];

  const fractions: any[] = [];
  for (const s of fractionSpecs) {
    const ownerId = s.ownerIdx !== undefined ? residents[s.ownerIdx].id : null;
    const tenantId = s.tenantIdx !== undefined ? residents[s.tenantIdx].id : null;
    const fr = await prisma.fraction.create({
      data: {
        towerId: s.tower.id,
        identifier: s.identifier,
        floor: s.floor,
        type: s.type,
        status: s.status,
        permillage: s.permillage as any,
        areaM2: s.areaM2 as any,
        privateAreaM2: s.privateAreaM2 as any,
        commonAreaM2: s.commonAreaM2 as any,
        grossAreaM2: (s.privateAreaM2 + s.commonAreaM2) as any,
        bedroomsCount: s.bedroomsCount,
        bathroomsCount: s.bathroomsCount,
        parkingSpots: s.parkingSpots,
        hasBalcony: !!s.hasBalcony,
        hasSuite: !!s.hasSuite,
        hasStorageRoom: !!s.hasStorageRoom,
        orientation: s.orientation,
        ownerId,
        tenantId,
      },
    });
    fractions.push(fr);
    // sync residence (tenant > owner)
    const residentId = tenantId ?? ownerId;
    if (residentId) await prisma.user.update({ where: { id: residentId }, data: { fractionId: fr.id } });
  }
  console.log(`  ✓ ${fractions.length} fractions across 2 towers`);

  // Refresh residents to include fractionId
  for (let i = 0; i < residents.length; i++) {
    residents[i] = await prisma.user.findUnique({ where: { id: residents[i].id } }) as any;
  }

  // Dependents
  await prisma.dependent.createMany({
    data: [
      { name: "Pedro Silva", relationship: "Filho", document: "001234567LA", userId: residents[0].id },
      { name: "Joana Silva", relationship: "Filha", document: "001234568LA", userId: residents[0].id },
      { name: "Sofia Mendes", relationship: "Esposa", document: "002345678LA", userId: residents[1].id },
    ],
  });

  // Vehicles
  await prisma.vehicle.createMany({
    data: [
      { plate: "LD-12-34-AA", brand: "Toyota", model: "Hilux", color: "Branco", userId: residents[0].id },
      { plate: "LD-56-78-BB", brand: "Honda", model: "Civic", color: "Prata", userId: residents[1].id },
      { plate: "LD-90-12-CC", brand: "Mitsubishi", model: "Pajero", color: "Preto", userId: residents[2].id },
    ],
  });

  // Domestic employees
  await prisma.domesticEmployee.createMany({
    data: [
      { name: "Lúcia Domingos", role: "Empregada doméstica", document: "003456789LA", userId: residents[0].id },
      { name: "Manuel Costa", role: "Motorista", document: "004567890LA", userId: residents[1].id },
    ],
  });

  // Common areas
  await prisma.commonArea.createMany({
    data: [
      { name: "Salão de Festas", description: "Espaço para eventos com cozinha equipada", capacity: 50, rules: "Reservar com 7 dias de antecedência. Devolver limpo.", isActive: true, condominiumId: condo.id, photos: [] },
      { name: "Churrasqueira", description: "Área de churrasco com piscina", capacity: 30, rules: "Não exceder o limite. Música até as 22h.", isActive: true, condominiumId: condo.id, photos: [] },
      { name: "Sala de Reuniões", description: "Sala para reuniões e estudo", capacity: 10, rules: "Silêncio obrigatório.", isActive: true, condominiumId: condo.id, photos: [] },
    ],
  });

  // Announcements
  await prisma.announcement.createMany({
    data: [
      { title: "Bem-vindos ao Melvi Condomínio", content: "Sistema de gestão do condomínio agora online. Aceda para registar ocorrências, criar acessos QR para visitantes e mais.", type: AnnouncementType.INFO, isPinned: true, createdById: admin.id, attachments: [] },
      { title: "Manutenção da água", content: "Haverá corte de água na Torre A na quarta-feira, das 09h às 12h.", type: AnnouncementType.WARNING, isPinned: false, createdById: admin.id, attachments: [] },
      { title: "Assembleia Geral", content: "Assembleia geral marcada para o próximo sábado, às 10h, no Salão de Festas.", type: AnnouncementType.INFO, isPinned: false, createdById: admin.id, attachments: [] },
    ],
  });

  // Occurrences — usar fractionId
  const residentsWithFraction = residents.filter((r: any) => r.fractionId);
  if (residentsWithFraction.length >= 3) {
    await prisma.occurrence.createMany({
      data: [
        { title: "Barulho excessivo à noite", category: OccurrenceCategory.NOISE, description: "Barulho vindo do apartamento vizinho após as 23h.", priority: OccurrencePriority.MEDIUM, fractionId: residentsWithFraction[0].fractionId!, createdById: residentsWithFraction[0].id, photos: [] },
        { title: "Lâmpada queimada no corredor", category: OccurrenceCategory.MAINTENANCE, description: "Lâmpada do corredor do 2º andar da Torre A está queimada há dias.", priority: OccurrencePriority.LOW, fractionId: residentsWithFraction[1].fractionId!, createdById: residentsWithFraction[1].id, photos: [] },
        { title: "Câmera de segurança avariada", category: OccurrenceCategory.SECURITY, description: "A câmera da entrada principal não está a gravar.", priority: OccurrencePriority.HIGH, fractionId: residentsWithFraction[2].fractionId!, createdById: residentsWithFraction[2].id, photos: [] },
      ],
    });
  }

  // QR access codes
  const now = new Date();
  const validUntil = new Date(now.getTime() + 1000 * 60 * 60 * 24);
  if (residentsWithFraction[0]?.fractionId) {
    const qrPayload1 = signQR({ id: crypto.randomUUID(), type: "VISITOR", fractionId: residentsWithFraction[0].fractionId, expiresAt: validUntil.toISOString() });
    await prisma.qRAccessCode.create({
      data: {
        type: QRAccessType.VISITOR,
        guestName: "António Costa",
        guestDocument: "005678901LA",
        validFrom: now,
        validUntil,
        maxUses: 1,
        qrCodeData: qrPayload1,
        shortCode: "3847",
        createdById: residentsWithFraction[0].id,
        fractionId: residentsWithFraction[0].fractionId!,
      },
    });
  }
  if (residentsWithFraction[1]?.fractionId) {
    const qrPayload2 = signQR({ id: crypto.randomUUID(), type: "SERVICE_PROVIDER", fractionId: residentsWithFraction[1].fractionId, expiresAt: validUntil.toISOString() });
    await prisma.qRAccessCode.create({
      data: {
        type: QRAccessType.SERVICE_PROVIDER,
        guestName: "Técnico TV Cabo",
        guestCompany: "TV Cabo Angola",
        serviceType: "Instalação",
        validFrom: now,
        validUntil,
        maxUses: 2,
        qrCodeData: qrPayload2,
        shortCode: "0291",
        createdById: residentsWithFraction[1].id,
        fractionId: residentsWithFraction[1].fractionId!,
      },
    });
  }

  // Financial records — cotas mensais por fracção ocupada
  const monthAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);
  for (const r of residentsWithFraction) {
    await prisma.financialRecord.create({
      data: {
        type: "INCOME",
        category: "Cota mensal",
        description: `Cota mensal — ${r.name}`,
        amount: 25000 as unknown as number,
        dueDate: monthAgo,
        paidDate: monthAgo,
        fractionId: r.fractionId!,
        createdById: admin.id,
      },
    });
    await prisma.financialRecord.create({
      data: {
        type: "INCOME",
        category: "Cota mensal",
        description: `Cota mensal corrente — ${r.name}`,
        amount: 25000 as unknown as number,
        dueDate: new Date(now.getFullYear(), now.getMonth(), 10),
        fractionId: r.fractionId!,
        createdById: admin.id,
      },
    });
  }
  await prisma.financialRecord.create({
    data: {
      type: "EXPENSE",
      category: "Manutenção",
      description: "Manutenção dos elevadores",
      amount: 80000 as unknown as number,
      dueDate: now,
      paidDate: now,
      createdById: admin.id,
    },
  });

  // ──────────── Medidores ────────────
  const epal = await prisma.meter.create({
    data: {
      condominiumId: condo.id,
      towerId: towerA.id,
      name: "Contador EPAL — Torre A",
      type: MeterType.WATER,
      serialNumber: "EPAL-2024-001",
      location: "Cave da Torre A",
      unit: "m³",
    },
  });
  const ende = await prisma.meter.create({
    data: {
      condominiumId: condo.id,
      towerId: null,
      name: "Contador ENDE — Áreas comuns",
      type: MeterType.ELECTRICITY,
      serialNumber: "ENDE-2024-077",
      location: "Quadro eléctrico geral",
      unit: "kWh",
    },
  });
  const generator = await prisma.meter.create({
    data: {
      condominiumId: condo.id,
      towerId: null,
      name: "Gerador Principal",
      type: MeterType.GENERATOR,
      serialNumber: "GEN-001",
      location: "Cave técnica",
      unit: "horas",
      generatorConfig: {
        create: {
          maintenanceIntervalHours: 250 as any,
          lastMaintenanceHours: 2750 as any,
          lastMaintenanceDate: new Date(now.getFullYear(), now.getMonth() - 2, 15),
          notes: "Substituição de filtros e óleo",
        },
      },
    },
  });
  const fuel = await prisma.meter.create({
    data: {
      condominiumId: condo.id,
      towerId: null,
      name: "Depósito de Gasóleo",
      type: MeterType.FUEL,
      serialNumber: null,
      location: "Cave técnica — Junto ao gerador",
      unit: "litros",
      capacity: 500 as any,
    },
  });

  // Leituras históricas para os 3 medidores principais (3 meses)
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthOffset = (offset: number) => {
    const d = new Date(year, month - offset, 15);
    return { date: d, month: d.getMonth() + 1, year: d.getFullYear() };
  };

  // EPAL: 1180 → 1212 → 1247.5
  const epalReadings = [
    { offset: 2, value: 1180.0 },
    { offset: 1, value: 1212.0 },
    { offset: 0, value: 1247.5 },
  ];
  let prevValue: number | null = null;
  for (const r of epalReadings) {
    const m = monthOffset(r.offset);
    const consumption = prevValue !== null ? r.value - prevValue : null;
    await prisma.meterReading.create({
      data: {
        meterId: epal.id,
        readingValue: r.value as any,
        previousValue: prevValue as any,
        consumption: consumption as any,
        readingDate: m.date,
        readingMonth: m.month,
        readingYear: m.year,
        registeredById: admin.id,
      },
    });
    prevValue = r.value;
  }

  // ENDE: 18450 → 19120 → 19880
  const endeReadings = [
    { offset: 2, value: 18450 },
    { offset: 1, value: 19120 },
    { offset: 0, value: 19880 },
  ];
  prevValue = null;
  for (const r of endeReadings) {
    const m = monthOffset(r.offset);
    const consumption = prevValue !== null ? r.value - prevValue : null;
    await prisma.meterReading.create({
      data: {
        meterId: ende.id,
        readingValue: r.value as any,
        previousValue: prevValue as any,
        consumption: consumption as any,
        readingDate: m.date,
        readingMonth: m.month,
        readingYear: m.year,
        registeredById: admin.id,
      },
    });
    prevValue = r.value;
  }

  // Generator: 2750 → 2810 → 2847 (horas)
  const genReadings = [
    { offset: 2, value: 2750 },
    { offset: 1, value: 2810 },
    { offset: 0, value: 2847 },
  ];
  prevValue = null;
  for (const r of genReadings) {
    const m = monthOffset(r.offset);
    const consumption = prevValue !== null ? r.value - prevValue : null;
    await prisma.meterReading.create({
      data: {
        meterId: generator.id,
        readingValue: r.value as any,
        previousValue: prevValue as any,
        consumption: consumption as any,
        readingDate: m.date,
        readingMonth: m.month,
        readingYear: m.year,
        registeredById: admin.id,
      },
    });
    prevValue = r.value;
  }

  // Fuel: leitura única (nível actual 320L)
  const fuelNow = monthOffset(0);
  await prisma.meterReading.create({
    data: {
      meterId: fuel.id,
      readingValue: 320 as any,
      previousValue: null,
      consumption: null,
      readingDate: fuelNow.date,
      readingMonth: fuelNow.month,
      readingYear: fuelNow.year,
      registeredById: admin.id,
      notes: "Nível inicial do depósito",
    },
  });

  console.log(`  ✓ 4 meters with historical readings`);
  console.log("✅ Seed complete.\n");
  console.log("Credentials:");
  console.log("  ADMIN     → admin@morabeza.ao        / Admin@123");
  console.log("  RESIDENT  → residente1@morabeza.ao   / Residente@123   (Torre A 1A)");
  console.log("  RESIDENT  → residente2@morabeza.ao   / Residente@123   (Torre A 1B)");
  console.log("  RESIDENT  → residente3@morabeza.ao   / Residente@123   (Torre A 2A)");
  console.log("  RESIDENT  → residente4@morabeza.ao   / Residente@123   (Torre A 3A)");
  console.log("  DOORMAN   → porteiro@morabeza.ao     / Porteiro@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

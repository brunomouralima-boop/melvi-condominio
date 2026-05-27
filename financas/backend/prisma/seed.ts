import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import { config } from "../src/config";

const prisma = new PrismaClient();

async function main() {
  // --- Moedas (AOA base). Taxas aproximadas — ajuste em Definições. ---
  const currencies = [
    { code: "AOA", name: "Kwanza", symbol: "Kz", isBase: true, rateToBase: 1 },
    { code: "USD", name: "Dólar Americano", symbol: "$", isBase: false, rateToBase: 900 },
    { code: "EUR", name: "Euro", symbol: "€", isBase: false, rateToBase: 980 },
    { code: "BRL", name: "Real Brasileiro", symbol: "R$", isBase: false, rateToBase: 160 },
  ];
  for (const c of currencies) {
    await prisma.currency.upsert({ where: { code: c.code }, create: c, update: { name: c.name, symbol: c.symbol, isBase: c.isBase } });
  }

  // --- Titulares (cônjuges + conjunto). Só cria se ainda não existirem. ---
  const memberCount = await prisma.member.count();
  if (memberCount === 0) {
    const me = await prisma.member.create({ data: { name: "Bruno", kind: "PERSON", color: "#2563eb" } });
    const spouse = await prisma.member.create({ data: { name: "Esposa", kind: "PERSON", color: "#db2777" } });
    await prisma.member.create({ data: { name: "Conjunto", kind: "JOINT", color: "#16a34a" } });

    const passwordHash = await hashPassword(config.seedPassword);
    await prisma.user.create({
      data: { email: "brunomouralima@gmail.com", name: "Bruno", passwordHash, memberId: me.id },
    });
    await prisma.user.create({
      data: { email: "esposa@familia.local", name: "Esposa", passwordHash, memberId: spouse.id },
    });
  }

  // --- Categorias. ---
  const catCount = await prisma.category.count();
  if (catCount === 0) {
    const income = ["Salário", "Rendimentos", "Negócios", "Outros rendimentos"];
    const expense = [
      "Alimentação", "Habitação", "Transporte", "Saúde", "Educação",
      "Lazer", "Serviços", "Vestuário", "Impostos", "Outros",
    ];
    for (const name of income) await prisma.category.create({ data: { name, kind: "INCOME", color: "#16a34a" } });
    for (const name of expense) await prisma.category.create({ data: { name, kind: "EXPENSE", color: "#dc2626" } });
  }

  // --- Dados de exemplo (contas, lançamentos, património) — só na primeira execução. ---
  const accCount = await prisma.account.count();
  if (accCount === 0) {
    const me = await prisma.member.findFirst({ where: { name: "Bruno" } });
    const spouse = await prisma.member.findFirst({ where: { name: "Esposa" } });
    const joint = await prisma.member.findFirst({ where: { kind: "JOINT" } });
    const salario = await prisma.category.findFirst({ where: { name: "Salário" } });
    const alim = await prisma.category.findFirst({ where: { name: "Alimentação" } });
    const hab = await prisma.category.findFirst({ where: { name: "Habitação" } });

    const bai = await prisma.account.create({
      data: { name: "Conta Ordem BAI", institution: "BAI", type: "CHECKING", currencyCode: "AOA", memberId: me!.id, openingBalance: 1500000 },
    });
    const usd = await prisma.account.create({
      data: { name: "Poupança USD", institution: "Standard Bank", type: "SAVINGS", currencyCode: "USD", memberId: joint!.id, openingBalance: 5000 },
    });
    await prisma.account.create({
      data: { name: "Carteira", institution: "Dinheiro", type: "CASH", currencyCode: "AOA", memberId: spouse!.id, openingBalance: 80000 },
    });

    const now = new Date();
    await prisma.transaction.createMany({
      data: [
        { date: now, type: "INCOME", amount: 850000, currencyCode: "AOA", accountId: bai.id, categoryId: salario!.id, memberId: me!.id, description: "Salário mensal" },
        { date: now, type: "EXPENSE", amount: 120000, currencyCode: "AOA", accountId: bai.id, categoryId: alim!.id, memberId: joint!.id, description: "Supermercado" },
        { date: now, type: "EXPENSE", amount: 300000, currencyCode: "AOA", accountId: bai.id, categoryId: hab!.id, memberId: joint!.id, description: "Renda/Condomínio" },
      ],
    });
    await prisma.transaction.create({
      data: {
        date: now, type: "TRANSFER", amount: 200000, currencyCode: "AOA", accountId: bai.id,
        toAccountId: usd.id, toAmount: 222.22, toCurrencyCode: "USD", memberId: joint!.id, description: "Reforço poupança",
      },
    });

    const apt = await prisma.asset.create({
      data: { name: "Apartamento Talatona", type: "PROPERTY", memberId: joint!.id, currencyCode: "AOA", value: 95000000, notes: "Financiado" },
    });
    await prisma.asset.create({
      data: { name: "Viatura Toyota", type: "VEHICLE", memberId: me!.id, currencyCode: "AOA", value: 18000000 },
    });
    await prisma.liability.create({
      data: { name: "Crédito Habitação", type: "MORTGAGE", memberId: joint!.id, currencyCode: "AOA", outstandingBalance: 42000000, originalAmount: 70000000, linkedAssetId: apt.id },
    });
  }

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

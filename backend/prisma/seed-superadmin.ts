// ────────────────────────────────────────────────────────────────────────────
// Bootstrap seguro do SUPER_ADMIN (staff da plataforma Melvi)
//
// Cria (ou promove) UM super administrador a partir de variáveis de ambiente.
// NUNCA usa palavra-passe fixa/hardcoded.
//
//   SUPERADMIN_EMAIL     (obrigatório)
//   SUPERADMIN_NAME      (opcional, default "Super Administrador")
//   SUPERADMIN_PASSWORD  (opcional) — se ausente, é gerada uma aleatória forte
//                          e impressa UMA vez no terminal. Guarde-a de imediato.
//
// Idempotente:
//   - se já existir um utilizador com esse email, garante role=SUPER_ADMIN e
//     isActive=true (reactiva se necessário), mas NÃO altera a palavra-passe.
//
// Uso (local):
//   SUPERADMIN_EMAIL=admin@exemplo.pt npm run seed:superadmin
//
// Uso (produção, dentro do container backend):
//   docker compose exec -e SUPERADMIN_EMAIL=admin@exemplo.pt backend \
//     npm run seed:superadmin
//   (ou defina as variáveis no ambiente do serviço e corra o comando)
//
// A palavra-passe nunca é registada em ficheiro nem em base de dados em texto
// puro — apenas o hash bcrypt (12 rounds) é persistido.
// ────────────────────────────────────────────────────────────────────────────
import { PrismaClient, Role } from "@prisma/client";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// bcrypt (12 rounds) inline — este script é executado pelo `tsx` dentro do
// container de produção, que NÃO inclui a pasta `src/`. Por isso não importamos
// de `../src/utils/password` (mantém o mesmo custo/algoritmo).
const SALT_ROUNDS = 12;
const hashPassword = (plain: string) => bcrypt.hash(plain, SALT_ROUNDS);

/** Gera uma palavra-passe aleatória forte (base64url, ~24 caracteres). */
function generatePassword(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL ?? "").trim();
  const name = (process.env.SUPERADMIN_NAME ?? "Super Administrador").trim();
  const providedPassword = process.env.SUPERADMIN_PASSWORD;

  if (!email) {
    console.error("✖ SUPERADMIN_EMAIL em falta. Defina a variável de ambiente e tente de novo.");
    console.error("  Exemplo: SUPERADMIN_EMAIL=admin@exemplo.pt npm run seed:superadmin");
    process.exitCode = 1;
    return;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`✖ SUPERADMIN_EMAIL inválido: ${email}`);
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const updates: { role?: Role; isActive?: boolean; deletedAt?: null } = {};
    if (existing.role !== Role.SUPER_ADMIN) updates.role = Role.SUPER_ADMIN;
    if (!existing.isActive) updates.isActive = true;
    if (existing.deletedAt) updates.deletedAt = null;

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { id: existing.id }, data: updates });
      console.log(`✔ Utilizador existente "${email}" promovido/reactivado como SUPER_ADMIN.`);
    } else {
      console.log(`✔ Já existe um SUPER_ADMIN activo com o email "${email}". Nada a fazer.`);
    }
    console.log("  (A palavra-passe existente NÃO foi alterada.)");
    return;
  }

  if (providedPassword && providedPassword.length < 8) {
    console.error("✖ SUPERADMIN_PASSWORD demasiado curta (mínimo 8 caracteres).");
    process.exitCode = 1;
    return;
  }

  const generated = !providedPassword;
  const plain = providedPassword ?? generatePassword();
  const password = await hashPassword(plain);

  const user = await prisma.user.create({
    data: { name, email, password, role: Role.SUPER_ADMIN, isActive: true },
  });

  console.log("────────────────────────────────────────────────────────────");
  console.log(`✔ SUPER_ADMIN criado: ${user.name} <${user.email}>`);
  if (generated) {
    console.log("");
    console.log("  Palavra-passe gerada (guarde-a agora — não será mostrada outra vez):");
    console.log(`      ${plain}`);
    console.log("");
    console.log("  ⚠ Altere-a após o primeiro acesso (em Perfil → mudar palavra-passe).");
  } else {
    console.log("  Palavra-passe definida a partir de SUPERADMIN_PASSWORD.");
  }
  console.log("────────────────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// ────────────────────────────────────────────────────────────────────────────
// Catálogo de permissões (RBAC) — Melvi Condomínio
//
// Cada permissão é identificada por uma chave `modulo:accao` (ex.: "financial:write").
// As permissões são resolvidas SEMPRE no back-end por pedido a partir de:
//   1) os defaults do papel (Role) do utilizador  →  ROLE_DEFAULTS
//   2) o overlay individual do utilizador (tabela UserPermission): GRANT/DENY
//
// O SUPER_ADMIN (staff da plataforma Melvi, acima de todas as organizações)
// ignora este cálculo e tem SEMPRE todas as permissões.
//
// IMPORTANTE: nunca confiar só no front-end. O front usa este mesmo catálogo
// apenas para mostrar/esconder UI; a decisão de autorização é feita aqui.
// ────────────────────────────────────────────────────────────────────────────
import { Role } from "@prisma/client";

export type PermissionEffectValue = "GRANT" | "DENY";

export interface ActionDef {
  /** sufixo da chave (ex.: "read", "write") */
  action: string;
  /** rótulo legível em PT para a UI */
  label: string;
}

export interface ModuleDef {
  /** prefixo da chave (ex.: "financial") */
  module: string;
  /** rótulo legível do módulo em PT */
  label: string;
  actions: ActionDef[];
}

const READ: ActionDef = { action: "read", label: "Ver" };
const WRITE: ActionDef = { action: "write", label: "Gerir (criar/editar/remover)" };
const RW: ActionDef[] = [READ, WRITE];

// ────────────────────────────────────────────────────────────────────────────
// Catálogo: todos os módulos da aplicação. Mantém alinhado com src/routes/index.ts
// ────────────────────────────────────────────────────────────────────────────
export const PERMISSION_CATALOG: ModuleDef[] = [
  { module: "dashboard", label: "Painel inicial", actions: [READ] },
  { module: "users", label: "Condóminos / Utilizadores", actions: RW },
  { module: "condominium", label: "Condomínio (configuração)", actions: RW },
  { module: "condominiums", label: "Gestão de Condomínios", actions: RW },
  { module: "towers", label: "Torres / Blocos", actions: RW },
  { module: "fractions", label: "Frações", actions: RW },
  { module: "meters", label: "Medidores / Consumos", actions: RW },
  { module: "dependents", label: "Dependentes", actions: RW },
  { module: "domestic-employees", label: "Empregados domésticos", actions: RW },
  { module: "vehicles", label: "Veículos", actions: RW },
  { module: "pets", label: "Animais", actions: RW },
  { module: "qr-codes", label: "Acessos QR", actions: RW },
  { module: "access-logs", label: "Registos de acesso", actions: RW },
  { module: "visits", label: "Visitas", actions: RW },
  { module: "occurrences", label: "Ocorrências", actions: RW },
  { module: "panic-alerts", label: "Alertas (Botão de Alerta)", actions: RW },
  { module: "announcements", label: "Comunicados", actions: RW },
  { module: "common-areas", label: "Áreas comuns", actions: RW },
  { module: "reservations", label: "Reservas", actions: RW },
  { module: "financial", label: "Financeiro", actions: RW },
  { module: "maintenance", label: "Manutenção", actions: RW },
  { module: "assemblies", label: "Assembleias", actions: RW },
  { module: "packages", label: "Encomendas", actions: RW },
  { module: "documents", label: "Documentos", actions: RW },
  { module: "system", label: "Sistema (Administração)", actions: RW },
];

// ────────────────────────────────────────────────────────────────────────────
// Derivados do catálogo
// ────────────────────────────────────────────────────────────────────────────
export interface PermissionMeta {
  key: string;
  module: string;
  moduleLabel: string;
  action: string;
  actionLabel: string;
}

/** Metadata indexada por chave (para UI e validação). */
export const PERMISSION_META: Record<string, PermissionMeta> = {};
for (const m of PERMISSION_CATALOG) {
  for (const a of m.actions) {
    const key = `${m.module}:${a.action}`;
    PERMISSION_META[key] = {
      key,
      module: m.module,
      moduleLabel: m.label,
      action: a.action,
      actionLabel: a.label,
    };
  }
}

/** Lista plana com todas as chaves `modulo:accao` válidas. */
export const ALL_PERMISSION_KEYS: string[] = Object.keys(PERMISSION_META);

export function isValidPermissionKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(PERMISSION_META, key);
}

// Helpers para construir conjuntos de defaults a partir do catálogo.
function rw(module: string): string[] {
  return [`${module}:read`, `${module}:write`];
}
function read(module: string): string[] {
  return [`${module}:read`];
}

// ────────────────────────────────────────────────────────────────────────────
// Defaults por papel (Role)
//
// Estes defaults reproduzem o comportamento actual da aplicação para cada papel
// (são a "base" que o overlay GRANT/DENY ajusta por utilizador). O wiring das
// rotas (Etapa 2) usa requirePermission(...) com estas chaves, mantendo o
// authorize(role) já existente como rede de segurança.
// ────────────────────────────────────────────────────────────────────────────

// ADMIN: administração operacional de um condomínio (síndico).
// Tem TODAS as permissões de todos os módulos EXCEPTO o módulo "system"
// (administração da plataforma, reservada ao SUPER_ADMIN). Isto reproduz o
// comportamento actual: hoje qualquer operação `authorize(Role.ADMIN)` é
// acessível ao ADMIN/ADMIN_ORG em qualquer módulo.
const ADMIN_DEFAULTS: string[] = PERMISSION_CATALOG
  .filter((m) => m.module !== "system")
  .flatMap((m) => m.actions.map((a) => `${m.module}:${a.action}`));

// ADMIN_ORG: para efeitos de permissões, idêntico ao ADMIN (a diferença é o
// alcance multi-condomínio, resolvido em `resolveCondominium`/`tenantWhere`).
const ADMIN_ORG_DEFAULTS: string[] = [...ADMIN_DEFAULTS];

// RESIDENT: lê informação do condomínio e gere os seus próprios dados.
const RESIDENT_DEFAULTS: string[] = [
  ...read("dashboard"),
  ...read("condominium"),
  ...read("announcements"),
  ...read("documents"),
  ...read("financial"),
  ...read("assemblies"),
  ...read("common-areas"),
  ...read("visits"),
  ...rw("reservations"),
  ...rw("occurrences"),
  ...rw("panic-alerts"),
  ...rw("qr-codes"),
  ...rw("dependents"),
  ...rw("domestic-employees"),
  ...rw("vehicles"),
  ...rw("pets"),
];

// DOORMAN: controlo de acessos na portaria.
const DOORMAN_DEFAULTS: string[] = [
  ...read("dashboard"),
  ...read("announcements"),
  ...read("occurrences"),
  ...rw("visits"),
  ...rw("access-logs"),
  ...rw("qr-codes"),
  ...rw("packages"),
  ...rw("panic-alerts"),
];

export const ROLE_DEFAULTS: Record<Role, string[]> = {
  SUPER_ADMIN: [...ALL_PERMISSION_KEYS],
  ADMIN_ORG: dedupe(ADMIN_ORG_DEFAULTS),
  ADMIN: dedupe(ADMIN_DEFAULTS),
  RESIDENT: dedupe(RESIDENT_DEFAULTS),
  DOORMAN: dedupe(DOORMAN_DEFAULTS),
};

function dedupe(keys: string[]): string[] {
  return [...new Set(keys)];
}

// ────────────────────────────────────────────────────────────────────────────
// Resolução das permissões efectivas
// ────────────────────────────────────────────────────────────────────────────
export interface PermissionOverride {
  key: string;
  effect: PermissionEffectValue;
}

export function isSuperAdmin(role: Role): boolean {
  return role === Role.SUPER_ADMIN;
}

/**
 * Calcula o conjunto efectivo de permissões de um utilizador:
 *   defaults do papel  →  + GRANTs  →  − DENYs
 * SUPER_ADMIN tem sempre todas. Chaves desconhecidas no overlay são ignoradas.
 */
export function resolvePermissions(role: Role, overrides: PermissionOverride[] = []): string[] {
  if (isSuperAdmin(role)) return [...ALL_PERMISSION_KEYS];

  const set = new Set<string>(ROLE_DEFAULTS[role] ?? []);
  for (const o of overrides) {
    if (!isValidPermissionKey(o.key)) continue; // ignora chaves obsoletas/inválidas
    if (o.effect === "DENY") set.delete(o.key);
    else set.add(o.key);
  }
  return [...set];
}

/** Verifica uma permissão específica (mais barato que resolver tudo). */
export function hasPermission(role: Role, overrides: PermissionOverride[], key: string): boolean {
  if (isSuperAdmin(role)) return true;
  let allowed = (ROLE_DEFAULTS[role] ?? []).includes(key);
  for (const o of overrides) {
    if (o.key !== key) continue;
    allowed = o.effect !== "DENY";
  }
  return allowed;
}

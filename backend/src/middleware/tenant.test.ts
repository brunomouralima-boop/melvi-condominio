/**
 * Testes de isolamento multi-tenant — helpers puros de scoping (sem DB).
 *
 * Correr:  npm test
 *
 * Cobrem os dois modos:
 *  - tolerante a nulos (Fase 1, default): inclui condomínio activo + linhas null
 *  - estrito (Fase 4, STRICT_TENANCY=1): só o condomínio activo
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { config } from "../config";
import { tenantWhere, scopeWhere, ownerCondoScope } from "./tenant";

const CONDO_A = "condo-aaaa";
const CONDO_B = "condo-bbbb";

function reqWith(condominiumId?: string): Request {
  return { condominiumId } as unknown as Request;
}

/** Garante que cada teste corre no modo pretendido independentemente da ordem. */
function withStrict<T>(strict: boolean, fn: () => T): T {
  const prev = config.tenancy.strict;
  config.tenancy.strict = strict;
  try {
    return fn();
  } finally {
    config.tenancy.strict = prev;
  }
}

// ── tenantWhere ────────────────────────────────────────────────────────────
test("tenantWhere: sem condomínio activo → where vazio (sem filtro)", () => {
  assert.deepEqual(tenantWhere(reqWith(undefined)), {});
});

test("tenantWhere: modo tolerante inclui condomínio activo E linhas null", () => {
  withStrict(false, () => {
    assert.deepEqual(tenantWhere(reqWith(CONDO_A)), {
      OR: [{ condominiumId: CONDO_A }, { condominiumId: null }],
    });
  });
});

test("tenantWhere: modo estrito só o condomínio activo (esconde null)", () => {
  withStrict(true, () => {
    assert.deepEqual(tenantWhere(reqWith(CONDO_A)), { condominiumId: CONDO_A });
  });
});

test("tenantWhere: o filtro nunca aponta para outro condomínio", () => {
  withStrict(true, () => {
    const w = tenantWhere(reqWith(CONDO_A)) as { condominiumId?: string };
    assert.notEqual(w.condominiumId, CONDO_B);
  });
});

// ── scopeWhere ─────────────────────────────────────────────────────────────
test("scopeWhere: funde a cláusula num where simples (sem OR/AND)", () => {
  withStrict(true, () => {
    const out = scopeWhere(reqWith(CONDO_A), { status: "OPEN" } as Record<string, any>);
    assert.deepEqual(out, { status: "OPEN", condominiumId: CONDO_A });
  });
});

test("scopeWhere: compõe via AND quando o where já tem OR (não colide)", () => {
  withStrict(false, () => {
    const base = { OR: [{ a: 1 }, { b: 2 }] } as Record<string, any>;
    const out = scopeWhere(reqWith(CONDO_A), base) as Record<string, any>;
    // O OR original mantém-se intacto…
    assert.deepEqual(out.OR, [{ a: 1 }, { b: 2 }]);
    // …e a cláusula de tenant entra dentro de AND.
    assert.deepEqual(out.AND, [
      { OR: [{ condominiumId: CONDO_A }, { condominiumId: null }] },
    ]);
  });
});

test("scopeWhere: estrito + where com AND existente acumula sem perder cláusulas", () => {
  withStrict(true, () => {
    const base = { AND: [{ a: 1 }] } as Record<string, any>;
    const out = scopeWhere(reqWith(CONDO_A), base) as Record<string, any>;
    assert.deepEqual(out.AND, [{ a: 1 }, { condominiumId: CONDO_A }]);
  });
});

test("scopeWhere: sem condomínio activo devolve o where inalterado", () => {
  const base = { status: "OPEN" } as Record<string, any>;
  assert.deepEqual(scopeWhere(reqWith(undefined), base), { status: "OPEN" });
});

// ── ownerCondoScope (entidades pessoais via relação user) ───────────────────
test("ownerCondoScope: tolerante inclui donos do condo activo E donos sem membership", () => {
  withStrict(false, () => {
    assert.deepEqual(ownerCondoScope(reqWith(CONDO_A)), {
      user: {
        OR: [
          { memberships: { some: { condominiumId: CONDO_A } } },
          { memberships: { none: {} } },
        ],
      },
    });
  });
});

test("ownerCondoScope: estrito só donos com membership no condo activo", () => {
  withStrict(true, () => {
    assert.deepEqual(ownerCondoScope(reqWith(CONDO_A)), {
      user: { memberships: { some: { condominiumId: CONDO_A } } },
    });
  });
});

test("ownerCondoScope: sem condomínio activo → where vazio", () => {
  assert.deepEqual(ownerCondoScope(reqWith(undefined)), {});
});

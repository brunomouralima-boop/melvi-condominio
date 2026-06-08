#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Melvi Condomínio — Deploy / Actualização
# Constrói, sobe e aplica schema. NÃO toca em SSL (usa scripts/ssl.sh)
# ═══════════════════════════════════════════════════════════════

set -e

echo "🚀 Melvi Condomínio — Deploy"
echo "─────────────────────"

# ─── Validações ──────────────────────────────────────────
if [ ! -f .env ]; then
  echo "❌ .env não encontrado. Corre primeiro: bash scripts/setup.sh"
  exit 1
fi

if [ ! -f nginx/active.conf ]; then
  echo "❌ nginx/active.conf não existe. Corre: cp nginx/nginx.http-only.conf nginx/active.conf"
  exit 1
fi

# Verificar valores obrigatórios no .env (não <PREENCHER>)
if grep -q "<PREENCHER>" .env; then
  echo "❌ Há variáveis por preencher no .env (procura <PREENCHER>):"
  grep -n "<PREENCHER>" .env || true
  echo "   Edita o .env antes de fazer deploy."
  exit 1
fi

# ─── Pull do código (se for git) ─────────────────────────
if [ -d .git ] && [ "${SKIP_GIT_PULL:-0}" != "1" ]; then
  echo "📥 Actualizando código do repositório…"
  git pull --ff-only origin "$(git branch --show-current)" || \
    echo "   ⚠ git pull falhou — continuando com código local."
fi

# ─── Build ───────────────────────────────────────────────
echo "🐳 Construindo imagens…"
docker compose build

# ─── Up ──────────────────────────────────────────────────
echo "⬆️  Subindo serviços…"
docker compose up -d

# ─── Aguardar Postgres ───────────────────────────────────
echo "⏳ Aguardando Postgres ficar healthy…"
for i in {1..30}; do
  if docker compose ps postgres --format json 2>/dev/null | grep -q '"Health":"healthy"'; then
    echo "   ✔ Postgres healthy."
    break
  fi
  sleep 2
done

# ─── Verificar backend health ────────────────────────────
echo "⏳ Aguardando backend responder…"
for i in {1..30}; do
  # A imagem do backend traz curl (não wget) — usar curl para o health-check.
  if docker compose exec -T backend curl -fsS http://localhost:4000/health >/dev/null 2>&1; then
    echo "   ✔ Backend a responder."
    break
  fi
  sleep 2
done

# ─── Seed inicial (apenas se DB vazia) ───────────────────
echo "🌱 Verificando se a base está vazia…"
USER_COUNT=$(docker compose exec -T postgres psql -U "${DB_USER:-melvi}" -d "${DB_NAME:-melvi}" -tAc \
  "SELECT COUNT(*) FROM \"User\";" 2>/dev/null || echo "0")
USER_COUNT=$(echo "$USER_COUNT" | tr -d '[:space:]')

if [ "$USER_COUNT" = "0" ]; then
  echo "   Base vazia — a correr seed inicial…"
  docker compose exec -T backend npx prisma db seed
  echo "   ✔ Seed concluído."
else
  echo "   ✔ Base já tem $USER_COUNT utilizador(es). Seed ignorado."
fi

echo ""
echo "✅ Deploy concluído!"
echo ""
DOMAIN=$(grep ^DOMAIN= .env | cut -d= -f2)
if [ -d /etc/letsencrypt/live/$DOMAIN ] || docker compose exec -T nginx test -d /etc/letsencrypt/live/$DOMAIN 2>/dev/null; then
  echo "🔒 HTTPS já configurado. Acede: https://$DOMAIN"
else
  echo "🌐 Sistema em HTTP: http://$DOMAIN"
  echo ""
  echo "Para activar HTTPS:  bash scripts/ssl.sh"
fi

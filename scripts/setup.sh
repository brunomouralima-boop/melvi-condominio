#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Melvi Condomínio — Setup inicial do servidor
# Correr UMA vez, num servidor Linux novo (Ubuntu 22.04+ / Debian 12+)
# ═══════════════════════════════════════════════════════════════

set -e

echo "🚀 Melvi Condomínio — Setup do servidor"
echo "────────────────────────────────"

# ─── Verificar root / sudo ────────────────────────────────
if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
  echo "⚠️  Este script precisa de sudo. Vai pedir a tua senha quando necessário."
fi

# ─── Docker ───────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "📦 Instalando Docker…"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "   ✔ Docker instalado. Vais ter de fazer logout/login para aplicar o grupo docker."
else
  echo "✔ Docker já instalado: $(docker --version)"
fi

# ─── Docker Compose plugin ────────────────────────────────
if ! docker compose version >/dev/null 2>&1; then
  echo "📦 Instalando Docker Compose plugin…"
  sudo apt-get update -y
  sudo apt-get install -y docker-compose-plugin
else
  echo "✔ Docker Compose já instalado: $(docker compose version --short)"
fi

# ─── Estrutura de pastas ──────────────────────────────────
echo "📁 Criando pastas necessárias…"
mkdir -p nginx backups logs
# Conteúdo da config nginx activa = http-only no arranque
if [ ! -f nginx/active.conf ]; then
  cp nginx/nginx.http-only.conf nginx/active.conf
  echo "   ✔ nginx/active.conf criado (modo HTTP-only)."
fi

# ─── .env ─────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  ATENÇÃO: Ficheiro .env criado a partir do exemplo."
  echo "    Edita-o ANTES de fazer deploy:"
  echo ""
  echo "    nano .env"
  echo ""
  echo "    Valores obrigatórios a preencher:"
  echo "      - DOMAIN"
  echo "      - ADMIN_EMAIL"
  echo "      - DB_PASSWORD          → openssl rand -base64 32"
  echo "      - JWT_ACCESS_SECRET    → openssl rand -base64 64"
  echo "      - JWT_REFRESH_SECRET   → openssl rand -base64 64"
  echo "      - QR_HMAC_SECRET       → openssl rand -base64 32"
  echo ""
  exit 1
fi

# ─── Firewall (UFW) ───────────────────────────────────────
if command -v ufw >/dev/null 2>&1; then
  echo "🔥 Configurando firewall (UFW)…"
  sudo ufw allow OpenSSH >/dev/null 2>&1 || true
  sudo ufw allow 80/tcp >/dev/null 2>&1 || true
  sudo ufw allow 443/tcp >/dev/null 2>&1 || true
  sudo ufw --force enable >/dev/null 2>&1 || true
  echo "   ✔ Portas 22, 80, 443 abertas."
fi

echo ""
echo "✅ Setup concluído."
echo ""
echo "Próximo passo:"
echo "   bash scripts/deploy.sh"

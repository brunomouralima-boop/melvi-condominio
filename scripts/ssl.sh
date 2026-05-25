#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Melvi Condomínio — Configurar HTTPS com Let's Encrypt
# ═══════════════════════════════════════════════════════════════
# Pré-requisitos:
#   1) DNS do domínio já aponta para o IP do servidor
#   2) deploy.sh já correu com sucesso (nginx em HTTP-only)
#   3) Portas 80 e 443 abertas no firewall
# ═══════════════════════════════════════════════════════════════

set -e

echo "🔒 Melvi Condomínio — Configurar HTTPS"
echo "──────────────────────────────"

if [ ! -f .env ]; then
  echo "❌ .env não encontrado."
  exit 1
fi

DOMAIN=$(grep ^DOMAIN= .env | cut -d= -f2)
EMAIL=$(grep ^ADMIN_EMAIL= .env | cut -d= -f2)

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "❌ DOMAIN ou ADMIN_EMAIL não definidos no .env"
  exit 1
fi

echo "📍 Domínio: $DOMAIN"
echo "📧 Email:   $EMAIL"
echo ""

# ─── Verificar que nginx HTTP está a responder ──────────
echo "🔍 Verificando que o nginx em HTTP responde…"
if ! curl -fsS "http://$DOMAIN/.well-known/acme-challenge/test" >/dev/null 2>&1; then
  # 404 é esperado (não existe esse ficheiro) — o que queremos saber é se chega ao nginx
  if ! curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN/" | grep -qE "^(200|301|404)$"; then
    echo "   ⚠ nginx em http://$DOMAIN não está a responder. Verifica DNS e firewall."
    echo "     - Confirma que A record $DOMAIN aponta para o IP do servidor"
    echo "     - Confirma que porta 80 está aberta"
    exit 1
  fi
fi
echo "   ✔ nginx HTTP responde."

# ─── Obter certificado ──────────────────────────────────
echo ""
echo "🔐 A obter certificado SSL (Let's Encrypt)…"
docker compose run --rm --entrypoint "" certbot \
  certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

# ─── Trocar nginx para config com SSL ───────────────────
echo ""
echo "📝 Activando configuração HTTPS…"
# Substituir ${DOMAIN} no template e gravar em active.conf
sed "s/\${DOMAIN}/$DOMAIN/g" nginx/nginx.conf > nginx/active.conf
echo "   ✔ nginx/active.conf actualizado para HTTPS."

# ─── Reload nginx ───────────────────────────────────────
echo "🔄 Recarregando nginx…"
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
echo "   ✔ nginx recarregado."

# ─── Configurar cron de renovação ───────────────────────
CRON_LINE="0 3 * * * cd $(pwd) && docker compose run --rm --entrypoint '' certbot certbot renew --quiet && docker compose exec -T nginx nginx -s reload"

if ! crontab -l 2>/dev/null | grep -qF "$(pwd)" ; then
  echo "⏰ A adicionar cron de renovação automática (todos os dias às 03h)…"
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "   ✔ Renovação automática configurada."
else
  echo "✔ Cron de renovação já existe."
fi

echo ""
echo "✅ HTTPS configurado com sucesso!"
echo ""
echo "🔒 Aceder: https://$DOMAIN"
echo ""
echo "ℹ️  Os certificados Let's Encrypt são válidos 90 dias e renovam automaticamente."
echo "   Para forçar renovação manual:"
echo "   docker compose run --rm --entrypoint '' certbot certbot renew"

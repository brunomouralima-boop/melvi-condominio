#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Melvi Condomínio — Ver logs dos serviços
# Uso: bash scripts/logs.sh [serviço]
#   serviço: backend | frontend | postgres | nginx | all (default)
# ═══════════════════════════════════════════════════════════════

SERVICE=${1:-all}

case "$SERVICE" in
  backend|api)
    docker compose logs -f --tail=200 backend
    ;;
  frontend|web)
    docker compose logs -f --tail=200 frontend
    ;;
  postgres|db|database)
    docker compose logs -f --tail=200 postgres
    ;;
  nginx|proxy)
    docker compose logs -f --tail=200 nginx
    ;;
  all|*)
    docker compose logs -f --tail=100
    ;;
esac

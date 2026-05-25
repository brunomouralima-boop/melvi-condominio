#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Melvi Condomínio — Backup da base de dados PostgreSQL
# ═══════════════════════════════════════════════════════════════
# Usar em cron para backups diários:
#   0 3 * * * cd /caminho/melvi-condominio && bash scripts/backup.sh >> logs/backup.log 2>&1
# ═══════════════════════════════════════════════════════════════

set -e

if [ ! -f .env ]; then
  echo "❌ .env não encontrado."
  exit 1
fi

# Carregar variáveis
set -a
source .env
set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/melvi_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
KEEP_LAST=${BACKUP_KEEP_LAST:-14}

mkdir -p "$BACKUP_DIR"

echo "💾 [$(date '+%Y-%m-%d %H:%M:%S')] A criar backup → $BACKUP_FILE"

docker compose exec -T postgres pg_dump \
  --clean --if-exists --no-owner --no-privileges \
  -U "$DB_USER" -d "$DB_NAME" | gzip -9 > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "   ✔ Backup criado ($SIZE)"

# ─── Limpeza (manter últimos N + apagar mais velhos que X dias) ─
echo "🗑️  A limpar backups antigos…"

# Apagar mais velhos que RETENTION_DAYS dias
find "$BACKUP_DIR" -name "melvi_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

# Manter apenas KEEP_LAST mais recentes (independente da idade)
ls -t "$BACKUP_DIR"/melvi_*.sql.gz 2>/dev/null | tail -n +$((KEEP_LAST + 1)) | xargs -r rm -f

REMAINING=$(ls "$BACKUP_DIR"/melvi_*.sql.gz 2>/dev/null | wc -l)
echo "   ✔ $REMAINING backup(s) preservado(s)."

echo "✅ Backup completo."

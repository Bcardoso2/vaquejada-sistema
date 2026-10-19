#!/bin/bash
set -e

# ==============================================================================
# Script de Backup Automatizado do Banco PostgreSQL (Vaquejada)
# Formato: Custom pg_dump comprimido (.dump)
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${PGDATABASE:-vaquejada_db}"
DB_USER="${PGUSER:-briciocardoso}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.dump"

echo "===================================================================="
echo "📦 INICIANDO BACKUP DO BANCO: ${DB_NAME} (${TIMESTAMP})"
echo "===================================================================="

if [ -n "$DATABASE_URL" ]; then
  echo "Utilizando conexão via DATABASE_URL..."
  pg_dump -Fc --no-owner --no-acl "$DATABASE_URL" > "${BACKUP_FILE}"
else
  echo "Conectando em ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}..."
  pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -Fc --no-owner --no-acl "${DB_NAME}" > "${BACKUP_FILE}"
fi

BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "✅ Backup concluído com sucesso!"
echo "📁 Arquivo gerado: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Rotacionar backups: remove arquivos com mais de 7 dias
echo "🧹 Verificando retenção de 7 dias..."
DELETED_COUNT=$(find "${BACKUP_DIR}" -type f -name "${DB_NAME}_backup_*.dump" -mtime +7 | wc -l | tr -d ' ')
find "${BACKUP_DIR}" -type f -name "${DB_NAME}_backup_*.dump" -mtime +7 -delete
echo "🗑️ Backups antigos removidos (> 7 dias): ${DELETED_COUNT}"
echo "===================================================================="

echo "${BACKUP_FILE}"

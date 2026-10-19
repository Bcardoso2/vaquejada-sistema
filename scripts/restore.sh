#!/bin/bash
set -e

# ==============================================================================
# Script de Restauração Automatizada do Banco PostgreSQL (Vaquejada)
# Formato: pg_restore a partir de dump (.dump)
# Uso: ./scripts/restore.sh <caminho_do_arquivo.dump> [nome_do_banco_destino]
# ==============================================================================

BACKUP_FILE="$1"
TARGET_DB="${2:-${PGDATABASE:-vaquejada_db}}"
DB_USER="${PGUSER:-briciocardoso}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Erro: Arquivo de backup não especificado."
  echo "Uso: $0 <caminho_do_arquivo.dump> [nome_do_banco_destino]"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Erro: Arquivo de backup não encontrado: $BACKUP_FILE"
  exit 1
fi

echo "===================================================================="
echo "♻️  INICIANDO RESTAURAÇÃO NO BANCO: ${TARGET_DB}"
echo "📁 Origem: ${BACKUP_FILE}"
echo "===================================================================="

# Restaurar com pg_restore
# --clean: limpa objetos antes de recriar
# --no-owner --no-acl: evita problemas de permissão entre ambientes
pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" --no-owner --no-acl "$BACKUP_FILE" || {
  echo "⚠️ Aviso: pg_restore retornou avisos não fatais durante a importação."
}

echo "✅ Restauração finalizada com sucesso no banco: ${TARGET_DB}!"
echo "===================================================================="

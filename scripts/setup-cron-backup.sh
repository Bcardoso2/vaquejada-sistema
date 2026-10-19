#!/bin/bash
set -e

# ==============================================================================
# Script para instalar o agendamento de backup diário no CRON com retenção de 7 dias
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_SCRIPT="${PROJECT_DIR}/scripts/backup.sh"
LOG_FILE="${PROJECT_DIR}/backups/backup_cron.log"

mkdir -p "${PROJECT_DIR}/backups"
chmod +x "${BACKUP_SCRIPT}"

# Entrada cron: Roda todos os dias às 03:00 da madrugada
CRON_JOB="0 3 * * * ${BACKUP_SCRIPT} >> ${LOG_FILE} 2>&1"

echo "===================================================================="
echo "🕒 CONFIGURAÇÃO DE BACKUP AUTOMÁTICO DIÁRIO NO CRON"
echo "===================================================================="
echo "Script:  ${BACKUP_SCRIPT}"
echo "Horário: Diariamente às 03:00 da manhã (0 3 * * *)"
echo "Log:     ${LOG_FILE}"
echo "Retenção: 7 dias automáticos"
echo ""

# Verificar se já existe a entrada no crontab
CURRENT_CRON=$(crontab -l 2>/dev/null || true)

if echo "$CURRENT_CRON" | grep -Fq "${BACKUP_SCRIPT}"; then
  echo "ℹ️ O agendamento do backup já está presente no crontab do usuário."
else
  # Adiciona nova linha ao crontab
  (echo "$CURRENT_CRON"; echo "# Backup diário automático do sistema de vaquejada (retenção 7 dias)"; echo "$CRON_JOB") | crontab -
  echo "✅ Agendamento adicionado ao crontab com sucesso!"
fi

echo ""
echo "Crontab ativo atual:"
crontab -l | grep -E "backup.sh|vaquejada" || true
echo "===================================================================="

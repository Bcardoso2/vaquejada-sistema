# Guia Oficial de Backup, Retenção e Cópia Externa (LGPD & Alta Disponibilidade)

Este documento descreve a rotina de proteção de dados, backup automatizado, retenção de 7 dias, restauração em caso de desastre e procedimentos para guardar cópias fora da máquina principal do evento.

---

## 1. Estratégia de Criptografia em Repouso & Backups

Todos os dados pessoais sensíveis (CPF de competidores) são armazenados sob criptografia simétrica autenticada **AES-256-GCM**, acompanhados de um **Blind Index (HMAC-SHA256)** que permite indexação e busca exata $O(1)$ sem expor os números reais.

Quando o `pg_dump` é executado:
- Os arquivos `.dump` contêm apenas os dados cifrados e os índices cegos.
- Mesmo que o arquivo de backup seja extraviado ou roubado fisicamente, **os CPFs não podem ser decifrados** sem a variável de ambiente `CPF_ENCRYPTION_KEY`.

---

## 2. Backup Automatizado Diário (Cron) com Retenção de 7 Dias

### Instalação em 1 Comando
Para agendar o backup diário automático às **03:00 da manhã**:
```bash
./scripts/setup-cron-backup.sh
```

### O que o script faz:
1. Gera um arquivo binário comprimido no formato `pg_dump -Fc` em `backups/vaquejada_db_backup_YYYYMMDD_HHMMSS.dump`.
2. Executa a rotina de rotação automática: localiza e remove qualquer backup gerado há mais de **7 dias** (`-mtime +7`).
3. Registra os logs de cada execução em `backups/backup_cron.log`.

---

## 3. Como Guardar uma Cópia Fora da Máquina (Off-Site)

Em eventos presenciais de vaquejada, nunca confie exclusivamente no disco rígido do servidor principal (risco de queda de energia, queima de fonte, furto ou derramamento de líquidos).

### Opção A: Cópia Automática para Pendrive / SSD Externo (Recomendado para Parque sem Internet)
Conecte um pendrive ou SSD externo formatado (ex: `/Volumes/BACKUP_VAQUEJADA` no macOS ou `/mnt/backup_externo` no Linux).
Adicione uma linha de sincronização ao final de `scripts/backup.sh` ou no cron:
```bash
# Copia o backup recém-gerado para o dispositivo externo montado
DESTINO_EXTERNO="/Volumes/BACKUP_VAQUEJADA"
if [ -d "$DESTINO_EXTERNO" ]; then
  rsync -av --update "${BACKUP_DIR}/" "${DESTINO_EXTERNO}/vaquejada_backups/"
  echo "✅ Cópia espelhada com sucesso para o drive externo!"
fi
```

### Opção B: Cópia por Rede Local (Wi-Fi/Cabo) para Notebook de Apoio
Se houver outro computador na secretaria ou torre de controle:
```bash
# Executa rsync seguro via SSH para o notebook reserva
rsync -avz -e ssh backups/ usuario@192.168.1.50:/home/usuario/backups_vaquejada/
```

### Opção C: Cópia em Nuvem (Google Drive, AWS S3, Mega ou Rclone)
Se o parque possuir conexão de internet (Starlink, 4G/5G ou fibra):
```bash
# Usando o utilitário oficial rclone:
rclone sync backups/ google-drive:BackupsVaquejada/ --include "*.dump"
# Ou via AWS CLI:
aws s3 sync backups/ s3://meu-bucket-vaquejada/backups/
```

---

## 4. Teste de Restauração em Banco Limpo (Disaster Recovery)

Para restaurar um backup em minutos em caso de falha:

```bash
# 1. Executar o script de restauração indicando o arquivo .dump
./scripts/restore.sh backups/vaquejada_db_backup_20261019_150000.dump
```

O script:
- Recria as tabelas e índices.
- Restaura registros de competidores, vaquejadas, senhas, corridas e pagamentos.
- Mantém a criptografia AES-256-GCM intacta e funcional para pesquisa e visualização.

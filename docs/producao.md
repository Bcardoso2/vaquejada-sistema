# Guia Oficial de Implantação e Operação em Produção

Este guia detalha o processo de implantação, operação contínua e planos de contingência do **Sistema de Gestão de Vaquejada** para eventos e parques de vaquejada.

---

## 1. Pré-Requisitos de Infraestrutura

- **Sistema Operacional:** Linux (Ubuntu 22.04 LTS / Debian 12 recomendado) ou macOS.
- **Node.js:** Versão 18.x ou 20.x LTS.
- **PostgreSQL:** Versão 14 ou superior com suporte a conexões locais.
- **Rede Local (LAN):** Roteador ou switch dedicado de alta capacidade com DHCP fixo reservado para o servidor.
- **Hardware Mínimo Recomendado:**
  - Processador: Quad-Core (Intel i5 ou AMD Ryzen 5 / Apple Silicon).
  - Memória RAM: 8 GB (16 GB recomendado para eventos com múltiplos telões).
  - Armazenamento: SSD de 128 GB ou superior.
  - No-break (Nobreak/UPS): Mínimo de 1200 VA dedicado ao servidor e ao roteador/switch central.

---

## 2. Variáveis de Ambiente Críticas (`.env`)

Crie o arquivo `.env` na raiz do projeto contendo as chaves de segurança:

```bash
# Banco de dados
DATABASE_URL="postgres://vaquejada_user:sua_senha_segura@127.0.0.1:5432/vaquejada_db"

# Segurança de Sessão JWT (Obrigatório - Mínimo 32 caracteres)
JWT_SECRET="vaquejada_prod_jwt_secret_super_seguro_e_aleatorio_32chars"

# Criptografia AES-256-GCM para dados sensíveis (CPF em repouso)
CPF_ENCRYPTION_KEY="chave_hex_64_digitos_ou_frase_longa_para_aes256"
CPF_BLIND_INDEX_KEY="chave_hex_64_digitos_para_blind_index_hmac_sha256"

# Configuração de Cookies de Sessão em Rede Local (LAN)
# Use 'false' para acessos via HTTP (ex: http://192.168.1.100:3000)
# Use 'true' se utilizar terminação HTTPS com certificado SSL
COOKIE_SECURE="false"

# Rate Limit para Telões de Placar (requisições por minuto por IP)
PLACAR_RATE_LIMIT_PER_MINUTE="300"
```

> [!WARNING]
> O arquivo `.env` nunca deve ser versionado no Git. Ele está protegido pelo `.gitignore`.

---

## 3. Modos de Execução em Rede Local (LAN)

Para permitir que aparelhos da secretaria, pista e telões acessem o sistema pelo IP da máquina servidora:

### 3.1. Modo HTTP em Rede Local (Padrão para Parques Sem Domínio)
1. Descubra o IP local da máquina servidora:
   ```bash
   ip route get 1.1.1.1 | awk '{print $7}' # Linux
   ipconfig getifaddr en0                  # macOS
   ```
2. Defina no `.env`:
   ```env
   COOKIE_SECURE="false"
   ```
3. Inicie o servidor escutando em todas as interfaces (`0.0.0.0`):
   ```bash
   npm run build
   npx next start -H 0.0.0.0 -p 3000
   ```
4. Os operadores acessam no navegador: `http://192.168.1.XX:3000`.

### 3.2. Modo HTTPS com Proxy Reverso (Caddy / Nginx)
Se desejar criptografia TLS completa com certificados válidos na rede local:
1. Configure `COOKIE_SECURE="true"` no `.env`.
2. Exemplo de configuração simples com **Caddy**:
   ```caddyfile
   vaquejada.local, 192.168.1.100 {
       reverse_proxy 127.0.0.1:3000
       tls internal
   }
   ```

---

## 4. Gerenciamento com PM2 (Recomendado)

O PM2 mantém o sistema ativo continuamente, reiniciando o processo automaticamente em caso de falhas ou consumo excessivo de memória.

### Instalação e Inicialização:
```bash
# 1. Instalar o PM2 globalmente
npm install -g pm2

# 2. Gerar a build de produção otimizada
npm run build

# 3. Iniciar a aplicação usando o ecossistema configurado
pm2 start ecosystem.config.js

# 4. Configurar inicialização automática junto com o sistema operacional
pm2 save
pm2 startup
```

### Comandos de Gestão Operacional:
```bash
pm2 status                  # Verifica status, CPU e consumo de memória
pm2 logs vaquejada-sistema  # Monitora logs de acesso e erros em tempo real
pm2 reload vaquejada-sistema # Reinicia o sistema com zero downtime
pm2 restart vaquejada-sistema # Reinício forçado do processo
```

---

## 5. Gerenciamento com Systemd (Serviço Nativo Linux)

Caso prefira gerenciar o serviço nativamente no Linux Ubuntu/Debian:

1. Crie o arquivo de serviço:
   ```bash
   sudo nano /etc/systemd/system/vaquejada.service
   ```
2. Cole o conteúdo:
   ```ini
   [Unit]
   Description=Sistema de Gestao de Vaquejada
   After=network.target postgresql.service

   [Service]
   Type=simple
   User=vaquejada
   WorkingDirectory=/opt/vaquejada
   Environment=NODE_ENV=production
   Environment=COOKIE_SECURE=false
   ExecStart=/usr/bin/npm run start -- -H 0.0.0.0 -p 3000
   Restart=always
   RestartSec=5
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```
3. Ative e inicie o serviço:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable vaquejada.service
   sudo systemctl start vaquejada.service
   sudo systemctl status vaquejada.service
   ```

---

## 6. Runbooks de Contingência Operacional (Durante o Evento)

### 🚨 INCIDENTE 1: Queda do Wi-Fi do Parque de Vaquejada
- **Diagnóstico:** As telas da secretaria ou pista exibem aviso de desconexão ou carregam indefinidamente.
- **Causa Comum:** Interferência de sinal devido à grande aglomeração de público, saturação de canais 2.4 GHz ou antena desligada.
- **Ação Imediata de Contingência:**
  1. Conecte os notebooks da Secretaria e da Pista diretamente ao Switch central usando cabos de rede Ethernet (Cat5e ou Cat6).
  2. Mantenha uma rede Wi-Fi exclusiva com SSID oculto (5 GHz) dedicada apenas aos juízes e operadores de cancela.
  3. Em caso de queima do roteador, utilize um roteador reserva pré-configurado com a mesma faixa de IP (ex: `192.168.1.0/24`). Não é necessário acesso à internet para o evento funcionar.

### 🚨 INCIDENTE 2: Servidor Travou ou Foi Desligado Acidentalmente
- **Diagnóstico:** O sistema deixa de responder em todos os aparelhos.
- **Ação Imediata de Contingência:**
  1. Ligue o servidor ou reinicie pelo botão físico caso esteja completamente travado.
  2. O serviço iniciará automaticamente via PM2 ou Systemd em menos de 10 segundos.
  3. **Integridade de Dados:** O PostgreSQL garante que nenhuma corrida ou venda seja corrompida, pois todas as gravações operacionais utilizam transações com Write-Ahead Logging (WAL).
  4. Nenhuma senha ou resultado homologado será perdido. Os operadores só precisam recarregar a página (F5).

### 🚨 INCIDENTE 3: Queda Total de Energia Elétrica (Apagão no Parque)
- **Diagnóstico:** Iluminação do parque e tomadas desligadas.
- **Ação Imediata de Contingência:**
  1. O No-break dedicado manterá o servidor e o switch de rede ligados por até 45 a 60 minutos.
  2. Notebooks da pista e da secretaria operam normalmente em suas baterias internas.
  3. Ligue o gerador de energia do parque e comute a chave de alimentação do circuito do servidor.
  4. O cronômetro da cancela e o estado das baterias continuam perfeitamente sincronizados no servidor.

### 🚨 INCIDENTE 4: Desastre Total de Hardware do Servidor
- **Diagnóstico:** Queima da placa-mãe, disco rígido ou pane física irrecuperável da máquina servidora.
- **Tempo de Recuperação:** Menos de 5 minutos.
- **Ação Imediata de Restauração:**
  1. Pegue o notebook reserva oficial configurado antes do evento.
  2. Conecte o pendrive ou HD externo de backup onde os dumps diários foram gravados.
  3. Restaure o último dump executando:
     ```bash
     ./scripts/restore.sh /caminho/do/backup/vaquejada_backup_YYYYMMDD_HHMMSS.dump vaquejada_db
     ```
  4. Inicie o sistema no notebook reserva (`pm2 start ecosystem.config.js`).
  5. Ajuste o IP do notebook reserva para o IP original do servidor para evitar ter que reconfigurar os clientes.

---

## 7. Checklist Operacional do Evento (D-1 e D-0)

### No Dia Anterior (D-1):
- [ ] Executar o ensaio geral de estresse para validar banco e latência:
  ```bash
  node scripts/ensaio-geral-evento.js
  ```
- [ ] Confirmar que o cron diário de backup está instalado e rodando:
  ```bash
  crontab -l | grep backup.sh
  ```
- [ ] Imprimir um comprovante de teste na impressora térmica da secretaria e ler o QR Code com o celular.
- [ ] Validar tempo de sincronização NTP nos aparelhos da pista e da cancela.

### No Dia do Evento (D-0):
- [ ] Conferir se o no-break está com bateria 100% carregada.
- [ ] Realizar login com as contas da Secretaria, Operador de Pista e Juiz.
- [ ] Garantir que o telão esteja aberto na URL `/placar` em modo tela cheia (F11).

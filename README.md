# Vaquejada Pro - Sistema de Gestão Operacional de Vaquejada

Sistema em tempo real para controle completo de provas de vaquejada, com módulos dedicados para **Secretaria**, **Mapa de Pista (Locução)**, **Mesa de Julgamento (Boi de TV)**, **Classificação/Resultados**, **Financeiro & Caixa** e **Auditoria Operacional**.

---

## 🚀 Requisitos e Configuração Inicial

### 1. Pré-requisitos
- **Node.js**: v18.17+ ou v20+
- **PostgreSQL**: v14+ rodando localmente ou em servidor dedicado

### 2. Variáveis de Ambiente (`.env.local`)
Copie o arquivo `.env.example` para `.env.local`:
```bash
cp .env.example .env.local
```

Configure as variáveis essenciais:
```ini
# Conexão com o banco de dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/vaquejada_db"

# Chave secreta de alta entropia para assinatura dos tokens JWT (OBRIGATÓRIO)
# Se não for fornecida, o servidor se recusará a iniciar por medidas de segurança.
JWT_SECRET="bbfebadfd8f7a2c663cf164778aa6ae5c0086dbffd7f2468d06a705bf0133942"

# Configuração de segurança dos cookies de sessão
# 'false' = Permite acesso HTTP em rede local (LAN / Wi-Fi)
# 'true'  = Exige conexão criptografada HTTPS (produção)
COOKIE_SECURE=false
```

> **Atenção:** O arquivo `.env.local` está incluído no `.gitignore` e **nunca** deve ser versionado no Git.

---

## 📡 Execução em Rede Local (HTTP) vs. Produção (HTTPS)

### Cenário 1: Operação em Rede Local / Wi-Fi do Parque (HTTP)
Quando o servidor estiver rodando no parque de vaquejada e operadores (como Juízes e Locutores de pista) utilizarem tablets e smartphones conectados à mesma rede Wi-Fi local sem certificado SSL:

1. Defina no `.env.local`:
   ```ini
   COOKIE_SECURE=false
   ```
2. Inicie o servidor escutando em todas as interfaces de rede (`0.0.0.0`):
   ```bash
   npm run build
   npx next start -H 0.0.0.0 -p 3000
   # ou em modo desenvolvimento:
   npx next dev -H 0.0.0.0 -p 3000
   ```
3. Descubra o IP local do servidor (ex: `192.168.1.100`):
   - **macOS/Linux**: `ifconfig` ou `ip a`
   - **Windows**: `ipconfig`
4. Nos tablets e celulares conectados ao Wi-Fi, abra o navegador e acesse:
   ```
   http://192.168.1.100:3000
   ```
   Como `COOKIE_SECURE=false`, os cookies de autenticação `vaquejada_session` serão gravados e mantidos perfeitamente pelos navegadores mobile.

### Cenário 2: Servidor em Produção na Nuvem (HTTPS)
Ao publicar em VPS ou nuvem com domínio público:
1. Defina no `.env.production` ou ambiente:
   ```ini
   COOKIE_SECURE=true
   ```
2. Utilize um proxy reverso com terminação SSL automática (Caddy, Nginx com Certbot, ou Cloudflare).
3. Todas as requisições serão forçadas para HTTPS e os cookies trafegarão exclusivamente com a flag `Secure`.

---

## 🔐 Matriz de Perfis e Permissões (RBAC)

O sistema opera sob modelo estrito de controle de acesso baseado em papéis:

| Perfil | Acesso a Telas | Ações Permitidas |
| :--- | :--- | :--- |
| **`ADMIN`** | Todas as telas (`/usuarios`, `/auditoria`, `/bois`, `/vaquejadas`, `/kits`, `/oportunidades`, `/secretaria`, `/mapa`, `/juiz`, `/financeiro`, `/resultados`) | Acesso total irrestrito, cancelamentos com corrida concluída, desbloqueio de contas e gestão de usuários. |
| **`SECRETARIA`** | `/secretaria`, `/senhas`, `/financeiro`, `/bois-ouro`, `/resultados` | Venda de senhas e kits, cancelamento de senhas regulares, controle financeiro de entradas e saídas do caixa. |
| **`OPERADOR_PISTA`**| `/mapa`, `/resultados` | Visualização da fila da rodada, chamada de vaqueiros para o brete, início de corrida e apontamento de resultado de pista (`VALEU` / `ZERO`). |
| **`JUIZ`** | `/juiz`, `/resultados` | Mesa de julgamento de Boi de TV: deferimento/indeferimento de contestações e revisão de vídeos de prova. |

---

## 🛠️ Comandos de Gestão

### Criar Administrador Inicial (CLI)
Para criar ou atualizar um administrador via linha de comando sem senha padrão no código:
```bash
node scripts/create-admin.js "Nome do Administrador" "admin@vaquejada.com" "SenhaForte123!"
```

### Rate Limiting e Proteção Contra Ataques
- O sistema implementa limitação de tentativas de login por **Usuário E por Endereço IP**.
- Tentativas incorretas de um IP malicioso **não** bloqueiam o acesso legítimo do usuário ou ADMIN a partir de outro endereço IP.
- Administradores podem desbloquear contas bloqueadas pela tela `/usuarios` clicando em **Desbloquear** ou via API `POST /api/usuarios/[id]/desbloquear`.

---

## 🧪 Testes Automatizados

Para executar os testes de validação das regras de segurança e fluxos:
```bash
# Teste de integridade de segurança, RBAC estrito e fluxo operacional
node scripts/test-bloco-b.js

# Varredura completa de rotas e comprovação de proteção contra acessos anônimos
node scripts/test-seguranca-rotas.js
```

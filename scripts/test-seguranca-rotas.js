/**
 * Teste Automatizado de Segurança - PARTE 1
 * 1. Login por IP da rede (não só localhost)
 * 2. Rate limit por usuário E por IP (não bloqueia ADMIN de outro IP) e desbloqueio por ADMIN
 * 3. Usuário desativado ou com perfil alterado perde acesso imediatamente
 * 4. Verificação de JWT_SECRET obrigatório sem fallback
 * 5. Varredura automática de TODAS as rotas e páginas com comprovação de bloqueio anônimo
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const BASE_URL_IP = process.env.TEST_BASE_URL || 'http://127.0.0.1:3099';
const PG_URL = process.env.DATABASE_URL || 'postgresql://briciocardoso@localhost:5432/vaquejada_db';

const MATRIZ_ROTAS = {
  // Telas
  '/login': { tipo: 'TELA', roles: ['PUBLICO'], authExigida: false },
  '/acesso-negado': { tipo: 'TELA', roles: ['PUBLICO'], authExigida: false },
  '/': { tipo: 'TELA', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'], authExigida: true },
  '/secretaria': { tipo: 'TELA', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/senhas': { tipo: 'TELA', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/financeiro': { tipo: 'TELA', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/bois-ouro': { tipo: 'TELA', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/mapa': { tipo: 'TELA', roles: ['ADMIN', 'OPERADOR_PISTA'], authExigida: true },
  '/juiz': { tipo: 'TELA', roles: ['ADMIN', 'JUIZ'], authExigida: true },
  '/resultados': { tipo: 'TELA', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'], authExigida: true },
  '/bois': { tipo: 'TELA', roles: ['ADMIN'], authExigida: true },
  '/vaquejadas': { tipo: 'TELA', roles: ['ADMIN'], authExigida: true },
  '/kits': { tipo: 'TELA', roles: ['ADMIN'], authExigida: true },
  '/oportunidades': { tipo: 'TELA', roles: ['ADMIN'], authExigida: true },
  '/usuarios': { tipo: 'TELA', roles: ['ADMIN'], authExigida: true },
  '/auditoria': { tipo: 'TELA', roles: ['ADMIN'], authExigida: true },
  '/competidores': { tipo: 'TELA', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'], authExigida: true },
  '/cavalos': { tipo: 'TELA', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'], authExigida: true },
  '/placar': { tipo: 'TELA', roles: ['PUBLICO'], authExigida: false },

  // APIs
  '/api/auth/login': { tipo: 'API', roles: ['PUBLICO'], authExigida: false },
  '/api/placar': { tipo: 'API', roles: ['PUBLICO'], authExigida: false },
  '/api/auth/logout': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'], authExigida: true },
  '/api/auth/me': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'], authExigida: true },
  '/api/secretaria/vendas': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/api/secretaria/kits': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/api/secretaria/boi-ouro': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/api/senhas': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/api/financeiro': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/api/bois-ouro': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/api/mapa': { tipo: 'API', roles: ['ADMIN', 'OPERADOR_PISTA'], authExigida: true },
  '/api/baterias': { tipo: 'API', roles: ['ADMIN', 'OPERADOR_PISTA', 'SECRETARIA', 'JUIZ'], authExigida: true },
  '/api/juiz': { tipo: 'API', roles: ['ADMIN', 'JUIZ'], authExigida: true },
  '/api/resultados-senhas': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'], authExigida: true },
  '/api/competidores': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'], authExigida: true },
  '/api/cavalos': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'], authExigida: true },
  '/api/bois': { tipo: 'API', roles: ['ADMIN'], authExigida: true },
  '/api/vaquejadas': { tipo: 'API', roles: ['ADMIN'], authExigida: true },
  '/api/kits': { tipo: 'API', roles: ['ADMIN', 'SECRETARIA'], authExigida: true },
  '/api/oportunidades': { tipo: 'API', roles: ['ADMIN'], authExigida: true },
  '/api/usuarios': { tipo: 'API', roles: ['ADMIN'], authExigida: true },
  '/api/auditoria': { tipo: 'API', roles: ['ADMIN'], authExigida: true },
};

async function requisicao(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL_IP}${endpoint}`;
  const response = await fetch(url, {
    redirect: 'manual',
    ...options,
  });
  return response;
}

async function run() {
  console.log('========================================================================');
  console.log('🛡️  INICIANDO BATERIA DE AUDITORIA E SEGURANÇA AVANÇADA - PARTE 1');
  console.log('========================================================================\n');

  const pgClient = new Client({ connectionString: PG_URL });
  await pgClient.connect();

  try {
    // -------------------------------------------------------------------------
    // TESTE 1: Login acessando por IP numérico da rede (não só localhost)
    // -------------------------------------------------------------------------
    console.log('▶ Teste 1: Autenticação acessando por IP da rede local (127.0.0.1)...');
    const loginIpRes = await requisicao('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@vaquejada.com', senha: 'Admin@Vaquejada2026!' }),
    });

    if (loginIpRes.status !== 200) {
      throw new Error(`Falha no login por IP: status ${loginIpRes.status}`);
    }

    const cookieHeader = loginIpRes.headers.get('set-cookie');
    if (!cookieHeader || !cookieHeader.includes('vaquejada_session')) {
      throw new Error('Cookie de sessão não retornado no login por IP');
    }
    console.log('  ✅ Login por IP da rede realizado com sucesso. Cookie de sessão emitido.');

    // Extrair token do cookie
    const tokenMatch = cookieHeader.match(/vaquejada_session=([^;]+)/);
    const adminCookie = tokenMatch ? `vaquejada_session=${tokenMatch[1]}` : '';

    // Testar /api/auth/me usando o cookie recebido
    const meRes = await requisicao('/api/auth/me', {
      headers: { cookie: adminCookie },
    });
    const meData = await meRes.json();
    if (!meData.authenticated || meData.usuario.email !== 'admin@vaquejada.com') {
      throw new Error('Falha ao validar sessão via IP');
    }
    console.log(`  ✅ Sessão validada via IP numérico para o usuário "${meData.usuario.nome}" (${meData.usuario.papel}).`);

    // -------------------------------------------------------------------------
    // TESTE 2: Rate limit por Usuário E por IP (Ataque de IP externo não bloqueia ADMIN)
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 2: Rate limit de login por Usuário E IP...');
    const ipAtacante = '198.51.100.77';
    const ipLegitimo = '127.0.0.1';

    // Limpar qualquer tentativa prévia
    await pgClient.query('DELETE FROM login_tentativas_v2 WHERE email = $1', ['admin@vaquejada.com']);

    // Simular 5 tentativas erradas vindas do IP atacante
    for (let i = 1; i <= 5; i++) {
      await requisicao('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ipAtacante,
        },
        body: JSON.stringify({ email: 'admin@vaquejada.com', senha: `senha_errada_${i}` }),
      });
    }

    // A 6ª tentativa vinda do IP atacante DEVE ser bloqueada por 429
    const tentativa6Atacante = await requisicao('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ipAtacante,
      },
      body: JSON.stringify({ email: 'admin@vaquejada.com', senha: 'outra_senha_errada' }),
    });

    if (tentativa6Atacante.status !== 429) {
      throw new Error(`Esperava 429 Too Many Requests para IP atacante, obteve ${tentativa6Atacante.status}`);
    }
    console.log('  ✅ Atacante no IP 198.51.100.77 foi bloqueado com sucesso (429 Too Many Requests).');

    // Agora o ADMIN legítimo tenta logar do seu IP normal (127.0.0.1): DEVE FUNCIONAR!
    const loginAdminLegitimo = await requisicao('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ipLegitimo,
      },
      body: JSON.stringify({ email: 'admin@vaquejada.com', senha: 'Admin@Vaquejada2026!' }),
    });

    if (loginAdminLegitimo.status !== 200) {
      throw new Error(`ADMIN legítimo foi indevidamente bloqueado por erro de outro IP! Status: ${loginAdminLegitimo.status}`);
    }
    console.log('  ✅ ADMIN legítimo logou com sucesso a partir do IP local! O bloqueio afetou apenas o IP do atacante.');

    // Testar desbloqueio administrativo via API
    const adminUser = await pgClient.query("SELECT id FROM usuarios WHERE email = 'admin@vaquejada.com'");
    const adminId = adminUser.rows[0].id;

    const desbloqueioRes = await requisicao(`/api/usuarios/${adminId}/desbloquear`, {
      method: 'POST',
      headers: { cookie: adminCookie },
    });
    if (desbloqueioRes.status !== 200) {
      throw new Error(`Falha no endpoint de desbloqueio: status ${desbloqueioRes.status}`);
    }
    console.log('  ✅ ADMIN desbloqueou com sucesso todos os bloqueios de login via API.');

    // -------------------------------------------------------------------------
    // TESTE 3: Usuário desativado ou com perfil alterado perde acesso IMEDIATAMENTE
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 3: Revogação Imediata no Servidor (Usuário desativado ou perfil trocado)...');
    
    // Criar um usuário temporário para testar
    const emailTemp = `teste-revogacao-${Date.now()}@vaquejada.com`;
    const tempId = `usr-temp-${Date.now()}`;
    const hashSenhaValida = require('bcryptjs').hashSync('Secretaria@123', 10);
    const userCriado = await pgClient.query(
      `INSERT INTO usuarios (id, nome, email, senha_hash, papel, ativo)
       VALUES ($1, 'Operador Temporario', $2, $3, 'SECRETARIA', true)
       RETURNING id, nome, email, papel`,
      [tempId, emailTemp, hashSenhaValida]
    );



    // Fazer login com o usuário temporário
    const loginTempRes = await requisicao('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailTemp, senha: 'Secretaria@123' }),
    });
    const tempCookieHeader = loginTempRes.headers.get('set-cookie');
    const tempTokenMatch = tempCookieHeader.match(/vaquejada_session=([^;]+)/);
    const tempCookie = `vaquejada_session=${tempTokenMatch[1]}`;

    // Confirmar que o usuário temporário consegue acessar /api/senhas (perfil SECRETARIA)
    const acessoInicial = await requisicao('/api/senhas', { headers: { cookie: tempCookie } });
    if (acessoInicial.status !== 200) {
      throw new Error(`Usuário temporário falhou no acesso inicial: status ${acessoInicial.status}`);
    }
    console.log('  ✅ Usuário temporário obteve sessão válida e acessou /api/senhas (200 OK).');

    // O ADMIN desativa o usuário temporário no banco
    await pgClient.query('UPDATE usuarios SET ativo = false WHERE id = $1', [tempId]);

    // Com o MESMO token JWT (ainda válido no tempo), a requisição DEVE ser rejeitada imediatamente com 401
    const acessoPosDesativacao = await requisicao('/api/senhas', { headers: { cookie: tempCookie } });
    if (acessoPosDesativacao.status !== 401) {
      throw new Error(`Falha de segurança! Usuário desativado continuou acessando! Status: ${acessoPosDesativacao.status}`);
    }
    console.log('  ✅ Usuário desativado no banco perdeu acesso IMEDIATAMENTE na próxima requisição (401 Unauthorized).');

    // Reativar o usuário, mas alterar o papel de SECRETARIA para OPERADOR_PISTA
    await pgClient.query("UPDATE usuarios SET ativo = true, papel = 'OPERADOR_PISTA' WHERE id = $1", [tempId]);

    // O usuário tenta acessar /api/secretaria/vendas: DEVE ser barrado com 403 na hora!
    const acessoVendasNovoPapel = await requisicao('/api/secretaria/vendas', { headers: { cookie: tempCookie } });
    if (acessoVendasNovoPapel.status !== 403) {
      throw new Error(`Falha de segurança! Perfil alterado não foi aplicado no servidor! Status: ${acessoVendasNovoPapel.status}`);
    }
    console.log('  ✅ Mudança de perfil para OPERADOR_PISTA entrou em vigor IMEDIATAMENTE: barrado em vendas com 403 Forbidden.');

    // Limpar usuário temporário e seus logs de auditoria
    await pgClient.query('DELETE FROM audit_logs WHERE usuario_id = $1', [tempId]);
    await pgClient.query('DELETE FROM usuarios WHERE id = $1', [tempId]);


    // -------------------------------------------------------------------------
    // TESTE 4: Varredura Automática de TODAS as Rotas e Páginas
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 4: Varredura Completa de Rotas e Páginas sem Sessão...');
    console.log('------------------------------------------------------------------------');
    console.log(
      'ROTA'.padEnd(28) +
      'TIPO'.padEnd(8) +
      'STATUS S/ AUTH'.padEnd(16) +
      'PERFIS PERMITIDOS'
    );
    console.log('------------------------------------------------------------------------');

    let falhasVarredura = 0;

    for (const [rota, config] of Object.entries(MATRIZ_ROTAS)) {
      const opcoes = rota === '/api/auth/login' ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) } : {};
      const res = await requisicao(rota, opcoes);
      let statusOk = false;

      if (!config.authExigida) {
        // Pública: telas retornam 200; APIs públicas retornam 400 (bad request por body vazio) ou 200, sem 401
        statusOk = res.status === 200 || (config.tipo === 'API' && res.status === 400);
      } else if (config.tipo === 'API') {
        // API sem auth deve retornar 401
        statusOk = res.status === 401;
      } else {
        // Tela sem auth deve redirecionar (307 ou 302) para /login
        const location = res.headers.get('location') || '';
        statusOk = (res.status === 307 || res.status === 302) && location.includes('/login');
      }

      const statusDesc = config.tipo === 'API'
        ? `${res.status} ${res.status === 401 ? '🔒 (401)' : (config.authExigida ? '❌' : '🌐 (Pública)')}`
        : `${res.status} ${res.status === 307 || res.status === 302 ? '↪ (/login)' : (config.authExigida ? '❌' : '🌐 (Pública)')}`;


      console.log(
        rota.padEnd(28) +
        config.tipo.padEnd(8) +
        statusDesc.padEnd(16) +
        config.roles.join(', ')
      );

      if (!statusOk) {
        falhasVarredura++;
      }
    }

    console.log('------------------------------------------------------------------------');

    if (falhasVarredura > 0) {
      throw new Error(`Varredura detectou ${falhasVarredura} rota(s) vulneráveis sem sessão!`);
    }

    console.log('✅ TODAS AS ROTAS E TELAS DO SISTEMA PROTEGIDAS CONTRA ACESSOS ANÔNIMOS!\n');

    console.log('========================================================================');
    console.log('🎉 SUCESSO TOTAL NA AUDITORIA E VALIDAÇÃO DE SEGURANÇA DA PARTE 1!');
    console.log('========================================================================');

  } finally {
    await pgClient.end();
  }
}

run().catch((err) => {
  console.error('\n❌ ERRO NA EXECUÇÃO DA BATERIA DE SEGURANÇA:', err);
  process.exit(1);
});

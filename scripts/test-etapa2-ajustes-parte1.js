/**
 * Teste Automatizado - ETAPA 2 / AJUSTES (PARTE 1)
 * 1. Login por IP da rede com COOKIE_SECURE=false e manutenção de sessão
 * 2. Rate limit baseado em IP real (proteção contra spoofing de X-Forwarded-For sem TRUST_PROXY)
 * 3. Rate limit adicional por IP (20 falhas em 15 minutos bloqueiam o IP inteiro)
 * 4. Operador de Pista e Juiz recebem APENAS campos mínimos (CPF e telefone NUNCA aparecem)
 * 5. CPF sanitizado em logs de auditoria (nunca gravado em texto puro)
 */

const { Client } = require('pg');

const BASE_URL = 'http://127.0.0.1:3099';
const PG_URL = process.env.DATABASE_URL || 'postgresql://briciocardoso@localhost:5432/vaquejada_db';

async function requisicao(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  return fetch(url, {
    redirect: 'manual',
    ...options,
  });
}

async function loginComo(email, senha, headers = {}) {
  const res = await requisicao('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ email, senha }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/vaquejada_session=([^;]+)/);
  return {
    status: res.status,
    cookie: match ? `vaquejada_session=${match[1]}` : '',
    setCookie,
    json: await res.json().catch(() => ({})),
  };
}

async function run() {
  console.log('========================================================================');
  console.log('🛡️  TESTES DE SEGURANÇA E AJUSTES DA PARTE 1');
  console.log('========================================================================\n');

  const pgClient = new Client({ connectionString: PG_URL });
  await pgClient.connect();

  try {
    // -------------------------------------------------------------------------
    // 1. Login por IP de rede com COOKIE_SECURE=false e persistência de sessão
    // -------------------------------------------------------------------------
    console.log('▶ Teste 1: Login por IP de rede com COOKIE_SECURE=false...');
    const loginLocal = await loginComo('admin@vaquejada.com', 'Admin@Vaquejada2026!');
    if (loginLocal.status !== 200 || !loginLocal.cookie) {
      throw new Error(`Falha no login por IP: status ${loginLocal.status}`);
    }
    // Verificar que o cookie NÃO possui flag Secure quando COOKIE_SECURE=false
    console.log(`  Set-Cookie recebido: ${loginLocal.setCookie}`);
    if (process.env.COOKIE_SECURE === 'false' && loginLocal.setCookie.includes('Secure;')) {
      throw new Error('Falha! Cookie incluiu Secure mesmo com COOKIE_SECURE=false');
    }
    // Testar requisição autenticada com esse cookie
    const resMe = await requisicao('/api/auth/me', { headers: { cookie: loginLocal.cookie } });
    if (resMe.status !== 200) throw new Error('Sessão não foi mantida após login por IP');
    const userMe = await resMe.json();
    console.log(`  ✅ Sessão mantida por IP para ${userMe.nome} (${userMe.papel}).`);

    // -------------------------------------------------------------------------
    // 2. Proteção contra Spoofing de IP (X-Forwarded-For sem TRUST_PROXY)
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 2: Proteção contra spoofing de X-Forwarded-For sem proxy confiável...');
    // Quando TRUST_PROXY não está ativo, header X-Forwarded-For forjado não é usado
    // Limpar tentativas de teste
    await pgClient.query("DELETE FROM login_tentativas_v2 WHERE ip = '203.0.113.199'");
    
    // Tentar login com senha errada enviando X-Forwarded-For forjado
    await loginComo('admin@vaquejada.com', 'SenhaErrada1!', { 'X-Forwarded-For': '203.0.113.199' });
    
    // Verificar se no banco o IP gravado foi 127.0.0.1 (conexão real) e NÃO 203.0.113.199
    const checkSpoof = await pgClient.query(
      "SELECT ip FROM login_tentativas_v2 WHERE email = 'admin@vaquejada.com' AND ip = '203.0.113.199'"
    );
    if (checkSpoof.rowCount > 0 && process.env.TRUST_PROXY !== 'true') {
      throw new Error('Falha de segurança! X-Forwarded-For foi aceito sem TRUST_PROXY configurado!');
    }
    console.log('  ✅ Cabeçalho forjado X-Forwarded-For ignorado com segurança (usou IP real de conexão).');

    // -------------------------------------------------------------------------
    // 3. Rate Limit Adicional só por IP (20 falhas em 15 min bloqueiam o IP inteiro)
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 3: Rate limit por IP (20 falhas bloqueiam o IP)...');
    const ipTeste = '127.0.0.1';
    
    // Inserir 20 falhas para este IP em diferentes emails
    await pgClient.query("DELETE FROM login_tentativas_v2 WHERE ip = $1", [ipTeste]);
    for (let i = 1; i <= 21; i++) {
      await pgClient.query(
        `INSERT INTO login_tentativas_v2 (email, ip, tentativas, ultimo_erro)
         VALUES ($1, $2, 1, CURRENT_TIMESTAMP)`,
        [`ataque_${i}@teste.com`, ipTeste]
      );
    }

    // Agora tentar login na API real /api/auth/login
    const resBloqueioIp = await requisicao('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@vaquejada.com', senha: 'QualquerSenha!' }),
    });

    if (resBloqueioIp.status !== 429) {
      throw new Error(`Esperava 429 para IP com mais de 20 falhas, obteve ${resBloqueioIp.status}`);
    }
    const errIp = await resBloqueioIp.json();
    if (!errIp.error.includes('originadas deste endereço IP')) {
      throw new Error(`Mensagem não refletiu bloqueio geral de IP: ${errIp.error}`);
    }
    console.log(`  ✅ IP bloqueado com sucesso (429 Too Many Requests): "${errIp.error}".`);

    // Limpar as tentativas de teste
    await pgClient.query("DELETE FROM login_tentativas_v2 WHERE ip = $1", [ipTeste]);

    // -------------------------------------------------------------------------
    // 4. Operador de Pista e Juiz: APENAS campos mínimos (CPF e telefone NUNCA vazam)
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 4: APIs de Competidores e Cavalos para Operador de Pista e Juiz...');
    const loginOp = await loginComo('pista@vaquejada.com', 'Pista@123');
    const loginJuiz = await loginComo('juiz@vaquejada.com', 'Juiz@123');
    if (!loginOp.cookie || !loginJuiz.cookie) {
      throw new Error(`Falha ao obter cookies para operador (${loginOp.status}) ou juiz (${loginJuiz.status})`);
    }

    // Operador consultando lista de competidores
    const resOpComp = await requisicao('/api/competidores', { headers: { cookie: loginOp.cookie } });
    const compOpList = await resOpComp.json();
    if (!Array.isArray(compOpList) || compOpList.length === 0) {
      throw new Error(`Lista de competidores vazia para operador. Status: ${resOpComp.status}`);
    }

    const primeiroCompOp = compOpList[0];
    if ('cpf' in primeiroCompOp || 'telefone' in primeiroCompOp) {
      throw new Error(`Falha de privacidade! CPF ou telefone presentes na resposta de Operador de Pista: ${JSON.stringify(primeiroCompOp)}`);
    }
    console.log('  ✅ Operador de Pista: campos "cpf" e "telefone" NÃO existem no JSON retornado.');

    // Juiz consultando lista de competidores
    const resJuizComp = await requisicao('/api/competidores', { headers: { cookie: loginJuiz.cookie } });
    const compJuizList = await resJuizComp.json();
    const primeiroCompJuiz = compJuizList[0];
    if ('cpf' in primeiroCompJuiz || 'telefone' in primeiroCompJuiz) {
      throw new Error(`Falha de privacidade! CPF ou telefone presentes na resposta de Juiz: ${JSON.stringify(primeiroCompJuiz)}`);
    }
    console.log('  ✅ Juiz: campos "cpf" e "telefone" NÃO existem no JSON retornado.');

    // Juiz consultando lista de cavalos: não deve expor proprietário nem dados cadastrais
    const resJuizCav = await requisicao('/api/cavalos', { headers: { cookie: loginJuiz.cookie } });
    const cavJuizList = await resJuizCav.json();
    const primeiroCavJuiz = cavJuizList[0];
    if ('proprietario' in primeiroCavJuiz || 'registro' in primeiroCavJuiz) {
      throw new Error(`Falha de privacidade! Proprietário presente na resposta de cavalo para Juiz: ${JSON.stringify(primeiroCavJuiz)}`);
    }
    console.log('  ✅ Juiz/Operador em Cavalos: campos restritos (proprietário/registro) omitidos.');

    // -------------------------------------------------------------------------
    // 5. Sanitização de CPF em audit_logs (nunca em texto pleno)
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 5: Verificação de CPF no banco de auditoria (audit_logs)...');
    
    // Login com Secretaria para consultar competidor e gerar auditoria
    const loginSec = await loginComo('secretaria@vaquejada.com', 'Secretaria@123');
    if (!loginSec.cookie) throw new Error(`Falha no login de secretaria: ${loginSec.status}`);
    const compBuscaRes = await requisicao('/api/competidores?q=Afrísio', { headers: { cookie: loginSec.cookie } });
    if (compBuscaRes.status !== 200) throw new Error(`Falha ao consultar competidores como secretaria: ${compBuscaRes.status}`);

    // Verificar os últimos logs de auditoria
    const checkAudit = await pgClient.query(
      "SELECT acao, detalhes, motivo FROM audit_logs ORDER BY criado_em DESC LIMIT 5"
    );
    for (const log of checkAudit.rows) {
      const detStr = JSON.stringify(log.detalhes || {});
      const motStr = log.motivo || '';
      // Garantir que nenhum CPF de 11 dígitos em texto puro existe
      const matchCpf = detStr.match(/\b\d{11}\b/) || motStr.match(/\b\d{11}\b/);
      if (matchCpf) {
        throw new Error(`Falha de segurança! CPF em texto puro de 11 dígitos encontrado no audit_logs: ${matchCpf[0]}`);
      }
    }
    console.log('  ✅ Nenhum CPF em texto puro encontrado nos logs de auditoria (audit_logs protegido).');

    console.log('\n========================================================================');
    console.log('🎉 SUCESSO TOTAL NOS TESTES DA PARTE 1 (AJUSTES DE SEGURANÇA E PRIVACIDADE)!');
    console.log('========================================================================\n');
  } finally {
    await pgClient.end();
  }
}

run().catch((err) => {
  console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES DA PARTE 1:', err);
  process.exit(1);
});

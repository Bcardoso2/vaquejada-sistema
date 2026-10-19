const http = require('http');

const LAN_IP = '192.168.0.182';
const PORT = 3099;
const BASE_URL = `http://${LAN_IP}:${PORT}`;

function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json || data,
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function loginUser(email, senha) {
  const res = await request(
    {
      hostname: LAN_IP,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    { email, senha }
  );

  const cookieHeader = res.headers['set-cookie'];
  let cookie = '';
  if (cookieHeader && cookieHeader.length > 0) {
    cookie = cookieHeader[0].split(';')[0];
  }
  return { status: res.status, data: res.data, cookie };
}

async function runTests() {
  console.log(`\n=============================================================`);
  console.log(`🚀 TESTE PARTE 1 - AJUSTES CRÍTICOS & REDE LOCAL (IP: ${LAN_IP})`);
  console.log(`=============================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(cond, desc) {
    if (cond) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. TESTE DE LOGIN CONECTANDO NO IP DA REDE LOCAL (NÃO LOCALHOST)
  console.log(`\n--- 1. Login no Servidor via IP Real da Rede (${LAN_IP}:${PORT}) ---`);
  const loginOp = await loginUser('pista@vaquejada.com', 'Pista@123');
  assert(loginOp.status === 200, `Login do Operador via IP ${LAN_IP} retornou 200`);
  assert(loginOp.cookie.includes('vaquejada_session='), `Cookie vaquejada_session gerado com sucesso via IP LAN`);

  const meOp = await request({
    hostname: LAN_IP,
    port: PORT,
    path: '/api/auth/me',
    method: 'GET',
    headers: { Cookie: loginOp.cookie },
  });
  assert(
    meOp.status === 200 && meOp.data?.usuario?.papel === 'OPERADOR_PISTA',
    `Sessão do Operador mantida no IP ${LAN_IP}: papel = ${meOp.data?.usuario?.papel}`
  );

  const loginAdmin = await loginUser('admin@vaquejada.com', 'Admin@Vaquejada2026!');
  assert(loginAdmin.status === 200, `Login do Admin via IP ${LAN_IP} retornou 200`);

  const loginSec = await loginUser('secretaria@vaquejada.com', 'Secretaria@123');
  assert(loginSec.status === 200, `Login da Secretaria via IP ${LAN_IP} retornou 200`);

  // 2. BATERIAS - MATRIZ DE PERMISSÕES
  console.log(`\n--- 2. Matriz de Permissões de Baterias (Operador/Admin alteram, outros apenas leem) ---`);
  // Leitura permitida para Secretaria
  const getBateriasSec = await request({
    hostname: LAN_IP,
    port: PORT,
    path: '/api/baterias?vaquejada_id=vq-2026-portal',
    method: 'GET',
    headers: { Cookie: loginSec.cookie },
  });
  assert(getBateriasSec.status === 200, `Secretaria tem permissão de LEITURA de baterias (status 200)`);

  // Escrita NEGADA para Secretaria
  const postBateriasSec = await request(
    {
      hostname: LAN_IP,
      port: PORT,
      path: '/api/baterias',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: loginSec.cookie,
      },
    },
    { acao: 'GERAR', tamanho_bateria: 15 }
  );
  assert(postBateriasSec.status === 403, `Secretaria recebe 403 FORBIDDEN ao tentar alterar baterias (status = ${postBateriasSec.status})`);

  // Escrita PERMITIDA para Operador de Pista
  const postBateriasOp = await request(
    {
      hostname: LAN_IP,
      port: PORT,
      path: '/api/baterias',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: loginOp.cookie,
      },
    },
    { acao: 'GERAR', tamanho_bateria: 10 }
  );
  assert(postBateriasOp.status === 200, `Operador de Pista tem autorização para GERAR baterias (status 200)`);

  // 3. CRONÔMETRO DE CANCELA VIA SERVIDOR (TIMESTAMP DO BANCO)
  console.log(`\n--- 3. Cronômetro de Cancela Sincronizado no Servidor (Server-Side Timestamp) ---`);
  const disparoCancela = await request(
    {
      hostname: LAN_IP,
      port: PORT,
      path: '/api/cancela',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: loginOp.cookie,
      },
    },
    { acao: 'DISPARAR', tempo_tolerancia: 30, vaquejada_id: 'vq-2026-portal' }
  );
  assert(disparoCancela.status === 200 && disparoCancela.data.status === 'RODANDO', `Cancela disparada no servidor (status = RODANDO, tolerância = 30s)`);

  // Aguardar 2.2 segundos para comprovar que o timestamp avançou no servidor
  console.log('     Aguardando 2.2 segundos para verificar contagem pelo timestamp do servidor...');
  await new Promise((r) => setTimeout(r, 2200));

  const checkCancela = await request({
    hostname: LAN_IP,
    port: PORT,
    path: '/api/cancela?vaquejada_id=vq-2026-portal',
    method: 'GET',
    headers: { Cookie: loginOp.cookie },
  });
  assert(
    checkCancela.status === 200 && checkCancela.data.tempoRestante <= 28 && checkCancela.data.tempoRestante >= 25,
    `Tempo restante calculado pelo servidor via timestamp: ${checkCancela.data.tempoRestante}s (sem perda por reload de browser)`
  );

  // Parar a cancela
  const pararCancela = await request(
    {
      hostname: LAN_IP,
      port: PORT,
      path: '/api/cancela',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: loginOp.cookie,
      },
    },
    { acao: 'PARAR', vaquejada_id: 'vq-2026-portal' }
  );
  assert(pararCancela.status === 200 && pararCancela.data.status === 'PARADA', `Cancela parada com sucesso (status = PARADA)`);

  // 4. /api/placar - CACHE E PROTEÇÃO
  console.log(`\n--- 4. Endpoint /api/placar (Cache Curto, Rate Limit e Headers) ---`);
  const placarReq1 = await request({
    hostname: LAN_IP,
    port: PORT,
    path: '/api/placar',
    method: 'GET',
  });
  assert(placarReq1.status === 200, `/api/placar respondeu 200 OK no IP ${LAN_IP}`);
  assert(placarReq1.headers['cache-control']?.includes('s-maxage=2'), `Cache-Control com s-maxage=2 configurado no servidor`);

  const placarReq2 = await request({
    hostname: LAN_IP,
    port: PORT,
    path: '/api/placar',
    method: 'GET',
  });
  assert(placarReq2.headers['x-cache'] === 'HIT', `Requisição subsequente atendida pelo CACHE EM MEMÓRIA (X-Cache: HIT)`);

  // 5. DESFAZER DE 10S E CORREÇÃO ADMINISTRATIVA AUDITADA
  console.log(`\n--- 5. Desfazer de 10s e Correção Administrativa Auditada ---`);
  // Buscar uma corrida para testar
  const mapaRes = await request({
    hostname: LAN_IP,
    port: PORT,
    path: '/api/mapa',
    method: 'GET',
    headers: { Cookie: loginOp.cookie },
  });
  assert(mapaRes.status === 200 && Array.isArray(mapaRes.data), `Carregou corridas do mapa para teste de resultado`);

  const corridaTeste = mapaRes.data[0];
  if (corridaTeste) {
    // A) Colocar em EM_EXECUCAO
    await request(
      {
        hostname: LAN_IP,
        port: PORT,
        path: '/api/mapa',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: loginOp.cookie },
      },
      { acao: 'INICIAR', corridaId: corridaTeste.id }
    );

    // B) Registrar VALEU BOI
    const resReg = await request(
      {
        hostname: LAN_IP,
        port: PORT,
        path: '/api/mapa',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: loginOp.cookie },
      },
      { acao: 'REGISTRAR_RESULTADO', corridaId: corridaTeste.id, resultado: 'VALEU' }
    );
    assert(resReg.status === 200, `Resultado VALEU BOI registrado pelo Operador de Pista`);

    // C) Desfazer dentro de 10s
    const resDesfazer = await request(
      {
        hostname: LAN_IP,
        port: PORT,
        path: '/api/mapa',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: loginOp.cookie },
      },
      { acao: 'DESFAZER_RESULTADO', corridaId: corridaTeste.id }
    );
    assert(resDesfazer.status === 200, `Desfazer acionado pelo operador com sucesso (retornou para EM_EXECUCAO)`);

    // D) Finalizar novamente com ZERO para testar correção administrativa
    await request(
      {
        hostname: LAN_IP,
        port: PORT,
        path: '/api/mapa',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: loginOp.cookie },
      },
      { acao: 'REGISTRAR_RESULTADO', corridaId: corridaTeste.id, resultado: 'ZERO' }
    );

    // E) Correção administrativa pelo ADMIN com motivo
    const resCorrecaoAdmin = await request(
      {
        hostname: LAN_IP,
        port: PORT,
        path: '/api/mapa',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: loginAdmin.cookie },
      },
      {
        acao: 'CORRIGIR_RESULTADO_ADMIN',
        corridaId: corridaTeste.id,
        novoResultado: 'VALEU',
        motivo: 'Comissão julgadora reavaliou filmagem oficial do circuito e confirmou boi de pé entre as faixas.',
      }
    );
    assert(resCorrecaoAdmin.status === 200, `Correção administrativa realizada pelo ADMIN com justificativa auditada`);

    // F) Tentativa de correção por perfil sem permissão (Secretaria)
    const resCorrecaoSec = await request(
      {
        hostname: LAN_IP,
        port: PORT,
        path: '/api/mapa',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: loginSec.cookie },
      },
      {
        acao: 'CORRIGIR_RESULTADO_ADMIN',
        corridaId: corridaTeste.id,
        novoResultado: 'ZERO',
        motivo: 'Tentativa não autorizada',
      }
    );
    assert(resCorrecaoSec.status === 403, `Secretaria recebe 403 ao tentar corrigir resultado administrativo`);

    // G) Verificar se auditoria registrou as operações
    const auditRes = await request({
      hostname: LAN_IP,
      port: PORT,
      path: '/api/auditoria?limite=10',
      method: 'GET',
      headers: { Cookie: loginAdmin.cookie },
    });
    const temDesfazer = auditRes.data?.some((a) => a.acao === 'DESFAZER_RESULTADO');
    const temCorrecao = auditRes.data?.some((a) => a.acao === 'CORRECAO_RESULTADO_ADMIN');
    assert(temDesfazer, `Auditoria registrou a ação DESFAZER_RESULTADO`);
    assert(temCorrecao, `Auditoria registrou a ação CORRECAO_RESULTADO_ADMIN`);
  }

  console.log(`\n=============================================================`);
  console.log(`📊 RESULTADO FINAL PARTE 1: ${passed} PASSOU, ${failed} FALHOU`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal ao rodar testes:', err);
  process.exit(1);
});

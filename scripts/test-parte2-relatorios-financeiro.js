const http = require('http');

const HOST = '127.0.0.1';
const PORT = 3099;

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
          rawBody: data,
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
      hostname: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

// Regex rigoroso para detectar CPF completo formatado (123.456.789-01) ou desformatado (11 dígitos)
const CPF_COMPLETO_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

async function runTests() {
  console.log(`\n=============================================================`);
  console.log(`🚀 TESTE PARTE 2 - RELATÓRIOS, FECHAMENTO DE CAIXA E COMPROVANTE`);
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

  // 1. Logins dos perfis necessários
  console.log(`\n--- 1. Autenticação para Matriz de Testes de Relatórios ---`);
  const admin = await loginUser('admin@vaquejada.com', 'Admin@Vaquejada2026!');
  const sec = await loginUser('secretaria@vaquejada.com', 'Secretaria@123');
  const opPista = await loginUser('pista@vaquejada.com', 'Pista@123');
  const juiz = await loginUser('juiz@vaquejada.com', 'Juiz@123');

  assert(admin.status === 200, `Login do Admin realizado com sucesso`);
  assert(sec.status === 200, `Login da Secretaria realizado com sucesso`);
  assert(opPista.status === 200, `Login do Operador de Pista realizado com sucesso`);
  assert(juiz.status === 200, `Login do Juiz de Pista realizado com sucesso`);

  // Obter ID de uma bateria existente
  const resBat = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/baterias?vaquejada_id=vq-2026-portal',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const bateriaId = resBat.data[0]?.id || 'bat-1-vq-2026-portal';

  // 2. Súmula da Bateria em PDF (HTML imprimível A4)
  console.log(`\n--- 2. Súmula Oficial de Bateria em PDF (RBAC: Admin, Secretaria e Pista) ---`);
  // Operador de Pista pode exportar
  const sumulaOp = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/relatorios/bateria/${bateriaId}?formato=pdf`,
    method: 'GET',
    headers: { Cookie: opPista.cookie },
  });
  assert(sumulaOp.status === 200, `Operador de Pista pode exportar Súmula da Bateria (200 OK)`);
  assert(sumulaOp.rawBody.includes('Súmula Oficial'), `Conteúdo contém cabeçalho oficial de súmula`);
  assert(!CPF_COMPLETO_REGEX.test(sumulaOp.rawBody), `Zero CPF completo na Súmula da Bateria (LGPD em conformidade)`);

  // Secretaria pode exportar
  const sumulaSec = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/relatorios/bateria/${bateriaId}?formato=pdf`,
    method: 'GET',
    headers: { Cookie: sec.cookie },
  });
  assert(sumulaSec.status === 200, `Secretaria pode exportar Súmula da Bateria (200 OK)`);

  // Juiz NÃO pode exportar súmula administrativa (Acesso negado)
  const sumulaJuiz = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/relatorios/bateria/${bateriaId}?formato=pdf`,
    method: 'GET',
    headers: { Cookie: juiz.cookie },
  });
  assert(sumulaJuiz.status === 403, `Juiz recebe 403 FORBIDDEN ao tentar exportar súmula (status = ${sumulaJuiz.status})`);

  // 3. Relatório de Resultados por Categoria e Bateria em PDF e Excel
  console.log(`\n--- 3. Relatório de Resultados em PDF e Excel (RBAC: Admin e Secretaria) ---`);
  // Admin em PDF
  const resPdfAdmin = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/relatorios/resultados?formato=pdf&categoria=PROFISSIONAL',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  assert(resPdfAdmin.status === 200, `Admin pode exportar Resultados em PDF (200 OK)`);
  assert(!CPF_COMPLETO_REGEX.test(resPdfAdmin.rawBody), `Zero CPF completo no relatório de resultados PDF`);

  // Secretaria em Excel
  const resExcelSec = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/relatorios/resultados?formato=excel',
    method: 'GET',
    headers: { Cookie: sec.cookie },
  });
  assert(resExcelSec.status === 200, `Secretaria pode exportar Resultados em Excel (200 OK)`);
  assert(
    resExcelSec.headers['content-type']?.includes('text/csv') &&
      resExcelSec.headers['content-disposition']?.includes('.csv'),
    `Cabeçalhos corretos de download Excel/CSV enviados pelo servidor`
  );
  assert(resExcelSec.rawBody.startsWith('\uFEFF'), `Arquivo CSV possui UTF-8 BOM para abertura perfeita no Microsoft Excel`);
  assert(!CPF_COMPLETO_REGEX.test(resExcelSec.rawBody), `Zero CPF completo no CSV de resultados exportado`);

  // Operador de Pista recebe 403 Forbidden
  const resOpNegado = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/relatorios/resultados?formato=excel',
    method: 'GET',
    headers: { Cookie: opPista.cookie },
  });
  assert(resOpNegado.status === 403, `Operador de Pista recebe 403 FORBIDDEN em Resultados (status = ${resOpNegado.status})`);

  // 4. Fechamento de Caixa por Operador/Turno e Evento Completo
  console.log(`\n--- 4. Fechamento Financeiro de Caixa em PDF e Excel (RBAC: Admin e Secretaria) ---`);
  // Secretaria em PDF
  const caixaPdfSec = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/relatorios/fechamento-caixa?formato=pdf',
    method: 'GET',
    headers: { Cookie: sec.cookie },
  });
  assert(caixaPdfSec.status === 200, `Secretaria pode exportar Fechamento de Caixa em PDF (200 OK)`);
  assert(caixaPdfSec.rawBody.includes('Demonstrativo Contábil e Fechamento de Caixa'), `Demonstrativo contábil gerado no PDF`);
  assert(caixaPdfSec.rawBody.includes('Saldo Líquido em Caixa'), `Resumo de Saldo Líquido discriminado`);
  assert(!CPF_COMPLETO_REGEX.test(caixaPdfSec.rawBody), `Zero CPF completo no fechamento de caixa PDF`);

  // Admin em Excel
  const caixaExcelAdmin = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/relatorios/fechamento-caixa?formato=excel',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  assert(caixaExcelAdmin.status === 200, `Admin pode exportar Fechamento de Caixa em Excel (200 OK)`);
  assert(caixaExcelAdmin.rawBody.includes('TOTALIZAÇÃO POR FORMA DE PAGAMENTO'), `Contém totalização por forma de pagamento no Excel`);
  assert(!CPF_COMPLETO_REGEX.test(caixaExcelAdmin.rawBody), `Zero CPF completo no Excel de fechamento de caixa`);

  // Operador de Pista e Juiz recebem 403 Forbidden
  const caixaOpNegado = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/relatorios/fechamento-caixa?formato=pdf',
    method: 'GET',
    headers: { Cookie: opPista.cookie },
  });
  assert(caixaOpNegado.status === 403, `Operador de Pista recebe 403 FORBIDDEN no Fechamento Financeiro (status = ${caixaOpNegado.status})`);

  // 5. Comprovante de Senha para Impressora Térmica 58/80mm
  console.log(`\n--- 5. Comprovante de Senha Térmico 58/80mm ---`);
  // Buscar uma senha ativa
  const resSenhas = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/senhas?limit=1',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const senhaId = resSenhas.data[0]?.id;
  assert(senhaId !== undefined, `Localizou senha no banco para emissão de comprovante térmico (${senhaId})`);

  if (senhaId) {
    // API de detalhes da senha
    const senhaDetalhes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/senhas/${senhaId}`,
      method: 'GET',
      headers: { Cookie: sec.cookie },
    });
    assert(senhaDetalhes.status === 200, `GET /api/senhas/${senhaId} retornou 200 OK com dados do canhoto`);
    assert(senhaDetalhes.data.codigo !== undefined, `Código da senha presente: #${senhaDetalhes.data.codigo}`);
    assert(!senhaDetalhes.data.cpf, `Zero CPF no retorno da API de comprovante`);

    // Acesso à página do comprovante térmico
    const paginaComprovante = await request({
      hostname: HOST,
      port: PORT,
      path: `/comprovante/${senhaId}`,
      method: 'GET',
      headers: { Cookie: sec.cookie },
    });
    assert(paginaComprovante.status === 200, `Página de comprovante térmico acessível (200 OK)`);
  }

  // 6. Auditoria de Exportações Registrada no Banco
  console.log(`\n--- 6. Verificação de Auditoria de Todas as Exportações ---`);
  const auditRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/auditoria?limite=20',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });

  const temAuditBateria = auditRes.data?.some((a) => a.acao === 'EXPORTAR_RELATORIO_BATERIA');
  const temAuditResultados = auditRes.data?.some((a) => a.acao === 'EXPORTAR_RELATORIO_RESULTADOS');
  const temAuditCaixa = auditRes.data?.some((a) => a.acao === 'EXPORTAR_FECHAMENTO_CAIXA');

  assert(temAuditBateria, `Auditoria registrou EXPORTAR_RELATORIO_BATERIA`);
  assert(temAuditResultados, `Auditoria registrou EXPORTAR_RELATORIO_RESULTADOS`);
  assert(temAuditCaixa, `Auditoria registrou EXPORTAR_FECHAMENTO_CAIXA`);

  console.log(`\n=============================================================`);
  console.log(`📊 RESULTADO FINAL PARTE 2: ${passed} PASSOU, ${failed} FALHOU`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal ao rodar testes da Parte 2:', err);
  process.exit(1);
});

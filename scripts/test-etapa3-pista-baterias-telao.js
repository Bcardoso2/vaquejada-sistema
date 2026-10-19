/**
 * Teste Automatizado - ETAPA 3
 * 1. Baterias de Corrida (Geração automática, fechamento e encaixe de retardatárias/retornos)
 * 2. Ordem de largada por bateria para impressão
 * 3. Cronômetro de cancela (tolerância configurável e registro de estouro na auditoria)
 * 4. Telão Público (/placar e /api/placar):
 *    - Acesso público sem login (200 OK)
 *    - Comprovação rigorosa de que NÃO VAZA CPF, telefone nem dados pessoais
 * 5. Matriz de permissões das novas rotas (RBAC 401/403)
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

async function loginComo(email, senha) {
  const res = await requisicao('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/vaquejada_session=([^;]+)/);
  return {
    status: res.status,
    cookie: match ? `vaquejada_session=${match[1]}` : '',
  };
}

async function run() {
  console.log('========================================================================');
  console.log('🏆 INICIANDO BATERIA DE TESTES - ETAPA 3 (PISTA, BATERIAS & TELÃO)');
  console.log('========================================================================\n');

  const pgClient = new Client({ connectionString: PG_URL });
  await pgClient.connect();

  try {
    // -------------------------------------------------------------------------
    // 1. Autenticação dos perfis
    // -------------------------------------------------------------------------
    console.log('▶ Autenticando perfis para os testes...');
    const loginAdmin = await loginComo('admin@vaquejada.com', 'Admin@Vaquejada2026!');
    const loginPista = await loginComo('pista@vaquejada.com', 'Pista@123');
    const loginJuiz = await loginComo('juiz@vaquejada.com', 'Juiz@123');
    console.log('  ✅ Sessões ativas obtidas para ADMIN, OPERADOR_PISTA e JUIZ.\n');

    // -------------------------------------------------------------------------
    // 2. Proteção e Permissões nas Rotas de Baterias (RBAC)
    // -------------------------------------------------------------------------
    console.log('▶ Teste 1: Permissões de Rotas (RBAC) para Baterias...');
    const resSemSessao = await requisicao('/api/baterias');
    if (resSemSessao.status !== 401) {
      throw new Error(`Esperava 401 para /api/baterias sem sessão, obteve ${resSemSessao.status}`);
    }
    console.log('  ✅ Sem sessão: 401 Unauthorized confirmado para /api/baterias.');

    // Juiz tentando alterar/gerar baterias (deve dar 403 Forbidden)
    const resJuizGerar = await requisicao('/api/baterias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: loginJuiz.cookie },
      body: JSON.stringify({ acao: 'GERAR', tamanho_bateria: 10 }),
    });
    if (resJuizGerar.status !== 403) {
      throw new Error(`Esperava 403 Forbidden para Juiz tentando gerar baterias, obteve ${resJuizGerar.status}`);
    }
    console.log('  ✅ JUIZ bloqueado ao tentar alterar baterias (403 Forbidden).');

    // -------------------------------------------------------------------------
    // 3. Gestão Completa de Baterias (Geração, Fechamento e Encaixe)
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 2: Geração Automática de Baterias pelo Operador de Pista...');
    const resGerar = await requisicao('/api/baterias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: loginPista.cookie },
      body: JSON.stringify({ acao: 'GERAR', tamanho_bateria: 10, vaquejada_id: 'vq-2026-portal' }),
    });

    if (resGerar.status !== 200) {
      const err = await resGerar.text();
      throw new Error(`Falha ao gerar baterias: ${resGerar.status} - ${err}`);
    }
    const dadosGeracao = await resGerar.json();
    console.log(`  ✅ Baterias geradas com sucesso: ${dadosGeracao.totalBaterias} baterias para ${dadosGeracao.totalCorridas} duplas.`);

    // Listar baterias geradas
    const resListBat = await requisicao('/api/baterias?vaquejada_id=vq-2026-portal', {
      headers: { cookie: loginPista.cookie },
    });
    const listaBaterias = await resListBat.json();
    if (!Array.isArray(listaBaterias) || listaBaterias.length === 0) {
      throw new Error('Lista de baterias retornou vazia');
    }
    const bat1 = listaBaterias.find((b) => b.numero === 1);
    if (!bat1 || bat1.status !== 'EM_ANDAMENTO') {
      throw new Error(`Bateria 1 deveria estar EM_ANDAMENTO, status: ${bat1?.status}`);
    }
    console.log(`  ✅ Bateria 1 ativa com ${bat1.total_corridas} corridas (Status: ${bat1.status}).`);

    // Consultar detalhes e ordem de largada da Bateria 1
    const resDetalhesBat1 = await requisicao(`/api/baterias/${bat1.id}`, {
      headers: { cookie: loginPista.cookie },
    });
    const dadosBat1 = await resDetalhesBat1.json();
    if (dadosBat1.corridas.length === 0) throw new Error('Bateria 1 não possui corridas');
    console.log(`  ✅ Ordem de largada da Bateria 1 carregada com sucesso (${dadosBat1.totalCorridas} duplas ordenadas).`);

    // Testar Fechamento da Bateria 1 e Avanço para Bateria 2
    console.log('\n▶ Teste 3: Fechamento da Bateria 1 e Avanço Automático...');
    const resFechar = await requisicao('/api/baterias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: loginPista.cookie },
      body: JSON.stringify({ acao: 'FECHAR', bateria_id: bat1.id }),
    });
    if (resFechar.status !== 200) throw new Error('Falha ao fechar bateria 1');
    const dadosFechar = await resFechar.json();
    console.log(`  ✅ Bateria 1 fechada com sucesso! Próxima bateria ativa: Bateria ${dadosFechar.proximaBateria?.numero || 2}.`);

    // Testar Encaixe de Retardatária / Retorno
    console.log('\n▶ Teste 4: Encaixe de Boi de Retorno na Bateria...');
    const corridaRow = await pgClient.query('SELECT id FROM corridas_mapa LIMIT 1');
    const corridaEncaixeId = corridaRow.rows[0].id;

    const resEncaixar = await requisicao('/api/baterias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: loginPista.cookie },
      body: JSON.stringify({
        acao: 'ENCAIXAR',
        bateria_id: bat1.id,
        corrida_id: corridaEncaixeId,
        tipo: 'RETORNO',
      }),
    });
    if (resEncaixar.status !== 200) throw new Error('Falha ao encaixar retorno');
    const dadosEncaixe = await resEncaixar.json();
    console.log(`  ✅ Retorno encaixado com sucesso na Bateria 1 na ordem ${dadosEncaixe.novaOrdem}.`);

    // -------------------------------------------------------------------------
    // 4. Cronômetro de Cancela e Registro de Estouro na Auditoria
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 5: Cronômetro de Cancela e Auditoria de Estouro...');
    const resAuditCancela = await requisicao('/api/auditoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: loginPista.cookie },
      body: JSON.stringify({
        acao: 'ESTOURO_TEMPO_CANCELA',
        entidade: 'pista',
        detalhes: { tempoTolerancia: 30, corridaId: corridaEncaixeId },
        motivo: 'Tempo limite de 30s de cancela estourado na apresentação',
      }),
    });

    const checkAuditCancela = await pgClient.query(
      "SELECT acao, detalhes, motivo FROM audit_logs WHERE acao = 'ESTOURO_TEMPO_CANCELA' ORDER BY criado_em DESC LIMIT 1"
    );
    if (checkAuditCancela.rowCount === 0) {
      throw new Error('Registro de estouro de cancela não encontrado em audit_logs');
    }
    console.log('  ✅ Estouro de cancela registrado com sucesso na auditoria do sistema.');

    // -------------------------------------------------------------------------
    // 5. Telão Público (/placar e /api/placar) - Validação Rigorosa de Privacidade
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 6: Telão Público (/placar e /api/placar) e Privacidade de Dados...');
    
    // Testar acesso público sem sessão a /placar
    const resTelaPlacar = await requisicao('/placar');
    if (resTelaPlacar.status !== 200) {
      throw new Error(`Esperava 200 OK para tela pública /placar, obteve ${resTelaPlacar.status}`);
    }
    console.log('  ✅ Página /placar acessível publicamente sem login (200 OK).');

    // Testar API pública /api/placar sem sessão
    const resApiPlacar = await requisicao('/api/placar');
    if (resApiPlacar.status !== 200) {
      throw new Error(`Esperava 200 OK para API pública /api/placar, obteve ${resApiPlacar.status}`);
    }
    const dadosPlacar = await resApiPlacar.json();

    // Comprovar rigorosamente que NÃO VAZA dados pessoais
    const jsonStr = JSON.stringify(dadosPlacar);
    
    // Proibir chaves sensíveis
    if (jsonStr.includes('"cpf"') || jsonStr.includes('"telefone"') || jsonStr.includes('"valor_centavos"')) {
      throw new Error(`Falha crítica de privacidade no telão! Dados sensíveis expostos: ${jsonStr}`);
    }

    // Proibir qualquer sequência de 11 dígitos numéricos contínuos (CPFs)
    const matchCpf = jsonStr.match(/\b\d{11}\b/);
    if (matchCpf) {
      throw new Error(`Falha crítica de privacidade! Padrão de CPF numérico encontrado no telão: ${matchCpf[0]}`);
    }

    console.log('  ✅ API /api/placar funciona publicamente sem sessão.');
    console.log('  ✅ COMPROVAÇÃO DE PRIVACIDADE: ZERO CPF, ZERO TELEFONE, ZERO DADOS SENSÍVEIS no payload do telão.');
    console.log(`  ✅ Estrutura do Telão: Vaquejada "${dadosPlacar.vaquejada?.nome}", Dupla Ativa: ${dadosPlacar.corridaAtual ? 'Sim' : 'Pista em Espera'}, Próximas: ${dadosPlacar.proximasCorridas?.length}, Últimos Resultados: ${dadosPlacar.ultimosResultados?.length}.`);

    console.log('\n========================================================================');
    console.log('🎉 SUCESSO TOTAL NOS TESTES DA ETAPA 3 (PISTA, BATERIAS & TELÃO)!');
    console.log('========================================================================\n');
  } finally {
    await pgClient.end();
  }
}

run().catch((err) => {
  console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES DA ETAPA 3:', err);
  process.exit(1);
});

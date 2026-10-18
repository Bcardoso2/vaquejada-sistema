/**
 * Teste Automatizado - ETAPA 2 (Cadastros Oficiais: Competidores e Cavalos)
 * 1. Validação de CPF estrita (rejeição de inválidos e duplicados, cálculo de dígitos)
 * 2. Mascaramento LGPD por perfil (visível para ADMIN/SECRETARIA, mascarado para OPERADOR_PISTA e JUIZ)
 * 3. Histórico do Competidor (senhas, corridas e aproveitamento) e do Cavalo
 * 4. Venda integrada com seleção oficial e vinculação de foreign keys
 * 5. Matriz de permissões RBAC nas novas rotas (401 sem login, 403 para operador/juiz criando cadastros)
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
  if (res.status !== 200) {
    throw new Error(`Falha no login de ${email}: ${res.status}`);
  }
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/vaquejada_session=([^;]+)/);
  return match ? `vaquejada_session=${match[1]}` : '';
}

async function run() {
  console.log('========================================================================');
  console.log('🐎 INICIANDO BATERIA DE TESTES - ETAPA 2 (CADASTROS OFICIAIS)');
  console.log('========================================================================\n');

  const pgClient = new Client({ connectionString: PG_URL });
  await pgClient.connect();

  try {
    // -------------------------------------------------------------------------
    // 1. Obter sessões dos diferentes perfis
    // -------------------------------------------------------------------------
    console.log('▶ Autenticando perfis para os testes...');
    const cookieAdmin = await loginComo('admin@vaquejada.com', 'Admin@Vaquejada2026!');
    const cookieSecretaria = await loginComo('secretaria@vaquejada.com', 'Secretaria@123');
    const cookiePista = await loginComo('pista@vaquejada.com', 'Pista@123');
    const cookieJuiz = await loginComo('juiz@vaquejada.com', 'Juiz@123');
    console.log('  ✅ Sessões ativas obtidas para ADMIN, SECRETARIA, OPERADOR_PISTA e JUIZ.\n');

    // -------------------------------------------------------------------------
    // 2. Proteção e Permissões nas Novas Rotas (RBAC)
    // -------------------------------------------------------------------------
    console.log('▶ Teste 1: Permissões de Rotas (RBAC) para Competidores e Cavalos...');
    
    // Sem sessão = 401
    const resSemAuthComp = await requisicao('/api/competidores');
    if (resSemAuthComp.status !== 401) throw new Error('Esperava 401 sem auth em /api/competidores');
    const resSemAuthCav = await requisicao('/api/cavalos');
    if (resSemAuthCav.status !== 401) throw new Error('Esperava 401 sem auth em /api/cavalos');
    console.log('  ✅ Sem sessão: 401 Unauthorized confirmado para /api/competidores e /api/cavalos.');

    // OPERADOR_PISTA tentando criar competidor = 403
    const resPistaCriandoComp = await requisicao('/api/competidores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookiePista },
      body: JSON.stringify({ nome: 'Teste Pista', cpf: '05477818400' }),
    });
    if (resPistaCriandoComp.status !== 403) throw new Error('Esperava 403 para OPERADOR_PISTA criando competidor');
    console.log('  ✅ OPERADOR_PISTA bloqueado ao tentar cadastrar competidor (403 Forbidden).');

    // JUIZ tentando criar cavalo = 403
    const resJuizCriandoCav = await requisicao('/api/cavalos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieJuiz },
      body: JSON.stringify({ nome: 'Cavalo Juiz' }),
    });
    if (resJuizCriandoCav.status !== 403) throw new Error('Esperava 403 para JUIZ criando cavalo');
    console.log('  ✅ JUIZ bloqueado ao tentar cadastrar cavalo (403 Forbidden).');

    // -------------------------------------------------------------------------
    // 3. Validação Estrita de CPF (Inválido, Duplicado, Válido)
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 2: Validação Estrita de CPF (Formato, Dígitos e Unicidade)...');

    // CPF com tamanho ou dígitos matemáticos incorretos
    const resCpfInvalido = await requisicao('/api/competidores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieSecretaria },
      body: JSON.stringify({ nome: 'Vaqueiro Teste Invalido', cpf: '123.456.789-00' }),
    });
    if (resCpfInvalido.status !== 400) throw new Error(`Esperava 400 para CPF inválido, obteve ${resCpfInvalido.status}`);
    console.log('  ✅ Rejeitou CPF matematicamente inválido com 400 Bad Request.');

    // CPF repetido (ex: 111.111.111-11)
    const resCpfRepetido = await requisicao('/api/competidores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieSecretaria },
      body: JSON.stringify({ nome: 'Vaqueiro Sequencial', cpf: '111.111.111-11' }),
    });
    if (resCpfRepetido.status !== 400) throw new Error(`Esperava 400 para CPF de dígitos repetidos, obteve ${resCpfRepetido.status}`);
    console.log('  ✅ Rejeitou CPF com dígitos idênticos sequenciais (111.111.111-11) com 400 Bad Request.');

    // Função auxiliar para gerar CPF matematicamente válido
    function gerarCpfValido() {
      const d = [];
      for (let i = 0; i < 9; i++) {
        d.push(Math.floor(Math.random() * 9));
      }
      let soma = 0;
      for (let i = 0; i < 9; i++) soma += d[i] * (10 - i);
      let resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      d.push(resto);

      soma = 0;
      for (let i = 0; i < 10; i++) soma += d[i] * (11 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      d.push(resto);

      return d.join('');
    }

    const cpfValido1 = gerarCpfValido();
    const resCadValido = await requisicao('/api/competidores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieSecretaria },
      body: JSON.stringify({
        nome: 'Afrísio Vaqueiro Campeão',
        apelido_pista: 'Afrísio do Sertão',
        cpf: cpfValido1,
        cidade: 'Bezerros',
        uf: 'PE',
        telefone: '81999887766',
        categoria: 'PROFISSIONAL',
        carteira_federacao: 'ABVAQ-9988',
      }),
    });

    if (resCadValido.status !== 201) {
      const err = await resCadValido.text();
      throw new Error(`Falha ao cadastrar competidor com CPF válido: ${resCadValido.status} - ${err}`);
    }
    const dataComp1 = await resCadValido.json();
    const idComp1 = dataComp1.competidor.id;
    console.log(`  ✅ Competidor cadastrado com sucesso! ID: ${idComp1}, Nome: "${dataComp1.competidor.nome}".`);

    // Tentar cadastrar outro competidor com o MESMO CPF (deve dar 409 Conflict)
    const resDuplicado = await requisicao('/api/competidores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieSecretaria },
      body: JSON.stringify({
        nome: 'Outro Vaqueiro com Mesmo CPF',
        cpf: cpfValido1,
      }),
    });
    if (resDuplicado.status !== 409) throw new Error(`Esperava 409 Conflict para CPF duplicado, obteve ${resDuplicado.status}`);
    console.log('  ✅ Rejeitou CPF duplicado com 409 Conflict.');

    // -------------------------------------------------------------------------
    // 4. Mascaramento de Dados Pessoais (LGPD) por Perfil
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 3: Privacidade e Mascaramento de CPF / Telefone...');

    // Consulta por ADMIN / SECRETARIA (visível completo)
    const resSecVisivel = await requisicao(`/api/competidores?q=Afrísio`, {
      headers: { cookie: cookieSecretaria },
    });
    const listaSec = await resSecVisivel.json();
    const compVisivel = listaSec.find(c => c.id === idComp1);
    if (!compVisivel || compVisivel.cpf.includes('*')) {
      throw new Error(`CPF não deveria estar mascarado para SECRETARIA: ${compVisivel?.cpf}`);
    }
    console.log(`  ✅ SECRETARIA visualiza CPF completo formatado: ${compVisivel.cpf} (Telefone: ${compVisivel.telefone}).`);

    // Consulta por OPERADOR_PISTA ou JUIZ (deve vir mascarado)
    const resPistaMascarado = await requisicao(`/api/competidores?q=Afrísio`, {
      headers: { cookie: cookiePista },
    });
    const listaPista = await resPistaMascarado.json();
    const compMascarado = listaPista.find(c => c.id === idComp1);
    if (!compMascarado || !compMascarado.cpf.includes('***')) {
      throw new Error(`CPF DEVERIA estar mascarado para OPERADOR_PISTA: ${compMascarado?.cpf}`);
    }
    console.log(`  ✅ OPERADOR_PISTA recebe CPF mascarado: ${compMascarado.cpf} (Telefone: ${compMascarado.telefone}).`);

    const resJuizMascarado = await requisicao(`/api/competidores?q=Afrísio`, {
      headers: { cookie: cookieJuiz },
    });
    const listaJuiz = await resJuizMascarado.json();
    const compJuiz = listaJuiz.find(c => c.id === idComp1);
    if (!compJuiz || !compJuiz.cpf.includes('***')) {
      throw new Error(`CPF DEVERIA estar mascarado para JUIZ: ${compJuiz?.cpf}`);
    }
    console.log(`  ✅ JUIZ recebe CPF mascarado: ${compJuiz.cpf}.`);

    // -------------------------------------------------------------------------
    // 5. Cadastro Oficial de Cavalo
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 4: Cadastro Oficial de Animais (Cavalos de Puxa e Esteira)...');
    const resNovoCavalo = await requisicao('/api/cavalos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieSecretaria },
      body: JSON.stringify({
        nome: 'Apolo Roxa Tornado',
        tipo: 'PUXA',
        proprietario: 'Haras Imperial',
        registro: 'ABQM-776655',
        chip: '982000998877',
      }),
    });

    if (resNovoCavalo.status !== 201) throw new Error('Falha ao cadastrar cavalo oficial');
    const dataCav = await resNovoCavalo.json();
    const idCav1 = dataCav.cavalo.id;
    console.log(`  ✅ Cavalo oficial cadastrado com sucesso! ID: ${idCav1}, Nome: "${dataCav.cavalo.nome}".`);

    // -------------------------------------------------------------------------
    // 6. Fluxo de Venda Integrado com Seleção de Competidor e Cavalo
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 5: Fluxo Integrado: Venda de Senha com Puxador e Cavalo Oficiais...');

    // Cadastrar também um segundo competidor válido para Esteireiro
    const cpfValido2 = gerarCpfValido();
    const resCadEsteira = await requisicao('/api/competidores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieSecretaria },
      body: JSON.stringify({
        nome: 'Deda Esteireiro Raça',
        cpf: cpfValido2,
        categoria: 'PROFISSIONAL',
      }),
    });
    if (resCadEsteira.status !== 201) {
      const err = await resCadEsteira.text();
      throw new Error(`Falha ao cadastrar competidor esteira: ${resCadEsteira.status} - ${err}`);
    }
    const idEsteira1 = (await resCadEsteira.json()).competidor.id;

    // Criar um kit disponível para a venda
    const kitTeste = `KT-ET2-${Date.now().toString().slice(-4)}`;
    await pgClient.query(`INSERT INTO kits (id, codigo, vaquejada_id) VALUES ($1, $1, 'vq-2026-portal')`, [kitTeste]);
    const senhaTesteCodigo = `SF2-${Math.floor(1000 + Math.random() * 9000)}`;
    await pgClient.query(
      `INSERT INTO senhas (id, kit_id, codigo, status, estado_comercial, vaquejada_id, valor_centavos, categoria)
       VALUES ($1, $2, $1, 'ATIVA', 'DISPONIVEL', 'vq-2026-portal', 60000, 'PROFISSIONAL')`,
      [senhaTesteCodigo, kitTeste]
    );

    // SECRETARIA vende a senha enviando os IDs oficiais de Competidor e Cavalo
    const resVendaOficial = await requisicao('/api/secretaria/vendas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieSecretaria },
      body: JSON.stringify({
        senhaCodigo: senhaTesteCodigo,
        puxadorId: idComp1,
        esteiraId: idEsteira1,
        cavaloPuxaId: idCav1,
        categoria: 'PROFISSIONAL',
        formaPagamento: 'PIX',
        valorCentavos: 60000,
      }),
    });

    if (resVendaOficial.status !== 200) {
      const err = await resVendaOficial.text();
      throw new Error(`Falha na venda de senha com cadastros oficiais: ${err}`);
    }
    console.log(`  ✅ Venda da senha ${senhaTesteCodigo} realizada com sucesso vinculando competidores e cavalo.`);

    // Validar no banco se puxador_id, esteira_id e cavalo_puxa_id foram gravados
    const checkDb = await pgClient.query(
      `SELECT puxador_id, esteira_id, cavalo_puxa_id, puxador_nome, esteira_nome, cavalo_nome 
       FROM senhas WHERE codigo = $1`,
      [senhaTesteCodigo]
    );
    const senhaSalva = checkDb.rows[0];
    if (senhaSalva.puxador_id !== idComp1 || senhaSalva.esteira_id !== idEsteira1 || senhaSalva.cavalo_puxa_id !== idCav1) {
      throw new Error(`IDs oficiais não foram gravados corretamente na senha: ${JSON.stringify(senhaSalva)}`);
    }
    console.log(`  ✅ IDs gravados no banco: Puxador ID=${senhaSalva.puxador_id}, Esteira ID=${senhaSalva.esteira_id}, Cavalo ID=${senhaSalva.cavalo_puxa_id}.`);

    // -------------------------------------------------------------------------
    // 7. Simular Corrida na Pista e Verificar Histórico Completo do Competidor
    // -------------------------------------------------------------------------
    console.log('\n▶ Teste 6: Histórico Completo do Competidor (Senhas, Corridas e Aproveitamento)...');

    // Buscar corrida gerada para esta senha e simular apontamento de pista "VALEU"
    const corridaRow = await pgClient.query('SELECT id FROM corridas_mapa WHERE senha_id = $1 LIMIT 1', [senhaTesteCodigo]);
    const corridaId = corridaRow.rows[0].id;

    // Atualizar corrida para CONCLUIDA com VALEU
    await pgClient.query("UPDATE corridas_mapa SET estado = 'CONCLUIDA', resultado_final = 'VALEU' WHERE id = $1", [corridaId]);

    // Consultar histórico completo do competidor Afrísio via API
    const resHist = await requisicao(`/api/competidores/${idComp1}`, {
      headers: { cookie: cookieSecretaria },
    });
    if (resHist.status !== 200) {
      const err = await resHist.text();
      throw new Error(`Falha ao consultar histórico do competidor: ${resHist.status} - ${err}`);
    }
    const dadosHistorico = await resHist.json();

    if (dadosHistorico.estatisticas.totalSenhas < 1) {
      throw new Error('Histórico não contabilizou a senha inscrita');
    }
    if (dadosHistorico.estatisticas.totalBoisValidos < 1) {
      throw new Error('Histórico não contabilizou o boi valeu');
    }
    console.log(`  ✅ Estatísticas do Competidor: ${dadosHistorico.estatisticas.totalSenhas} Senhas, ${dadosHistorico.estatisticas.totalBoisValidos} Bois Valeu, Aproveitamento: ${dadosHistorico.estatisticas.aproveitamentoPercentual}%.`);
    console.log(`  ✅ Histórico de corridas e inscrições retornado com sucesso.`);

    // Consultar histórico do Cavalo
    const resHistCav = await requisicao(`/api/cavalos/${idCav1}`, {
      headers: { cookie: cookieSecretaria },
    });
    const dadosCavalo = await resHistCav.json();
    if (dadosCavalo.totalSenhas < 1) {
      throw new Error('Histórico do cavalo não contabilizou a senha');
    }
    console.log(`  ✅ Histórico do Cavalo: ${dadosCavalo.totalSenhas} senha(s) associada(s) confirmada(s).`);

    console.log('\n========================================================================');
    console.log('🎉 SUCESSO TOTAL NOS TESTES DA ETAPA 2 (CADASTROS OFICIAIS)!');
    console.log('========================================================================');
  } finally {
    await pgClient.end();
  }
}

run().catch((err) => {
  console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES DA ETAPA 2:', err);
  process.exit(1);
});

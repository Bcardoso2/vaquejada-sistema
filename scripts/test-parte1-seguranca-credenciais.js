const { criarUsuarioTeste, loginUsuarioHttp, requestHttp, pool } = require('./utils/test-user-helper');

const HOST = '127.0.0.1';
const PORT = 3099;

async function runTests() {
  console.log(`\n=============================================================`);
  console.log(`🔐 TESTE PARTE 1 - SEGURANÇA DE CREDENCIAIS & TROCA OBRIGATÓRIA`);
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

  // Lista de usuários temporários para limpeza garantida no finally
  const usuariosParaLimpar = [];

  try {
    // 1. CRIAR USUÁRIOS TEMPORÁRIOS COM SENHAS ALEATÓRIAS DINÂMICAS (ZERO CREDENCIAIS FIXAS)
    console.log(`--- 1. Criação Dinâmica de Usuários Temporários (Senhas Fortes Aleatórias) ---`);
    const adminTemp = await criarUsuarioTeste({ papel: 'ADMIN', deveTrocarSenha: false });
    usuariosParaLimpar.push(adminTemp);

    const secTemp = await criarUsuarioTeste({ papel: 'SECRETARIA', deveTrocarSenha: false });
    usuariosParaLimpar.push(secTemp);

    const pistaTemp = await criarUsuarioTeste({ papel: 'OPERADOR_PISTA', deveTrocarSenha: false });
    usuariosParaLimpar.push(pistaTemp);

    const juizTemp = await criarUsuarioTeste({ papel: 'JUIZ', deveTrocarSenha: false });
    usuariosParaLimpar.push(juizTemp);

    const primeiroAcessoUser = await criarUsuarioTeste({ papel: 'SECRETARIA', deveTrocarSenha: true });
    usuariosParaLimpar.push(primeiroAcessoUser);

    console.log(`  > Usuário Admin criado dinamicamente: ${adminTemp.email}`);
    console.log(`  > Usuário Secretaria criado dinamicamente: ${secTemp.email}`);
    console.log(`  > Usuário Pista criado dinamicamente: ${pistaTemp.email}`);
    console.log(`  > Usuário Juiz criado dinamicamente: ${juizTemp.email}`);
    console.log(`  > Usuário Primeiro Acesso criado: ${primeiroAcessoUser.email}`);
    assert(adminTemp.senha.length >= 16, `Senha aleatória gerada com comprimento seguro (${adminTemp.senha.length} chars)`);

    // 2. TESTE DE LOGIN DOS USUÁRIOS DINÂMICOS
    console.log(`\n--- 2. Autenticação dos Usuários Dinâmicos ---`);
    const loginAdmin = await loginUsuarioHttp(HOST, PORT, adminTemp.email, adminTemp.senha);
    assert(loginAdmin.status === 200, `Admin temporário autenticado com sucesso (status 200)`);
    assert(loginAdmin.data.usuario?.papel === 'ADMIN', `Papel validado no servidor: ADMIN`);

    const loginSec = await loginUsuarioHttp(HOST, PORT, secTemp.email, secTemp.senha);
    assert(loginSec.status === 200, `Secretaria temporária autenticada com sucesso (status 200)`);

    const loginPista = await loginUsuarioHttp(HOST, PORT, pistaTemp.email, pistaTemp.senha);
    assert(loginPista.status === 200, `Operador de Pista autenticado com sucesso (status 200)`);

    const loginJuiz = await loginUsuarioHttp(HOST, PORT, juizTemp.email, juizTemp.senha);
    assert(loginJuiz.status === 200, `Juiz autenticado com sucesso (status 200)`);

    // 3. TESTE DE TROCA OBRIGATÓRIA DE SENHA NO PRIMEIRO LOGIN
    console.log(`\n--- 3. Troca Obrigatória de Senha (Flag deve_trocar_senha) ---`);
    const loginPrimeiroAcesso = await loginUsuarioHttp(HOST, PORT, primeiroAcessoUser.email, primeiroAcessoUser.senha);
    assert(loginPrimeiroAcesso.status === 200, `Login do usuário em primeiro acesso bem-sucedido`);
    assert(loginPrimeiroAcesso.data.deveTrocarSenha === true, `Servidor sinalizou deveTrocarSenha: true na resposta`);

    // A) Tentativa de troca com senha curta (< 10 caracteres)
    const trocaCurta = await requestHttp(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/auth/trocar-senha',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: loginPrimeiroAcesso.cookie,
        },
      },
      {
        senhaAtual: primeiroAcessoUser.senha,
        novaSenha: 'Curta1!',
        confirmacaoNovaSenha: 'Curta1!',
      }
    );
    assert(trocaCurta.status === 400, `Rejeitou senha com menos de 10 caracteres (status = 400)`);
    assert(trocaCurta.data.error.includes('10 caracteres'), `Mensagem clara exigindo mínimo 10 caracteres`);

    // B) Tentativa com senhas divergentes
    const trocaDivergente = await requestHttp(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/auth/trocar-senha',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: loginPrimeiroAcesso.cookie,
        },
      },
      {
        senhaAtual: primeiroAcessoUser.senha,
        novaSenha: 'NovaSenhaSegura2026A!',
        confirmacaoNovaSenha: 'OutraSenhaDiferente99!',
      }
    );
    assert(trocaDivergente.status === 400, `Rejeitou confirmação de senha divergente (status = 400)`);

    // C) Troca bem-sucedida com senha forte (>= 10 caracteres com letras e números)
    const novaSenhaValida = 'MinhaNovaSenhaDefinitiva2026!';
    const trocaValida = await requestHttp(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/auth/trocar-senha',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: loginPrimeiroAcesso.cookie,
        },
      },
      {
        senhaAtual: primeiroAcessoUser.senha,
        novaSenha: novaSenhaValida,
        confirmacaoNovaSenha: novaSenhaValida,
      }
    );
    assert(trocaValida.status === 200, `Troca de senha realizada com sucesso (status 200)`);

    // D) Verificar no banco se a flag deve_trocar_senha virou FALSE
    const checkDb = await pool.query('SELECT deve_trocar_senha FROM usuarios WHERE id = $1', [primeiroAcessoUser.id]);
    assert(checkDb.rows[0].deve_trocar_senha === false, `Flag deve_trocar_senha atualizada para FALSE no PostgreSQL`);

    // E) Testar login com a nova senha redefinida
    const loginNovaSenha = await loginUsuarioHttp(HOST, PORT, primeiroAcessoUser.email, novaSenhaValida);
    assert(loginNovaSenha.status === 200, `Login com a nova senha funcionou perfeitamente`);
    assert(loginNovaSenha.data.deveTrocarSenha === false, `Flag deveTrocarSenha agora é false no login`);

    // 4. TESTE DE PERMISSÕES DA ROTA /comprovante/[id] E /api/senhas/[id]
    console.log(`\n--- 4. Proteção da Rota de Comprovante Térmico (Exclusivo ADMIN e SECRETARIA) ---`);
    // Buscar uma senha válida existente no banco
    const resSenhas = await pool.query('SELECT id, codigo FROM senhas LIMIT 1');
    const senhaTeste = resSenhas.rows[0] || { id: 'snh-teste', codigo: '999' };

    // A) ADMIN acessa rota de dados da senha (200)
    const getSenhaAdmin = await requestHttp({
      hostname: HOST,
      port: PORT,
      path: `/api/senhas/${senhaTeste.id}`,
      method: 'GET',
      headers: { Cookie: loginAdmin.cookie },
    });
    assert(getSenhaAdmin.status === 200, `ADMIN tem permissão para consultar comprovante da senha (status 200)`);

    // B) SECRETARIA acessa rota de dados da senha (200)
    const getSenhaSec = await requestHttp({
      hostname: HOST,
      port: PORT,
      path: `/api/senhas/${senhaTeste.id}`,
      method: 'GET',
      headers: { Cookie: loginSec.cookie },
    });
    assert(getSenhaSec.status === 200, `SECRETARIA tem permissão para consultar comprovante da senha (status 200)`);

    // C) JUIZ tenta consultar dados da senha -> RECEBE 403 FORBIDDEN
    const getSenhaJuiz = await requestHttp({
      hostname: HOST,
      port: PORT,
      path: `/api/senhas/${senhaTeste.id}`,
      method: 'GET',
      headers: { Cookie: loginJuiz.cookie },
    });
    assert(getSenhaJuiz.status === 403, `JUIZ recebe 403 FORBIDDEN ao tentar acessar dados da senha (status = ${getSenhaJuiz.status})`);

    // D) OPERADOR_PISTA tenta consultar dados de venda de senhas -> RECEBE 403 FORBIDDEN
    const getSenhaPista = await requestHttp({
      hostname: HOST,
      port: PORT,
      path: `/api/senhas/${senhaTeste.id}`,
      method: 'GET',
      headers: { Cookie: loginPista.cookie },
    });
    assert(getSenhaPista.status === 403, `OPERADOR_PISTA recebe 403 FORBIDDEN ao acessar comprovante/senha (status = ${getSenhaPista.status})`);

    // E) Acesso anônimo sem cookie -> RECEBE 401 UNAUTHORIZED
    const getSenhaAnon = await requestHttp({
      hostname: HOST,
      port: PORT,
      path: `/api/senhas/${senhaTeste.id}`,
      method: 'GET',
    });
    assert(getSenhaAnon.status === 401, `Acesso anônimo ao comprovante rejeitado com 401 UNAUTHORIZED`);

    // 5. VERIFICAÇÃO DE AUDITORIA DA TROCA DE SENHA
    console.log(`\n--- 5. Auditoria de Segurança da Troca de Senha ---`);
    const auditRes = await pool.query(
      "SELECT acao, detalhes, motivo FROM audit_logs WHERE acao = 'TROCA_SENHA_USUARIO' AND usuario_id = $1",
      [primeiroAcessoUser.id]
    );
    assert(auditRes.rowCount > 0, `Evento TROCA_SENHA_USUARIO registrado na auditoria oficial`);

  } finally {
    // 6. LIMPEZA TOTAL DOS USUÁRIOS TEMPORÁRIOS
    console.log(`\n--- 6. Limpeza Segura dos Usuários de Teste ---`);
    for (const u of usuariosParaLimpar) {
      await u.limpar();
    }
    console.log(`  🧹 Todos os ${usuariosParaLimpar.length} usuários temporários foram removidos do banco.`);
  }

  console.log(`\n=============================================================`);
  console.log(`📊 RESULTADO FINAL PARTE 1: ${passed} PASSOU, ${failed} FALHOU`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal ao rodar testes da Parte 1:', err);
  process.exit(1);
});

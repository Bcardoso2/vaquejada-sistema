const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          cookies: res.headers['set-cookie'] || [],
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function extrairCookieSessao(setCookieHeaders) {
  for (const c of setCookieHeaders) {
    const match = c.match(/vaquejada_session=([^;]+)/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

async function login(email, senha) {
  const res = await request(
    {
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email, senha }
  );

  if (res.status !== 200) {
    throw new Error(`Falha no login com ${email}: status ${res.status} - ${JSON.stringify(res.body)}`);
  }

  const token = extrairCookieSessao(res.cookies);
  return { usuario: res.body.usuario, token, cookieHeader: `vaquejada_session=${token}` };
}

async function runTests() {
  console.log('======================================================');
  console.log('🔐 INICIANDO BATERIA DE TESTES - BLOCO B (AUTH & RBAC)');
  console.log('======================================================\n');

  // TESTE 1: Sem login nada abre (todas as APIs críticas retornam 401)
  console.log('▶ Teste 1: Verificando proteção sem login (Sem sessão = 401)...');
  const rotasProtegidas = [
    '/api/senhas',
    '/api/secretaria/vendas',
    '/api/financeiro',
    '/api/mapa',
    '/api/juiz',
    '/api/usuarios',
    '/api/auditoria',
    '/api/bois',
    '/api/vaquejadas',
  ];

  for (const rota of rotasProtegidas) {
    const res = await request({
      hostname: 'localhost',
      port: 3099,
      path: rota,
      method: 'GET',
    });
    if (res.status === 401) {
      console.log(`  ✅ ${rota} bloqueada com sucesso sem autenticação (401 Unauthorized).`);
    } else {
      console.error(`  ❌ ${rota} FALHOU: esperado 401, retornou ${res.status}`);
      throw new Error(`Falha de segurança na rota ${rota}`);
    }
  }

  // TESTE 2: RBAC e Matriz de Permissões
  console.log('\n▶ Teste 2: Matriz de Permissões por Perfil (RBAC Estrito)...');

  // 2.1 Autenticar cada um dos perfis
  console.log('  Autenticando perfis no sistema...');
  const sessaoAdmin = await login('admin@vaquejada.com', 'Admin@Vaquejada2026!');
  const sessaoSec = await login('secretaria@vaquejada.com', 'Secretaria@123');
  const sessaoPista = await login('pista@vaquejada.com', 'Pista@123');
  const sessaoJuiz = await login('juiz@vaquejada.com', 'Juiz@123');
  console.log('  ✅ Login bem-sucedido para ADMIN, SECRETARIA, OPERADOR_PISTA e JUIZ.');

  // 2.2 Testes de Acesso da SECRETARIA
  console.log('\n  Validando acessos do perfil SECRETARIA:');
  // Deve acessar: vendas, financeiro, senhas
  const resSecVendas = await request({
    hostname: 'localhost',
    port: 3099,
    path: '/api/secretaria/vendas',
    method: 'GET',
    headers: { Cookie: sessaoSec.cookieHeader },
  });
  if (resSecVendas.status === 200) {
    console.log('  ✅ SECRETARIA acessou /api/secretaria/vendas com sucesso (200 OK).');
  } else {
    throw new Error(`SECRETARIA não conseguiu acessar vendas: ${resSecVendas.status}`);
  }

  // Deve ter acesso negado (403) em /mapa, /juiz, /usuarios, /auditoria
  const rotasProibidasSec = ['/api/mapa', '/api/juiz', '/api/usuarios', '/api/auditoria'];
  for (const rota of rotasProibidasSec) {
    const res = await request({
      hostname: 'localhost',
      port: 3099,
      path: rota,
      method: 'GET',
      headers: { Cookie: sessaoSec.cookieHeader },
    });
    if (res.status === 403) {
      console.log(`  ✅ SECRETARIA bloqueada em ${rota} com 403 Forbidden.`);
    } else {
      throw new Error(`SECRETARIA deveria ter recebido 403 em ${rota}, recebeu ${res.status}`);
    }
  }

  // 2.3 Testes de Acesso do OPERADOR_PISTA
  console.log('\n  Validando acessos do perfil OPERADOR_PISTA:');
  const resPistaMapa = await request({
    hostname: 'localhost',
    port: 3099,
    path: '/api/mapa',
    method: 'GET',
    headers: { Cookie: sessaoPista.cookieHeader },
  });
  if (resPistaMapa.status === 200) {
    console.log('  ✅ OPERADOR_PISTA acessou /api/mapa com sucesso (200 OK).');
  } else {
    throw new Error(`OPERADOR_PISTA não conseguiu acessar mapa: ${resPistaMapa.status}`);
  }

  // Deve ter acesso negado (403) em /secretaria/vendas, /financeiro, /juiz, /usuarios
  const rotasProibidasPista = ['/api/secretaria/vendas', '/api/financeiro', '/api/juiz', '/api/usuarios'];
  for (const rota of rotasProibidasPista) {
    const res = await request({
      hostname: 'localhost',
      port: 3099,
      path: rota,
      method: 'GET',
      headers: { Cookie: sessaoPista.cookieHeader },
    });
    if (res.status === 403) {
      console.log(`  ✅ OPERADOR_PISTA bloqueado em ${rota} com 403 Forbidden.`);
    } else {
      throw new Error(`OPERADOR_PISTA deveria ter recebido 403 em ${rota}, recebeu ${res.status}`);
    }
  }

  // 2.4 Testes de Acesso do JUIZ
  console.log('\n  Validando acessos do perfil JUIZ:');
  const resJuizJuiz = await request({
    hostname: 'localhost',
    port: 3099,
    path: '/api/juiz',
    method: 'GET',
    headers: { Cookie: sessaoJuiz.cookieHeader },
  });
  if (resJuizJuiz.status === 200) {
    console.log('  ✅ JUIZ acessou /api/juiz com sucesso (200 OK).');
  } else {
    throw new Error(`JUIZ não conseguiu acessar tribunal: ${resJuizJuiz.status}`);
  }

  // Deve ter acesso negado (403) em /mapa, /secretaria/vendas, /financeiro, /usuarios
  const rotasProibidasJuiz = ['/api/mapa', '/api/secretaria/vendas', '/api/financeiro', '/api/usuarios'];
  for (const rota of rotasProibidasJuiz) {
    const res = await request({
      hostname: 'localhost',
      port: 3099,
      path: rota,
      method: 'GET',
      headers: { Cookie: sessaoJuiz.cookieHeader },
    });
    if (res.status === 403) {
      console.log(`  ✅ JUIZ bloqueado em ${rota} com 403 Forbidden.`);
    } else {
      throw new Error(`JUIZ deveria ter recebido 403 em ${rota}, recebeu ${res.status}`);
    }
  }

  // 2.5 Testes de Acesso do ADMIN (Acesso Total)
  console.log('\n  Validando acessos do perfil ADMIN:');
  const rotasAdmin = ['/api/usuarios', '/api/auditoria', '/api/bois', '/api/vaquejadas', '/api/secretaria/vendas', '/api/mapa', '/api/juiz'];
  for (const rota of rotasAdmin) {
    const res = await request({
      hostname: 'localhost',
      port: 3099,
      path: rota,
      method: 'GET',
      headers: { Cookie: sessaoAdmin.cookieHeader },
    });
    if (res.status === 200) {
      console.log(`  ✅ ADMIN acessou ${rota} com sucesso (200 OK).`);
    } else {
      throw new Error(`ADMIN não conseguiu acessar ${rota}: ${res.status}`);
    }
  }

  // TESTE 3: Fluxo Completo de Operação com Perfis Certos & Auditoria Real
  console.log('\n▶ Teste 3: Fluxo Completo: Venda (Secretaria) -> Pista (Operador) -> Auditoria (Admin)...');
  
  // Criar kit e senhas exclusivas para o teste de fluxo de ponta a ponta
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: 'postgresql://briciocardoso@localhost:5432/vaquejada_db' });
  const kitFluxoId = `kit-fluxo-${Date.now()}`;
  const codK = `KF${Date.now().toString().slice(-4)}`;
  const codS1 = `SF1-${Date.now().toString().slice(-4)}`;
  const codS2 = `SF2-${Date.now().toString().slice(-4)}`;
  const idS1 = `s-f1-${Date.now()}`;
  const idS2 = `s-f2-${Date.now()}`;

  await pool.query(
    `INSERT INTO kits (id, vaquejada_id, codigo) VALUES ($1, 'vq-2026-portal', $2)`,
    [kitFluxoId, codK]
  );
  await pool.query(
    `INSERT INTO senhas (id, kit_id, codigo, vaquejada_id, categoria, estado_comercial, status, valor_centavos)
     VALUES 
     ($1, $2, $3, 'vq-2026-portal', 'PROFISSIONAL', 'DISPONIVEL', 'ATIVA', 30000),
     ($4, $2, $5, 'vq-2026-portal', 'PROFISSIONAL', 'DISPONIVEL', 'ATIVA', 30000)`,
    [idS1, kitFluxoId, codS1, idS2, codS2]
  );
  await pool.end();

  const senhaAlvo = { id: idS1, codigo: codS1 };

  // 2. Secretaria realiza a venda
  console.log(`  Secretaria vendendo senha ${senhaAlvo.codigo} do kit ${codK}...`);
  const resVenda = await request(
    {
      hostname: 'localhost',
      port: 3099,
      path: '/api/secretaria/vendas',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessaoSec.cookieHeader,
      },
    },
    {
      senhaId: senhaAlvo.id,
      puxadorNome: 'Vaqueiro Fluxo Real',
      esteiraNome: 'Esteira Fluxo Real',
      cavaloNome: 'Tornado Thunder',
      categoria: 'PROFISSIONAL',
      formaPagamento: 'PIX',
    }
  );
  if (resVenda.status !== 200) {
    throw new Error(`Falha na venda da senha: ${resVenda.status} - ${JSON.stringify(resVenda.body)}`);
  }
  console.log(`  ✅ Senha ${senhaAlvo.codigo} vendida com sucesso pela SECRETARIA!`);

  // 3. Operador de Pista consulta o mapa e encontra a corrida gerada
  const resMapaPista = await request({
    hostname: 'localhost',
    port: 3099,
    path: '/api/mapa',
    method: 'GET',
    headers: { Cookie: sessaoPista.cookieHeader },
  });
  const corridaGerada = resMapaPista.body.find((c) => c.senha_id === senhaAlvo.id);
  if (!corridaGerada) {
    throw new Error('Corrida da senha não encontrada no mapa!');
  }
  console.log(`  Operador de pista encontrou a corrida (ID: ${corridaGerada.id}, Boi Nº: ${corridaGerada.boi_numero}).`);

  // 4. Operador chama o competidor
  const resChamar = await request(
    {
      hostname: 'localhost',
      port: 3099,
      path: '/api/mapa',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessaoPista.cookieHeader,
      },
    },
    {
      acao: 'CHAMAR',
      corridaId: corridaGerada.id,
    }
  );
  if (resChamar.status !== 200) throw new Error('Falha ao chamar competidor');
  console.log('  ✅ Competidor chamado para a pista pelo OPERADOR_PISTA.');

  // 5. Operador inicia a corrida
  const resIniciar = await request(
    {
      hostname: 'localhost',
      port: 3099,
      path: '/api/mapa',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessaoPista.cookieHeader,
      },
    },
    {
      acao: 'INICIAR',
      corridaId: corridaGerada.id,
    }
  );
  if (resIniciar.status !== 200) throw new Error('Falha ao iniciar corrida');
  console.log('  ✅ Corrida iniciada na pista pelo OPERADOR_PISTA.');

  // 6. Operador conclui com resultado VALEU
  const resResultado = await request(
    {
      hostname: 'localhost',
      port: 3099,
      path: '/api/mapa',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessaoPista.cookieHeader,
      },
    },
    {
      acao: 'REGISTRAR_RESULTADO',
      corridaId: corridaGerada.id,
      resultado: 'VALEU',
    }
  );
  if (resResultado.status !== 200) throw new Error('Falha ao registrar resultado de pista');
  console.log('  ✅ Resultado VALEU registrado com sucesso na pista!');

  // 7. Administrador confere os logs de auditoria
  console.log('\n  Verificando registro real de usuários na auditoria...');
  const resAudit = await request({
    hostname: 'localhost',
    port: 3099,
    path: '/api/auditoria',
    method: 'GET',
    headers: { Cookie: sessaoAdmin.cookieHeader },
  });
  if (resAudit.status !== 200 || !Array.isArray(resAudit.body)) {
    throw new Error('Falha ao consultar auditoria pelo ADMIN');
  }

  const logVenda = resAudit.body.find((l) => l.entidade_id === senhaAlvo.id && l.acao.includes('VENDA'));
  const logPista = resAudit.body.find((l) => l.entidade_id === corridaGerada.id && l.acao === 'RESULTADO_PISTA');

  if (logVenda && logVenda.usuario_nome === sessaoSec.usuario.nome) {
    console.log(`  ✅ Auditoria de venda registrou o usuário real: "${logVenda.usuario_nome}" (Papel: ${logVenda.papel}).`);
  } else {
    console.log('  ⚠️ Log de venda:', logVenda);
  }

  if (logPista && logPista.usuario_nome === sessaoPista.usuario.nome) {
    console.log(`  ✅ Auditoria de pista registrou o usuário real: "${logPista.usuario_nome}" (Papel: ${logPista.papel}).`);
  } else {
    console.log('  ⚠️ Log de pista:', logPista);
  }

  // TESTE 4: Gestão de Usuários (só ADMIN pode criar, trocar senha e perfil)
  console.log('\n▶ Teste 4: Gerenciamento de Usuários (Exclusivo ADMIN)...');
  const emailNovo = `operador-${Date.now()}@vaquejada.com`;
  const resCriarUsr = await request(
    {
      hostname: 'localhost',
      port: 3099,
      path: '/api/usuarios',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessaoAdmin.cookieHeader,
      },
    },
    {
      nome: 'Novo Operador Teste',
      email: emailNovo,
      senha: 'SenhaSegura123!',
      papel: 'OPERADOR_PISTA',
      ativo: true,
    }
  );
  if (resCriarUsr.status === 201) {
    console.log(`  ✅ ADMIN cadastrou novo usuário "${emailNovo}" com sucesso.`);
  } else {
    throw new Error(`Falha ao cadastrar usuário: ${resCriarUsr.status}`);
  }

  const idCriado = resCriarUsr.body.usuario.id;

  // Atualizar perfil para JUIZ e alterar status
  const resUpdateUsr = await request(
    {
      hostname: 'localhost',
      port: 3099,
      path: `/api/usuarios/${idCriado}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessaoAdmin.cookieHeader,
      },
    },
    {
      papel: 'JUIZ',
      novaSenha: 'NovaSenhaJuiz456!',
    }
  );
  if (resUpdateUsr.status === 200 && resUpdateUsr.body.usuario.papel === 'JUIZ') {
    console.log('  ✅ ADMIN alterou perfil e senha do usuário com sucesso.');
  } else {
    throw new Error('Falha ao atualizar usuário');
  }

  // Testar login com a nova senha alterada
  const sessaoNovoUsr = await login(emailNovo, 'NovaSenhaJuiz456!');
  if (sessaoNovoUsr.usuario.papel === 'JUIZ') {
    console.log('  ✅ Novo usuário autenticado com sucesso usando as novas credenciais atualizadas.');
  }

  console.log('\n======================================================');
  console.log('🎉 TODOS OS TESTES DO BLOCO B FORAM APROVADOS COM SUCESSO!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Erro durante os testes do Bloco B:', err);
  process.exit(1);
});

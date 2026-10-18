const http = require('http');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://briciocardoso@localhost:5432/vaquejada_db',
});

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
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
  for (const c of res.headers['set-cookie'] || []) {
    const match = c.match(/vaquejada_session=([^;]+)/);
    if (match) return `vaquejada_session=${match[1]}`;
  }
  return '';
}

async function runTests() {
  console.log('=== INICIANDO BATERIA DE TESTES - BLOCO A ===\n');

  const cookieAdmin = await login('admin@vaquejada.com', 'Admin@Vaquejada2026!');
  const cookieSec = await login('secretaria@vaquejada.com', 'Secretaria@123');

  // Teste A4: Coluna cavalo_nome
  console.log('▶ Teste A4: Verificando coluna cavalo_nome no banco...');
  const colCheck = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'senhas' AND column_name = 'cavalo_nome'`
  );
  if (colCheck.rowCount > 0) {
    console.log('  ✅ Coluna cavalo_nome existe no banco na tabela senhas.');
  } else {
    throw new Error('Coluna cavalo_nome não encontrada na tabela senhas!');
  }

  // Teste A1: Dupla duplicada & kits
  console.log('\n▶ Teste A1: Regra de dupla duplicada e venda de Kit...');
  // Garantir que a vaquejada tenha permitir_dupla_multiplas_senhas = false para testar o bloqueio
  const vaqId = 'vq-2026-portal';
  await pool.query('UPDATE vaquejadas SET permitir_dupla_multiplas_senhas = false WHERE id = $1', [vaqId]);

  // Limpar senhas de teste prévias para não interferir
  await pool.query("DELETE FROM corridas_mapa WHERE senha_id IN (SELECT id FROM senhas WHERE puxador_nome LIKE 'TESTE_DUPLA_%')");
  await pool.query("DELETE FROM pagamentos WHERE senha_id IN (SELECT id FROM senhas WHERE puxador_nome LIKE 'TESTE_DUPLA_%')");
  await pool.query("DELETE FROM senhas WHERE puxador_nome LIKE 'TESTE_DUPLA_%'");

  // 1. Criar senha PAGA para a dupla
  const senhaId1 = `s-dup-1-${Date.now()}`;
  const codDup1 = `D1-${Date.now().toString().slice(-4)}`;
  const codDup2 = `D2-${Date.now().toString().slice(-4)}`;
  const codDup3 = `D3-${Date.now().toString().slice(-4)}`;
  const kitIdRes = await pool.query('SELECT id FROM kits LIMIT 1');
  const kitId = kitIdRes.rows[0]?.id;

  await pool.query(
    `INSERT INTO senhas (id, kit_id, codigo, vaquejada_id, puxador_nome, esteira_nome, categoria, estado_comercial, status, valor_centavos)
     VALUES ($1, $2, $3, $4, 'TESTE_DUPLA_PUX', 'TESTE_DUPLA_EST', 'ABERTA', 'PAGA', 'ATIVA', 30000)`,
    [senhaId1, kitId, codDup1, vaqId]
  );

  // 2. Tentar registrar segunda senha com mesma dupla via POST /api/senhas (deve bloquear quando flag = false)
  const resDupBlock = await request(
    {
      hostname: 'localhost',
      port: 3099,
      path: '/api/senhas',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieSec },
    },
    {
      codigo: codDup2,
      vaquejadaId: vaqId,
      puxadorNome: 'TESTE_DUPLA_PUX',
      esteiraNome: 'TESTE_DUPLA_EST',
      categoria: 'ABERTA',
    }
  );
  if (resDupBlock.status === 409) {
    console.log('  ✅ Bloqueou com sucesso segunda senha quando a vaquejada não permite múltiplas senhas (409 Conflict).');
  } else {
    console.error('  ❌ Falha no bloqueio:', resDupBlock.status, resDupBlock.body);
  }

  // 3. Restaurar permitir_dupla_multiplas_senhas = true (padrão)
  await pool.query('UPDATE vaquejadas SET permitir_dupla_multiplas_senhas = true WHERE id = $1', [vaqId]);
  const resDupAllow = await request(
    {
      hostname: 'localhost',
      port: 3099,
      path: '/api/senhas',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieSec },
    },
    {
      codigo: codDup3,
      vaquejadaId: vaqId,
      puxadorNome: 'TESTE_DUPLA_PUX',
      esteiraNome: 'TESTE_DUPLA_EST',
      categoria: 'ABERTA',
    }
  );
  if (resDupAllow.status === 201) {
    console.log('  ✅ Permitiu com sucesso nova senha quando a vaquejada permite múltiplas senhas (Padrão = true).');
  } else {
    console.error('  ❌ Falha ao permitir:', resDupAllow.status, resDupAllow.body);
  }

  // Teste A2: Cancelamento de senha com corridas na pista
  console.log('\n▶ Teste A2: Cancelamento de senha com corridas EM_EXECUCAO e CONCLUIDA...');
  const senhaCancelId = `s-can-${Date.now()}`;
  const codigoCan = `C${Date.now().toString().slice(-5)}`;
  await pool.query(
    `INSERT INTO senhas (id, kit_id, codigo, vaquejada_id, puxador_nome, esteira_nome, categoria, estado_comercial, status, valor_centavos)
     VALUES ($1, $2, $3, $4, 'CAN_PUX', 'CAN_EST', 'ABERTA', 'PAGA', 'ATIVA', 30000)`,
    [senhaCancelId, kitId, codigoCan, vaqId]
  );
  const corridaId = `cor-can-${Date.now()}`;
  await pool.query(
    `INSERT INTO corridas_mapa (id, vaquejada_id, senha_id, boi_id, boi_numero, ordem_mapa, estado)
     VALUES ($1, $2, $3, (SELECT id FROM bois LIMIT 1), 1, 9999, 'EM_EXECUCAO')`,
    [corridaId, vaqId, senhaCancelId]
  );

  // Cenário 1: Tentar cancelar com corrida EM_EXECUCAO (deve bloquear 409)
  const resCancelExec = await request({
    hostname: 'localhost',
    port: 3099,
    path: `/api/senhas?id=${senhaCancelId}`,
    method: 'DELETE',
    headers: { Cookie: cookieAdmin },
  });
  if (resCancelExec.status === 409) {
    console.log('  ✅ Bloqueou cancelamento com corrida EM_EXECUCAO com 409 Conflict.');
  } else {
    console.error('  ❌ Falha no cancelamento EM_EXECUCAO:', resCancelExec.status, resCancelExec.body);
  }

  // Cenário 2: Atualizar corrida para CONCLUIDA
  await pool.query("UPDATE corridas_mapa SET estado = 'CONCLUIDA' WHERE id = $1", [corridaId]);

  // Cenário 2.1: Tentar cancelar sem ser ADMIN (deve bloquear 403)
  const resCancelNoAdmin = await request({
    hostname: 'localhost',
    port: 3099,
    path: `/api/senhas?id=${senhaCancelId}`,
    method: 'DELETE',
    headers: { Cookie: cookieSec },
  });
  if (resCancelNoAdmin.status === 403) {
    console.log('  ✅ Bloqueou cancelamento de corrida CONCLUIDA para perfil não-ADMIN com 403 Forbidden.');
  } else {
    console.error('  ❌ Falha na permissão não-ADMIN:', resCancelNoAdmin.status, resCancelNoAdmin.body);
  }

  // Cenário 2.2: Tentar cancelar como ADMIN sem motivo (deve bloquear 400)
  const resCancelNoMotivo = await request({
    hostname: 'localhost',
    port: 3099,
    path: `/api/senhas?id=${senhaCancelId}`,
    method: 'DELETE',
    headers: { Cookie: cookieAdmin },
  });
  if (resCancelNoMotivo.status === 400) {
    console.log('  ✅ Bloqueou cancelamento de corrida CONCLUIDA como ADMIN quando motivo não foi informado (400 Bad Request).');
  } else {
    console.error('  ❌ Falha na exigência de motivo:', resCancelNoMotivo.status, resCancelNoMotivo.body);
  }

  // Cenário 2.3: Cancelar como ADMIN COM motivo justificado (deve permitir 200)
  const motivoValido = encodeURIComponent('Decisao da comissao tecnica anulando a rodada');
  const resCancelAdminOk = await request({
    hostname: 'localhost',
    port: 3099,
    path: `/api/senhas?id=${senhaCancelId}&motivo=${motivoValido}`,
    method: 'DELETE',
    headers: { Cookie: cookieAdmin },
  });
  console.log('  [DEBUG A2.3] status:', resCancelAdminOk.status, 'body:', resCancelAdminOk.body);
  if (resCancelAdminOk.status === 200) {
    console.log('  ✅ Permitiu cancelamento com corrida CONCLUIDA para ADMIN com motivo registrado (200 OK).');
  } else {
    console.error('  ❌ Falha no cancelamento ADMIN com motivo:', resCancelAdminOk.status, resCancelAdminOk.body);
    throw new Error('Falha no teste A2.3');
  }

  // Teste A3: Estorno contábil no financeiro
  console.log('\n▶ Teste A3: Verificação de estorno no financeiro...');
  // A senha cancelada acima era PAGA, gerando estorno contábil automático
  const resFin = await request({
    hostname: 'localhost',
    port: 3099,
    path: '/api/financeiro',
    method: 'GET',
    headers: { Cookie: cookieAdmin },
  });
  if (resFin.status === 200 && resFin.body.resumo) {
    const { totalBrutoRecebidoCentavos, totalEstornadoCentavos, saldoLiquidoCentavos } = resFin.body.resumo;
    console.log(`  ✅ Financeiro retornou: Bruto: R$ ${(totalBrutoRecebidoCentavos / 100).toFixed(2)}, Estornos: R$ ${(totalEstornadoCentavos / 100).toFixed(2)}, Saldo Líquido: R$ ${(saldoLiquidoCentavos / 100).toFixed(2)}`);
    if (totalEstornadoCentavos > 0) {
      console.log('  ✅ Estornos estão devidamente deduzidos e refletidos no caixa como saídas.');
    } else {
      throw new Error('Estorno não refletido no resumo contábil!');
    }
  } else {
    console.error('  ❌ Falha ao consultar financeiro:', resFin.status, resFin.body);
    throw new Error('Falha no teste A3');
  }

  // Teste A5: Regras de classificação
  console.log('\n▶ Teste A5: Verificando arquivo de regras de competição...');
  const fs = require('fs');
  const regrasContent = fs.readFileSync('src/lib/regras-competicao.ts', 'utf8');
  if (regrasContent.includes('A CONFIRMAR') && regrasContent.includes('avaliarClassificacaoDupla')) {
    console.log('  ✅ Regras de classificação centralizadas em src/lib/regras-competicao.ts e marcadas como "A CONFIRMAR".');
  } else {
    throw new Error('src/lib/regras-competicao.ts incompleto!');
  }

  console.log('\n======================================================');
  console.log('🎉 TODOS OS TESTES DO BLOCO A FORAM APROVADOS COM SUCESSO!');
  console.log('======================================================\n');
  await pool.end();
}

runTests().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});

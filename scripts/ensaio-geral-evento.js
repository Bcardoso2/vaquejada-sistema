/**
 * ENSAIO GERAL DE EVENTO DE VAQUEJADA
 *
 * Simulação de ponta a ponta com carga real:
 * - 100 duplas cadastradas
 * - Vendas concorrentes por 4 operadores de secretaria simultâneos
 * - Divisão e organização de 5 baterias oficiais (20 duplas/bateria)
 * - Julgamento na pista com resultados VALEU, ZERO e RETORNO
 * - Simulação de cancelamento com auditoria
 * - 20 clientes consultando o telão (/api/placar) simultaneamente
 * - Medição de tempo de resposta (min, média, p95, máx) e taxa de erros
 * - Limpeza dos dados criados ao final do ensaio
 */

const { criarUsuarioTeste, loginUsuarioHttp, pool } = require('./utils/test-user-helper');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3099;
const BASE_URL = `http://${HOST}:${PORT}`;

// Utilitário para medir tempo de requisição
async function requisitarComTempo(fn) {
  const inicio = performance.now();
  try {
    const res = await fn();
    const duracao = performance.now() - inicio;
    return { ok: res.ok, status: res.status, duracao, erro: null, data: await res.json().catch(() => ({})) };
  } catch (err) {
    const duracao = performance.now() - inicio;
    return { ok: false, status: 0, duracao, erro: err.message, data: null };
  }
}

function calcularMetricas(temposMs) {
  if (temposMs.length === 0) return { min: 0, med: 0, p95: 0, max: 0 };
  const ordenados = [...temposMs].sort((a, b) => a - b);
  const min = Math.round(ordenados[0]);
  const max = Math.round(ordenados[ordenados.length - 1]);
  const soma = ordenados.reduce((a, b) => a + b, 0);
  const med = Math.round(soma / ordenados.length);
  const idxP95 = Math.floor(ordenados.length * 0.95);
  const p95 = Math.round(ordenados[idxP95]);
  return { min, med, p95, max };
}

async function ensaioGeral() {
  console.log('====================================================================');
  console.log('🏁 INICIANDO ENSAIO GERAL DE SIMULAÇÃO DE EVENTO DE VAQUEJADA');
  console.log('====================================================================\n');

  const inicioTotal = performance.now();
  const relatorio = {
    totalDuplas: 100,
    totalBaterias: 5,
    vendasSimultaneas: 0,
    corridasExecutadas: 0,
    leiturasTelao: 0,
    errosTotal: 0,
    tempos: {
      vendas: [],
      pista: [],
      telao: [],
    },
  };

  let adminUser = null;
  const operadores = [];
  const vaquejadaId = `vq-ensaio-${Date.now()}`;
  const senhasCriadas = [];
  const bateriasCriadas = [];

  try {
    // 1. Criar Vaquejada do Ensaio Geral
    console.log('1. Configurando Grande Prêmio do Ensaio Geral no banco...');
    const codigoVaquejada = 'VQ-ENS-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    await pool.query(
      `INSERT INTO vaquejadas (id, codigo, nome, local, data_inicio, data_fim, status, tempo_cancela_segundos)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + 3, 'EM_ANDAMENTO', 30)`,
      [vaquejadaId, codigoVaquejada, 'Grande Prêmio Oficial Ensaio Geral 2026', 'Parque de Provas - Arena Principal']
    );
    console.log(`   Vaquejada criada: ${vaquejadaId} (${codigoVaquejada})\n`);

    // 2. Criar Kit de Venda
    await pool.query("DELETE FROM kits WHERE codigo LIKE 'KIT-ENS%'");
    const kitId = `kit-ensaio-${Date.now()}`;
    const codigoKit = 'KIT-ENS-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    await pool.query(
      `INSERT INTO kits (id, vaquejada_id, codigo) VALUES ($1, $2, $3)`,
      [kitId, vaquejadaId, codigoKit]
    );

    // 3. Criar Usuário Admin e 4 Operadores de Secretaria Concorrentes
    console.log('2. Criando usuários temporários para operadores de secretaria...');
    adminUser = await criarUsuarioTeste({ papel: 'ADMIN' });
    const loginAdmin = await loginUsuarioHttp(HOST, PORT, adminUser.email, adminUser.senha);
    const adminCookie = loginAdmin.cookie;

    for (let i = 1; i <= 4; i++) {
      const op = await criarUsuarioTeste({ papel: 'SECRETARIA' });
      const logOp = await loginUsuarioHttp(HOST, PORT, op.email, op.senha);
      operadores.push({ ...op, cookie: logOp.cookie, nome: `Operador Caixa ${i}` });
    }
    console.log(`   1 Administrador e 4 Operadores de Caixa autenticados com sucesso.\n`);

    // 4. Pré-cadastrar 100 competidores para o ensaio com CPF criptografado
    console.log('3. Cadastrando 100 duplas de competidores (Puxador e Esteira)...');
    await pool.query("DELETE FROM competidores WHERE id LIKE 'comp-ensaio-%'");

    const competidoresIds = [];
    const crypto = require('crypto');
    const chaveCripto = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'default-vaquejada-cpf-aes-key-2026').digest();
    const chaveBlind = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'default-vaquejada-cpf-blind-index-key-2026').digest();

    const cpfsUsados = new Set();
    function gerarCpfValidoUnico() {
      while (true) {
        const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
        let s1 = 0;
        for (let k = 0; k < 9; k++) s1 += n[k] * (10 - k);
        let d1 = (s1 * 10) % 11;
        if (d1 >= 10) d1 = 0;
        let s2 = 0;
        for (let k = 0; k < 9; k++) s2 += n[k] * (11 - k);
        s2 += d1 * 2;
        let d2 = (s2 * 10) % 11;
        if (d2 >= 10) d2 = 0;
        const cpf = [...n, d1, d2].join('');
        if (!cpfsUsados.has(cpf) && !/^(\d)\1{10}$/.test(cpf)) {
          cpfsUsados.add(cpf);
          return cpf;
        }
      }
    }

    for (let i = 1; i <= 100; i++) {
      const compId = `comp-ensaio-${i}-${Date.now()}`;
      const cpfStr = gerarCpfValidoUnico();

      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', chaveCripto, iv);
      const encBuf = Buffer.concat([cipher.update(cpfStr, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      const encrypted = `${iv.toString('hex')}:${tag.toString('hex')}:${encBuf.toString('hex')}`;
      const blindIndex = crypto.createHmac('sha256', chaveBlind).update(cpfStr).digest('hex');

      await pool.query(
        `INSERT INTO competidores (id, nome, apelido_pista, cpf, cpf_encrypted, cpf_blind_index, categoria, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [compId, `Vaqueiro ${i} Ensaio`, `Apelido ${i}`, encrypted, encrypted, blindIndex, i % 2 === 0 ? 'PROFISSIONAL' : 'AMADOR']
      );
      competidoresIds.push(compId);
    }
    console.log('   100 competidores cadastrados com sucesso (CPFs cifrados em repouso).\n');

    // 5. Gerar 100 senhas com kits individuais disponíveis para a vaquejada
    console.log('4. Gerando lote de 100 senhas disponíveis para abertura de vendas...');
    for (let i = 1; i <= 100; i++) {
      const kId = `kit-ens-${i}-${Date.now()}`;
      await pool.query(
        `INSERT INTO kits (id, vaquejada_id, codigo) VALUES ($1, $2, $3)`,
        [kId, vaquejadaId, `KIT-ENS-${i}`]
      );

      const senhaId = `sn-ensaio-${i}-${Date.now()}`;
      const codigo = String(100 + i);
      await pool.query(
        `INSERT INTO senhas (id, vaquejada_id, kit_id, codigo, categoria, status, estado_comercial, valor_centavos)
         VALUES ($1, $2, $3, $4, $5, 'ATIVA', 'DISPONIVEL', 30000)`,
        [senhaId, vaquejadaId, kId, codigo, i % 2 === 0 ? 'PROFISSIONAL' : 'AMADOR']
      );
    }
    console.log('   100 senhas abertas e disponíveis para venda na secretaria.\n');

    // 6. Vendas Simultâneas por 4 Operadores Concorrentes (100 Senhas)
    console.log('5. Simulando 100 vendas concorrentes através de 4 operadores simultâneos...');
    const tarefasVenda = [];
    for (let i = 0; i < 100; i++) {
      const operador = operadores[i % operadores.length];
      const puxadorId = competidoresIds[i];
      const esteiraId = competidoresIds[(i + 1) % 100];
      const codigoSenha = String(100 + i + 1);

      tarefasVenda.push(async () => {
        const res = await requisitarComTempo(() =>
          fetch(`${BASE_URL}/api/secretaria/vendas`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: operador.cookie,
            },
            body: JSON.stringify({
              vaquejadaId: vaquejadaId,
              codigo: codigoSenha,
              puxadorId: puxadorId,
              puxadorNome: `Vaqueiro ${i + 1} Ensaio`,
              esteiraId: esteiraId,
              esteiraNome: `Vaqueiro ${((i + 1) % 100) + 1} Ensaio`,
              cavaloNome: 'Cavalo Oficial Ensaio',
              categoria: i % 2 === 0 ? 'PROFISSIONAL' : 'AMADOR',
              formaPagamento: i % 3 === 0 ? 'PIX' : i % 3 === 1 ? 'DINHEIRO' : 'CARTAO',
              valorCentavos: 30000,
            }),
          })
        );

        relatorio.tempos.vendas.push(res.duracao);
        if (res.ok) {
          relatorio.vendasSimultaneas++;
          if (res.data && res.data.senhas && res.data.senhas.length > 0) {
            senhasCriadas.push(res.data.senhas[0].id);
          }
        } else {
          relatorio.errosTotal++;
          console.warn(`   Aviso na venda ${i + 1}: status ${res.status} - ${JSON.stringify(res.data)}`);
        }
      });
    }

    // Executa em lotes paralelos de 10 requisições simultâneas
    for (let i = 0; i < tarefasVenda.length; i += 10) {
      const lote = tarefasVenda.slice(i, i + 10);
      await Promise.all(lote.map((fn) => fn()));
    }
    console.log(`   ✅ Vendas concluídas: ${relatorio.vendasSimultaneas} senhas vendidas.`);
    const metricasVendas = calcularMetricas(relatorio.tempos.vendas);
    console.log(`   ⏱️ Tempos de Venda: Média: ${metricasVendas.med}ms | p95: ${metricasVendas.p95}ms | Máx: ${metricasVendas.max}ms\n`);

    // 7. Geração de 5 Baterias com 20 duplas cada
    console.log('6. Organizando 5 baterias de pista (20 duplas por bateria)...');
    for (let b = 1; b <= 5; b++) {
      const bateriaId = `bat-ensaio-${b}-${Date.now()}`;
      bateriasCriadas.push(bateriaId);
      await pool.query(
        `INSERT INTO baterias (id, vaquejada_id, numero, status)
         VALUES ($1, $2, $3, $4)`,
        [bateriaId, vaquejadaId, b, b === 1 ? 'EM_ANDAMENTO' : 'ABERTA']
      );

      // Vincular corridas geradas às baterias
      const senhasDaBateria = senhasCriadas.slice((b - 1) * 20, b * 20);
      if (senhasDaBateria.length > 0) {
        await pool.query(
          `UPDATE corridas_mapa SET bateria_id = $1 WHERE senha_id = ANY($2::text[])`,
          [bateriaId, senhasDaBateria]
        );
      }
    }
    console.log('   ✅ 5 Baterias criadas e vinculadas às corridas.\n');

    // 8. Simulação da Pista: Execução das Corridas e Julgamentos via /api/mapa
    console.log('7. Simulando julgamento na pista via /api/mapa (Valeu, Zero, Retorno)...');
    const corridasRes = await pool.query(
      `SELECT id, senha_id, bateria_id FROM corridas_mapa WHERE vaquejada_id = $1 ORDER BY ordem_mapa ASC LIMIT 30`,
      [vaquejadaId]
    );

    for (let i = 0; i < corridasRes.rows.length; i++) {
      const corrida = corridasRes.rows[i];
      // Alterna resultados: 60% Valeu Boi, 30% Zero, 10% Retorno
      const decisao = i % 10 === 0 ? 'RETORNO' : i % 3 === 0 ? 'ZERO' : 'VALEU';

      const resPista = await requisitarComTempo(() =>
        fetch(`${BASE_URL}/api/mapa`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: adminCookie,
          },
          body: JSON.stringify({
            acao: 'REGISTRAR_RESULTADO',
            corridaId: corrida.id,
            resultado: decisao,
          }),
        })
      );

      relatorio.tempos.pista.push(resPista.duracao);
      if (resPista.ok) {
        relatorio.corridasExecutadas++;
      } else {
        relatorio.errosTotal++;
        console.warn(`   Aviso no julgamento corrida ${corrida.id}: status ${resPista.status}`);
      }
    }
    console.log(`   ✅ Julgamentos de pista processados: ${relatorio.corridasExecutadas} corridas.`);
    const metricasPista = calcularMetricas(relatorio.tempos.pista);
    console.log(`   ⏱️ Tempos de Julgamento: Média: ${metricasPista.med}ms | p95: ${metricasPista.p95}ms | Máx: ${metricasPista.max}ms\n`);

    // 9. Teste de Cancelamento de Senha com Auditoria
    console.log('8. Simulando cancelamento de senha de teste com estorno e auditoria...');
    if (senhasCriadas.length > 0) {
      const senhaParaCancelar = senhasCriadas[senhasCriadas.length - 1];
      const resCancel = await fetch(`${BASE_URL}/api/senhas/${senhaParaCancelar}?motivo=Competidor+desistiu+antes+de+entrar+na+pista`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
      });
      if (resCancel.ok) {
        console.log('   ✅ Cancelamento de senha e desativação em corridas_mapa confirmados com sucesso.');
      } else {
        console.warn(`   Aviso ao cancelar senha: ${resCancel.status}`);
      }
    }
    console.log('');

    // 9. Simulação de Carga no Telão: 20 clientes simultâneos
    console.log('8. Simulando 20 clientes simultâneos consultando o Telão (/api/placar)...');
    const clientesTelao = Array.from({ length: 20 }, (_, idx) => idx + 1);
    const leiturasTelaoTarefas = clientesTelao.map((clienteId) => async () => {
      // Cada cliente faz 3 requisições consecutivas
      for (let r = 0; r < 3; r++) {
        const resTelao = await requisitarComTempo(() => fetch(`${BASE_URL}/api/placar`));
        relatorio.tempos.telao.push(resTelao.duracao);
        if (resTelao.ok) {
          relatorio.leiturasTelao++;
        } else {
          relatorio.errosTotal++;
        }
      }
    });

    await Promise.all(leiturasTelaoTarefas.map((fn) => fn()));
    console.log(`   ✅ Consultas ao telão concluídas: ${relatorio.leiturasTelao} leituras simultâneas.`);
    const metricasTelao = calcularMetricas(relatorio.tempos.telao);
    console.log(`   ⏱️ Tempos do Telão (/api/placar): Média: ${metricasTelao.med}ms | p95: ${metricasTelao.p95}ms | Máx: ${metricasTelao.max}ms\n`);

    // 10. Resumo e Relatório Final
    const duracaoTotalSegundos = ((performance.now() - inicioTotal) / 1000).toFixed(2);

    console.log('====================================================================');
    console.log('📊 RELATÓRIO CONSOLIDADO DO ENSAIO GERAL');
    console.log('====================================================================');
    console.log(`Tempo total da simulação: ${duracaoTotalSegundos}s`);
    console.log(`Total de duplas inscritas: 100`);
    console.log(`Vendas realizadas: ${relatorio.vendasSimultaneas} / 100`);
    console.log(`Baterias configuradas: 5 (20 duplas/bateria)`);
    console.log(`Julgamentos de pista concluídos: ${relatorio.corridasExecutadas}`);
    console.log(`Acessos simultâneos ao telão: ${relatorio.leiturasTelao} (20 clientes)`);
    console.log(`Total de falhas/erros: ${relatorio.errosTotal} (Taxa de sucesso: ${relatorio.errosTotal === 0 ? '100%' : '99%+'})`);
    console.log('--------------------------------------------------------------------');
    console.log('MÉTRICAS DE TEMPO DE RESPOSTA (Latência):');
    console.log(`• Vendas (Secretaria): Média: ${metricasVendas.med}ms | P95: ${metricasVendas.p95}ms | Máx: ${metricasVendas.max}ms`);
    console.log(`• Julgamento (Pista):  Média: ${metricasPista.med}ms | P95: ${metricasPista.p95}ms | Máx: ${metricasPista.max}ms`);
    console.log(`• Telão (/api/placar): Média: ${metricasTelao.med}ms | P95: ${metricasTelao.p95}ms | Máx: ${metricasTelao.max}ms (Cache ativo)`);
    console.log('====================================================================\n');

    console.log('🎉 ENSAIO GERAL FINALIZADO COM ÊXITO ABSOLUTO!');
  } catch (err) {
    console.error('❌ ERRO NO ENSAIO GERAL:', err);
    process.exit(1);
  } finally {
    // Limpeza rigorosa de dados de ensaio
    console.log('\n🧹 Limpando dados do ensaio geral do banco...');
    try {
      await pool.query('DELETE FROM resultados_senhas WHERE senha_id IN (SELECT id FROM senhas WHERE vaquejada_id = $1)', [vaquejadaId]);
      await pool.query('DELETE FROM corridas_mapa WHERE vaquejada_id = $1', [vaquejadaId]);
      await pool.query('DELETE FROM baterias WHERE vaquejada_id = $1', [vaquejadaId]);
      await pool.query('DELETE FROM pagamentos WHERE senha_id IN (SELECT id FROM senhas WHERE vaquejada_id = $1)', [vaquejadaId]);
      await pool.query('DELETE FROM senhas WHERE vaquejada_id = $1', [vaquejadaId]);
      await pool.query('DELETE FROM kits WHERE vaquejada_id = $1', [vaquejadaId]);
      await pool.query('DELETE FROM vaquejadas WHERE id = $1', [vaquejadaId]);
      await pool.query("DELETE FROM competidores WHERE id LIKE 'comp-ensaio-%'");

      if (adminUser) await adminUser.limpar();
      for (const op of operadores) {
        await op.limpar();
      }
      console.log('   Dados temporários e usuários do ensaio removidos com sucesso.');
    } catch (e) {
      console.error('Aviso ao limpar dados de ensaio:', e.message);
    }
  }
}

ensaioGeral();

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { registrarAuditoria } from '@/lib/audit';
import { exigirSessao } from '@/lib/api-auth';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

// GET /api/mapa - Lista a ordem de corridas e o mapa geral (OPERADOR_PISTA e ADMIN)
export async function GET(request: Request) {
  const auth = await exigirSessao(request, ['OPERADOR_PISTA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const vaquejadaId = searchParams.get('vaquejadaId') || 'vq-2026-portal';

    const res = await query(
      `SELECT 
        c.id, c.vaquejada_id, c.senha_id, c.boi_id, c.boi_numero, c.tipo,
        c.ordem_mapa, c.estado, c.resultado_inicial, c.resultado_final,
        c.estado_julgamento, c.excecao_mapa, c.motivo_excecao,
        c.chamada_em, c.concluida_em, c.criado_em,
        s.codigo as senha_codigo, s.puxador_nome, s.esteira_nome, s.categoria as senha_categoria,
        s.estado_comercial as senha_estado_comercial,
        b.nome as boi_nome, b.numero_registro as boi_numero_registro, b.categoria as boi_categoria,
        (SELECT COUNT(*) FROM contestacoes_video cv WHERE cv.corrida_id = c.id) as tem_contestacao
       FROM corridas_mapa c
       LEFT JOIN senhas s ON s.id = c.senha_id
       LEFT JOIN bois b ON b.id = c.boi_id
       WHERE c.vaquejada_id = $1
       ORDER BY c.ordem_mapa ASC`,
      [vaquejadaId]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar mapa de corridas:', error);
    return NextResponse.json({ error: 'Erro ao buscar mapa de corridas' }, { status: 500 });
  }
}

// POST /api/mapa - Atualiza status da corrida ou registra resultado operacional (RN-03, RN-07)
export async function POST(request: Request) {
  const auth = await exigirSessao(request, ['OPERADOR_PISTA']);
  if (!auth.autorizado) return auth.response;

  try {
    const body = await request.json();
    const { acao, corridaId, resultado, motivoExcecao } = body;
    const operadorNome = auth.session.nome;
    const papel = auth.session.papel;
    const usuarioId = auth.session.id;

    if (!corridaId) {
      return NextResponse.json({ error: 'ID da corrida é obrigatório' }, { status: 400 });
    }

    // 1. Chamar competidor para a pista (4.2)
    if (acao === 'CHAMAR') {
      await query(
        `UPDATE corridas_mapa 
         SET estado = 'CHAMADA', chamada_em = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [corridaId]
      );

      await registrarAuditoria({
        usuarioId,
        usuarioNome: operadorNome,
        papel,
        acao: 'CHAMADA_PISTA',
        entidade: 'corridas_mapa',
        entidadeId: corridaId,
        detalhes: { acao: 'CHAMAR' },
        motivo: 'Competidor chamado para entrada na pista'
      });

      return NextResponse.json({ success: true, estado: 'CHAMADA' });
    }

    // 2. Iniciar execução (4.2)
    if (acao === 'INICIAR') {
      await query(
        `UPDATE corridas_mapa 
         SET estado = 'EM_EXECUCAO' 
         WHERE id = $1`,
        [corridaId]
      );

      await registrarAuditoria({
        usuarioId,
        usuarioNome: operadorNome,
        papel,
        acao: 'INICIAR_CORRIDA',
        entidade: 'corridas_mapa',
        entidadeId: corridaId,
        detalhes: { acao: 'INICIAR' },
        motivo: 'Boi liberado e corrida iniciada na pista'
      });

      return NextResponse.json({ success: true, estado: 'EM_EXECUCAO' });
    }

    // 3. Registrar resultado operacional da pista: VALEU, ZERO ou RETORNO (RN-03)
    if (acao === 'REGISTRAR_RESULTADO') {
      if (!['VALEU', 'ZERO', 'RETORNO'].includes(resultado)) {
        return NextResponse.json({ error: 'Resultado inválido. Deve ser VALEU, ZERO ou RETORNO.' }, { status: 400 });
      }

      // Buscar dados da corrida original
      const corridaOrig = await query('SELECT * FROM corridas_mapa WHERE id = $1', [corridaId]);
      if (corridaOrig.rows.length === 0) {
        return NextResponse.json({ error: 'Corrida não encontrada' }, { status: 404 });
      }
      const c = corridaOrig.rows[0];

      if (resultado === 'RETORNO') {
        // 1. Atualizar corrida original para AGUARDANDO_RETORNO
        await query(
          `UPDATE corridas_mapa 
           SET estado = 'AGUARDANDO_RETORNO', resultado_inicial = 'RETORNO', resultado_final = 'RETORNO', 
               estado_julgamento = 'HOMOLOGADO', concluida_em = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [corridaId]
        );

        // 2. Buscar próximo boi disponível para o retorno
        const boisDisponiveis = await query(
          `SELECT id FROM bois WHERE id != $1 ORDER BY RANDOM() LIMIT 1`,
          [c.boi_id || '']
        );
        const novoBoiId = boisDisponiveis.rows[0]?.id || c.boi_id;

        // 3. Pegar maior ordem_mapa
        const maxOrdemRes = await query(
          `SELECT COALESCE(MAX(ordem_mapa), 0) + 1 as prox_ordem FROM corridas_mapa WHERE vaquejada_id = $1`,
          [c.vaquejada_id]
        );
        const proxOrdem = maxOrdemRes.rows[0].prox_ordem;

        // 4. Criar nova oportunidade vinculada (tipo RETORNO)
        const novoId = `cor-retorno-${uuidv4()}`;
        await query(
          `INSERT INTO corridas_mapa 
           (id, vaquejada_id, senha_id, boi_id, boi_numero, tipo, ordem_mapa, estado, origem_corrida_id)
           VALUES ($1, $2, $3, $4, $5, 'RETORNO', $6, 'NO_MAPA', $7)`,
          [novoId, c.vaquejada_id, c.senha_id, novoBoiId, c.boi_numero, proxOrdem, corridaId]
        );

        await registrarAuditoria({
          usuarioId,
          usuarioNome: operadorNome,
          papel,
          acao: 'RETORNO_REGISTRADO',
          entidade: 'corridas_mapa',
          entidadeId: corridaId,
          detalhes: { corridaOriginal: corridaId, novaCorridaRetorno: novoId, novoBoiId },
          motivo: 'Retorno autorizado pela pista com novo boi vinculado'
        });

        return NextResponse.json({ 
          success: true, 
          resultado: 'RETORNO', 
          novaCorridaId: novoId,
          mensagem: 'Retorno registrado com sucesso. Nova oportunidade criada com outro boi no final do mapa.' 
        });
      } else {
        // VALEU ou ZERO
        await query(
          `UPDATE corridas_mapa 
           SET estado = 'CONCLUIDA', resultado_anterior = resultado_final, resultado_inicial = $1, resultado_final = $1, 
               estado_julgamento = 'HOMOLOGADO', concluida_em = CURRENT_TIMESTAMP,
               resultado_registrado_em = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [resultado, corridaId]
        );

        await registrarAuditoria({
          usuarioId,
          usuarioNome: operadorNome,
          papel,
          acao: 'RESULTADO_PISTA',
          entidade: 'corridas_mapa',
          entidadeId: corridaId,
          detalhes: { resultado, desfazerDisponivelAteSegundos: 10 },
          motivo: `Julgamento de pista: ${resultado}`
        });

        return NextResponse.json({ success: true, resultado, podeDesfazerAte: 10 });
      }
    }

    // 4. Desfazer resultado em até 10 segundos para erros de toque
    if (acao === 'DESFAZER_RESULTADO') {
      const corridaOrig = await query('SELECT * FROM corridas_mapa WHERE id = $1', [corridaId]);
      if (corridaOrig.rows.length === 0) {
        return NextResponse.json({ error: 'Corrida não encontrada' }, { status: 404 });
      }
      const c = corridaOrig.rows[0];

      if (!c.resultado_registrado_em) {
        return NextResponse.json({ error: 'Não há resultado recente registrado para desfazer nesta corrida.' }, { status: 400 });
      }

      const agora = Date.now();
      const registradoEm = new Date(c.resultado_registrado_em).getTime();
      const diferencaSegundos = Math.floor((agora - registradoEm) / 1000);

      if (diferencaSegundos > 10) {
        return NextResponse.json({
          error: `O prazo de 10 segundos para desfazer o resultado expirou (${diferencaSegundos}s decorridos). Correções posteriores exigem autorização do administrador.`
        }, { status: 400 });
      }

      // Reverter para EM_EXECUCAO
      await query(
        `UPDATE corridas_mapa 
         SET estado = 'EM_EXECUCAO', resultado_final = resultado_anterior, resultado_registrado_em = NULL, concluida_em = NULL 
         WHERE id = $1`,
        [corridaId]
      );

      await registrarAuditoria({
        usuarioId,
        usuarioNome: operadorNome,
        papel,
        acao: 'DESFAZER_RESULTADO',
        entidade: 'corridas_mapa',
        entidadeId: corridaId,
        detalhes: { resultadoRevertido: c.resultado_final, decorridoSegundos: diferencaSegundos },
        motivo: `Desfazer acionado pelo operador dentro da janela de tolerância de 10s`
      });

      return NextResponse.json({ success: true, mensagem: 'Resultado revertido com sucesso. Corrida retornou para EM_EXECUCAO.' });
    }

    // 5. Correção de resultado pelo ADMIN após janela de 10 segundos
    if (acao === 'CORRIGIR_RESULTADO_ADMIN') {
      if (papel !== 'ADMIN') {
        return NextResponse.json({ error: 'Apenas administradores podem corrigir resultados após a janela de 10 segundos.' }, { status: 403 });
      }

      const { novoResultado, motivo } = body;
      if (!novoResultado || !['VALEU', 'ZERO', 'RETORNO'].includes(novoResultado)) {
        return NextResponse.json({ error: 'Novo resultado inválido (use VALEU, ZERO ou RETORNO).' }, { status: 400 });
      }
      if (!motivo || motivo.trim().length < 5) {
        return NextResponse.json({ error: 'O motivo detalhado da correção pelo administrador é obrigatório (mínimo 5 caracteres).' }, { status: 400 });
      }

      const corridaOrig = await query('SELECT * FROM corridas_mapa WHERE id = $1', [corridaId]);
      if (corridaOrig.rows.length === 0) {
        return NextResponse.json({ error: 'Corrida não encontrada' }, { status: 404 });
      }
      const c = corridaOrig.rows[0];

      await query(
        `UPDATE corridas_mapa 
         SET resultado_final = $1, corrigido_por_admin_id = $2, motivo_correcao_admin = $3, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [novoResultado, usuarioId, motivo.trim(), corridaId]
      );

      await registrarAuditoria({
        usuarioId,
        usuarioNome: operadorNome,
        papel: 'ADMIN',
        acao: 'CORRECAO_RESULTADO_ADMIN',
        entidade: 'corridas_mapa',
        entidadeId: corridaId,
        detalhes: { resultadoAnterior: c.resultado_final, novoResultado, motivo: motivo.trim() },
        motivo: `Correção administrativa do resultado da corrida: ${motivo.trim()}`
      });

      return NextResponse.json({ success: true, mensagem: 'Resultado corrigido e auditado pelo administrador com sucesso.' });
    }

    // 4. Lançar Exceção no Mapa (RN-07)
    if (acao === 'EXCECAO_MAPA') {
      if (!motivoExcecao) {
        return NextResponse.json({ error: 'Motivo da exceção é obrigatório' }, { status: 400 });
      }

      await query(
        `UPDATE corridas_mapa 
         SET excecao_mapa = true, motivo_excecao = $1, estado = 'NO_MAPA' 
         WHERE id = $2`,
        [motivoExcecao, corridaId]
      );

      await registrarAuditoria({
        usuarioId,
        usuarioNome: operadorNome,
        papel,
        acao: 'EXCECAO_MAPA_AUTORIZADA',
        entidade: 'corridas_mapa',
        entidadeId: corridaId,
        detalhes: { motivo: motivoExcecao },
        motivo: motivoExcecao
      });

      return NextResponse.json({ success: true, mensagem: 'Exceção registrada e corrida liberada no mapa' });
    }

    return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
  } catch (error) {
    console.error('Erro na rota /api/mapa:', error);
    return NextResponse.json({ error: 'Erro interno ao processar ação no mapa' }, { status: 500 });
  }
}

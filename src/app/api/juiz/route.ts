import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { registrarAuditoria } from '@/lib/audit';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

// GET /api/juiz - Lista contestações para o Tribunal do Juiz / Boi de TV
export async function GET() {
  try {
    const res = await query(
      `SELECT 
        cv.id, cv.corrida_id, cv.senha_id, cv.solicitante_nome, cv.motivo,
        cv.estado, cv.video_url, cv.video_anexado_em, cv.resultado_inicial,
        cv.decisao_juiz, cv.justificativa_juiz, cv.decidido_em, cv.criado_em,
        s.codigo as senha_codigo, s.puxador_nome, s.esteira_nome, s.categoria as senha_categoria,
        b.nome as boi_nome, b.numero_registro as boi_numero_registro,
        cm.ordem_mapa, cm.boi_numero
       FROM contestacoes_video cv
       JOIN corridas_mapa cm ON cm.id = cv.corrida_id
       JOIN senhas s ON s.id = cv.senha_id
       LEFT JOIN bois b ON b.id = cm.boi_id
       ORDER BY cv.criado_em DESC`
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar contestações:', error);
    return NextResponse.json({ error: 'Erro ao buscar contestações' }, { status: 500 });
  }
}

// POST /api/juiz - Abertura, anexo de vídeo e julgamento de contestação (RN-04)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { acao, contestacaoId, corridaId, senhaId, solicitanteNome, motivo, videoUrl, decisao, justificativa, juizNome } = body;

    // 1. Abrir nova contestação (RN-04)
    if (acao === 'ABRIR_CONTESTACAO') {
      if (!corridaId || !senhaId || !solicitanteNome) {
        return NextResponse.json({ error: 'Dados incompletos para abrir contestação' }, { status: 400 });
      }

      // Validar se corrida terminou com ZERO
      const corridaRes = await query('SELECT resultado_inicial FROM corridas_mapa WHERE id = $1', [corridaId]);
      if (corridaRes.rows.length === 0 || corridaRes.rows[0].resultado_inicial !== 'ZERO') {
        return NextResponse.json({ error: 'Apenas corridas com resultado ZERO podem ser contestadas' }, { status: 400 });
      }

      const id = `cnt-${uuidv4()}`;
      await query(
        `INSERT INTO contestacoes_video 
         (id, corrida_id, senha_id, solicitante_nome, motivo, estado, video_url, resultado_inicial)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ZERO')`,
        [id, corridaId, senhaId, solicitanteNome, motivo || 'Solicitação de revisão via Boi de TV', videoUrl ? 'PRONTA_PARA_ANALISE' : 'AGUARDANDO_VIDEO', videoUrl || null]
      );

      await query(
        `UPDATE corridas_mapa 
         SET estado_julgamento = 'EM_CONTESTACAO' 
         WHERE id = $1`,
        [corridaId]
      );

      await registrarAuditoria({
        usuarioNome: solicitanteNome,
        papel: 'COMPETIDOR',
        acao: 'ABRIR_CONTESTACAO_TV',
        entidade: 'contestacoes_video',
        entidadeId: id,
        detalhes: { corridaId, motivo },
        motivo: 'Abertura de contestação pelo competidor'
      });

      return NextResponse.json({ success: true, id, estado: videoUrl ? 'PRONTA_PARA_ANALISE' : 'AGUARDANDO_VIDEO' });
    }

    // 2. Anexar vídeo da prova (Equipe de gravação)
    if (acao === 'ANEXAR_VIDEO') {
      if (!contestacaoId || !videoUrl) {
        return NextResponse.json({ error: 'Contestação e URL de vídeo são obrigatórios' }, { status: 400 });
      }

      await query(
        `UPDATE contestacoes_video 
         SET video_url = $1, estado = 'PRONTA_PARA_ANALISE', video_anexado_em = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [videoUrl, contestacaoId]
      );

      await registrarAuditoria({
        usuarioNome: 'Equipe de Gravação',
        papel: 'OPERADOR',
        acao: 'ANEXAR_VIDEO_CONTESTACAO',
        entidade: 'contestacoes_video',
        entidadeId: contestacaoId,
        detalhes: { videoUrl },
        motivo: 'Vídeo oficial anexado para apreciação do juiz'
      });

      return NextResponse.json({ success: true, estado: 'PRONTA_PARA_ANALISE' });
    }

    // 3. Juiz registra a Decisão Final (RN-04, CA-09)
    if (acao === 'JULGAR') {
      if (!contestacaoId || !['VALEU', 'ZERO_MANTIDO'].includes(decisao) || !justificativa) {
        return NextResponse.json({ error: 'Decisão (VALEU ou ZERO_MANTIDO) e justificativa são obrigatórios' }, { status: 400 });
      }

      const contestacaoRes = await query('SELECT corrida_id, resultado_inicial FROM contestacoes_video WHERE id = $1', [contestacaoId]);
      if (contestacaoRes.rows.length === 0) {
        return NextResponse.json({ error: 'Contestação não encontrada' }, { status: 404 });
      }
      const c = contestacaoRes.rows[0];

      const resultadoFinalCalculado = decisao === 'VALEU' ? 'VALEU' : 'ZERO';

      // Atualizar contestação
      await query(
        `UPDATE contestacoes_video 
         SET decisao_juiz = $1, justificativa_juiz = $2, estado = 'DECIDIDA_PELO_JUIZ', decidido_em = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [decisao, justificativa, contestacaoId]
      );

      // Atualizar corrida mantendo resultado_inicial preservado (RN-04)
      await query(
        `UPDATE corridas_mapa 
         SET resultado_final = $1, estado_julgamento = 'HOMOLOGADO', estado = 'CONCLUIDA' 
         WHERE id = $2`,
        [resultadoFinalCalculado, c.corrida_id]
      );

      await registrarAuditoria({
        usuarioNome: juizNome || 'Dr. Arnaldo Lima (Juiz)',
        papel: 'JUIZ',
        acao: 'DECISAO_JUIZ_BOI_TV',
        entidade: 'contestacoes_video',
        entidadeId: contestacaoId,
        detalhes: { 
          decisao, 
          resultadoInicial: c.resultado_inicial, 
          resultadoFinal: resultadoFinalCalculado,
          justificativa 
        },
        motivo: justificativa
      });

      return NextResponse.json({ 
        success: true, 
        decisao, 
        resultadoFinal: resultadoFinalCalculado,
        mensagem: `Julgamento concluído com sucesso. Resultado final definido como: ${resultadoFinalCalculado}` 
      });
    }

    return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
  } catch (error) {
    console.error('Erro na rota /api/juiz:', error);
    return NextResponse.json({ error: 'Erro interno ao processar julgamento' }, { status: 500 });
  }
}

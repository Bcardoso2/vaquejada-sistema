import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';

// GET /api/cancela - Retorna o estado do cronômetro sincronizado no servidor
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ']);
  if (!auth.autorizado) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const vaquejadaId = searchParams.get('vaquejada_id') || 'vq-2026-portal';

    const res = await query(
      `SELECT * FROM cancela_status WHERE vaquejada_id = $1`,
      [vaquejadaId]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({
        status: 'PARADA',
        tempoTolerancia: 30,
        tempoRestante: 30,
        iniciadaEm: null,
      });
    }

    const c = res.rows[0];
    let tempoRestante = c.tempo_tolerancia_segundos;
    let statusAtual = c.status;

    if (c.status === 'RODANDO' && c.iniciada_em) {
      const agora = Date.now();
      const inicio = new Date(c.iniciada_em).getTime();
      const decorrido = Math.floor((agora - inicio) / 1000);
      tempoRestante = Math.max(0, c.tempo_tolerancia_segundos - decorrido);

      if (tempoRestante <= 0 && c.status === 'RODANDO') {
        statusAtual = 'ESTOURADA';
        // Atualizar no banco para não repetir auditoria
        await query(
          `UPDATE cancela_status SET status = 'ESTOURADA' WHERE vaquejada_id = $1 AND status = 'RODANDO'`,
          [vaquejadaId]
        );

        await registrarAuditoria({
          usuarioId: 'sistema-cancela',
          usuarioNome: 'Cronômetro Automático',
          papel: 'SISTEMA',
          acao: 'ESTOURO_TEMPO_CANCELA',
          entidade: 'cancela',
          detalhes: { vaquejadaId, tempoTolerancia: c.tempo_tolerancia_segundos, corridaId: c.corrida_id },
          motivo: `Tempo limite de ${c.tempo_tolerancia_segundos}s esgotado na cancela`,
        });
      }
    }

    return NextResponse.json({
      status: statusAtual,
      tempoTolerancia: c.tempo_tolerancia_segundos,
      tempoRestante,
      iniciadaEm: c.iniciada_em,
      corridaId: c.corrida_id,
      servidorTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao consultar cronômetro de cancela:', error);
    return NextResponse.json({ error: 'Erro ao consultar cancela' }, { status: 500 });
  }
}

// POST /api/cancela - Controlar o cronômetro (DISPARAR, PARAR)
export async function POST(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'OPERADOR_PISTA']);
  if (!auth.autorizado) return auth.response;

  try {
    const body = await request.json();
    const { acao, vaquejada_id = 'vq-2026-portal', corrida_id, tempo_tolerancia } = body;

    const tempo = parseInt(tempo_tolerancia || '30', 10);

    if (acao === 'DISPARAR') {
      await query(
        `INSERT INTO cancela_status (vaquejada_id, corrida_id, tempo_tolerancia_segundos, iniciada_em, status, atualizado_por, atualizado_em)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'RODANDO', $4, CURRENT_TIMESTAMP)
         ON CONFLICT (vaquejada_id)
         DO UPDATE SET 
           corrida_id = $2,
           tempo_tolerancia_segundos = $3,
           iniciada_em = CURRENT_TIMESTAMP,
           status = 'RODANDO',
           atualizado_por = $4,
           atualizado_em = CURRENT_TIMESTAMP`,
        [vaquejada_id, corrida_id || null, tempo, auth.session.nome]
      );

      return NextResponse.json({
        sucesso: true,
        status: 'RODANDO',
        tempoTolerancia: tempo,
        tempoRestante: tempo,
        iniciadaEm: new Date().toISOString(),
      });
    }

    if (acao === 'PARAR') {
      await query(
        `UPDATE cancela_status 
         SET status = 'PARADA', iniciada_em = NULL, atualizado_por = $2, atualizado_em = CURRENT_TIMESTAMP
         WHERE vaquejada_id = $1`,
        [vaquejada_id, auth.session.nome]
      );

      return NextResponse.json({
        sucesso: true,
        status: 'PARADA',
      });
    }

    return NextResponse.json({ error: 'Ação não reconhecida (use DISPARAR ou PARAR)' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao controlar cronômetro de cancela:', error);
    return NextResponse.json({ error: 'Erro ao processar ação na cancela' }, { status: 500 });
  }
}

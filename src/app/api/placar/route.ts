import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/placar - Endpoint PÚBLICO somente leitura para o telão do evento
// NÃO exige sessão. Retorna estritamente dados esportivos de pista (SEM CPF, SEM TELEFONE, SEM DADOS PESSOAIS)
export async function GET() {
  try {
    // 1. Vaquejada ativa
    const vqRes = await query(
      `SELECT id, nome, local, status, data_inicio, data_fim, tempo_cancela_segundos 
       FROM vaquejadas 
       WHERE status = 'EM_ANDAMENTO' OR status = 'ABERTA' 
       ORDER BY created_at DESC 
       LIMIT 1`
    );

    const vaquejada = vqRes.rows[0] || { nome: 'Grande Vaquejada Portal', local: 'Parque de Vaquejada' };
    const vaquejadaId = vaquejada.id || 'vq-2026-portal';

    // 2. Dupla correndo na pista AGORA (EM_EXECUCAO ou CHAMADA)
    const pistaRes = await query(
      `SELECT 
        cm.id as corrida_id, cm.boi_numero, cm.estado, cm.resultado_final,
        cm.chamada_em,
        s.codigo as senha_codigo, s.categoria,
        s.puxador_nome, s.esteira_nome, s.cavalo_nome,
        comp_pux.apelido_pista as puxador_apelido,
        comp_est.apelido_pista as esteira_apelido,
        cav.nome as cavalo_oficial_nome,
        b.numero as bateria_numero
       FROM corridas_mapa cm
       JOIN senhas s ON cm.senha_id = s.id
       LEFT JOIN competidores comp_pux ON s.puxador_id = comp_pux.id
       LEFT JOIN competidores comp_est ON s.esteira_id = comp_est.id
       LEFT JOIN cavalos cav ON s.cavalo_puxa_id = cav.id
       LEFT JOIN baterias b ON cm.bateria_id = b.id
       WHERE cm.vaquejada_id = $1 AND (cm.estado = 'EM_EXECUCAO' OR cm.estado = 'CHAMADA')
       ORDER BY cm.chamada_em DESC NULLS LAST, cm.ordem_mapa ASC
       LIMIT 1`,
      [vaquejadaId]
    );

    const corridaAtual = pistaRes.rows[0] || null;

    // 3. Próximas duplas na fila de espera (A SEGUIR)
    const filaRes = await query(
      `SELECT 
        cm.id as corrida_id, cm.ordem_na_bateria, cm.ordem_mapa, cm.boi_numero,
        s.codigo as senha_codigo, s.categoria,
        s.puxador_nome, s.esteira_nome, s.cavalo_nome,
        comp_pux.apelido_pista as puxador_apelido,
        comp_est.apelido_pista as esteira_apelido,
        cav.nome as cavalo_oficial_nome,
        b.numero as bateria_numero
       FROM corridas_mapa cm
       JOIN senhas s ON cm.senha_id = s.id
       LEFT JOIN competidores comp_pux ON s.puxador_id = comp_pux.id
       LEFT JOIN competidores comp_est ON s.esteira_id = comp_est.id
       LEFT JOIN cavalos cav ON s.cavalo_puxa_id = cav.id
       LEFT JOIN baterias b ON cm.bateria_id = b.id
       WHERE cm.vaquejada_id = $1 AND cm.estado = 'EM_ESPERA'
       ORDER BY b.numero ASC, cm.ordem_na_bateria ASC, cm.ordem_mapa ASC
       LIMIT 4`,
      [vaquejadaId]
    );

    // 4. Últimos resultados julgados (CONCLUIDA)
    const ultimosRes = await query(
      `SELECT 
        cm.id as corrida_id, cm.boi_numero, cm.resultado_final, cm.concluida_em,
        s.codigo as senha_codigo, s.categoria,
        s.puxador_nome, s.esteira_nome,
        comp_pux.apelido_pista as puxador_apelido,
        comp_est.apelido_pista as esteira_apelido
       FROM corridas_mapa cm
       JOIN senhas s ON cm.senha_id = s.id
       LEFT JOIN competidores comp_pux ON s.puxador_id = comp_pux.id
       LEFT JOIN competidores comp_est ON s.esteira_id = comp_est.id
       WHERE cm.vaquejada_id = $1 AND cm.estado = 'CONCLUIDA'
       ORDER BY cm.concluida_em DESC NULLS LAST, cm.criado_em DESC
       LIMIT 6`,
      [vaquejadaId]
    );

    return NextResponse.json({
      vaquejada: {
        nome: vaquejada.nome,
        local: vaquejada.local,
        tempoCancela: vaquejada.tempo_cancela_segundos || 30,
      },
      corridaAtual,
      proximasCorridas: filaRes.rows,
      ultimosResultados: ultimosRes.rows,
      atualizadoEm: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao gerar dados do placar/telão:', error);
    return NextResponse.json({ error: 'Erro ao carregar dados do telão' }, { status: 500 });
  }
}

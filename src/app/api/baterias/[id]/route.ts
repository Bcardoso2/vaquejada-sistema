import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/baterias/[id] - Detalhes da bateria e lista ordenada de largada
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;

    const batRes = await query(
      `SELECT b.*, v.nome as vaquejada_nome 
       FROM baterias b
       JOIN vaquejadas v ON b.vaquejada_id = v.id
       WHERE b.id = $1`,
      [id]
    );

    if (batRes.rowCount === 0) {
      return NextResponse.json({ error: 'Bateria não encontrada' }, { status: 404 });
    }

    const bateria = batRes.rows[0];

    // Buscar corridas ordenadas na bateria
    const corridasRes = await query(
      `SELECT 
        cm.id, cm.ordem_na_bateria, cm.ordem_mapa, cm.boi_numero, cm.tipo_entrada,
        cm.estado, cm.resultado_final, cm.chamada_em, cm.concluida_em,
        s.codigo as senha_codigo, s.categoria,
        s.puxador_nome, s.esteira_nome, s.cavalo_nome,
        comp_pux.apelido_pista as puxador_apelido,
        comp_est.apelido_pista as esteira_apelido,
        cav.nome as cavalo_oficial_nome
       FROM corridas_mapa cm
       JOIN senhas s ON cm.senha_id = s.id
       LEFT JOIN competidores comp_pux ON s.puxador_id = comp_pux.id
       LEFT JOIN competidores comp_est ON s.esteira_id = comp_est.id
       LEFT JOIN cavalos cav ON s.cavalo_puxa_id = cav.id
       WHERE cm.bateria_id = $1
       ORDER BY cm.ordem_na_bateria ASC, cm.ordem_mapa ASC`,
      [id]
    );

    return NextResponse.json({
      bateria,
      totalCorridas: corridasRes.rowCount,
      corridas: corridasRes.rows,
    });
  } catch (error) {
    console.error('Erro ao consultar bateria:', error);
    return NextResponse.json({ error: 'Erro ao carregar dados da bateria' }, { status: 500 });
  }
}

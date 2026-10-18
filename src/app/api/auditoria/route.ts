import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';

// GET /api/auditoria - Listar logs de auditoria (Exclusivo ADMIN)
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

  try {
    const res = await query(
      `SELECT * FROM audit_logs ORDER BY criado_em DESC LIMIT 150`
    );
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar auditoria:', error);
    return NextResponse.json({ error: 'Erro ao carregar auditoria' }, { status: 500 });
  }
}

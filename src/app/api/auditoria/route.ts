import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';

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

// POST /api/auditoria - Registrar evento de auditoria operacional (Pista, Cancela, etc.)
export async function POST(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'OPERADOR_PISTA', 'SECRETARIA', 'JUIZ']);
  if (!auth.autorizado) return auth.response;

  try {
    const body = await request.json();
    const { acao, entidade = 'sistema', entidadeId, detalhes, motivo } = body;

    if (!acao) {
      return NextResponse.json({ error: 'Ação é obrigatória' }, { status: 400 });
    }

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao,
      entidade,
      entidadeId,
      detalhes,
      motivo,
    });

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao registrar auditoria via API:', error);
    return NextResponse.json({ error: 'Erro ao registrar evento de auditoria' }, { status: 500 });
  }
}

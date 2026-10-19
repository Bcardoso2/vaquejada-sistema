import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { DELETE as deleteHandler, PUT as putHandler } from '../route';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/senhas/[id] - Obter dados completos de uma senha para exibição e comprovante térmico
// ZERO CPF completo
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;

    const res = await query(
      `SELECT 
        s.id, s.codigo, s.categoria, s.status, s.estado_comercial, s.valor_centavos,
        s.puxador_nome, s.esteira_nome, s.cavalo_nome, s.criado_em, s.atualizado_em,
        v.nome as vaquejada_nome, v.local as vaquejada_local,
        cp.apelido_pista as puxador_apelido,
        ce.apelido_pista as esteira_apelido,
        cav.nome as cavalo_oficial_nome,
        pag.tipo as forma_pagamento, pag.confirmado_em, pag.status as status_pagamento
       FROM senhas s
       LEFT JOIN vaquejadas v ON s.vaquejada_id = v.id
       LEFT JOIN competidores cp ON s.puxador_id = cp.id
       LEFT JOIN competidores ce ON s.esteira_id = ce.id
       LEFT JOIN cavalos cav ON s.cavalo_puxa_id = cav.id
       LEFT JOIN pagamentos pag ON pag.senha_id = s.id AND pag.status = 'CONFIRMADO'
       WHERE s.id = $1 OR s.codigo = $1
       ORDER BY pag.confirmado_em DESC
       LIMIT 1`,
      [id]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Senha não encontrada' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar dados da senha:', error);
    return NextResponse.json({ error: 'Erro ao consultar senha' }, { status: 500 });
  }
}

// DELETE /api/senhas/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(request.url);
  url.searchParams.set('id', id);
  const newReq = new NextRequest(url.toString(), {
    method: 'DELETE',
    headers: request.headers,
  });
  return deleteHandler(newReq);
}

// PUT /api/senhas/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const url = new URL(request.url);
  url.searchParams.set('id', id);
  const newReq = new NextRequest(url.toString(), {
    method: 'PUT',
    headers: request.headers,
    body: JSON.stringify({ ...body, id }),
  });
  return putHandler(newReq);
}

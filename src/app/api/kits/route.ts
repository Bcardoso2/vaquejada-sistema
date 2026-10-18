import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { exigirSessao } from '../../../lib/api-auth';
import { registrarAuditoria } from '../../../lib/audit';

// GET /api/kits - Listar kits (SECRETARIA e ADMIN)
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const vaquejadaId = searchParams.get('vaquejadaId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let queryText = 'SELECT k.*, v.nome as vaquejada_nome FROM kits k JOIN vaquejadas v ON k.vaquejada_id = v.id';
    const params: any[] = [];

    if (vaquejadaId) {
      queryText += ' WHERE k.vaquejada_id = $1';
      params.push(vaquejadaId);
    }

    queryText += ' ORDER BY k.criado_em DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const res = await query(queryText, params);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao listar kits:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/kits - Criar novo kit (SECRETARIA e ADMIN)
export async function POST(request: NextRequest) {
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { vaquejadaId, codigo } = await request.json();

    if (!vaquejadaId || !codigo) {
      return NextResponse.json(
        { error: 'ID da vaquejada e código são obrigatórios' },
        { status: 400 }
      );
    }

    const vaquejadaCheck = await query('SELECT id FROM vaquejadas WHERE id = $1', [vaquejadaId]);
    if (vaquejadaCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vaquejada não encontrada' },
        { status: 404 }
      );
    }

    const res = await query(
      `INSERT INTO kits (vaquejada_id, codigo)
       VALUES ($1, $2)
       RETURNING *`,
      [vaquejadaId, codigo]
    );

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'CRIAR_KIT',
      entidade: 'kits',
      entidadeId: res.rows[0].id,
      detalhes: res.rows[0],
      motivo: 'Cadastro de kit de senhas'
    });

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe um kit com este código.' },
        { status: 409 }
      );
    }
    console.error('Erro ao criar kit:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
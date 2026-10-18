import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { exigirSessao } from '../../../lib/api-auth';
import { registrarAuditoria } from '../../../lib/audit';

// GET /api/oportunidades - Listar oportunidades (ADMIN)
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const vaquejadaId = searchParams.get('vaquejadaId');
    const disponivelOnly = searchParams.get('disponivel') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let queryText = `
      SELECT o.*,
             b.nome as boi_nome,
             b.numero_registro,
             v.codigo as vaquejada_codigo,
             s.codigo as senha_origem_codigo
      FROM oportunidades o
      JOIN bois b ON o.boi_id = b.id
      JOIN vaquejadas v ON o.vaquejada_id = v.id
      LEFT JOIN senhas s ON o.senha_origem_id = s.id
    `;
    const params: any[] = [];

    if (vaquejadaId) {
      queryText += params.length ? ' WHERE o.vaquejada_id = $' + (params.length + 1) : ' WHERE o.vaquejada_id = $' + (params.length + 1);
      params.push(vaquejadaId);
    }

    if (disponivelOnly) {
      queryText += params.length ? ' AND o.disponivel = true' : ' WHERE o.disponivel = true';
    }

    queryText += ' ORDER BY o.criado_em DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const res = await query(queryText, params);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao listar oportunidades:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/oportunidades - Criar nova oportunidade (Exclusivo ADMIN)
export async function POST(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

  try {
    const {
      vaquejadaId,
      boiId,
      senhaOrigemId
    } = await request.json();

    if (!vaquejadaId || !boiId) {
      return NextResponse.json(
        { error: 'ID da vaquejada e ID do boi são obrigatórios' },
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

    const boiCheck = await query('SELECT id FROM bois WHERE id = $1', [boiId]);
    if (boiCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Boi não encontrado' },
        { status: 404 }
      );
    }

    if (senhaOrigemId) {
      const senhaCheck = await query('SELECT id FROM senhas WHERE id = $1', [senhaOrigemId]);
      if (senhaCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Senha de origem não encontrada' },
          { status: 404 }
        );
      }
    }

    const res = await query(
      `INSERT INTO oportunidades (vaquejada_id, boi_id, senha_origem_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [vaquejadaId, boiId, senhaOrigemId]
    );

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'CRIAR_OPORTUNIDADE',
      entidade: 'oportunidades',
      entidadeId: res.rows[0].id,
      detalhes: res.rows[0],
      motivo: 'Criação de oportunidade'
    });

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Erro ao criar oportunidade:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/oportunidades - Atualizar oportunidade (Exclusivo ADMIN)
export async function PUT(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

  try {
    const body = await request.json();
    const id = body.id || request.nextUrl.searchParams.get('id');
    const { disponivel } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da oportunidade é obrigatório' }, { status: 400 });
    }

    const oportunidadeCheck = await query('SELECT id FROM oportunidades WHERE id = $1', [id]);
    if (oportunidadeCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Oportunidade não encontrada' },
        { status: 404 }
      );
    }

    const res = await query(
      `UPDATE oportunidades
       SET disponivel = $1
       WHERE id = $2
       RETURNING *`,
      [disponivel, id]
    );

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'ATUALIZAR_OPORTUNIDADE',
      entidade: 'oportunidades',
      entidadeId: id,
      detalhes: { disponivel },
      motivo: 'Atualização de status de oportunidade'
    });

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar oportunidade:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
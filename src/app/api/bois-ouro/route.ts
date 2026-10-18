import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { exigirSessao } from '../../../lib/api-auth';
import { registrarAuditoria } from '../../../lib/audit';

// GET /api/bois-ouro - Listar bois de ouro (SECRETARIA e ADMIN)
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const vaquejadaId = searchParams.get('vaquejadaId');
    const ativoOnly = searchParams.get('ativo') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let queryText = `
      SELECT bo.*,
             b.nome as boi_nome,
             b.numero_registro,
             v.codigo as vaquejada_codigo,
             u.nome as autorizado_por_nome
      FROM bois_ouro bo
      JOIN bois b ON bo.boi_id = b.id
      JOIN vaquejadas v ON bo.vaquejada_id = v.id
      LEFT JOIN usuarios u ON bo.autorizado_por = u.id
    `;
    const params: any[] = [];

    if (vaquejadaId) {
      queryText += params.length ? ' WHERE bo.vaquejada_id = $' + (params.length + 1) : ' WHERE bo.vaquejada_id = $' + (params.length + 1);
      params.push(vaquejadaId);
    }

    if (ativoOnly) {
      queryText += params.length ? ' AND bo.ativo = true' : ' WHERE bo.ativo = true';
    }

    queryText += ' ORDER BY bo.criado_em DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const res = await query(queryText, params);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao listar bois de ouro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/bois-ouro - Registrar novo boi de ouro (SECRETARIA e ADMIN)
export async function POST(request: NextRequest) {
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const {
      boiId,
      vaquejadaId,
      valor
    } = await request.json();

    if (!boiId || !vaquejadaId || !valor) {
      return NextResponse.json(
        { error: 'ID do boi, ID da vaquejada e valor são obrigatórios' },
        { status: 400 }
      );
    }

    const boiCheck = await query('SELECT id FROM bois WHERE id = $1', [boiId]);
    if (boiCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Boi não encontrado' },
        { status: 404 }
      );
    }

    const vaquejadaCheck = await query('SELECT id FROM vaquejadas WHERE id = $1', [vaquejadaId]);
    if (vaquejadaCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vaquejada não encontrada' },
        { status: 404 }
      );
    }

    const existingCheck = await query(
      'SELECT id FROM bois_ouro WHERE boi_id = $1 AND vaquejada_id = $2',
      [boiId, vaquejadaId]
    );
    if (existingCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'Este boi já está registrado como boi de ouro nesta vaquejada' },
        { status: 409 }
      );
    }

    const res = await query(
      `INSERT INTO bois_ouro (boi_id, vaquejada_id, valor)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [boiId, vaquejadaId, valor]
    );

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'CRIAR_BOI_OURO',
      entidade: 'bois_ouro',
      entidadeId: res.rows[0].id,
      detalhes: res.rows[0],
      motivo: 'Registro de novo boi de ouro'
    });

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Erro ao registrar boi de ouro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/bois-ouro - Confirmar pagamento ou autorizar boi de ouro (SECRETARIA e ADMIN)
export async function PUT(request: NextRequest) {
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id || request.nextUrl.searchParams.get('id');
    const acao = body.acao || (request.nextUrl.searchParams.get('acao') || 'PAGAR');

    if (!id) {
      return NextResponse.json({ error: 'ID do boi de ouro é obrigatório' }, { status: 400 });
    }

    const boiOuROCheck = await query('SELECT * FROM bois_ouro WHERE id = $1', [id]);
    if (boiOuROCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Boi de ouro não encontrado' },
        { status: 404 }
      );
    }

    const boiOuRO = boiOuROCheck.rows[0];

    if (acao === 'AUTORIZAR') {
      if (!boiOuRO.pago) {
        return NextResponse.json(
          { error: 'Não é possível autorizar boi de ouro sem pagamento confirmado' },
          { status: 400 }
        );
      }

      const res = await query(
        `UPDATE bois_ouro
         SET ativo = true, autorizado_por = $1, autorizado_em = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [auth.session.id, id]
      );

      await registrarAuditoria({
        usuarioId: auth.session.id,
        usuarioNome: auth.session.nome,
        papel: auth.session.papel,
        acao: 'AUTORIZAR_BOI_OURO',
        entidade: 'bois_ouro',
        entidadeId: id,
        motivo: 'Autorização de boi de ouro'
      });

      return NextResponse.json(res.rows[0]);
    } else {
      // PAGAR
      const res = await query(
        `UPDATE bois_ouro
         SET pago = true, pagamento_confirmado_em = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      await registrarAuditoria({
        usuarioId: auth.session.id,
        usuarioNome: auth.session.nome,
        papel: auth.session.papel,
        acao: 'PAGAR_BOI_OURO',
        entidade: 'bois_ouro',
        entidadeId: id,
        motivo: 'Pagamento de boi de ouro'
      });

      return NextResponse.json(res.rows[0]);
    }
  } catch (error) {
    console.error('Erro ao atualizar boi de ouro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
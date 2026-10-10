import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { validateRolePermission } from '../../../lib/api-auth';

// GET /api/oportunidades - Listar oportunidades (opcionalmente filtrado por vaquejada)
export async function GET(request: NextRequest) {
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

// POST /api/oportunidades - Criar nova oportunidade
export async function POST(request: NextRequest) {
  try {
    // Verificar autorização (apenas ADMIN e SECRETARIO podem criar oportunidades)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as any;

    const permissionCheck = validateRolePermission(userRole, ['ADMIN', 'SECRETARIO']);
    if (!permissionCheck.isAuthorized) {
      return permissionCheck.response;
    }

    const {
      vaquejadaId,
      boiId,
      senhaOrigemId
    } = await request.json();

    // Validações básicas
    if (!vaquejadaId || !boiId) {
      return NextResponse.json(
        { error: 'ID da vaquejada e ID do boi são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a vaquejada existe
    const vaquejadaCheck = await query('SELECT id FROM vaquejadas WHERE id = $1', [vaquejadaId]);
    if (vaquejadaCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vaquejada não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o boi existe
    const boiCheck = await query('SELECT id FROM bois WHERE id = $1', [boiId]);
    if (boiCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Boi não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se a senha de origem existe (se fornecida)
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

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Erro ao criar oportunidade:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/oportunidades - Atualizar oportunidade (marcar como indisponível quando usada)
export async function PUT(request: NextRequest) {
  try {
    // Verificar autorização (apenas ADMIN e SECRETARIO podem atualizar oportunidades)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as any;

    const permissionCheck = validateRolePermission(userRole, ['ADMIN', 'SECRETARIO']);
    if (!permissionCheck.isAuthorized) {
      return permissionCheck.response;
    }

    const body = await request.json();
    const id = body.id || request.nextUrl.searchParams.get('id');
    const { disponivel } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da oportunidade é obrigatório' }, { status: 400 });
    }

    // Verificar se a oportunidade existe
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

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar oportunidade:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função interna: Gerar oportunidade a partir de uma senha usada
async function processarGerarDeSenha(request: NextRequest) {
  try {
    // Verificar autorização (apenas ADMIN e SECRETARIO podem gerar oportunidades)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as any;

    const permissionCheck = validateRolePermission(userRole, ['ADMIN', 'SECRETARIO']);
    if (!permissionCheck.isAuthorized) {
      return permissionCheck.response;
    }

    const { senhaId, novoBoiId } = await request.json();

    // Validações básicas
    if (!senhaId || !novoBoiId) {
      return NextResponse.json(
        { error: 'ID da senha e ID do novo boi são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a senha existe e está usada
    const senhaCheck = await query(
      `SELECT s.*, k.vaquejada_id
       FROM senhas s
       JOIN kits k ON s.kit_id = k.id
       WHERE s.id = $1 AND s.status = 'USADA'`,
      [senhaId]
    );
    if (senhaCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Senha não encontrada ou ainda não usada' },
        { status: 404 }
      );
    }

    const senha = senhaCheck.rows[0];

    // Verificar se o novo boi existe
    const boiCheck = await query('SELECT id FROM bois WHERE id = $1', [novoBoiId]);
    if (boiCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Boi não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já existe uma oportunidade gerada desta senha
    const existingOportunidade = await query(
      'SELECT id FROM oportunidades WHERE senha_origem_id = $1',
      [senhaId]
    );
    if (existingOportunidade.rows.length > 0) {
      return NextResponse.json(
        { error: 'Já existe uma oportunidade gerada para esta senha' },
        { status: 409 }
      );
    }

    // Criar a oportunidade
    const res = await query(
      `INSERT INTO oportunidades (vaquejada_id, boi_id, senha_origem_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [senha.vaquejada_id, novoBoiId, senhaId]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Erro ao gerar oportunidade a partir de senha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
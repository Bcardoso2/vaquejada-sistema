import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { validateRolePermission } from '../../../lib/api-auth';

// GET /api/bois - Listar bois
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let queryText = 'SELECT * FROM bois';
    const params: any[] = [];

    if (categoria) {
      queryText += ' WHERE categoria = $1';
      params.push(categoria);
    }

    queryText += ' ORDER BY nome LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const res = await query(queryText, params);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao listar bois:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/bois - Criar novo boi
export async function POST(request: NextRequest) {
  try {
    // Verificar autorização (apenas ADMIN e SECRETARIO podem criar bois)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as any;

    const permissionCheck = validateRolePermission(userRole, ['ADMIN', 'SECRETARIO']);
    if (!permissionCheck.isAuthorized) {
      return permissionCheck.response;
    }

    const {
      numeroRegistro,
      nome,
      categoria,
      pesoKg,
      cor,
      observacoes
    } = await request.json();

    // Validações básicas
    if (!numeroRegistro || !nome) {
      return NextResponse.json(
        { error: 'Numero de registro e nome são obrigatórios' },
        { status: 400 }
      );
    }

    const res = await query(
      `INSERT INTO bois (
         numero_registro, nome, categoria, peso_kg, cor, observacoes
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [numeroRegistro, nome, categoria, pesoKg, cor, observacoes]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Erro ao criar boi:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/bois - Atualizar boi
export async function PUT(request: NextRequest) {
  try {
    // Verificar autorização (apenas ADMIN e SECRETARIO podem atualizar bois)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as any;

    const permissionCheck = validateRolePermission(userRole, ['ADMIN', 'SECRETARIO']);
    if (!permissionCheck.isAuthorized) {
      return permissionCheck.response;
    }

    const body = await request.json();
    const id = body.id || request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do boi é obrigatório' }, { status: 400 });
    }

    const {
      numeroRegistro,
      nome,
      categoria,
      pesoKg,
      cor,
      observacoes
    } = body;

    // Verificar se o boi existe
    const boiCheck = await query('SELECT id FROM bois WHERE id = $1', [id]);
    if (boiCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Boi não encontrado' },
        { status: 404 }
      );
    }

    const res = await query(
      `UPDATE bois
       SET numero_registro = $1, nome = $2, categoria = $3, peso_kg = $4, cor = $5, observacoes = $6, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [numeroRegistro, nome, categoria, pesoKg, cor, observacoes, id]
    );

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar boi:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
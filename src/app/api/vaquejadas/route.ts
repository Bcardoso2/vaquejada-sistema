import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { validateRolePermission } from '../../../lib/api-auth';

// GET /api/vaquejadas - Listar vaquejadas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let queryText = 'SELECT * FROM vaquejadas';
    const params: any[] = [];

    if (status) {
      queryText += ' WHERE status = $1';
      params.push(status);
    }

    queryText += ' ORDER BY data_inicio DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const res = await query(queryText, params);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao listar vaquejadas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/vaquejadas - Criar nova vaquejada
export async function POST(request: NextRequest) {
  try {
    // Verificar autorização (apenas ADMIN e SECRETARIO podem criar vaquejadas)
    // Em um cenário real, obteríamos o usuário do token JWT ou sessão
    // Por agora, vamos assumir que o header contém o userId para simplificação
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as any;

    const permissionCheck = validateRolePermission(userRole, ['ADMIN', 'SECRETARIO']);
    if (!permissionCheck.isAuthorized) {
      return permissionCheck.response;
    }

    const {
      codigo,
      nome,
      data_inicio,
      data_fim,
      local
    } = await request.json();

    // Validações básicas
    if (!codigo || !nome || !data_inicio || !data_fim) {
      return NextResponse.json(
        { error: 'Código, nome, data de início e data de fim são obrigatórios' },
        { status: 400 }
      );
    }

    const res = await query(
      `INSERT INTO vaquejadas (codigo, nome, data_inicio, data_fim, local)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [codigo, nome, data_inicio, data_fim, local]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Erro ao criar vaquejada:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { validateRolePermission } from '../../../lib/api-auth';

// GET /api/kits - Listar kits (opcionalmente filtrado por vaquejada)
export async function GET(request: NextRequest) {
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

// POST /api/kits - Criar novo kit
export async function POST(request: NextRequest) {
  try {
    // Verificar autorização (apenas ADMIN e SECRETARIO podem criar kits)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as any;

    const permissionCheck = validateRolePermission(userRole, ['ADMIN', 'SECRETARIO']);
    if (!permissionCheck.isAuthorized) {
      return permissionCheck.response;
    }

    const { vaquejadaId, codigo } = await request.json();

    // Validações básicas
    if (!vaquejadaId || !codigo) {
      return NextResponse.json(
        { error: 'ID da vaquejada e código são obrigatórios' },
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

    const res = await query(
      `INSERT INTO kits (vaquejada_id, codigo)
       VALUES ($1, $2)
       RETURNING *`,
      [vaquejadaId, codigo]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Erro ao criar kit:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
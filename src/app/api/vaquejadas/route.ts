import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { exigirSessao } from '../../../lib/api-auth';
import { registrarAuditoria } from '../../../lib/audit';

// GET /api/vaquejadas - Listar vaquejadas (ADMIN)
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

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

// POST /api/vaquejadas - Criar nova vaquejada (Exclusivo ADMIN)
export async function POST(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

  try {
    const {
      codigo,
      nome,
      data_inicio,
      data_fim,
      local,
      permitir_dupla_multiplas_senhas = true,
    } = await request.json();

    if (!codigo || !nome || !data_inicio || !data_fim) {
      return NextResponse.json(
        { error: 'Código, nome, data de início e data de fim são obrigatórios' },
        { status: 400 }
      );
    }

    const res = await query(
      `INSERT INTO vaquejadas (id, codigo, nome, data_inicio, data_fim, local, permitir_dupla_multiplas_senhas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [`vq-${codigo.toLowerCase().trim()}`, codigo.toUpperCase().trim(), nome.trim(), data_inicio, data_fim, local, permitir_dupla_multiplas_senhas]
    );

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'CRIAR_VAQUEJADA',
      entidade: 'vaquejadas',
      entidadeId: res.rows[0].id,
      detalhes: res.rows[0],
      motivo: 'Cadastro de novo evento de vaquejada'
    });

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe uma vaquejada cadastrada com este código.' },
        { status: 409 }
      );
    }
    console.error('Erro ao criar vaquejada:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
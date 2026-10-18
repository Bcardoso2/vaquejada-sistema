import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { registrarAuditoria } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/oportunidades/[id] - Atualiza dados da oportunidade
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const vaquejadaId = String(body.vaquejada_id || body.vaquejadaId || '').trim();
    const boiId = String(body.boi_id || body.boiId || '').trim();
    const senhaOrigemId = body.senha_origem_id || body.senhaOrigemId || null;
    const disponivel = body.disponivel !== undefined ? Boolean(body.disponivel) : true;

    if (!id) {
      return NextResponse.json({ error: 'Identificador da oportunidade é obrigatório.' }, { status: 400 });
    }
    if (!vaquejadaId || !boiId) {
      return NextResponse.json(
        { error: 'Identificador da vaquejada e do boi são obrigatórios.' },
        { status: 400 }
      );
    }

    const check = await query('SELECT * FROM oportunidades WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      return NextResponse.json({ error: 'Oportunidade não encontrada.' }, { status: 404 });
    }

    const res = await query(
      `UPDATE oportunidades
       SET vaquejada_id = $1, boi_id = $2, senha_origem_id = $3, disponivel = $4
       WHERE id = $5
       RETURNING *`,
      [vaquejadaId, boiId, senhaOrigemId, disponivel, id]
    );

    await registrarAuditoria({
      usuarioNome: 'Gestor de Pista',
      papel: 'OPERADOR',
      acao: 'ATUALIZAR_OPORTUNIDADE',
      entidade: 'oportunidades',
      entidadeId: id,
      detalhes: { vaquejadaId, boiId, disponivel },
      motivo: 'Atualização de oportunidade de corrida'
    });

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar oportunidade:', error);
    return NextResponse.json({ error: 'Falha interna ao atualizar oportunidade.' }, { status: 500 });
  }
}

// DELETE /api/oportunidades/[id] - Exclui oportunidade
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Identificador da oportunidade é obrigatório.' }, { status: 400 });
    }

    const check = await query('SELECT id FROM oportunidades WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      return NextResponse.json({ error: 'Oportunidade não encontrada.' }, { status: 404 });
    }

    await query('DELETE FROM oportunidades WHERE id = $1', [id]);

    await registrarAuditoria({
      usuarioNome: 'Gestor de Pista',
      papel: 'OPERADOR',
      acao: 'EXCLUIR_OPORTUNIDADE',
      entidade: 'oportunidades',
      entidadeId: id,
      motivo: 'Exclusão de oportunidade'
    });

    return NextResponse.json({ success: true, message: 'Oportunidade excluída com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir oportunidade:', error);
    return NextResponse.json({ error: 'Falha interna ao excluir oportunidade.' }, { status: 500 });
  }
}

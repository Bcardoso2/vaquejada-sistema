import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { registrarAuditoria } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/vaquejadas/[id] - Atualiza evento
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const codigo = String(body.codigo || '').trim();
    const nome = String(body.nome || '').trim();
    const dataInicio = body.data_inicio || body.dataInicio;
    const dataFim = body.data_fim || body.dataFim;
    const local = body.local ? String(body.local).trim() : null;
    const status = String(body.status || 'AGENDADA').trim();

    if (!id) {
      return NextResponse.json({ error: 'Identificador do evento é obrigatório.' }, { status: 400 });
    }
    if (!codigo || !nome || !dataInicio || !dataFim) {
      return NextResponse.json(
        { error: 'Código, nome, data de início e data de fim são obrigatórios.' },
        { status: 400 }
      );
    }

    const check = await query('SELECT * FROM vaquejadas WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      return NextResponse.json({ error: 'Vaquejada não encontrada.' }, { status: 404 });
    }

    const res = await query(
      `UPDATE vaquejadas
       SET codigo = $1, nome = $2, data_inicio = $3, data_fim = $4, local = $5, status = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [codigo, nome, dataInicio, dataFim, local, status, id]
    );

    await registrarAuditoria({
      usuarioNome: 'Gestor Geral',
      papel: 'ADMIN',
      acao: 'ATUALIZAR_VAQUEJADA',
      entidade: 'vaquejadas',
      entidadeId: id,
      detalhes: { codigo, nome, status },
      motivo: 'Atualização dos dados do evento'
    });

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe outro evento cadastrado com este código.' },
        { status: 409 }
      );
    }
    console.error('Erro ao atualizar vaquejada:', error);
    return NextResponse.json({ error: 'Falha interna ao atualizar evento.' }, { status: 500 });
  }
}

// DELETE /api/vaquejadas/[id] - Exclui evento
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Identificador do evento é obrigatório.' }, { status: 400 });
    }

    const check = await query('SELECT id, nome, codigo FROM vaquejadas WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      return NextResponse.json({ error: 'Vaquejada não encontrada.' }, { status: 404 });
    }

    // Verificar se já possui senhas ou corridas cadastradas
    const senhasCheck = await query('SELECT id FROM senhas WHERE vaquejada_id = $1 LIMIT 1', [id]);
    if (senhasCheck.rowCount && senhasCheck.rowCount > 0) {
      return NextResponse.json(
        { error: 'Este evento não pode ser excluído pois já possui senhas registradas.' },
        { status: 409 }
      );
    }

    await query('DELETE FROM vaquejadas WHERE id = $1', [id]);

    await registrarAuditoria({
      usuarioNome: 'Gestor Geral',
      papel: 'ADMIN',
      acao: 'EXCLUIR_VAQUEJADA',
      entidade: 'vaquejadas',
      entidadeId: id,
      detalhes: check.rows[0],
      motivo: 'Exclusão de evento'
    });

    return NextResponse.json({ success: true, message: 'Evento excluído com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir vaquejada:', error);
    return NextResponse.json({ error: 'Falha interna ao excluir evento.' }, { status: 500 });
  }
}

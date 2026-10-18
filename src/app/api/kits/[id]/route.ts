import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/kits/[id] - Atualiza dados do kit (SECRETARIA e ADMIN)
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();

    const codigo = String(body.codigo || '').trim();
    const vaquejadaId = String(body.vaquejada_id || body.vaquejadaId || '').trim();

    if (!id) {
      return NextResponse.json({ error: 'Identificador do kit é obrigatório.' }, { status: 400 });
    }
    if (!codigo || !vaquejadaId) {
      return NextResponse.json(
        { error: 'Código e identificador da vaquejada são obrigatórios.' },
        { status: 400 }
      );
    }

    const check = await query('SELECT * FROM kits WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      return NextResponse.json({ error: 'Kit não encontrado.' }, { status: 404 });
    }

    const res = await query(
      `UPDATE kits
       SET codigo = $1, vaquejada_id = $2
       WHERE id = $3
       RETURNING *`,
      [codigo, vaquejadaId, id]
    );

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'ATUALIZAR_KIT',
      entidade: 'kits',
      entidadeId: id,
      detalhes: { codigo, vaquejadaId },
      motivo: 'Atualização cadastral do kit'
    });

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe outro kit cadastrado com este código.' },
        { status: 409 }
      );
    }
    console.error('Erro ao atualizar kit:', error);
    return NextResponse.json({ error: 'Falha interna ao atualizar kit.' }, { status: 500 });
  }
}

// DELETE /api/kits/[id] - Exclui kit (SECRETARIA e ADMIN)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Identificador do kit é obrigatório.' }, { status: 400 });
    }

    const check = await query('SELECT id, codigo FROM kits WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      return NextResponse.json({ error: 'Kit não encontrado.' }, { status: 404 });
    }

    // Verificar se kit possui senhas vendidas ou pagas
    const senhasPagas = await query(
      `SELECT id FROM senhas WHERE kit_id = $1 AND estado_comercial = 'PAGA' LIMIT 1`,
      [id]
    );
    if (senhasPagas.rowCount && senhasPagas.rowCount > 0) {
      return NextResponse.json(
        { error: 'Este kit não pode ser excluído pois possui senhas pagas associadas.' },
        { status: 409 }
      );
    }

    await query('DELETE FROM kits WHERE id = $1', [id]);

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'EXCLUIR_KIT',
      entidade: 'kits',
      entidadeId: id,
      detalhes: check.rows[0],
      motivo: 'Exclusão de kit de senhas'
    });

    return NextResponse.json({ success: true, message: 'Kit excluído com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir kit:', error);
    return NextResponse.json({ error: 'Falha interna ao excluir kit.' }, { status: 500 });
  }
}

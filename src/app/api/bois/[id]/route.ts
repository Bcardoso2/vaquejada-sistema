import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateRolePermission } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/bois/[id] - Atualiza dados do boi
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const numeroRegistro = String(body.numero_registro || body.numeroRegistro || '').trim();
    const nome = String(body.nome || '').trim();
    const categoria = body.categoria ? String(body.categoria).trim() : null;
    const pesoKg = body.peso_kg !== undefined ? Number(body.peso_kg) : (body.pesoKg !== undefined ? Number(body.pesoKg) : null);
    const cor = body.cor ? String(body.cor).trim() : null;
    const observacoes = body.observacoes ? String(body.observacoes).trim() : null;

    if (!id) {
      return NextResponse.json({ error: 'Identificador do boi é obrigatório.' }, { status: 400 });
    }
    if (!numeroRegistro || !nome) {
      return NextResponse.json({ error: 'Número de registro e nome são obrigatórios.' }, { status: 400 });
    }

    const check = await query('SELECT * FROM bois WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      return NextResponse.json({ error: 'Boi não encontrado.' }, { status: 404 });
    }

    const res = await query(
      `UPDATE bois
       SET numero_registro = $1, nome = $2, categoria = $3, peso_kg = $4, cor = $5, observacoes = $6, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [numeroRegistro, nome, categoria, pesoKg, cor, observacoes, id]
    );

    await registrarAuditoria({
      usuarioNome: 'Gestor da Boiada',
      papel: 'ADMIN',
      acao: 'ATUALIZAR_BOI',
      entidade: 'bois',
      entidadeId: id,
      detalhes: { numeroRegistro, nome, categoria, pesoKg },
      motivo: 'Atualização de cadastro de animal'
    });

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe outro boi cadastrado com este número de registro.' },
        { status: 409 }
      );
    }
    console.error('Erro ao atualizar boi:', error);
    return NextResponse.json({ error: 'Falha interna ao atualizar boi.' }, { status: 500 });
  }
}

// DELETE /api/bois/[id] - Exclui boi
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Identificador do boi é obrigatório.' }, { status: 400 });
    }

    const check = await query('SELECT id, nome, numero_registro FROM bois WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      return NextResponse.json({ error: 'Boi não encontrado.' }, { status: 404 });
    }

    // Verificar se boi já foi usado em corridas ou senhas
    const corridasCheck = await query('SELECT id FROM corridas_mapa WHERE boi_id = $1 LIMIT 1', [id]);
    if (corridasCheck.rowCount && corridasCheck.rowCount > 0) {
      return NextResponse.json(
        { error: 'Este boi não pode ser excluído pois já possui corridas vinculadas na pista.' },
        { status: 409 }
      );
    }

    await query('DELETE FROM bois WHERE id = $1', [id]);

    await registrarAuditoria({
      usuarioNome: 'Gestor da Boiada',
      papel: 'ADMIN',
      acao: 'EXCLUIR_BOI',
      entidade: 'bois',
      entidadeId: id,
      detalhes: check.rows[0],
      motivo: 'Exclusão de cadastro de animal'
    });

    return NextResponse.json({ success: true, message: 'Boi excluído com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir boi:', error);
    return NextResponse.json({ error: 'Falha interna ao excluir boi.' }, { status: 500 });
  }
}

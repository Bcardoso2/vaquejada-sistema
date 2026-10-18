import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashSenha } from '@/lib/auth';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/usuarios/[id] - Editar usuário, alterar perfil, senha ou status
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { nome, email, papel, ativo, novaSenha } = body;

    const userRes = await query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    const usuarioAtual = userRes.rows[0];

    // Impedir que o admin logado remova seu próprio perfil ADMIN ou desative a si próprio
    if (usuarioAtual.id === auth.session.id) {
      if (papel && papel !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Você não pode revogar seu próprio perfil de administrador.' },
          { status: 400 }
        );
      }
      if (ativo === false) {
        return NextResponse.json(
          { error: 'Você não pode desativar seu próprio usuário logado.' },
          { status: 400 }
        );
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (nome) {
      updates.push(`nome = $${paramIndex++}`);
      values.push(nome.trim());
    }

    if (email) {
      const emailLimpo = email.toLowerCase().trim();
      const checkEmail = await query(
        'SELECT id FROM usuarios WHERE LOWER(email) = $1 AND id != $2',
        [emailLimpo, id]
      );
      if (checkEmail.rowCount && checkEmail.rowCount > 0) {
        return NextResponse.json({ error: 'Este e-mail já está em uso por outro usuário.' }, { status: 409 });
      }
      updates.push(`email = $${paramIndex++}`);
      values.push(emailLimpo);
    }

    if (papel) {
      const papeisValidos = ['ADMIN', 'JUIZ', 'SECRETARIA', 'OPERADOR_PISTA'];
      if (!papeisValidos.includes(papel)) {
        return NextResponse.json({ error: 'Papel inválido' }, { status: 400 });
      }
      updates.push(`papel = $${paramIndex++}`);
      values.push(papel);
    }

    if (typeof ativo === 'boolean') {
      updates.push(`ativo = $${paramIndex++}`);
      values.push(ativo);
    }

    if (novaSenha && novaSenha.trim().length >= 6) {
      const novaHash = await hashSenha(novaSenha);
      updates.push(`senha_hash = $${paramIndex++}`);
      values.push(novaHash);
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'Nenhuma alteração informada' });
    }

    updates.push(`atualizado_em = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `
      UPDATE usuarios 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING id, nome, email, papel, ativo, atualizado_em
    `;

    const updatedUser = await query(updateQuery, values);

    await registrarAuditoria({
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'ATUALIZAR_USUARIO',
      entidade: 'usuarios',
      entidadeId: id,
      detalhes: {
        alteracoes: body,
        senhaAlterada: !!novaSenha,
      },
      motivo: `Atualização de usuário pelo administrador ${auth.session.nome}`,
    });

    return NextResponse.json({
      success: true,
      usuario: updatedUser.rows[0],
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar usuário' }, { status: 500 });
  }
}

// DELETE /api/usuarios/[id] - Desativar usuário (soft delete para integridade de logs)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;

    if (id === auth.session.id) {
      return NextResponse.json(
        { error: 'Você não pode desativar sua própria conta de administrador.' },
        { status: 400 }
      );
    }

    const res = await query(
      `UPDATE usuarios 
       SET ativo = false, atualizado_em = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, nome, email, papel, ativo`,
      [id]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    await registrarAuditoria({
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'DESATIVAR_USUARIO',
      entidade: 'usuarios',
      entidadeId: id,
      detalhes: { usuarioDesativado: res.rows[0] },
      motivo: `Desativação de acesso pelo administrador ${auth.session.nome}`,
    });

    return NextResponse.json({
      success: true,
      message: `Usuário ${res.rows[0].nome} desativado com sucesso.`,
    });
  } catch (error) {
    console.error('Erro ao desativar usuário:', error);
    return NextResponse.json({ error: 'Erro ao desativar usuário' }, { status: 500 });
  }
}

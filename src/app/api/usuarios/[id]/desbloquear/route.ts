import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { desbloquearUsuario } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/usuarios/[id]/desbloquear
 * Permite que um ADMIN desbloqueie imediatamente um usuário que teve tentativas de login bloqueadas
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;

    const userRes = await query('SELECT id, nome, email, papel FROM usuarios WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const usuario = userRes.rows[0];

    // Limpar os bloqueios de login para este e-mail
    await desbloquearUsuario(usuario.email);

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'DESBLOQUEAR_LOGIN_USUARIO',
      entidade: 'usuarios',
      entidadeId: id,
      detalhes: { email: usuario.email, nome: usuario.nome },
      motivo: `Desbloqueio de tentativas de login efetuado pelo administrador ${auth.session.nome}`,
    });

    return NextResponse.json({
      success: true,
      message: `Bloqueios de login para o usuário "${usuario.nome}" (${usuario.email}) foram removidos com sucesso.`,
    });
  } catch (error) {
    console.error('Erro ao desbloquear usuário:', error);
    return NextResponse.json({ error: 'Erro ao desbloquear usuário' }, { status: 500 });
  }
}

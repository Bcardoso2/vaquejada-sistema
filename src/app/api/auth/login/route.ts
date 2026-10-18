import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { 
  verificarSenha, 
  criarTokenSessao, 
  verificarTentativasLogin, 
  registrarFalhaLogin, 
  limparTentativasLogin,
  COOKIE_NAME,
  UserRole
} from '@/lib/auth';
import { registrarAuditoria } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, senha } = body;

    if (!email || !senha) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const emailLimpo = email.toLowerCase().trim();

    // 1. Verificar Rate Limiting / Bloqueio de tentativas
    const rateLimit = await verificarTentativasLogin(emailLimpo);
    if (!rateLimit.permitido) {
      return NextResponse.json(
        {
          error: `Muitas tentativas incorretas. Conta temporariamente bloqueada por segurança. Tente novamente em ${rateLimit.tempoRestanteSegundos || 900} segundos.`,
        },
        { status: 429 }
      );
    }

    // 2. Buscar usuário no banco
    const userRes = await query(
      `SELECT id, nome, email, senha_hash, papel, ativo 
       FROM usuarios 
       WHERE LOWER(email) = $1`,
      [emailLimpo]
    );

    if (userRes.rowCount === 0) {
      await registrarFalhaLogin(emailLimpo);
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    const usuario = userRes.rows[0];

    if (!usuario.ativo) {
      return NextResponse.json(
        { error: 'Esta conta de usuário foi desativada pelo administrador.' },
        { status: 403 }
      );
    }

    // 3. Verificar senha com bcrypt
    const senhaValida = await verificarSenha(senha, usuario.senha_hash);
    if (!senhaValida) {
      await registrarFalhaLogin(emailLimpo);
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    // 4. Limpar contador de tentativas
    await limparTentativasLogin(emailLimpo);

    // 5. Criar token JWT
    const token = await criarTokenSessao({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel as UserRole,
    });

    // 6. Registrar Auditoria do Login
    await registrarAuditoria({
      usuarioNome: usuario.nome,
      papel: usuario.papel,
      acao: 'LOGIN_SUCESSO',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      detalhes: { email: usuario.email, papel: usuario.papel },
      motivo: 'Acesso autenticado ao sistema',
    });

    // 7. Retornar resposta com Cookie httpOnly + secure + sameSite
    const response = NextResponse.json({
      success: true,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
      },
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 horas
    });

    return response;
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar autenticação' },
      { status: 500 }
    );
  }
}

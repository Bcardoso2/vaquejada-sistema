import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { 
  obterSessaoDoRequest, 
  verificarSenha, 
  hashSenha, 
  criarTokenSessao, 
  isCookieSecure, 
  COOKIE_NAME 
} from '@/lib/auth';
import { registrarAuditoria } from '@/lib/audit';

// POST /api/auth/trocar-senha - Troca de senha obrigatória ou voluntária
// Exige senha com no mínimo 10 caracteres e validação da senha anterior
export async function POST(request: NextRequest) {
  try {
    const session = await obterSessaoDoRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada. Faça login novamente.' }, { status: 401 });
    }

    const body = await request.json();
    const { senhaAtual, novaSenha, confirmacaoNovaSenha } = body;

    if (!senhaAtual || !novaSenha || !confirmacaoNovaSenha) {
      return NextResponse.json(
        { error: 'Senha atual, nova senha e confirmação são campos obrigatórios.' },
        { status: 400 }
      );
    }

    // 1. Validação de tamanho mínimo de 10 caracteres
    if (novaSenha.length < 10) {
      return NextResponse.json(
        { error: 'A nova senha deve conter no mínimo 10 caracteres para garantir a segurança da conta.' },
        { status: 400 }
      );
    }

    // 2. Validação de confirmação
    if (novaSenha !== confirmacaoNovaSenha) {
      return NextResponse.json(
        { error: 'A nova senha e a confirmação não coincidem.' },
        { status: 400 }
      );
    }

    // 3. Validação de complexidade (ao menos 1 número e 1 letra)
    const temLetra = /[a-zA-Z]/.test(novaSenha);
    const temNumero = /[0-9]/.test(novaSenha);
    if (!temLetra || !temNumero) {
      return NextResponse.json(
        { error: 'A nova senha deve conter ao menos uma letra e um número.' },
        { status: 400 }
      );
    }

    // 4. Buscar usuário e hash atual no banco
    const userRes = await query('SELECT id, email, senha_hash, papel FROM usuarios WHERE id = $1', [session.id]);
    if (userRes.rowCount === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const usuario = userRes.rows[0];

    // 5. Validar senha atual
    const senhaAtualValida = await verificarSenha(senhaAtual, usuario.senha_hash);
    if (!senhaAtualValida) {
      return NextResponse.json(
        { error: 'A senha atual informada está incorreta.' },
        { status: 401 }
      );
    }

    // 6. Evitar que a nova senha seja idêntica à anterior
    const senhaIgualAnterior = await verificarSenha(novaSenha, usuario.senha_hash);
    if (senhaIgualAnterior) {
      return NextResponse.json(
        { error: 'A nova senha não pode ser idêntica à senha atual.' },
        { status: 400 }
      );
    }

    // 7. Gerar novo hash e atualizar no banco removendo a flag deve_trocar_senha
    const novoHash = await hashSenha(novaSenha);
    await query(
      `UPDATE usuarios 
       SET senha_hash = $1, deve_trocar_senha = FALSE 
       WHERE id = $2`,
      [novoHash, usuario.id]
    );

    // 8. Registrar auditoria
    await registrarAuditoria({
      usuarioId: usuario.id,
      usuarioNome: session.nome,
      papel: usuario.papel,
      acao: 'TROCA_SENHA_USUARIO',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      detalhes: { email: usuario.email },
      motivo: 'Troca de senha realizada com sucesso (requisito de segurança mínimo 10 caracteres)',
    });

    // 9. Gerar novo token de sessão atualizado (com deveTrocarSenha = false)
    const novoToken = await criarTokenSessao({
      id: usuario.id,
      nome: session.nome,
      email: usuario.email,
      papel: usuario.papel,
      deveTrocarSenha: false,
    });

    const response = NextResponse.json({
      success: true,
      mensagem: 'Senha alterada com sucesso! Você já pode utilizar o sistema com sua nova credencial.',
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: novoToken,
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Erro na troca de senha:', error);
    return NextResponse.json({ error: 'Erro interno ao processar troca de senha.' }, { status: 500 });
  }
}

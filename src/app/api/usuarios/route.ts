import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashSenha } from '@/lib/auth';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';
import crypto from 'crypto';

// GET /api/usuarios - Listar todos os usuários (Exclusivo ADMIN)
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

  try {
    const res = await query(
      `SELECT id, nome, email, papel, ativo, criado_em, atualizado_em 
       FROM usuarios 
       ORDER BY criado_em DESC`
    );
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
  }
}

// POST /api/usuarios - Criar novo usuário (Exclusivo ADMIN)
export async function POST(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN']);
  if (!auth.autorizado) return auth.response;

  try {
    const body = await request.json();
    const { nome, email, senha, papel = 'SECRETARIA', ativo = true } = body;

    if (!nome || !email || !senha) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (senha.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve conter no mínimo 6 caracteres' },
        { status: 400 }
      );
    }

    const papeisValidos = ['ADMIN', 'JUIZ', 'SECRETARIA', 'OPERADOR_PISTA'];
    if (!papeisValidos.includes(papel)) {
      return NextResponse.json(
        { error: `Papel inválido. Deve ser um dos seguintes: ${papeisValidos.join(', ')}` },
        { status: 400 }
      );
    }

    const emailLimpo = email.toLowerCase().trim();

    // Checar duplicidade de email
    const emailExistente = await query(
      'SELECT id FROM usuarios WHERE LOWER(email) = $1',
      [emailLimpo]
    );

    if (emailExistente.rowCount && emailExistente.rowCount > 0) {
      return NextResponse.json(
        { error: `Já existe um usuário cadastrado com o e-mail "${emailLimpo}".` },
        { status: 409 }
      );
    }

    const senhaHash = await hashSenha(senha);
    const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;

    await query(
      `INSERT INTO usuarios (id, nome, email, senha_hash, papel, ativo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, nome.trim(), emailLimpo, senhaHash, papel, ativo]
    );

    await registrarAuditoria({
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'CRIAR_USUARIO',
      entidade: 'usuarios',
      entidadeId: userId,
      detalhes: { nome, email: emailLimpo, papel, ativo },
      motivo: `Usuário criado pelo administrador ${auth.session.nome}`,
    });

    return NextResponse.json(
      {
        success: true,
        usuario: { id: userId, nome, email: emailLimpo, papel, ativo },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json({ error: 'Erro ao cadastrar usuário' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { obterSessaoDoRequest, UserRole, UserSession } from './auth';
import { query } from './db';

export type { UserRole, UserSession };

/**
 * Matriz de Permissões Canônica do Sistema:
 * - ADMIN: Acesso irrestrito a todas as rotas e operações.
 * - SECRETARIA: Senhas (venda, listagem, cancelamento), Kits, Financeiro/Caixa.
 * - OPERADOR_PISTA: Apenas /mapa, chamar boi, iniciar corrida, resultado da pista.
 * - JUIZ: Apenas /juiz e Boi de TV (decisões e contestações).
 */
export const MATRIZ_PERMISSOES = {
  SECRETARIA: ['ADMIN', 'SECRETARIA'] as UserRole[],
  OPERADOR_PISTA: ['ADMIN', 'OPERADOR_PISTA'] as UserRole[],
  JUIZ: ['ADMIN', 'JUIZ'] as UserRole[],
  ADMIN_SOMENTE: ['ADMIN'] as UserRole[],
  QUALQUER_AUTENTICADO: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'] as UserRole[],
};

/**
 * Exige que a requisição possua uma sessão válida no servidor.
 * NUNCA confia em headers enviados pelo cliente (ex: x-user-role).
 * Retorna 401 se sem sessão, ou 403 se o perfil não tiver permissão.
 */
export async function exigirSessao(
  request: NextRequest | Request,
  allowedRoles?: UserRole[]
): Promise<
  | { autorizado: true; session: UserSession }
  | { autorizado: false; response: NextResponse }
> {
  const session = await obterSessaoDoRequest(request);

  if (!session) {
    return {
      autorizado: false,
      response: NextResponse.json(
        { error: 'Não autenticado: Sessão inválida ou expirada. Faça login para acessar o sistema.' },
        { status: 401 }
      ),
    };
  }

  // ADMIN sempre tem acesso a tudo
  if (session.papel === 'ADMIN') {
    return { autorizado: true, session };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(session.papel)) {
      return {
        autorizado: false,
        response: NextResponse.json(
          {
            error: `Acesso negado: Perfil "${session.papel}" não possui autorização para esta operação. Permissões necessárias: [${allowedRoles.join(', ')}].`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return { autorizado: true, session };
}

/**
 * Helper para validar se o usuário existe e está ativo no banco
 */
export async function validateUser(userId: string) {
  if (!userId || typeof userId !== 'string') {
    return {
      isValid: false,
      response: NextResponse.json(
        { error: 'ID de usuário é obrigatório e deve ser válido' },
        { status: 400 }
      ),
    };
  }

  const res = await query('SELECT id, nome, papel, ativo FROM usuarios WHERE id = $1 AND ativo = true', [userId]);
  if (res.rows.length === 0) {
    return {
      isValid: false,
      response: NextResponse.json(
        { error: `Usuário com id "${userId}" não encontrado ou inativo` },
        { status: 404 }
      ),
    };
  }

  return { isValid: true, user: res.rows[0] };
}
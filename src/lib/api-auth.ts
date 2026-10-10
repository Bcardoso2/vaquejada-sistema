import { NextResponse } from 'next/server';
import { query } from './db';

export type UserRole = 'ADMIN' | 'SECRETARIO' | 'JUIZ' | 'OPERADOR';

/**
 * Valida se o usuário possui autorização para a ação solicitada
 */
export function validateRolePermission(
  role: string | null | undefined,
  allowedRoles: UserRole[]
) {
  // Se não especificado em ambiente de dev/seed interno, assume ADMIN
  const effectiveRole = (role as UserRole) || 'ADMIN';

  if (!allowedRoles.includes(effectiveRole)) {
    return {
      isAuthorized: false,
      response: NextResponse.json(
        {
          error: `Acesso negado: Perfil "${effectiveRole}" não possui autorização para esta operação.`,
        },
        { status: 403 }
      ),
    };
  }

  return { isAuthorized: true, effectiveRole };
}

/**
 * Busca usuário por ID e valida se está ativo
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
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { query } from './db';

export type UserRole = 'ADMIN' | 'JUIZ' | 'SECRETARIA' | 'OPERADOR_PISTA';

export interface UserSession {
  id: string;
  nome: string;
  email: string;
  papel: UserRole;
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'vaquejada-masterdealers-secret-key-prod-2026'
);

export const COOKIE_NAME = 'vaquejada_session';

/**
 * Gera hash seguro com bcrypt
 */
export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

/**
 * Valida a senha contra o hash bcrypt
 */
export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

/**
 * Cria token JWT assinado para o usuário com expiração de 24 horas
 */
export async function criarTokenSessao(usuario: UserSession): Promise<string> {
  return new SignJWT({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

/**
 * Verifica se um token JWT é válido e decodifica a sessão
 */
export async function verificarTokenSessao(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.id || !payload.papel) {
      return null;
    }
    return {
      id: payload.id as string,
      nome: (payload.nome as string) || 'Usuário',
      email: (payload.email as string) || '',
      papel: payload.papel as UserRole,
    };
  } catch {
    return null;
  }
}

/**
 * Obtém a sessão do usuário no servidor a partir do Request ou Cookies
 * NÃO confia em cabeçalhos enviados pelo cliente para impersonação (ex: x-user-role)
 */
export async function obterSessaoDoRequest(request?: NextRequest | Request): Promise<UserSession | null> {
  let token: string | undefined;

  // 1. Tentar ler do cabeçalho de cookies do request se fornecido
  if (request) {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    // 2. Se não veio no cookie, aceita Bearer token (para testes ou clientes de API autorizados)
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }
  }

  // 3. Se não passou request ou ainda não achou, tentar via cookies() do Next.js
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch {
      // Ignora erro se fora de contexto de render/route do Next
    }
  }

  if (!token) {
    return null;
  }

  const session = await verificarTokenSessao(token);
  if (!session) {
    return null;
  }

  // Validar se o usuário ainda existe e está ativo no banco
  try {
    const res = await query('SELECT id, papel, ativo FROM usuarios WHERE id = $1', [session.id]);
    if (res.rowCount === 0 || !res.rows[0].ativo) {
      return null;
    }
    // Garante que o papel é o papel atual do banco
    session.papel = res.rows[0].papel as UserRole;
  } catch {
    // Se o banco estiver inacessível temporariamente, mantém a sessão do token assinado
  }

  return session;
}

/**
 * Controle de tentativas de login com bloqueio temporário (Rate Limiting)
 */
export async function verificarTentativasLogin(ipOuEmail: string): Promise<{ permitido: boolean; tempoRestanteSegundos?: number }> {
  try {
    const res = await query(
      `SELECT tentativas, bloqueado_ate FROM login_tentativas WHERE ip_ou_email = $1`,
      [ipOuEmail.toLowerCase().trim()]
    );

    if (res.rowCount && res.rowCount > 0) {
      const { tentativas, bloqueado_ate } = res.rows[0];
      if (bloqueado_ate) {
        const agora = new Date();
        const bloqueio = new Date(bloqueado_ate);
        if (agora < bloqueio) {
          const restante = Math.ceil((bloqueio.getTime() - agora.getTime()) / 1000);
          return { permitido: false, tempoRestanteSegundos: restante };
        }
      }
    }
    return { permitido: true };
  } catch {
    return { permitido: true };
  }
}

export async function registrarFalhaLogin(ipOuEmail: string): Promise<void> {
  const chave = ipOuEmail.toLowerCase().trim();
  try {
    const res = await query(
      `INSERT INTO login_tentativas (ip_ou_email, tentativas, ultimo_erro)
       VALUES ($1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (ip_ou_email)
       DO UPDATE SET 
         tentativas = login_tentativas.tentativas + 1,
         ultimo_erro = CURRENT_TIMESTAMP
       RETURNING tentativas`,
      [chave]
    );

    const tentativas = res.rows[0]?.tentativas || 1;
    // Se atingir 5 tentativas incorretas, bloqueia por 15 minutos
    if (tentativas >= 5) {
      await query(
        `UPDATE login_tentativas 
         SET bloqueado_ate = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
         WHERE ip_ou_email = $1`,
        [chave]
      );
    }
  } catch (err) {
    console.error('Erro ao registrar falha de login:', err);
  }
}

export async function limparTentativasLogin(ipOuEmail: string): Promise<void> {
  try {
    await query(`DELETE FROM login_tentativas WHERE ip_ou_email = $1`, [ipOuEmail.toLowerCase().trim()]);
  } catch (err) {
    console.error('Erro ao limpar tentativas de login:', err);
  }
}

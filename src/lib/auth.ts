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

// O segredo do JWT DEVE vir obrigatoriamente de variável de ambiente, sem fallback fixo no código
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length === 0) {
  throw new Error(
    'CONFIGURAÇÃO FATAL DE SEGURANÇA: A variável de ambiente JWT_SECRET não está definida. Defina uma chave secreta no arquivo .env.local para iniciar o servidor.'
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export const COOKIE_NAME = 'vaquejada_session';

/**
 * Determina se o cookie de sessão deve ter a flag secure:
 * - Se COOKIE_SECURE estiver configurado ('true' ou 'false'), respeita explicitamente a variável
 * - Caso contrário, usa secure apenas se NODE_ENV === 'production'
 */
export function isCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE.toLowerCase() === 'true';
  }
  return process.env.NODE_ENV === 'production';
}

/**
 * Extrai o IP do cliente de forma confiável considerando headers de proxy
 */
export function extrairIpCliente(request?: NextRequest | Request): string {
  if (!request) return '127.0.0.1';
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

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
 * SEMPRE consulta o banco de dados em tempo real:
 * - Se o usuário for desativado (ativo = false), a sessão é invalidada imediatamente.
 * - Se o perfil do usuário for alterado, o novo perfil entra em vigor imediatamente.
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

  // Validar se o usuário ainda existe e está ativo no banco a cada requisição
  try {
    const res = await query('SELECT id, papel, ativo FROM usuarios WHERE id = $1', [session.id]);
    if (res.rowCount === 0 || !res.rows[0].ativo) {
      // Usuário excluído ou desativado: perde o acesso imediatamente
      return null;
    }
    // Garante que o perfil do usuário é o papel atual do banco
    session.papel = res.rows[0].papel as UserRole;
  } catch (err) {
    console.error('Falha ao verificar status do usuário no banco:', err);
    // Em caso de falha de comunicação com o banco, não arrisca conceder acesso
    return null;
  }

  return session;
}

/**
 * Controle de tentativas de login refinado por Usuário E por IP
 * Garante que um atacante em outro IP NÃO consiga bloquear o acesso do usuário/ADMIN legítimo.
 */
export async function verificarTentativasLogin(
  email: string,
  ip: string
): Promise<{ permitido: boolean; tempoRestanteSegundos?: number }> {
  const emailLimpo = email.toLowerCase().trim();
  const ipLimpo = ip.trim();

  try {
    // 1. Verificar se este IP específico está bloqueado para este email
    const res = await query(
      `SELECT tentativas, bloqueado_ate 
       FROM login_tentativas_v2 
       WHERE email = $1 AND ip = $2`,
      [emailLimpo, ipLimpo]
    );

    if (res.rowCount && res.rowCount > 0) {
      const { bloqueado_ate } = res.rows[0];
      if (bloqueado_ate) {
        const agora = new Date();
        const bloqueio = new Date(bloqueado_ate);
        if (agora < bloqueio) {
          const restante = Math.ceil((bloqueio.getTime() - agora.getTime()) / 1000);
          return { permitido: false, tempoRestanteSegundos: restante };
        }
      }
    }

    // 2. Verificar se este IP no geral está tentando brute-force contra muitas contas (limite: 20 erros em 15m)
    const resIpGeral = await query(
      `SELECT COUNT(*) as total_erros 
       FROM login_tentativas_v2 
       WHERE ip = $1 AND ultimo_erro > CURRENT_TIMESTAMP - INTERVAL '15 minutes'`,
      [ipLimpo]
    );

    if (resIpGeral.rowCount && parseInt(resIpGeral.rows[0]?.total_erros || '0', 10) >= 20) {
      return { permitido: false, tempoRestanteSegundos: 900 };
    }

    return { permitido: true };
  } catch {
    return { permitido: true };
  }
}

/**
 * Registra falha de senha para a combinação (email, IP)
 */
export async function registrarFalhaLogin(email: string, ip: string): Promise<void> {
  const emailLimpo = email.toLowerCase().trim();
  const ipLimpo = ip.trim();

  try {
    const res = await query(
      `INSERT INTO login_tentativas_v2 (email, ip, tentativas, ultimo_erro)
       VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (email, ip)
       DO UPDATE SET 
         tentativas = login_tentativas_v2.tentativas + 1,
         ultimo_erro = CURRENT_TIMESTAMP
       RETURNING tentativas`,
      [emailLimpo, ipLimpo]
    );

    const tentativas = res.rows[0]?.tentativas || 1;
    // Se atingir 5 tentativas incorretas deste IP para esta conta, bloqueia apenas este IP para esta conta por 15 minutos
    if (tentativas >= 5) {
      await query(
        `UPDATE login_tentativas_v2 
         SET bloqueado_ate = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
         WHERE email = $1 AND ip = $2`,
        [emailLimpo, ipLimpo]
      );
    }
  } catch (err) {
    console.error('Erro ao registrar falha de login:', err);
  }
}

/**
 * Limpa tentativas após login bem-sucedido
 */
export async function limparTentativasLogin(email: string, ip: string): Promise<void> {
  try {
    await query(
      `DELETE FROM login_tentativas_v2 WHERE email = $1 AND ip = $2`,
      [email.toLowerCase().trim(), ip.trim()]
    );
  } catch (err) {
    console.error('Erro ao limpar tentativas de login:', err);
  }
}

/**
 * Desbloqueia todas as tentativas/bloqueios de um usuário (para uso do ADMIN)
 */
export async function desbloquearUsuario(email: string): Promise<void> {
  const emailLimpo = email.toLowerCase().trim();
  try {
    await query(`DELETE FROM login_tentativas_v2 WHERE email = $1`, [emailLimpo]);
    await query(`DELETE FROM login_tentativas WHERE LOWER(ip_ou_email) = $1`, [emailLimpo]);
  } catch (err) {
    console.error('Erro ao desbloquear usuário:', err);
    throw err;
  }
}

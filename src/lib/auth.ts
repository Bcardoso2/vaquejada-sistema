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
 * Extrai o IP do cliente de forma confiável.
 * IMPORTANTE: Headers de proxy (X-Forwarded-For, X-Real-IP) são tratados APENAS
 * se houver proxy confiável explicitamente habilitado (TRUST_PROXY=true).
 * Sem proxy configurado, usa-se o IP da conexão direta para evitar spoofing de cabeçalhos.
 */
export function extrairIpCliente(request?: NextRequest | Request): string {
  if (!request) return '127.0.0.1';

  const trustProxy = process.env.TRUST_PROXY === 'true';

  if (trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const clientIp = forwarded.split(',')[0].trim();
      if (clientIp) return clientIp;
    }
    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp.trim();
    }
  }

  // Tenta obter o IP do socket direto no NextRequest
  if ('ip' in request && (request as { ip?: string }).ip) {
    return (request as { ip?: string }).ip!;
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
    return null;
  }

  return session;
}

/**
 * Controle de tentativas de login:
 * 1. Por par (usuário + IP): 5 falhas em 15 minutos bloqueiam o par usuário+IP.
 * 2. Adicionalmente por IP geral: 20 falhas em 15 minutos bloqueiam o IP inteiro.
 */
export async function verificarTentativasLogin(
  email: string,
  ip: string
): Promise<{ permitido: boolean; tempoRestanteSegundos?: number; motivo?: string }> {
  const emailLimpo = email.toLowerCase().trim();
  const ipLimpo = ip.trim();

  try {
    const agora = new Date();

    // 1. Verificar se o IP geral está bloqueado por excesso de falhas (>= 20 falhas em 15 min)
    const resIpGeral = await query(
      `SELECT SUM(tentativas) as total_erros, MAX(bloqueado_ate) as max_bloqueio
       FROM login_tentativas_v2 
       WHERE ip = $1 AND ultimo_erro > CURRENT_TIMESTAMP - INTERVAL '15 minutes'`,
      [ipLimpo]
    );

    const totalErrosIp = parseInt(resIpGeral.rows[0]?.total_erros || '0', 10);
    const maxBloqueioIp = resIpGeral.rows[0]?.max_bloqueio;

    if (totalErrosIp >= 20 || (maxBloqueioIp && agora < new Date(maxBloqueioIp))) {
      const bloqueio = maxBloqueioIp ? new Date(maxBloqueioIp) : new Date(agora.getTime() + 900000);
      const restante = Math.max(1, Math.ceil((bloqueio.getTime() - agora.getTime()) / 1000));
      return { 
        permitido: false, 
        tempoRestanteSegundos: restante, 
        motivo: 'IP_BLOQUEADO' 
      };
    }

    // 2. Verificar se este par (email, IP) específico está bloqueado (>= 5 falhas)
    const res = await query(
      `SELECT tentativas, bloqueado_ate 
       FROM login_tentativas_v2 
       WHERE email = $1 AND ip = $2`,
      [emailLimpo, ipLimpo]
    );

    if (res.rowCount && res.rowCount > 0) {
      const { bloqueado_ate } = res.rows[0];
      if (bloqueado_ate) {
        const bloqueio = new Date(bloqueado_ate);
        if (agora < bloqueio) {
          const restante = Math.ceil((bloqueio.getTime() - agora.getTime()) / 1000);
          return { 
            permitido: false, 
            tempoRestanteSegundos: restante,
            motivo: 'CONTA_IP_BLOQUEADO'
          };
        }
      }
    }

    return { permitido: true };
  } catch {
    return { permitido: true };
  }
}

/**
 * Registra falha de senha para a combinação (email, IP)
 * Bloqueia o par (email, IP) com 5 falhas, e bloqueia o IP inteiro com 20 falhas
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

    const tentativasConta = res.rows[0]?.tentativas || 1;
    if (tentativasConta >= 5) {
      await query(
        `UPDATE login_tentativas_v2 
         SET bloqueado_ate = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
         WHERE email = $1 AND ip = $2`,
        [emailLimpo, ipLimpo]
      );
    }

    // Verificar se a soma de erros do IP atingiu o limite de 20 falhas
    const resTotal = await query(
      `SELECT SUM(tentativas) as total 
       FROM login_tentativas_v2 
       WHERE ip = $1 AND ultimo_erro > CURRENT_TIMESTAMP - INTERVAL '15 minutes'`,
      [ipLimpo]
    );
    const totalGeralIp = parseInt(resTotal.rows[0]?.total || '0', 10);
    if (totalGeralIp >= 20) {
      await query(
        `UPDATE login_tentativas_v2 
         SET bloqueado_ate = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
         WHERE ip = $1`,
        [ipLimpo]
      );
    }
  } catch (err) {
    console.error('Erro ao registrar falha de login:', err);
  }
}

/**
 * Limpa tentativas após login bem-sucedido para este usuário e IP
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
 * Desbloqueia todas as tentativas/bloqueios de um usuário ou IP (para uso do ADMIN)
 */
export async function desbloquearUsuario(identificador: string): Promise<void> {
  const limpo = identificador.toLowerCase().trim();
  try {
    await query(`DELETE FROM login_tentativas_v2 WHERE email = $1 OR ip = $1`, [limpo]);
    await query(`DELETE FROM login_tentativas WHERE LOWER(ip_ou_email) = $1`, [limpo]);
  } catch (err) {
    console.error('Erro ao desbloquear usuário:', err);
    throw err;
  }
}

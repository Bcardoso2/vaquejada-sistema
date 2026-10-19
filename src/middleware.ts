import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length === 0) {
  throw new Error(
    'CONFIGURAÇÃO FATAL DE SEGURANÇA: A variável de ambiente JWT_SECRET não está definida. O servidor não pode iniciar sem JWT_SECRET.'
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const COOKIE_NAME = 'vaquejada_session';

type UserRole = 'ADMIN' | 'JUIZ' | 'SECRETARIA' | 'OPERADOR_PISTA';

interface SessionPayload {
  id: string;
  nome: string;
  email: string;
  papel: UserRole;
}

// Matriz de permissões para Telas
const REGRAS_TELAS: Record<string, UserRole[]> = {
  '/usuarios': ['ADMIN'],
  '/auditoria': ['ADMIN'],
  '/bois': ['ADMIN'],
  '/vaquejadas': ['ADMIN'],
  '/kits': ['ADMIN'],
  '/oportunidades': ['ADMIN'],
  '/competidores': ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'],
  '/cavalos': ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'],
  '/senhas': ['ADMIN', 'SECRETARIA'],
  '/bois-ouro': ['ADMIN', 'SECRETARIA'],
  '/secretaria': ['ADMIN', 'SECRETARIA'],
  '/financeiro': ['ADMIN', 'SECRETARIA'],
  '/mapa': ['ADMIN', 'OPERADOR_PISTA'],
  '/juiz': ['ADMIN', 'JUIZ'],
  '/resultados': ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'],
  '/comprovante': ['ADMIN', 'SECRETARIA'],
};

// Matriz de permissões para APIs
const REGRAS_APIS: { prefixo: string; roles: UserRole[] }[] = [
  { prefixo: '/api/usuarios', roles: ['ADMIN'] },
  { prefixo: '/api/auditoria', roles: ['ADMIN', 'OPERADOR_PISTA', 'SECRETARIA', 'JUIZ'] },
  { prefixo: '/api/competidores', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'] },
  { prefixo: '/api/cavalos', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'] },
  { prefixo: '/api/bois-ouro', roles: ['ADMIN', 'SECRETARIA'] },
  { prefixo: '/api/bois', roles: ['ADMIN'] },
  { prefixo: '/api/vaquejadas', roles: ['ADMIN'] },
  { prefixo: '/api/oportunidades', roles: ['ADMIN'] },
  { prefixo: '/api/kits', roles: ['ADMIN', 'SECRETARIA'] },
  { prefixo: '/api/secretaria', roles: ['ADMIN', 'SECRETARIA'] },
  { prefixo: '/api/senhas', roles: ['ADMIN', 'SECRETARIA'] },
  { prefixo: '/api/financeiro', roles: ['ADMIN', 'SECRETARIA'] },
  { prefixo: '/api/mapa', roles: ['ADMIN', 'OPERADOR_PISTA'] },
  { prefixo: '/api/corridas', roles: ['ADMIN', 'OPERADOR_PISTA'] },
  { prefixo: '/api/juiz', roles: ['ADMIN', 'JUIZ'] },
  { prefixo: '/api/contestacoes', roles: ['ADMIN', 'JUIZ'] },
  { prefixo: '/api/resultados-senhas', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'] },
  { prefixo: '/api/resultados', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ'] },
  { prefixo: '/api/baterias', roles: ['ADMIN', 'OPERADOR_PISTA', 'SECRETARIA', 'JUIZ'] },
  { prefixo: '/api/cancela', roles: ['ADMIN', 'OPERADOR_PISTA', 'SECRETARIA', 'JUIZ'] },
  { prefixo: '/api/relatorios/bateria', roles: ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA'] },
  { prefixo: '/api/relatorios/resultados', roles: ['ADMIN', 'SECRETARIA'] },
  { prefixo: '/api/relatorios/fechamento-caixa', roles: ['ADMIN', 'SECRETARIA'] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Arquivos públicos e estáticos sempre permitidos
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/icone') ||
    pathname.startsWith('/simbolo') ||
    pathname.includes('.') ||
    pathname === '/api/auth/login' ||
    pathname === '/acesso-negado' ||
    pathname === '/placar' ||
    pathname === '/api/placar'
  ) {
    return NextResponse.next();
  }


  // 2. Extrair token do cookie ou Bearer header
  let token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  let session: SessionPayload | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (payload.id && payload.papel) {
        session = {
          id: payload.id as string,
          nome: (payload.nome as string) || 'Usuário',
          email: (payload.email as string) || '',
          papel: payload.papel as UserRole,
        };
      }
    } catch {
      session = null;
    }
  }

  // Se estiver tentando acessar /login já estando logado, redireciona para a tela padrão
  if (pathname === '/login') {
    if (session) {
      const destino =
        session.papel === 'OPERADOR_PISTA'
          ? '/mapa'
          : session.papel === 'JUIZ'
          ? '/juiz'
          : '/secretaria';
      return NextResponse.redirect(new URL(destino, request.url));
    }
    return NextResponse.next();
  }

  // Se não estiver logado:
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Não autenticado: Faça login para acessar este recurso.' },
        { status: 401 }
      );
    }
    // Em telas normais, redireciona para /login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirecionamento da rota raiz '/'
  if (pathname === '/') {
    const destino =
      session.papel === 'OPERADOR_PISTA'
        ? '/mapa'
        : session.papel === 'JUIZ'
        ? '/juiz'
        : '/secretaria';
    return NextResponse.redirect(new URL(destino, request.url));
  }

  // Se for ADMIN, tem acesso irrestrito a todas as rotas e APIs
  if (session.papel === 'ADMIN') {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', session.id);
    requestHeaders.set('x-user-nome', session.nome);
    requestHeaders.set('x-user-role', session.papel);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 3. Validação de rotas de API
  if (pathname.startsWith('/api/')) {
    const regraApi = REGRAS_APIS.find((r) => pathname.startsWith(r.prefixo));
    if (regraApi && !regraApi.roles.includes(session.papel)) {
      return NextResponse.json(
        {
          error: `Acesso negado: Perfil "${session.papel}" não possui permissão para esta rota (${pathname}).`,
        },
        { status: 403 }
      );
    }
  }

  // 4. Validação de telas
  for (const [rota, rolesPermitidos] of Object.entries(REGRAS_TELAS)) {
    if (pathname === rota || pathname.startsWith(rota + '/')) {
      if (!rolesPermitidos.includes(session.papel)) {
        // Redireciona para /acesso-negado
        return NextResponse.redirect(new URL('/acesso-negado', request.url));
      }
    }
  }

  // Injetar dados do usuário autenticado nos headers internos da requisição
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.id);
  requestHeaders.set('x-user-nome', session.nome);
  requestHeaders.set('x-user-role', session.papel);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

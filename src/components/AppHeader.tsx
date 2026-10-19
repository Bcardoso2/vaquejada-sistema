'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserNav } from '@/components/UserNav';

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'JUIZ' | 'SECRETARIA' | 'OPERADOR_PISTA';
}

const NAV_PRINCIPAL = [
  { href: '/', rotulo: 'Visão Geral' },
  { href: '/secretaria', rotulo: 'Secretaria' },
  { href: '/mapa', rotulo: 'Mapa da Pista' },
  { href: '/juiz', rotulo: 'Mesa do Juiz' },
  { href: '/resultados', rotulo: 'Classificação' },
  { href: '/placar', rotulo: 'Telão' },
  { href: '/financeiro', rotulo: 'Financeiro' },
  { href: '/auditoria', rotulo: 'Auditoria' },
];

const NAV_CADASTROS = [
  { href: '/competidores', rotulo: 'Competidores', descricao: 'Vaqueiros e esteireiros oficiais' },
  { href: '/cavalos', rotulo: 'Cavalos', descricao: 'Animais de puxa e esteira' },
  { href: '/bois', rotulo: 'Boiada', descricao: 'Bois e registros' },
  { href: '/senhas', rotulo: 'Senhas', descricao: 'Estoque e inscrições' },
  { href: '/vaquejadas', rotulo: 'Eventos', descricao: 'Circuito e provas' },
  { href: '/usuarios', rotulo: 'Usuários & Perfis', descricao: 'Acesso e operadores (ADMIN)' },
];

const linkDesktop =
  'px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500';
const linkMobile =
  'block px-3 py-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition';

interface AppHeaderProps {
  usuarioInicial?: UsuarioSessao | null;
}

export function AppHeader({ usuarioInicial = null }: AppHeaderProps) {
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(usuarioInicial);
  const [carregando, setCarregando] = useState(!usuarioInicial);

  useEffect(() => {
    // Revalida a sessão com o servidor em cada mudança de rota
    let ativo = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ativo) return;
        if (data?.usuario) {
          setUsuario(data.usuario);
        } else {
          setUsuario(null);
        }
      })
      .catch(() => {
        if (ativo) setUsuario(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [pathname]);

  // Regra de Exibição da Headbar:
  // 1. Nunca exibir na tela de login
  // 2. Nunca exibir no telão de placar
  // 3. Nunca exibir quando o usuário NÃO estiver logado
  if (pathname === '/login' || pathname === '/placar' || (!carregando && !usuario)) {
    return null;
  }

  // Durante o carregamento inicial, se não tínhamos usuário do servidor, não exibe
  if (!usuario && carregando) {
    return null;
  }

  return (
    <header className="bg-white text-slate-800 border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      {/* Filete de destaque */}
      <div className="h-0.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Marca */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group">
            <img
              src="/simbolo-fundo-claro.svg"
              alt="Vaquejada Pro logo"
              className="w-9 h-9 rounded-lg shadow-xs group-hover:scale-105 transition"
            />
            <div className="hidden sm:block">
              <div className="font-bold text-slate-900 text-base leading-tight tracking-tight">
                Vaquejada Pro
              </div>
              <div className="text-[11px] text-slate-500 font-medium tracking-wide">
                Gestão de Provas & Parque
              </div>
            </div>
          </Link>

          {/* Navegação desktop */}
          <nav aria-label="Principal" className="hidden lg:flex items-center gap-0.5 flex-1 ml-4">
            {NAV_PRINCIPAL.map((l) => (
              <Link key={l.href} href={l.href} className={linkDesktop}>
                {l.rotulo}
              </Link>
            ))}
          </nav>

          {/* Direita */}
          <div className="flex items-center gap-3">
            <UserNav />

            {/* Menu suspenso de cadastros */}
            <div className="hidden lg:block relative group">
              <button
                type="button"
                aria-haspopup="true"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-xs transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer"
              >
                Cadastros
                <svg
                  className="h-4 w-4 text-slate-500 transition group-hover:rotate-180 group-focus-within:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0 transition absolute right-0 top-full pt-2 w-60">
                <div className="bg-white text-slate-800 rounded-xl border border-slate-200 shadow-xl p-1.5">
                  {NAV_CADASTROS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="block px-3 py-2.5 rounded-lg hover:bg-slate-100 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      <div className="text-sm font-semibold text-slate-900">{l.rotulo}</div>
                      <div className="text-xs text-slate-500">{l.descricao}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Menu mobile/tablet */}
            <details className="lg:hidden group">
              <summary
                aria-label="Abrir ou fechar menu"
                className="list-none [&::-webkit-details-marker]:hidden p-2 -mr-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <svg
                  className="h-6 w-6 group-open:hidden"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
                <svg
                  className="h-6 w-6 hidden group-open:block"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </summary>

              <div className="absolute inset-x-0 top-full bg-white border-b border-slate-200 shadow-2xl max-h-[calc(100vh-4.5rem)] overflow-y-auto">
                <nav aria-label="Principal (mobile)" className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {NAV_PRINCIPAL.map((l) => (
                    <Link key={l.href} href={l.href} className={linkMobile}>
                      {l.rotulo}
                    </Link>
                  ))}
                </nav>
                <div className="px-4 pb-4 pt-3 border-t border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Cadastros
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {NAV_CADASTROS.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
                      >
                        {l.rotulo}
                      </Link>
                    ))}
                  </div>
                  <div className="md:hidden mt-4 inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Circuito 2026 ativo
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}

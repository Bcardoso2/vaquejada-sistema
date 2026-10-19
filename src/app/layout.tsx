import './globals.css';
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { UserNav } from '@/components/UserNav';

export const metadata: Metadata = {
  title: {
    default: 'Vaquejada Pro',
    template: '%s · Vaquejada Pro',
  },
  description: 'Sistema Operacional de Vaquejada - Gestão de Pista, Secretaria, Julgamento e Financeiro',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const NAV_PRINCIPAL = [
  { href: '/', rotulo: 'Visão Geral' },
  { href: '/secretaria', rotulo: 'Secretaria' },
  { href: '/mapa', rotulo: 'Mapa da Pista' },
  { href: '/juiz', rotulo: 'Mesa do Juiz' },
  { href: '/resultados', rotulo: 'Classificação' },
  { href: '/placar', rotulo: '📺 Telão' },
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
  'px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400';
const linkMobile =
  'block px-3 py-3 rounded-lg text-sm font-medium text-slate-200 hover:bg-white/10 transition';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-amber-400 focus:text-slate-950 focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-bold"
        >
          Pular para o conteúdo
        </a>

        <header className="bg-slate-950 text-white border-b border-white/10 sticky top-0 z-50 shadow-lg shadow-slate-950/10">
          {/* Filete de destaque */}
          <div className="h-0.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 gap-4">
              {/* Marca */}
              <Link href="/" className="flex items-center gap-3 shrink-0 group">
                <img src="/simbolo-fundo-escuro.svg" alt="Vaquejada Pro logo" className="w-9 h-9 rounded-lg shadow-sm group-hover:bg-amber-300 transition" />
                <div className="hidden sm:block">
                  <div className="font-bold text-white text-base leading-tight tracking-tight">Vaquejada Pro</div>
                  <div className="text-[11px] text-slate-400 font-medium tracking-wide">Gestão de Provas & Parque</div>
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

                {/* Menu suspenso de cadastros (só CSS: abre com mouse ou foco do teclado) */}
                <div className="hidden lg:block relative group">
                  <button
                    type="button"
                    aria-haspopup="true"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                  >
                    Cadastros
                    <svg
                      className="h-4 w-4 transition group-hover:rotate-180 group-focus-within:rotate-180"
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
                          className="block px-3 py-2.5 rounded-lg hover:bg-slate-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                        >
                          <div className="text-sm font-semibold text-slate-900">{l.rotulo}</div>
                          <div className="text-xs text-slate-500">{l.descricao}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Menu mobile/tablet: <details> do HTML, funciona sem JavaScript */}
                <details className="lg:hidden group">
                  <summary
                    aria-label="Abrir ou fechar menu"
                    className="list-none [&::-webkit-details-marker]:hidden p-2 -mr-2 rounded-lg text-slate-200 hover:bg-white/10 cursor-pointer"
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

                  <div className="absolute inset-x-0 top-full bg-slate-950 border-b border-white/10 shadow-2xl max-h-[calc(100vh-4.5rem)] overflow-y-auto">
                    <nav aria-label="Principal (mobile)" className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {NAV_PRINCIPAL.map((l) => (
                        <Link key={l.href} href={l.href} className={linkMobile}>
                          {l.rotulo}
                        </Link>
                      ))}
                    </nav>
                    <div className="px-4 pb-4 pt-3 border-t border-white/10">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-2">
                        Cadastros
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {NAV_CADASTROS.map((l) => (
                          <Link
                            key={l.href}
                            href={l.href}
                            className="px-3 py-2 rounded-lg border border-white/15 text-sm font-medium text-slate-200 hover:bg-white/10 transition"
                          >
                            {l.rotulo}
                          </Link>
                        ))}
                      </div>
                      <div className="md:hidden mt-4 inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-400/30 rounded-full text-xs font-semibold text-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Circuito 2026 ativo
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </header>

        <main id="conteudo" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="bg-slate-950 text-slate-400 mt-auto">
          <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-5">
                <div className="flex items-center gap-2.5">
                  <img src="/simbolo-fundo-escuro.svg" alt="Vaquejada Pro logo" className="w-7 h-7 rounded-md shadow-sm group-hover:bg-amber-300 transition" />
                  <span className="font-bold text-white tracking-tight">Vaquejada Pro</span>
                </div>
                <p className="text-xs leading-relaxed mt-3 max-w-sm">
                  Operação em tempo real com auditoria e controle de pista, secretaria, julgamento e financeiro.
                </p>
              </div>

              <div className="md:col-span-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Módulos</div>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {NAV_PRINCIPAL.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="hover:text-white transition">
                        {l.rotulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="md:col-span-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Cadastros</div>
                <ul className="space-y-2 text-xs">
                  {NAV_CADASTROS.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="hover:text-white transition">
                        {l.rotulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
              <div>Vaquejada Pro · Versão 1.0</div>
              <div>Todas as ações da pista e da secretaria ficam registradas em auditoria.</div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
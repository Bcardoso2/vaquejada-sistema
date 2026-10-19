'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  { href: '/competidores', rotulo: 'Competidores' },
  { href: '/cavalos', rotulo: 'Cavalos' },
  { href: '/bois', rotulo: 'Boiada' },
  { href: '/senhas', rotulo: 'Senhas' },
  { href: '/vaquejadas', rotulo: 'Eventos' },
  { href: '/usuarios', rotulo: 'Usuários' },
];

interface AppFooterProps {
  estaLogado?: boolean;
}

export function AppFooter({ estaLogado = false }: AppFooterProps) {
  const pathname = usePathname();

  // Em tela de login ou telão de placar, não renderiza o rodapé de módulos
  if (pathname === '/login' || pathname === '/placar') {
    return null;
  }

  // Se não estiver logado, exibe apenas copyright minimalista
  if (!estaLogado) {
    return (
      <footer className="bg-white text-slate-500 border-t border-slate-200 mt-auto py-4 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4">
          Vaquejada Pro · Gestão de Provas & Parque
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-white text-slate-600 border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <img
                src="/simbolo-fundo-claro.svg"
                alt="Vaquejada Pro logo"
                className="w-7 h-7 rounded-md shadow-xs"
              />
              <span className="font-bold text-slate-900 tracking-tight">Vaquejada Pro</span>
            </div>
            <p className="text-xs leading-relaxed mt-3 max-w-sm text-slate-500">
              Operação em tempo real com auditoria e controle de pista, secretaria, julgamento e financeiro.
            </p>
          </div>

          <div className="md:col-span-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Módulos
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {NAV_PRINCIPAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-slate-600 hover:text-slate-900 transition">
                    {l.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Cadastros
            </div>
            <ul className="space-y-2 text-xs">
              {NAV_CADASTROS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-slate-600 hover:text-slate-900 transition">
                    {l.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <div>Vaquejada Pro · Versão 1.0</div>
          <div>Todas as ações da pista e da secretaria ficam registradas em auditoria.</div>
        </div>
      </div>
    </footer>
  );
}

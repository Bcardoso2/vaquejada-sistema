import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sistema de Gestão de Vaquejada',
  description: 'Sistema Operacional de Vaquejada - Gestão de Pista, Secretaria, Julgamento e Financeiro',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans antialiased">
        {/* Barra de Navegação Corporativa */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Marca / Identidade */}
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm tracking-tighter">
                    VQ
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-base leading-tight tracking-tight">
                      Vaquejada Pro
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      Gestão de Provas & Parque
                    </div>
                  </div>
                </Link>

                {/* Navegação Principal */}
                <nav className="hidden lg:flex items-center gap-1">
                  <Link
                    href="/"
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    Visão Geral
                  </Link>
                  <Link
                    href="/mapa"
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    Mapa da Pista
                  </Link>
                  <Link
                    href="/juiz"
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    Mesa do Juiz (Vídeo)
                  </Link>
                  <Link
                    href="/secretaria"
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    Secretaria & Senhas
                  </Link>
                  <Link
                    href="/financeiro"
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    Caixa Financeiro
                  </Link>
                  <Link
                    href="/auditoria"
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    Auditoria
                  </Link>
                </nav>
              </div>

              {/* Status e Cadastros */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Circuito 2026 Ativo
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

                <div className="flex items-center gap-1.5 text-xs">
                  <Link
                    href="/bois"
                    className="px-2.5 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition"
                  >
                    Boiada
                  </Link>
                  <Link
                    href="/senhas"
                    className="px-2.5 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition"
                  >
                    Senhas
                  </Link>
                  <Link
                    href="/vaquejadas"
                    className="px-2.5 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition"
                  >
                    Eventos
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Corpo Principal */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Rodapé Corporativo */}
        <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <div>Sistema de Gestão de Vaquejada · Versão 1.0</div>
            <div>Operação em tempo real com auditoria e controle de pista</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AppHeader } from '@/components/AppHeader';
import { AppFooter } from '@/components/AppFooter';
import { obterSessaoDoRequest, UserSession } from '@/lib/auth';

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let usuarioInicial: UserSession | null = null;
  try {
    usuarioInicial = await obterSessaoDoRequest();
  } catch {
    usuarioInicial = null;
  }

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-amber-400 focus:text-slate-950 focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-bold"
        >
          Pular para o conteúdo
        </a>

        {/* Headbar: renderizada estritamente para usuários autenticados (oculta em /login, /placar e deslogado) */}
        <AppHeader usuarioInicial={usuarioInicial} />

        <main id="conteudo" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Rodapé: adaptável ao estado de login (oculto no /login e limpo quando deslogado) */}
        <AppFooter estaLogado={!!usuarioInicial} />
      </body>
    </html>
  );
}
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BoisOuroRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirecionamento automático suave para a aba oficial de Boi de Ouro na Secretaria
    const timer = setTimeout(() => {
      router.replace('/secretaria');
    }, 1200);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-slate-950">Módulo Boi de Ouro Integrado</h1>
      <p className="text-sm text-slate-600 max-w-md">
        A gestão de Boi de Ouro, autorizações e pagamentos agora é realizada de forma integrada e centralizada na <strong>Secretaria</strong>.
      </p>
      <div className="pt-2">
        <Link
          href="/secretaria"
          className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          Acessar Secretaria & Boi de Ouro
        </Link>
      </div>
    </div>
  );
}
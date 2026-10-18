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
      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xl">
        🐂
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
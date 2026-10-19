'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'JUIZ' | 'SECRETARIA' | 'OPERADOR_PISTA';
}

export function UserNav() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.usuario) {
          setUsuario(data.usuario);
        } else {
          setUsuario(null);
        }
      })
      .catch(() => setUsuario(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUsuario(null);
      router.push('/login');
      router.refresh();
    } catch {
      window.location.href = '/login';
    }
  };

  if (loading) {
    return <div className="h-8 w-20 bg-slate-200 animate-pulse rounded-lg" />;
  }

  if (!usuario) {
    return (
      <Link
        href="/login"
        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition shadow-xs"
      >
        Entrar
      </Link>
    );
  }

  const getBadgeColor = (p: string) => {
    switch (p) {
      case 'ADMIN':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'SECRETARIA':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'OPERADOR_PISTA':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'JUIZ':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden sm:flex flex-col items-end text-right">
        <span className="text-xs font-bold text-slate-900 leading-tight">
          {usuario.nome}
        </span>
        <span
          className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border font-semibold ${getBadgeColor(
            usuario.papel
          )}`}
        >
          {usuario.papel}
        </span>
      </div>

      <button
        onClick={handleLogout}
        title="Sair do sistema"
        className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-semibold transition cursor-pointer"
      >
        <span>Sair</span>
        <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}

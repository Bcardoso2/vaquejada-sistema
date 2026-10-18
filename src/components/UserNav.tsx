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
    return <div className="h-8 w-20 bg-white/10 animate-pulse rounded-lg" />;
  }

  if (!usuario) {
    return (
      <Link
        href="/login"
        className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition shadow-xs"
      >
        Entrar
      </Link>
    );
  }

  const getBadgeColor = (p: string) => {
    switch (p) {
      case 'ADMIN':
        return 'bg-purple-500/20 text-purple-300 border-purple-400/30';
      case 'SECRETARIA':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      case 'OPERADOR_PISTA':
        return 'bg-amber-500/20 text-amber-300 border-amber-400/30';
      case 'JUIZ':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
    }
  };

  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden sm:flex flex-col items-end text-right">
        <span className="text-xs font-bold text-white leading-tight">
          {usuario.nome}
        </span>
        <span
          className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border font-semibold ${getBadgeColor(
            usuario.papel
          )}`}
        >
          {usuario.papel}
        </span>
      </div>

      <button
        onClick={handleLogout}
        title="Sair do sistema"
        className="px-2.5 py-1.5 border border-white/15 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer"
      >
        Sair ↪
      </button>
    </div>
  );
}

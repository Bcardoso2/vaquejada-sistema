'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || 'Credenciais inválidas.');
        setLoading(false);
        return;
      }

      // Redirecionamento inteligente baseado no perfil recebido
      const papel = data.usuario?.papel;
      if (papel === 'OPERADOR_PISTA') {
        router.push('/mapa');
      } else if (papel === 'JUIZ') {
        router.push('/juiz');
      } else if (papel === 'SECRETARIA') {
        router.push('/secretaria');
      } else {
        router.push('/secretaria');
      }
      router.refresh();
    } catch {
      setErro('Erro ao conectar ao servidor. Tente novamente.');
      setLoading(false);
    }
  };

  const preencherCredencial = (em: string, pass: string) => {
    setEmail(em);
    setSenha(pass);
    setErro(null);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-xl space-y-6">
        {/* Logotipo e Apresentação */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl mx-auto flex items-center justify-center font-black text-2xl shadow-md">
            VQ
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Vaquejada Manager
          </h1>
          <p className="text-xs text-slate-500">
            Acesso Restrito · Autenticação & Sessão Segura
          </p>
        </div>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-start gap-2">
            <span className="text-base leading-none">⚠️</span>
            <span>{erro}</span>
          </div>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              required
              autoFocus
              placeholder="seu.email@vaquejada.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Senha
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Entrando...</span>
            ) : (
              <span>Entrar no Sistema</span>
            )}
          </button>
        </form>

        {/* Atalhos Rápidos para Teste de Perfis */}
        <div className="pt-4 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
            Perfis Configurados para Homologação:
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => preencherCredencial('admin@vaquejada.com', 'Admin@Vaquejada2026!')}
              className="p-2 border border-purple-200 bg-purple-50 hover:bg-purple-100 rounded-lg text-left text-purple-900 font-semibold transition"
            >
              👑 Admin
              <span className="block text-[10px] text-purple-700 font-normal">Acesso Total</span>
            </button>

            <button
              type="button"
              onClick={() => preencherCredencial('secretaria@vaquejada.com', 'Secretaria@123')}
              className="p-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg text-left text-blue-900 font-semibold transition"
            >
              💼 Secretaria
              <span className="block text-[10px] text-blue-700 font-normal">Vendas & Caixa</span>
            </button>

            <button
              type="button"
              onClick={() => preencherCredencial('pista@vaquejada.com', 'Pista@123')}
              className="p-2 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-lg text-left text-amber-900 font-semibold transition"
            >
              🏇 Pista
              <span className="block text-[10px] text-amber-700 font-normal">Mapa & Chamada</span>
            </button>

            <button
              type="button"
              onClick={() => preencherCredencial('juiz@vaquejada.com', 'Juiz@123')}
              className="p-2 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-left text-emerald-900 font-semibold transition"
            >
              ⚖️ Juiz
              <span className="block text-[10px] text-emerald-700 font-normal">Boi de TV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

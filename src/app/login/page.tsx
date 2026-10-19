'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Estados do Modal de Troca Obrigatória de Senha
  const [modalTrocaSenha, setModalTrocaSenha] = useState(false);
  const [senhaAtualParaTroca, setSenhaAtualParaTroca] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacaoNovaSenha, setConfirmacaoNovaSenha] = useState('');
  const [loadingTroca, setLoadingTroca] = useState(false);
  const [erroTroca, setErroTroca] = useState<string | null>(null);
  const [sucessoTroca, setSucessoTroca] = useState(false);

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

      // Se o usuário precisa trocar a senha no primeiro acesso
      if (data.deveTrocarSenha) {
        setSenhaAtualParaTroca(senha);
        setModalTrocaSenha(true);
        setLoading(false);
        return;
      }

      // Redirecionamento inteligente baseado no perfil recebido
      redirecionarPorPerfil(data.usuario?.papel);
    } catch {
      setErro('Erro ao conectar ao servidor. Tente novamente.');
      setLoading(false);
    }
  };

  const redirecionarPorPerfil = (papel?: string) => {
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
  };

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroTroca(null);

    if (novaSenha.length < 10) {
      setErroTroca('A nova senha deve ter no mínimo 10 caracteres.');
      return;
    }

    if (novaSenha !== confirmacaoNovaSenha) {
      setErroTroca('A nova senha e a confirmação não conferem.');
      return;
    }

    setLoadingTroca(true);
    try {
      const res = await fetch('/api/auth/trocar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senhaAtual: senhaAtualParaTroca,
          novaSenha,
          confirmacaoNovaSenha,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErroTroca(data.error || 'Erro ao redefinir senha.');
        setLoadingTroca(false);
        return;
      }

      setSucessoTroca(true);
      setTimeout(() => {
        setModalTrocaSenha(false);
        // Buscar papel do usuário e redirecionar
        fetch('/api/auth/me')
          .then((r) => r.json())
          .then((d) => redirecionarPorPerfil(d.usuario?.papel))
          .catch(() => router.push('/secretaria'));
      }, 1500);
    } catch {
      setErroTroca('Erro de comunicação com o servidor.');
      setLoadingTroca(false);
    }
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
            {loading ? <span>Entrando...</span> : <span>Entrar no Sistema</span>}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-400">
          Protegido por criptografia forte e controle de sessão por IP.
        </div>
      </div>

      {/* MODAL: TROCA OBRIGATÓRIA DE SENHA NO PRIMEIRO ACESSO */}
      {modalTrocaSenha && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-amber-100 text-amber-900 text-2xl rounded-2xl">🔐</span>
              <div>
                <h3 className="text-lg font-black text-slate-900">Troca Obrigatória de Senha</h3>
                <p className="text-xs text-slate-500">Este é seu primeiro acesso com senha inicial.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
              Por motivos de segurança, você deve definir uma nova senha pessoal com <strong>no mínimo 10 caracteres</strong>, contendo letras e números.
            </p>

            {erroTroca && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                ⚠️ {erroTroca}
              </div>
            )}

            {sucessoTroca ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 font-bold text-sm text-center animate-pulse">
                ✅ Senha redefinida com sucesso! Redirecionando...
              </div>
            ) : (
              <form onSubmit={handleTrocarSenha} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nova Senha (Mínimo 10 caracteres)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={10}
                    placeholder="Digite a nova senha forte"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Comprimento atual: {novaSenha.length}/10 caracteres
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    required
                    minLength={10}
                    placeholder="Repita a nova senha"
                    value={confirmacaoNovaSenha}
                    onChange={(e) => setConfirmacaoNovaSenha(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingTroca || novaSenha.length < 10}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow transition disabled:opacity-50"
                >
                  {loadingTroca ? 'Salvando nova senha...' : 'Salvar Nova Senha & Entrar'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

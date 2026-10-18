'use client';

import { useState, useEffect } from 'react';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'JUIZ' | 'SECRETARIA' | 'OPERADOR_PISTA';
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);

  // Toasts
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);

  const exibirToast = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState<{
    aberto: boolean;
    usuario: Usuario | null;
  }>({ aberto: false, usuario: null });

  const [modalConfirmarDesativar, setModalConfirmarDesativar] = useState<Usuario | null>(null);

  // Form States
  const [novoUsuario, setNovoUsuario] = useState({
    nome: '',
    email: '',
    senha: '',
    papel: 'SECRETARIA',
    ativo: true,
  });

  const [formEditar, setFormEditar] = useState({
    nome: '',
    email: '',
    papel: 'SECRETARIA',
    ativo: true,
    novaSenha: '',
  });

  const carregarUsuarios = async () => {
    try {
      setLoading(true);
      setErroAcesso(null);
      const res = await fetch('/api/usuarios');
      if (res.status === 401 || res.status === 403) {
        setErroAcesso('Acesso restrito: Apenas administradores possuem permissão para acessar o gerenciamento de usuários.');
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsuarios(data);
      }
    } catch {
      setErroAcesso('Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const handleSalvarNovo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoUsuario),
      });
      const data = await res.json();
      if (res.ok) {
        setModalNovo(false);
        setNovoUsuario({ nome: '', email: '', senha: '', papel: 'SECRETARIA', ativo: true });
        exibirToast('sucesso', `Usuário "${data.usuario?.nome}" cadastrado com sucesso.`);
        await carregarUsuarios();
      } else {
        exibirToast('erro', data.error || 'Erro ao criar usuário');
      }
    } catch {
      exibirToast('erro', 'Erro ao conectar ao servidor');
    }
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar.usuario) return;

    try {
      const payload: any = {
        nome: formEditar.nome,
        email: formEditar.email,
        papel: formEditar.papel,
        ativo: formEditar.ativo,
      };
      if (formEditar.novaSenha.trim()) {
        payload.novaSenha = formEditar.novaSenha;
      }

      const res = await fetch(`/api/usuarios/${modalEditar.usuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setModalEditar({ aberto: false, usuario: null });
        exibirToast('sucesso', 'Dados do usuário atualizados com sucesso.');
        await carregarUsuarios();
      } else {
        exibirToast('erro', data.error || 'Erro ao atualizar usuário');
      }
    } catch {
      exibirToast('erro', 'Erro de conexão com o servidor');
    }
  };

  const confirmarDesativacao = async () => {
    if (!modalConfirmarDesativar) return;

    try {
      const res = await fetch(`/api/usuarios/${modalConfirmarDesativar.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast('sucesso', `Usuário "${modalConfirmarDesativar.nome}" desativado com sucesso.`);
        setModalConfirmarDesativar(null);
        await carregarUsuarios();
      } else {
        exibirToast('erro', data.error || 'Erro ao desativar usuário');
      }
    } catch {
      exibirToast('erro', 'Erro ao conectar ao servidor');
    }
  };

  const handleDesbloquear = async (usuario: Usuario) => {
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}/desbloquear`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast('sucesso', data.message || `Usuário "${usuario.nome}" desbloqueado com sucesso.`);
      } else {
        exibirToast('erro', data.error || 'Erro ao desbloquear usuário');
      }
    } catch {
      exibirToast('erro', 'Erro de comunicação ao desbloquear');
    }
  };

  const abrirEdicao = (u: Usuario) => {
    setModalEditar({
      aberto: true,
      usuario: u,
    });
    setFormEditar({
      nome: u.nome,
      email: u.email,
      papel: u.papel,
      ativo: u.ativo,
      novaSenha: '',
    });
  };

  const getPapelBadge = (papel: string) => {
    switch (papel) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SECRETARIA':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'OPERADOR_PISTA':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'JUIZ':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (erroAcesso) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-rose-50 border border-rose-200 p-8 rounded-2xl text-center shadow-sm">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-xl font-bold text-rose-900 mb-2">Acesso Negado</h2>
        <p className="text-sm text-rose-700 mb-6">{erroAcesso}</p>
        <a
          href="/login"
          className="inline-block px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
        >
          Ir para Login de Administrador
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition animate-in fade-in slide-in-from-top-2 ${
            toast.tipo === 'sucesso'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
              : 'bg-rose-950 text-rose-100 border-rose-800'
          }`}
        >
          <span>{toast.tipo === 'sucesso' ? '✅' : '⚠️'}</span>
          <span>{toast.mensagem}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-white/60 hover:text-white font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Gerenciamento de Usuários & Perfis
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-50 text-purple-800 border border-purple-200">
              Controle RBAC
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Cadastre novos operadores, configure papéis de acesso e desbloqueie tentativas de login
          </p>
        </div>

        <button
          onClick={() => setModalNovo(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>+</span> Novo Usuário
        </button>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
          <span>Usuários Cadastrados ({usuarios.length})</span>
          <span className="text-slate-400 font-normal">Sessões seguras com expiração de 24h</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Perfil (Role)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Cadastrado em</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{u.nome}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${getPapelBadge(u.papel)}`}>
                      {u.papel}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                        u.ativo
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {u.ativo ? 'ATIVO' : 'DESATIVADO'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {new Date(u.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => abrirEdicao(u)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition cursor-pointer"
                        title="Editar cadastro ou redefinir senha"
                      >
                        Editar / Senha
                      </button>
                      <button
                        onClick={() => handleDesbloquear(u)}
                        className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 rounded text-xs font-semibold transition cursor-pointer"
                        title="Limpar bloqueios de tentativas incorretas de senha"
                      >
                        Desbloquear
                      </button>
                      {u.ativo && (
                        <button
                          onClick={() => setModalConfirmarDesativar(u)}
                          className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded text-xs font-semibold transition cursor-pointer"
                        >
                          Desativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirmar Desativação (Sem window.confirm) */}
      {modalConfirmarDesativar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xl font-bold mx-auto">
              ⚠️
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Desativar Usuário</h3>
              <p className="text-xs text-slate-500 mt-1">
                Deseja realmente desativar o acesso de{' '}
                <strong className="text-slate-800">{modalConfirmarDesativar.nome}</strong>?
                O usuário perderá o acesso ao sistema imediatamente.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmarDesativar(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarDesativacao}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Confirmar Desativação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Usuário */}
      {modalNovo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSalvarNovo} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Novo Usuário</h3>
            <p className="text-xs text-slate-500">
              Cadastre operadores informando perfil de acesso e credenciais de login.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                placeholder="Ex: Maria Secretária"
                value={novoUsuario.nome}
                onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Login *</label>
              <input
                type="email"
                required
                placeholder="maria@vaquejada.com"
                value={novoUsuario.email}
                onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Senha Provisória *</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={novoUsuario.senha}
                onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Perfil de Acesso (Role) *</label>
              <select
                value={novoUsuario.papel}
                onChange={(e) => setNovoUsuario({ ...novoUsuario, papel: e.target.value as any })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              >
                <option value="SECRETARIA">SECRETARIA (Venda de senhas e caixa financeiro)</option>
                <option value="OPERADOR_PISTA">OPERADOR_PISTA (Chamada e andamento da pista /mapa)</option>
                <option value="JUIZ">JUIZ (Boi de TV e julgamento /juiz)</option>
                <option value="ADMIN">ADMIN (Acesso Irrestrito)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalNovo(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cadastrar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Editar Usuário */}
      {modalEditar.aberto && modalEditar.usuario && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSalvarEdicao} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Editar Usuário: {modalEditar.usuario.nome}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                value={formEditar.nome}
                onChange={(e) => setFormEditar({ ...formEditar, nome: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail *</label>
              <input
                type="email"
                required
                value={formEditar.email}
                onChange={(e) => setFormEditar({ ...formEditar, email: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Perfil de Acesso *</label>
              <select
                value={formEditar.papel}
                onChange={(e) => setFormEditar({ ...formEditar, papel: e.target.value as any })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              >
                <option value="SECRETARIA">SECRETARIA</option>
                <option value="OPERADOR_PISTA">OPERADOR_PISTA</option>
                <option value="JUIZ">JUIZ</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status da Conta</label>
              <select
                value={formEditar.ativo ? 'true' : 'false'}
                onChange={(e) => setFormEditar({ ...formEditar, ativo: e.target.value === 'true' })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              >
                <option value="true">ATIVO</option>
                <option value="false">DESATIVADO</option>
              </select>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nova Senha (deixe em branco se não desejar alterar)
              </label>
              <input
                type="password"
                placeholder="Digite a nova senha (mínimo 6 caracteres)"
                value={formEditar.novaSenha}
                onChange={(e) => setFormEditar({ ...formEditar, novaSenha: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEditar({ aberto: false, usuario: null })}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

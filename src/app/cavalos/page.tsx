'use client';

import { useState, useEffect } from 'react';

interface Cavalo {
  id: string;
  nome: string;
  tipo: 'PUXA' | 'ESTEIRA' | 'AMBOS';
  proprietario: string | null;
  registro: string | null;
  chip: string | null;
  ativo: boolean;
  criado_em: string;
}

export default function CavalosPage() {
  const [cavalos, setCavalos] = useState<Cavalo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Toast
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const exibirToast = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState<{ aberto: boolean; cavalo: Cavalo | null }>({
    aberto: false,
    cavalo: null,
  });
  const [modalHistorico, setModalHistorico] = useState<{ aberto: boolean; cavalo: Cavalo | null; senhas: any[] }>({
    aberto: false,
    cavalo: null,
    senhas: [],
  });
  const [modalDesativar, setModalDesativar] = useState<Cavalo | null>(null);

  // Forms
  const [formNovo, setFormNovo] = useState({
    nome: '',
    tipo: 'PUXA',
    proprietario: '',
    registro: '',
    chip: '',
  });

  const [formEditar, setFormEditar] = useState({
    nome: '',
    tipo: 'PUXA',
    proprietario: '',
    registro: '',
    chip: '',
    ativo: true,
  });

  const carregarCavalos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (busca.trim()) params.set('q', busca.trim());
      if (filtroTipo) params.set('tipo', filtroTipo);

      const res = await fetch(`/api/cavalos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCavalos(Array.isArray(data) ? data : []);
      } else {
        exibirToast('erro', 'Falha ao buscar animais.');
      }
    } catch {
      exibirToast('erro', 'Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarCavalos();
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, filtroTipo]);

  const handleSalvarNovo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cavalos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formNovo),
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast('sucesso', `Animal "${data.cavalo?.nome}" cadastrado com sucesso.`);
        setModalNovo(false);
        setFormNovo({ nome: '', tipo: 'PUXA', proprietario: '', registro: '', chip: '' });
        await carregarCavalos();
      } else {
        exibirToast('erro', data.error || 'Erro ao cadastrar animal.');
      }
    } catch {
      exibirToast('erro', 'Erro ao conectar ao servidor.');
    }
  };

  const handleSalvarEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar.cavalo) return;

    try {
      const res = await fetch(`/api/cavalos/${modalEditar.cavalo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEditar),
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast('sucesso', 'Cadastro do animal atualizado.');
        setModalEditar({ aberto: false, cavalo: null });
        await carregarCavalos();
      } else {
        exibirToast('erro', data.error || 'Erro ao atualizar.');
      }
    } catch {
      exibirToast('erro', 'Erro de conexão.');
    }
  };

  const abrirHistorico = async (cav: Cavalo) => {
    try {
      const res = await fetch(`/api/cavalos/${cav.id}`);
      if (res.ok) {
        const data = await res.json();
        setModalHistorico({ aberto: true, cavalo: data.cavalo, senhas: data.senhas || [] });
      } else {
        exibirToast('erro', 'Erro ao buscar histórico do animal.');
      }
    } catch {
      exibirToast('erro', 'Erro de conexão.');
    }
  };

  const confirmarDesativacao = async () => {
    if (!modalDesativar) return;
    try {
      const res = await fetch(`/api/cavalos/${modalDesativar.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast('sucesso', `Animal "${modalDesativar.nome}" desativado.`);
        setModalDesativar(null);
        await carregarCavalos();
      } else {
        exibirToast('erro', data.error || 'Erro ao desativar.');
      }
    } catch {
      exibirToast('erro', 'Erro de conexão.');
    }
  };

  const abrirEdicao = (c: Cavalo) => {
    setModalEditar({ aberto: true, cavalo: c });
    setFormEditar({
      nome: c.nome,
      tipo: c.tipo,
      proprietario: c.proprietario || '',
      registro: c.registro || '',
      chip: c.chip || '',
      ativo: c.ativo,
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition animate-in fade-in slide-in-from-top-2 ${
            toast.tipo === 'sucesso'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
              : 'bg-rose-950 text-rose-100 border-rose-800'
          }`}
        >
          {toast.tipo === 'sucesso' ? (
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <span>{toast.mensagem}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-white/60 hover:text-white font-bold cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cadastro Oficial de Cavalos</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Plantel & Pista
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Animais de puxa e esteira, registros genealógicos e controle de inscrições
          </p>
        </div>

        <button
          onClick={() => setModalNovo(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>+</span> Novo Cavalo
        </button>
      </div>

      {/* Busca e Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar por nome do cavalo, proprietário ou registro/chip..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg p-2.5 pl-8 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-700 font-medium"
        >
          <option value="">Todos os Tipos</option>
          <option value="PUXA">Cavalo de Puxa</option>
          <option value="ESTEIRA">Cavalo de Esteira</option>
          <option value="AMBOS">Ambos (Puxa/Esteira)</option>
        </select>
      </div>

      {/* Tabela de Cavalos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
          <span>Animais Cadastrados ({cavalos.length})</span>
          <span className="text-slate-400 font-normal">Disponíveis para seleção imediata na venda</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="py-3 px-4">Nome do Animal</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Proprietário / Haras</th>
                <th className="py-3 px-4">Registro / Chip</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Carregando animais...
                  </td>
                </tr>
              ) : cavalos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhum cavalo encontrado.
                  </td>
                </tr>
              ) : (
                cavalos.map((cav) => (
                  <tr key={cav.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <span>{cav.nome}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          cav.tipo === 'PUXA'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : cav.tipo === 'ESTEIRA'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}
                      >
                        {cav.tipo === 'PUXA' ? 'DE PUXA' : cav.tipo === 'ESTEIRA' ? 'DE ESTEIRA' : 'PUXA / ESTEIRA'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {cav.proprietario || <span className="text-slate-400 italic">Não informado</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {cav.registro || cav.chip ? (
                        <span>
                          {cav.registro && `Reg: ${cav.registro}`}
                          {cav.registro && cav.chip && ' · '}
                          {cav.chip && `Chip: ${cav.chip}`}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                          cav.ativo
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {cav.ativo ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => abrirHistorico(cav)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition cursor-pointer"
                        >
                          Histórico
                        </button>
                        <button
                          onClick={() => abrirEdicao(cav)}
                          className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded text-xs font-semibold transition cursor-pointer"
                        >
                          Editar
                        </button>
                        {cav.ativo && (
                          <button
                            onClick={() => setModalDesativar(cav)}
                            className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded text-xs font-semibold transition cursor-pointer"
                          >
                            Desativar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Histórico do Cavalo */}
      {modalHistorico.aberto && modalHistorico.cavalo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Histórico do Animal: {modalHistorico.cavalo.nome}
                </h3>
                <p className="text-xs text-slate-500">
                  Tipo: {modalHistorico.cavalo.tipo} · {modalHistorico.cavalo.proprietario || 'Proprietário não informado'}
                </p>
              </div>
              <button
                onClick={() => setModalHistorico({ aberto: false, cavalo: null, senhas: [] })}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Senhas em que atuou ({modalHistorico.senhas.length})
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Senha</th>
                      <th className="py-2 px-3">Categoria</th>
                      <th className="py-2 px-3">Dupla</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modalHistorico.senhas.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">
                          Nenhuma inscrição registrada para este cavalo.
                        </td>
                      </tr>
                    ) : (
                      modalHistorico.senhas.map((s) => (
                        <tr key={s.id}>
                          <td className="py-2 px-3 font-bold text-slate-800">{s.codigo}</td>
                          <td className="py-2 px-3">{s.categoria}</td>
                          <td className="py-2 px-3 text-slate-600">
                            {s.puxador_nome} & {s.esteira_nome}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-700">{s.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalHistorico({ aberto: false, cavalo: null, senhas: [] })}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Cavalo */}
      {modalNovo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSalvarNovo} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-3.5">
            <h3 className="text-base font-bold text-slate-900">Novo Cavalo</h3>
            <p className="text-xs text-slate-500">
              Cadastre animais oficiais para vinculação de pista nas vendas de senhas.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Animal *</label>
              <input
                type="text"
                required
                placeholder="Ex: Trovão Negro"
                value={formNovo.nome}
                onChange={(e) => setFormNovo({ ...formNovo, nome: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Aptidão / Tipo *</label>
              <select
                value={formNovo.tipo}
                onChange={(e) => setFormNovo({ ...formNovo, tipo: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
              >
                <option value="PUXA">Cavalo de Puxa</option>
                <option value="ESTEIRA">Cavalo de Esteira</option>
                <option value="AMBOS">Ambos (Puxa e Esteira)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Proprietário / Haras</label>
              <input
                type="text"
                placeholder="Ex: Haras São José"
                value={formNovo.proprietario}
                onChange={(e) => setFormNovo({ ...formNovo, proprietario: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registro / R.G.</label>
                <input
                  type="text"
                  placeholder="Ex: ABQM-12345"
                  value={formNovo.registro}
                  onChange={(e) => setFormNovo({ ...formNovo, registro: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nº do Microchip</label>
                <input
                  type="text"
                  placeholder="Ex: 982000123456"
                  value={formNovo.chip}
                  onChange={(e) => setFormNovo({ ...formNovo, chip: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
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
                Cadastrar Cavalo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Editar Cavalo */}
      {modalEditar.aberto && modalEditar.cavalo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSalvarEditar} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-3.5">
            <h3 className="text-base font-bold text-slate-900">Editar Cavalo: {modalEditar.cavalo.nome}</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Animal *</label>
              <input
                type="text"
                required
                value={formEditar.nome}
                onChange={(e) => setFormEditar({ ...formEditar, nome: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Aptidão / Tipo *</label>
              <select
                value={formEditar.tipo}
                onChange={(e) => setFormEditar({ ...formEditar, tipo: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
              >
                <option value="PUXA">Cavalo de Puxa</option>
                <option value="ESTEIRA">Cavalo de Esteira</option>
                <option value="AMBOS">Ambos (Puxa e Esteira)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Proprietário / Haras</label>
              <input
                type="text"
                value={formEditar.proprietario}
                onChange={(e) => setFormEditar({ ...formEditar, proprietario: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registro / R.G.</label>
                <input
                  type="text"
                  value={formEditar.registro}
                  onChange={(e) => setFormEditar({ ...formEditar, registro: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nº do Microchip</label>
                <input
                  type="text"
                  value={formEditar.chip}
                  onChange={(e) => setFormEditar({ ...formEditar, chip: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status do Animal</label>
              <select
                value={formEditar.ativo ? 'true' : 'false'}
                onChange={(e) => setFormEditar({ ...formEditar, ativo: e.target.value === 'true' })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
              >
                <option value="true">ATIVO</option>
                <option value="false">DESATIVADO</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEditar({ aberto: false, cavalo: null })}
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

      {/* Modal Desativar */}
      {modalDesativar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Desativar Animal</h3>
              <p className="text-xs text-slate-500 mt-1">
                Deseja desativar o animal <strong className="text-slate-800">{modalDesativar.nome}</strong>?
                Ele não ficará mais disponível para novas vendas de senhas.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalDesativar(null)}
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
    </div>
  );
}

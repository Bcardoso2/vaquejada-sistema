'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';

interface Kit {
  id: string;
  vaquejada_id: string;
  codigo: string;
  criado_em: string;
}

interface Vaquejada {
  id: string;
  codigo: string;
  nome: string;
}

export default function KitsPage() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [vaquejadas, setVaquejadas] = useState<Vaquejada[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroVaquejada, setFiltroVaquejada] = useState('');

  // Notificações Toast
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const exibirToast = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 3500);
  };

  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState<{ aberto: boolean; kit: Kit | null }>({
    aberto: false,
    kit: null,
  });
  const [modalExcluir, setModalExcluir] = useState<Kit | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<Kit>>({
    vaquejada_id: '',
    codigo: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [kitsRes, vaquejadasRes] = await Promise.all([
        api.get<Kit[]>('/api/kits'),
        api.get<Vaquejada[]>('/api/vaquejadas'),
      ]);

      if (kitsRes.error) throw new Error(kitsRes.error);
      if (vaquejadasRes.error) throw new Error(vaquejadasRes.error);

      setKits(kitsRes.data || []);
      setVaquejadas(vaquejadasRes.data || []);
    } catch (err) {
      exibirToast('erro', err instanceof Error ? err.message : 'Erro ao carregar kits');
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vaquejada_id || !formData.codigo) {
      exibirToast('erro', 'Selecione a Vaquejada e digite o Código do Kit.');
      return;
    }

    if (modalEditar.aberto && modalEditar.kit) {
      const res = await api.put<Kit>(`/api/kits/${modalEditar.kit.id}`, formData as Kit);
      if (res.error) {
        exibirToast('erro', res.error);
      } else {
        exibirToast('sucesso', 'Kit atualizado com sucesso!');
        setModalEditar({ aberto: false, kit: null });
        await loadData();
      }
    } else {
      const res = await api.post<Kit>('/api/kits', formData as Kit);
      if (res.error) {
        exibirToast('erro', res.error);
      } else {
        exibirToast('sucesso', 'Kit cadastrado com sucesso!');
        setModalNovo(false);
        setFormData({ vaquejada_id: '', codigo: '' });
        await loadData();
      }
    }
  };

  const confirmarExclusao = async () => {
    if (!modalExcluir) return;
    const res = await api.delete<void>(`/api/kits/${modalExcluir.id}`);
    if (res.error) {
      exibirToast('erro', res.error);
    } else {
      exibirToast('sucesso', `Kit "${modalExcluir.codigo}" removido.`);
      setModalExcluir(null);
      await loadData();
    }
  };

  const abrirEdicao = (k: Kit) => {
    setFormData({
      vaquejada_id: k.vaquejada_id,
      codigo: k.codigo,
    });
    setModalEditar({ aberto: true, kit: k });
  };

  const mapaVaquejadas = useMemo(() => {
    const map = new Map<string, string>();
    vaquejadas.forEach((v) => map.set(v.id, v.nome));
    return map;
  }, [vaquejadas]);

  const kitsFiltrados = useMemo(() => {
    return kits.filter((k) => {
      if (filtroVaquejada && k.vaquejada_id !== filtroVaquejada) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const nomeVaq = (mapaVaquejadas.get(k.vaquejada_id) || '').toLowerCase();
        return (k.codigo || '').toLowerCase().includes(termo) || nomeVaq.includes(termo);
      }
      return true;
    });
  }, [kits, busca, filtroVaquejada, mapaVaquejadas]);

  return (
    <div className="space-y-6">
      {/* Toast Flutuante */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toast.tipo === 'sucesso'
              ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
              : 'bg-rose-950 border-rose-700 text-rose-200'
          }`}
        >
          <span>{toast.tipo === 'sucesso' ? '✅' : '❌'}</span>
          <span>{toast.mensagem}</span>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kits de Inscrição</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
              {kits.length} kits cadastrados
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Agrupamento de senhas para venda casada ou pacotes comerciais por evento
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormData({
                vaquejada_id: vaquejadas[0]?.id || '',
                codigo: '',
              });
              setModalNovo(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition shadow-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Novo Kit</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Kits</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{kits.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vaquejadas com Kits</span>
          <div className="text-2xl font-black text-indigo-700 mt-1">
            {new Set(kits.map((k) => k.vaquejada_id)).size}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Geral</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">Disponíveis</div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por código do kit ou nome da vaquejada..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            value={filtroVaquejada}
            onChange={(e) => setFiltroVaquejada(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">Todas as Vaquejadas</option>
            {vaquejadas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Kits */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-sm">Carregando kits...</div>
        ) : kitsFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-3xl block mb-2">📦</span>
            <p className="text-slate-600 font-medium">Nenhum kit encontrado.</p>
            <p className="text-slate-400 text-xs mt-1">Cadastre um novo kit ou altere os filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Código do Kit</th>
                  <th className="px-4 py-3">Vaquejada Associada</th>
                  <th className="px-4 py-3">Data de Cadastro</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kitsFiltrados.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/75 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {k.codigo}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {mapaVaquejadas.get(k.vaquejada_id) || k.vaquejada_id}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {k.criado_em ? new Date(k.criado_em).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => abrirEdicao(k)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setModalExcluir(k)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-xs font-semibold transition"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: NOVO / EDITAR KIT */}
      {(modalNovo || modalEditar.aberto) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              {modalEditar.aberto ? 'Editar Kit' : 'Cadastrar Novo Kit'}
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Associe o código comercial do kit à vaquejada correspondente
            </p>

            <form onSubmit={handleSalvar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Vaquejada *
                </label>
                <select
                  required
                  value={formData.vaquejada_id || ''}
                  onChange={(e) => setFormData({ ...formData, vaquejada_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">Selecione o Grande Prêmio</option>
                  {vaquejadas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome} ({v.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Código do Kit *
                </label>
                <input
                  type="text"
                  required
                  value={formData.codigo || ''}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Ex: KIT-OURO-01"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalNovo(false);
                    setModalEditar({ aberto: false, kit: null });
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition shadow-xs"
                >
                  {modalEditar.aberto ? 'Salvar Alterações' : 'Cadastrar Kit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO (SEM WINDOW.CONFIRM) */}
      {modalExcluir && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xl mb-3">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-slate-900">Confirmar exclusão de kit?</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              Você está prestes a remover o kit <strong>{modalExcluir.codigo}</strong>. Esta ação não poderá ser desfeita se não houver senhas atreladas.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalExcluir(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExclusao}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold transition shadow-xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
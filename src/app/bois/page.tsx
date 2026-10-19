'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';

interface Boi {
  id: string;
  numero_registro?: string;
  nome?: string;
  categoria?: string;
  peso_kg?: number;
  cor?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export default function BoisPage() {
  const [bois, setBois] = useState<Boi[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  // Notificações Toast
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const exibirToast = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 3500);
  };

  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState<{ aberto: boolean; boi: Boi | null }>({
    aberto: false,
    boi: null,
  });
  const [modalExcluir, setModalExcluir] = useState<Boi | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<Boi>>({
    numero_registro: '',
    nome: '',
    categoria: 'ABERTA',
    peso_kg: undefined,
    cor: '',
    observacoes: '',
  });

  useEffect(() => {
    loadBois();
  }, []);

  const loadBois = async () => {
    setLoading(true);
    const response = await api.get<Boi[]>('/api/bois');
    if (response.error) {
      exibirToast('erro', response.error);
    } else {
      setBois(response.data || []);
    }
    setLoading(false);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.numero_registro || !formData.nome) {
      exibirToast('erro', 'Preencha o Número de Registro e o Nome do boi.');
      return;
    }

    if (modalEditar.aberto && modalEditar.boi) {
      const res = await api.put<Boi>(`/api/bois/${modalEditar.boi.id}`, formData as Boi);
      if (res.error) {
        exibirToast('erro', res.error);
      } else {
        exibirToast('sucesso', 'Boi atualizado com sucesso!');
        setModalEditar({ aberto: false, boi: null });
        await loadBois();
      }
    } else {
      const res = await api.post<Boi>('/api/bois', formData as Boi);
      if (res.error) {
        exibirToast('erro', res.error);
      } else {
        exibirToast('sucesso', 'Boi cadastrado com sucesso!');
        setModalNovo(false);
        setFormData({
          numero_registro: '',
          nome: '',
          categoria: 'ABERTA',
          peso_kg: undefined,
          cor: '',
          observacoes: '',
        });
        await loadBois();
      }
    }
  };

  const confirmarExclusao = async () => {
    if (!modalExcluir) return;
    const res = await api.delete<void>(`/api/bois/${modalExcluir.id}`);
    if (res.error) {
      exibirToast('erro', res.error);
    } else {
      exibirToast('sucesso', `Boi #${modalExcluir.numero_registro} removido.`);
      setModalExcluir(null);
      await loadBois();
    }
  };

  const abrirEdicao = (boi: Boi) => {
    setFormData({
      numero_registro: boi.numero_registro || '',
      nome: boi.nome || '',
      categoria: boi.categoria || 'ABERTA',
      peso_kg: boi.peso_kg,
      cor: boi.cor || '',
      observacoes: boi.observacoes || '',
    });
    setModalEditar({ aberto: true, boi });
  };

  const boisFiltrados = useMemo(() => {
    return bois.filter((b) => {
      if (filtroCategoria && b.categoria !== filtroCategoria) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        return (
          (b.nome || '').toLowerCase().includes(termo) ||
          (b.numero_registro || '').toLowerCase().includes(termo) ||
          (b.cor || '').toLowerCase().includes(termo)
        );
      }
      return true;
    });
  }, [bois, busca, filtroCategoria]);

  const categorias = useMemo(() => {
    const setCat = new Set<string>();
    bois.forEach((b) => {
      if (b.categoria) setCat.add(b.categoria);
    });
    return Array.from(setCat);
  }, [bois]);

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
          {toast.tipo === 'sucesso' ? (
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{toast.mensagem}</span>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Plantel de Bois</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              {bois.length} animais cadastrados
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Controle do lote da boiada, pesagem, numeração de registro e categorias de pista
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormData({
                numero_registro: '',
                nome: '',
                categoria: 'ABERTA',
                peso_kg: undefined,
                cor: '',
                observacoes: '',
              });
              setModalNovo(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition shadow-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Novo Boi</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Bois</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{bois.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Média de Peso</span>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {bois.length > 0
              ? Math.round(
                  bois.filter((b) => b.peso_kg).reduce((acc, b) => acc + (b.peso_kg || 0), 0) /
                    (bois.filter((b) => b.peso_kg).length || 1)
                ) + ' kg'
              : '0 kg'}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Categorias Ativas</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{categorias.length || 1}</div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nome, número de registro ou pelagem..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          >
            <option value="">Todas as Categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Bois */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-sm">Carregando animais...</div>
        ) : boisFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-600 font-medium">Nenhum boi encontrado.</p>
            <p className="text-slate-400 text-xs mt-1">Cadastre um novo boi ou revise os filtros aplicados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Registro</th>
                  <th className="px-4 py-3">Nome / Identificação</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Peso</th>
                  <th className="px-4 py-3">Pelagem</th>
                  <th className="px-4 py-3">Observações</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {boisFiltrados.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/75 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      #{b.numero_registro || '-'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{b.nome || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                        {b.categoria || 'GERAL'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-600">
                      {b.peso_kg ? `${b.peso_kg} kg` : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.cor || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                      {b.observacoes || '-'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => abrirEdicao(b)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setModalExcluir(b)}
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

      {/* MODAL: NOVO / EDITAR BOI */}
      {(modalNovo || modalEditar.aberto) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              {modalEditar.aberto ? 'Editar Boi' : 'Cadastrar Novo Boi'}
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Informe os dados do animal para controle do lote oficial
            </p>

            <form onSubmit={handleSalvar} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nº Registro *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.numero_registro || ''}
                    onChange={(e) => setFormData({ ...formData, numero_registro: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="Ex: 014"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nome / Apelido *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="Ex: Mochador do Sertão"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.categoria || 'ABERTA'}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="ABERTA">Aberta</option>
                    <option value="PROFISSIONAL">Profissional</option>
                    <option value="AMADOR">Amador</option>
                    <option value="ASPIRANTE">Aspirante</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Peso (kg)
                  </label>
                  <input
                    type="number"
                    value={formData.peso_kg || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, peso_kg: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="Ex: 480"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pelagem</label>
                  <input
                    type="text"
                    value={formData.cor || ''}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="Ex: Castanho"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={formData.observacoes || ''}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Observações veterinárias ou características de corrida"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalNovo(false);
                    setModalEditar({ aberto: false, boi: null });
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition shadow-xs"
                >
                  {modalEditar.aberto ? 'Salvar Alterações' : 'Cadastrar Boi'}
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
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Confirmar exclusão de boi?</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              Você está prestes a remover o animal <strong>#{modalExcluir.numero_registro} - {modalExcluir.nome}</strong>. Esta ação não poderá ser desfeita se não houver corridas atreladas.
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
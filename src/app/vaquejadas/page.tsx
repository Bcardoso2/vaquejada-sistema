'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';

interface Vaquejada {
  id: string;
  codigo: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  local?: string;
  status: 'AGENDADA' | 'EM_ANDAMENTO' | 'ABERTA' | 'FINALIZADA' | 'CANCELADA';
  created_at: string;
  updated_at: string;
}

export default function VaquejadasPage() {
  const [vaquejadas, setVaquejadas] = useState<Vaquejada[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Notificações Toast
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const exibirToast = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 3500);
  };

  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState<{ aberto: boolean; vaquejada: Vaquejada | null }>({
    aberto: false,
    vaquejada: null,
  });
  const [modalExcluir, setModalExcluir] = useState<Vaquejada | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<Vaquejada>>({
    codigo: '',
    nome: '',
    data_inicio: '',
    data_fim: '',
    local: '',
    status: 'AGENDADA',
  });

  useEffect(() => {
    loadVaquejadas();
  }, []);

  const loadVaquejadas = async () => {
    setLoading(true);
    const response = await api.get<Vaquejada[]>('/api/vaquejadas');
    if (response.error) {
      exibirToast('erro', response.error);
    } else {
      setVaquejadas(response.data || []);
    }
    setLoading(false);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo || !formData.nome || !formData.data_inicio || !formData.data_fim) {
      exibirToast('erro', 'Preencha o Código, Nome e as Datas de Início e Fim.');
      return;
    }

    if (modalEditar.aberto && modalEditar.vaquejada) {
      const res = await api.put<Vaquejada>(`/api/vaquejadas/${modalEditar.vaquejada.id}`, formData as Vaquejada);
      if (res.error) {
        exibirToast('erro', res.error);
      } else {
        exibirToast('sucesso', 'Vaquejada atualizada com sucesso!');
        setModalEditar({ aberto: false, vaquejada: null });
        await loadVaquejadas();
      }
    } else {
      const res = await api.post<Vaquejada>('/api/vaquejadas', formData as Vaquejada);
      if (res.error) {
        exibirToast('erro', res.error);
      } else {
        exibirToast('sucesso', 'Vaquejada cadastrada com sucesso!');
        setModalNovo(false);
        setFormData({
          codigo: '',
          nome: '',
          data_inicio: '',
          data_fim: '',
          local: '',
          status: 'AGENDADA',
        });
        await loadVaquejadas();
      }
    }
  };

  const confirmarExclusao = async () => {
    if (!modalExcluir) return;
    const res = await api.delete<void>(`/api/vaquejadas/${modalExcluir.id}`);
    if (res.error) {
      exibirToast('erro', res.error);
    } else {
      exibirToast('sucesso', `Vaquejada "${modalExcluir.nome}" removida.`);
      setModalExcluir(null);
      await loadVaquejadas();
    }
  };

  const abrirEdicao = (v: Vaquejada) => {
    setFormData({
      codigo: v.codigo || '',
      nome: v.nome || '',
      data_inicio: v.data_inicio ? v.data_inicio.slice(0, 10) : '',
      data_fim: v.data_fim ? v.data_fim.slice(0, 10) : '',
      local: v.local || '',
      status: v.status || 'AGENDADA',
    });
    setModalEditar({ aberto: true, vaquejada: v });
  };

  const vaquejadasFiltradas = useMemo(() => {
    return vaquejadas.filter((v) => {
      if (filtroStatus && v.status !== filtroStatus) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        return (
          (v.nome || '').toLowerCase().includes(termo) ||
          (v.codigo || '').toLowerCase().includes(termo) ||
          (v.local || '').toLowerCase().includes(termo)
        );
      }
      return true;
    });
  }, [vaquejadas, busca, filtroStatus]);

  const badgeStatus = (status: string) => {
    switch (status) {
      case 'EM_ANDAMENTO':
      case 'ABERTA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            Em Andamento
          </span>
        );
      case 'AGENDADA':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            Agendada
          </span>
        );
      case 'FINALIZADA':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            Finalizada
          </span>
        );
      case 'CANCELADA':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
            Cancelada
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const formatarData = (dStr?: string) => {
    if (!dStr) return '-';
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch {
      return dStr;
    }
  };

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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Circuitos & Vaquejadas</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {vaquejadas.length} eventos cadastrados
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestão de grandes prêmios, calendário de competições e parâmetros de pista
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormData({
                codigo: '',
                nome: '',
                data_inicio: '',
                data_fim: '',
                local: '',
                status: 'AGENDADA',
              });
              setModalNovo(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition shadow-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Nova Vaquejada</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Eventos</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{vaquejadas.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ao Vivo / Andamento</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {vaquejadas.filter((v) => v.status === 'EM_ANDAMENTO' || v.status === 'ABERTA').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Agendadas</span>
          <div className="text-2xl font-black text-blue-700 mt-1">
            {vaquejadas.filter((v) => v.status === 'AGENDADA').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Finalizadas</span>
          <div className="text-2xl font-black text-slate-700 mt-1">
            {vaquejadas.filter((v) => v.status === 'FINALIZADA').length}
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nome do evento, código ou localidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">Todos os Status</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="AGENDADA">Agendada</option>
            <option value="FINALIZADA">Finalizada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Tabela de Vaquejadas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-sm">Carregando eventos...</div>
        ) : vaquejadasFiltradas.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-3xl block mb-2">🏆</span>
            <p className="text-slate-600 font-medium">Nenhuma vaquejada encontrada.</p>
            <p className="text-slate-400 text-xs mt-1">Cadastre uma nova vaquejada para iniciar as inscrições.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nome do Grande Prêmio</th>
                  <th className="px-4 py-3">Local / Parque</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vaquejadasFiltradas.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/75 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {v.codigo || '-'}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{v.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{v.local || 'Parque de Vaquejada'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                      {formatarData(v.data_inicio)} até {formatarData(v.data_fim)}
                    </td>
                    <td className="px-4 py-3">{badgeStatus(v.status)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => abrirEdicao(v)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setModalExcluir(v)}
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

      {/* MODAL: NOVA / EDITAR VAQUEJADA */}
      {(modalNovo || modalEditar.aberto) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              {modalEditar.aberto ? 'Editar Vaquejada' : 'Cadastrar Nova Vaquejada'}
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Defina as informações gerais e o período de realização do evento
            </p>

            <form onSubmit={handleSalvar} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Código *</label>
                  <input
                    type="text"
                    required
                    value={formData.codigo || ''}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="VQ-2026"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome do Evento *</label>
                  <input
                    type="text"
                    required
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="Ex: Grande Vaquejada de Lagarto"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Local / Parque</label>
                <input
                  type="text"
                  value={formData.local || ''}
                  onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Ex: Parque das Palmeiras - Lagarto/SE"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Data Início *</label>
                  <input
                    type="date"
                    required
                    value={formData.data_inicio || ''}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Data Fim *</label>
                  <input
                    type="date"
                    required
                    value={formData.data_fim || ''}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Situação / Status</label>
                <select
                  value={formData.status || 'AGENDADA'}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as Vaquejada['status'] })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="AGENDADA">Agendada</option>
                  <option value="EM_ANDAMENTO">Em Andamento</option>
                  <option value="FINALIZADA">Finalizada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalNovo(false);
                    setModalEditar({ aberto: false, vaquejada: null });
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition shadow-xs"
                >
                  {modalEditar.aberto ? 'Salvar Alterações' : 'Cadastrar Vaquejada'}
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
            <h3 className="text-lg font-bold text-slate-900">Confirmar exclusão da vaquejada?</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              Você está prestes a remover o evento <strong>{modalExcluir.nome} ({modalExcluir.codigo})</strong>. Esta ação não poderá ser desfeita se não houver senhas associadas.
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
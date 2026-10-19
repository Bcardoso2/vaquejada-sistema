'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';

interface Oportunidade {
  id: string;
  vaquejada_id: string;
  boi_id: string;
  senha_origem_id?: string;
  disponivel: boolean;
  criado_em: string;
}

interface Vaquejada {
  id: string;
  codigo: string;
  nome: string;
}

interface Boi {
  id: string;
  numero_registro?: string;
  nome?: string;
}

interface Senha {
  id: string;
  codigo: string;
}

export default function OportunidadesPage() {
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [vaquejadas, setVaquejadas] = useState<Vaquejada[]>([]);
  const [bois, setBois] = useState<Boi[]>([]);
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroDisponivel, setFiltroDisponivel] = useState<string>('');

  // Notificações Toast
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const exibirToast = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 3500);
  };

  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState<{ aberto: boolean; oportunidade: Oportunidade | null }>({
    aberto: false,
    oportunidade: null,
  });
  const [modalExcluir, setModalExcluir] = useState<Oportunidade | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<Oportunidade>>({
    vaquejada_id: '',
    boi_id: '',
    senha_origem_id: '',
    disponivel: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [oportunidadesRes, vaquejadasRes, boisRes, senhasRes] = await Promise.all([
        api.get<Oportunidade[]>('/api/oportunidades'),
        api.get<Vaquejada[]>('/api/vaquejadas'),
        api.get<Boi[]>('/api/bois'),
        api.get<Senha[]>('/api/senhas'),
      ]);

      if (oportunidadesRes.error) throw new Error(oportunidadesRes.error);
      if (vaquejadasRes.error) throw new Error(vaquejadasRes.error);
      if (boisRes.error) throw new Error(boisRes.error);

      setOportunidades(oportunidadesRes.data || []);
      setVaquejadas(vaquejadasRes.data || []);
      setBois(boisRes.data || []);
      setSenhas(senhasRes.data || []);
    } catch (err) {
      exibirToast('erro', err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vaquejada_id || !formData.boi_id) {
      exibirToast('erro', 'Selecione a Vaquejada e o Boi correspondente.');
      return;
    }

    if (modalEditar.aberto && modalEditar.oportunidade) {
      const res = await api.put<Oportunidade>(
        `/api/oportunidades/${modalEditar.oportunidade.id}`,
        formData as Oportunidade
      );
      if (res.error) {
        exibirToast('erro', res.error);
      } else {
        exibirToast('sucesso', 'Oportunidade atualizada com sucesso!');
        setModalEditar({ aberto: false, oportunidade: null });
        await loadData();
      }
    } else {
      const res = await api.post<Oportunidade>('/api/oportunidades', formData as Oportunidade);
      if (res.error) {
        exibirToast('erro', res.error);
      } else {
        exibirToast('sucesso', 'Oportunidade cadastrada com sucesso!');
        setModalNovo(false);
        setFormData({
          vaquejada_id: '',
          boi_id: '',
          senha_origem_id: '',
          disponivel: true,
        });
        await loadData();
      }
    }
  };

  const confirmarExclusao = async () => {
    if (!modalExcluir) return;
    const res = await api.delete<void>(`/api/oportunidades/${modalExcluir.id}`);
    if (res.error) {
      exibirToast('erro', res.error);
    } else {
      exibirToast('sucesso', 'Oportunidade removida com sucesso.');
      setModalExcluir(null);
      await loadData();
    }
  };

  const abrirEdicao = (op: Oportunidade) => {
    setFormData({
      vaquejada_id: op.vaquejada_id,
      boi_id: op.boi_id,
      senha_origem_id: op.senha_origem_id || '',
      disponivel: op.disponivel,
    });
    setModalEditar({ aberto: true, oportunidade: op });
  };

  const mapaBois = useMemo(() => {
    const map = new Map<string, string>();
    bois.forEach((b) => map.set(b.id, `#${b.numero_registro || ''} ${b.nome || ''}`));
    return map;
  }, [bois]);

  const mapaVaquejadas = useMemo(() => {
    const map = new Map<string, string>();
    vaquejadas.forEach((v) => map.set(v.id, v.nome));
    return map;
  }, [vaquejadas]);

  const mapaSenhas = useMemo(() => {
    const map = new Map<string, string>();
    senhas.forEach((s) => map.set(s.id, s.codigo));
    return map;
  }, [senhas]);

  const oportunidadesFiltradas = useMemo(() => {
    return oportunidades.filter((op) => {
      if (filtroDisponivel === 'true' && !op.disponivel) return false;
      if (filtroDisponivel === 'false' && op.disponivel) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const nomeBoi = (mapaBois.get(op.boi_id) || '').toLowerCase();
        const codigoSenha = (mapaSenhas.get(op.senha_origem_id || '') || '').toLowerCase();
        return nomeBoi.includes(termo) || codigoSenha.includes(termo);
      }
      return true;
    });
  }, [oportunidades, busca, filtroDisponivel, mapaBois, mapaSenhas]);

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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Oportunidades de Boi</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              {oportunidades.length} registros
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerenciamento de bois de repescagem e oportunidades de nova corrida por desclassificação
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormData({
                vaquejada_id: vaquejadas[0]?.id || '',
                boi_id: bois[0]?.id || '',
                senha_origem_id: '',
                disponivel: true,
              });
              setModalNovo(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition shadow-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Nova Oportunidade</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Registradas</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{oportunidades.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Disponíveis</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {oportunidades.filter((o) => o.disponivel).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Já Utilizadas</span>
          <div className="text-2xl font-black text-slate-600 mt-1">
            {oportunidades.filter((o) => !o.disponivel).length}
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por identificação do boi ou senha de origem..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={filtroDisponivel}
            onChange={(e) => setFiltroDisponivel(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">Todos os Status</option>
            <option value="true">Apenas Disponíveis</option>
            <option value="false">Apenas Utilizadas</option>
          </select>
        </div>
      </div>

      {/* Tabela de Oportunidades */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-sm">Carregando oportunidades...</div>
        ) : oportunidadesFiltradas.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-3xl block mb-2">🔄</span>
            <p className="text-slate-600 font-medium">Nenhuma oportunidade localizada.</p>
            <p className="text-slate-400 text-xs mt-1">Gere novas oportunidades a partir de corridas da pista.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Boi de Pista</th>
                  <th className="px-4 py-3">Senha Origem</th>
                  <th className="px-4 py-3">Vaquejada</th>
                  <th className="px-4 py-3">Disponibilidade</th>
                  <th className="px-4 py-3">Registrado em</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {oportunidadesFiltradas.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50/75 transition">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {mapaBois.get(op.boi_id) || op.boi_id}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-800">
                      {op.senha_origem_id ? `#${mapaSenhas.get(op.senha_origem_id) || op.senha_origem_id}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {mapaVaquejadas.get(op.vaquejada_id) || op.vaquejada_id}
                    </td>
                    <td className="px-4 py-3">
                      {op.disponivel ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Disponível
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                          Utilizada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {op.criado_em ? new Date(op.criado_em).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => abrirEdicao(op)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setModalExcluir(op)}
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

      {/* MODAL: NOVA / EDITAR OPORTUNIDADE */}
      {(modalNovo || modalEditar.aberto) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              {modalEditar.aberto ? 'Editar Oportunidade' : 'Nova Oportunidade de Boi'}
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Vincule o boi e a senha de origem para liberação em pista
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
                  <option value="">Selecione a Vaquejada</option>
                  {vaquejadas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Boi *</label>
                <select
                  required
                  value={formData.boi_id || ''}
                  onChange={(e) => setFormData({ ...formData, boi_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">Selecione o Boi</option>
                  {bois.map((b) => (
                    <option key={b.id} value={b.id}>
                      #{b.numero_registro || ''} {b.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Senha de Origem (Opcional)
                </label>
                <select
                  value={formData.senha_origem_id || ''}
                  onChange={(e) => setFormData({ ...formData, senha_origem_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">Nenhuma senha vinculada</option>
                  {senhas.map((s) => (
                    <option key={s.id} value={s.id}>
                      Senha #{s.codigo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkDisponivel"
                  checked={formData.disponivel ?? true}
                  onChange={(e) => setFormData({ ...formData, disponivel: e.target.checked })}
                  className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                />
                <label htmlFor="chkDisponivel" className="text-sm font-semibold text-slate-700">
                  Disponível para nova corrida / venda
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalNovo(false);
                    setModalEditar({ aberto: false, oportunidade: null });
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition shadow-xs"
                >
                  {modalEditar.aberto ? 'Salvar Alterações' : 'Cadastrar Oportunidade'}
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
            <h3 className="text-lg font-bold text-slate-900">Confirmar exclusão de oportunidade?</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              Você está prestes a remover o registro de oportunidade do animal <strong>{mapaBois.get(modalExcluir.boi_id) || modalExcluir.boi_id}</strong>.
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
'use client';

import { useState, useEffect } from 'react';
import { validarCpf, formatarCpf } from '@/lib/cpf';

interface Competidor {
  id: string;
  nome: string;
  apelido_pista: string;
  cpf: string;
  cidade: string;
  uf: string;
  telefone: string;
  categoria: string;
  carteira_federacao: string | null;
  ativo: boolean;
  criado_em: string;
}

interface HistoricoCompetidor {
  competidor: Competidor;
  estatisticas: {
    totalSenhas: number;
    totalCorridas: number;
    totalBoisValidos: number;
    totalBoisZero: number;
    aproveitamentoPercentual: number;
  };
  historicoSenhas: any[];
  historicoCorridas: any[];
}

export default function CompetidoresPage() {
  const [competidores, setCompetidores] = useState<Competidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  // Notificações Toast
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const exibirToast = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState<{ aberto: boolean; competidor: Competidor | null }>({
    aberto: false,
    competidor: null,
  });
  const [modalHistorico, setModalHistorico] = useState<{ aberto: boolean; dados: HistoricoCompetidor | null; loading: boolean }>({
    aberto: false,
    dados: null,
    loading: false,
  });
  const [modalDesativar, setModalDesativar] = useState<Competidor | null>(null);

  // Forms
  const [formNovo, setFormNovo] = useState({
    nome: '',
    apelido_pista: '',
    cpf: '',
    cidade: '',
    uf: 'PE',
    telefone: '',
    categoria: 'ABERTA',
    carteira_federacao: '',
  });

  const [formEditar, setFormEditar] = useState({
    nome: '',
    apelido_pista: '',
    cpf: '',
    cidade: '',
    uf: '',
    telefone: '',
    categoria: 'ABERTA',
    carteira_federacao: '',
    ativo: true,
  });

  const carregarCompetidores = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (busca.trim()) params.set('q', busca.trim());
      if (filtroCategoria) params.set('categoria', filtroCategoria);

      const res = await fetch(`/api/competidores?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCompetidores(Array.isArray(data) ? data : []);
      } else {
        exibirToast('erro', 'Falha ao buscar competidores.');
      }
    } catch {
      exibirToast('erro', 'Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarCompetidores();
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, filtroCategoria]);

  const handleSalvarNovo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarCpf(formNovo.cpf)) {
      exibirToast('erro', 'CPF inválido! Verifique os 11 dígitos e dígitos verificadores.');
      return;
    }

    try {
      const res = await fetch('/api/competidores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formNovo),
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast('sucesso', `Competidor "${data.competidor?.nome}" cadastrado com sucesso.`);
        setModalNovo(false);
        setFormNovo({
          nome: '',
          apelido_pista: '',
          cpf: '',
          cidade: '',
          uf: 'PE',
          telefone: '',
          categoria: 'ABERTA',
          carteira_federacao: '',
        });
        await carregarCompetidores();
      } else {
        exibirToast('erro', data.error || 'Erro ao cadastrar competidor.');
      }
    } catch {
      exibirToast('erro', 'Erro ao conectar ao servidor.');
    }
  };

  const handleSalvarEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar.competidor) return;

    if (formEditar.cpf && !validarCpf(formEditar.cpf)) {
      exibirToast('erro', 'CPF inválido!');
      return;
    }

    try {
      const res = await fetch(`/api/competidores/${modalEditar.competidor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEditar),
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast('sucesso', 'Cadastro do competidor atualizado.');
        setModalEditar({ aberto: false, competidor: null });
        await carregarCompetidores();
      } else {
        exibirToast('erro', data.error || 'Erro ao atualizar.');
      }
    } catch {
      exibirToast('erro', 'Erro ao conectar ao servidor.');
    }
  };

  const abrirHistorico = async (comp: Competidor) => {
    setModalHistorico({ aberto: true, dados: null, loading: true });
    try {
      const res = await fetch(`/api/competidores/${comp.id}`);
      if (res.ok) {
        const dados = await res.json();
        setModalHistorico({ aberto: true, dados, loading: false });
      } else {
        exibirToast('erro', 'Falha ao buscar histórico do competidor.');
        setModalHistorico({ aberto: false, dados: null, loading: false });
      }
    } catch {
      exibirToast('erro', 'Erro ao conectar com o servidor.');
      setModalHistorico({ aberto: false, dados: null, loading: false });
    }
  };

  const confirmarDesativacao = async () => {
    if (!modalDesativar) return;
    try {
      const res = await fetch(`/api/competidores/${modalDesativar.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast('sucesso', `Competidor "${modalDesativar.nome}" desativado.`);
        setModalDesativar(null);
        await carregarCompetidores();
      } else {
        exibirToast('erro', data.error || 'Erro ao desativar.');
      }
    } catch {
      exibirToast('erro', 'Erro de conexão.');
    }
  };

  const abrirEdicao = (c: Competidor) => {
    setModalEditar({ aberto: true, competidor: c });
    setFormEditar({
      nome: c.nome,
      apelido_pista: c.apelido_pista || '',
      cpf: c.cpf,
      cidade: c.cidade || '',
      uf: c.uf || '',
      telefone: c.telefone || '',
      categoria: c.categoria || 'ABERTA',
      carteira_federacao: c.carteira_federacao || '',
      ativo: c.ativo,
    });
  };

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
          <button onClick={() => setToast(null)} className="ml-2 text-white/60 hover:text-white font-bold cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cadastro Oficial de Competidores</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              Vaqueiros & Esteireiros
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestão de vaqueiros, CPFs validados, histórico completo de senhas e aproveitamento na pista
          </p>
        </div>

        <button
          onClick={() => setModalNovo(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>+</span> Novo Competidor
        </button>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar por nome, apelido de pista ou CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg p-2.5 pl-8 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
        </div>

        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-700 font-medium"
        >
          <option value="">Todas as Categorias</option>
          <option value="ABERTA">Aberta</option>
          <option value="PROFISSIONAL">Profissional</option>
          <option value="AMADOR">Amador</option>
          <option value="ASPIRANTE">Aspirante</option>
          <option value="FEMININO">Feminino</option>
          <option value="MASTER">Master</option>
        </select>
      </div>

      {/* Tabela de Competidores */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
          <span>Competidores Cadastrados ({competidores.length})</span>
          <span className="text-slate-400 font-normal">CPFs protegidos conforme permissão de perfil</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="py-3 px-4">Competidor</th>
                <th className="py-3 px-4">Apelido de Pista</th>
                <th className="py-3 px-4">CPF</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Carregando competidores...
                  </td>
                </tr>
              ) : competidores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhum competidor encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                competidores.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                          {c.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{c.nome}</div>
                          {c.carteira_federacao && (
                            <div className="text-[10px] text-slate-400 font-mono">Cart: {c.carteira_federacao}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {c.apelido_pista ? `"${c.apelido_pista}"` : <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{c.cpf}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {c.categoria}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {c.cidade ? `${c.cidade}/${c.uf}` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                          c.ativo
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {c.ativo ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => abrirHistorico(c)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition cursor-pointer"
                          title="Ver histórico de senhas, corridas e aproveitamento"
                        >
                          Histórico
                        </button>
                        <button
                          onClick={() => abrirEdicao(c)}
                          className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded text-xs font-semibold transition cursor-pointer"
                        >
                          Editar
                        </button>
                        {c.ativo && (
                          <button
                            onClick={() => setModalDesativar(c)}
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

      {/* Modal Histórico Completo do Competidor */}
      {modalHistorico.aberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Ficha do Competidor: {modalHistorico.dados?.competidor?.nome}
                </h3>
                <p className="text-xs text-slate-500">
                  {modalHistorico.dados?.competidor?.apelido_pista && `"${modalHistorico.dados?.competidor?.apelido_pista}" · `}
                  {modalHistorico.dados?.competidor?.categoria} · CPF: {modalHistorico.dados?.competidor?.cpf}
                </p>
              </div>
              <button
                onClick={() => setModalHistorico({ aberto: false, dados: null, loading: false })}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            {modalHistorico.loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Carregando histórico do competidor...</div>
            ) : modalHistorico.dados ? (
              <div className="space-y-4">
                {/* Cards de Desempenho */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Senhas</div>
                    <div className="text-lg font-bold text-slate-900">
                      {modalHistorico.dados.estatisticas.totalSenhas}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Corridas</div>
                    <div className="text-lg font-bold text-slate-900">
                      {modalHistorico.dados.estatisticas.totalCorridas}
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Bois Valeu</div>
                    <div className="text-lg font-bold text-emerald-800">
                      {modalHistorico.dados.estatisticas.totalBoisValidos}
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <div className="text-[10px] font-bold text-amber-700 uppercase">Aproveitamento</div>
                    <div className="text-lg font-bold text-amber-900">
                      {modalHistorico.dados.estatisticas.aproveitamentoPercentual}%
                    </div>
                  </div>
                </div>

                {/* Histórico de Corridas / Pista */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">
                    Histórico de Pista ({modalHistorico.dados.historicoCorridas.length})
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Senha</th>
                          <th className="py-2 px-3">Boi</th>
                          <th className="py-2 px-3">Status Pista</th>
                          <th className="py-2 px-3">Resultado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {modalHistorico.dados.historicoCorridas.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-400">
                              Nenhuma corrida registrada na pista até o momento.
                            </td>
                          </tr>
                        ) : (
                          modalHistorico.dados.historicoCorridas.map((cor) => (
                            <tr key={cor.corrida_id}>
                              <td className="py-2 px-3 font-bold text-slate-800">{cor.senha_codigo}</td>
                              <td className="py-2 px-3">Boi Nº {cor.boi_numero}</td>
                              <td className="py-2 px-3 text-slate-600">{cor.status_corrida}</td>
                              <td className="py-2 px-3 font-bold">
                                {cor.resultado_final === 'VALEU' ? (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    VALEU
                                  </span>
                                ) : cor.resultado_final === 'ZERO' ? (
                                  <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                    ZERO
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">Pendente</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Histórico de Inscrições / Senhas */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">
                    Senhas e Inscrições ({modalHistorico.dados.historicoSenhas.length})
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Senha</th>
                          <th className="py-2 px-3">Papel</th>
                          <th className="py-2 px-3">Dupla & Cavalo</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {modalHistorico.dados.historicoSenhas.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-400">
                              Nenhuma inscrição encontrada.
                            </td>
                          </tr>
                        ) : (
                          modalHistorico.dados.historicoSenhas.map((s) => (
                            <tr key={s.id}>
                              <td className="py-2 px-3 font-bold text-slate-800">{s.codigo}</td>
                              <td className="py-2 px-3 font-semibold text-slate-700">{s.papel_dupla}</td>
                              <td className="py-2 px-3 text-slate-600">
                                {s.puxador_nome} & {s.esteira_nome} ({s.cavalo_nome || 'Cavalo s/ inf'})
                              </td>
                              <td className="py-2 px-3">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalHistorico({ aberto: false, dados: null, loading: false })}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Competidor */}
      {modalNovo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSalvarNovo} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-3.5">
            <h3 className="text-base font-bold text-slate-900">Novo Competidor</h3>
            <p className="text-xs text-slate-500">
              Cadastre vaqueiros com validação estrita de CPF único para emissão de senhas oficiais.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                placeholder="Ex: José da Silva"
                value={formNovo.nome}
                onChange={(e) => setFormNovo({ ...formNovo, nome: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Apelido de Pista</label>
                <input
                  type="text"
                  placeholder="Ex: Zé do Brejo"
                  value={formNovo.apelido_pista}
                  onChange={(e) => setFormNovo({ ...formNovo, apelido_pista: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CPF (11 dígitos) *</label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={formNovo.cpf}
                  onChange={(e) => setFormNovo({ ...formNovo, cpf: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  placeholder="Ex: Caruaru"
                  value={formNovo.cidade}
                  onChange={(e) => setFormNovo({ ...formNovo, cidade: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">UF</label>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="PE"
                  value={formNovo.uf}
                  onChange={(e) => setFormNovo({ ...formNovo, uf: e.target.value.toUpperCase() })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(81) 99999-9999"
                  value={formNovo.telefone}
                  onChange={(e) => setFormNovo({ ...formNovo, telefone: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria *</label>
                <select
                  value={formNovo.categoria}
                  onChange={(e) => setFormNovo({ ...formNovo, categoria: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="ABERTA">Aberta</option>
                  <option value="PROFISSIONAL">Profissional</option>
                  <option value="AMADOR">Amador</option>
                  <option value="ASPIRANTE">Aspirante</option>
                  <option value="FEMININO">Feminino</option>
                  <option value="MASTER">Master</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Carteira de Federação (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: ABVAQ-12345"
                value={formNovo.carteira_federacao}
                onChange={(e) => setFormNovo({ ...formNovo, carteira_federacao: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
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
                Cadastrar Competidor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Editar Competidor */}
      {modalEditar.aberto && modalEditar.competidor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSalvarEditar} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-3.5">
            <h3 className="text-base font-bold text-slate-900">Editar Competidor</h3>

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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Apelido de Pista</label>
                <input
                  type="text"
                  value={formEditar.apelido_pista}
                  onChange={(e) => setFormEditar({ ...formEditar, apelido_pista: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CPF</label>
                <input
                  type="text"
                  value={formEditar.cpf}
                  onChange={(e) => setFormEditar({ ...formEditar, cpf: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  value={formEditar.cidade}
                  onChange={(e) => setFormEditar({ ...formEditar, cidade: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">UF</label>
                <input
                  type="text"
                  maxLength={2}
                  value={formEditar.uf}
                  onChange={(e) => setFormEditar({ ...formEditar, uf: e.target.value.toUpperCase() })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone</label>
                <input
                  type="text"
                  value={formEditar.telefone}
                  onChange={(e) => setFormEditar({ ...formEditar, telefone: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
                <select
                  value={formEditar.categoria}
                  onChange={(e) => setFormEditar({ ...formEditar, categoria: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="ABERTA">Aberta</option>
                  <option value="PROFISSIONAL">Profissional</option>
                  <option value="AMADOR">Amador</option>
                  <option value="ASPIRANTE">Aspirante</option>
                  <option value="FEMININO">Feminino</option>
                  <option value="MASTER">Master</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status do Cadastro</label>
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
                onClick={() => setModalEditar({ aberto: false, competidor: null })}
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

      {/* Modal Confirmar Desativação */}
      {modalDesativar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xl font-bold mx-auto">
              ⚠️
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Desativar Competidor</h3>
              <p className="text-xs text-slate-500 mt-1">
                Deseja desativar o cadastro de <strong className="text-slate-800">{modalDesativar.nome}</strong>?
                Ele não aparecerá mais para novas vendas de senhas.
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

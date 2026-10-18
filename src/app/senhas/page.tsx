'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface Senha {
  id: string;
  kit_id: string;
  kit_codigo?: string;
  codigo: string;
  puxador_nome?: string;
  esteira_nome?: string;
  categoria?: string;
  tipo_venda?: string;
  canal_venda?: string;
  estado_comercial?: string;
  valor_centavos?: number;
  boi1_id?: string;
  boi1_nome?: string;
  boi1_registro?: string;
  boi2_id?: string;
  boi2_nome?: string;
  boi2_registro?: string;
  status: 'ATIVA' | 'USADA' | 'CANCELADA';
  criado_em: string;
  usada_em?: string;
}

interface Boi {
  id: string;
  numero_registro?: string;
  nome?: string;
  categoria?: string;
  status?: string;
}

export default function SenhasPage() {
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [bois, setBois] = useState<Boi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');

  // Modal de Edição Operacional
  const [senhaEditando, setSenhaEditando] = useState<Senha | null>(null);
  const [formPuxador, setFormPuxador] = useState('');
  const [formEsteira, setFormEsteira] = useState('');
  const [formCategoria, setFormCategoria] = useState('');
  const [formStatus, setFormStatus] = useState<'ATIVA' | 'USADA' | 'CANCELADA'>('ATIVA');
  const [formBoi1, setFormBoi1] = useState('');
  const [formBoi2, setFormBoi2] = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Modal de Nova Senha
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novoPuxador, setNovoPuxador] = useState('');
  const [novoEsteira, setNovoEsteira] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('ABERTA');
  const [novoTipo, setNovoTipo] = useState('SOLTEIRA');
  const [novoValor, setNovoValor] = useState(350);
  const [novoBoi1, setNovoBoi1] = useState('');
  const [novoBoi2, setNovoBoi2] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  const [competidores, setCompetidores] = useState<{ id: string; nome: string; apelido_pista?: string }[]>([]);
  const [cavalos, setCavalos] = useState<{ id: string; nome: string; tipo: string }[]>([]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resSenhas, resBois, resComp, resCav] = await Promise.all([
        fetch('/api/senhas?limit=200'),
        fetch('/api/bois'),
        fetch('/api/competidores?ativo=true'),
        fetch('/api/cavalos?ativo=true')
      ]);

      if (!resSenhas.ok) throw new Error('Falha ao buscar lista de senhas');
      const dadosSenhas = await resSenhas.json();
      setSenhas(Array.isArray(dadosSenhas) ? dadosSenhas : []);

      if (resBois.ok) {
        const dadosBois = await resBois.json();
        setBois(Array.isArray(dadosBois) ? dadosBois : []);
      }
      if (resComp.ok) {
        const dadosComp = await resComp.json();
        if (Array.isArray(dadosComp)) setCompetidores(dadosComp);
      }
      if (resCav.ok) {
        const dadosCav = await resCav.json();
        if (Array.isArray(dadosCav)) setCavalos(dadosCav);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };


  // Filtragem
  const senhasFiltradas = useMemo(() => {
    return senhas.filter((s) => {
      if (filtroCategoria !== 'TODAS' && s.categoria !== filtroCategoria) return false;
      if (filtroStatus !== 'TODOS' && s.status !== filtroStatus) return false;
      if (filtroTipo !== 'TODOS' && s.tipo_venda !== filtroTipo) return false;

      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const cod = (s.codigo || '').toLowerCase();
        const puxador = (s.puxador_nome || '').toLowerCase();
        const esteira = (s.esteira_nome || '').toLowerCase();
        const kitCod = (s.kit_codigo || '').toLowerCase();
        if (!cod.includes(termo) && !puxador.includes(termo) && !esteira.includes(termo) && !kitCod.includes(termo)) {
          return false;
        }
      }
      return true;
    });
  }, [senhas, busca, filtroCategoria, filtroStatus, filtroTipo]);

  // KPIs
  const kpis = useMemo(() => {
    const total = senhas.length;
    const ativas = senhas.filter(s => s.status === 'ATIVA').length;
    const usadas = senhas.filter(s => s.status === 'USADA').length;
    const canceladas = senhas.filter(s => s.status === 'CANCELADA').length;
    const faturamentoCentavos = senhas
      .filter(s => s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.valor_centavos || 0), 0);

    return { total, ativas, usadas, canceladas, faturamentoCentavos };
  }, [senhas]);

  const abrirEdicao = (s: Senha) => {
    setSenhaEditando(s);
    setFormPuxador(s.puxador_nome || '');
    setFormEsteira(s.esteira_nome || '');
    setFormCategoria(s.categoria || 'ABERTA');
    setFormStatus(s.status || 'ATIVA');
    setFormBoi1(s.boi1_id || '');
    setFormBoi2(s.boi2_id || '');
    setFormMotivo('');
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaEditando) return;

    try {
      setSalvandoEdicao(true);
      const res = await fetch('/api/senhas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: senhaEditando.id,
          puxadorNome: formPuxador,
          esteiraNome: formEsteira,
          categoria: formCategoria,
          status: formStatus,
          boi1Id: formBoi1 || null,
          boi2Id: formBoi2 || null,
          motivoAlteracao: formMotivo || 'Ajuste operacional de vaqueiro/boi'
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao atualizar senha');
      }

      setMensagemSucesso(`Senha ${senhaEditando.codigo} atualizada com sucesso!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
      setSenhaEditando(null);
      await carregarDados();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar alterações');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleCancelarSenha = async (s: Senha) => {
    if (!confirm(`Confirma o cancelamento da senha ${s.codigo} (${s.puxador_nome || 'Sem vaqueiro'})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/senhas?id=${s.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao cancelar senha');
      }

      setMensagemSucesso(`Senha ${s.codigo} cancelada.`);
      setTimeout(() => setMensagemSucesso(null), 4000);
      await carregarDados();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar');
    }
  };

  const handleCriarNovaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCodigo.trim()) {
      alert('Informe o código da senha');
      return;
    }

    try {
      setSalvandoNovo(true);
      const res = await fetch('/api/senhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: novoCodigo.toUpperCase(),
          puxadorNome: novoPuxador,
          esteiraNome: novoEsteira,
          categoria: novaCategoria,
          tipoVenda: novoTipo,
          valorCentavos: novoValor * 100,
          boi1Id: novoBoi1 || null,
          boi2Id: novoBoi2 || null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao criar senha');
      }

      setMensagemSucesso(`Senha ${novoCodigo.toUpperCase()} criada com sucesso!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
      setModalNovoAberto(false);
      setNovoCodigo('');
      setNovoPuxador('');
      setNovoEsteira('');
      await carregarDados();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar senha');
    } finally {
      setSalvandoNovo(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-12">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">Gestão de Senhas</h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                Operacional Ativo
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Organização de inscrições, categorias, duplas de vaqueiros, bois e status de pista
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/secretaria"
              className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
            >
              Ir para Secretaria (Vendas)
            </Link>
            <button
              onClick={() => setModalNovoAberto(true)}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 transition"
            >
              + Nova Senha Manual
            </button>
            <button
              onClick={carregarDados}
              title="Recarregar"
              className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Notificação de Sucesso */}
        {mensagemSucesso && (
          <div className="p-4 bg-emerald-50 border-l-4 border-emerald-600 rounded text-emerald-800 text-xs font-medium flex items-center justify-between">
            <span>{mensagemSucesso}</span>
            <button onClick={() => setMensagemSucesso(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">✕</button>
          </div>
        )}

        {/* KPIs Executivos */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded p-4">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Total Senhas</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{kpis.total}</span>
            <span className="text-[10px] text-slate-400">Inscrições cadastradas</span>
          </div>

          <div className="bg-white border border-slate-200 rounded p-4">
            <span className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider block">Senhas Ativas</span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">{kpis.ativas}</span>
            <span className="text-[10px] text-slate-400">Prontas para correr</span>
          </div>

          <div className="bg-white border border-slate-200 rounded p-4">
            <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wider block">Usadas / Pista</span>
            <span className="text-2xl font-bold text-blue-700 mt-1 block">{kpis.usadas}</span>
            <span className="text-[10px] text-slate-400">Correram ou em andamento</span>
          </div>

          <div className="bg-white border border-slate-200 rounded p-4">
            <span className="text-[11px] font-medium text-rose-600 uppercase tracking-wider block">Canceladas</span>
            <span className="text-2xl font-bold text-rose-700 mt-1 block">{kpis.canceladas}</span>
            <span className="text-[10px] text-slate-400">Inscrições invalidadas</span>
          </div>

          <div className="bg-white border border-slate-200 rounded p-4 col-span-2 md:col-span-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Faturamento</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {(kpis.faturamentoCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[10px] text-slate-400">Senhas válidas</span>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Buscar por Código ou Vaqueiro
              </label>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex: SN-001, Carlos, Zé..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Categoria
              </label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="TODAS">Todas as Categorias</option>
                <option value="PROFISSIONAL">Profissional</option>
                <option value="AMADOR">Amador</option>
                <option value="ASPIRANTE">Aspirante</option>
                <option value="ABERTA">Aberta</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Status na Pista
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="ATIVA">Ativa</option>
                <option value="USADA">Usada / Em Pista</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Tipo de Emissão
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="TODOS">Todos os Tipos</option>
                <option value="KIT">Kit Duplo</option>
                <option value="SOLTEIRA">Senha Solteira</option>
              </select>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Exibindo <strong>{senhasFiltradas.length}</strong> de <strong>{senhas.length}</strong> senhas cadastradas
            </span>
            {(busca || filtroCategoria !== 'TODAS' || filtroStatus !== 'TODOS' || filtroTipo !== 'TODOS') && (
              <button
                onClick={() => {
                  setBusca('');
                  setFiltroCategoria('TODAS');
                  setFiltroStatus('TODOS');
                  setFiltroTipo('TODOS');
                }}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        </div>

        {/* Tabela Executiva de Senhas */}
        <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              Carregando mapa de senhas...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-rose-600 text-xs">
              {error}
            </div>
          ) : senhasFiltradas.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Nenhuma senha encontrada para os critérios selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-3 px-4">Senha / Kit</th>
                    <th className="py-3 px-4">Vaqueiros (Puxador & Esteira)</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Bois Alocados (1º e 2º Boi)</th>
                    <th className="py-3 px-4">Comercial / Valor</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações Operacionais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {senhasFiltradas.map((s) => {
                    const boi1Texto = s.boi1_nome || s.boi1_registro || (s.boi1_id ? `Boi #${s.boi1_id}` : 'Pendente');
                    const boi2Texto = s.boi2_nome || s.boi2_registro || (s.boi2_id ? `Boi #${s.boi2_id}` : 'Pendente');

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition">
                        {/* Senha / Kit */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm">{s.codigo}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                              s.tipo_venda === 'KIT'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}>
                              {s.tipo_venda === 'KIT' ? 'Kit Duplo' : 'Solteira'}
                            </span>
                            {s.kit_codigo && (
                              <span className="text-[10px] text-slate-400">({s.kit_codigo})</span>
                            )}
                          </div>
                        </td>

                        {/* Puxador, Esteira e Cavalo */}
                        <td className="py-3 px-4">
                          <div className="text-slate-900 font-medium">
                            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Puxador:</span>
                            {s.puxador_nome || <span className="text-slate-400 italic">Não informado</span>}
                            {(s as any).puxador_apelido && (
                              <span className="text-slate-500 text-[11px] ml-1 font-normal font-sans">
                                "{(s as any).puxador_apelido}"
                              </span>
                            )}
                          </div>
                          <div className="text-slate-600 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Esteira:</span>
                            {s.esteira_nome || <span className="text-slate-400 italic">Não informado</span>}
                            {(s as any).esteira_apelido && (
                              <span className="text-slate-500 text-[11px] ml-1 font-normal font-sans">
                                "{(s as any).esteira_apelido}"
                              </span>
                            )}
                          </div>
                          {((s as any).cavalo_oficial_nome || (s as any).cavalo_nome) && (
                            <div className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
                              <span>🐎</span>
                              <span>{(s as any).cavalo_oficial_nome || (s as any).cavalo_nome}</span>
                            </div>
                          )}
                        </td>


                        {/* Categoria */}
                        <td className="py-3 px-4">
                          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            {s.categoria || 'ABERTA'}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Canal: {s.canal_venda || 'PRESENCIAL'}
                          </div>
                        </td>

                        {/* Bois */}
                        <td className="py-3 px-4">
                          <div className="text-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 mr-1">1º Boi:</span>
                            {boi1Texto}
                          </div>
                          <div className="text-slate-800 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-400 mr-1">2º Boi:</span>
                            {boi2Texto}
                          </div>
                        </td>

                        {/* Comercial */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {((s.valor_centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          <span className={`inline-block text-[10px] font-medium px-1.5 py-0.2 rounded mt-0.5 ${
                            s.estado_comercial === 'PAGA' 
                              ? 'bg-emerald-50 text-emerald-700'
                              : s.estado_comercial === 'CANCELADA'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {s.estado_comercial || 'PAGA'}
                          </span>
                        </td>

                        {/* Status de Pista */}
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            s.status === 'ATIVA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'USADA'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {s.status === 'ATIVA' ? 'Ativa' : s.status === 'USADA' ? 'Correu / Pista' : 'Cancelada'}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => abrirEdicao(s)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                          >
                            Editar
                          </button>
                          {s.status !== 'CANCELADA' && (
                            <button
                              onClick={() => handleCancelarSenha(s)}
                              className="inline-flex items-center px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 transition"
                              title="Cancelar senha"
                            >
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: EDITAR SENHA OPERACIONAL */}
      {senhaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Editar Senha {senhaEditando.codigo}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Atualização de puxador, esteira, categoria e bois alocados
                </p>
              </div>
              <button
                onClick={() => setSenhaEditando(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarEdicao} className="p-6 space-y-4 text-xs">
              <datalist id="lista-competidores-senhas">
                {competidores.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.apelido_pista ? `"${c.apelido_pista}"` : ''}
                  </option>
                ))}
              </datalist>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vaqueiro Puxador
                  </label>
                  <input
                    type="text"
                    list="lista-competidores-senhas"
                    value={formPuxador}
                    onChange={(e) => setFormPuxador(e.target.value)}
                    required
                    placeholder="Selecione ou digite..."
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vaqueiro Esteira
                  </label>
                  <input
                    type="text"
                    list="lista-competidores-senhas"
                    value={formEsteira}
                    onChange={(e) => setFormEsteira(e.target.value)}
                    required
                    placeholder="Selecione ou digite..."
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>


              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="PROFISSIONAL">Profissional</option>
                    <option value="AMADOR">Amador</option>
                    <option value="ASPIRANTE">Aspirante</option>
                    <option value="ABERTA">Aberta</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Status na Pista
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="ATIVA">Ativa</option>
                    <option value="USADA">Usada / Em Pista</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    1º Boi Alocado
                  </label>
                  <select
                    value={formBoi1}
                    onChange={(e) => setFormBoi1(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">Nenhum / Selecione</option>
                    {bois.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome || b.numero_registro || `Boi #${b.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    2º Boi Alocado
                  </label>
                  <select
                    value={formBoi2}
                    onChange={(e) => setFormBoi2(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">Nenhum / Selecione</option>
                    {bois.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome || b.numero_registro || `Boi #${b.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Justificativa / Motivo da Alteração (Auditoria)
                </label>
                <input
                  type="text"
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  placeholder="Ex: Troca de vaqueiro esteira por lesão"
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSenhaEditando(null)}
                  className="px-3.5 py-2 font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoEdicao}
                  className="px-4 py-2 font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA SENHA MANUAL */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Cadastrar Senha Manual
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Inserção direta pelo gestor operacional
                </p>
              </div>
              <button
                onClick={() => setModalNovoAberto(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarNovaSenha} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Código da Senha *
                  </label>
                  <input
                    type="text"
                    value={novoCodigo}
                    onChange={(e) => setNovoCodigo(e.target.value)}
                    required
                    placeholder="Ex: SN-501"
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    value={novoValor}
                    onChange={(e) => setNovoValor(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vaqueiro Puxador
                  </label>
                  <input
                    type="text"
                    list="lista-competidores-senhas"
                    value={novoPuxador}
                    onChange={(e) => setNovoPuxador(e.target.value)}
                    placeholder="Selecione ou digite..."
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vaqueiro Esteira
                  </label>
                  <input
                    type="text"
                    list="lista-competidores-senhas"
                    value={novoEsteira}
                    onChange={(e) => setNovoEsteira(e.target.value)}
                    placeholder="Selecione ou digite..."
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>


              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="PROFISSIONAL">Profissional</option>
                    <option value="AMADOR">Amador</option>
                    <option value="ASPIRANTE">Aspirante</option>
                    <option value="ABERTA">Aberta</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tipo de Venda
                  </label>
                  <select
                    value={novoTipo}
                    onChange={(e) => setNovoTipo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="SOLTEIRA">Senha Solteira</option>
                    <option value="KIT">Kit Duplo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    1º Boi (Opcional)
                  </label>
                  <select
                    value={novoBoi1}
                    onChange={(e) => setNovoBoi1(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">Selecione ou deixe vago</option>
                    {bois.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome || b.numero_registro || `Boi #${b.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    2º Boi (Opcional)
                  </label>
                  <select
                    value={novoBoi2}
                    onChange={(e) => setNovoBoi2(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">Selecione ou deixe vago</option>
                    {bois.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome || b.numero_registro || `Boi #${b.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-3.5 py-2 font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoNovo}
                  className="px-4 py-2 font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {salvandoNovo ? 'Cadastrando...' : 'Cadastrar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
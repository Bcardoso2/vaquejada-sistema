'use client';

import { useState, useEffect } from 'react';

interface Corrida {
  id: string;
  vaquejada_id: string;
  senha_id: string;
  boi_id: string;
  boi_numero: number;
  tipo: string;
  ordem_mapa: number;
  estado: string;
  resultado_inicial: string | null;
  resultado_final: string | null;
  estado_julgamento: string;
  excecao_mapa: boolean;
  motivo_excecao: string | null;
  senha_codigo: string;
  puxador_nome: string;
  esteira_nome: string;
  senha_categoria: string;
  boi_nome: string;
  boi_numero_registro: string;
  tem_contestacao: string | number;
}

export default function MapaPistaPage() {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [operadorNome] = useState('Operador de Pista');
  
  // Modal de Exceção
  const [modalExcecao, setModalExcecao] = useState<{ aberto: boolean; corrida: Corrida | null; motivo: string }>({
    aberto: false,
    corrida: null,
    motivo: '',
  });

  const carregarMapa = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/mapa');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCorridas(data);
      }
    } catch (err) {
      console.error('Erro ao carregar mapa:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarMapa();
  }, []);

  const executarAcao = async (acao: string, corridaId: string, resultado?: string) => {
    try {
      const res = await fetch('/api/mapa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, corridaId, resultado, operadorNome }),
      });
      const data = await res.json();
      if (res.ok) {
        await carregarMapa();
      } else {
        alert(data.error || 'Erro ao executar ação');
      }
    } catch (err) {
      alert('Erro de conexão ao atualizar mapa');
    }
  };

  const confirmarExcecao = async () => {
    if (!modalExcecao.corrida || !modalExcecao.motivo.trim()) {
      alert('Informe a justificativa da exceção de mapa');
      return;
    }
    try {
      const res = await fetch('/api/mapa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'EXCECAO_MAPA',
          corridaId: modalExcecao.corrida.id,
          motivoExcecao: modalExcecao.motivo,
          operadorNome,
        }),
      });
      if (res.ok) {
        setModalExcecao({ aberto: false, corrida: null, motivo: '' });
        await carregarMapa();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao registrar exceção');
      }
    } catch {
      alert('Erro ao registrar exceção');
    }
  };

  const corridasFiltradas = corridas.filter((c) => {
    const matchEstado = filtroEstado === 'TODOS' || c.estado === filtroEstado;
    const matchCat = filtroCategoria === 'TODAS' || c.senha_categoria === filtroCategoria;
    return matchEstado && matchCat;
  });

  const corridaAtiva = corridas.find((c) => c.estado === 'CHAMADA' || c.estado === 'EM_EXECUCAO');

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Mapa Geral da Pista
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Controle de ordem de entrada, chamadas de competidores e julgamento imediato
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={carregarMapa}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
          >
            Atualizar Mapa
          </button>
        </div>
      </div>

      {/* Painel de Corrida Ativa na Pista */}
      {corridaAtiva && (
        <div className="bg-white border-2 border-slate-900 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Pista Ativa · Posição #{corridaAtiva.ordem_mapa}
              </span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 uppercase">
              {corridaAtiva.estado === 'CHAMADA' ? 'Competidor Chamado' : 'Em Corrida'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-4 items-center">
            <div className="md:col-span-7">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  Senha {corridaAtiva.senha_codigo}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {corridaAtiva.tipo} ({corridaAtiva.boi_numero}º boi)
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {corridaAtiva.senha_categoria}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">Puxador</span>
                  <span className="font-semibold text-slate-900">{corridaAtiva.puxador_nome || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Esteira</span>
                  <span className="font-semibold text-slate-900">{corridaAtiva.esteira_nome || '-'}</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 mt-2">
                Boi Alocado: <strong className="text-slate-800">{corridaAtiva.boi_nome}</strong> ({corridaAtiva.boi_numero_registro})
              </div>
            </div>

            {/* Ações da Pista */}
            <div className="md:col-span-5 flex flex-wrap gap-2 justify-end">
              {corridaAtiva.estado === 'CHAMADA' && (
                <button
                  onClick={() => executarAcao('INICIAR', corridaAtiva.id)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-lg shadow-xs transition"
                >
                  Abrir Porteira (Iniciar)
                </button>
              )}

              {corridaAtiva.estado === 'EM_EXECUCAO' && (
                <>
                  <button
                    onClick={() => executarAcao('REGISTRAR_RESULTADO', corridaAtiva.id, 'VALEU')}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-lg shadow-xs transition"
                  >
                    Valeu Boi
                  </button>
                  <button
                    onClick={() => executarAcao('REGISTRAR_RESULTADO', corridaAtiva.id, 'ZERO')}
                    className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-sm rounded-lg shadow-xs transition"
                  >
                    Zero
                  </button>
                  <button
                    onClick={() => executarAcao('REGISTRAR_RESULTADO', corridaAtiva.id, 'RETORNO')}
                    className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm rounded-lg shadow-xs transition"
                    title="Registra retorno e gera nova oportunidade com outro boi"
                  >
                    Retorno
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-semibold text-slate-500 mr-2">Filtrar:</span>
          {['TODOS', 'NO_MAPA', 'CHAMADA', 'EM_EXECUCAO', 'CONCLUIDA', 'AGUARDANDO_RETORNO'].map((st) => (
            <button
              key={st}
              onClick={() => setFiltroEstado(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                filtroEstado === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'NO_MAPA' ? 'Na Fila' : st === 'TODOS' ? 'Todos' : st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500">
          Total de corridas listadas: <strong className="text-slate-800">{corridasFiltradas.length}</strong>
        </div>
      </div>

      {/* Tabela do Mapa */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Ordem</th>
                <th className="py-3 px-4">Senha</th>
                <th className="py-3 px-4">Dupla</th>
                <th className="py-3 px-4">Boi</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4">Resultado</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Carregando mapa...
                  </td>
                </tr>
              ) : corridasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhuma corrida encontrada para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                corridasFiltradas.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50 transition ${
                      c.estado === 'EM_EXECUCAO'
                        ? 'bg-emerald-50/50'
                        : c.estado === 'CHAMADA'
                        ? 'bg-amber-50/50'
                        : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      #{c.ordem_mapa}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{c.senha_codigo}</div>
                      <div className="text-xs text-slate-500">{c.senha_categoria}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium">{c.puxador_nome || '-'}</div>
                      <div className="text-xs text-slate-500">Esteira: {c.esteira_nome || '-'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium">{c.boi_nome}</div>
                      <div className="text-xs text-slate-400 font-mono">{c.boi_numero_registro}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {c.tipo} ({c.boi_numero}º boi)
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          c.estado === 'EM_EXECUCAO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.estado === 'CHAMADA'
                            ? 'bg-amber-100 text-amber-800'
                            : c.estado === 'CONCLUIDA'
                            ? 'bg-slate-100 text-slate-600'
                            : c.estado === 'AGUARDANDO_RETORNO'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {c.estado === 'NO_MAPA' ? 'Na Fila' : c.estado.replace(/_/g, ' ')}
                      </span>
                      {c.excecao_mapa && (
                        <span
                          className="ml-1 text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-800 font-bold rounded"
                          title={c.motivo_excecao || 'Exceção autorizada'}
                        >
                          Exceção
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {c.resultado_final ? (
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-xs ${
                            c.resultado_final === 'VALEU'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.resultado_final === 'RETORNO'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {c.resultado_final}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                      {Number(c.tem_contestacao) > 0 && (
                        <span className="ml-1.5 text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-bold">
                          Vídeo
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.estado === 'NO_MAPA' && (
                          <button
                            onClick={() => executarAcao('CHAMAR', c.id)}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition"
                          >
                            Chamar
                          </button>
                        )}
                        {c.estado === 'CHAMADA' && (
                          <button
                            onClick={() => executarAcao('INICIAR', c.id)}
                            className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md transition"
                          >
                            Iniciar
                          </button>
                        )}
                        {!c.excecao_mapa && c.estado !== 'CONCLUIDA' && (
                          <button
                            onClick={() => setModalExcecao({ aberto: true, corrida: c, motivo: '' })}
                            className="px-2 py-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs rounded transition"
                            title="Autorizar exceção"
                          >
                            Exceção
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

      {/* Modal de Exceção */}
      {modalExcecao.aberto && modalExcecao.corrida && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Autorizar Exceção no Mapa
            </h3>
            <p className="text-xs text-slate-500">
              Liberação excepcional da senha para corrida no mapa. A justificativa será registrada na auditoria.
            </p>
            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1 text-slate-700">
              <div><strong>Senha:</strong> {modalExcecao.corrida.senha_codigo}</div>
              <div><strong>Competidor:</strong> {modalExcecao.corrida.puxador_nome}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Justificativa *
              </label>
              <textarea
                value={modalExcecao.motivo}
                onChange={(e) => setModalExcecao({ ...modalExcecao, motivo: e.target.value })}
                placeholder="Informe o motivo da liberação..."
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-slate-900"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalExcecao({ aberto: false, corrida: null, motivo: '' })}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExcecao}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

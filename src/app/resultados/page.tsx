'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { avaliarClassificacaoDupla } from '@/lib/regras-competicao';

interface CorridaItem {
  id: string;
  senha_id: string;
  senha_codigo: string;
  senha_categoria: string;
  puxador_nome: string;
  esteira_nome: string;
  boi_nome: string;
  boi_numero: number;
  tipo: string;
  ordem_mapa: number;
  estado: string;
  resultado_final: string | null;
  estado_julgamento: string;
}

interface ClassificacaoDupla {
  senhaId: string;
  senhaCodigo: string;
  categoria: string;
  puxador: string;
  esteira: string;
  corridas: CorridaItem[];
  totalCorridas: number;
  valeuCount: number;
  zeroCount: number;
  pendenteCount: number;
  statusClassificacao: 'CLASSIFICADO' | 'DESCLASSIFICADO' | 'EM_ANDAMENTO';
}

export default function ResultadosOficiaisPage() {
  const [corridas, setCorridas] = useState<CorridaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS');
  const [busca, setBusca] = useState('');

  const carregarDados = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/mapa');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCorridas(data);
      }
    } catch (err) {
      console.error('Erro ao carregar resultados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Agrupar corridas por senha para formar a pontuação da dupla
  const ranking = useMemo(() => {
    const mapaDuplas = new Map<string, ClassificacaoDupla>();

    for (const c of corridas) {
      const chave = c.senha_id || c.senha_codigo;
      if (!mapaDuplas.has(chave)) {
        mapaDuplas.set(chave, {
          senhaId: c.senha_id,
          senhaCodigo: c.senha_codigo || 'S/N',
          categoria: c.senha_categoria || 'PROFISSIONAL',
          puxador: c.puxador_nome || 'Não informado',
          esteira: c.esteira_nome || 'Não informado',
          corridas: [],
          totalCorridas: 0,
          valeuCount: 0,
          zeroCount: 0,
          pendenteCount: 0,
          statusClassificacao: 'EM_ANDAMENTO',
        });
      }

      const d = mapaDuplas.get(chave)!;
      d.corridas.push(c);
      d.totalCorridas += 1;

      if (c.resultado_final === 'VALEU') {
        d.valeuCount += 1;
      } else if (c.resultado_final === 'ZERO') {
        d.zeroCount += 1;
      } else {
        d.pendenteCount += 1;
      }

      // Regra de vaquejada centralizada em src/lib/regras-competicao.ts (A CONFIRMAR)
      d.statusClassificacao = avaliarClassificacaoDupla(d.valeuCount, d.zeroCount);
    }

    const lista = Array.from(mapaDuplas.values());

    // Ordenar: primeiro classificados com mais valeu, depois em andamento, depois desclassificados
    lista.sort((a, b) => {
      if (b.valeuCount !== a.valeuCount) return b.valeuCount - a.valeuCount;
      return a.zeroCount - b.zeroCount;
    });

    return lista;
  }, [corridas]);

  const filtrados = useMemo(() => {
    return ranking.filter((r) => {
      if (categoriaFiltro !== 'TODAS' && r.categoria !== categoriaFiltro) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        return (
          r.senhaCodigo.toLowerCase().includes(termo) ||
          r.puxador.toLowerCase().includes(termo) ||
          r.esteira.toLowerCase().includes(termo)
        );
      }
      return true;
    });
  }, [ranking, categoriaFiltro, busca]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Circuito Oficial 2026
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Resultados & Classificação Oficial
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Apuração em tempo real com validação de pista e mesa de julgamento
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/relatorios/resultados?formato=pdf&categoria=${categoriaFiltro}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            title="Baixar Relatório Oficial de Resultados em PDF nativo"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>Resultados PDF</span>
          </a>
          <a
            href={`/api/relatorios/resultados?formato=xlsx&categoria=${categoriaFiltro}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            title="Baixar Resultados em planilha Microsoft Excel (.xlsx)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Excel (.xlsx)</span>
          </a>
          <a
            href={`/api/relatorios/resultados?formato=csv&categoria=${categoriaFiltro}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            title="Baixar Resultados em formato CSV"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>CSV</span>
          </a>
          <button
            onClick={carregarDados}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Atualizar</span>
          </button>
          <Link
            href="/mapa"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
          >
            Ver Mapa
          </Link>
        </div>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duplas Inscritas</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{ranking.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aptas p/ Final (100% Valeu)</span>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">
            {ranking.filter((r) => r.statusClassificacao === 'CLASSIFICADO').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Em Andamento na Pista</span>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">
            {ranking.filter((r) => r.statusClassificacao === 'EM_ANDAMENTO').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Desclassificadas (Zero)</span>
          <div className="text-2xl font-extrabold text-rose-700 mt-1">
            {ranking.filter((r) => r.statusClassificacao === 'DESCLASSIFICADO').length}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-slate-500 mr-1">Categoria:</span>
          {['TODAS', 'PROFISSIONAL', 'AMADOR', 'ASPIRANTE', 'ABERTA'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                categoriaFiltro === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Buscar puxador, esteira ou senha..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-3 py-2 w-full md:w-64"
        />
      </div>

      {/* Tabela de Classificação */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Posição</th>
                <th className="py-3 px-4">Senha</th>
                <th className="py-3 px-4">Vaqueiros (Puxador / Esteira)</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-center">Boi 1</th>
                <th className="py-3 px-4 text-center">Boi 2</th>
                <th className="py-3 px-4 text-center">Pontuação</th>
                <th className="py-3 px-4 text-right">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Carregando apuração dos resultados...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhuma dupla localizada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtrados.map((item, index) => {
                  const boi1 = item.corridas[0]?.resultado_final;
                  const boi2 = item.corridas[1]?.resultado_final;

                  return (
                    <tr key={item.senhaId || index} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        {index + 1}º
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {item.senhaCodigo}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{item.puxador}</div>
                        <div className="text-xs text-slate-500">Esteira: {item.esteira}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          {item.categoria}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {boi1 ? (
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-xs ${
                              boi1 === 'VALEU'
                                ? 'bg-emerald-100 text-emerald-800'
                                : boi1 === 'RETORNO'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {boi1}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">Aguardando</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {boi2 ? (
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-xs ${
                              boi2 === 'VALEU'
                                ? 'bg-emerald-100 text-emerald-800'
                                : boi2 === 'RETORNO'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {boi2}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">Aguardando</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-slate-900 text-sm">
                          {item.valeuCount} Valeu
                        </span>
                        {item.zeroCount > 0 && (
                          <span className="text-xs text-rose-600 block">
                            {item.zeroCount} Zero
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${
                            item.statusClassificacao === 'CLASSIFICADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.statusClassificacao === 'DESCLASSIFICADO'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.statusClassificacao === 'CLASSIFICADO'
                            ? 'Apto p/ Final'
                            : item.statusClassificacao === 'DESCLASSIFICADO'
                            ? 'Fora da Disputa'
                            : 'Em Pista'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { KitMontado } from '@/app/api/secretaria/kits/route';

interface SeletorKitsProps {
  aberto: boolean;
  onFechar: () => void;
  onSelectKit: (kit: KitMontado) => void;
  kitSelecionadoId?: string | null;
  vaquejadaId?: string;
}

type ModoVisualizacao = 'cards' | 'grade';
type FiltroStatus = 'disponiveis' | 'todos' | 'vendidos';

export function SeletorKits({
  aberto,
  onFechar,
  onSelectKit,
  kitSelecionadoId,
  vaquejadaId = 'vq-2026-portal',
}: SeletorKitsProps) {
  const [kits, setKits] = useState<KitMontado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modo, setModo] = useState<ModoVisualizacao>('cards');
  const [filtro, setFiltro] = useState<FiltroStatus>('disponiveis');
  const [busca, setBusca] = useState('');
  const [hoveredNumero, setHoveredNumero] = useState<number | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const carregarKits = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const res = await fetch(`/api/secretaria/kits?vaquejadaId=${encodeURIComponent(vaquejadaId)}`);
      if (!res.ok) throw new Error(`Erro na API (${res.status})`);
      const data = await res.json();
      setKits(Array.isArray(data.kits) ? data.kits : []);
    } catch (err) {
      console.error('Falha ao carregar kits:', err);
      setErro(err instanceof Error ? err.message : 'Falha ao buscar kits disponíveis');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (aberto) {
      carregarKits();
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [aberto, vaquejadaId]);

  // Filtragem e busca inteligente
  const kitsFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return kits.filter((k) => {
      // Filtro de status
      if (filtro === 'disponiveis' && k.status !== 'DISPONIVEL') return false;
      if (filtro === 'vendidos' && k.status !== 'VENDIDO') return false;

      // Filtro de busca textual ou numérica
      if (termo) {
        const bateCodigo = k.codigo.toLowerCase().includes(termo);
        const bateBaixa = k.senhaBaixa.codigo.toLowerCase().includes(termo);
        const bateAlta = k.senhaAlta.codigo.toLowerCase().includes(termo);
        const bateNum = k.numero !== null && String(k.numero).includes(termo);
        const bateNumAlta = k.senhaAlta.numero !== null && String(k.senhaAlta.numero).includes(termo);
        return bateCodigo || bateBaixa || bateAlta || bateNum || bateNumAlta;
      }

      return true;
    });
  }, [kits, filtro, busca]);

  const totais = useMemo(() => {
    return {
      total: kits.length,
      disponiveis: kits.filter((k) => k.status === 'DISPONIVEL').length,
      vendidos: kits.filter((k) => k.status === 'VENDIDO').length,
    };
  }, [kits]);

  // Lista de números para a Grade Dupla
  const gradeBaixas = useMemo(() => {
    return kits.filter((k) => k.numero !== null && k.numero <= 500);
  }, [kits]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Selecionar Kit de Senhas (Baixa + Alta)
                </h3>
                <p className="text-xs text-slate-400">
                  Cada kit contém 2 senhas conectadas (1 Baixa + 1 Alta) e aloca 4 bois no total.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Alternador de Modo */}
            <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModo('cards')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  modo === 'cards'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🗂️</span> Cards Pareados
              </button>
              <button
                type="button"
                onClick={() => setModo('grade')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  modo === 'grade'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>▦</span> Grade Dupla Lado a Lado
              </button>
            </div>

            <button
              type="button"
              onClick={onFechar}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Fechar (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Barra de Busca e Filtros */}
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Digite o número (ex: 5, 005, 805)..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFiltro('disponiveis')}
                className={`px-3 py-1.5 rounded-md transition ${
                  filtro === 'disponiveis'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Disponíveis ({totais.disponiveis})
              </button>
              <button
                type="button"
                onClick={() => setFiltro('todos')}
                className={`px-3 py-1.5 rounded-md transition ${
                  filtro === 'todos'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({totais.total})
              </button>
              <button
                type="button"
                onClick={() => setFiltro('vendidos')}
                className={`px-3 py-1.5 rounded-md transition ${
                  filtro === 'vendidos'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Vendidos ({totais.vendidos})
              </button>
            </div>

            <button
              type="button"
              onClick={carregarKits}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700 transition"
              title="Recarregar estoque"
            >
              <svg className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conteúdo Principal com Rolagem */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {carregando ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Carregando kits de senhas...</p>
            </div>
          ) : erro ? (
            <div className="py-16 text-center space-y-3">
              <div className="text-rose-400 text-sm font-semibold">{erro}</div>
              <button
                type="button"
                onClick={carregarKits}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
              >
                Tentar Novamente
              </button>
            </div>
          ) : kitsFiltrados.length === 0 ? (
            <div className="py-16 text-center space-y-2 border border-dashed border-slate-800 rounded-xl">
              <p className="text-slate-400 text-sm">Nenhum kit encontrado com os filtros atuais.</p>
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="text-xs text-emerald-400 hover:underline font-semibold"
                >
                  Limpar busca "{busca}"
                </button>
              )}
            </div>
          ) : modo === 'cards' ? (
            /* MODO 1: CARDS DE KITS PAREADOS */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {kitsFiltrados.map((kit) => {
                const disponivel = kit.status === 'DISPONIVEL';
                const selecionado = kit.id === kitSelecionadoId || kit.senhaBaixa.codigo === kitSelecionadoId;

                return (
                  <div
                    key={kit.id}
                    onClick={() => {
                      if (disponivel) {
                        onSelectKit(kit);
                        onFechar();
                      }
                    }}
                    className={`relative p-4 rounded-xl border transition-all duration-200 ${
                      selecionado
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-500/60'
                        : disponivel
                        ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-emerald-500/60 cursor-pointer hover:shadow-md'
                        : 'bg-slate-900/60 border-slate-800/60 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {/* Topo do Card */}
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-700/50 text-xs">
                      <span className="font-mono font-bold text-slate-300">
                        {kit.codigo}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] tracking-wide uppercase ${
                          disponivel
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : kit.status === 'VENDIDO'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {kit.status === 'DISPONIVEL' ? '✓ Disponível' : kit.status === 'VENDIDO' ? 'Vendido' : 'Parcial'}
                      </span>
                    </div>

                    {/* Caixas Pareadas (Baixa + Alta) */}
                    <div className="grid grid-cols-2 gap-2 relative">
                      {/* Senha Baixa */}
                      <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-700/70 text-center space-y-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                          1ª Rodada (Baixa)
                        </span>
                        <div className="text-xl font-mono font-black text-white">
                          {kit.senhaBaixa.codigo}
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          2 bois alocados
                        </span>
                      </div>

                      {/* Senha Alta */}
                      <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-700/70 text-center space-y-1">
                        <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">
                          2ª Rodada (Alta)
                        </span>
                        <div className="text-xl font-mono font-black text-white">
                          {kit.senhaAlta.codigo}
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          2 bois alocados
                        </span>
                      </div>

                      {/* Elo de conexão no meio */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] text-slate-300 font-bold shadow">
                          +
                        </span>
                      </div>
                    </div>

                    {/* Rodapé do Card */}
                    <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {kit.categoria}
                      </span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {(kit.valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>

                    {/* Botão de Ação */}
                    {disponivel && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectKit(kit);
                          onFechar();
                        }}
                        className={`w-full mt-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          selecionado
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 hover:bg-emerald-600 text-slate-200 hover:text-white'
                        }`}
                      >
                        {selecionado ? '✓ Kit Selecionado' : 'Selecionar Este Kit'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* MODO 2: GRADE DUPLA SINCRONIZADA LADO A LADO */
            <div className="space-y-4">
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  💡 <strong>Dica:</strong> As senhas baixas e altas estão posicionadas lado a lado. Ao passar o mouse ou clicar em qualquer uma delas, o par correspondente conecta automaticamente!
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {gradeBaixas.length} Pares Mapeados
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coluna 1: Baixas */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                    <span className="font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Senhas Baixas (1ª Rodada)
                    </span>
                    <span className="text-slate-500 font-mono">Faixa 001 a 200</span>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
                    {gradeBaixas.map((k) => {
                      const disponivel = k.status === 'DISPONIVEL';
                      const isHovered = hoveredNumero === k.numero;
                      const isSelected = k.id === kitSelecionadoId || k.senhaBaixa.codigo === kitSelecionadoId;

                      return (
                        <button
                          key={k.senhaBaixa.id}
                          type="button"
                          onMouseEnter={() => setHoveredNumero(k.numero)}
                          onMouseLeave={() => setHoveredNumero(null)}
                          onClick={() => {
                            if (disponivel) {
                              onSelectKit(k);
                              onFechar();
                            }
                          }}
                          disabled={!disponivel}
                          className={`h-9 rounded-lg font-mono text-xs font-bold transition flex items-center justify-center border ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-400 text-white shadow-md ring-2 ring-emerald-400'
                              : isHovered
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 scale-105 z-10'
                              : disponivel
                              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-emerald-500 hover:text-white'
                              : 'bg-slate-900/50 border-slate-800/80 text-slate-600 line-through cursor-not-allowed'
                          }`}
                          title={`Baixa: ${k.senhaBaixa.codigo} · Par Alta: ${k.senhaAlta.codigo} (${k.status})`}
                        >
                          {k.senhaBaixa.codigo}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Coluna 2: Altas */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                    <span className="font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Senhas Altas (2ª Rodada)
                    </span>
                    <span className="text-slate-500 font-mono">Faixa 801 a 1000</span>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
                    {gradeBaixas.map((k) => {
                      const disponivel = k.status === 'DISPONIVEL';
                      const isHovered = hoveredNumero === k.numero;
                      const isSelected = k.id === kitSelecionadoId || k.senhaBaixa.codigo === kitSelecionadoId;

                      return (
                        <button
                          key={k.senhaAlta.id}
                          type="button"
                          onMouseEnter={() => setHoveredNumero(k.numero)}
                          onMouseLeave={() => setHoveredNumero(null)}
                          onClick={() => {
                            if (disponivel) {
                              onSelectKit(k);
                              onFechar();
                            }
                          }}
                          disabled={!disponivel}
                          className={`h-9 rounded-lg font-mono text-xs font-bold transition flex items-center justify-center border ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-400 text-white shadow-md ring-2 ring-indigo-400'
                              : isHovered
                              ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 scale-105 z-10'
                              : disponivel
                              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-indigo-500 hover:text-white'
                              : 'bg-slate-900/50 border-slate-800/80 text-slate-600 line-through cursor-not-allowed'
                          }`}
                          title={`Alta: ${k.senhaAlta.codigo} · Par Baixa: ${k.senhaBaixa.codigo} (${k.status})`}
                        >
                          {k.senhaAlta.codigo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Disponível para Venda
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" /> Vendido
            </span>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg font-bold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

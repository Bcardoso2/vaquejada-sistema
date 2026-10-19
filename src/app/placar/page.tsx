'use client';

import React, { useState, useEffect } from 'react';

interface CorridaPista {
  corrida_id: string;
  boi_numero: number;
  estado: string;
  resultado_final: string | null;
  senha_codigo: string;
  categoria: string;
  puxador_nome: string;
  puxador_apelido?: string;
  esteira_nome: string;
  esteira_apelido?: string;
  cavalo_nome?: string;
  cavalo_oficial_nome?: string;
  bateria_numero?: number;
}

interface DadosPlacar {
  vaquejada: {
    nome: string;
    local: string;
    tempoCancela: number;
  };
  corridaAtual: CorridaPista | null;
  proximasCorridas: CorridaPista[];
  ultimosResultados: CorridaPista[];
  atualizadoEm: string;
}

export default function PlacarPublicoPage() {
  const [dados, setDados] = useState<DadosPlacar | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [horaLocal, setHoraLocal] = useState('');

  // Relógio ao vivo
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setHoraLocal(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Polling automático dos dados do placar a cada 3 segundos
  const carregarPlacar = async () => {
    try {
      const res = await fetch('/api/placar');
      if (!res.ok) throw new Error('Falha ao sincronizar dados');
      const json = await res.json();
      setDados(json);
      setErro(null);
    } catch {
      setErro('Sincronizando com a pista...');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPlacar();
    const interval = setInterval(carregarPlacar, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col p-4 md:p-6 select-none overflow-x-hidden">
      {/* HEADER DO TELÃO */}
      <header className="flex flex-col md:flex-row justify-between items-center border-b-4 border-amber-500 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500 text-black px-4 py-2 font-black text-2xl md:text-3xl tracking-widest rounded-lg shadow-lg">
            🐎 TELÃO OFICIAL
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wide text-amber-400">
              {dados?.vaquejada.nome || 'GRANDE VAQUEJADA PORTAL'}
            </h1>
            <p className="text-gray-400 text-sm md:text-base font-semibold">
              {dados?.vaquejada.local || 'Parque de Eventos e Competições'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-3 md:mt-0">
          <div className="flex items-center gap-2 bg-red-950/80 border border-red-500 text-red-400 px-3 py-1.5 rounded-full text-sm font-bold tracking-wider">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
            AO VIVO
          </div>
          <div className="text-3xl md:text-4xl font-mono font-black text-amber-400">
            {horaLocal || '--:--:--'}
          </div>
        </div>
      </header>

      {/* CORPO PRINCIPAL DO TELÃO */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: DUPLA NA PISTA (DESTAQUE MÁXIMO) */}
        <section className="lg:col-span-8 flex flex-col">
          <div className="bg-slate-900 border-4 border-amber-400 rounded-3xl p-6 md:p-8 flex-1 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            {/* Tag de Status */}
            <div className="flex justify-between items-start mb-4">
              <span className="bg-amber-400 text-black text-lg md:text-xl font-black uppercase px-6 py-2 rounded-xl tracking-wider shadow">
                🔥 NA PISTA AGORA {dados?.corridaAtual?.bateria_numero ? `• BATERIA ${dados.corridaAtual.bateria_numero}` : ''}
              </span>
              {dados?.corridaAtual && (
                <span className="bg-slate-800 text-amber-300 border border-amber-400/50 text-xl font-mono font-black px-5 py-2 rounded-xl">
                  SENHA #{dados.corridaAtual.senha_codigo}
                </span>
              )}
            </div>

            {dados?.corridaAtual ? (
              <div className="my-auto space-y-6">
                {/* PUXADOR */}
                <div className="bg-slate-950/70 border-2 border-slate-700 rounded-2xl p-5 md:p-6 shadow-inner">
                  <span className="text-amber-400 text-sm md:text-base font-bold uppercase tracking-widest block mb-1">
                    VAQUEIRO PUXADOR
                  </span>
                  <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2">
                    <span className="text-4xl md:text-5xl font-black tracking-tight text-white">
                      {dados.corridaAtual.puxador_apelido
                        ? `"${dados.corridaAtual.puxador_apelido}" (${dados.corridaAtual.puxador_nome})`
                        : dados.corridaAtual.puxador_nome}
                    </span>
                    <span className="text-xl md:text-2xl font-bold text-amber-300">
                      🐴 {dados.corridaAtual.cavalo_oficial_nome || dados.corridaAtual.cavalo_nome || 'Cavalo de Puxa'}
                    </span>
                  </div>
                </div>

                {/* ESTEIREIRO */}
                <div className="bg-slate-950/70 border-2 border-slate-700 rounded-2xl p-5 md:p-6 shadow-inner">
                  <span className="text-blue-400 text-sm md:text-base font-bold uppercase tracking-widest block mb-1">
                    VAQUEIRO ESTEIREIRO
                  </span>
                  <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2">
                    <span className="text-3xl md:text-4xl font-black tracking-tight text-white">
                      {dados.corridaAtual.esteira_apelido
                        ? `"${dados.corridaAtual.esteira_apelido}" (${dados.corridaAtual.esteira_nome})`
                        : dados.corridaAtual.esteira_nome}
                    </span>
                    <span className="text-lg md:text-xl font-semibold text-blue-300">
                      Categoria: {dados.corridaAtual.categoria || 'PROFISSIONAL'}
                    </span>
                  </div>
                </div>

                {/* STATUS DE PISTA / BOI */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 text-center">
                    <span className="text-gray-400 text-xs md:text-sm font-bold uppercase block">BOI CORRIDO</span>
                    <span className="text-3xl md:text-4xl font-mono font-black text-amber-300">
                      #{dados.corridaAtual.boi_numero || 1}
                    </span>
                  </div>
                  <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-4 text-center">
                    <span className="text-gray-400 text-xs md:text-sm font-bold uppercase block">SITUAÇÃO</span>
                    <span className="text-2xl md:text-3xl font-black text-green-400 uppercase">
                      {dados.corridaAtual.estado === 'EM_EXECUCAO' ? 'CORRENDO' : 'CHAMADA'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-auto text-center py-16">
                <span className="text-6xl mb-4 block">⏳</span>
                <h3 className="text-3xl md:text-4xl font-bold text-gray-400">Pista em Preparação</h3>
                <p className="text-gray-500 mt-2 text-lg">Aguardando chamada da próxima dupla pelo operador...</p>
              </div>
            )}

            <div className="text-xs text-gray-500 text-right mt-4">
              Atualização automática a cada 3s • Telão Público sem dados pessoais
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: PRÓXIMAS DUPLAS NA FILA */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 flex-1 shadow-xl flex flex-col">
            <h2 className="text-xl md:text-2xl font-black text-amber-400 border-b-2 border-slate-700 pb-3 mb-4 flex items-center justify-between">
              <span>📋 A SEGUIR (PREPAREM-SE)</span>
              <span className="text-xs font-normal text-gray-400">Próximas duplas</span>
            </h2>

            <div className="flex-1 flex flex-col gap-3 justify-start">
              {dados?.proximasCorridas && dados.proximasCorridas.length > 0 ? (
                dados.proximasCorridas.map((p, idx) => (
                  <div
                    key={p.corrida_id}
                    className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 transition-all"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="bg-amber-500 text-black text-xs font-black px-2.5 py-0.5 rounded-full">
                        #{idx + 1} NA FILA
                      </span>
                      <span className="text-amber-400 font-mono font-bold text-sm">
                        SENHA {p.senha_codigo}
                      </span>
                    </div>
                    <div className="text-lg font-black text-white truncate">
                      {p.puxador_apelido ? `"${p.puxador_apelido}"` : p.puxador_nome}
                    </div>
                    <div className="text-sm text-gray-400 truncate">
                      x {p.esteira_apelido ? `"${p.esteira_apelido}"` : p.esteira_nome}
                    </div>
                    {p.cavalo_oficial_nome || p.cavalo_nome ? (
                      <div className="text-xs text-amber-300/80 mt-1 truncate">
                        🐴 {p.cavalo_oficial_nome || p.cavalo_nome}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl block mb-2">📋</span>
                  Nenhuma dupla aguardando na fila imediata.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* RODAPÉ: ÚLTIMOS RESULTADOS JULGADOS */}
      <footer className="mt-6 bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-amber-400 font-black text-base md:text-lg uppercase">
            🏆 ÚLTIMOS RESULTADOS JULGADOS
          </span>
          <span className="text-xs text-gray-500">(Atualizado em tempo real pelo Juiz)</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {dados?.ultimosResultados && dados.ultimosResultados.length > 0 ? (
            dados.ultimosResultados.map((u) => {
              const valeu = u.resultado_final === 'VALEU';
              return (
                <div
                  key={u.corrida_id}
                  className={`p-3 rounded-xl border flex flex-col justify-between ${
                    valeu
                      ? 'bg-emerald-950/60 border-emerald-500/60'
                      : 'bg-rose-950/60 border-rose-500/60'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs text-gray-400 font-mono">
                    <span>#{u.senha_codigo}</span>
                    <span className="text-[10px] uppercase">{u.categoria}</span>
                  </div>
                  <div className="font-bold text-sm text-white truncate my-1">
                    {u.puxador_apelido || u.puxador_nome}
                  </div>
                  <div
                    className={`text-center font-black py-1 px-2 rounded-lg text-xs md:text-sm tracking-wider uppercase ${
                      valeu ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'
                    }`}
                  >
                    {valeu ? 'VALEU BOI' : 'ZERO'}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center text-gray-500 py-3 text-sm">
              Nenhum resultado anotado recentemente.
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

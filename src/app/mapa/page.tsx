'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Corrida {
  id: string;
  vaquejada_id: string;
  senha_id: string;
  boi_id: string;
  boi_numero: number;
  tipo: string;
  ordem_mapa: number;
  ordem_na_bateria?: number;
  bateria_id?: string;
  tipo_entrada?: string;
  estado: string;
  resultado_inicial: string | null;
  resultado_final: string | null;
  estado_julgamento: string;
  excecao_mapa: boolean;
  motivo_excecao: string | null;
  senha_codigo: string;
  puxador_nome: string;
  esteira_nome: string;
  puxador_apelido?: string;
  esteira_apelido?: string;
  senha_categoria: string;
  boi_nome: string;
  boi_numero_registro: string;
  tem_contestacao: string | number;
}

interface BateriaInfo {
  id: string;
  numero: number;
  status: string;
  tamanho_maximo: number;
  total_corridas: number;
  corridas_concluidas: number;
}

export default function MapaPistaPage() {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [baterias, setBaterias] = useState<BateriaInfo[]>([]);
  const [bateriaSelecionada, setBateriaSelecionada] = useState<string>('TODAS');
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [modoPista, setModoPista] = useState<boolean>(true); // Ativo por padrão para operadores em pista
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'sucesso' | 'erro' | 'aviso' } | null>(null);

  // Estados de confirmação em 2 toques (Two-tap confirmation)
  const [confirmacaoZero, setConfirmacaoZero] = useState<{ id: string; timer: NodeJS.Timeout | null } | null>(null);
  const [confirmacaoCancelar, setConfirmacaoCancelar] = useState<{ id: string; timer: NodeJS.Timeout | null } | null>(null);

  // Cronômetro de Cancela sincronizado no servidor
  const [tempoCancelaPadrao, setTempoCancelaPadrao] = useState<number>(30);
  const [tempoRestanteCancela, setTempoRestanteCancela] = useState<number | null>(null);
  const [cancelaAtiva, setCancelaAtiva] = useState<boolean>(false);
  const [cancelaStatus, setCancelaStatus] = useState<string>('PARADA');

  // Controle de Áudio com ativação explícita por toque do operador
  const [audioHabilitado, setAudioHabilitado] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Desfazer de 10 segundos após registrar resultado
  const [ultimoResultado, setUltimoResultado] = useState<{
    corridaId: string;
    senhaCodigo: string;
    resultado: string;
    tempoRestante: number;
  } | null>(null);

  // Modal de correção administrativa de resultado (ADMIN)
  const [modalCorrecaoAdmin, setModalCorrecaoAdmin] = useState<{
    aberto: boolean;
    corrida: Corrida | null;
    novoResultado: string;
    motivo: string;
  }>({
    aberto: false,
    corrida: null,
    novoResultado: 'VALEU',
    motivo: '',
  });

  // Modais
  const [modalExcecao, setModalExcecao] = useState<{ aberto: boolean; corrida: Corrida | null; motivo: string }>({
    aberto: false,
    corrida: null,
    motivo: '',
  });

  const [modalGerarBaterias, setModalGerarBaterias] = useState<{ aberto: boolean; tamanho: number }>({
    aberto: false,
    tamanho: 15,
  });

  const exibirToast = (mensagem: string, tipo: 'sucesso' | 'erro' | 'aviso' = 'sucesso') => {
    setToast({ mensagem, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  // Ativação explícita de áudio por gesto do operador (requisito dos navegadores)
  const ativarAudio = async () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setAudioHabilitado(true);
      // Bip de confirmação
      tocarSomCancela(880, 150);
      exibirToast('Áudio ativado com sucesso para avisos de cancela!');
    } catch (e) {
      console.error('Falha ao inicializar AudioContext:', e);
      exibirToast('Não foi possível ativar o áudio neste navegador', 'aviso');
    }
  };

  const desativarAudio = () => {
    setAudioHabilitado(false);
    exibirToast('Áudio desativado.');
  };

  // Áudio sintetizado via Web Audio API para avisos de cancela
  const tocarSomCancela = (frequencia: number, duracao: number) => {
    if (!audioHabilitado || typeof window === 'undefined') return;
    try {
      const audioCtx = audioContextRef.current;
      if (!audioCtx || audioCtx.state !== 'running') return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequencia;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
      }, duracao);
    } catch {
      // Ignora erro se áudio falhar
    }
  };

  // Carregar dados do mapa e baterias
  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resMapa, resBat] = await Promise.all([
        fetch('/api/mapa'),
        fetch('/api/baterias?vaquejada_id=vq-2026-portal'),
      ]);
      const dataMapa = await resMapa.json();
      const dataBat = await resBat.json();

      if (Array.isArray(dataMapa)) setCorridas(dataMapa);
      if (Array.isArray(dataBat)) {
        setBaterias(dataBat);
        const batAndamento = dataBat.find((b: BateriaInfo) => b.status === 'EM_ANDAMENTO');
        if (batAndamento && bateriaSelecionada === 'TODAS') {
          setBateriaSelecionada(batAndamento.id);
        }
      }
    } catch {
      exibirToast('Erro de conexão ao carregar mapa e baterias', 'erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Sincronizar Cronômetro de Cancela com o Servidor
  const sincronizarCancelaServidor = async () => {
    try {
      const res = await fetch('/api/cancela?vaquejada_id=vq-2026-portal');
      if (!res.ok) return;
      const data = await res.json();
      setCancelaStatus(data.status);
      setTempoRestanteCancela(data.tempoRestante);
      setCancelaAtiva(data.status === 'RODANDO');

      if (data.status === 'RODANDO' && data.tempoRestante <= 5 && data.tempoRestante > 0) {
        tocarSomCancela(750, 150); // Bips de alerta nos 5s finais
      } else if (data.status === 'ESTOURADA') {
        tocarSomCancela(440, 700);
      }
    } catch {
      // Erro transitório de rede
    }
  };

  // Intervalo de sincronização da cancela a cada 1s quando em execução
  useEffect(() => {
    sincronizarCancelaServidor();
    const interval = setInterval(() => {
      sincronizarCancelaServidor();
    }, 1000);
    return () => clearInterval(interval);
  }, [audioHabilitado]);

  // Contagem regressiva da janela de 10s para desfazer resultado
  useEffect(() => {
    if (!ultimoResultado) return;
    if (ultimoResultado.tempoRestante <= 0) {
      setUltimoResultado(null);
      return;
    }

    const timer = setInterval(() => {
      setUltimoResultado((prev) => {
        if (!prev || prev.tempoRestante <= 1) return null;
        return { ...prev, tempoRestante: prev.tempoRestante - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [ultimoResultado]);

  // Comandos de cancela chamando a rota sincronizada do servidor
  const dispararCancelaServidor = async (tempoSegundos?: number) => {
    const tempo = tempoSegundos || tempoCancelaPadrao;
    try {
      const res = await fetch('/api/cancela', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'DISPARAR',
          vaquejada_id: 'vq-2026-portal',
          corrida_id: corridaAtiva?.id || null,
          tempo_tolerancia: tempo,
        }),
      });
      if (res.ok) {
        tocarSomCancela(880, 200);
        await sincronizarCancelaServidor();
      }
    } catch {
      exibirToast('Erro ao sincronizar cancela no servidor', 'erro');
    }
  };

  const pararCancelaServidor = async () => {
    try {
      const res = await fetch('/api/cancela', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'PARAR',
          vaquejada_id: 'vq-2026-portal',
        }),
      });
      if (res.ok) {
        await sincronizarCancelaServidor();
      }
    } catch {
      exibirToast('Erro ao parar cancela', 'erro');
    }
  };

  // Ações de Pista
  const executarAcao = async (acao: string, corridaId: string, resultado?: string) => {
    try {
      const res = await fetch('/api/mapa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, corridaId, resultado }),
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast(`Ação ${acao} executada com sucesso!`);
        if (acao === 'INICIAR') {
          await dispararCancelaServidor();
        } else if (acao === 'REGISTRAR_RESULTADO' || acao === 'CONCLUIR') {
          await pararCancelaServidor();
          if (resultado) {
            // Iniciar janela de 10 segundos para desfazer
            const corrida = corridas.find((c) => c.id === corridaId);
            setUltimoResultado({
              corridaId,
              senhaCodigo: corrida?.senha_codigo || '',
              resultado,
              tempoRestante: 10,
            });
          }
        }
        await carregarDados();
      } else {
        exibirToast(data.error || 'Erro ao executar ação', 'erro');
      }
    } catch {
      exibirToast('Erro de comunicação com o servidor', 'erro');
    }
  };

  // Desfazer resultado lançado nos últimos 10 segundos
  const handleDesfazerResultado = async () => {
    if (!ultimoResultado) return;
    try {
      const res = await fetch('/api/mapa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'DESFAZER_RESULTADO',
          corridaId: ultimoResultado.corridaId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast('Resultado desfeito com sucesso! Corrida retornou à pista.', 'sucesso');
        setUltimoResultado(null);
        await carregarDados();
      } else {
        exibirToast(data.error || 'Não foi possível desfazer o resultado', 'erro');
      }
    } catch {
      exibirToast('Erro ao desfazer resultado', 'erro');
    }
  };

  // Salvar Correção de Resultado pelo Administrador (com auditoria e motivo)
  const handleSalvarCorrecaoAdmin = async () => {
    if (!modalCorrecaoAdmin.corrida) return;
    if (!modalCorrecaoAdmin.motivo || modalCorrecaoAdmin.motivo.trim().length < 5) {
      exibirToast('Informe o motivo da correção (mínimo 5 caracteres)', 'aviso');
      return;
    }

    try {
      const res = await fetch('/api/mapa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'CORRIGIR_RESULTADO_ADMIN',
          corridaId: modalCorrecaoAdmin.corrida.id,
          novoResultado: modalCorrecaoAdmin.novoResultado,
          motivo: modalCorrecaoAdmin.motivo.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast('Resultado corrigido e auditado pelo administrador!', 'sucesso');
        setModalCorrecaoAdmin({ aberto: false, corrida: null, novoResultado: 'VALEU', motivo: '' });
        await carregarDados();
      } else {
        exibirToast(data.error || 'Erro ao corrigir resultado', 'erro');
      }
    } catch {
      exibirToast('Erro de comunicação com o servidor', 'erro');
    }
  };

  // Confirmação em 2 toques para ZERO
  const dispararConfirmacaoZero = (corridaId: string) => {
    if (confirmacaoZero && confirmacaoZero.id === corridaId) {
      // Segundo toque confirmado!
      if (confirmacaoZero.timer) clearTimeout(confirmacaoZero.timer);
      setConfirmacaoZero(null);
      executarAcao('REGISTRAR_RESULTADO', corridaId, 'ZERO');
      return;
    }

    // Primeiro toque: arma temporizador de 4 segundos
    const timer = setTimeout(() => {
      setConfirmacaoZero(null);
    }, 4000);

    setConfirmacaoZero({ id: corridaId, timer });
    tocarSomCancela(600, 100);
  };

  // Gerar baterias
  const handleGerarBaterias = async () => {
    try {
      const res = await fetch('/api/baterias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'GERAR', tamanho_bateria: modalGerarBaterias.tamanho }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalGerarBaterias({ aberto: false, tamanho: 15 });
        exibirToast(data.mensagem || 'Baterias geradas com sucesso!');
        await carregarDados();
      } else {
        exibirToast(data.error || 'Erro ao gerar baterias', 'erro');
      }
    } catch {
      exibirToast('Erro de comunicação ao gerar baterias', 'erro');
    }
  };

  // Fechar bateria atual
  const handleFecharBateria = async (bateriaId: string) => {
    try {
      const res = await fetch('/api/baterias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'FECHAR', bateria_id: bateriaId }),
      });
      const data = await res.json();
      if (res.ok) {
        exibirToast(data.mensagem || 'Bateria fechada com sucesso!');
        await carregarDados();
      } else {
        exibirToast(data.error || 'Erro ao fechar bateria', 'erro');
      }
    } catch {
      exibirToast('Erro ao fechar bateria', 'erro');
    }
  };

  // Imprimir ordem de largada
  const imprimirOrdemLargada = () => {
    window.print();
  };

  const corridasFiltradas = corridas.filter((c) => {
    const matchEstado = filtroEstado === 'TODOS' || c.estado === filtroEstado;
    const matchBat = bateriaSelecionada === 'TODAS' || c.bateria_id === bateriaSelecionada;
    return matchEstado && matchBat;
  });

  const corridaAtiva = corridas.find((c) => c.estado === 'CHAMADA' || c.estado === 'EM_EXECUCAO');

  return (
    <div className={`space-y-6 ${modoPista ? 'bg-slate-950 text-white min-h-screen -m-6 p-6' : ''}`}>
      {/* BARRA SUPERIOR: CONTROLES DO MODO PISTA & BATERIAS */}
      <div className={`${modoPista ? 'bg-slate-900 border-2 border-amber-500' : 'bg-white border border-slate-200'} rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden`}>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500 text-black font-black text-sm rounded-xl shadow flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>MODO PISTA</span>
          </div>
          <div>
            <h1 className={`text-2xl font-black uppercase tracking-tight ${modoPista ? 'text-amber-400' : 'text-slate-900'}`}>
              Controle Geral de Pista & Baterias
            </h1>
            <p className={`text-sm ${modoPista ? 'text-gray-400' : 'text-slate-500'}`}>
              Botões táteis de alto contraste (mínimo 56px), cronômetro de cancela e ordem de largada
            </p>
          </div>
        </div>

        {/* CONTROLES RÁPIDOS */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Baterias */}
          <select
            value={bateriaSelecionada}
            onChange={(e) => setBateriaSelecionada(e.target.value)}
            className={`min-h-[48px] px-4 font-bold rounded-xl border-2 text-sm cursor-pointer ${
              modoPista ? 'bg-slate-800 text-amber-300 border-amber-500' : 'bg-slate-50 text-slate-800 border-slate-300'
            }`}
          >
            <option value="TODAS">Todas as Baterias</option>
            {baterias.map((b) => (
              <option key={b.id} value={b.id}>
                Bateria {b.numero} ({b.status === 'EM_ANDAMENTO' ? 'ATIVA' : b.status}) • {b.total_corridas} duplas
              </option>
            ))}
          </select>

          {/* Botão Gerar Baterias */}
          <button
            onClick={() => setModalGerarBaterias({ aberto: true, tamanho: 15 })}
            className="min-h-[48px] px-4 bg-amber-500 hover:bg-amber-600 text-black font-black text-sm rounded-xl transition shadow flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Gerar Baterias</span>
          </button>

          {/* Botão Súmula Oficial em PDF */}
          {bateriaSelecionada !== 'TODAS' && (
            <a
              href={`/api/relatorios/bateria/${bateriaSelecionada}?formato=pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] px-4 bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm rounded-xl transition shadow flex items-center gap-2"
              title="Abrir súmula oficial da bateria em PDF para impressão"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Súmula PDF</span>
            </a>
          )}

          {/* Botão Imprimir Folha de Largada */}
          <button
            onClick={imprimirOrdemLargada}
            className="min-h-[48px] px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Imprimir Largada</span>
          </button>

          {/* Toggle Alto Contraste / Modo Pista */}
          <button
            onClick={() => setModoPista(!modoPista)}
            className={`min-h-[48px] px-4 font-bold text-sm rounded-xl border-2 transition flex items-center gap-2 ${
              modoPista ? 'bg-black text-amber-400 border-amber-400' : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>{modoPista ? 'Alto Contraste (ON)' : 'Visual Padrão'}</span>
          </button>
        </div>
      </div>

      {/* BANNER FLUTUANTE DE DESFAZER RESULTADO (10 SEGUNDOS) */}
      {ultimoResultado && (
        <div className="bg-amber-500 text-black p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border-4 border-black animate-pulse print:hidden">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-black flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-black text-lg uppercase tracking-wide">
                Resultado Lançado: Senha #{ultimoResultado.senhaCodigo} → {ultimoResultado.resultado}
              </p>
              <p className="text-xs font-bold text-black/80">
                Toque acidental? Você tem <span className="underline font-black text-sm">{ultimoResultado.tempoRestante}s</span> para desfazer e retornar a corrida para a pista.
              </p>
            </div>
          </div>
          <button
            onClick={handleDesfazerResultado}
            className="min-h-[56px] px-6 bg-black hover:bg-slate-900 text-amber-400 font-black text-base rounded-xl shadow-lg transition transform active:scale-95 flex items-center gap-2 border-2 border-amber-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>DESFAZER AGORA ({ultimoResultado.tempoRestante}s)</span>
          </button>
        </div>
      )}

      {/* CRONÔMETRO DE CANCELA & CORRIDA ATIVA (CARD DESTAQUE) */}
      {corridaAtiva && (
        <div className={`${modoPista ? 'bg-black border-4 border-amber-400' : 'bg-white border-2 border-slate-900'} rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden print:hidden`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b-2 border-slate-800 gap-4">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-xl font-black uppercase text-amber-400 tracking-wider">
                DUPLA NA PISTA • POSIÇÃO #{corridaAtiva.ordem_na_bateria || corridaAtiva.ordem_mapa}
              </span>
            </div>

            {/* PAINEL DO CRONÔMETRO DE CANCELA SINCRONIZADO NO SERVIDOR */}
            <div className="flex flex-wrap items-center gap-4 bg-slate-900 border-2 border-slate-700 p-3 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">CANCELA (SERVIDOR)</span>
                <span className={`text-[10px] font-black uppercase ${cancelaStatus === 'RODANDO' ? 'text-emerald-400' : cancelaStatus === 'ESTOURADA' ? 'text-rose-400' : 'text-gray-400'}`}>
                  {cancelaStatus}
                </span>
              </div>

              <div
                className={`text-3xl md:text-4xl font-mono font-black px-4 py-1 rounded-xl border-2 ${
                  tempoRestanteCancela === null || cancelaStatus === 'PARADA'
                    ? 'text-gray-500 border-gray-700 bg-black'
                    : tempoRestanteCancela > 15
                    ? 'text-emerald-400 border-emerald-500 bg-emerald-950/60'
                    : tempoRestanteCancela > 5
                    ? 'text-amber-400 border-amber-500 bg-amber-950/60'
                    : 'text-rose-400 border-rose-500 bg-rose-950/80 animate-pulse'
                }`}
              >
                {tempoRestanteCancela !== null && cancelaStatus === 'RODANDO'
                  ? `00:${tempoRestanteCancela.toString().padStart(2, '0')}`
                  : `00:${tempoCancelaPadrao}`}
              </div>

              {cancelaAtiva ? (
                <button
                  onClick={pararCancelaServidor}
                  className="min-h-[44px] px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  <span>Parar</span>
                </button>
              ) : (
                <button
                  onClick={() => dispararCancelaServidor(tempoCancelaPadrao)}
                  className="min-h-[44px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Disparar</span>
                </button>
              )}

              {/* Seletor rápido de tempo de cancela */}
              <div className="flex gap-1 text-xs">
                {[30, 45, 60].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTempoCancelaPadrao(t);
                      if (cancelaAtiva) dispararCancelaServidor(t);
                    }}
                    className={`px-2 py-1 rounded font-bold ${
                      tempoCancelaPadrao === t ? 'bg-amber-500 text-black' : 'bg-slate-800 text-gray-300'
                    }`}
                  >
                    {t}s
                  </button>
                ))}
              </div>

              {/* Controle de Áudio Explícito com Indicação de Estado */}
              <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
                {audioHabilitado ? (
                  <button
                    onClick={desativarAudio}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs font-black shadow"
                    title="Toque para mutar áudio da cancela"
                  >
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    <span>ÁUDIO ATIVO</span>
                  </button>
                ) : (
                  <button
                    onClick={ativarAudio}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow animate-bounce"
                    title="Navegadores exigem toque para tocar som"
                  >
                    <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                    <span>ATIVAR SOM (TOQUE)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* DADOS DA DUPLA ATIVA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-4xl md:text-5xl font-black font-mono text-white">
                  SENHA #{corridaAtiva.senha_codigo}
                </span>
                <span className="text-sm font-black px-3 py-1 rounded-xl bg-amber-500 text-black uppercase">
                  {corridaAtiva.senha_categoria}
                </span>
                <span className="text-sm font-bold text-emerald-400 uppercase">
                  BOI #{corridaAtiva.boi_numero || 1}
                </span>
              </div>

              {/* Puxador e Esteireiro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-900/90 border-2 border-slate-700 p-4 rounded-2xl">
                  <span className="text-xs font-bold text-amber-400 uppercase block">PUXADOR</span>
                  <span className="text-xl md:text-2xl font-black text-white block truncate">
                    {corridaAtiva.puxador_apelido ? `"${corridaAtiva.puxador_apelido}"` : corridaAtiva.puxador_nome}
                  </span>
                  <span className="text-xs text-gray-400 block truncate">{corridaAtiva.puxador_nome}</span>
                </div>

                <div className="bg-slate-900/90 border-2 border-slate-700 p-4 rounded-2xl">
                  <span className="text-xs font-bold text-blue-400 uppercase block">ESTEIREIRO</span>
                  <span className="text-xl md:text-2xl font-black text-white block truncate">
                    {corridaAtiva.esteira_apelido ? `"${corridaAtiva.esteira_apelido}"` : corridaAtiva.esteira_nome}
                  </span>
                  <span className="text-xs text-gray-400 block truncate">{corridaAtiva.esteira_nome}</span>
                </div>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO DE ALTO IMPACTO (MÍNIMO 56PX DE ALTURA PARA DEDO GRANDE SOB SOL) */}
            <div className="lg:col-span-6 flex flex-col gap-3">
              {corridaAtiva.estado === 'CHAMADA' && (
                <button
                  onClick={() => executarAcao('INICIAR', corridaAtiva.id)}
                  className="min-h-[64px] bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xl md:text-2xl rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wider"
                >
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>ABRIR PORTEIRA (INICIAR CORRIDA)</span>
                </button>
              )}

              {corridaAtiva.estado === 'EM_EXECUCAO' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* VALEU BOI */}
                  <button
                    onClick={() => executarAcao('REGISTRAR_RESULTADO', corridaAtiva.id, 'VALEU')}
                    className="min-h-[64px] bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xl md:text-2xl rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-black/40 border border-black/20"></span>
                    <span>VALEU BOI</span>
                  </button>

                  {/* ZERO (CONFIRMAÇÃO EM DOIS TOQUES) */}
                  <button
                    onClick={() => dispararConfirmacaoZero(corridaAtiva.id)}
                    className={`min-h-[64px] font-black text-lg md:text-xl rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider ${
                      confirmacaoZero && confirmacaoZero.id === corridaAtiva.id
                        ? 'bg-amber-400 text-black border-4 border-white animate-bounce'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {confirmacaoZero && confirmacaoZero.id === corridaAtiva.id ? (
                      <>
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>CONFIRMAR ZERO!</span>
                      </>
                    ) : (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full bg-white/40 border border-white/20"></span>
                        <span>ZERO</span>
                      </>
                    )}
                  </button>

                  {/* RETORNO */}
                  <button
                    onClick={() => executarAcao('REGISTRAR_RESULTADO', corridaAtiva.id, 'RETORNO')}
                    className="min-h-[64px] bg-amber-500 hover:bg-amber-600 text-black font-black text-lg md:text-xl rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>RETORNO</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SELEÇÃO E ORDEM DE LARGADA DA BATERIA (TABELA IMPRIMÍVEL) */}
      <div className={`${modoPista ? 'bg-slate-900 border-2 border-slate-800' : 'bg-white border border-slate-200'} rounded-3xl p-6 shadow-xl`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-700 mb-6 gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-amber-400 uppercase">
              ORDEM DE LARGADA DA BATERIA
            </h2>
            <p className="text-sm text-gray-400">
              Total listado: {corridasFiltradas.length} duplas na sequência de pista
            </p>
          </div>

          {/* Botão Fechar Bateria */}
          {bateriaSelecionada !== 'TODAS' && (
            <button
              onClick={() => handleFecharBateria(bateriaSelecionada)}
              className="min-h-[48px] px-5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl shadow print:hidden flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Fechar Bateria e Avançar</span>
            </button>
          )}
        </div>

        {/* TABELA DE CORRIDAS */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-700 text-xs font-black uppercase tracking-wider text-amber-400">
                <th className="py-3 px-4">LARGADA</th>
                <th className="py-3 px-4">SENHA</th>
                <th className="py-3 px-4">CATEGORIA</th>
                <th className="py-3 px-4">PUXADOR & APELIDO</th>
                <th className="py-3 px-4">ESTEIREIRO</th>
                <th className="py-3 px-4">TIPO</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4 text-right print:hidden">AÇÕES (56PX)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm font-semibold">
              {corridasFiltradas.map((c) => {
                const ativa = c.estado === 'EM_EXECUCAO' || c.estado === 'CHAMADA';
                return (
                  <tr
                    key={c.id}
                    className={`transition-colors ${
                      ativa
                        ? 'bg-amber-950/40 text-amber-300 font-bold border-l-4 border-amber-400'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-4 px-4 font-mono font-black text-lg text-amber-400">
                      #{c.ordem_na_bateria || c.ordem_mapa}
                    </td>
                    <td className="py-4 px-4 font-mono font-black text-base text-white">
                      {c.senha_codigo}
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-gray-300">
                        {c.senha_categoria}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-white font-bold">{c.puxador_apelido ? `"${c.puxador_apelido}"` : c.puxador_nome}</div>
                      <div className="text-xs text-gray-400 font-normal">{c.puxador_nome}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-white font-bold">{c.esteira_apelido ? `"${c.esteira_apelido}"` : c.esteira_nome}</div>
                      <div className="text-xs text-gray-400 font-normal">{c.esteira_nome}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          c.tipo_entrada === 'RETARDATARIA'
                            ? 'bg-purple-900 text-purple-200'
                            : c.tipo_entrada === 'RETORNO'
                            ? 'bg-amber-900 text-amber-200'
                            : 'bg-slate-800 text-gray-400'
                        }`}
                      >
                        {c.tipo_entrada || 'REGULAR'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-black uppercase ${
                          c.estado === 'CONCLUIDA'
                            ? c.resultado_final === 'VALEU'
                              ? 'bg-emerald-500 text-black'
                              : 'bg-rose-600 text-white'
                            : c.estado === 'EM_EXECUCAO'
                            ? 'bg-amber-500 text-black animate-pulse'
                            : c.estado === 'CHAMADA'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-gray-400'
                        }`}
                      >
                        {c.estado === 'CONCLUIDA' ? c.resultado_final || 'CONCLUÍDA' : c.estado}
                      </span>
                    </td>
                    {/* BOTÕES DE AÇÃO NA TABELA COM MÍNIMO 56PX */}
                    <td className="py-4 px-4 text-right print:hidden">
                      <div className="flex items-center justify-end gap-2">
                        {c.estado === 'EM_ESPERA' && (
                          <button
                            onClick={() => {
                              executarAcao('CHAMAR', c.id);
                              dispararCancelaServidor();
                            }}
                            className="min-h-[56px] px-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow transition flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                            </svg>
                            <span>CHAMAR PISTA</span>
                          </button>
                        )}

                        {c.estado === 'CONCLUIDA' && (
                          <button
                            onClick={() =>
                              setModalCorrecaoAdmin({
                                aberto: true,
                                corrida: c,
                                novoResultado: c.resultado_final === 'VALEU' ? 'ZERO' : 'VALEU',
                                motivo: '',
                              })
                            }
                            className="min-h-[44px] px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                            title="Correção administrativa após 10s (exige ADMIN e justificativa auditada)"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span>Corrigir (Admin)</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PARA CORREÇÃO ADMINISTRATIVA DE RESULTADO (AUDITADO) */}
      {modalCorrecaoAdmin.aberto && modalCorrecaoAdmin.corrida && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-white">
            <h3 className="text-2xl font-black text-amber-400 mb-2 uppercase flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Correção Administrativa</span>
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Esta ação é restrita a administradores e será registrada integralmente no log de auditoria com data, operador e motivo.
            </p>

            <div className="bg-black/60 p-4 rounded-xl border border-slate-700 mb-4 text-sm">
              <p className="text-gray-300 font-bold">
                Senha #{modalCorrecaoAdmin.corrida.senha_codigo} ({modalCorrecaoAdmin.corrida.senha_categoria})
              </p>
              <p className="text-xs text-gray-400">
                Puxador: {modalCorrecaoAdmin.corrida.puxador_nome} • Resultado Atual:{' '}
                <span className="font-black text-amber-400">{modalCorrecaoAdmin.corrida.resultado_final}</span>
              </p>
            </div>

            <label className="text-xs font-bold text-gray-300 uppercase block mb-1">
              Novo Resultado Oficial:
            </label>
            <select
              value={modalCorrecaoAdmin.novoResultado}
              onChange={(e) => setModalCorrecaoAdmin({ ...modalCorrecaoAdmin, novoResultado: e.target.value })}
              className="w-full min-h-[50px] px-3 bg-black border-2 border-slate-700 rounded-xl font-bold text-white mb-4"
            >
              <option value="VALEU">VALEU BOI</option>
              <option value="ZERO">ZERO</option>
              <option value="RETORNO">BOI DE RETORNO</option>
            </select>

            <label className="text-xs font-bold text-gray-300 uppercase block mb-1">
              Justificativa / Motivo da Correção (Obrigatório):
            </label>
            <textarea
              rows={3}
              placeholder="Ex.: Correção após revisão de filmagem pela comissão julgadora..."
              value={modalCorrecaoAdmin.motivo}
              onChange={(e) => setModalCorrecaoAdmin({ ...modalCorrecaoAdmin, motivo: e.target.value })}
              className="w-full p-3 bg-black border-2 border-slate-700 rounded-xl text-sm font-medium text-white mb-6"
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModalCorrecaoAdmin({ aberto: false, corrida: null, novoResultado: 'VALEU', motivo: '' })}
                className="min-h-[50px] px-5 bg-slate-800 text-gray-300 font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarCorrecaoAdmin}
                className="min-h-[50px] px-6 bg-amber-500 text-black font-black rounded-xl hover:bg-amber-600 transition"
              >
                Salvar Correção Auditada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA GERAR BATERIAS */}
      {modalGerarBaterias.aberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-white">
            <h3 className="text-2xl font-black text-amber-400 mb-2 uppercase flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Gerar Baterias de Corrida</span>
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              Agrupe automaticamente as duplas da vaquejada em baterias sequenciais.
            </p>

            <label className="text-xs font-bold text-gray-300 uppercase block mb-2">
              Tamanho de cada Bateria (duplas por bateria):
            </label>
            <input
              type="number"
              min="5"
              max="50"
              value={modalGerarBaterias.tamanho}
              onChange={(e) => setModalGerarBaterias({ ...modalGerarBaterias, tamanho: parseInt(e.target.value) || 15 })}
              className="w-full min-h-[56px] px-4 bg-black border-2 border-slate-700 rounded-xl text-2xl font-mono font-bold text-amber-400 mb-6"
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModalGerarBaterias({ aberto: false, tamanho: 15 })}
                className="min-h-[56px] px-5 bg-slate-800 text-gray-300 font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleGerarBaterias}
                className="min-h-[56px] px-6 bg-amber-500 text-black font-black rounded-xl hover:bg-amber-600 transition"
              >
                Gerar Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FLUTUANTE */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`px-6 py-4 rounded-2xl shadow-2xl font-black text-base flex items-center gap-3 border-2 ${
              toast.tipo === 'sucesso'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-500'
                : toast.tipo === 'erro'
                ? 'bg-rose-950 text-rose-200 border-rose-500'
                : 'bg-amber-950 text-amber-200 border-amber-500'
            }`}
          >
            {toast.tipo === 'sucesso' ? (
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : toast.tipo === 'erro' ? (
              <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span>{toast.mensagem}</span>
          </div>
        </div>
      )}
    </div>
  );
}

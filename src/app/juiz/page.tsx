'use client';

import { useState, useEffect } from 'react';

interface Contestacao {
  id: string;
  corrida_id: string;
  senha_id: string;
  solicitante_nome: string;
  motivo: string;
  estado: string;
  video_url: string | null;
  video_anexado_em: string | null;
  resultado_inicial: string;
  decisao_juiz: string | null;
  justificativa_juiz: string | null;
  decidido_em: string | null;
  criado_em: string;
  senha_codigo: string;
  puxador_nome: string;
  esteira_nome: string;
  senha_categoria: string;
  boi_nome: string;
  boi_numero_registro: string;
  ordem_mapa: number;
  boi_numero: number;
}

export default function JuizBoiTvPage() {
  const [contestacoes, setContestacoes] = useState<Contestacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState<Contestacao | null>(null);

  // Julgamento
  const [decisao, setDecisao] = useState<'VALEU' | 'ZERO_MANTIDO'>('VALEU');
  const [justificativa, setJustificativa] = useState('');
  const [juizNome] = useState('Juiz Titular da Prova');

  // Vídeo
  const [videoUrlInput, setVideoUrlInput] = useState('');

  const carregarContestacoes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/juiz');
      const data = await res.json();
      if (Array.isArray(data)) {
        setContestacoes(data);
        if (data.length > 0 && !selecionada) {
          setSelecionada(data[0]);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar contestações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarContestacoes();
  }, []);

  const handleJulgar = async () => {
    if (!selecionada) return;
    if (!justificativa.trim()) {
      alert('A justificativa da decisão é obrigatória');
      return;
    }

    try {
      const res = await fetch('/api/juiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'JULGAR',
          contestacaoId: selecionada.id,
          decisao,
          justificativa,
          juizNome,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.mensagem || 'Decisão homologada');
        setJustificativa('');
        await carregarContestacoes();
      } else {
        alert(data.error || 'Erro ao homologar julgamento');
      }
    } catch {
      alert('Erro de conexão');
    }
  };

  const handleAnexarVideo = async () => {
    if (!selecionada || !videoUrlInput.trim()) {
      alert('Informe o link do arquivo de vídeo oficial');
      return;
    }

    try {
      const res = await fetch('/api/juiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'ANEXAR_VIDEO',
          contestacaoId: selecionada.id,
          videoUrl: videoUrlInput,
        }),
      });
      if (res.ok) {
        alert('Vídeo anexado com sucesso');
        setVideoUrlInput('');
        await carregarContestacoes();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao anexar vídeo');
      }
    } catch {
      alert('Erro de conexão');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Mesa de Julgamento por Vídeo
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Revisão técnica de provas contestadas com reprodução oficial e registro de veredito
          </p>
        </div>
        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          Responsável: <strong className="text-slate-800">{juizNome}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de Contestações */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Casos em Pauta ({contestacoes.length})
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-6 text-center">Carregando...</p>
            ) : contestacoes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Nenhuma contestação em aberto.
              </div>
            ) : (
              <div className="space-y-2">
                {contestacoes.map((item) => {
                  const isAtivo = selecionada?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelecionada(item)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition text-xs ${
                        isAtivo
                          ? 'border-slate-900 bg-slate-50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">
                          {item.senha_codigo} · #{item.ordem_mapa}
                        </span>
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                            item.estado === 'DECIDIDA_PELO_JUIZ'
                              ? 'bg-slate-100 text-slate-700'
                              : item.estado === 'PRONTA_PARA_ANALISE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.estado === 'DECIDIDA_PELO_JUIZ' ? 'Julgada' : item.estado.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-slate-700">
                        {item.solicitante_nome}
                      </div>
                      <div className="text-slate-400 mt-1 line-clamp-1 italic">
                        &quot;{item.motivo}&quot;
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Painel do Julgamento e Vídeo */}
        <div className="lg:col-span-8 space-y-4">
          {selecionada ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    Registro de Prova #{selecionada.id.slice(0, 8)}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    Senha {selecionada.senha_codigo} · Boi {selecionada.boi_nome} ({selecionada.boi_numero_registro})
                  </h2>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Puxador: {selecionada.puxador_nome} | Categoria: {selecionada.senha_categoria}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Apontamento de Pista</span>
                  <span className="text-sm font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded border border-rose-200 inline-block">
                    {selecionada.resultado_inicial}
                  </span>
                </div>
              </div>

              {/* Motivo da Contestação */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs text-slate-700">
                <span className="font-semibold block text-slate-900 mb-0.5">
                  Alegação do Competidor:
                </span>
                {selecionada.motivo}
              </div>

              {/* Player de Vídeo */}
              <div>
                <div className="text-xs font-semibold text-slate-700 uppercase mb-2">
                  Gravação Oficial da Corrida
                </div>
                {selecionada.video_url ? (
                  <div className="rounded-lg overflow-hidden bg-black aspect-video border border-slate-300">
                    <video
                      key={selecionada.video_url}
                      src={selecionada.video_url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50 space-y-2">
                    <div className="text-xs font-semibold text-slate-600">
                      Nenhum arquivo de vídeo anexado para esta ocorrência.
                    </div>
                    <div className="flex gap-2 max-w-md mx-auto pt-2">
                      <input
                        type="url"
                        placeholder="Link do arquivo de vídeo..."
                        value={videoUrlInput}
                        onChange={(e) => setVideoUrlInput(e.target.value)}
                        className="flex-1 text-xs border border-slate-300 rounded-md px-3 py-1.5"
                      />
                      <button
                        onClick={handleAnexarVideo}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md"
                      >
                        Anexar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Formulário de Julgamento */}
              {selecionada.estado === 'DECIDIDA_PELO_JUIZ' ? (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-1.5 text-xs">
                  <div className="font-bold text-slate-900">
                    Decisão Homologada: {selecionada.decisao_juiz === 'VALEU' ? 'Valeu Boi' : 'Zero Mantido'}
                  </div>
                  <div className="text-slate-600">
                    <strong>Fundamentação:</strong> {selecionada.justificativa_juiz}
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200 bg-slate-50/50 p-4 rounded-lg space-y-3">
                  <div className="text-xs font-bold text-slate-800 uppercase">
                    Decisão da Arbitragem
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDecisao('VALEU')}
                      className={`py-2 px-3 rounded-lg text-center font-bold text-xs border transition ${
                        decisao === 'VALEU'
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Reverter para Valeu
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecisao('ZERO_MANTIDO')}
                      className={`py-2 px-3 rounded-lg text-center font-bold text-xs border transition ${
                        decisao === 'ZERO_MANTIDO'
                          ? 'border-rose-700 bg-rose-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Manter Zero
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fundamentação Técnica do Julgamento *
                    </label>
                    <textarea
                      rows={2}
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder="Descreva a justificativa regulamentar da decisão..."
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <button
                    onClick={handleJulgar}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition"
                  >
                    Confirmar e Homologar Veredito
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 text-center text-slate-400 border border-slate-200 text-xs">
              Selecione um caso na lista para visualizar o vídeo e lavrar a decisão.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

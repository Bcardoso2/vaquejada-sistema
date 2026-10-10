'use client';

import { useState, useEffect } from 'react';

interface BoiOuro {
  id: string;
  boi_id: string;
  valor: number;
  valor_centavos: number;
  pago: boolean;
  pagamento_confirmado_em: string | null;
  referencia_pagamento: string | null;
  estado: string;
  autorizado_por: string | null;
  autorizado_em: string | null;
  ativo: boolean;
  senha_origem_id: string;
  senha_codigo: string;
  puxador_nome: string;
  esteira_nome: string;
  boi_nome: string;
  boi_numero_registro: string;
}

export default function SecretariaPage() {
  const [abaAtiva, setAbaAtiva] = useState<'VENDAS' | 'BOI_OURO'>('VENDAS');
  const [boisOuro, setBoisOuro] = useState<BoiOuro[]>([]);
  const [loading, setLoading] = useState(false);

  // Form Venda de Senhas
  const [tipoVenda, setTipoVenda] = useState<'KIT' | 'SOLTEIRA'>('KIT');
  const [canalVenda, setCanalVenda] = useState<'PRESENCIAL' | 'ANTECIPADA'>('PRESENCIAL');
  const [puxadorNome, setPuxadorNome] = useState('');
  const [esteiraNome, setEsteiraNome] = useState('');
  const [categoria, setCategoria] = useState('PROFISSIONAL');
  const [valorVenda, setValorVenda] = useState(600);
  const [retornoVenda, setRetornoVenda] = useState<any>(null);

  // Form Solicitar Boi de Ouro
  const [senhaOrigemId, setSenhaOrigemId] = useState('');

  const carregarBoisOuro = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/secretaria/boi-ouro');
      const data = await res.json();
      if (Array.isArray(data)) {
        setBoisOuro(data);
      }
    } catch (err) {
      console.error('Erro ao carregar bois de ouro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarBoisOuro();
  }, []);

  const handleEmitirVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puxadorNome.trim() || !esteiraNome.trim()) {
      alert('Informe os nomes do puxador e do esteira');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/secretaria/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoVenda,
          canalVenda,
          puxadorNome,
          esteiraNome,
          categoria,
          valorCentavos: valorVenda * 100,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRetornoVenda(data);
        setPuxadorNome('');
        setEsteiraNome('');
      } else {
        alert(data.error || 'Erro ao realizar venda');
      }
    } catch {
      alert('Erro de conexão ao realizar venda');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarPagamentoBoiOuro = async (boiOuroId: string) => {
    const ref = prompt('Informe a referência ou comprovante do pagamento:', 'PIX-CAIXA');
    if (!ref) return;

    try {
      const res = await fetch('/api/secretaria/boi-ouro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'PAGAR',
          boiOuroId,
          referenciaPagamento: ref,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await carregarBoisOuro();
      } else {
        alert(data.error || 'Erro ao confirmar pagamento');
      }
    } catch {
      alert('Erro ao confirmar pagamento');
    }
  };

  const handleAutorizarSecretariaBoiOuro = async (boiOuroId: string) => {
    try {
      const res = await fetch('/api/secretaria/boi-ouro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'AUTORIZAR_SECRETARIA',
          boiOuroId,
          usuarioPapel: 'SECRETARIO',
          usuarioNome: 'Secretaria Oficial',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await carregarBoisOuro();
      } else {
        alert(data.error || 'Erro ao autorizar boi de ouro');
      }
    } catch {
      alert('Erro ao autorizar boi de ouro');
    }
  };

  const handleSolicitarBoiOuro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaOrigemId.trim()) {
      alert('Informe o ID ou código da senha de origem');
      return;
    }

    try {
      const res = await fetch('/api/secretaria/boi-ouro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'SOLICITAR',
          senhaOrigemId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSenhaOrigemId('');
        await carregarBoisOuro();
      } else {
        alert(data.error || 'Erro ao solicitar boi de ouro');
      }
    } catch {
      alert('Erro ao solicitar boi de ouro');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Secretaria & Emissão de Senhas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de inscrições de kits, senhas individuais e liberação de Boi de Ouro
          </p>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-200 gap-2 bg-white px-4 pt-2 rounded-t-xl border-t border-x">
        <button
          type="button"
          onClick={() => setAbaAtiva('VENDAS')}
          className={`py-3 px-5 font-bold text-sm border-b-2 transition cursor-pointer ${
            abaAtiva === 'VENDAS'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Venda de Senhas (Kit & Solteira)
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('BOI_OURO')}
          className={`py-3 px-5 font-bold text-sm border-b-2 transition cursor-pointer ${
            abaAtiva === 'BOI_OURO'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Boi de Ouro (Esteira de Autorização)
        </button>
      </div>

      {/* Aba Vendas */}
      {abaAtiva === 'VENDAS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Formulário de Inscrição e Emissão
            </h2>

            <form onSubmit={handleEmitirVenda} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Modalidade da Senha
                  </label>
                  <select
                    value={tipoVenda}
                    onChange={(e) => {
                      setTipoVenda(e.target.value as any);
                      setValorVenda(e.target.value === 'KIT' ? 600 : 350);
                    }}
                    className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  >
                    <option value="KIT">Kit (2 Senhas · 4 Bois na Pista)</option>
                    <option value="SOLTEIRA">Senha Solteira (1 Senha · 2 Bois)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Canal de Venda
                  </label>
                  <select
                    value={canalVenda}
                    onChange={(e) => setCanalVenda(e.target.value as any)}
                    className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  >
                    <option value="PRESENCIAL">Presencial (Secretaria no Parque)</option>
                    <option value="ANTECIPADA">Antecipada (Site / App)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome do Puxador *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Celso Vitório"
                    value={puxadorNome}
                    onChange={(e) => setPuxadorNome(e.target.value)}
                    className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome do Esteira *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Juninho Vaqueiro"
                    value={esteiraNome}
                    onChange={(e) => setEsteiraNome(e.target.value)}
                    className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Categoria da Prova
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  >
                    <option value="PROFISSIONAL">Profissional</option>
                    <option value="AMADOR">Amador</option>
                    <option value="ASPIRANTE">Aspirante</option>
                    <option value="FEMININA">Feminina</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Valor Total (R$)
                  </label>
                  <input
                    type="number"
                    value={valorVenda}
                    onChange={(e) => setValorVenda(Number(e.target.value))}
                    className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <div>• O sistema gera <strong>senhas independentes</strong> com 2 bois alocados para cada senha.</div>
                <div>• As oportunidades de corrida são automaticamente posicionadas na fila do <strong>Mapa da Pista</strong>.</div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition text-sm shadow-sm cursor-pointer"
              >
                {loading ? 'Processando Emissão...' : `Confirmar Emissão (${tipoVenda})`}
              </button>
            </form>
          </div>

          {/* Painel Lateral com Confirmação da Venda */}
          <div className="lg:col-span-5 space-y-4">
            {retornoVenda ? (
              <div className="bg-white border-2 border-emerald-500 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Venda Emitida com Sucesso
                </div>
                <div className="text-xs text-slate-600 space-y-2">
                  <p>{retornoVenda.mensagem}</p>
                  {retornoVenda.kit && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <strong>Código do Kit:</strong> {retornoVenda.kit.codigo}
                    </div>
                  )}
                  {retornoVenda.senhas && (
                    <div className="space-y-1.5">
                      <strong className="block text-slate-800">Senhas Geradas:</strong>
                      {retornoVenda.senhas.map((s: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between font-mono text-xs">
                          <span className="font-bold text-slate-900">Senha {idx + 1}: {s.codigo}</span>
                          <span className="text-slate-500">2 bois alocados</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {retornoVenda.senha && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs font-bold text-slate-900">
                      Senha Solteira: {retornoVenda.senha.codigo} (2 bois alocados)
                    </div>
                  )}
                </div>
                <a
                  href="/mapa"
                  className="block text-center py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition"
                >
                  Visualizar no Mapa da Pista &rarr;
                </a>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs shadow-sm">
                Preencha o formulário para emitir uma nova venda com geração automática de senhas e alocação na boiada.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Aba Boi de Ouro */}
      {abaAtiva === 'BOI_OURO' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-2">
              Solicitar Boi de Ouro
            </h2>
            <form onSubmit={handleSolicitarBoiOuro} className="flex flex-col sm:flex-row gap-2 max-w-xl">
              <input
                type="text"
                placeholder="ID ou Código da Senha de Origem (Ex: sn-001)..."
                value={senhaOrigemId}
                onChange={(e) => setSenhaOrigemId(e.target.value)}
                className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm transition"
              >
                Registrar Solicitação
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
              Solicitações de Boi de Ouro
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                    <th className="py-3 px-4">Senha Origem</th>
                    <th className="py-3 px-4">Competidor</th>
                    <th className="py-3 px-4">Boi Alocado</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4">Pagamento</th>
                    <th className="py-3 px-4">Situação</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {boisOuro.map((bo) => (
                    <tr key={bo.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {bo.senha_codigo || bo.senha_origem_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{bo.puxador_nome || 'Competidor'}</div>
                        <div className="text-slate-400">Esteira: {bo.esteira_nome || '-'}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {bo.boi_nome} ({bo.boi_numero_registro})
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        R$ {((bo.valor_centavos || 20000) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        {bo.pago ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Confirmado ({bo.referencia_pagamento})
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConfirmarPagamentoBoiOuro(bo.id)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded border border-amber-200 cursor-pointer"
                          >
                            Confirmar Pagamento
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded ${
                            bo.estado === 'NO_MAPA'
                              ? 'bg-slate-100 text-slate-800'
                              : bo.estado === 'PAGO_AGUARDANDO_AUTORIZACAO'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {bo.estado === 'NO_MAPA' ? 'Liberado no Mapa' : bo.estado.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {bo.estado !== 'NO_MAPA' ? (
                          <button
                            type="button"
                            onClick={() => handleAutorizarSecretariaBoiOuro(bo.id)}
                            disabled={!bo.pago}
                            className={`px-3 py-1 font-bold rounded transition cursor-pointer ${
                              bo.pago
                                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            Autorizar no Mapa
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-bold">No Mapa</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

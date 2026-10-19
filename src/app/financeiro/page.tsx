'use client';

import { useState, useEffect } from 'react';

interface FinanceiroResumo {
  totalRecebidoCentavos: number;
  totalBrutoRecebidoCentavos: number;
  totalEstornadoCentavos: number;
  saldoLiquidoCentavos: number;
  totalSenhasPagasCentavos: number;
  totalBoisOuroCentavos: number;
  qtdSenhas: number;
  qtdBoisOuro: number;
  qtdEstornos: number;
  qtdPagamentos: number;
}

interface PagamentoItem {
  id: string;
  senha_id: string | null;
  senha_codigo: string | null;
  puxador_nome: string | null;
  categoria: string | null;
  tipo: string;
  valor_centavos: number;
  status: 'CONFIRMADO' | 'ESTORNADO';
  referencia_externa: string | null;
  comprovante_detalhes: string | null;
  confirmado_em: string;
  criado_em: string;
}

export default function FinanceiroPage() {
  const [resumo, setResumo] = useState<FinanceiroResumo | null>(null);
  const [senhas, setSenhas] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'extrato' | 'senhas'>('extrato');

  // Modal pagamento manual
  const [modalManual, setModalManual] = useState({
    aberto: false,
    senhaId: '',
    valor: 300,
    referencia: '',
  });

  // Modal estorno manual
  const [modalEstorno, setModalEstorno] = useState({
    aberto: false,
    pagamentoId: '',
    motivo: '',
  });

  const carregarDados = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/financeiro');
      const data = await res.json();
      if (data.resumo) {
        setResumo(data.resumo);
        setSenhas(data.senhas || []);
        setPagamentos(data.pagamentos || []);
      }
    } catch (err) {
      console.error('Erro ao carregar financeiro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleSalvarPagamentoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalManual.senhaId || !modalManual.referencia.trim()) {
      alert('Selecione a senha e informe a referência do pagamento');
      return;
    }

    try {
      const res = await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'RECEBIMENTO',
          senhaId: modalManual.senhaId,
          tipo: 'MANUAL',
          valorCentavos: modalManual.valor * 100,
          referencia: modalManual.referencia,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalManual({ aberto: false, senhaId: '', valor: 300, referencia: '' });
        await carregarDados();
      } else {
        alert(data.error || 'Erro ao registrar pagamento');
      }
    } catch {
      alert('Erro de conexão');
    }
  };

  const handleConfirmarEstorno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEstorno.motivo || modalEstorno.motivo.trim().length < 5) {
      alert('Informe uma justificativa de estorno detalhada (ao menos 5 caracteres)');
      return;
    }

    try {
      const res = await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'ESTORNO',
          pagamentoId: modalEstorno.pagamentoId,
          motivo: modalEstorno.motivo,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalEstorno({ aberto: false, pagamentoId: '', motivo: '' });
        await carregarDados();
      } else {
        alert(data.error || 'Erro ao processar estorno');
      }
    } catch {
      alert('Erro ao conectar ao servidor');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Caixa & Gestão Financeira
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Operação Ao Vivo
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Conciliação de recebimentos, saídas por estorno e fluxo de caixa consolidado
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Botões de Exportação da Parte 2 */}
          <a
            href="/api/relatorios/fechamento-caixa?formato=pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-xs transition shadow-xs flex items-center gap-1.5"
            title="Exportar fechamento contábil oficial em PDF nativo"
          >
            <span>📕</span>
            <span>Fechamento PDF</span>
          </a>

          <a
            href="/api/relatorios/fechamento-caixa?formato=xlsx"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs transition shadow-xs flex items-center gap-1.5"
            title="Exportar planilha de fechamento para Microsoft Excel (.xlsx)"
          >
            <span>📗</span>
            <span>Excel (.xlsx)</span>
          </a>

          <a
            href="/api/relatorios/fechamento-caixa?formato=csv"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition shadow-xs flex items-center gap-1.5"
            title="Exportar dados de fechamento em CSV"
          >
            <span>📄</span>
            <span>CSV</span>
          </a>

          <a
            href="/api/relatorios/resultados?formato=pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold text-xs transition shadow-xs flex items-center gap-1.5"
            title="Exportar relatório de resultados por categoria e bateria em PDF"
          >
            <span>📊</span>
            <span>Resultados PDF</span>
          </a>

          <button
            onClick={() => carregarDados()}
            className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition"
          >
            ↻ Atualizar
          </button>
          <button
            onClick={() => setModalManual({ ...modalManual, aberto: true })}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition shadow-xs"
          >
            + Lançar Recebimento Manual
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      {resumo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Saldo Líquido */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-xl shadow-md border border-slate-800">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Saldo Líquido em Caixa
            </span>
            <div className="text-2xl font-black mt-2 tracking-tight text-emerald-400">
              R$ {((resumo.saldoLiquidoCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>(Entradas - Estornos)</span>
              <span className="text-emerald-300 font-medium">Disponível</span>
            </div>
          </div>

          {/* 2. Total Arrecadado Bruto */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Arrecadado (Bruto)
            </span>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">
              R$ {((resumo.totalBrutoRecebidoCentavos || resumo.totalRecebidoCentavos) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {resumo.qtdPagamentos} lançamento(s) registrados
            </div>
          </div>

          {/* 3. Total Estornos / Saídas */}
          <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-xs bg-rose-50/20">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
              <span>↓</span> Saídas / Estornos
            </span>
            <div className="text-2xl font-extrabold text-rose-600 mt-2">
              - R$ {((resumo.totalEstornadoCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-rose-600/80 mt-1">
              {resumo.qtdEstornos} pagamento(s) estornado(s)
            </div>
          </div>

          {/* 4. Boi de Ouro & Senhas */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Senhas & Boi de Ouro
            </span>
            <div className="text-2xl font-extrabold text-amber-700 mt-2">
              R$ {((resumo.totalBoisOuroCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {resumo.qtdSenhas} senhas | {resumo.qtdBoisOuro} bois ouro
            </div>
          </div>
        </div>
      )}

      {/* Navegação entre Abas */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setAbaAtiva('extrato')}
          className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
            abaAtiva === 'extrato'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Extrato de Movimentações & Estornos</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
            {pagamentos.length}
          </span>
        </button>

        <button
          onClick={() => setAbaAtiva('senhas')}
          className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
            abaAtiva === 'senhas'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Posição Comercial das Senhas</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
            {senhas.length}
          </span>
        </button>
      </div>

      {/* ABA 1: EXTRATO DE MOVIMENTAÇÕES DE CAIXA */}
      {abaAtiva === 'extrato' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Histórico Contábil de Entradas e Estornos
            </span>
            <span className="text-xs text-slate-400">
              Registros ordenados por data decrescente
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">Data/Hora</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Senha / Competidor</th>
                  <th className="py-3 px-4">Detalhes / Referência</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pagamentos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Nenhuma movimentação financeira registrada até o momento.
                    </td>
                  </tr>
                ) : (
                  pagamentos.map((p) => {
                    const isEstornado = p.status === 'ESTORNADO';
                    return (
                      <tr key={p.id} className={isEstornado ? 'bg-rose-50/30' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                          {p.confirmado_em ? new Date(p.confirmado_em).toLocaleString('pt-BR') : new Date(p.criado_em).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                            {p.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {p.senha_codigo ? (
                            <div>
                              <span className="font-mono font-bold text-slate-900">{p.senha_codigo}</span>
                              <span className="text-slate-500 block text-[11px]">
                                {p.puxador_nome || 'N/A'} {p.categoria ? `(${p.categoria})` : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Avulso / Boi Ouro</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={p.comprovante_detalhes || p.referencia_externa || ''}>
                          {p.comprovante_detalhes || p.referencia_externa || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                              isEstornado
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isEstornado ? 'ESTORNADO' : 'CONFIRMADO'}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                          isEstornado ? 'text-rose-600 line-through' : 'text-emerald-700'
                        }`}>
                          {isEstornado ? '- ' : '+ '}
                          R$ {((p.valor_centavos || 0) / 100).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {!isEstornado && (
                            <button
                              onClick={() => setModalEstorno({ aberto: true, pagamentoId: p.id, motivo: '' })}
                              className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded text-[11px] font-medium transition"
                              title="Estornar este lançamento"
                            >
                              Estornar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 2: POSIÇÃO COMERCIAL DAS SENHAS */}
      {abaAtiva === 'senhas' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
            Posição Comercial das Senhas
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">Senha</th>
                  <th className="py-3 px-4">Competidor</th>
                  <th className="py-3 px-4">Canal</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Situação Comercial</th>
                  <th className="py-3 px-4 text-center">Comprovante</th>
                  <th className="py-3 px-4 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {senhas.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.codigo}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{s.puxador_nome || 'N/A'}</span>
                      <span className="text-slate-400 block">{s.categoria}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {s.tipo_venda} · {s.canal_venda}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      R$ {((s.valor_centavos || 30000) / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded ${
                          s.estado_comercial === 'PAGA'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : s.estado_comercial === 'CANCELADA'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {s.estado_comercial}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <a
                        href={`/comprovante/${s.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-[11px] border border-slate-300 transition inline-flex items-center gap-1"
                        title="Imprimir comprovante em impressora térmica 58/80mm"
                      >
                        <span>🖨️</span>
                        <span>Térmico</span>
                      </a>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {new Date(s.criado_em).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Pagamento Manual */}
      {modalManual.aberto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSalvarPagamentoManual} className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Registrar Pagamento Manual
            </h3>
            <p className="text-xs text-slate-500">
              Informe a referência do recebimento ou número de comprovante do caixa.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Senha *
              </label>
              <select
                required
                value={modalManual.senhaId}
                onChange={(e) => setModalManual({ ...modalManual, senhaId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              >
                <option value="">Selecione...</option>
                {senhas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.codigo} - {s.puxador_nome} ({s.estado_comercial})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Recebido (R$)
              </label>
              <input
                type="number"
                value={modalManual.valor}
                onChange={(e) => setModalManual({ ...modalManual, valor: Number(e.target.value) })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Referência / Comprovante *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: DINHEIRO-CAIXA ou DOC-PIX-9988"
                value={modalManual.referencia}
                onChange={(e) => setModalManual({ ...modalManual, referencia: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalManual({ ...modalManual, aberto: false })}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Estorno Manual */}
      {modalEstorno.aberto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleConfirmarEstorno} className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <span className="text-xl">⚠️</span>
              <h3 className="text-base font-bold text-slate-900">
                Confirmar Estorno Financeiro
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Esta ação registrará a saída contábil imediata no caixa e marcará o lançamento como estornado na auditoria.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Justificativa / Motivo do Estorno *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Ex: Desistência do competidor solicitada na secretaria com comprovante de devolução PIX."
                value={modalEstorno.motivo}
                onChange={(e) => setModalEstorno({ ...modalEstorno, motivo: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEstorno({ aberto: false, pagamentoId: '', motivo: '' })}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirmar Estorno
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

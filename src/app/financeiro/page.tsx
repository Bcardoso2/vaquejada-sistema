'use client';

import { useState, useEffect } from 'react';

interface FinanceiroResumo {
  totalRecebidoCentavos: number;
  totalSenhasPagasCentavos: number;
  totalBoisOuroCentavos: number;
  qtdSenhas: number;
  qtdBoisOuro: number;
}

export default function FinanceiroPage() {
  const [resumo, setResumo] = useState<FinanceiroResumo | null>(null);
  const [senhas, setSenhas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal pagamento manual
  const [modalManual, setModalManual] = useState({
    aberto: false,
    senhaId: '',
    valor: 300,
    referencia: '',
  });

  const carregarDados = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/financeiro');
      const data = await res.json();
      if (data.resumo) {
        setResumo(data.resumo);
        setSenhas(data.senhas || []);
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Caixa & Gestão Financeira
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Conciliação de recebimentos de senhas e boi de ouro com controle de liquidação
          </p>
        </div>
        <button
          onClick={() => setModalManual({ ...modalManual, aberto: true })}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition shadow-xs"
        >
          Lançar Recebimento Manual
        </button>
      </div>

      {/* Cards de Resumo */}
      {resumo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Arrecadado
            </span>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1.5">
              R$ {(resumo.totalRecebidoCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Valores liquidados no sistema
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Receita de Senhas
            </span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1.5">
              R$ {(resumo.totalSenhasPagasCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {resumo.qtdSenhas} senhas cadastradas
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Receita Boi de Ouro
            </span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1.5">
              R$ {(resumo.totalBoisOuroCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {resumo.qtdBoisOuro} solicitações registradas
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Senhas */}
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
                <th className="py-3 px-4">Situação Financeira</th>
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
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {s.estado_comercial}
                    </span>
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
    </div>
  );
}

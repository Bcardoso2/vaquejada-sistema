'use client';

import { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  usuario_id: string | null;
  usuario_nome: string;
  papel: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: any;
  motivo: string | null;
  criado_em: string;
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const carregarLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auditoria');
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLogs();
  }, []);

  const logsFiltrados = logs.filter((l) => {
    const q = busca.toLowerCase();
    return (
      l.acao.toLowerCase().includes(q) ||
      (l.usuario_nome && l.usuario_nome.toLowerCase().includes(q)) ||
      (l.motivo && l.motivo.toLowerCase().includes(q)) ||
      l.entidade.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Trilha de Auditoria
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Registro imutável de eventos sensíveis, apontamentos de pista, exceções e conciliações
          </p>
        </div>
        <button
          onClick={carregarLogs}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
        >
          Atualizar Logs
        </button>
      </div>

      {/* Barra de Filtro */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Filtrar por ação, responsável, motivo ou entidade..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full max-w-md text-xs border border-slate-300 rounded-lg px-3 py-2"
        />
        <div className="text-xs text-slate-500 whitespace-nowrap">
          Total de registros: <strong className="text-slate-800">{logsFiltrados.length}</strong>
        </div>
      </div>

      {/* Tabela de Logs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Data/Hora</th>
                <th className="py-3 px-4">Responsável</th>
                <th className="py-3 px-4">Ação</th>
                <th className="py-3 px-4">Entidade</th>
                <th className="py-3 px-4">Motivo / Justificativa</th>
                <th className="py-3 px-4">Parâmetros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Carregando trilha de auditoria...
                  </td>
                </tr>
              ) : logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 font-mono">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-sans">
                      {new Date(log.criado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-semibold text-slate-900">{log.usuario_nome || 'Sistema'}</div>
                      <span className="text-[10px] text-slate-500">{log.papel}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-semibold">
                        {log.acao}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.entidade}
                      {log.entidade_id && <span className="text-slate-400 block text-[10px]">#{log.entidade_id}</span>}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-700 max-w-xs">
                      {log.motivo || '-'}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      {log.detalhes ? (
                        <code className="text-[10px] bg-slate-50 p-1 rounded block text-slate-700 overflow-x-auto whitespace-pre-wrap">
                          {typeof log.detalhes === 'string'
                            ? log.detalhes
                            : JSON.stringify(log.detalhes)}
                        </code>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

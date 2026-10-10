'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardStats {
  corridasTotal: number;
  corridasChamadas: number;
  contestacoesAbertas: number;
  boisOuroPendentes: number;
  totalArrecadado: number;
  senhasAtivas: number;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<DashboardStats>({
    corridasTotal: 0,
    corridasChamadas: 0,
    contestacoesAbertas: 0,
    boisOuroPendentes: 0,
    totalArrecadado: 0,
    senhasAtivas: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarMetricas = async () => {
      try {
        const [mapaRes, juizRes, bdoRes, finRes] = await Promise.all([
          fetch('/api/mapa').then((r) => r.json()),
          fetch('/api/juiz').then((r) => r.json()),
          fetch('/api/secretaria/boi-ouro').then((r) => r.json()),
          fetch('/api/financeiro').then((r) => r.json()),
        ]);

        const mapaArray = Array.isArray(mapaRes) ? mapaRes : [];
        const juizArray = Array.isArray(juizRes) ? juizRes : [];
        const bdoArray = Array.isArray(bdoRes) ? bdoRes : [];

        setStats({
          corridasTotal: mapaArray.length,
          corridasChamadas: mapaArray.filter((c) => c.estado === 'CHAMADA' || c.estado === 'EM_EXECUCAO').length,
          contestacoesAbertas: juizArray.filter((j) => j.estado !== 'DECIDIDA_PELO_JUIZ').length,
          boisOuroPendentes: bdoArray.filter((b) => b.pago && !b.ativo).length,
          totalArrecadado: finRes?.resumo?.totalRecebidoCentavos ? finRes.resumo.totalRecebidoCentavos / 100 : 0,
          senhasAtivas: finRes?.resumo?.qtdSenhas || 0,
        });
      } catch (err) {
        console.error('Erro ao carregar métricas:', err);
      } finally {
        setLoading(false);
      }
    };

    carregarMetricas();
  }, []);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Visão Geral */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Painel de Operações
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visão consolidada da pista, secretaria, julgamento e fluxo financeiro do evento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/mapa"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition shadow-xs"
          >
            Acessar Pista
          </Link>
          <Link
            href="/secretaria"
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition"
          >
            Emitir Senha
          </Link>
        </div>
      </div>

      {/* Indicadores Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pista em Execução
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {stats.corridasChamadas}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.corridasTotal} corridas programadas no mapa
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Contestações de Vídeo
          </div>
          <div className="text-3xl font-extrabold text-amber-700 mt-2">
            {stats.contestacoesAbertas}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Revisões de zero em análise pelo juiz
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Boi de Ouro Pendente
          </div>
          <div className="text-3xl font-extrabold text-indigo-700 mt-2">
            {stats.boisOuroPendentes}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Pagos aguardando autorização da secretaria
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Receita Liquidada
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">
            R$ {stats.totalArrecadado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.senhasAtivas} senhas emitidas e confirmadas
          </div>
        </div>
      </div>

      {/* Módulos de Operação Rápida */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/mapa"
          className="bg-white border border-slate-200 hover:border-slate-300 p-5 rounded-xl shadow-xs transition hover:shadow-sm group flex flex-col justify-between"
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Operacional
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1 group-hover:text-slate-800">
              Mapa Geral & Pista
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Controle de chamadas de competidores, abertura de porteira e registro oficial de <strong>Valeu</strong>, <strong>Zero</strong> e <strong>Retorno</strong>.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-900 flex items-center justify-between">
            <span>Abrir mapa de pista</span>
            <span>&rarr;</span>
          </div>
        </Link>

        <Link
          href="/juiz"
          className="bg-white border border-slate-200 hover:border-slate-300 p-5 rounded-xl shadow-xs transition hover:shadow-sm group flex flex-col justify-between"
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Arbitragem
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1 group-hover:text-slate-800">
              Mesa do Juiz & Vídeo
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Análise pericial de repetições de vídeo para contestações de zero, registro de decisões com justificativa e histórico preservado.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-900 flex items-center justify-between">
            <span>Acessar julgamento</span>
            <span>&rarr;</span>
          </div>
        </Link>

        <Link
          href="/secretaria"
          className="bg-white border border-slate-200 hover:border-slate-300 p-5 rounded-xl shadow-xs transition hover:shadow-sm group flex flex-col justify-between"
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Atendimento
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1 group-hover:text-slate-800">
              Secretaria & Vendas
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Emissão de kits (duas senhas independentes com dois bois cada), venda de senhas solteiras e liberação controlada de Boi de Ouro.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-900 flex items-center justify-between">
            <span>Abrir secretaria</span>
            <span>&rarr;</span>
          </div>
        </Link>

        <Link
          href="/senhas"
          className="bg-white border border-slate-200 hover:border-slate-300 p-5 rounded-xl shadow-xs transition hover:shadow-sm group flex flex-col justify-between"
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Inscrições
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1 group-hover:text-slate-800">
              Gestão de Senhas
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Painel completo para o gestor: busca de competidores, troca de vaqueiros (puxador/esteira), categorias, reatribuição de bois e cancelamentos com auditoria.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-900 flex items-center justify-between">
            <span>Gerenciar senhas</span>
            <span>&rarr;</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
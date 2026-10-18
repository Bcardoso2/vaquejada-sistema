'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/* Tipos e utilitários                                                 */
/* ------------------------------------------------------------------ */

type Fonte = 'mapa' | 'juiz' | 'boiOuro' | 'financeiro';

interface Corrida {
  id: string;
  estado: string;
  ordem_mapa: number;
  senha_codigo: string;
  senha_categoria: string;
  puxador_nome: string;
  esteira_nome: string;
  boi_nome: string;
  tipo: string;
  boi_numero: number;
}

const ROTULO_FONTE: Record<Fonte, string> = {
  mapa: 'Mapa da pista',
  juiz: 'Mesa do juiz',
  boiOuro: 'Boi de Ouro',
  financeiro: 'Financeiro',
};

const INTERVALO_ATUALIZACAO_MS = 30_000;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

async function buscarJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Componentes                                                         */
/* ------------------------------------------------------------------ */

function Indicador({
  titulo,
  valor,
  detalhe,
  href,
  cor,
  falhou,
  carregando,
}: {
  titulo: string;
  valor: string | number;
  detalhe: string;
  href: string;
  cor: string;
  falhou: boolean;
  carregando: boolean;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-slate-200 hover:border-slate-400 p-5 shadow-xs transition hover:shadow-sm block"
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</div>
      {carregando ? (
        <div className="h-9 w-20 bg-slate-100 rounded mt-2 animate-pulse" />
      ) : (
        <div className={`text-3xl font-extrabold mt-2 ${falhou ? 'text-slate-300' : cor}`}>
          {falhou ? '—' : valor}
        </div>
      )}
      <div className="text-xs text-slate-500 mt-1">{falhou ? 'Dados indisponíveis' : detalhe}</div>
    </Link>
  );
}

const MODULOS = [
  {
    href: '/mapa',
    area: 'Operacional',
    titulo: 'Mapa Geral & Pista',
    descricao: 'Chamadas, abertura de porteira e registro de Valeu, Zero e Retorno.',
    acao: 'Abrir mapa',
  },
  {
    href: '/juiz',
    area: 'Arbitragem',
    titulo: 'Mesa do Juiz & Vídeo',
    descricao: 'Análise de vídeo das contestações de zero, com decisão justificada e histórico.',
    acao: 'Acessar julgamento',
  },
  {
    href: '/secretaria',
    area: 'Atendimento',
    titulo: 'Secretaria & Vendas',
    descricao: 'Venda de senhas, kits de duas senhas e liberação de Boi de Ouro.',
    acao: 'Abrir secretaria',
  },
  {
    href: '/senhas',
    area: 'Inscrições',
    titulo: 'Gestão de Senhas',
    descricao: 'Busca de competidores, troca de puxador/esteira, reatribuição de bois e cancelamentos.',
    acao: 'Gerenciar senhas',
  },
];

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function DashboardHome() {
  const [mapa, setMapa] = useState<any[]>([]);
  const [juiz, setJuiz] = useState<any[]>([]);
  const [boiOuro, setBoiOuro] = useState<any[]>([]);
  const [financeiro, setFinanceiro] = useState<any>(null);

  const [falhas, setFalhas] = useState<Partial<Record<Fonte, boolean>>>({});
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    // allSettled: se uma API cair, as outras continuam aparecendo
    const [rMapa, rJuiz, rBdo, rFin] = await Promise.allSettled([
      buscarJson('/api/mapa'),
      buscarJson('/api/juiz'),
      buscarJson('/api/secretaria/boi-ouro'),
      buscarJson('/api/financeiro'),
    ]);

    const novasFalhas: Partial<Record<Fonte, boolean>> = {};

    if (rMapa.status === 'fulfilled' && Array.isArray(rMapa.value)) setMapa(rMapa.value);
    else novasFalhas.mapa = true;

    if (rJuiz.status === 'fulfilled' && Array.isArray(rJuiz.value)) setJuiz(rJuiz.value);
    else novasFalhas.juiz = true;

    if (rBdo.status === 'fulfilled' && Array.isArray(rBdo.value)) setBoiOuro(rBdo.value);
    else novasFalhas.boiOuro = true;

    if (rFin.status === 'fulfilled' && rFin.value && !rFin.value.error) setFinanceiro(rFin.value);
    else novasFalhas.financeiro = true;

    setFalhas(novasFalhas);
    setAtualizadoEm(new Date());
    setCarregando(false);
    setAtualizando(false);
  }, []);

  useEffect(() => {
    carregar();
    // Painel operacional: atualiza sozinho, mas não gasta requisição com a aba escondida
    const id = setInterval(() => {
      if (!document.hidden) carregar();
    }, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(id);
  }, [carregar]);

  const dados = useMemo(() => {
    const ativa =
      mapa.find((c: Corrida) => c.estado === 'EM_EXECUCAO') ?? mapa.find((c: Corrida) => c.estado === 'CHAMADA') ?? null;
    const fila = mapa
      .filter((c: Corrida) => c.estado === 'NO_MAPA')
      .sort((a: Corrida, b: Corrida) => a.ordem_mapa - b.ordem_mapa);
    const concluidas = mapa.filter((c: Corrida) => c.estado === 'CONCLUIDA').length;

    return {
      ativa: ativa as Corrida | null,
      proxima: (fila[0] ?? null) as Corrida | null,
      naFila: fila.length,
      concluidas,
      total: mapa.length,
      contestacoes: juiz.filter((j) => j.estado !== 'DECIDIDA_PELO_JUIZ').length,
      // Mesmo critério da tela da secretaria: pago e ainda não liberado no mapa
      boisOuroPendentes: boiOuro.filter((b) => b.pago && b.estado !== 'NO_MAPA').length,
      boisOuroSemPagamento: boiOuro.filter((b) => !b.pago).length,
      receita: (financeiro?.resumo?.totalRecebidoCentavos ?? 0) / 100,
      senhas: financeiro?.resumo?.qtdSenhas ?? 0,
    };
  }, [mapa, juiz, boiOuro, financeiro]);

  const fontesComFalha = (Object.keys(falhas) as Fonte[]).filter((f) => falhas[f]);
  const pendencias = dados.contestacoes + dados.boisOuroPendentes;
  const progresso = dados.total > 0 ? Math.round((dados.concluidas / dados.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Painel de Operações</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pista, secretaria, julgamento e financeiro do evento em um só lugar
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 mr-1">
            {atualizadoEm
              ? `Atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Carregando...'}
          </span>
          <button
            type="button"
            onClick={carregar}
            disabled={atualizando}
            className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
          >
            {atualizando ? 'Atualizando...' : 'Atualizar'}
          </button>
          <Link
            href="/secretaria"
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition"
          >
            Emitir senha
          </Link>
          <Link
            href="/mapa"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition shadow-xs"
          >
            Acessar pista
          </Link>
        </div>
      </div>

      {/* Aviso de falha parcial */}
      {fontesComFalha.length > 0 && (
        <div role="alert" className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>Alguns dados não carregaram:</strong> {fontesComFalha.map((f) => ROTULO_FONTE[f]).join(', ')}. Os
            números marcados com — não são zero, estão indisponíveis.
          </span>
          <button
            type="button"
            onClick={carregar}
            className="font-bold underline cursor-pointer"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Agora na pista */}
      <div
        className={`rounded-xl border-2 p-5 shadow-xs ${
          dados.ativa ? 'bg-white border-slate-900' : 'bg-white border-dashed border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${dados.ativa ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Agora na pista</span>
          </div>
          <Link href="/mapa" className="text-xs font-bold text-slate-900 hover:underline">
            Abrir mapa &rarr;
          </Link>
        </div>

        {carregando ? (
          <div className="h-16 bg-slate-100 rounded mt-3 animate-pulse" />
        ) : falhas.mapa ? (
          <p className="text-sm text-slate-400 mt-3">Não foi possível carregar o mapa da pista.</p>
        ) : dados.ativa ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-7">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-3xl font-black font-mono text-slate-900">Senha {dados.ativa.senha_codigo}</span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    dados.ativa.estado === 'EM_EXECUCAO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {dados.ativa.estado === 'EM_EXECUCAO' ? 'Em corrida' : 'Competidor chamado'}
                </span>
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {dados.ativa.puxador_nome || '-'} <span className="text-slate-400">e</span> {dados.ativa.esteira_nome || '-'} ·{' '}
                {dados.ativa.senha_categoria}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {dados.ativa.tipo} ({dados.ativa.boi_numero}º boi) · {dados.ativa.boi_nome}
              </div>
            </div>
            <div className="md:col-span-5 md:text-right text-sm text-slate-600">
              {dados.proxima ? (
                <>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Próxima da fila</div>
                  <div className="font-mono font-bold text-slate-900">
                    #{dados.proxima.ordem_mapa} · Senha {dados.proxima.senha_codigo}
                  </div>
                  <div className="text-xs text-slate-500">{dados.proxima.puxador_nome || '-'}</div>
                </>
              ) : (
                <div className="text-xs text-slate-400">Fila vazia</div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-3">
            Nenhum competidor na pista agora.
            {dados.proxima && (
              <>
                {' '}
                Próxima da fila: <strong className="font-mono text-slate-900">Senha {dados.proxima.senha_codigo}</strong> (
                {dados.proxima.puxador_nome || '-'}).
              </>
            )}
          </p>
        )}

        {!carregando && !falhas.mapa && dados.total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>
                {dados.concluidas} de {dados.total} corridas concluídas · {dados.naFila} na fila
              </span>
              <span className="font-bold text-slate-700">{progresso}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full transition-all" style={{ width: `${progresso}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Precisa de atenção */}
      {!carregando && pendencias > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2">Precisa de atenção</div>
          <div className="flex flex-wrap gap-2">
            {dados.contestacoes > 0 && (
              <Link
                href="/juiz"
                className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 rounded-lg text-sm text-amber-900 font-semibold transition"
              >
                {dados.contestacoes} {dados.contestacoes === 1 ? 'contestação aguardando' : 'contestações aguardando'} o juiz
                &rarr;
              </Link>
            )}
            {dados.boisOuroPendentes > 0 && (
              <Link
                href="/secretaria"
                className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 rounded-lg text-sm text-amber-900 font-semibold transition"
              >
                {dados.boisOuroPendentes} Boi de Ouro pago aguardando autorização &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Indicador
          titulo="Pista em execução"
          valor={mapa.filter((c: Corrida) => c.estado === 'CHAMADA' || c.estado === 'EM_EXECUCAO').length}
          detalhe={`${dados.naFila} na fila · ${dados.total} corridas no mapa`}
          href="/mapa"
          cor="text-slate-900"
          falhou={!!falhas.mapa}
          carregando={carregando}
        />
        <Indicador
          titulo="Contestações de vídeo"
          valor={dados.contestacoes}
          detalhe="Revisões de zero aguardando o juiz"
          href="/juiz"
          cor={dados.contestacoes > 0 ? 'text-amber-700' : 'text-slate-900'}
          falhou={!!falhas.juiz}
          carregando={carregando}
        />
        <Indicador
          titulo="Boi de Ouro pendente"
          valor={dados.boisOuroPendentes}
          detalhe={`Pagos aguardando autorização · ${dados.boisOuroSemPagamento} sem pagamento`}
          href="/secretaria"
          cor={dados.boisOuroPendentes > 0 ? 'text-indigo-700' : 'text-slate-900'}
          falhou={!!falhas.boiOuro}
          carregando={carregando}
        />
        <Indicador
          titulo="Receita liquidada"
          valor={brl.format(dados.receita)}
          detalhe={`${dados.senhas} senhas emitidas e confirmadas`}
          href="/financeiro"
          cor="text-emerald-700"
          falhou={!!falhas.financeiro}
          carregando={carregando}
        />
      </div>

      {/* Módulos */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Módulos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULOS.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="bg-white border border-slate-200 hover:border-slate-400 p-5 rounded-xl shadow-xs transition hover:shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{m.area}</div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{m.titulo}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{m.descricao}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-900 flex items-center justify-between">
                <span>{m.acao}</span>
                <span>&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
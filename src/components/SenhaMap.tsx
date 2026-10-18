'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

interface Senha {
  id: string;
  codigo: string;
  estado_comercial: string;
  vaquejada_id?: string;
}

interface SenhaMapProps {
  onSenhaSelect: (codigo: string) => void;
  selectedSenha: string | null;
  /** Se informado, mostra só senhas dessa vaquejada. Se omitido, mostra todas. */
  vaquejadaId?: string;
  /** Faixas das abas. Senhas fora delas aparecem na aba "Outras". */
  faixaBaixa?: [number, number];
  faixaAlta?: [number, number];
}

type Status = 'available' | 'blocked' | 'sold' | 'selected' | 'disabled';
type Aba = 'baixas' | 'altas' | 'outras';
type Filtro = 'all' | 'available' | 'sold';

const ESTADOS_VENDIDOS = ['PAGA', 'VENDIDA', 'CANCELADA', 'RESERVADA'];

// Constantes de módulo: um default criado dentro dos parâmetros seria um array novo a cada render
// e invalidaria todos os useMemo/useCallback abaixo.
const FAIXA_BAIXA_PADRAO: [number, number] = [1, 200];
const FAIXA_ALTA_PADRAO: [number, number] = [800, 999];

const pad3 = (n: number) => String(n).padStart(3, '0');

/** Extrai o número de códigos como "001", "sn-001" ou "SN001". Retorna null se não houver dígitos. */
function numeroDoCodigo(codigo: string): number | null {
  const m = String(codigo).match(/(\d+)\s*$/) ?? String(codigo).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Verifica se um número está dentro de uma faixa */
function estaNaFaixa(numero: number, [min, max]: [number, number]): boolean {
  return numero >= min && numero <= max;
}

/**
 * Número da senha parceira no kit (baixa <-> alta), calculado a partir das faixas.
 * Com os padrões, baixa N (001-200) <-> alta 799 + N (800-999). Retorna null se a senha
 * não pertence a nenhuma faixa ou se a parceira cairia fora da faixa oposta.
 */
function numeroDoPar(n: number, baixa: [number, number], alta: [number, number]): number | null {
  if (estaNaFaixa(n, baixa)) {
    const par = alta[0] + (n - baixa[0]);
    return estaNaFaixa(par, alta) ? par : null;
  }
  if (estaNaFaixa(n, alta)) {
    const par = baixa[0] + (n - alta[0]);
    return estaNaFaixa(par, baixa) ? par : null;
  }
  return null;
}

/** Extrai lista de senhas de diversos formatos de resposta */
function extrairLista(payload: unknown): Senha[] {
  if (Array.isArray(payload)) return payload as Senha[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const chave of ['senhas', 'data', 'items', 'results']) {
      if (Array.isArray(obj[chave])) return obj[chave] as Senha[];
    }
  }
  throw new Error('Formato de resposta inesperado da API de senhas');
}

const chaveDe = (s: Senha, n: number) => `${s.vaquejada_id ?? ''}|${n}`;

const CLASSES_STATUS: Record<Status, string> = {
  available:
    'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer',
  // Livre, mas sem como vender: parceira do kit indisponível ou senha fora de qualquer kit.
  blocked: 'bg-amber-50 text-amber-700 border-amber-300 border-dashed cursor-not-allowed',
  sold: 'bg-rose-50 text-rose-300 border-rose-200 cursor-not-allowed line-through',
  selected: 'bg-slate-900 text-white border-slate-900 ring-2 ring-offset-1 ring-slate-900 cursor-pointer',
  disabled: 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed',
};

const ROTULO_STATUS: Record<Status, string> = {
  available: 'Disponível',
  blocked: 'Livre, mas sem kit disponível',
  sold: 'Vendida',
  selected: 'Selecionada',
  disabled: 'Indisponível',
};

export function SenhaMap({
  onSenhaSelect,
  selectedSenha,
  vaquejadaId,
  faixaBaixa = FAIXA_BAIXA_PADRAO,
  faixaAlta = FAIXA_ALTA_PADRAO,
}: SenhaMapProps) {
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filtro>('available');
  const [search, setSearch] = useState('');
  const [aba, setAba] = useState<Aba>('baixas');
  const requisicao = useRef(0);

  // Mesmo que o pai passe [1, 200] inline (array novo a cada render), as faixas só mudam
  // de identidade quando os números mudam.
  const [bMin, bMax] = faixaBaixa;
  const [aMin, aMax] = faixaAlta;
  const baixa = useMemo<[number, number]>(() => [bMin, bMax], [bMin, bMax]);
  const alta = useMemo<[number, number]>(() => [aMin, aMax], [aMin, aMax]);

  const carregar = useCallback(async () => {
    // Descarta respostas antigas se a vaquejada mudar (ou o usuário clicar em recarregar) durante a requisição
    const id = ++requisicao.current;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/senhas?limit=2000');
      if (!res.ok) throw new Error(`A API respondeu com erro ${res.status}`);
      const lista = extrairLista(await res.json());
      if (id !== requisicao.current) return;
      setSenhas(vaquejadaId ? lista.filter((s) => s.vaquejada_id === vaquejadaId) : lista);
    } catch (err) {
      if (id !== requisicao.current) return;
      console.error('Erro ao carregar senhas:', err);
      setError(err instanceof Error ? err.message : 'Falha ao carregar senhas');
    } finally {
      if (id === requisicao.current) setLoading(false);
    }
  }, [vaquejadaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const faixaDe = useCallback(
    (s: Senha): Aba => {
      const n = numeroDoCodigo(s.codigo);
      if (n === null) return 'outras';
      if (estaNaFaixa(n, baixa)) return 'baixas';
      if (estaNaFaixa(n, alta)) return 'altas';
      return 'outras';
    },
    [baixa, alta],
  );

  // Índice (vaquejada + número) -> senha. Busca da parceira em O(1) em vez de varrer a lista
  // inteira para cada botão, e sem misturar senhas de vaquejadas diferentes com o mesmo número.
  const indice = useMemo(() => {
    const m = new Map<string, Senha>();
    for (const s of senhas) {
      const n = numeroDoCodigo(s.codigo);
      if (n !== null) m.set(chaveDe(s, n), s);
    }
    return m;
  }, [senhas]);

  // Número da senha baixa do kit selecionado. O pai recebe sempre o número da baixa ("005"),
  // então tanto a baixa quanto a alta desse kit devem aparecer marcadas.
  const kitSelecionadoN = useMemo(() => {
    const n = selectedSenha ? numeroDoCodigo(selectedSenha) : null;
    if (n === null) return null;
    if (estaNaFaixa(n, baixa)) return n;
    return numeroDoPar(n, baixa, alta);
  }, [selectedSenha, baixa, alta]);

  const infoDe = useCallback(
    (s: Senha) => {
      const n = numeroDoCodigo(s.codigo);
      const par = n !== null ? numeroDoPar(n, baixa, alta) : null;
      const parceira = n !== null && par !== null ? indice.get(chaveDe(s, par)) : undefined;
      const livre = s.estado_comercial === 'DISPONIVEL';
      const parceiraLivre = parceira?.estado_comercial === 'DISPONIVEL';
      const clicavel = livre && par !== null && parceiraLivre;
      const kitBaixa = n !== null && par !== null ? (estaNaFaixa(n, baixa) ? n : par) : null;

      let status: Status;
      if (clicavel && kitBaixa !== null && kitBaixa === kitSelecionadoN) status = 'selected';
      else if (livre) status = clicavel ? 'available' : 'blocked';
      else if (ESTADOS_VENDIDOS.includes(s.estado_comercial)) status = 'sold';
      else status = 'disabled';

      let motivo = '';
      if (status === 'blocked') {
        if (par === null) motivo = 'fora de um kit';
        else if (!parceira) motivo = `parceira ${pad3(par)} não cadastrada`;
        else motivo = `parceira ${pad3(par)} indisponível`;
      }

      return { n, kitBaixa, status, clicavel, motivo };
    },
    [baixa, alta, indice, kitSelecionadoN],
  );

  // Contagem por aba, para os números nas abas e para esconder "Outras" quando vazia
  const contagemAba = useMemo(() => {
    const c: Record<Aba, { total: number; livres: number }> = {
      baixas: { total: 0, livres: 0 },
      altas: { total: 0, livres: 0 },
      outras: { total: 0, livres: 0 },
    };
    senhas.forEach((s) => {
      const f = faixaDe(s);
      c[f].total++;
      if (s.estado_comercial === 'DISPONIVEL') c[f].livres++;
    });
    return c;
  }, [senhas, faixaDe]);

  // Se a aba "Outras" some (ex.: depois de recarregar), volta para "Baixas" em vez de
  // ficar numa aba que não existe mais, com grade vazia e nenhuma aba marcada.
  const abaAtiva: Aba = aba === 'outras' && contagemAba.outras.total === 0 ? 'baixas' : aba;

  const visiveis = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return senhas
      .filter((s) => {
        if (faixaDe(s) !== abaAtiva) return false;
        if (termo && !s.codigo.toLowerCase().includes(termo)) return false;
        if (filter === 'available' && s.estado_comercial !== 'DISPONIVEL') return false;
        if (filter === 'sold' && s.estado_comercial === 'DISPONIVEL') return false;
        return true;
      })
      .sort((a, b) => (numeroDoCodigo(a.codigo) ?? 0) - (numeroDoCodigo(b.codigo) ?? 0));
  }, [senhas, abaAtiva, search, filter, faixaDe]);

  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'baixas', rotulo: `Baixas ${pad3(baixa[0])}–${pad3(baixa[1])}` },
    { id: 'altas', rotulo: `Altas ${pad3(alta[0])}–${pad3(alta[1])}` },
    ...(contagemAba.outras.total > 0 ? [{ id: 'outras' as Aba, rotulo: 'Outras' }] : []),
  ];

  const totalLivres = senhas.filter((s) => s.estado_comercial === 'DISPONIVEL').length;

  /* ------------------------------ estados ------------------------------ */

  if (loading) {
    return (
      <div className="min-h-[240px] flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-900" />
        <p className="text-sm">Carregando senhas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[240px] flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-semibold text-rose-700">Não foi possível carregar as senhas</p>
        <p className="text-xs text-slate-500 max-w-sm">{error}</p>
        <button
          type="button"
          onClick={carregar}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (senhas.length === 0) {
    return (
      <div className="min-h-[240px] flex flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-semibold text-slate-800">Nenhuma senha cadastrada</p>
        <p className="text-xs text-slate-500 max-w-sm">
          A API respondeu, mas sem senhas
          {vaquejadaId ? ` para a vaquejada "${vaquejadaId}"` : ''}. Cadastre as senhas no estoque antes de vender.
        </p>
        <button
          type="button"
          onClick={carregar}
          className="mt-1 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-sm font-bold text-slate-700 rounded-lg cursor-pointer"
        >
          Recarregar
        </button>
      </div>
    );
  }

  /* ------------------------------- mapa -------------------------------- */

  return (
    <div className="space-y-4">
      {/* Abas */}
      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={abaAtiva === a.id}
            onClick={() => setAba(a.id)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px cursor-pointer transition ${
              abaAtiva === a.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {a.rotulo}
            <span className="ml-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
              {contagemAba[a.id].livres} livres
            </span>
          </button>
        ))}
      </div>

      {/* Busca + filtro + resumo, tudo numa linha */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="search"
          aria-label="Buscar senha"
          placeholder="Buscar número da senha..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 sm:max-w-xs text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
        />
        <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-xs font-bold" role="group" aria-label="Filtrar senhas">
          {(
            [
              ['available', 'Disponíveis'],
              ['all', 'Todas'],
              ['sold', 'Vendidas'],
            ] as [Filtro, string][]
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={`px-3 py-2 cursor-pointer transition ${
                filter === id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto text-xs text-slate-500">
          <strong className="text-emerald-700">{totalLivres}</strong> livres de{' '}
          <strong className="text-slate-800">{senhas.length}</strong>
        </div>
      </div>

      {/* Grade */}
      {visiveis.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg">
          Nenhuma senha encontrada com esses filtros.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
          {visiveis.map((senha) => {
            const { n, kitBaixa, status, clicavel, motivo } = infoDe(senha);
            const rotulo = n !== null ? pad3(n) : senha.codigo;
            const selecionada = status === 'selected';

            // Vendida/indisponível: mostra o estado real (PAGA, RESERVADA...) em vez de só "Vendida"
            const detalhe =
              status === 'blocked'
                ? `${ROTULO_STATUS.blocked} (${motivo})`
                : status === 'sold' || status === 'disabled'
                  ? `${ROTULO_STATUS[status]} (${senha.estado_comercial})`
                  : ROTULO_STATUS[status];

            return (
              <button
                key={senha.id}
                type="button"
                onClick={() => {
                  // Só seleciona se o kit existe e as duas senhas (baixa e alta) estão disponíveis.
                  // Sempre devolve o número da senha baixa como identificador do kit.
                  if (clicavel && kitBaixa !== null) onSenhaSelect(pad3(kitBaixa));
                }}
                // aria-disabled (e não disabled) mantém o tooltip com o motivo funcionando em todos os navegadores
                aria-disabled={!clicavel}
                aria-pressed={selecionada}
                aria-label={`Senha ${senha.codigo}, ${detalhe}${selecionada ? ' (kit selecionado)' : ''}`}
                title={`${senha.codigo} · ${detalhe}${selecionada ? ' · Kit selecionado' : ''}`}
                className={`h-10 flex items-center justify-center rounded-md border text-sm font-mono font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${CLASSES_STATUS[status]}`}
              >
                {rotulo}
              </button>
            );
          })}
        </div>
      )}

      {/* Legenda única e compacta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 pt-3 border-t border-slate-100">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" /> Disponível
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-50 border border-dashed border-amber-300" /> Livre, sem kit disponível
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-rose-100 border border-rose-200" /> Vendida
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-900" /> Selecionada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" /> Indisponível
        </span>
      </div>
    </div>
  );
}
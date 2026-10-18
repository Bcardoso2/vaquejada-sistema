'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { SenhaMap } from '@/components/SenhaMap';
import { validarCpf } from '@/lib/cpf';


/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

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

type Aba = 'VENDAS' | 'BOI_OURO';
type FormaPagamento = 'PIX' | 'DINHEIRO' | 'VALE';
type CanalVenda = 'PRESENCIAL' | 'ANTECIPADA';
type FiltroBoi = 'TODOS' | 'PENDENTE_PAGAMENTO' | 'AGUARDANDO_AUTORIZACAO' | 'NO_MAPA';

interface Toast {
  tipo: 'sucesso' | 'erro';
  texto: string;
}

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

const VALOR_BOI_OURO_PADRAO_CENTAVOS = 20000;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatarCentavos = (c: number) => brl.format(c / 100);

const inputBase =
  'w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent ' +
  'disabled:bg-slate-100 disabled:text-slate-400';

function situacaoBoi(bo: BoiOuro): { chave: FiltroBoi; rotulo: string; classe: string } {
  if (bo.estado === 'NO_MAPA') {
    return { chave: 'NO_MAPA', rotulo: 'Liberado no mapa', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (!bo.pago) {
    return { chave: 'PENDENTE_PAGAMENTO', rotulo: 'Pagamento pendente', classe: 'bg-amber-50 text-amber-800 border-amber-200' };
  }
  return { chave: 'AGUARDANDO_AUTORIZACAO', rotulo: 'Aguardando autorização', classe: 'bg-blue-50 text-blue-700 border-blue-200' };
}

/* ------------------------------------------------------------------ */
/* Componentes auxiliares (fora do componente principal para não       */
/* serem recriados a cada render e perder o foco dos inputs)           */
/* ------------------------------------------------------------------ */

function Campo({
  id,
  label,
  obrigatorio,
  dica,
  children,
}: {
  id: string;
  label: string;
  obrigatorio?: boolean;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
        {label}
        {obrigatorio && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {dica && <p className="mt-1.5 text-xs text-slate-500">{dica}</p>}
    </div>
  );
}

function CartaoResumo({
  titulo,
  valor,
  classe,
}: {
  titulo: string;
  valor: number;
  classe: string;
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${classe}`}>
      <div className="text-xs font-bold uppercase tracking-wider opacity-80">{titulo}</div>
      <div className="text-2xl font-bold mt-1">{valor}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function SecretariaPage() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('VENDAS');
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estados de carregamento separados (antes um único "loading" misturava tudo)
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [enviandoVenda, setEnviandoVenda] = useState(false);
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null); // id do boi

  const [boisOuro, setBoisOuro] = useState<BoiOuro[]>([]);

  // Venda de senhas (agora trabalha com kits e cadastros oficiais)
  const [senhaCodigo, setSenhaCodigo] = useState(''); // Código da senha baixa do kit selecionado
  const [cavaloNome, setCavaloNome] = useState('');
  const [cavaloId, setCavaloId] = useState<string | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('PIX');
  const [canalVenda, setCanalVenda] = useState<CanalVenda>('PRESENCIAL');
  const [puxadorNome, setPuxadorNome] = useState('');
  const [puxadorId, setPuxadorId] = useState<string | null>(null);
  const [esteiraNome, setEsteiraNome] = useState('');
  const [esteiraId, setEsteiraId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState('PROFISSIONAL');
  const [valorVenda, setValorVenda] = useState('600');
  const [retornoVenda, setRetornoVenda] = useState<any>(null);
  const [mapaAberto, setMapaAberto] = useState(false);

  // Cadastros oficiais carregados do banco
  const [competidoresCadastrados, setCompetidoresCadastrados] = useState<{ id: string; nome: string; apelido_pista?: string }[]>([]);
  const [cavalosCadastrados, setCavalosCadastrados] = useState<{ id: string; nome: string; tipo: string }[]>([]);

  // Modais de Cadastro Rápido (sem sair da venda)
  const [modalRapidoCompetidor, setModalRapidoCompetidor] = useState<'PUXADOR' | 'ESTEIRA' | null>(null);
  const [formRapidoComp, setFormRapidoComp] = useState({ nome: '', apelido_pista: '', cpf: '', categoria: 'ABERTA' });
  const [modalRapidoCavalo, setModalRapidoCavalo] = useState(false);
  const [formRapidoCav, setFormRapidoCav] = useState({ nome: '', tipo: 'PUXA' });


  // Boi de Ouro
  const [senhaOrigemId, setSenhaOrigemId] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroBoi>('TODOS');

  // Modal de pagamento (substitui o prompt() nativo)
  const [pagamentoModal, setPagamentoModal] = useState<BoiOuro | null>(null);
  const [referenciaPagamento, setReferenciaPagamento] = useState('PIX-CAIXA');

  // Confirmação de autorização (substitui ação direta sem confirmação)
  const [autorizacaoModal, setAutorizacaoModal] = useState<BoiOuro | null>(null);

  /* ----------------------------- feedback ----------------------------- */

  const mostrarToast = useCallback((tipo: Toast['tipo'], texto: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ tipo, texto });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  /* ------------------------------ dados ------------------------------- */

  const carregarBoisOuro = useCallback(async () => {
    try {
      setCarregandoLista(true);
      const res = await fetch('/api/secretaria/boi-ouro');
      const data = await res.json();
      if (Array.isArray(data)) {
        setBoisOuro(data);
      } else {
        mostrarToast('erro', data?.error || 'Resposta inesperada ao carregar bois de ouro');
      }
    } catch (err) {
      console.error('Erro ao carregar bois de ouro:', err);
      mostrarToast('erro', 'Não foi possível carregar os bois de ouro');
    } finally {
      setCarregandoLista(false);
    }
  }, [mostrarToast]);

  useEffect(() => {
    carregarBoisOuro();
  }, [carregarBoisOuro]);

  // Chamada genérica para a API de Boi de Ouro
  const chamarBoiOuro = async (corpo: Record<string, unknown>, mensagemErro: string) => {
    try {
      const res = await fetch('/api/secretaria/boi-ouro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast('erro', data.error || mensagemErro);
        return false;
      }
      await carregarBoisOuro();
      return true;
    } catch {
      mostrarToast('erro', mensagemErro);
      return false;
    }
  };

  const carregarCadastros = useCallback(async () => {
    try {
      const [resComp, resCav] = await Promise.all([
        fetch('/api/competidores?ativo=true'),
        fetch('/api/cavalos?ativo=true'),
      ]);
      if (resComp.ok) {
        const d = await resComp.json();
        if (Array.isArray(d)) setCompetidoresCadastrados(d);
      }
      if (resCav.ok) {
        const d = await resCav.json();
        if (Array.isArray(d)) setCavalosCadastrados(d);
      }
    } catch {}
  }, []);

  useEffect(() => {
    carregarCadastros();
  }, [carregarCadastros]);

  const handleSalvarRapidoCompetidor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarCpf(formRapidoComp.cpf)) {
      mostrarToast('erro', 'CPF inválido! Preencha um CPF válido com 11 dígitos.');
      return;
    }
    try {
      const res = await fetch('/api/competidores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formRapidoComp),
      });
      const data = await res.json();
      if (res.ok) {
        mostrarToast('sucesso', `Competidor "${data.competidor.nome}" cadastrado com sucesso.`);
        if (modalRapidoCompetidor === 'PUXADOR') {
          setPuxadorNome(data.competidor.nome);
          setPuxadorId(data.competidor.id);
        } else if (modalRapidoCompetidor === 'ESTEIRA') {
          setEsteiraNome(data.competidor.nome);
          setEsteiraId(data.competidor.id);
        }
        setModalRapidoCompetidor(null);
        setFormRapidoComp({ nome: '', apelido_pista: '', cpf: '', categoria: 'ABERTA' });
        await carregarCadastros();
      } else {
        mostrarToast('erro', data.error || 'Erro ao cadastrar competidor.');
      }
    } catch {
      mostrarToast('erro', 'Erro de conexão ao cadastrar competidor.');
    }
  };

  const handleSalvarRapidoCavalo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cavalos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formRapidoCav),
      });
      const data = await res.json();
      if (res.ok) {
        mostrarToast('sucesso', `Animal "${data.cavalo.nome}" cadastrado com sucesso.`);
        setCavaloNome(data.cavalo.nome);
        setCavaloId(data.cavalo.id);
        setModalRapidoCavalo(false);
        setFormRapidoCav({ nome: '', tipo: 'PUXA' });
        await carregarCadastros();
      } else {
        mostrarToast('erro', data.error || 'Erro ao cadastrar cavalo.');
      }
    } catch {
      mostrarToast('erro', 'Erro de conexão ao cadastrar cavalo.');
    }
  };

  /* ------------------------------ vendas ------------------------------ */

  const valorVendaNumero = Number(valorVenda.replace(',', '.'));
  const valorVendaValido = Number.isFinite(valorVendaNumero) && valorVendaNumero > 0;

  // Calcula o código da senha alta correspondente ao kit
  const codigoAltaDaSenhaSelecionada = senhaCodigo
    ? String(799 + Number(senhaCodigo)).padStart(3, '0')
    : '';

  const limparFormularioVenda = () => {
    setSenhaCodigo('');
    setPuxadorNome('');
    setPuxadorId(null);
    setEsteiraNome('');
    setEsteiraId(null);
    setCavaloNome('');
    setCavaloId(null);
  };

  const handleEmitirVenda = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!senhaCodigo) {
      mostrarToast('erro', 'Selecione uma senha no mapa.');
      return;
    }
    if (!puxadorNome.trim() || !esteiraNome.trim() || !cavaloNome.trim()) {
      mostrarToast('erro', 'Informe puxador, esteira e cavalo.');
      return;
    }
    if (!valorVendaValido) {
      mostrarToast('erro', 'Informe um valor de venda válido.');
      return;
    }

    try {
      setEnviandoVenda(true);
      const res = await fetch('/api/secretaria/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senhaCodigo,
          cavaloNome: cavaloNome.trim(),
          cavaloPuxaId: cavaloId,
          formaPagamento,
          canalVenda,
          puxadorNome: puxadorNome.trim(),
          puxadorId,
          esteiraNome: esteiraNome.trim(),
          esteiraId,
          categoria,
          valorCentavos: Math.round(valorVendaNumero * 100),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRetornoVenda(data);
        limparFormularioVenda();
        mostrarToast('sucesso', 'Venda emitida com sucesso.');
      } else {
        mostrarToast('erro', data.error || 'Erro ao realizar venda');
      }
    } catch {
      mostrarToast('erro', 'Erro de conexão ao realizar venda');
    } finally {

      setEnviandoVenda(false);
    }
  };

  /* ----------------------------- boi de ouro -------------------------- */

  const handleSolicitarBoiOuro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaOrigemId.trim()) {
      mostrarToast('erro', 'Informe o ID ou código da senha de origem.');
      return;
    }
    setEnviandoSolicitacao(true);
    const ok = await chamarBoiOuro(
      { acao: 'SOLICITAR', senhaOrigemId: senhaOrigemId.trim() },
      'Erro ao solicitar boi de ouro',
    );
    setEnviandoSolicitacao(false);
    if (ok) {
      setSenhaOrigemId('');
      mostrarToast('sucesso', 'Solicitação registrada.');
    }
  };

  const abrirModalPagamento = (bo: BoiOuro) => {
    setReferenciaPagamento('PIX-CAIXA');
    setPagamentoModal(bo);
  };

  const confirmarPagamento = async () => {
    if (!pagamentoModal) return;
    const ref = referenciaPagamento.trim();
    if (!ref) {
      mostrarToast('erro', 'Informe a referência ou comprovante do pagamento.');
      return;
    }
    const alvo = pagamentoModal;
    setAcaoEmAndamento(alvo.id);
    const ok = await chamarBoiOuro(
      { acao: 'PAGAR', boiOuroId: alvo.id, referenciaPagamento: ref },
      'Erro ao confirmar pagamento',
    );
    setAcaoEmAndamento(null);
    if (ok) {
      setPagamentoModal(null);
      mostrarToast('sucesso', 'Pagamento confirmado.');
    }
  };

  const confirmarAutorizacao = async () => {
    if (!autorizacaoModal) return;
    const alvo = autorizacaoModal;
    setAcaoEmAndamento(alvo.id);
    // ATENÇÃO: papel/nome do usuário devem ser definidos pelo servidor a partir
    // da sessão. Enviados aqui apenas para manter compatibilidade com a API atual.
    const ok = await chamarBoiOuro(
      {
        acao: 'AUTORIZAR_SECRETARIA',
        boiOuroId: alvo.id,
        usuarioPapel: 'SECRETARIO',
        usuarioNome: 'Secretaria Oficial',
      },
      'Erro ao autorizar boi de ouro',
    );
    setAcaoEmAndamento(null);
    if (ok) {
      setAutorizacaoModal(null);
      mostrarToast('sucesso', 'Boi de ouro liberado no mapa.');
    }
  };

  /* --------------------------- listas derivadas ----------------------- */

  const resumo = useMemo(() => {
    const r = { pendentes: 0, aguardando: 0, noMapa: 0 };
    boisOuro.forEach((bo) => {
      const s = situacaoBoi(bo);
      if (s.chave === 'PENDENTE_PAGAMENTO') r.pendentes++;
      else if (s.chave === 'AGUARDANDO_AUTORIZACAO') r.aguardando++;
      else r.noMapa++;
    });
    return r;
  }, [boisOuro]);

  const boisFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return boisOuro.filter((bo) => {
      if (filtro !== 'TODOS' && situacaoBoi(bo).chave !== filtro) return false;
      if (!termo) return true;
      return [bo.senha_codigo, bo.senha_origem_id, bo.puxador_nome, bo.esteira_nome, bo.boi_nome, bo.boi_numero_registro]
        .filter(Boolean)
        .some((campo) => campo.toLowerCase().includes(termo));
    });
  }, [boisOuro, busca, filtro]);

  /* ------------------------------ render ------------------------------ */

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm font-medium shadow-lg flex items-start gap-3 ${
            toast.tipo === 'sucesso'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span className="flex-1">{toast.texto}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Fechar aviso"
            className="text-lg leading-none opacity-60 hover:opacity-100 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 tracking-tight"><img src="/logo.png" alt="Vaquejada Pro logo" className="h-8 w-8" />Secretaria & Emissão de Senhas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gestão de senhas individuais, pagamentos e liberação de Boi de Ouro
        </p>
      </div>

      {/* Abas */}
      <div
        role="tablist"
        aria-label="Seções da secretaria"
        className="flex border-b border-slate-200 gap-2 bg-white px-4 pt-2 rounded-t-xl border-t border-x"
      >
        {(
          [
            { id: 'VENDAS', rotulo: 'Venda de Senhas Individuais', badge: 0 },
            { id: 'BOI_OURO', rotulo: 'Boi de Ouro (Esteira de Autorização)', badge: resumo.pendentes + resumo.aguardando },
          ] as const
        ).map((aba) => (
          <button
            key={aba.id}
            type="button"
            role="tab"
            aria-selected={abaAtiva === aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            className={`py-3 px-5 font-bold text-sm border-b-2 transition cursor-pointer flex items-center gap-2 ${
              abaAtiva === aba.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {aba.rotulo}
            {aba.badge > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {aba.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============================ ABA VENDAS ============================ */}
      {abaAtiva === 'VENDAS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Formulário de Inscrição e Emissão
            </h2>

            <form onSubmit={handleEmitirVenda} className="space-y-5">
              {/* 1. Senha: o mapa abre em painel próprio, o formulário fica limpo */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">1. Senha</h3>
                <div
                  className={`flex items-center justify-between gap-3 rounded-xl border-2 p-4 ${
                    senhaCodigo ? 'border-slate-900 bg-slate-50' : 'border-dashed border-slate-300'
                  }`}
                >
                  <div>
                    {senhaCodigo ? (
                      <>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Kit selecionado
                        </div>
                        <div className="text-3xl font-mono font-black text-slate-900 leading-tight">
                          {senhaCodigo} - {codigoAltaDaSenhaSelecionada}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-slate-800">Nenhum kit selecionado</div>
                        <div className="text-xs text-slate-500">Abra o mapa e escolha um kit disponível.</div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMapaAberto(true)}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg cursor-pointer shadow-sm whitespace-nowrap"
                  >
                    {senhaCodigo ? 'Trocar kit' : 'Escolher no mapa'}
                  </button>
                </div>
              </div>

              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider -mb-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>2. Dupla e cavalo</span>
                <span className="text-[11px] text-slate-400 font-normal">Selecione dos cadastros ou digite para autocompletar</span>
              </h3>

              <datalist id="lista-competidores">
                {competidoresCadastrados.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.apelido_pista ? `"${c.apelido_pista}"` : ''}
                  </option>
                ))}
              </datalist>

              <datalist id="lista-cavalos">
                {cavalosCadastrados.map((cav) => (
                  <option key={cav.id} value={cav.nome}>
                    {cav.tipo === 'PUXA' ? '(Puxa)' : cav.tipo === 'ESTEIRA' ? '(Esteira)' : '(Ambos)'}
                  </option>
                ))}
              </datalist>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo id="puxador" label="Puxador Oficial" obrigatorio>
                  <div className="flex gap-1.5">
                    <input
                      id="puxador"
                      type="text"
                      list="lista-competidores"
                      required
                      placeholder="Busque ou digite o nome..."
                      value={puxadorNome}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPuxadorNome(val);
                        const match = competidoresCadastrados.find(c => c.nome.toLowerCase() === val.toLowerCase());
                        setPuxadorId(match ? match.id : null);
                      }}
                      className={inputBase}
                    />
                    <button
                      type="button"
                      onClick={() => setModalRapidoCompetidor('PUXADOR')}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shrink-0 cursor-pointer"
                      title="Cadastrar novo puxador rapidamente"
                    >
                      + Novo
                    </button>
                  </div>
                </Campo>

                <Campo id="esteira" label="Esteireiro Oficial" obrigatorio>
                  <div className="flex gap-1.5">
                    <input
                      id="esteira"
                      type="text"
                      list="lista-competidores"
                      required
                      placeholder="Busque ou digite o nome..."
                      value={esteiraNome}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEsteiraNome(val);
                        const match = competidoresCadastrados.find(c => c.nome.toLowerCase() === val.toLowerCase());
                        setEsteiraId(match ? match.id : null);
                      }}
                      className={inputBase}
                    />
                    <button
                      type="button"
                      onClick={() => setModalRapidoCompetidor('ESTEIRA')}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shrink-0 cursor-pointer"
                      title="Cadastrar novo esteireiro rapidamente"
                    >
                      + Novo
                    </button>
                  </div>
                </Campo>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo id="cavalo" label="Cavalo de Puxa" obrigatorio>
                  <div className="flex gap-1.5">
                    <input
                      id="cavalo"
                      type="text"
                      list="lista-cavalos"
                      required
                      placeholder="Busque ou digite o nome do animal..."
                      value={cavaloNome}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCavaloNome(val);
                        const match = cavalosCadastrados.find(cav => cav.nome.toLowerCase() === val.toLowerCase());
                        setCavaloId(match ? match.id : null);
                      }}
                      className={inputBase}
                    />
                    <button
                      type="button"
                      onClick={() => setModalRapidoCavalo(true)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shrink-0 cursor-pointer"
                      title="Cadastrar novo cavalo rapidamente"
                    >
                      + Novo
                    </button>
                  </div>
                </Campo>

                <Campo id="categoria" label="Categoria da Prova">
                  <select
                    id="categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className={inputBase}
                  >
                    <option value="PROFISSIONAL">Profissional</option>
                    <option value="AMADOR">Amador</option>
                    <option value="ASPIRANTE">Aspirante</option>
                    <option value="FEMININA">Feminina</option>
                  </select>
                </Campo>
              </div>

              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider -mb-2 pt-2 border-t border-slate-100">
                3. Venda e pagamento
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Campo id="canal" label="Canal de Venda">
                  <select
                    id="canal"
                    value={canalVenda}
                    onChange={(e) => setCanalVenda(e.target.value as CanalVenda)}
                    className={inputBase}
                  >
                    <option value="PRESENCIAL">Presencial (Secretaria)</option>
                    <option value="ANTECIPADA">Antecipada (Site / App)</option>
                  </select>
                </Campo>
                <Campo id="pagamento" label="Forma de Pagamento" obrigatorio>
                  <select
                    id="pagamento"
                    required
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
                    className={inputBase}
                  >
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="VALE">Vale</option>
                  </select>
                </Campo>
                <Campo
                  id="valor"
                  label="Valor Total (R$)"
                  dica={!valorVendaValido ? 'Informe um valor maior que zero.' : undefined}
                >
                  <input
                    id="valor"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={valorVenda}
                    onChange={(e) => setValorVenda(e.target.value)}
                    aria-invalid={!valorVendaValido}
                    className={`${inputBase} font-bold ${!valorVendaValido ? 'border-red-400' : ''}`}
                  />
                </Campo>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <div>• A secretaria seleciona um kit previamente cadastrado no estoque.</div>
                <div>• Cada kit contém 2 senhas (uma baixa e uma alta) e registra puxador, esteira, cavalo e forma de pagamento.</div>
                <div>
                  • A venda confirmada aloca 2 bois para CADA senha do kit (4 bois no total).
                </div>
              </div>

              <button
                type="submit"
                disabled={enviandoVenda || !senhaCodigo}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition text-sm shadow-sm cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {enviandoVenda
                  ? 'Processando venda...'
                  : senhaCodigo
                  ? `Confirmar venda do kit ${senhaCodigo}-${codigoAltaDaSenhaSelecionada} — ${valorVendaValido ? brl.format(valorVendaNumero * 2) : '—'}`
                  : 'Selecione um kit para continuar'}
              </button>
            </form>

            {/* Senha Map Modal */}
            {mapaAberto && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-slate-900">Selecionar Kit</h3>
                    <button
                      onClick={() => setMapaAberto(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ×
                    </button>
                  </div>
                  <SenhaMap
                    onSenhaSelect={setSenhaCodigo}
                    selectedSenha={senhaCodigo ?? null}
                    vaquejadaId="vq-2026-portal"
                    faixaBaixa={[1, 200]}
                    faixaAlta={[800, 999]}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Painel lateral */}
          <div className="lg:col-span-5 space-y-4">
            {retornoVenda ? (
              <div className="bg-white border-2 border-emerald-500 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Venda emitida com sucesso
                </div>
                <div className="text-xs text-slate-600 space-y-2">
                  {retornoVenda.mensagem && <p>{retornoVenda.mensagem}</p>}
                  {retornoVenda.kit && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <strong>Código do Kit:</strong> {retornoVenda.kit.codigo}
                    </div>
                  )}
                  {Array.isArray(retornoVenda.senhas) && (
                    <div className="space-y-1.5">
                      <strong className="block text-slate-800">Senhas geradas:</strong>
                      {retornoVenda.senhas.map((s: any, idx: number) => (
                        <div
                          key={s.codigo ?? idx}
                          className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between font-mono text-xs"
                        >
                          <span className="font-bold text-slate-900">
                            Senha {idx + 1}: {s.codigo}
                          </span>
                          <span className="text-slate-500">2 bois alocados</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {retornoVenda.senha && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs font-bold text-slate-900">
                      Senha solteira: {retornoVenda.senha.codigo} (2 bois alocados)
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRetornoVenda(null)}
                    className="py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    Nova venda
                  </button>
                  <a
                    href="/mapa"
                    className="block text-center py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition"
                  >
                    Ver no Mapa da Pista &rarr;
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs shadow-sm">
                Selecione um kit disponível para registrar a venda e os dados da dupla.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================== ABA BOI DE OURO ========================= */}
      {abaAtiva === 'BOI_OURO' && (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CartaoResumo
              titulo="Pagamento pendente"
              valor={resumo.pendentes}
              classe="bg-amber-50 border-amber-200 text-amber-900"
            />
            <CartaoResumo
              titulo="Aguardando autorização"
              valor={resumo.aguardando}
              classe="bg-blue-50 border-blue-200 text-blue-900"
            />
            <CartaoResumo
              titulo="Liberados no mapa"
              valor={resumo.noMapa}
              classe="bg-emerald-50 border-emerald-200 text-emerald-900"
            />
          </div>

          {/* Solicitar */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-2">Solicitar Boi de Ouro</h2>
            <form onSubmit={handleSolicitarBoiOuro} className="flex flex-col sm:flex-row gap-2 max-w-xl">
              <input
                type="text"
                aria-label="ID ou código da senha de origem"
                placeholder="ID ou código da senha de origem (ex: sn-001)"
                value={senhaOrigemId}
                onChange={(e) => setSenhaOrigemId(e.target.value)}
                className={`${inputBase} flex-1 text-xs py-2`}
              />
              <button
                type="submit"
                disabled={enviandoSolicitacao}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm transition disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {enviandoSolicitacao ? 'Registrando...' : 'Registrar solicitação'}
              </button>
            </form>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Solicitações de Boi de Ouro
                <span className="ml-2 text-slate-400 normal-case font-medium">
                  ({boisFiltrados.length} de {boisOuro.length})
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="search"
                  aria-label="Buscar solicitações"
                  placeholder="Buscar senha, competidor ou boi..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className={`${inputBase} text-xs py-1.5 sm:w-64`}
                />
                <select
                  aria-label="Filtrar por situação"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value as FiltroBoi)}
                  className={`${inputBase} text-xs py-1.5 sm:w-auto`}
                >
                  <option value="TODOS">Todas as situações</option>
                  <option value="PENDENTE_PAGAMENTO">Pagamento pendente</option>
                  <option value="AGUARDANDO_AUTORIZACAO">Aguardando autorização</option>
                  <option value="NO_MAPA">Liberados no mapa</option>
                </select>
                <button
                  type="button"
                  onClick={carregarBoisOuro}
                  disabled={carregandoLista}
                  className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {carregandoLista ? 'Atualizando...' : 'Atualizar'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                      <th scope="col" className="py-3 px-4">Senha origem</th>
                      <th scope="col" className="py-3 px-4">Competidor</th>
                      <th scope="col" className="py-3 px-4">Boi alocado</th>
                      <th scope="col" className="py-3 px-4">Status</th>
                      <th scope="col" className="py-3 px-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boisFiltrados.map((boi) => (
                      <tr key={boi.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-700 font-mono">{boi.senha_origem_id}</td>
                        <td className="py-3 px-4 text-slate-700">{boi.puxador_nome}</td>
                        <td className="py-3 px-4 text-slate-700 font-mono">
                          #{boi.boi_numero_registro} - {boi.boi_nome}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-bold ${
                              situacaoBoi(boi).classe
                            }`}
                          >
                            {situacaoBoi(boi).rotulo}
                          </span>
                        </td>
                        <td className="py-3 px-4 flex space-x-2">
                          {!boi.pago && (
                            <button
                              onClick={() => abrirModalPagamento(boi)}
                              disabled={acaoEmAndamento === boi.id}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-shadow"
                            >
                              Pagar
                            </button>
                          )}
                          {boi.pago && !boi.autorizado_por && (
                            <button
                              onClick={() => setAutorizacaoModal(boi)}
                              disabled={acaoEmAndamento === boi.id}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-shadow"
                            >
                              Autorizar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {boisFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500">
                          Nenhuma solicitação encontrada
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro Rápido de Competidor */}

      {modalRapidoCompetidor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSalvarRapidoCompetidor} className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-3.5">
            <h3 className="text-base font-bold text-slate-900">
              Cadastro Rápido de {modalRapidoCompetidor === 'PUXADOR' ? 'Puxador' : 'Esteireiro'}
            </h3>
            <p className="text-xs text-slate-500">
              Cadastre o vaqueiro agora para selecioná-lo imediatamente nesta venda.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                placeholder="Ex: Celso Vitório"
                value={formRapidoComp.nome}
                onChange={(e) => setFormRapidoComp({ ...formRapidoComp, nome: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Apelido</label>
                <input
                  type="text"
                  placeholder="Ex: Celsinho"
                  value={formRapidoComp.apelido_pista}
                  onChange={(e) => setFormRapidoComp({ ...formRapidoComp, apelido_pista: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CPF (11 dígitos) *</label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={formRapidoComp.cpf}
                  onChange={(e) => setFormRapidoComp({ ...formRapidoComp, cpf: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalRapidoCompetidor(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Salvar e Selecionar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Cadastro Rápido de Cavalo */}
      {modalRapidoCavalo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSalvarRapidoCavalo} className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-3.5">
            <h3 className="text-base font-bold text-slate-900">Cadastro Rápido de Cavalo</h3>
            <p className="text-xs text-slate-500">
              Cadastre o animal de puxa agora para selecioná-lo imediatamente nesta venda.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Cavalo *</label>
              <input
                type="text"
                required
                placeholder="Ex: Holland Ease"
                value={formRapidoCav.nome}
                onChange={(e) => setFormRapidoCav({ ...formRapidoCav, nome: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Aptidão *</label>
              <select
                value={formRapidoCav.tipo}
                onChange={(e) => setFormRapidoCav({ ...formRapidoCav, tipo: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
              >
                <option value="PUXA">Cavalo de Puxa</option>
                <option value="ESTEIRA">Cavalo de Esteira</option>
                <option value="AMBOS">Ambos</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalRapidoCavalo(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Salvar e Selecionar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
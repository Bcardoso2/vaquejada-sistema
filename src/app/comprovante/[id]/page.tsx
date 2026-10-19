'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';

interface SenhaDetalhes {
  id: string;
  codigo: string;
  categoria: string;
  status: string;
  estado_comercial: string;
  valor_centavos: number;
  puxador_nome: string;
  esteira_nome: string;
  puxador_apelido?: string;
  esteira_apelido?: string;
  cavalo_nome?: string;
  cavalo_oficial_nome?: string;
  vaquejada_nome?: string;
  vaquejada_local?: string;
  forma_pagamento?: string;
  confirmado_em?: string;
  criado_em: string;
}

export default function ComprovanteTermicoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [senha, setSenha] = useState<SenhaDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [larguraTermica, setLarguraTermica] = useState<'80mm' | '58mm'>('80mm');
  const [erro, setErro] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/senhas/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Senha não encontrada');
        }
        return res.json();
      })
      .then((data: SenhaDetalhes) => {
        setSenha(data);
        setLoading(false);

        // Gera QR Code real de alta legibilidade com o código da senha e metadados
        const conteudoQr = JSON.stringify({
          senha: data.codigo,
          cat: data.categoria,
          id: data.id,
          puxador: data.puxador_nome,
        });

        QRCode.toDataURL(conteudoQr, {
          width: 160,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
          .then((url) => setQrCodeDataUrl(url))
          .catch((err) => console.error('Erro ao gerar QR Code:', err));
      })
      .catch((err) => {
        setErro(err.message);
        setLoading(false);
      });
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white font-mono">
        <div className="animate-spin text-3xl mr-3">⏳</div>
        <span>Carregando comprovante térmico...</span>
      </div>
    );
  }

  if (erro || !senha) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border-2 border-rose-500 rounded-2xl p-6 max-w-md w-full text-center text-white">
          <span className="text-4xl block mb-2">❌</span>
          <h2 className="text-xl font-bold mb-2">Não foi possível carregar a senha</h2>
          <p className="text-sm text-gray-400 mb-6">{erro || 'Registro não localizado no sistema'}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-sm"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const formatarMoeda = (centavos: number) =>
    (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const dataEmissao = new Date(senha.confirmado_em || senha.criado_em).toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center py-6 px-4">
      {/* BARRA DE CONTROLE NA TELA (NÃO IMPRIME) */}
      <div className="w-full max-w-sm mb-6 flex items-center justify-between gap-3 bg-slate-900 border border-slate-700 p-3 rounded-2xl shadow-xl print:hidden">
        <button
          onClick={() => router.back()}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold rounded-xl transition"
        >
          ⬅ Voltar
        </button>

        {/* Alternador 58mm / 80mm */}
        <div className="flex bg-black p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setLarguraTermica('58mm')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
              larguraTermica === '58mm' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            58mm
          </button>
          <button
            onClick={() => setLarguraTermica('80mm')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
              larguraTermica === '80mm' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            80mm
          </button>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-1.5"
        >
          <span>🖨️</span>
          <span>IMPRIMIR</span>
        </button>
      </div>

      {/* ESTILO ESPECÍFICO DE IMPRESSÃO TÉRMICA */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-hidden {
            display: none !important;
          }
          @page {
            size: ${larguraTermica === '58mm' ? '58mm' : '80mm'} auto;
            margin: 0;
          }
        }
      `}</style>

      {/* CUPOM TÉRMICO FORMATADO (58mm ou 80mm) */}
      <div
        className={`bg-white text-black p-4 font-mono shadow-2xl transition-all border border-gray-300 ${
          larguraTermica === '58mm' ? 'w-[260px] text-[10px]' : 'w-[320px] text-[11px]'
        }`}
      >
        {/* CABEÇALHO DO EVENTO */}
        <div className="text-center border-b border-dashed border-black pb-2 mb-2">
          <h1 className="font-black text-sm uppercase tracking-tight">
            {senha.vaquejada_nome || 'GRANDE VAQUEJADA PORTAL'}
          </h1>
          <p className="text-[10px] text-gray-700">{senha.vaquejada_local || 'PARQUE DE VAQUEJADA'}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">COMPROVANTE OFICIAL DE INSCRIÇÃO</p>
        </div>

        {/* NÚMERO DA SENHA EM DESTAQUE */}
        <div className="text-center my-3 py-2 bg-gray-100 border border-black rounded">
          <span className="text-[9px] uppercase tracking-widest block font-bold text-gray-600">
            NÚMERO DA SENHA
          </span>
          <span className="text-3xl font-black tracking-wider block">#{senha.codigo}</span>
          <span className="inline-block px-2 py-0.5 text-[9px] font-black bg-black text-white rounded uppercase mt-1">
            CATEGORIA {senha.categoria}
          </span>
        </div>

        {/* DADOS DA DUPLA */}
        <div className="border-b border-dashed border-black pb-2 mb-2 space-y-1">
          <div>
            <span className="font-bold block text-[9px] text-gray-600 uppercase">PUXADOR:</span>
            <span className="font-black text-xs block">
              {senha.puxador_apelido ? `"${senha.puxador_apelido}" ` : ''}
              {senha.puxador_nome}
            </span>
          </div>

          <div>
            <span className="font-bold block text-[9px] text-gray-600 uppercase">ESTEIREIRO:</span>
            <span className="font-black text-xs block">
              {senha.esteira_apelido ? `"${senha.esteira_apelido}" ` : ''}
              {senha.esteira_nome}
            </span>
          </div>

          {(senha.cavalo_nome || senha.cavalo_oficial_nome) && (
            <div>
              <span className="font-bold block text-[9px] text-gray-600 uppercase">CAVALO:</span>
              <span className="font-bold text-[10px] block">
                {senha.cavalo_oficial_nome || senha.cavalo_nome}
              </span>
            </div>
          )}
        </div>

        {/* DADOS FINANCEIROS / PAGAMENTO */}
        <div className="border-b border-dashed border-black pb-2 mb-2 space-y-0.5">
          <div className="flex justify-between items-center font-bold">
            <span>VALOR DA INSCRIÇÃO:</span>
            <span>{formatarMoeda(senha.valor_centavos || 30000)}</span>
          </div>

          <div className="flex justify-between items-center text-[10px]">
            <span>FORMA DE PAGAMENTO:</span>
            <span className="font-bold uppercase">{senha.forma_pagamento || 'BALCÃO / DINHEIRO'}</span>
          </div>

          <div className="flex justify-between items-center text-[10px]">
            <span>SITUAÇÃO:</span>
            <span className="font-black text-emerald-800 uppercase">
              {senha.estado_comercial === 'PAGA' ? 'PAGO / CONFIRMADO' : senha.estado_comercial}
            </span>
          </div>
        </div>

        {/* DATA E AUTENTICAÇÃO */}
        <div className="text-[9px] text-gray-600 space-y-0.5 mb-3">
          <div className="flex justify-between">
            <span>EMISSÃO:</span>
            <span>{dataEmissao}</span>
          </div>
          <div className="flex justify-between">
            <span>ID REGISTRO:</span>
            <span className="font-mono">{senha.id.slice(0, 14)}</span>
          </div>
        </div>

        {/* QR CODE OFICIAL DA SENHA */}
        <div className="text-center pt-2 border-t border-dashed border-black">
          {qrCodeDataUrl ? (
            <div className="flex flex-col items-center justify-center my-1">
              <img
                src={qrCodeDataUrl}
                alt={`QR Code Senha #${senha.codigo}`}
                className="w-24 h-24 border border-black p-1 bg-white"
              />
              <span className="font-mono text-[9px] font-bold mt-1">SENHA #{senha.codigo}</span>
            </div>
          ) : (
            <div className="w-24 h-24 mx-auto my-1 border border-black flex items-center justify-center text-[9px]">
              Carregando QR...
            </div>
          )}
          <span className="text-[8px] text-gray-600 uppercase block font-semibold">
            Apresente este QR Code na cancela para validação
          </span>
          <span className="text-[8px] font-black mt-1 block">BOA SORTE! • VAQUEJADA DE TRADIÇÃO</span>
        </div>
      </div>
    </div>
  );
}

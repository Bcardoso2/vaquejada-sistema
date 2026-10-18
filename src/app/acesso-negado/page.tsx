'use client';

import Link from 'next/link';

export default function AcessoNegadoPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black">
          🚫
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Acesso Restrito ao seu Perfil
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Seu usuário não possui permissão para acessar esta área do sistema de acordo com a matriz de permissões.
          </p>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 text-left space-y-1">
          <div className="font-semibold text-slate-700">Regras de Acesso:</div>
          <div>• <strong>SECRETARIA</strong>: Vendas e Financeiro</div>
          <div>• <strong>OPERADOR_PISTA</strong>: Mapa da Pista</div>
          <div>• <strong>JUIZ</strong>: Julgamento e Boi de TV</div>
          <div>• <strong>ADMIN</strong>: Acesso Total</div>
        </div>

        <div className="flex gap-2 justify-center pt-2">
          <Link
            href="/"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition shadow-xs"
          >
            Voltar para Minha Área
          </Link>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            Trocar de Conta
          </button>
        </div>
      </div>
    </div>
  );
}

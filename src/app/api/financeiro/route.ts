import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { registrarAuditoria } from '@/lib/audit';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

export async function GET() {
  try {
    const senhasRes = await query(
      `SELECT id, codigo, puxador_nome, esteira_nome, categoria, tipo_venda, canal_venda, 
              estado_comercial, valor_centavos, criado_em 
       FROM senhas ORDER BY criado_em DESC`
    );

    const bdoRes = await query(
      `SELECT id, valor_centavos, pago, estado, referencia_pagamento, pagamento_confirmado_em 
       FROM bois_ouro ORDER BY criado_em DESC`
    );

    const pagamentosRes = await query(
      `SELECT * FROM pagamentos ORDER BY criado_em DESC`
    );

    // Calcular totais em centavos inteiros (RN-08)
    const totalSenhasPagas = senhasRes.rows
      .filter((s: any) => s.estado_comercial === 'PAGA')
      .reduce((acc: number, curr: any) => acc + (curr.valor_centavos || 0), 0);

    const totalBoisOuroPagos = bdoRes.rows
      .filter((b: any) => b.pago)
      .reduce((acc: number, curr: any) => acc + (curr.valor_centavos || 0), 0);

    return NextResponse.json({
      resumo: {
        totalRecebidoCentavos: totalSenhasPagas + totalBoisOuroPagos,
        totalSenhasPagasCentavos: totalSenhasPagas,
        totalBoisOuroCentavos: totalBoisOuroPagos,
        qtdSenhas: senhasRes.rows.length,
        qtdBoisOuro: bdoRes.rows.length,
      },
      senhas: senhasRes.rows,
      boisOuro: bdoRes.rows,
      pagamentos: pagamentosRes.rows
    });
  } catch (error) {
    console.error('Erro na API financeira:', error);
    return NextResponse.json({ error: 'Erro ao carregar dados financeiros' }, { status: 500 });
  }
}

// POST /api/financeiro - Registrar pagamento manual ou baixa (RN-08, CA-03)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { senhaId, tipo = 'MANUAL', valorCentavos, referencia, operadorNome = 'Operador Financeiro' } = body;

    if (!senhaId || !referencia) {
      return NextResponse.json({ error: 'Senha e referência/comprovante são obrigatórios (RN-08)' }, { status: 400 });
    }

    const id = `pag-${uuidv4().slice(0, 8)}`;
    await query(
      `INSERT INTO pagamentos (id, senha_id, tipo, valor_centavos, status, referencia_externa)
       VALUES ($1, $2, $3, $4, 'CONFIRMADO', $5)`,
      [id, senhaId, tipo, valorCentavos || 30000, referencia]
    );

    await query(
      `UPDATE senhas SET estado_comercial = 'PAGA' WHERE id = $1`,
      [senhaId]
    );

    await registrarAuditoria({
      usuarioNome: operadorNome,
      papel: 'FINANCEIRO',
      acao: 'PAGAMENTO_REGISTRADO_MANUAL',
      entidade: 'pagamentos',
      entidadeId: id,
      detalhes: { senhaId, tipo, valorCentavos, referencia },
      motivo: `Recebimento confirmado com referência: ${referencia}`
    });

    return NextResponse.json({ success: true, id, mensagem: 'Pagamento manual registrado com sucesso' });
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    return NextResponse.json({ error: 'Erro ao registrar pagamento' }, { status: 500 });
  }
}

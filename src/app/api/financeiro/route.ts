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
      `SELECT p.id, p.senha_id, p.tipo, p.valor_centavos, p.status, p.referencia_externa, 
              p.comprovante_detalhes, p.confirmado_em, p.criado_em,
              s.codigo AS senha_codigo, s.puxador_nome, s.categoria
       FROM pagamentos p
       LEFT JOIN senhas s ON p.senha_id = s.id
       ORDER BY p.criado_em DESC`
    );

    // Calcular totais em centavos inteiros (RN-08)
    const pagamentosConfirmados = pagamentosRes.rows.filter((p: any) => p.status === 'CONFIRMADO');
    const pagamentosEstornados = pagamentosRes.rows.filter((p: any) => p.status === 'ESTORNADO');

    const totalPagamentosConfirmados = pagamentosConfirmados.reduce(
      (acc: number, curr: any) => acc + (curr.valor_centavos || 0),
      0
    );

    const totalEstornadoCentavos = pagamentosEstornados.reduce(
      (acc: number, curr: any) => acc + (curr.valor_centavos || 0),
      0
    );

    const totalBoisOuroPagos = bdoRes.rows
      .filter((b: any) => b.pago)
      .reduce((acc: number, curr: any) => acc + (curr.valor_centavos || 0), 0);

    // Se houver senhas marcadas como PAGA sem pagamento explícito na tabela pagamentos,
    // garantimos consistência contábil somando a diferença
    const totalSenhasPagasAtivas = senhasRes.rows
      .filter((s: any) => s.estado_comercial === 'PAGA')
      .reduce((acc: number, curr: any) => acc + (curr.valor_centavos || 0), 0);

    const totalBrutoRecebidoCentavos = Math.max(totalPagamentosConfirmados + totalBoisOuroPagos, totalSenhasPagasAtivas + totalBoisOuroPagos);
    const saldoLiquidoCentavos = totalBrutoRecebidoCentavos - totalEstornadoCentavos;

    return NextResponse.json({
      resumo: {
        totalRecebidoCentavos: totalBrutoRecebidoCentavos,
        totalBrutoRecebidoCentavos,
        totalEstornadoCentavos,
        saldoLiquidoCentavos,
        totalSenhasPagasCentavos: totalSenhasPagasAtivas,
        totalBoisOuroCentavos: totalBoisOuroPagos,
        qtdSenhas: senhasRes.rows.length,
        qtdBoisOuro: bdoRes.rows.length,
        qtdEstornos: pagamentosEstornados.length,
        qtdPagamentos: pagamentosRes.rows.length,
      },
      senhas: senhasRes.rows,
      boisOuro: bdoRes.rows,
      pagamentos: pagamentosRes.rows,
    });
  } catch (error) {
    console.error('Erro na API financeira:', error);
    return NextResponse.json({ error: 'Erro ao carregar dados financeiros' }, { status: 500 });
  }
}

// POST /api/financeiro - Registrar pagamento manual, baixa ou estorno
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      acao = 'RECEBIMENTO',
      pagamentoId,
      senhaId, 
      tipo = 'MANUAL', 
      valorCentavos, 
      referencia, 
      motivo,
      operadorNome = 'Operador Financeiro' 
    } = body;

    // Fluxo de ESTORNO manual
    if (acao === 'ESTORNO') {
      if (!pagamentoId && !senhaId) {
        return NextResponse.json(
          { error: 'ID do pagamento ou da senha é obrigatório para estorno' },
          { status: 400 }
        );
      }

      if (!motivo || motivo.trim().length < 5) {
        return NextResponse.json(
          { error: 'Motivo do estorno é obrigatório (mínimo 5 caracteres)' },
          { status: 400 }
        );
      }

      let queryText = '';
      let params = [];

      if (pagamentoId) {
        queryText = `UPDATE pagamentos SET status = 'ESTORNADO', comprovante_detalhes = COALESCE(comprovante_detalhes, '') || ' | ' || $1 WHERE id = $2 RETURNING *`;
        params = [`Estorno: ${motivo}`, pagamentoId];
      } else {
        queryText = `UPDATE pagamentos SET status = 'ESTORNADO', comprovante_detalhes = COALESCE(comprovante_detalhes, '') || ' | ' || $1 WHERE senha_id = $2 AND status = 'CONFIRMADO' RETURNING *`;
        params = [`Estorno: ${motivo}`, senhaId];
      }

      const resUpdate = await query(queryText, params);
      if (resUpdate.rowCount === 0) {
        return NextResponse.json(
          { error: 'Nenhum pagamento confirmado encontrado para estorno' },
          { status: 404 }
        );
      }

      // Se a senha foi vinculada, atualizar estado comercial da senha para ESTORNADA/CANCELADA
      const targetSenhaId = resUpdate.rows[0].senha_id;
      if (targetSenhaId) {
        await query(
          `UPDATE senhas SET estado_comercial = 'CANCELADA', status = 'CANCELADA', atualizado_em = CURRENT_TIMESTAMP WHERE id = $1`,
          [targetSenhaId]
        );
      }

      await registrarAuditoria({
        usuarioNome: operadorNome,
        papel: 'FINANCEIRO',
        acao: 'ESTORNO_PAGAMENTO_REGISTRADO',
        entidade: 'pagamentos',
        entidadeId: resUpdate.rows[0].id,
        detalhes: {
          pagamento: resUpdate.rows[0],
          motivo,
        },
        motivo,
      });

      return NextResponse.json({
        success: true,
        mensagem: 'Estorno realizado com sucesso',
        pagamento: resUpdate.rows[0],
      });
    }

    // Fluxo de RECEBIMENTO manual
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
    console.error('Erro ao registrar operação financeira:', error);
    return NextResponse.json({ error: 'Erro ao processar operação financeira' }, { status: 500 });
  }
}

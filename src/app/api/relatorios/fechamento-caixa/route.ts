import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';

// GET /api/relatorios/fechamento-caixa - Fechamento financeiro por operador/turno e geral
// Autorizado para: ADMIN e SECRETARIA
// Registra auditoria a cada exportação
// ZERO CPF completo
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const url = new URL(request.url);
    const operador = url.searchParams.get('operador') || '';
    const formato = (url.searchParams.get('formato') || 'pdf').toLowerCase();
    const vaquejadaId = url.searchParams.get('vaquejada_id') || 'vq-2026-portal';

    // 1. Vaquejada
    const vqRes = await query(`SELECT nome, local FROM vaquejadas WHERE id = $1`, [vaquejadaId]);
    const vaquejada = vqRes.rows[0] || { nome: 'Grande Vaquejada Portal', local: 'Parque de Vaquejada' };

    // 2. Buscar pagamentos
    let wherePagamentos = `WHERE 1=1`;
    const paramsPag: any[] = [];

    if (operador && operador !== 'TODOS') {
      paramsPag.push(operador);
      wherePagamentos += ` AND p.recebido_por = $${paramsPag.length}`;
    }

    const pagamentosRes = await query(
      `SELECT 
        p.id, p.senha_id, p.tipo, p.valor_centavos, p.status, p.referencia_externa,
        p.comprovante_detalhes, p.recebido_por, p.confirmado_em, p.criado_em,
        s.codigo as senha_codigo, s.categoria, s.puxador_nome
       FROM pagamentos p
       LEFT JOIN senhas s ON p.senha_id = s.id
       ${wherePagamentos}
       ORDER BY p.criado_em DESC`,
      paramsPag
    );

    const pagamentos = pagamentosRes.rows;

    // 3. Totais Contábeis
    const confirmados = pagamentos.filter((p) => p.status === 'CONFIRMADO');
    const estornados = pagamentos.filter((p) => p.status === 'ESTORNADO');

    const totalBrutoCentavos = confirmados.reduce((acc, p) => acc + (p.valor_centavos || 0), 0);
    const totalEstornosCentavos = estornados.reduce((acc, p) => acc + (p.valor_centavos || 0), 0);
    const totalLiquidoCentavos = totalBrutoCentavos - totalEstornosCentavos;

    // 4. Totais por Forma de Pagamento
    const porFormaPagamento: Record<string, { quantidade: number; totalCentavos: number }> = {};
    for (const p of confirmados) {
      const tipo = p.tipo || 'OUTROS';
      if (!porFormaPagamento[tipo]) {
        porFormaPagamento[tipo] = { quantidade: 0, totalCentavos: 0 };
      }
      porFormaPagamento[tipo].quantidade++;
      porFormaPagamento[tipo].totalCentavos += p.valor_centavos || 0;
    }

    // 5. Totais por Operador
    const porOperador: Record<string, { quantidade: number; totalCentavos: number; estornosCentavos: number }> = {};
    for (const p of pagamentos) {
      const op = p.recebido_por || 'Sistema / Geral';
      if (!porOperador[op]) {
        porOperador[op] = { quantidade: 0, totalCentavos: 0, estornosCentavos: 0 };
      }
      if (p.status === 'CONFIRMADO') {
        porOperador[op].quantidade++;
        porOperador[op].totalCentavos += p.valor_centavos || 0;
      } else if (p.status === 'ESTORNADO') {
        porOperador[op].estornosCentavos += p.valor_centavos || 0;
      }
    }

    // 6. Auditoria da exportação
    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'EXPORTAR_FECHAMENTO_CAIXA',
      entidade: 'pagamentos',
      detalhes: {
        formato,
        operador: operador || 'TODOS',
        totalBrutoCentavos,
        totalEstornosCentavos,
        totalLiquidoCentavos,
        qtdPagamentos: pagamentos.length,
      },
      motivo: `Exportação de Fechamento de Caixa (${formato.toUpperCase()}) por ${auth.session.nome}`,
    });

    const formatarMoeda = (centavos: number) =>
      (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const dataHoraEmissao = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });

    // 7. Formato EXCEL (CSV com BOM UTF-8 e separador ;)
    if (formato === 'excel' || formato === 'csv') {
      const linhas: string[] = [];

      linhas.push(`FECHAMENTO DE CAIXA - ${vaquejada.nome.toUpperCase()}`);
      linhas.push(`Emissão:;${dataHoraEmissao}`);
      linhas.push(`Operador / Turno:;${operador || 'TODOS'}`);
      linhas.push(`Emitido por:;${auth.session.nome} (${auth.session.papel})`);
      linhas.push('');

      linhas.push('RESUMO CONSOLIDADO');
      linhas.push(`Total Bruto:;${formatarMoeda(totalBrutoCentavos)}`);
      linhas.push(`Total de Estornos:;${formatarMoeda(totalEstornosCentavos)}`);
      linhas.push(`Total Líquido em Caixa:;${formatarMoeda(totalLiquidoCentavos)}`);
      linhas.push(`Quantidade de Transações:;${pagamentos.length}`);
      linhas.push('');

      linhas.push('TOTALIZAÇÃO POR FORMA DE PAGAMENTO');
      linhas.push('Forma de Pagamento;Quantidade;Total Recebido');
      for (const [forma, dados] of Object.entries(porFormaPagamento)) {
        linhas.push(`${forma};${dados.quantidade};${formatarMoeda(dados.totalCentavos)}`);
      }
      linhas.push('');

      linhas.push('DETALHAMENTO DE LANÇAMENTOS');
      linhas.push('ID Pagamento;Senha;Categoria;Puxador;Forma;Status;Valor;Recebido Por;Data/Hora');
      for (const p of pagamentos) {
        const valorFmt = formatarMoeda(p.valor_centavos || 0);
        const dataFmt = new Date(p.criado_em).toLocaleString('pt-BR');
        linhas.push(
          `${p.id};${p.senha_codigo || '-'};${p.categoria || '-'};"${(p.puxador_nome || '').replace(/"/g, '""')}";${p.tipo};${p.status};${valorFmt};"${p.recebido_por || 'Geral'}";${dataFmt}`
        );
      }

      const csvContent = '\uFEFF' + linhas.join('\r\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="fechamento_caixa_${operador || 'geral'}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 8. Formato PDF / HTML Oficial A4
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Fechamento de Caixa - ${vaquejada.nome}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 15mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #111827;
      background: #ffffff;
      padding: 10px;
    }
    .header {
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .header p {
      font-size: 11px;
      color: #4b5563;
      margin-top: 2px;
    }
    .cards-resumo {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .card {
      border: 1px solid #d1d5db;
      padding: 10px 14px;
      border-radius: 6px;
      background: #f9fafb;
    }
    .card.destaque {
      background: #ecfdf5;
      border-color: #10b981;
    }
    .card .label {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      color: #4b5563;
    }
    .card .valor {
      font-size: 20px;
      font-weight: 900;
      color: #111827;
      margin-top: 4px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      margin: 14px 0 6px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #e5e7eb;
      color: #1f2937;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    th {
      background: #1f2937;
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 6px 8px;
      text-align: left;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
      font-size: 10px;
      vertical-align: middle;
    }
    tr:nth-child(even) { background-color: #f9fafb; }
    .badge-confirmado {
      color: #16a34a;
      font-weight: bold;
    }
    .badge-estornado {
      color: #dc2626;
      font-weight: bold;
    }
    .termo-conferencia {
      margin-top: 25px;
      border: 1px solid #d1d5db;
      padding: 12px;
      border-radius: 6px;
      background: #fafafa;
      page-break-inside: avoid;
    }
    .termo-conferencia p {
      font-size: 10px;
      color: #4b5563;
      margin-bottom: 25px;
    }
    .assinaturas {
      display: flex;
      justify-content: space-between;
      gap: 30px;
    }
    .assinatura {
      flex: 1;
      text-align: center;
      border-top: 1px solid #000;
      padding-top: 4px;
      font-size: 10px;
      font-weight: bold;
    }
    .assinatura span {
      display: block;
      font-size: 9px;
      color: #6b7280;
      font-weight: normal;
    }
    .no-print {
      margin-bottom: 15px;
      padding: 10px;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-action {
      background: #059669;
      color: #fff;
      border: none;
      padding: 8px 16px;
      font-size: 11px;
      font-weight: bold;
      border-radius: 4px;
      cursor: pointer;
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <span>💰 <strong>Fechamento Contábil de Caixa (Pronto para PDF / Impressão A4)</strong></span>
    <button class="btn-action" onclick="window.print()">🖨️ Salvar como PDF / Imprimir</button>
  </div>

  <div class="header">
    <div>
      <h1>${vaquejada.nome}</h1>
      <p>Demonstrativo Contábil e Fechamento de Caixa • Filtro: ${operador ? `Operador: ${operador}` : 'Geral (Evento Completo)'}</p>
    </div>
    <div style="text-align: right; font-size: 10px; color: #4b5563;">
      Emissão: <strong>${dataHoraEmissao}</strong><br/>
      Responsável: <strong>${auth.session.nome}</strong> (${auth.session.papel})
    </div>
  </div>

  <div class="cards-resumo">
    <div class="card">
      <div class="label">Total Bruto Recebido</div>
      <div class="valor" style="color: #0284c7;">${formatarMoeda(totalBrutoCentavos)}</div>
    </div>
    <div class="card">
      <div class="label">Total Estornos / Devoluções</div>
      <div class="valor" style="color: #dc2626;">${formatarMoeda(totalEstornosCentavos)}</div>
    </div>
    <div class="card destaque">
      <div class="label">Saldo Líquido em Caixa</div>
      <div class="valor" style="color: #059669;">${formatarMoeda(totalLiquidoCentavos)}</div>
    </div>
  </div>

  <div class="section-title">1. Totalização por Forma de Pagamento</div>
  <table>
    <thead>
      <tr>
        <th>Forma de Pagamento</th>
        <th style="text-align:center; width: 120px;">Qtd. Transações</th>
        <th style="text-align:right; width: 160px;">Total Recebido (R$)</th>
        <th style="text-align:right; width: 120px;">Participação (%)</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(porFormaPagamento)
        .map(([forma, d]) => {
          const part = totalBrutoCentavos > 0 ? Math.round((d.totalCentavos / totalBrutoCentavos) * 100) : 0;
          return `
        <tr>
          <td><strong>${forma}</strong></td>
          <td style="text-align:center">${d.quantidade}</td>
          <td style="text-align:right; font-weight:bold">${formatarMoeda(d.totalCentavos)}</td>
          <td style="text-align:right">${part}%</td>
        </tr>
      `;
        })
        .join('')}
    </tbody>
  </table>

  ${
    Object.keys(porOperador).length > 1
      ? `
    <div class="section-title">2. Totalização por Operador / Caixa</div>
    <table>
      <thead>
        <tr>
          <th>Operador</th>
          <th style="text-align:center; width: 100px;">Qtd. Vendas</th>
          <th style="text-align:right; width: 140px;">Bruto (R$)</th>
          <th style="text-align:right; width: 140px;">Estornos (R$)</th>
          <th style="text-align:right; width: 140px;">Líquido (R$)</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(porOperador)
          .map(([op, d]) => {
            const liq = d.totalCentavos - d.estornosCentavos;
            return `
          <tr>
            <td><strong>${op}</strong></td>
            <td style="text-align:center">${d.quantidade}</td>
            <td style="text-align:right">${formatarMoeda(d.totalCentavos)}</td>
            <td style="text-align:right; color:#dc2626">${formatarMoeda(d.estornosCentavos)}</td>
            <td style="text-align:right; font-weight:bold">${formatarMoeda(liq)}</td>
          </tr>
        `;
          })
          .join('')}
      </tbody>
    </table>
  `
      : ''
  }

  <div class="section-title">3. Detalhamento dos Últimos Lançamentos (${pagamentos.length} transações)</div>
  <table>
    <thead>
      <tr>
        <th style="width:65px">SENHA</th>
        <th style="width:75px">CATEGORIA</th>
        <th>PUXADOR</th>
        <th style="width:90px">FORMA</th>
        <th style="width:75px; text-align:center">STATUS</th>
        <th style="width:110px; text-align:right">VALOR</th>
        <th style="width:120px">DATA / HORA</th>
      </tr>
    </thead>
    <tbody>
      ${pagamentos
        .slice(0, 50)
        .map(
          (p) => `
        <tr>
          <td style="font-family:monospace; font-weight:bold">${p.senha_codigo || '-'}</td>
          <td>${p.categoria || '-'}</td>
          <td>${p.puxador_nome || '-'}</td>
          <td>${p.tipo}</td>
          <td style="text-align:center" class="${p.status === 'CONFIRMADO' ? 'badge-confirmado' : 'badge-estornado'}">
            ${p.status}
          </td>
          <td style="text-align:right; font-weight:bold">${formatarMoeda(p.valor_centavos || 0)}</td>
          <td style="font-size:9px; color:#4b5563">${new Date(p.criado_em).toLocaleString('pt-BR')}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  ${pagamentos.length > 50 ? `<p style="font-size:9px; color:#6b7280; margin-top:-8px; margin-bottom:12px;">* Exibindo os 50 lançamentos mais recentes. O arquivo Excel contém o extrato completo de todas as ${pagamentos.length} transações.</p>` : ''}

  <div class="termo-conferencia">
    <p>
      Declaro que os valores acima expressos conferem fielmente com a movimentação financeira registrada nos caixas do evento, tendo sido validados pelo setor de Secretaria e Tesouraria.
    </p>
    <div class="assinaturas">
      <div class="assinatura">
        Operador de Caixa / Secretaria
        <span>${auth.session.nome}</span>
      </div>
      <div class="assinatura">
        Tesouraria / Administrador Geral
        <span>Visto Oficial</span>
      </div>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Erro ao gerar fechamento de caixa:', error);
    return NextResponse.json({ error: 'Erro ao gerar fechamento de caixa' }, { status: 500 });
  }
}

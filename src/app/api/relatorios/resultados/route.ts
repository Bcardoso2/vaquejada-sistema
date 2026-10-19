import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';
import {
  gerarResultadosXLSX,
  gerarResultadosPDF,
} from '@/lib/relatorios-export';

// GET /api/relatorios/resultados - Relatório de resultados por categoria e por bateria em PDF nativo e XLSX real
// Autorizado para: ADMIN e SECRETARIA
// Registra auditoria a cada exportação
// ZERO CPF completo
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const url = new URL(request.url);
    const categoria = url.searchParams.get('categoria') || '';
    const bateriaId = url.searchParams.get('bateria_id') || '';
    const vaquejadaId = url.searchParams.get('vaquejada_id') || 'vq-2026-portal';
    const formato = (url.searchParams.get('formato') || 'pdf').toLowerCase();

    // 1. Vaquejada
    const vqRes = await query(`SELECT nome, local FROM vaquejadas WHERE id = $1`, [vaquejadaId]);
    const vaquejada = vqRes.rows[0] || { nome: 'Grande Vaquejada Portal', local: 'Parque de Vaquejada' };

    // 2. Montar consulta filtrada
    let whereClause = `WHERE cm.vaquejada_id = $1`;
    const params: any[] = [vaquejadaId];

    if (categoria && categoria !== 'TODAS') {
      params.push(categoria);
      whereClause += ` AND s.categoria = $${params.length}`;
    }

    if (bateriaId && bateriaId !== 'TODAS') {
      params.push(bateriaId);
      whereClause += ` AND cm.bateria_id = $${params.length}`;
    }

    const res = await query(
      `SELECT 
        cm.id, cm.ordem_mapa, cm.ordem_na_bateria, cm.boi_numero, cm.tipo_entrada,
        cm.estado, cm.resultado_final, cm.concluida_em,
        b.numero as bateria_numero,
        s.codigo as senha_codigo, s.categoria,
        s.puxador_nome, s.esteira_nome,
        comp_pux.apelido_pista as puxador_apelido,
        comp_est.apelido_pista as esteira_apelido,
        cav.nome as cavalo_nome
       FROM corridas_mapa cm
       JOIN senhas s ON cm.senha_id = s.id
       LEFT JOIN baterias b ON cm.bateria_id = b.id
       LEFT JOIN competidores comp_pux ON s.puxador_id = comp_pux.id
       LEFT JOIN competidores comp_est ON s.esteira_id = comp_est.id
       LEFT JOIN cavalos cav ON s.cavalo_puxa_id = cav.id
       ${whereClause}
       ORDER BY b.numero ASC NULLS LAST, cm.ordem_na_bateria ASC NULLS LAST, cm.ordem_mapa ASC`,
      params
    );

    const corridas = res.rows;
    const totalCorridas = corridas.length;
    const totalValeu = corridas.filter((c) => c.resultado_final === 'VALEU').length;
    const totalZero = corridas.filter((c) => c.resultado_final === 'ZERO').length;
    const aproveitamento = totalCorridas > 0 ? Math.round((totalValeu / totalCorridas) * 100) : 0;

    // 3. Auditoria da exportação
    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'EXPORTAR_RELATORIO_RESULTADOS',
      entidade: 'corridas_mapa',
      detalhes: {
        formato,
        categoria: categoria || 'TODAS',
        bateriaId: bateriaId || 'TODAS',
        totalCorridas,
        totalValeu,
        totalZero,
      },
      motivo: `Exportação de Relatório de Resultados (${formato.toUpperCase()}) por ${auth.session.nome}`,
    });

    const dataHoraEmissao = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });

    // 4. FORMATO XLSX DE VERDADE (ExcelJS)
    if (formato === 'xlsx' || formato === 'excel') {
      const buffer = await gerarResultadosXLSX({
        vaquejadaNome: vaquejada.nome,
        categoria,
        bateriaId,
        emitidoPor: `${auth.session.nome} (${auth.session.papel})`,
        dataHoraEmissao,
        corridas,
        totalCorridas,
        totalValeu,
        totalZero,
        aproveitamento,
      });

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="resultados_vaquejada_${categoria || 'geral'}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 5. FORMATO CSV
    if (formato === 'csv') {
      const cabecalho = [
        'Bateria',
        'Ordem',
        'Senha',
        'Categoria',
        'Puxador',
        'Apelido Puxador',
        'Esteireiro',
        'Apelido Esteireiro',
        'Cavalo',
        'Boi Nº',
        'Tipo',
        'Status',
        'Resultado',
      ].join(';');

      const linhas = corridas.map((c) =>
        [
          c.bateria_numero ? `Bateria ${c.bateria_numero}` : 'Geral',
          c.ordem_na_bateria || c.ordem_mapa || 0,
          c.senha_codigo || '',
          c.categoria || '',
          `"${(c.puxador_nome || '').replace(/"/g, '""')}"`,
          `"${(c.puxador_apelido || '').replace(/"/g, '""')}"`,
          `"${(c.esteira_nome || '').replace(/"/g, '""')}"`,
          `"${(c.esteira_apelido || '').replace(/"/g, '""')}"`,
          `"${(c.cavalo_nome || '').replace(/"/g, '""')}"`,
          c.boi_numero || '',
          c.tipo_entrada || 'REGULAR',
          c.estado || '',
          c.resultado_final || 'PENDENTE',
        ].join(';')
      );

      const csvContent = '\uFEFF' + [cabecalho, ...linhas].join('\r\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="resultados_vaquejada_${categoria || 'geral'}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 6. FORMATO PDF NATIVO BAIXÁVEL (jsPDF)
    if (formato === 'pdf') {
      const buffer = await gerarResultadosPDF({
        vaquejadaNome: vaquejada.nome,
        vaquejadaLocal: vaquejada.local,
        categoria,
        bateriaId,
        emitidoPor: `${auth.session.nome} (${auth.session.papel})`,
        dataHoraEmissao,
        corridas,
        totalCorridas,
        totalValeu,
        totalZero,
        aproveitamento,
      });

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="resultados_vaquejada_${categoria || 'geral'}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 5. Formato PDF / HTML Oficial A4
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Resultados - ${vaquejada.nome}</title>
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
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      font-size: 17px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .header p {
      font-size: 10px;
      color: #4b5563;
      margin-top: 2px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .stat-card {
      background: #f9fafb;
      border: 1px solid #d1d5db;
      padding: 8px 10px;
      border-radius: 4px;
      text-align: center;
    }
    .stat-card .val {
      font-size: 16px;
      font-weight: 900;
      color: #111827;
    }
    .stat-card .lbl {
      font-size: 9px;
      font-weight: bold;
      color: #6b7280;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #111827;
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
    .badge-valeu {
      background: #dcfce7;
      color: #166534;
      font-weight: 900;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #86efac;
      font-size: 9px;
      text-align: center;
      display: inline-block;
    }
    .badge-zero {
      background: #fee2e2;
      color: #991b1b;
      font-weight: 900;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #fca5a5;
      font-size: 9px;
      text-align: center;
      display: inline-block;
    }
    .badge-pend {
      color: #6b7280;
      font-size: 9px;
      font-style: italic;
    }
    .no-print {
      margin-bottom: 15px;
      padding: 10px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-action {
      background: #16a34a;
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
    <span>📊 <strong>Relatório Oficial de Resultados de Pista</strong></span>
    <button class="btn-action" onclick="window.print()">🖨️ Salvar como PDF / Imprimir</button>
  </div>

  <div class="header">
    <div>
      <h1>${vaquejada.nome}</h1>
      <p>Local: ${vaquejada.local} • Filtro: Categoria: ${categoria || 'TODAS'} | Bateria: ${bateriaId || 'TODAS'}</p>
    </div>
    <div style="text-align: right; font-size: 10px; color: #4b5563;">
      Emissão: <strong>${dataHoraEmissao}</strong><br/>
      Responsável: <strong>${auth.session.nome}</strong> (${auth.session.papel})
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="val">${totalCorridas}</div>
      <div class="lbl">Total de Corridas</div>
    </div>
    <div class="stat-card">
      <div class="val" style="color:#16a34a">${totalValeu}</div>
      <div class="lbl">Valeu Boi</div>
    </div>
    <div class="stat-card">
      <div class="val" style="color:#dc2626">${totalZero}</div>
      <div class="lbl">Zero Pontos</div>
    </div>
    <div class="stat-card">
      <div class="val">${aproveitamento}%</div>
      <div class="lbl">Aproveitamento</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:50px">BAT.</th>
        <th style="width:65px">SENHA</th>
        <th style="width:75px">CATEGORIA</th>
        <th>PUXADOR</th>
        <th>ESTEIREIRO</th>
        <th style="width:110px">CAVALO</th>
        <th style="width:40px; text-align:center">BOI</th>
        <th style="width:85px; text-align:center">RESULTADO</th>
      </tr>
    </thead>
    <tbody>
      ${corridas
        .map(
          (c) => `
        <tr>
          <td>${c.bateria_numero ? `Bat. ${c.bateria_numero}` : '#'}</td>
          <td style="font-family:monospace; font-weight:bold">${c.senha_codigo}</td>
          <td>${c.categoria}</td>
          <td>
            <strong>${c.puxador_apelido ? `"${c.puxador_apelido}" ` : ''}</strong>${c.puxador_nome}
          </td>
          <td>
            <strong>${c.esteira_apelido ? `"${c.esteira_apelido}" ` : ''}</strong>${c.esteira_nome}
          </td>
          <td>${c.cavalo_nome || '-'}</td>
          <td style="text-align:center">${c.boi_numero || '-'}</td>
          <td style="text-align:center">
            ${
              c.resultado_final === 'VALEU'
                ? '<span class="badge-valeu">VALEU</span>'
                : c.resultado_final === 'ZERO'
                ? '<span class="badge-zero">ZERO</span>'
                : '<span class="badge-pend">PENDENTE</span>'
            }
          </td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div style="margin-top: 30px; border-top: 1px solid #d1d5db; padding-top: 8px; font-size: 9px; color: #6b7280; display: flex; justify-content: space-between;">
    <span>Sistema de Vaquejada Portal • Relatório protegido pela LGPD (sem CPF completo)</span>
    <span>Página 1 de 1</span>
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
    console.error('Erro ao gerar relatório de resultados:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório de resultados' }, { status: 500 });
  }
}

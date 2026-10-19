import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';
import { gerarSumulaBateriaPDF } from '@/lib/relatorios-export';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/relatorios/bateria/[id] - Súmula / Ordem de Largada da Bateria em PDF nativo baixável e HTML imprimível
// Autorizado para: ADMIN, SECRETARIA e OPERADOR_PISTA
// Registra auditoria a cada exportação
// ZERO CPF completo
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const formato = (url.searchParams.get('formato') || 'pdf').toLowerCase();

    // 1. Consultar dados da bateria e da vaquejada
    const batRes = await query(
      `SELECT b.*, v.nome as vaquejada_nome, v.local as vaquejada_local, v.data_inicio, v.data_fim
       FROM baterias b
       JOIN vaquejadas v ON b.vaquejada_id = v.id
       WHERE b.id = $1`,
      [id]
    );

    if (batRes.rowCount === 0) {
      return NextResponse.json({ error: 'Bateria não encontrada' }, { status: 404 });
    }

    const bateria = batRes.rows[0];

    // 2. Consultar corridas ordenadas na bateria (SEM CPF)
    const corridasRes = await query(
      `SELECT 
        cm.id, cm.ordem_na_bateria, cm.ordem_mapa, cm.boi_numero, cm.tipo_entrada,
        cm.estado, cm.resultado_final,
        s.codigo as senha_codigo, s.categoria,
        s.puxador_nome, s.esteira_nome, s.cavalo_nome,
        comp_pux.apelido_pista as puxador_apelido,
        comp_est.apelido_pista as esteira_apelido,
        cav.nome as cavalo_oficial_nome
       FROM corridas_mapa cm
       JOIN senhas s ON cm.senha_id = s.id
       LEFT JOIN competidores comp_pux ON s.puxador_id = comp_pux.id
       LEFT JOIN competidores comp_est ON s.esteira_id = comp_est.id
       LEFT JOIN cavalos cav ON s.cavalo_puxa_id = cav.id
       WHERE cm.bateria_id = $1
       ORDER BY cm.ordem_na_bateria ASC, cm.ordem_mapa ASC`,
      [id]
    );

    // 3. Auditoria da exportação
    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'EXPORTAR_RELATORIO_BATERIA',
      entidade: 'baterias',
      entidadeId: id,
      detalhes: {
        bateriaNumero: bateria.numero,
        totalDuplas: corridasRes.rowCount,
        formato,
      },
      motivo: `Exportação da Súmula da Bateria ${bateria.numero} (${formato.toUpperCase()})`,
    });

    // Se solicitado JSON
    if (formato === 'json') {
      return NextResponse.json({
        bateria,
        totalCorridas: corridasRes.rowCount,
        corridas: corridasRes.rows,
      });
    }

    const dataHoraEmissao = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });

    // 4. FORMATO PDF NATIVO BAIXÁVEL (jsPDF)
    if (formato === 'pdf') {
      const buffer = await gerarSumulaBateriaPDF({
        vaquejadaNome: bateria.vaquejada_nome || 'Grande Vaquejada Portal',
        vaquejadaLocal: bateria.vaquejada_local,
        bateriaNumero: bateria.numero,
        totalCorridas: corridasRes.rowCount || 0,
        emitidoPor: `${auth.session.nome} (${auth.session.papel})`,
        dataHoraEmissao,
        corridas: corridasRes.rows,
      });

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="sumula_bateria_${bateria.numero}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Súmula Oficial - Bateria ${bateria.numero} - ${bateria.vaquejada_nome}</title>
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
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .header p {
      font-size: 11px;
      color: #4b5563;
      margin-top: 2px;
    }
    .badge-bateria {
      background: #000;
      color: #fff;
      font-size: 16px;
      font-weight: 900;
      padding: 6px 14px;
      border-radius: 6px;
      text-align: center;
    }
    .meta-box {
      display: flex;
      gap: 15px;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 6px 10px;
      border-radius: 4px;
      margin-bottom: 12px;
      font-size: 10px;
    }
    .meta-box div { font-weight: bold; }
    .meta-box span { font-weight: normal; color: #374151; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #1f2937;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 6px 8px;
      text-align: left;
      border: 1px solid #1f2937;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
      font-size: 10px;
      vertical-align: middle;
    }
    tr:nth-child(even) { background-color: #f9fafb; }
    .col-ordem { font-weight: 900; font-size: 12px; width: 45px; text-align: center; }
    .col-senha { font-weight: 800; font-family: monospace; font-size: 11px; width: 65px; }
    .col-cat { width: 70px; font-weight: bold; }
    .col-dupla { width: 230px; }
    .col-boi { width: 55px; text-align: center; }
    .col-res { width: 90px; text-align: center; }
    .col-obs { width: 110px; }
    .box-anotacao {
      border: 1px dashed #9ca3af;
      height: 18px;
      border-radius: 3px;
    }
    .footer-assinaturas {
      margin-top: 35px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .assinatura {
      width: 30%;
      text-align: center;
      border-top: 1px solid #000;
      padding-top: 4px;
      font-size: 10px;
      font-weight: bold;
    }
    .assinatura span { font-size: 9px; font-weight: normal; color: #4b5563; display: block; }
    .no-print {
      margin-bottom: 15px;
      padding: 10px;
      background: #e0f2fe;
      border: 1px solid #7dd3fc;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-imprimir {
      background: #0284c7;
      color: #fff;
      border: none;
      padding: 8px 16px;
      font-size: 12px;
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
    <span><strong>Súmula Oficial de Pista (Pronta para PDF / Impressão A4)</strong></span>
    <button class="btn-imprimir" onclick="window.print()">Salvar como PDF / Imprimir</button>
  </div>

  <div class="header">
    <div>
      <h1>${bateria.vaquejada_nome}</h1>
      <p>Local: ${bateria.vaquejada_local} • Súmula Oficial de Pista</p>
    </div>
    <div class="badge-bateria">
      BATERIA Nº ${bateria.numero}
    </div>
  </div>

  <div class="meta-box">
    <div>Status: <span>${bateria.status}</span></div>
    <div>Total de Duplas: <span>${corridasRes.rowCount}</span></div>
    <div>Emissão: <span>${dataHoraEmissao}</span></div>
    <div>Operador: <span>${auth.session.nome}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-ordem">Nº</th>
        <th class="col-senha">SENHA</th>
        <th class="col-cat">CATEGORIA</th>
        <th class="col-dupla">PUXADOR / ESTEIREIRO</th>
        <th class="col-boi">BOI</th>
        <th class="col-res">JULGAMENTO</th>
        <th class="col-obs">ASSINATURA / OBS</th>
      </tr>
    </thead>
    <tbody>
      ${corridasRes.rows
        .map(
          (c: any) => `
        <tr>
          <td class="col-ordem">#${c.ordem_na_bateria || c.ordem_mapa}</td>
          <td class="col-senha">${c.senha_codigo}</td>
          <td class="col-cat">${c.categoria}</td>
          <td class="col-dupla">
            <strong>Pux:</strong> ${c.puxador_apelido ? `"${c.puxador_apelido}" - ` : ''}${c.puxador_nome}<br/>
            <strong>Est:</strong> ${c.esteira_apelido ? `"${c.esteira_apelido}" - ` : ''}${c.esteira_nome}
            ${c.cavalo_oficial_nome ? `<br/><span style="color:#6b7280; font-size:9px">Cavalo: ${c.cavalo_oficial_nome}</span>` : ''}
          </td>
          <td class="col-boi">${c.boi_numero || '-'}</td>
          <td class="col-res">
            ${
              c.resultado_final
                ? `<strong>${c.resultado_final}</strong>`
                : `<div class="box-anotacao"></div>`
            }
          </td>
          <td class="col-obs">
            <div class="box-anotacao"></div>
          </td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer-assinaturas">
    <div class="assinatura">
      Juiz de Pista
      <span>Assinatura Oficial</span>
    </div>
    <div class="assinatura">
      Locutor / Operador de Pista
      <span>${auth.session.nome}</span>
    </div>
    <div class="assinatura">
      Comissão Organizadora
      <span>Visto / Conferência</span>
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
    console.error('Erro ao gerar relatório da bateria:', error);
    return NextResponse.json({ error: 'Erro ao gerar súmula da bateria' }, { status: 500 });
  }
}

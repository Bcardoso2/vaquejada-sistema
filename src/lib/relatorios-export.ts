import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';

// Utilitários de formatação
export const formatarMoeda = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarDataHora = (dataStr?: string | Date) => {
  if (!dataStr) return '-';
  const d = typeof dataStr === 'string' ? new Date(dataStr) : dataStr;
  return d.toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
};

// ==========================================
// 1. FECHAMENTO DE CAIXA: EXCEL (.XLSX)
// ==========================================
export async function gerarFechamentoCaixaXLSX(dados: {
  vaquejadaNome: string;
  vaquejadaLocal?: string;
  operador: string;
  emitidoPor: string;
  dataHoraEmissao: string;
  totalBrutoCentavos: number;
  totalEstornosCentavos: number;
  totalLiquidoCentavos: number;
  porFormaPagamento: Record<string, { quantidade: number; totalCentavos: number }>;
  porOperador: Record<string, { quantidade: number; totalCentavos: number; estornosCentavos: number }>;
  pagamentos: any[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Gestão de Vaquejada';
  wb.created = new Date();

  // ABA 1: RESUMO CONSOLIDADO
  const wsResumo = wb.addWorksheet('Resumo do Caixa');

  // Cabeçalho Principal
  wsResumo.mergeCells('A1:E1');
  const titleCell = wsResumo.getCell('A1');
  titleCell.value = `FECHAMENTO DE CAIXA - ${dados.vaquejadaNome.toUpperCase()}`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumo.getRow(1).height = 30;

  // Informações de Emissão
  wsResumo.addRow(['Emissão:', dados.dataHoraEmissao, '', 'Emitido por:', dados.emitidoPor]);
  wsResumo.addRow(['Operador / Turno:', dados.operador || 'TODOS', '', 'Local:', dados.vaquejadaLocal || '-']);
  wsResumo.addRow([]);

  // Cards de Totais
  wsResumo.addRow(['TOTAIS CONSOLIDADOS', '', '', '', '']);
  const headerTotais = wsResumo.lastRow!;
  headerTotais.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerTotais.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

  wsResumo.addRow(['Total Bruto Arrecadado:', dados.totalBrutoCentavos / 100]);
  wsResumo.addRow(['Total de Estornos:', dados.totalEstornosCentavos / 100]);
  wsResumo.addRow(['Saldo Líquido em Caixa:', dados.totalLiquidoCentavos / 100]);
  wsResumo.addRow(['Quantidade Total de Transações:', dados.pagamentos.length]);

  // Formatar valores como moeda R$
  ['B6', 'B7', 'B8'].forEach((cellRef) => {
    const c = wsResumo.getCell(cellRef);
    c.numFmt = '"R$" #,##0.00';
    c.font = { bold: true };
  });
  wsResumo.getCell('B8').font = { bold: true, color: { argb: 'FF16A34A' } };

  wsResumo.addRow([]);

  // Tabela por Forma de Pagamento
  wsResumo.addRow(['TOTALIZAÇÃO POR FORMA DE PAGAMENTO', '', '']);
  const rowHForma = wsResumo.lastRow!;
  rowHForma.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rowHForma.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

  wsResumo.addRow(['Forma de Pagamento', 'Quantidade', 'Total Recebido (R$)']);
  const rowThForma = wsResumo.lastRow!;
  rowThForma.font = { bold: true };

  for (const [forma, item] of Object.entries(dados.porFormaPagamento)) {
    wsResumo.addRow([forma, item.quantidade, item.totalCentavos / 100]);
    const r = wsResumo.lastRow!;
    r.getCell(3).numFmt = '"R$" #,##0.00';
  }

  wsResumo.columns = [
    { width: 32 },
    { width: 18 },
    { width: 22 },
    { width: 16 },
    { width: 28 },
  ];

  // ABA 2: DETALHAMENTO DE LANÇAMENTOS
  const wsDetalhe = wb.addWorksheet('Lançamentos');
  wsDetalhe.addRow([
    'ID Pagamento',
    'Senha',
    'Categoria',
    'Puxador',
    'Forma',
    'Status',
    'Valor (R$)',
    'Operador',
    'Data/Hora',
  ]);

  const hDet = wsDetalhe.getRow(1);
  hDet.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hDet.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  hDet.height = 24;

  for (const p of dados.pagamentos) {
    wsDetalhe.addRow([
      p.id,
      p.senha_codigo || '-',
      p.categoria || '-',
      p.puxador_nome || '-',
      p.tipo || 'OUTROS',
      p.status || 'CONFIRMADO',
      (p.valor_centavos || 0) / 100,
      p.recebido_por || 'Geral',
      formatarDataHora(p.criado_em),
    ]);

    const r = wsDetalhe.lastRow!;
    r.getCell(7).numFmt = '"R$" #,##0.00';
    if (p.status === 'ESTORNADO') {
      r.getCell(6).font = { color: { argb: 'FFDC2626' }, bold: true };
    } else {
      r.getCell(6).font = { color: { argb: 'FF16A34A' } };
    }
  }

  wsDetalhe.columns = [
    { width: 38 },
    { width: 10 },
    { width: 14 },
    { width: 26 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 20 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ==========================================
// 2. FECHAMENTO DE CAIXA: PDF OFICIAL NATIVO
// ==========================================
export async function gerarFechamentoCaixaPDF(dados: {
  vaquejadaNome: string;
  vaquejadaLocal?: string;
  operador: string;
  emitidoPor: string;
  dataHoraEmissao: string;
  totalBrutoCentavos: number;
  totalEstornosCentavos: number;
  totalLiquidoCentavos: number;
  porFormaPagamento: Record<string, { quantidade: number; totalCentavos: number }>;
  pagamentos: any[];
}): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = 14;

  const desenharCabecalho = () => {
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(14, y, pageWidth - 28, 16, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`FECHAMENTO DE CAIXA - ${dados.vaquejadaNome.toUpperCase()}`, pageWidth / 2, y + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Local: ${dados.vaquejadaLocal || '-'}  |  Operador: ${dados.operador || 'TODOS'}  |  Emissão: ${dados.dataHoraEmissao}`,
      pageWidth / 2,
      y + 12,
      { align: 'center' }
    );

    y += 20;
  };

  const desenharRodape = (pagina: number, totalPaginas: number) => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Emitido por ${dados.emitidoPor} - Página ${pagina} de ${totalPaginas} - Sistema de Gestão de Vaquejada`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  };

  desenharCabecalho();

  // Cards de Totais
  const cardWidth = (pageWidth - 28 - 6) / 3;
  const cardHeight = 16;

  // Total Bruto
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, y, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL BRUTO ARRECADADO', 14 + cardWidth / 2, y + 5, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatarMoeda(dados.totalBrutoCentavos), 14 + cardWidth / 2, y + 12, { align: 'center' });

  // Estornos
  const xEstornos = 14 + cardWidth + 3;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(xEstornos, y, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text('TOTAL DE ESTORNOS', xEstornos + cardWidth / 2, y + 5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(formatarMoeda(dados.totalEstornosCentavos), xEstornos + cardWidth / 2, y + 12, { align: 'center' });

  // Saldo Líquido
  const xLiquido = xEstornos + cardWidth + 3;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(xLiquido, y, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text('SALDO LÍQUIDO EM CAIXA', xLiquido + cardWidth / 2, y + 5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(formatarMoeda(dados.totalLiquidoCentavos), xLiquido + cardWidth / 2, y + 12, { align: 'center' });

  y += cardHeight + 6;

  // Totalização por Forma de Pagamento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('TOTALIZAÇÃO POR FORMA DE PAGAMENTO', 14, y);
  y += 4;

  doc.setFillColor(51, 65, 85);
  doc.rect(14, y, pageWidth - 28, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('Forma de Pagamento', 18, y + 4.2);
  doc.text('Transações', 100, y + 4.2, { align: 'center' });
  doc.text('Total Recebido (R$)', pageWidth - 18, y + 4.2, { align: 'right' });
  y += 6;

  let rowBg = false;
  for (const [forma, item] of Object.entries(dados.porFormaPagamento)) {
    if (rowBg) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageWidth - 28, 5.5, 'F');
    }
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(forma, 18, y + 4);
    doc.text(String(item.quantidade), 100, y + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatarMoeda(item.totalCentavos), pageWidth - 18, y + 4, { align: 'right' });

    y += 5.5;
    rowBg = !rowBg;
  }

  y += 6;

  // Detalhamento de Lançamentos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`LANÇAMENTOS INDIVIDUAIS (${dados.pagamentos.length} transações)`, 14, y);
  y += 4;

  const desenharCabecalhoTabela = () => {
    doc.setFillColor(51, 65, 85);
    doc.rect(14, y, pageWidth - 28, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Senha', 18, y + 4.2);
    doc.text('Cat.', 34, y + 4.2);
    doc.text('Puxador', 54, y + 4.2);
    doc.text('Forma', 110, y + 4.2);
    doc.text('Status', 135, y + 4.2);
    doc.text('Valor', 160, y + 4.2, { align: 'right' });
    doc.text('Data/Hora', pageWidth - 18, y + 4.2, { align: 'right' });
    y += 6;
  };

  desenharCabecalhoTabela();

  rowBg = false;
  for (const p of dados.pagamentos) {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 14;
      desenharCabecalho();
      desenharCabecalhoTabela();
    }

    if (rowBg) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageWidth - 28, 5, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);

    doc.text(String(p.senha_codigo || '-'), 18, y + 3.6);
    doc.text(String(p.categoria || '-'), 34, y + 3.6);
    doc.text((p.puxador_nome || '-').slice(0, 24), 54, y + 3.6);
    doc.text(String(p.tipo || '-'), 110, y + 3.6);

    if (p.status === 'ESTORNADO') {
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTORNADO', 135, y + 3.6);
    } else {
      doc.setTextColor(22, 163, 74);
      doc.text('CONFIRMADO', 135, y + 3.6);
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(formatarMoeda(p.valor_centavos || 0), 160, y + 3.6, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text(formatarDataHora(p.criado_em).slice(0, 16), pageWidth - 18, y + 3.6, { align: 'right' });

    y += 5;
    rowBg = !rowBg;
  }

  // Numeração de páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    desenharRodape(i, totalPages);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ==========================================
// 3. RESULTADOS: EXCEL (.XLSX)
// ==========================================
export async function gerarResultadosXLSX(dados: {
  vaquejadaNome: string;
  categoria: string;
  bateriaId: string;
  emitidoPor: string;
  dataHoraEmissao: string;
  corridas: any[];
  totalCorridas: number;
  totalValeu: number;
  totalZero: number;
  aproveitamento: number;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Gestão de Vaquejada';
  wb.created = new Date();

  const ws = wb.addWorksheet('Resultados');

  // Cabeçalho Principal
  ws.mergeCells('A1:J1');
  const tCell = ws.getCell('A1');
  tCell.value = `RELATÓRIO OFICIAL DE RESULTADOS - ${dados.vaquejadaNome.toUpperCase()}`;
  tCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  tCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.addRow([
    'Emissão:', dados.dataHoraEmissao,
    'Categoria:', dados.categoria || 'TODAS',
    'Total Duplas:', dados.totalCorridas,
    'Valeu Boi:', dados.totalValeu,
    'Aproveitamento:', `${dados.aproveitamento}%`,
  ]);
  ws.addRow([]);

  // Cabeçalho da Tabela
  ws.addRow([
    'Bateria',
    'Ordem',
    'Senha',
    'Categoria',
    'Puxador',
    'Apelido Puxador',
    'Esteireiro',
    'Cavalo',
    'Boi Nº',
    'Resultado Final',
  ]);

  const hRow = ws.lastRow!;
  hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
  hRow.height = 22;

  for (const c of dados.corridas) {
    ws.addRow([
      c.bateria_numero ? `Bateria ${c.bateria_numero}` : 'Geral',
      c.ordem_na_bateria || c.ordem_mapa || 0,
      c.senha_codigo || '-',
      c.categoria || '-',
      c.puxador_nome || '-',
      c.puxador_apelido || '-',
      c.esteira_nome || '-',
      c.cavalo_nome || '-',
      c.boi_numero || '-',
      c.resultado_final || 'PENDENTE',
    ]);

    const r = ws.lastRow!;
    if (c.resultado_final === 'VALEU') {
      r.getCell(10).font = { bold: true, color: { argb: 'FF16A34A' } };
    } else if (c.resultado_final === 'ZERO') {
      r.getCell(10).font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  }

  ws.columns = [
    { width: 14 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 26 },
    { width: 18 },
    { width: 26 },
    { width: 20 },
    { width: 10 },
    { width: 18 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ==========================================
// 4. RESULTADOS: PDF OFICIAL NATIVO
// ==========================================
export async function gerarResultadosPDF(dados: {
  vaquejadaNome: string;
  vaquejadaLocal?: string;
  categoria: string;
  bateriaId: string;
  emitidoPor: string;
  dataHoraEmissao: string;
  corridas: any[];
  totalCorridas: number;
  totalValeu: number;
  totalZero: number;
  aproveitamento: number;
}): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = 14;

  const desenharCabecalho = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(14, y, pageWidth - 28, 16, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`RELATÓRIO OFICIAL DE RESULTADOS - ${dados.vaquejadaNome.toUpperCase()}`, pageWidth / 2, y + 6.5, {
      align: 'center',
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Categoria: ${dados.categoria || 'TODAS'}  |  Total: ${dados.totalCorridas} duplas  |  Valeu: ${dados.totalValeu} (${dados.aproveitamento}%)  |  Emissão: ${dados.dataHoraEmissao}`,
      pageWidth / 2,
      y + 12,
      { align: 'center' }
    );

    y += 20;
  };

  const desenharCabecalhoTabela = () => {
    doc.setFillColor(51, 65, 85);
    doc.rect(14, y, pageWidth - 28, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    doc.text('Bat.', 17, y + 4.2);
    doc.text('Ord.', 28, y + 4.2);
    doc.text('Senha', 38, y + 4.2);
    doc.text('Cat.', 52, y + 4.2);
    doc.text('Puxador / Esteireiro', 70, y + 4.2);
    doc.text('Cavalo', 135, y + 4.2);
    doc.text('Boi', 165, y + 4.2);
    doc.text('Resultado', pageWidth - 18, y + 4.2, { align: 'right' });
    y += 6;
  };

  const desenharRodape = (pagina: number, totalPaginas: number) => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Emitido por ${dados.emitidoPor} - Página ${pagina} de ${totalPaginas} - Sistema de Gestão de Vaquejada`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  };

  desenharCabecalho();
  desenharCabecalhoTabela();

  let rowBg = false;
  for (const c of dados.corridas) {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 14;
      desenharCabecalho();
      desenharCabecalhoTabela();
    }

    if (rowBg) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageWidth - 28, 5.5, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);

    doc.text(c.bateria_numero ? `B${c.bateria_numero}` : '-', 17, y + 4);
    doc.text(String(c.ordem_na_bateria || c.ordem_mapa || '-'), 28, y + 4);
    doc.text(String(c.senha_codigo || '-'), 38, y + 4);
    doc.text(String(c.categoria || '-'), 52, y + 4);

    const duplaText = `${c.puxador_nome || '-'} / ${c.esteira_nome || '-'}`;
    doc.text(duplaText.slice(0, 34), 70, y + 4);

    doc.text((c.cavalo_nome || '-').slice(0, 16), 135, y + 4);
    doc.text(String(c.boi_numero || '-'), 165, y + 4);

    if (c.resultado_final === 'VALEU') {
      doc.setTextColor(22, 163, 74);
      doc.setFont('helvetica', 'bold');
      doc.text('VALEU BOI', pageWidth - 18, y + 4, { align: 'right' });
    } else if (c.resultado_final === 'ZERO') {
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('ZERO', pageWidth - 18, y + 4, { align: 'right' });
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text(c.resultado_final || 'PENDENTE', pageWidth - 18, y + 4, { align: 'right' });
    }

    y += 5.5;
    rowBg = !rowBg;
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    desenharRodape(i, totalPages);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ==========================================
// 5. SÚMULA DE BATERIA: PDF OFICIAL NATIVO
// ==========================================
export async function gerarSumulaBateriaPDF(dados: {
  vaquejadaNome: string;
  vaquejadaLocal?: string;
  bateriaNumero: number;
  totalCorridas: number;
  emitidoPor: string;
  dataHoraEmissao: string;
  corridas: any[];
}): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = 14;

  const desenharCabecalho = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(14, y, pageWidth - 28, 16, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(
      `SÚMULA OFICIAL DE PISTA - BATERIA ${dados.bateriaNumero} - ${dados.vaquejadaNome.toUpperCase()}`,
      pageWidth / 2,
      y + 6.5,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Total: ${dados.totalCorridas} duplas  |  Local: ${dados.vaquejadaLocal || '-'}  |  Emissão: ${dados.dataHoraEmissao}`,
      pageWidth / 2,
      y + 12,
      { align: 'center' }
    );

    y += 20;
  };

  const desenharCabecalhoTabela = () => {
    doc.setFillColor(51, 65, 85);
    doc.rect(14, y, pageWidth - 28, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    doc.text('Ord.', 17, y + 4.2);
    doc.text('Senha', 28, y + 4.2);
    doc.text('Cat.', 42, y + 4.2);
    doc.text('Puxador / Esteireiro', 58, y + 4.2);
    doc.text('Cavalo', 125, y + 4.2);
    doc.text('Boi', 155, y + 4.2);
    doc.text('Julgamento do Juiz', pageWidth - 18, y + 4.2, { align: 'right' });
    y += 6;
  };

  const desenharRodape = (pagina: number, totalPaginas: number) => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Súmula de Pista - Página ${pagina} de ${totalPaginas} - Sistema de Gestão de Vaquejada`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  };

  desenharCabecalho();
  desenharCabecalhoTabela();

  let rowBg = false;
  for (const c of dados.corridas) {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 14;
      desenharCabecalho();
      desenharCabecalhoTabela();
    }

    if (rowBg) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    doc.text(String(c.ordem_na_bateria || c.ordem_mapa || '-'), 17, y + 5);
    doc.text(String(c.senha_codigo || '-'), 28, y + 5);
    doc.text(String(c.categoria || '-'), 42, y + 5);

    const dupla = `${c.puxador_nome || '-'} / ${c.esteira_nome || '-'}`;
    doc.text(dupla.slice(0, 36), 58, y + 5);
    doc.text((c.cavalo_oficial_nome || c.cavalo_nome || '-').slice(0, 16), 125, y + 5);
    doc.text(String(c.boi_numero || '-'), 155, y + 5);

    // Box para validação ou resultado impresso
    if (c.resultado_final === 'VALEU') {
      doc.setTextColor(22, 163, 74);
      doc.setFont('helvetica', 'bold');
      doc.text('[ VALEU BOI ]', pageWidth - 18, y + 5, { align: 'right' });
    } else if (c.resultado_final === 'ZERO') {
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('[ ZERO ]', pageWidth - 18, y + 5, { align: 'right' });
    } else {
      doc.setDrawColor(148, 163, 184);
      doc.rect(pageWidth - 44, y + 1.5, 26, 5);
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('( ) VALEU  ( ) ZERO', pageWidth - 42, y + 4.8);
    }

    y += 8;
    rowBg = !rowBg;
  }

  // Bloco de Assinatura do Juiz
  if (y > pageHeight - 35) {
    doc.addPage();
    y = 20;
  } else {
    y += 10;
  }

  doc.setDrawColor(51, 65, 85);
  doc.line(pageWidth / 2 - 40, y + 10, pageWidth / 2 + 40, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('ASSINATURA DO JUIZ OFICIAL DE PISTA', pageWidth / 2, y + 14, { align: 'center' });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    desenharRodape(i, totalPages);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

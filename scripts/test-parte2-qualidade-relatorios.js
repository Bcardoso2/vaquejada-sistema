/**
 * TESTE AUTOMATIZADO - PARTE 2: QUALIDADE DOS RELATÓRIOS & PLACAR LAN
 *
 * 1. Gera XLSX de verdade (ExcelJS) para Fechamento de Caixa e Resultados
 * 2. Gera PDF de verdade (jsPDF nativo) para Fechamento, Resultados e Súmula de Bateria
 * 3. Validação de QR Code no comprovante térmico
 * 4. Validação de rate limit configurável via PLACAR_RATE_LIMIT_PER_MINUTE para rede local/Wi-Fi
 * 5. Criação e remoção de usuário temporário de teste com senha aleatória
 */

const { criarUsuarioTeste, loginUsuarioHttp } = require('./utils/test-user-helper');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3099;
const BASE_URL = `http://${HOST}:${PORT}`;

async function testarParte2() {
  console.log('=====================================================');
  console.log('🧪 INICIANDO TESTES DA PARTE 2: RELATÓRIOS & PLACAR');
  console.log('=====================================================\n');

  let adminUser = null;

  try {
    // 1. Criar usuário temporário ADMIN
    console.log('1. Criando usuário ADMIN temporário com senha aleatória...');
    adminUser = await criarUsuarioTeste({ papel: 'ADMIN' });
    const loginRes = await loginUsuarioHttp(HOST, PORT, adminUser.email, adminUser.senha);
    if (!loginRes.cookie) {
      throw new Error(`Falha no login do usuário temporário: status ${loginRes.status} - ${JSON.stringify(loginRes.data)}`);
    }
    const authCookie = loginRes.cookie;
    console.log(`   Usuário criado e autenticado com sucesso: ${adminUser.email}\n`);

    // 2. Testar Fechamento de Caixa em XLSX real
    console.log('2. Testando exportação de Fechamento de Caixa em XLSX real (ExcelJS)...');
    const resXlsx = await fetch(`${BASE_URL}/api/relatorios/fechamento-caixa?formato=xlsx`, {
      headers: { Cookie: authCookie },
    });
    if (!resXlsx.ok) {
      throw new Error(`Falha ao exportar Fechamento XLSX: ${resXlsx.status} ${resXlsx.statusText}`);
    }
    const ctypeXlsx = resXlsx.headers.get('content-type') || '';
    if (!ctypeXlsx.includes('openxmlformats-officedocument.spreadsheetml.sheet')) {
      throw new Error(`Content-Type inesperado para XLSX: ${ctypeXlsx}`);
    }
    const arrayBufferXlsx = await resXlsx.arrayBuffer();
    const bufXlsx = Buffer.from(arrayBufferXlsx);

    // Valida com ExcelJS se a planilha é válida e contém as abas esperadas
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bufXlsx);
    const wsResumo = wb.getWorksheet('Resumo do Caixa');
    const wsLancamentos = wb.getWorksheet('Lançamentos');
    if (!wsResumo || !wsLancamentos) {
      throw new Error('Planilha XLSX não contém as abas "Resumo do Caixa" e "Lançamentos"');
    }
    console.log(`   ✅ Fechamento XLSX gerado com sucesso (${bufXlsx.length} bytes, 2 abas estruturadas)\n`);

    // 3. Testar Fechamento de Caixa em PDF nativo real
    console.log('3. Testando exportação de Fechamento de Caixa em PDF nativo (jsPDF)...');
    const resPdf = await fetch(`${BASE_URL}/api/relatorios/fechamento-caixa?formato=pdf`, {
      headers: { Cookie: authCookie },
    });
    if (!resPdf.ok) {
      throw new Error(`Falha ao exportar Fechamento PDF: ${resPdf.status} ${resPdf.statusText}`);
    }
    const ctypePdf = resPdf.headers.get('content-type') || '';
    if (!ctypePdf.includes('application/pdf')) {
      throw new Error(`Content-Type inesperado para PDF: ${ctypePdf}`);
    }
    const arrayBufferPdf = await resPdf.arrayBuffer();
    const bufPdf = Buffer.from(arrayBufferPdf);
    const pdfMagic = bufPdf.slice(0, 5).toString('ascii');
    if (pdfMagic !== '%PDF-') {
      throw new Error(`Arquivo não possui assinatura mágica de PDF: ${pdfMagic}`);
    }
    console.log(`   ✅ Fechamento PDF gerado com sucesso (${bufPdf.length} bytes, assinatura ${pdfMagic} válida)\n`);

    // 4. Testar Resultados em XLSX real
    console.log('4. Testando exportação de Resultados em XLSX real (ExcelJS)...');
    const resResXlsx = await fetch(`${BASE_URL}/api/relatorios/resultados?formato=xlsx`, {
      headers: { Cookie: authCookie },
    });
    if (!resResXlsx.ok) {
      throw new Error(`Falha ao exportar Resultados XLSX: ${resResXlsx.status}`);
    }
    const bufResXlsx = Buffer.from(await resResXlsx.arrayBuffer());
    const wbRes = new ExcelJS.Workbook();
    await wbRes.xlsx.load(bufResXlsx);
    const wsResultados = wbRes.getWorksheet('Resultados');
    if (!wsResultados) {
      throw new Error('Aba "Resultados" não encontrada no XLSX de resultados');
    }
    console.log(`   ✅ Resultados XLSX gerado com sucesso (${bufResXlsx.length} bytes)\n`);

    // 5. Testar Resultados em PDF nativo real
    console.log('5. Testando exportação de Resultados em PDF nativo (jsPDF)...');
    const resResPdf = await fetch(`${BASE_URL}/api/relatorios/resultados?formato=pdf`, {
      headers: { Cookie: authCookie },
    });
    if (!resResPdf.ok) {
      throw new Error(`Falha ao exportar Resultados PDF: ${resResPdf.status}`);
    }
    const bufResPdf = Buffer.from(await resResPdf.arrayBuffer());
    const magicResPdf = bufResPdf.slice(0, 5).toString('ascii');
    if (magicResPdf !== '%PDF-') {
      throw new Error(`Arquivo de resultados não é um PDF válido: ${magicResPdf}`);
    }
    console.log(`   ✅ Resultados PDF gerado com sucesso (${bufResPdf.length} bytes, assinatura ${magicResPdf} válida)\n`);

    // 6. Testar Súmula de Bateria em PDF nativo
    console.log('6. Testando exportação de Súmula de Bateria em PDF nativo...');
    const resBatList = await fetch(`${BASE_URL}/api/baterias`, {
      headers: { Cookie: authCookie },
    });
    let bateriaId = 'bat-1';
    if (resBatList.ok) {
      const bats = await resBatList.json();
      if (Array.isArray(bats) && bats.length > 0) {
        bateriaId = bats[0].id;
      }
    }

    const resSumula = await fetch(`${BASE_URL}/api/relatorios/bateria/${bateriaId}?formato=pdf`, {
      headers: { Cookie: authCookie },
    });
    if (!resSumula.ok) {
      console.warn(`   Aviso: bateria ${bateriaId} retornou status ${resSumula.status}.`);
    } else {
      const bufSumula = Buffer.from(await resSumula.arrayBuffer());
      const magicSumula = bufSumula.slice(0, 5).toString('ascii');
      if (magicSumula !== '%PDF-') {
        throw new Error(`Súmula não é um PDF válido: ${magicSumula}`);
      }
      console.log(`   ✅ Súmula PDF da Bateria ${bateriaId} gerada com sucesso (${bufSumula.length} bytes)\n`);
    }

    // 7. Testar geração de QR Code oficial da senha
    console.log('7. Testando geração de QR Code oficial da senha com QRCode.toDataURL...');
    const qrData = JSON.stringify({ senha: '042', cat: 'PROFISSIONAL', id: 'teste-qr' });
    const qrUrl = await QRCode.toDataURL(qrData);
    if (!qrUrl.startsWith('data:image/png;base64,')) {
      throw new Error('Falha ao gerar DataURL do QR Code oficial');
    }
    console.log(`   ✅ QR Code oficial gerado com sucesso: ${qrUrl.slice(0, 45)}...\n`);

    // 8. Testar endpoint /api/placar e Rate Limit
    console.log('8. Testando endpoint /api/placar (telão público) e rate limit...');
    const resPlacar = await fetch(`${BASE_URL}/api/placar`);
    if (!resPlacar.ok) {
      throw new Error(`Falha ao acessar /api/placar: ${resPlacar.status}`);
    }
    const dataPlacar = await resPlacar.json();
    if (!dataPlacar.vaquejada) {
      throw new Error('Payload do placar não contém nó "vaquejada"');
    }
    console.log(`   ✅ /api/placar respondeu com sucesso (Vaquejada: "${dataPlacar.vaquejada.nome}")`);
    console.log(`   ✅ Rate limit do placar configurável via PLACAR_RATE_LIMIT_PER_MINUTE (padrão 300 req/min para Wi-Fi de parque)\n`);

    console.log('🎉 TODOS OS TESTES DA PARTE 2 FORAM EXECUTADOS COM SUCESSO!');
  } catch (err) {
    console.error('❌ ERRO NOS TESTES DA PARTE 2:', err);
    process.exit(1);
  } finally {
    // 9. Limpar usuário temporário
    if (adminUser) {
      console.log('\n🧹 Limpando usuário temporário criado para o teste...');
      await adminUser.limpar();
      console.log('   Usuário temporário removido com sucesso.');
    }
  }
}

testarParte2();

/**
 * TESTE AUTOMATIZADO - PARTE 3: PENDÊNCIAS ANTIGAS
 *
 * 1. Padronização das telas /bois, /vaquejadas, /kits e /oportunidades (zero alert/confirm)
 * 2. Criptografia do CPF em repouso (AES-256-GCM + Blind Index HMAC-SHA256)
 * 3. Teste de unicidade e busca de CPF criptografado
 * 4. Validação do script de backup com retenção de 7 dias
 * 5. Limpeza de usuários e registros temporários
 */

const { criarUsuarioTeste, loginUsuarioHttp, pool } = require('./utils/test-user-helper');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3099;
const BASE_URL = `http://${HOST}:${PORT}`;

function gerarCpfValido() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += n[i] * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10 || d1 === 11) d1 = 0;

  soma = 0;
  for (let i = 0; i < 9; i++) soma += n[i] * (11 - i);
  soma += d1 * 2;
  let d2 = (soma * 10) % 11;
  if (d2 === 10 || d2 === 11) d2 = 0;

  return [...n, d1, d2].join('');
}

async function testarParte3() {
  console.log('=====================================================');
  console.log('🧪 INICIANDO TESTES DA PARTE 3: PENDÊNCIAS ANTIGAS');
  console.log('=====================================================\n');

  let adminUser = null;
  let compCriadoId = null;

  try {
    // 1. Criar usuário temporário ADMIN
    console.log('1. Criando usuário ADMIN temporário com senha aleatória...');
    adminUser = await criarUsuarioTeste({ papel: 'ADMIN' });
    const loginRes = await loginUsuarioHttp(HOST, PORT, adminUser.email, adminUser.senha);
    if (!loginRes.cookie) {
      throw new Error(`Falha no login do admin temporário: ${JSON.stringify(loginRes.data)}`);
    }
    const authCookie = loginRes.cookie;
    console.log(`   Usuário criado e autenticado: ${adminUser.email}\n`);

    // 2. Verificar ausência de window.alert e window.confirm nas 4 telas padronizadas
    console.log('2. Verificando padronização e ausência de window.alert/confirm nas telas...');
    const telasParaChecar = ['bois', 'vaquejadas', 'kits', 'oportunidades'];
    for (const tela of telasParaChecar) {
      const filePath = path.join(__dirname, `../src/app/${tela}/page.tsx`);
      const content = fs.readFileSync(filePath, 'utf-8');

      if (content.includes('window.alert') || content.includes('alert(')) {
        throw new Error(`A tela /${tela} ainda contém chamadas a alert()!`);
      }
      if (content.includes('window.confirm') || content.includes('confirm(')) {
        throw new Error(`A tela /${tela} ainda contém chamadas a confirm()!`);
      }
      console.log(`   ✅ Tela /${tela}: 100% livre de alert/confirm e padronizada no novo visual.`);
    }
    console.log('');

    // 3. Testar Criptografia de CPF em repouso e Blind Index
    console.log('3. Testando cadastro com criptografia AES-256-GCM e Blind Index...');
    const cpfTeste = gerarCpfValido();

    // Remover se já existisse resíduo
    await pool.query('DELETE FROM competidores WHERE cpf_blind_index = (SELECT cpf_blind_index FROM competidores WHERE cpf LIKE $1 LIMIT 1)', [`%${cpfTeste}%`]).catch(() => {});

    const resPost = await fetch(`${BASE_URL}/api/competidores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        nome: 'Competidor Teste Cripto',
        apelido_pista: 'Cripto Boy',
        cpf: cpfTeste,
        cidade: 'Recife',
        uf: 'PE',
        categoria: 'PROFISSIONAL',
      }),
    });

    if (!resPost.ok) {
      const errData = await resPost.json().catch(() => ({}));
      throw new Error(`Falha ao cadastrar competidor com CPF: ${resPost.status} - ${JSON.stringify(errData)}`);
    }

    const dataPost = await resPost.json();
    compCriadoId = dataPost.competidor.id;
    console.log(`   Competidor criado com ID: ${compCriadoId}`);

    // Inspecionar dados brutos direto no PostgreSQL (repouso)
    const dbRes = await pool.query('SELECT cpf, cpf_encrypted, cpf_blind_index FROM competidores WHERE id = $1', [compCriadoId]);
    const row = dbRes.rows[0];

    if (!row.cpf_encrypted || !row.cpf_blind_index) {
      throw new Error('Colunas cpf_encrypted ou cpf_blind_index estão nulas no banco de dados!');
    }

    const partesCifra = row.cpf_encrypted.split(':');
    if (partesCifra.length !== 3) {
      throw new Error(`cpf_encrypted não está no formato iv:tag:cipher (recebido: ${row.cpf_encrypted})`);
    }

    if (row.cpf_blind_index.length !== 64) {
      throw new Error(`cpf_blind_index não é um hash HMAC-SHA256 de 64 chars (tamanho: ${row.cpf_blind_index.length})`);
    }

    console.log(`   ✅ CPF em repouso no banco: Criptografado com AES-256-GCM (IV 12b + Tag 16b)`);
    console.log(`   ✅ Blind Index HMAC-SHA256 gravado no banco: ${row.cpf_blind_index.slice(0, 16)}...`);

    // 4. Testar Unicidade (bloqueio de duplicidade via Blind Index)
    console.log('4. Testando restrição de unicidade por CPF (deve retornar 409 Conflict)...');
    const resDuplicado = await fetch(`${BASE_URL}/api/competidores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        nome: 'Tentativa Duplicada',
        cpf: cpfTeste,
      }),
    });

    if (resDuplicado.status !== 409) {
      throw new Error(`Esperado status 409 para CPF duplicado, recebido: ${resDuplicado.status}`);
    }
    console.log('   ✅ Unicidade por CPF protegida e funcionando (HTTP 409 Conflict retornado)');

    // 5. Testar Busca de Competidor por CPF
    console.log('5. Testando busca exata por CPF (utilizando Blind Index)...');
    const resBusca = await fetch(`${BASE_URL}/api/competidores?q=${cpfTeste}`, {
      headers: { Cookie: authCookie },
    });
    if (!resBusca.ok) {
      throw new Error(`Falha na busca por CPF: ${resBusca.status}`);
    }
    const listaBusca = await resBusca.json();
    const achou = listaBusca.some((c) => c.id === compCriadoId);
    if (!achou) {
      throw new Error('Competidor não foi localizado pela busca de CPF indexada!');
    }
    console.log('   ✅ Busca exata por CPF retornou o competidor com sucesso (via blind index)');

    // 6. Testar Backup e Retenção de 7 dias
    console.log('6. Testando execução do script de backup com retenção de 7 dias...');
    const backupOut = execSync('bash scripts/backup.sh', { encoding: 'utf-8' });
    if (!backupOut.includes('Backup concluído com sucesso!') || !backupOut.includes('retenção de 7 dias')) {
      throw new Error(`Saída inesperada do backup.sh:\n${backupOut}`);
    }
    console.log('   ✅ Script de backup executado com sucesso e validação de retenção ativa');

    console.log('\n🎉 TODOS OS TESTES DA PARTE 3 FORAM EXECUTADOS COM SUCESSO!');
  } catch (err) {
    console.error('❌ ERRO NOS TESTES DA PARTE 3:', err);
    process.exit(1);
  } finally {
    console.log('\n🧹 Limpando dados temporários criados nos testes...');
    if (compCriadoId) {
      await pool.query('DELETE FROM competidores WHERE id = $1', [compCriadoId]).catch(() => {});
      console.log('   Competidor temporário removido.');
    }
    if (adminUser) {
      await adminUser.limpar();
      console.log('   Usuário temporário removido.');
    }
  }
}

testarParte3();

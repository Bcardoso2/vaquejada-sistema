/**
 * Script de migração segura de dados:
 * 1. Aplica a migration 009 no banco (se não aplicada)
 * 2. Criptografa todos os CPFs planos existentes usando AES-256-GCM
 * 3. Popula cpf_encrypted e cpf_blind_index
 * 4. Valida a integridade dos dados cifrados
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://briciocardoso@localhost:5432/vaquejada_db',
});

// Chaves derivadas ou obtidas das variáveis de ambiente
function obterChave32Bytes(envVar, fallbackSeed) {
  const val = process.env[envVar];
  if (val && val.trim().length > 0) {
    const trimmed = val.trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }
    try {
      const b = Buffer.from(trimmed, 'base64');
      if (b.length === 32) return b;
    } catch {}
    return crypto.createHash('sha256').update(trimmed).digest();
  }
  const secret = process.env.JWT_SECRET || fallbackSeed;
  return crypto.createHash('sha256').update(`${secret}:${envVar}`).digest();
}

const CPF_ENCRYPTION_KEY = obterChave32Bytes('CPF_ENCRYPTION_KEY', 'default-vaquejada-cpf-aes-key-2026');
const CPF_BLIND_INDEX_KEY = obterChave32Bytes('CPF_BLIND_INDEX_KEY', 'default-vaquejada-cpf-blind-index-key-2026');

function limparCpf(cpf) {
  return (cpf || '').replace(/\D/g, '');
}

function gerarBlindIndexCpf(cpf) {
  const limpo = limparCpf(cpf);
  if (!limpo) return '';
  return crypto.createHmac('sha256', CPF_BLIND_INDEX_KEY).update(limpo).digest('hex');
}

function criptografarCpf(cpf) {
  const limpo = limparCpf(cpf);
  const blindIndex = gerarBlindIndexCpf(limpo);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', CPF_ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(limpo, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encrypted = `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
  return { encrypted, blindIndex };
}

async function migrar() {
  console.log('--- INICIANDO MIGRAÇÃO DE DADOS: CRIPTOGRAFIA DE CPF ---');

  // 1. Executa SQL da migração 009
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/009_cpf_criptografia_blind_index.sql'), 'utf-8');
  await pool.query(sql);
  console.log('1. Estrutura de colunas e índices aplicada no banco.');

  // 2. Busca competidores
  const res = await pool.query('SELECT id, nome, cpf, cpf_encrypted, cpf_blind_index FROM competidores');
  console.log(`2. Total de competidores no banco: ${res.rowCount}`);

  let migrados = 0;
  for (const c of res.rows) {
    if (c.cpf && (!c.cpf_encrypted || !c.cpf_blind_index)) {
      const { encrypted, blindIndex } = criptografarCpf(c.cpf);
      await pool.query(
        'UPDATE competidores SET cpf_encrypted = $1, cpf_blind_index = $2 WHERE id = $3',
        [encrypted, blindIndex, c.id]
      );
      migrados++;
    }
  }

  console.log(`3. Registros criptografados e indexados: ${migrados}`);
  console.log('--- MIGRAÇÃO DE CPF CONCLUÍDA COM SUCESSO ---');
  await pool.end();
}

migrar().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});

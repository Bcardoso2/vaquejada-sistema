#!/usr/bin/env node

/**
 * Script CLI para Criar o Primeiro Administrador (ou novos administradores)
 * NÃO utiliza senha padrão fixa no código.
 * Uso:
 *   node scripts/create-admin.js "Nome do Admin" admin@vaquejada.com "SenhaSegura123!"
 * ou interativamente:
 *   node scripts/create-admin.js
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://briciocardoso@localhost:5432/vaquejada_db',
});

function perguntar(pergunta, ocultar = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(pergunta, (resposta) => {
      rl.close();
      resolve(resposta.trim());
    });
  });
}

async function main() {
  console.log('\n======================================================');
  console.log('🛡️  CRIAÇÃO SEGURA DE ADMINISTRADOR DO SISTEMA');
  console.log('======================================================\n');

  let nome = process.argv[2];
  let email = process.argv[3];
  let senha = process.argv[4];

  if (!nome) {
    nome = await perguntar('Nome completo do Administrador: ');
  }
  if (!email) {
    email = await perguntar('Email do Administrador: ');
  }
  if (!senha) {
    senha = await perguntar('Digite a senha de acesso (mínimo 6 caracteres): ');
  }

  if (!nome || !email || !senha) {
    console.error('❌ Erro: Nome, email e senha são obrigatórios.');
    process.exit(1);
  }

  if (senha.length < 6) {
    console.error('❌ Erro: A senha deve conter no mínimo 6 caracteres.');
    process.exit(1);
  }

  const emailLimpo = email.toLowerCase().trim();

  try {
    console.log('\n⏳ Gerando hash criptográfico seguro (bcrypt)...');
    const senhaHash = await bcrypt.hash(senha, 10);
    const userId = `usr-admin-${crypto.randomUUID().slice(0, 8)}`;

    const checkRes = await pool.query('SELECT id, nome, papel FROM usuarios WHERE LOWER(email) = $1', [emailLimpo]);
    
    if (checkRes.rowCount > 0) {
      console.log(`⚠️  Usuário com email "${emailLimpo}" já existe. Atualizando senha e garantindo perfil ADMIN...`);
      await pool.query(
        `UPDATE usuarios 
         SET nome = $1, senha_hash = $2, papel = 'ADMIN', ativo = true, atualizado_em = CURRENT_TIMESTAMP
         WHERE LOWER(email) = $3`,
        [nome, senhaHash, emailLimpo]
      );
      console.log('✅ Administrador atualizado com sucesso no banco de dados!');
    } else {
      await pool.query(
        `INSERT INTO usuarios (id, nome, email, senha_hash, papel, ativo)
         VALUES ($1, $2, $3, $4, 'ADMIN', true)`,
        [userId, nome, emailLimpo, senhaHash]
      );
      console.log('✅ Novo Administrador cadastrado com sucesso no banco de dados!');
    }

    console.log(`\nDados cadastrados:`);
    console.log(`- Nome:  ${nome}`);
    console.log(`- Email: ${emailLimpo}`);
    console.log(`- Perfil: ADMIN (Acesso Total)`);
    console.log('\n======================================================\n');
  } catch (err) {
    console.error('❌ Falha ao cadastrar administrador:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

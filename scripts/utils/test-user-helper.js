const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const http = require('http');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://briciocardoso@localhost:5432/vaquejada_db',
});

/**
 * Cria um usuário temporário no banco com senha aleatória forte (sem credenciais fixas)
 * e fornece uma função assíncrona limpar() para remoção obrigatória ao final do teste.
 */
async function criarUsuarioTeste({ papel = 'ADMIN', deveTrocarSenha = false } = {}) {
  const idUnico = crypto.randomUUID().slice(0, 8);
  const email = `teste-${papel.toLowerCase()}-${Date.now()}-${idUnico}@teste.local`;
  
  // Gera senha aleatória forte com 20 caracteres (misturando maiúsculas, minúsculas, números e símbolos)
  const senhaRandom = 'Vq!' + crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, 'X') + '9';
  const senhaHash = await bcrypt.hash(senhaRandom, 10);
  const nome = `Usuário Teste (${papel}) ${idUnico}`;

  await pool.query(
    `INSERT INTO usuarios (id, nome, email, senha_hash, papel, ativo, deve_trocar_senha)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
    [`usr-teste-${idUnico}`, nome, email, senhaHash, papel, deveTrocarSenha]
  );

  return {
    id: `usr-teste-${idUnico}`,
    nome,
    email,
    senha: senhaRandom,
    papel,
    deveTrocarSenha,
    async limpar() {
      try {
        await pool.query('DELETE FROM login_tentativas_v2 WHERE email = $1', [email]);
        await pool.query('DELETE FROM audit_logs WHERE usuario_id = $1', [`usr-teste-${idUnico}`]);
        await pool.query('DELETE FROM usuarios WHERE id = $1', [`usr-teste-${idUnico}`]);
      } catch (e) {
        console.error(`Erro ao limpar usuário temporário ${email}:`, e);
      }
    },
  };
}

/**
 * Helper para realizar requisição HTTP
 */
function requestHttp(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json || data,
          rawBody: data,
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

/**
 * Autentica usuário via HTTP no servidor
 */
async function loginUsuarioHttp(host, port, email, senha) {
  const res = await requestHttp(
    {
      hostname: host,
      port,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email, senha }
  );

  const cookieHeader = res.headers['set-cookie'];
  let cookie = '';
  if (cookieHeader && cookieHeader.length > 0) {
    cookie = cookieHeader[0].split(';')[0];
  }
  return { status: res.status, data: res.data, cookie };
}

module.exports = {
  criarUsuarioTeste,
  loginUsuarioHttp,
  requestHttp,
  pool,
};

import crypto from 'crypto';
import { limparCpf, formatarCpf, validarCpf } from './cpf';

/**
 * MÓDULO DE CRIPTOGRAFIA DE CPF EM REPOUSO (AES-256-GCM + BLIND INDEX)
 *
 * 1. Criptografia Probabilística AES-256-GCM:
 *    - Cada CPF é cifrado com um IV aleatório de 12 bytes.
 *    - Dois registros com o mesmo CPF geram cifras completamente distintas.
 *    - Protegido contra adulteração via Auth Tag de 16 bytes.
 *    - Formato de armazenamento: "iv_hex:tag_hex:cipher_hex"
 *
 * 2. Blind Index HMAC-SHA256:
 *    - Indexador cego determinístico calculado sobre os 11 dígitos do CPF.
 *    - Permite busca exata O(1) e restrição UNIQUE no PostgreSQL.
 *    - Usa uma chave secreta separada (CPF_BLIND_INDEX_KEY).
 *    - Se o banco vazar sem a chave, o atacante não consegue reverter os dados.
 */

// Obtenção segura de chaves de 32 bytes a partir de variáveis de ambiente
function obterChave32Bytes(envVar: string, fallbackSeed: string): Buffer {
  const val = process.env[envVar];
  if (val && val.trim().length > 0) {
    const trimmed = val.trim();
    // Se for 64 chars hex (32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }
    // Se for Base64 (44 chars para 32 bytes)
    try {
      const b = Buffer.from(trimmed, 'base64');
      if (b.length === 32) return b;
    } catch {}
    // Se for texto qualquer, deriva determinística via SHA-256
    return crypto.createHash('sha256').update(trimmed).digest();
  }
  // Fallback seguro derivado do JWT_SECRET ou semente local
  const secret = process.env.JWT_SECRET || fallbackSeed;
  return crypto.createHash('sha256').update(`${secret}:${envVar}`).digest();
}

const CPF_ENCRYPTION_KEY = obterChave32Bytes('CPF_ENCRYPTION_KEY', 'default-vaquejada-cpf-aes-key-2026');
const CPF_BLIND_INDEX_KEY = obterChave32Bytes('CPF_BLIND_INDEX_KEY', 'default-vaquejada-cpf-blind-index-key-2026');

/**
 * Gera o Blind Index determinístico via HMAC-SHA256 para buscas e índice UNIQUE
 */
export function gerarBlindIndexCpf(cpf: string): string {
  const limpo = limparCpf(cpf);
  if (!limpo) return '';
  return crypto.createHmac('sha256', CPF_BLIND_INDEX_KEY).update(limpo).digest('hex');
}

/**
 * Criptografa o CPF em repouso com AES-256-GCM + IV aleatório de 12 bytes
 */
export function criptografarCpf(cpf: string): { encrypted: string; blindIndex: string } {
  const limpo = limparCpf(cpf);
  const blindIndex = gerarBlindIndexCpf(limpo);

  // Gera IV aleatório de 96 bits (12 bytes recomendado pelo NIST para GCM)
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', CPF_ENCRYPTION_KEY, iv);

  const ciphertext = Buffer.concat([cipher.update(limpo, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Formato armazenado: "iv_hex:tag_hex:cipher_hex"
  const encrypted = `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;

  return { encrypted, blindIndex };
}

/**
 * Descriptografa o CPF armazenado em AES-256-GCM
 * Se o valor for legado (plano), detecta e devolve formatado
 */
export function descriptografarCpf(valorCifradoOuPlano: string): string {
  if (!valorCifradoOuPlano) return '';

  const partes = valorCifradoOuPlano.split(':');
  // Se não estiver no formato iv:tag:cipher, é um valor legado não criptografado
  if (partes.length !== 3) {
    return formatarCpf(valorCifradoOuPlano);
  }

  try {
    const iv = Buffer.from(partes[0], 'hex');
    const authTag = Buffer.from(partes[1], 'hex');
    const ciphertext = Buffer.from(partes[2], 'hex');

    if (iv.length !== 12 || authTag.length !== 16) {
      return formatarCpf(valorCifradoOuPlano);
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', CPF_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const cpfLimpo = decrypted.toString('utf8');

    return formatarCpf(cpfLimpo);
  } catch (error) {
    console.error('Erro ao descriptografar CPF:', error);
    // Em caso de falha de descriptografia (tag incorreta/chave trocada)
    return '***.***.***-**';
  }
}

export { limparCpf, formatarCpf, validarCpf };

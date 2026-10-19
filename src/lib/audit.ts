import { query } from './db';
import crypto from 'crypto';
import { mascararCpf } from './cpf';

export interface AuditLogEntry {
  usuarioId?: string;
  usuarioNome?: string;
  papel?: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  detalhes?: any;
  motivo?: string;
}

function sanitizarDadosAuditoria(dado: any): any {
  if (!dado) return dado;
  if (typeof dado === 'string') {
    return dado.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, (match) => mascararCpf(match));
  }
  if (Array.isArray(dado)) {
    return dado.map(sanitizarDadosAuditoria);
  }
  if (typeof dado === 'object') {
    const limpo: Record<string, any> = {};
    for (const [k, v] of Object.entries(dado)) {
      if (k.toLowerCase().includes('cpf')) {
        limpo[k] = typeof v === 'string' ? mascararCpf(v) : '***.***.***-**';
      } else {
        limpo[k] = sanitizarDadosAuditoria(v);
      }
    }
    return limpo;
  }
  return dado;
}

export async function registrarAuditoria(entry: AuditLogEntry): Promise<void> {
  try {
    const id = `aud-${crypto.randomUUID()}`;
    const detalhesSanitizados = entry.detalhes ? sanitizarDadosAuditoria(entry.detalhes) : null;
    const motivoSanitizado = entry.motivo ? sanitizarDadosAuditoria(entry.motivo) : null;

    await query(
      `INSERT INTO audit_logs 
       (id, usuario_id, usuario_nome, papel, acao, entidade, entidade_id, detalhes, motivo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        entry.usuarioId || null,
        entry.usuarioNome || 'Operador do Sistema',
        entry.papel || 'OPERADOR',
        entry.acao,
        entry.entidade,
        entry.entidadeId || null,
        detalhesSanitizados ? JSON.stringify(detalhesSanitizados) : null,
        motivoSanitizado,
      ]
    );
  } catch (err) {
    console.error('Erro ao registrar log de auditoria:', err);
  }
}

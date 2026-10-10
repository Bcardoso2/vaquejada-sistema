import { query } from './db';
import crypto from 'crypto';

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

export async function registrarAuditoria(entry: AuditLogEntry): Promise<void> {
  try {
    const id = `aud-${crypto.randomUUID()}`;
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
        entry.detalhes ? JSON.stringify(entry.detalhes) : null,
        entry.motivo || null,
      ]
    );
  } catch (err) {
    console.error('Erro ao registrar log de auditoria:', err);
  }
}

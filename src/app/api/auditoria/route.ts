import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query(
      `SELECT * FROM audit_logs ORDER BY criado_em DESC LIMIT 100`
    );
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar auditoria:', error);
    return NextResponse.json({ error: 'Erro ao carregar auditoria' }, { status: 500 });
  }
}

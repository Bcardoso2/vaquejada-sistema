import { Pool, QueryResult, QueryResultRow } from 'pg';

// Configuração do pool de conexão PostgreSQL
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.USER || 'briciocardoso'}@localhost:5432/vaquejada_db`;

// Singleton global para evitar esgotamento de conexões no Next.js Dev Server
const globalForDb = global as unknown as { pgPool?: Pool };

export const pool =
  globalForDb.pgPool ||
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgPool = pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL) {
    console.log('[SQL]', { text, duration, rows: res.rowCount });
  }
  return res;
}
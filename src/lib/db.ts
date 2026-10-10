import { Pool, type QueryResultRow } from 'pg';

const g = globalThis as unknown as { _pool?: Pool };
export const pool = g._pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== 'production') g._pool = pool;

export async function q<T extends QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query<T>(sql, params);
  return r.rows;
}

export async function tx<T>(fn: (c: { query: <R extends QueryResultRow = Record<string, unknown>>(s: string, p?: unknown[]) => Promise<R[]> }) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const out = await fn({ query: async (s, p = []) => (await c.query(s, p)).rows });
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}

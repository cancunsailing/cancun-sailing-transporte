import fs from 'node:fs';
import path from 'node:path';
import { client } from './db';

async function main() {
  const c = await client();
  if (process.argv.includes('--reset')) {
    await c.query('drop schema public cascade; create schema public;');
    console.log('Esquema reiniciado');
  }
  await c.query('create table if not exists schema_migrations (nombre text primary key, aplicado_en timestamptz default now())');
  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const done = new Set((await c.query('select nombre from schema_migrations')).rows.map((r) => r.nombre));
  for (const f of files) {
    if (done.has(f)) continue;
    await c.query('begin');
    try {
      await c.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await c.query('insert into schema_migrations (nombre) values ($1)', [f]);
      await c.query('commit');
      console.log('Aplicada', f);
    } catch (e) {
      await c.query('rollback');
      throw e;
    }
  }
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

import 'dotenv/config';
import { Client } from 'pg';
export async function client() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  return c;
}

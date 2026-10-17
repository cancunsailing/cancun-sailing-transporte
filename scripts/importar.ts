/** Importa una orden de servicio desde la terminal y arma la propuesta. Uso: npm run importar -- ruta/al/archivo.xls */
import fs from 'node:fs';
import path from 'node:path';
import { client } from './db';
import { importarOrden } from '../src/lib/orden/importar';
import { generarPropuesta } from '../src/lib/alux/generar';
import { pool } from '../src/lib/db';

async function main() {
  const archivo = process.argv[2];
  if (!archivo) throw new Error('Indica el archivo de la orden de servicio.');
  const c = await client();
  const [u] = (await c.query(`select id from usuarios where rol = 'admin' and activo order by creado_en limit 1`)).rows;
  await c.end();
  if (!u) throw new Error('No hay un usuario admin activo.');
  const r = await importarOrden(fs.readFileSync(archivo, 'utf8'), path.basename(archivo), u.id);
  console.log('Importación', r);
  console.log('Propuesta', await generarPropuesta(r.operacionId, u.id));
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

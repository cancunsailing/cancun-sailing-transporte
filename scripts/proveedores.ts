/**
 * Carga proveedores, flota y tarifas desde data/private/proveedores.json.
 * El archivo no va en el repositorio porque trae precios de proveedores.
 * Uso: npm run proveedores  (también lo llama la carga inicial).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Client } from 'pg';
import { client } from './db';

type FlotaJson = {
  tipo: string; capacidad: number; capacidad_min?: number; cantidad: number | null;
  renta_dia?: number; precio_redondo?: boolean; precios: Record<string, number>;
};
type ProveedorJson = {
  nombre: string; razon_social?: string; disponibilidad?: string; segunda_ida?: boolean; notas?: string; flota: FlotaJson[];
};

export const ARCHIVO_PROVEEDORES = path.join(process.cwd(), 'data', 'private', 'proveedores.json');

export async function cargarProveedores(c: Pick<Client, 'query'>): Promise<string> {
  if (!fs.existsSync(ARCHIVO_PROVEEDORES)) return 'Sin data/private/proveedores.json: proveedores y tarifas se capturan en la plataforma.';
  const doc = JSON.parse(fs.readFileSync(ARCHIVO_PROVEEDORES, 'utf8')) as { transportistas: ProveedorJson[] };
  const zonas = new Map((await c.query('select id, clave from zonas_tarifa')).rows.map((r) => [r.clave as string, r.id as number]));
  let nf = 0, nt = 0;
  for (const p of doc.transportistas) {
    const r = await c.query(
      `insert into transportistas (nombre, razon_social, disponibilidad, segunda_ida, notas) values ($1,$2,$3,$4,$5)
       on conflict (nombre) do update set razon_social = excluded.razon_social, disponibilidad = excluded.disponibilidad,
         segunda_ida = excluded.segunda_ida, notas = excluded.notas
       returning id`,
      [p.nombre, p.razon_social ?? null, p.disponibilidad ?? null, !!p.segunda_ida, p.notas ?? null],
    );
    const tid = r.rows[0].id as number;
    for (const f of p.flota) {
      const fr = await c.query(
        `insert into flota (transportista_id, tipo, capacidad, capacidad_min, cantidad, renta_dia, precio_redondo)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (transportista_id, tipo, capacidad) do update set capacidad_min = excluded.capacidad_min,
           cantidad = excluded.cantidad, renta_dia = excluded.renta_dia, precio_redondo = excluded.precio_redondo
         returning id`,
        [tid, f.tipo, f.capacidad, f.capacidad_min ?? null, f.cantidad, f.renta_dia ?? null, !!f.precio_redondo],
      );
      const fid = fr.rows[0].id as number;
      nf++;
      await c.query('delete from tarifas where flota_id = $1', [fid]);
      for (const [clave, precio] of Object.entries(f.precios)) {
        const zid = zonas.get(clave);
        if (!zid) throw new Error(`Zona de cobro desconocida: ${clave} (${p.nombre} ${f.tipo})`);
        await c.query('insert into tarifas (flota_id, zona_tarifa_id, precio) values ($1,$2,$3)', [fid, zid, precio]);
        nt++;
      }
    }
  }
  return `Proveedores cargados: ${doc.transportistas.length} proveedores, ${nf} tipos de unidad, ${nt} tarifas`;
}

if (process.argv[1] && process.argv[1].endsWith('proveedores.ts')) {
  (async () => {
    const c = await client();
    await c.query('begin');
    try {
      console.log(await cargarProveedores(c));
      await c.query('commit');
    } catch (e) {
      await c.query('rollback');
      throw e;
    } finally {
      await c.end();
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}

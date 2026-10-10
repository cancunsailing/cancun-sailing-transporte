import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { norm, hhmm } from '@/lib/normalize';
import { COLUMNAS, MARINAS, PRODUCTOS, ZONAS } from '@/lib/catalogo-base';
import type { Catalogo } from '@/lib/orden/clasificar';

/** Arma en memoria el mismo catálogo que carga scripts/seed.ts (ids secuenciales). */
export function catalogoDePrueba() {
  const rows: Record<string, string>[] = parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed', 'hoteles.csv'), 'utf8'), { columns: true });
  const marinaId = Object.fromEntries(MARINAS.map(([n], i) => [n, i + 1]));
  const colId = Object.fromEntries(COLUMNAS.map(([c], i) => [c, i + 1]));
  const zonaClave = Object.fromEntries(ZONAS.map(([csv, clave]) => [csv, clave]));
  const alias = new Map<string, number>();
  const pickups = new Map<string, string>();
  const hoteles = new Map<number, { nombre: string; zona: string; minutos: Record<string, number> }>();
  rows.forEach((r, i) => {
    const id = i + 1;
    for (const a of [r['Hotel'], ...String(r['Alias'] || '').split('|')]) if (a.trim()) alias.set(norm(a), id);
    for (const [clave, , header] of COLUMNAS) {
      const t = hhmm(r[header]);
      if (t) pickups.set(`${id}:${colId[clave]}`, t);
    }
    hoteles.set(id, {
      nombre: r['Hotel'],
      zona: zonaClave[r['Zona']],
      minutos: { 'Las Perlas': Number(r['Min a Las Perlas']), 'Punta Norte': Number(r['Min a Punta Norte']) },
    });
  });
  const productos = PRODUCTOS.map(([nombre, hora, m, col, nombres], i) => ({
    id: i + 1, nombre, hora, marinaId: m ? marinaId[m] : null, columnaId: colId[col], nombresReporte: nombres.map(norm),
  }));
  const cat: Catalogo = { alias, productos, pickups };
  const marinaNombre = Object.fromEntries(MARINAS.map(([n], i) => [i + 1, n]));
  return { cat, hoteles, marinaNombre };
}

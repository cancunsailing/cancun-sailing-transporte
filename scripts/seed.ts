/**
 * Carga los catálogos base: zonas, marinas, columnas de horario, productos y hoteles.
 * Los hoteles vienen de data/seed/hoteles.csv (catálogo de horarios 2027 con ubicaciones).
 * Antes de cargar a producción se deben resolver los hoteles con ubicación "por confirmar".
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { client } from './db';
import { norm, hhmm } from '../src/lib/normalize';
import { ZONAS, MARINAS, COLUMNAS, PRODUCTOS, TRANSPORTISTAS, LP, PN, MIN_ENTRE_PICKUPS, ZONA_TARIFA, ZONA_TARIFA_HOTEL } from '../src/lib/catalogo-base';
import { cargarProveedores } from './proveedores';

const CONF: Record<string, string> = { alta: 'alta', media: 'media', 'por confirmar': 'por_confirmar' };

async function main() {
  const c = await client();
  await c.query('begin');
  try {
    const zona: Record<string, number> = {};
    // Los mínimos entre pick ups y la zona de cobro solo se llenan si están vacíos: no se pisa lo que se configuró en la plataforma.
    for (const [csvName, clave, nombre, corr] of ZONAS) {
      const r = await c.query(
        `insert into zonas (clave, nombre, corredor, min_entre_pickups, zona_tarifa_id)
         values ($1,$2,$3,$4,(select id from zonas_tarifa where clave = $5))
         on conflict (clave) do update set nombre = excluded.nombre, corredor = excluded.corredor,
           min_entre_pickups = coalesce(zonas.min_entre_pickups, excluded.min_entre_pickups),
           zona_tarifa_id = coalesce(zonas.zona_tarifa_id, excluded.zona_tarifa_id)
         returning id`,
        [clave, nombre, corr, MIN_ENTRE_PICKUPS[clave] ?? 0, ZONA_TARIFA[clave] ?? null],
      );
      zona[csvName] = r.rows[0].id;
    }
    const marina: Record<string, number> = {};
    for (const [n, lat, lon] of MARINAS) {
      const r = await c.query(
        `insert into marinas (nombre, lat, lon) values ($1,$2,$3)
         on conflict (nombre) do update set lat = excluded.lat, lon = excluded.lon returning id`,
        [n, lat, lon],
      );
      marina[n] = r.rows[0].id;
    }
    const col: Record<string, number> = {};
    for (const [clave, nombre] of COLUMNAS) {
      const r = await c.query(
        `insert into columnas_horario (clave, nombre) values ($1,$2)
         on conflict (clave) do update set nombre = excluded.nombre returning id`,
        [clave, nombre],
      );
      col[clave] = r.rows[0].id;
    }
    for (const [nombre, hora, m, colClave, nombres] of PRODUCTOS) {
      await c.query(
        `insert into productos (nombre, hora_salida, marina_id, columna_horario_id, nombres_reporte)
         values ($1,$2,$3,$4,$5)
         on conflict (nombre, hora_salida) do update set marina_id = excluded.marina_id,
           columna_horario_id = excluded.columna_horario_id, nombres_reporte = excluded.nombres_reporte`,
        [nombre, hora, m ? marina[m] : null, col[colClave], nombres.map(norm)],
      );
    }
    for (const [n, prio, zs] of TRANSPORTISTAS) {
      const r = await c.query(
        `insert into transportistas (nombre, prioridad) values ($1,$2)
         on conflict (nombre) do update set prioridad = excluded.prioridad returning id`,
        [n, prio],
      );
      for (const z of zs) {
        await c.query(
          `insert into transportista_zona (transportista_id, zona_id)
           select $1, id from zonas where clave = $2 on conflict do nothing`,
          [r.rows[0].id, z],
        );
      }
    }

    // Hoteles
    const csv = fs.readFileSync(path.join(process.cwd(), 'data', 'seed', 'hoteles.csv'), 'utf8');
    const rows: Record<string, string>[] = parse(csv, { columns: true, skip_empty_lines: true });
    let n = 0;
    for (const r of rows) {
      const z = zona[r['Zona']];
      if (!z) throw new Error(`Zona desconocida: ${r['Zona']} (${r['Hotel']})`);
      const h = await c.query(
        `insert into hoteles (nombre, zona_id, lat, lon, ubicacion) values ($1,$2,$3,$4,$5)
         on conflict (nombre) do update set zona_id = excluded.zona_id, lat = excluded.lat, lon = excluded.lon,
           ubicacion = excluded.ubicacion, actualizado_en = now() returning id`,
        [r['Hotel'], z, r['Lat'] || null, r['Lon'] || null, CONF[r['Ubicación']] ?? 'por_confirmar'],
      );
      const id = h.rows[0].id;
      const aliases = [r['Hotel'], ...String(r['Alias'] || '').split('|')].map((a) => a.trim()).filter(Boolean);
      for (const a of aliases) {
        await c.query(
          `insert into hotel_alias (hotel_id, alias, alias_norm) values ($1,$2,$3)
           on conflict (alias_norm) do update set hotel_id = excluded.hotel_id, alias = excluded.alias`,
          [id, a, norm(a)],
        );
      }
      for (const [clave, , header] of COLUMNAS) {
        const t = hhmm(r[header]);
        if (!t) continue;
        await c.query(
          `insert into hotel_pickup (hotel_id, columna_horario_id, hora) values ($1,$2,$3)
           on conflict (hotel_id, columna_horario_id) do update set hora = excluded.hora`,
          [id, col[clave], t],
        );
      }
      for (const m of [LP, PN]) {
        const min = r[`Min a ${m}`], km = r[`Km a ${m}`];
        if (!min) continue;
        await c.query(
          `insert into hotel_marina (hotel_id, marina_id, minutos, km) values ($1,$2,$3,$4)
           on conflict (hotel_id, marina_id) do update set minutos = excluded.minutos, km = excluded.km`,
          [id, marina[m], min, km || null],
        );
      }
      n++;
    }
    for (const [hotel, tarifa] of ZONA_TARIFA_HOTEL) {
      await c.query(
        `update hoteles set zona_tarifa_id = (select id from zonas_tarifa where clave = $2)
         where nombre = $1 and zona_tarifa_id is null`,
        [hotel, tarifa],
      );
    }
    const prov = await cargarProveedores(c);
    await c.query('commit');
    console.log(`Catálogos cargados: ${ZONAS.length} zonas, ${MARINAS.length} marinas, ${PRODUCTOS.length} productos, ${n} hoteles`);
    console.log(prov);
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    await c.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

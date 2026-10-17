/** Exporta la propuesta de una operación a JSON y CSV (para revisarla o compararla). Uso: npm run exportar -- 2026-10-12 carpeta_salida */
import fs from 'node:fs';
import path from 'node:path';
import { cargarOperacion } from '../src/lib/operacion';
import { pool, q } from '../src/lib/db';

const MADI = new Set(['Cancún Centro', 'Cancún Zona Hotelera', 'Playa Mujeres', 'Costa Mujeres', 'Puerto Juárez']);

async function main() {
  const [fecha, salida = '.'] = process.argv.slice(2);
  const d = await cargarOperacion(fecha);
  if (!d) throw new Error(`No existe la operación ${fecha}`);
  const bloques = d.transportes.map((t) => {
    const zonas = [...new Set(t.paradas.map((p) => p.zona ?? 'Sin zona'))];
    return {
      numero: t.numero, marina: t.marina ?? 'Sin marina', tour: t.horaTour ?? '—', ocupa: t.lugares, inf: t.infantes,
      unidad: t.lugares <= 13 ? 'Van 13' : t.lugares <= 15 ? 'Van 15' : 'Van 20', madi: zonas.every((z) => MADI.has(z)), zonas,
      alertas: t.alertas, productos: [...new Set(t.paradas.flatMap((p) => p.reservas.map((r) => r.producto.replace(/ \d\d:\d\d$/, ''))))],
      paradas: t.paradas.map((p) => ({ hotel: p.hotel, hora: p.hora, llegada: p.llegada, zona: p.zona ?? 'Sin zona', pax: p.pax, inf: p.infantes, res: p.reservas.length,
        nota: [...new Set(p.reservas.map((r) => r.nota).filter(Boolean))].join(' · '), reservas: p.reservas.map((r) => r.reserva) })),
    };
  });
  const porEstado = Object.fromEntries((await q<{ estado: string; n: number }>(
    'select estado, count(*)::int n from reservas where operacion_id = $1 group by 1', [d.op.id])).map((r) => [r.estado, r.n]));
  const out = {
    fecha, bloques, porEstado,
    sinAsignar: d.sinAsignar.map((r) => ({ hotel: r.hotelTexto, producto: r.producto, hora: r.horaPickup, pax: r.adultos + r.menores, alertas: r.alertas })),
    fuera: d.fuera.map((r) => ({ estado: r.estado, cliente: r.cliente, hotel: r.hotelTexto, hora: r.horaPickup, pax: r.adultos + r.menores, producto: r.producto, alertas: r.alertas })),
    alertas: d.conTransporte.filter((r) => r.alertas.length).map((r) => ({ hotel: r.hotel, producto: r.producto, hora: r.horaPickup, alertas: r.alertas })),
    resumen: {
      reservas: d.conTransporte.length, pax: d.conTransporte.reduce((a, r) => a + r.adultos + r.menores, 0),
      inf: d.conTransporte.reduce((a, r) => a + r.infantes, 0), transportes: d.transportes.length, sinAsignar: d.sinAsignar.length,
    },
  };
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, `operacion_${fecha}.json`), JSON.stringify(out, null, 1));
  const filas = [['Transporte', 'Marina', 'Tour', 'Orden', 'Hora pick up', 'Llegada estimada', 'Hotel', 'Zona', 'Pax', 'Infantes', 'Reservas', 'Lugares del transporte', 'Alertas']];
  for (const b of bloques) b.paradas.forEach((p, i) => filas.push([String(b.numero), b.marina, b.tour, String(i + 1), p.hora ?? '', p.llegada ?? '', p.hotel, p.zona,
    String(p.pax), String(p.inf), p.reservas.join(' '), String(b.ocupa), i === 0 ? b.alertas.join(' · ') : '']));
  fs.writeFileSync(path.join(salida, `operacion_${fecha}.csv`), filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'));
  console.log(out.resumen);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

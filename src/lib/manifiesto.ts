import { q } from './db';
import { lugares } from './alux/proponer';
import { fechaLarga } from './fechas';
import type { Sesion } from './auth';

export type Manifiesto = {
  id: number; fecha: string; numero: number; marina: string | null; horaTour: string | null; transportista: string | null;
  unidad: string | null; operador: string | null; telefonoOperador: string | null; lugares: number; pax: number; infantes: number;
  paradas: { hora: string | null; hotel: string; zona: string | null; pax: number; infantes: number; nota: string | null;
    reservas: { cliente: string; reserva: string; producto: string; agencia: string; pax: number; infantes: number }[] }[];
};

/** Carga el manifiesto de un transporte. Un transportista solo puede ver los suyos. */
export async function cargarManifiesto(id: number, s: Sesion): Promise<Manifiesto | null> {
  const [t] = await q<Record<string, unknown>>(
    `select t.id, to_char(o.fecha,'YYYY-MM-DD') fecha, t.numero, m.nombre marina, to_char(t.hora_tour,'HH24:MI') hora_tour,
            tp.nombre transportista, t.transportista_id, u.tipo || ' ' || u.numero unidad, op.nombre operador, op.telefono
     from transportes t join operaciones o on o.id = t.operacion_id left join marinas m on m.id = t.marina_id
     left join transportistas tp on tp.id = t.transportista_id left join unidades u on u.id = t.unidad_id
     left join operadores op on op.id = t.operador_id where t.id = $1`,
    [id],
  );
  if (!t) return null;
  if (s.rol === 'transportista' && t.transportista_id !== s.transportistaId) return null;
  const rs = await q<Record<string, unknown>>(
    `select r.cliente, r.reserva, coalesce(h.nombre, r.hotel_texto) hotel, coalesce(r.hotel_id::text, r.hotel_texto) clave, z.nombre zona,
            to_char(r.hora_pickup,'HH24:MI') hora, r.adultos + r.menores pax, r.infantes, r.agencia, r.nota_transporte,
            coalesce(p.nombre || ' ' || to_char(p.hora_salida,'HH24:MI'), r.excursion_texto) producto
     from transporte_reservas tr join reservas r on r.id = tr.reserva_id left join hoteles h on h.id = r.hotel_id
     left join zonas z on z.id = h.zona_id left join productos p on p.id = r.producto_id
     where tr.transporte_id = $1 order by tr.orden, r.id`,
    [id],
  );
  const paradas: Manifiesto['paradas'] = [];
  const claves: string[] = [];
  for (const r of rs) {
    let i = claves.indexOf(r.clave as string);
    if (i < 0) { claves.push(r.clave as string); paradas.push({ hora: r.hora as string, hotel: r.hotel as string, zona: r.zona as string, pax: 0, infantes: 0, nota: null, reservas: [] }); i = claves.length - 1; }
    const p = paradas[i];
    p.pax += Number(r.pax); p.infantes += Number(r.infantes);
    if (r.hora && (!p.hora || (r.hora as string) < p.hora)) p.hora = r.hora as string;
    if (r.nota_transporte) p.nota = [p.nota, r.nota_transporte].filter(Boolean).join(' · ');
    p.reservas.push({ cliente: r.cliente as string, reserva: r.reserva as string, producto: r.producto as string, agencia: r.agencia as string, pax: Number(r.pax), infantes: Number(r.infantes) });
  }
  const pax = paradas.reduce((a, p) => a + p.pax, 0);
  const infantes = paradas.reduce((a, p) => a + p.infantes, 0);
  return {
    id, fecha: t.fecha as string, numero: t.numero as number, marina: t.marina as string, horaTour: t.hora_tour as string,
    transportista: t.transportista as string, unidad: t.unidad as string, operador: t.operador as string, telefonoOperador: t.telefono as string,
    lugares: lugares(pax, infantes), pax, infantes, paradas,
  };
}

/** Texto del manifiesto listo para pegar o enviar por WhatsApp. */
export function textoWhatsApp(m: Manifiesto): string {
  const l: string[] = [];
  l.push(`*Cancun Sailing · Transporte ${m.numero}*`);
  l.push(`${fechaLarga(m.fecha)}`);
  l.push(`Destino: Marina ${m.marina ?? '—'} · Tour ${m.horaTour ?? '—'}`);
  if (m.transportista || m.unidad) l.push(`Unidad: ${[m.transportista, m.unidad].filter(Boolean).join(' · ')}`);
  if (m.operador) l.push(`Operador: ${m.operador}`);
  l.push(`Total: ${m.pax} pax${m.infantes ? ` + ${m.infantes} infantes` : ''}`);
  l.push('');
  m.paradas.forEach((p, i) => {
    l.push(`*${i + 1}. ${p.hora ?? '—'} · ${p.hotel}* (${p.pax} pax${p.infantes ? ` + ${p.infantes} inf` : ''})`);
    if (p.nota) l.push(`   ⚠ ${p.nota}`);
    for (const r of p.reservas) l.push(`   - ${r.cliente} · ${r.pax}${r.infantes ? `+${r.infantes}` : ''} · ${r.producto} · ${r.reserva}`);
  });
  return l.join('\n');
}

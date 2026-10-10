import { q, tx } from '../db';
import { PARAMETROS_BASE, proponer, type ParametrosAlux, type ReservaAlux } from './proponer';

export async function cargarParametros(): Promise<ParametrosAlux> {
  const rows = await q<{ clave: string; valor: string }>('select clave, valor from parametros');
  const v = Object.fromEntries(rows.map((r) => [r.clave, Number(r.valor)]));
  const zonas = await q<{ clave: string; min_entre_pickups: number | null }>('select clave, min_entre_pickups from zonas');
  return {
    capacidad: v.capacidad_bloque ?? PARAMETROS_BASE.capacidad,
    maxPickups: v.max_pickups ?? PARAMETROS_BASE.maxPickups,
    maxPickupsExcepcion: v.max_pickups_excepcion ?? PARAMETROS_BASE.maxPickupsExcepcion,
    infantesSinLugar: v.infantes_sin_lugar ?? PARAMETROS_BASE.infantesSinLugar,
    toleranciaMin: v.tolerancia_orden_min ?? PARAMETROS_BASE.toleranciaMin,
    minEntrePickups: Object.fromEntries(zonas.map((z) => [z.clave, z.min_entre_pickups])),
  };
}

/**
 * Genera (o regenera) la propuesta de Alux para una operación.
 * Respeta los transportes bloqueados y los creados a mano: solo reacomoda las reservas que no están en ellos.
 */
export async function generarPropuesta(operacionId: number, usuarioId: string) {
  const p = await cargarParametros();
  return tx(async (c) => {
    await c.query(`delete from transportes where operacion_id = $1 and origen = 'alux' and not bloqueado`, [operacionId]);
    const rows = await c.query<{
      id: number; hotel_id: number | null; hotel: string; zona: string | null; marina_id: number; marina: string;
      hora_tour: string; hora_pickup: string | null; pax: number; infantes: number; minutos: string | null;
    }>(
      `select r.id, r.hotel_id, coalesce(h.nombre, r.hotel_texto) hotel, z.clave zona, r.marina_id, m.nombre marina,
              to_char(r.hora_tour, 'HH24:MI') hora_tour, to_char(r.hora_pickup, 'HH24:MI') hora_pickup,
              r.adultos + r.menores pax, r.infantes, hm.minutos::text minutos
       from reservas r
       join marinas m on m.id = r.marina_id
       left join hoteles h on h.id = r.hotel_id
       left join zonas z on z.id = h.zona_id
       left join hotel_marina hm on hm.hotel_id = r.hotel_id and hm.marina_id = r.marina_id
       where r.operacion_id = $1 and r.estado = 'transporte' and r.hotel_id is not null and r.hora_tour is not null
         and not exists (select 1 from transporte_reservas tr where tr.reserva_id = r.id)`,
      [operacionId],
    );
    const entrada: ReservaAlux[] = rows.map((r) => ({
      id: r.id, hotelId: r.hotel_id, hotelNombre: r.hotel, zonaClave: r.zona, marinaId: r.marina_id, marinaNombre: r.marina,
      horaTour: r.hora_tour, horaPickup: r.hora_pickup, pax: Number(r.pax), infantes: Number(r.infantes),
      minutosMarina: r.minutos != null ? Number(r.minutos) : null,
    }));
    const propuesta = proponer(entrada, p);
    const [{ max }] = await c.query<{ max: number }>('select coalesce(max(numero), 0)::int max from transportes where operacion_id = $1', [operacionId]);
    let n = max;
    for (const t of propuesta) {
      const [nuevo] = await c.query<{ id: number }>(
        `insert into transportes (operacion_id, marina_id, hora_tour, numero, origen, notas) values ($1,$2,$3,$4,'alux',$5) returning id`,
        [operacionId, t.marinaId, t.horaTour, ++n, t.alertas.join(' · ') || null],
      );
      for (let i = 0; i < t.reservaIds.length; i++) {
        await c.query('insert into transporte_reservas (transporte_id, reserva_id, orden) values ($1,$2,$3)', [nuevo.id, t.reservaIds[i], i]);
      }
    }
    await renumerar(c, operacionId);
    await c.query(`update operaciones set estado = 'propuesta' where id = $1 and estado = 'importada'`, [operacionId]);
    await c.query(
      `insert into ajustes (operacion_id, usuario_id, tipo, detalle) values ($1,$2,'propuesta',$3)`,
      [operacionId, usuarioId, JSON.stringify({ transportes: propuesta.length, reservas: entrada.length })],
    );
    return { transportes: propuesta.length, reservas: entrada.length };
  });
}

/** Numera los transportes por marina, horario y primer pick up para que la lista sea fácil de seguir. */
export async function renumerar(c: { query: (s: string, p?: unknown[]) => Promise<unknown[]> }, operacionId: number) {
  await c.query(
    `with orden as (
       select t.id, row_number() over (order by m.nombre nulls last, t.hora_tour nulls last,
         (select min(r.hora_pickup) from transporte_reservas tr join reservas r on r.id = tr.reserva_id where tr.transporte_id = t.id) nulls last, t.id) n
       from transportes t left join marinas m on m.id = t.marina_id where t.operacion_id = $1)
     update transportes t set numero = orden.n from orden where orden.id = t.id`,
    [operacionId],
  );
}

import Link from 'next/link';
import { q } from '@/lib/db';
import { requerir } from '@/lib/auth';
import { fechaLarga } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

/** Vista del transportista: solo sus servicios asignados de hoy en adelante. */
export default async function MisServicios() {
  const s = await requerir(['transportista']);
  const servicios = await q<{ id: number; fecha: string; numero: number; marina: string; hora_tour: string; unidad: string | null; pax: number; pickups: number; primero: string | null }>(
    `select t.id, to_char(o.fecha,'YYYY-MM-DD') fecha, t.numero, m.nombre marina, to_char(t.hora_tour,'HH24:MI') hora_tour,
            u.tipo || ' ' || u.numero unidad,
            (select coalesce(sum(r.adultos + r.menores),0)::int from transporte_reservas tr join reservas r on r.id = tr.reserva_id where tr.transporte_id = t.id) pax,
            (select count(distinct coalesce(r.hotel_id::text, r.hotel_texto))::int from transporte_reservas tr join reservas r on r.id = tr.reserva_id where tr.transporte_id = t.id) pickups,
            (select to_char(min(r.hora_pickup),'HH24:MI') from transporte_reservas tr join reservas r on r.id = tr.reserva_id where tr.transporte_id = t.id) primero
     from transportes t join operaciones o on o.id = t.operacion_id left join marinas m on m.id = t.marina_id left join unidades u on u.id = t.unidad_id
     where t.transportista_id = $1 and o.fecha >= current_date - 1 order by o.fecha, primero`,
    [s.transportistaId],
  );
  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">Mis servicios</h1>
      {servicios.length === 0 && <p className="text-suave">No tienes servicios asignados por ahora.</p>}
      <ul className="grid gap-3">
        {servicios.map((x) => (
          <li key={x.id} className="tarjeta flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-bold">{fechaLarga(x.fecha)} · Transporte {x.numero}</div>
              <div className="text-sm text-suave">Primer pick up {x.primero ?? '—'} · {x.pickups} pick ups · {x.pax} pax · Marina {x.marina} · {x.unidad ?? 'unidad por confirmar'}</div>
            </div>
            <Link className="btn" href={`/operaciones/${x.fecha}/transporte/${x.id}`}>Ver manifiesto</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

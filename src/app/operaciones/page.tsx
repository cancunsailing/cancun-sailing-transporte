import Link from 'next/link';
import { q } from '@/lib/db';
import { PERMISOS, puede, requerir } from '@/lib/auth';
import { SubirOrden } from './SubirOrden';
import { fechaLarga } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

const ESTADO: Record<string, [string, string]> = {
  importada: ['Importada', 'bg-fondo text-suave'],
  propuesta: ['Propuesta de Alux', 'bg-perlas-soft text-perlas'],
  aprobada: ['Aprobada', 'bg-ok-soft text-ok'],
};

export default async function Operaciones() {
  const s = await requerir(PERMISOS.verOperacion);
  const ops = await q<{ id: number; fecha: string; estado: string; reservas: number; pax: number; transportes: number; sin_asignar: number }>(
    `select o.id, to_char(o.fecha, 'YYYY-MM-DD') fecha,
       o.estado,
       (select count(*)::int from reservas r where r.operacion_id = o.id and r.estado = 'transporte') reservas,
       (select coalesce(sum(adultos + menores), 0)::int from reservas r where r.operacion_id = o.id and r.estado = 'transporte') pax,
       (select count(*)::int from transportes t where t.operacion_id = o.id) transportes,
       (select count(*)::int from reservas r where r.operacion_id = o.id and r.estado = 'transporte'
          and not exists (select 1 from transporte_reservas tr where tr.reserva_id = r.id)) sin_asignar
     from operaciones o order by o.fecha desc limit 60`,
  );
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Operación de ida</h1>
        <p className="text-suave">Sube la orden de servicio del día siguiente. Alux limpia la orden, asigna marinas y propone los transportes.</p>
      </div>
      {puede(s, PERMISOS.editarOperacion) && <SubirOrden />}
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr><th>Fecha</th><th>Estado</th><th className="text-right">Reservas con transporte</th><th className="text-right">Pasajeros</th><th className="text-right">Transportes</th><th className="text-right">Sin asignar</th></tr>
          </thead>
          <tbody>
            {ops.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/operaciones/${o.fecha}`} className="font-semibold hover:underline">{fechaLarga(o.fecha)}</Link></td>
                <td><span className={`chip ${ESTADO[o.estado][1]}`}>{ESTADO[o.estado][0]}</span></td>
                <td className="tabular text-right">{o.reservas}</td>
                <td className="tabular text-right">{o.pax}</td>
                <td className="tabular text-right">{o.transportes}</td>
                <td className={`tabular text-right ${o.sin_asignar ? 'font-semibold text-alerta' : ''}`}>{o.sin_asignar}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ops.length === 0 && <p className="p-4 text-suave">Todavía no hay operaciones. Sube la primera orden de servicio.</p>}
      </div>
    </div>
  );
}

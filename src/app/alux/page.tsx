import { q } from '@/lib/db';
import { PERMISOS, requerir } from '@/lib/auth';
import { revisarRegla } from './actions';

export const dynamic = 'force-dynamic';

const TIPO: Record<string, string> = {
  mover_reserva: 'Movió una reserva',
  asignar_unidad: 'Asignó unidad',
  alias_hotel: 'Ligó un hotel',
  propuesta: 'Alux armó la propuesta',
  importacion: 'Importó la orden',
  aprobar: 'Aprobó la operación',
};

export default async function Aprendizaje() {
  await requerir(PERMISOS.revisarReglas);
  const reglas = await q<{ id: number; texto: string; estado: string; autor: string | null; creado: string }>(
    `select r.id, r.texto, r.estado, u.nombre autor, to_char(r.creado_en at time zone 'America/Cancun','DD/MM HH24:MI') creado
     from reglas_alux r left join usuarios u on u.id = r.creado_por order by (r.estado = 'propuesta') desc, r.creado_en desc limit 200`,
  );
  const ajustes = await q<{ id: number; tipo: string; detalle: Record<string, unknown>; comentario: string | null; autor: string | null; creado: string; fecha: string | null }>(
    `select a.id, a.tipo, a.detalle, a.comentario, u.nombre autor, to_char(a.creado_en at time zone 'America/Cancun','DD/MM HH24:MI') creado,
            to_char(o.fecha,'DD/MM') fecha
     from ajustes a left join usuarios u on u.id = a.usuario_id left join operaciones o on o.id = a.operacion_id
     order by a.creado_en desc limit 100`,
  );
  const [{ total, movidas }] = await q<{ total: number; movidas: number }>(
    `select (select count(*)::int from transporte_reservas) total,
            (select count(distinct (detalle->>'reservaId'))::int from ajustes where tipo = 'mover_reserva') movidas`,
  );
  const aceptacion = total ? Math.max(0, Math.round(((total - movidas) / total) * 100)) : null;
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold">Aprendizaje de Alux</h1>
        <p className="text-suave">Cada corrección del equipo queda registrada. Los comentarios se vuelven reglas propuestas para revisar. Las reglas aprobadas quedan listas para que Alux las aplique cuando se conecte el modelo de IA (siguiente etapa).</p>
      </div>
      {aceptacion !== null && (
        <p className="tarjeta p-4"><b className="tabular text-xl">{aceptacion}%</b> <span className="text-suave">de las reservas asignadas se quedaron donde Alux las propuso.</span></p>
      )}
      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Reglas</h2>
        {reglas.length === 0 && <p className="text-suave">Todavía no hay reglas. Aparecen cuando alguien comenta por qué movió una reserva.</p>}
        <ul className="grid gap-2">
          {reglas.map((r) => (
            <li key={r.id} className="tarjeta flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="font-semibold">{r.texto}</p>
                <p className="text-xs text-suave">{r.autor ?? '—'} · {r.creado}</p>
              </div>
              {r.estado === 'propuesta' ? (
                <div className="flex gap-2">
                  <form action={revisarRegla}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="estado" value="aprobada" /><button className="btn-primario">Aprobar</button></form>
                  <form action={revisarRegla}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="estado" value="descartada" /><button className="btn">Descartar</button></form>
                </div>
              ) : (
                <span className={`chip ${r.estado === 'aprobada' ? 'bg-ok-soft text-ok' : 'bg-fondo text-suave'}`}>{r.estado === 'aprobada' ? 'Aprobada' : 'Descartada'}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Historial de cambios</h2>
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Cuándo</th><th>Operación</th><th>Quién</th><th>Qué</th><th>Comentario</th></tr></thead>
            <tbody>
              {ajustes.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap font-mono text-xs">{a.creado}</td>
                  <td>{a.fecha ?? '—'}</td>
                  <td>{a.autor ?? '—'}</td>
                  <td>
                    {TIPO[a.tipo] ?? a.tipo}
                    {a.tipo === 'mover_reserva' && <span className="text-suave"> · {String(a.detalle.hotel ?? '')}: {a.detalle.de ? `T${a.detalle.de}` : 'sin asignar'} → {a.detalle.a ? `T${a.detalle.a}` : 'sin asignar'}</span>}
                    {a.tipo === 'propuesta' && <span className="text-suave"> · {String(a.detalle.transportes)} transportes</span>}
                  </td>
                  <td className="text-sm">{a.comentario ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

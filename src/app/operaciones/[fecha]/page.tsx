import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PERMISOS, puede, requerir } from '@/lib/auth';
import { cargarOperacion, opcionesAsignacion, type TransporteVista, type ReservaVista } from '@/lib/operacion';
import { q } from '@/lib/db';
import { fechaLarga } from '@/lib/fechas';
import { aprobarOperacion, regenerar, resolverHotel } from '../actions';
import { TarjetaTransporte } from './TarjetaTransporte';
import { MoverReserva } from './MoverReserva';

export const dynamic = 'force-dynamic';

const ESTADOS_FUERA: Record<string, string> = {
  llegan_directo: 'Llegan directo',
  sin_datos: 'Sin hotel ni hora',
  charter: 'Charter (manual)',
  solo_regreso: 'Solo regreso',
};

export default async function Operacion({ params, searchParams }: { params: { fecha: string }; searchParams: { marina?: string } }) {
  const s = await requerir(PERMISOS.verOperacion);
  const d = await cargarOperacion(params.fecha);
  if (!d) notFound();
  const editar = puede(s, PERMISOS.editarOperacion);
  const { transportistas, unidades } = await opcionesAsignacion();
  const hoteles = d.porResolver.length ? await q<{ id: number; nombre: string; zona: string }>(
    'select h.id, h.nombre, z.nombre zona from hoteles h join zonas z on z.id = h.zona_id where h.activo order by h.nombre',
  ) : [];

  const marinas = [...new Set(d.transportes.map((t) => t.marina ?? 'Sin marina'))];
  const filtro = searchParams.marina;
  const grupos = new Map<string, TransporteVista[]>();
  for (const t of d.transportes) {
    if (filtro && (t.marina ?? 'Sin marina') !== filtro) continue;
    const k = `${t.marina ?? 'Sin marina'} · tour ${t.horaTour ?? '—'}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(t);
  }
  const pax = d.conTransporte.reduce((a, r) => a + r.adultos + r.menores, 0);
  const inf = d.conTransporte.reduce((a, r) => a + r.infantes, 0);
  const promedio = d.transportes.length ? (d.transportes.reduce((a, t) => a + t.lugares, 0) / d.transportes.length).toFixed(1) : '—';
  const destinos = d.transportes.map((t) => ({ id: t.id, etiqueta: `Transporte ${t.numero} · ${t.marina ?? ''} ${t.horaTour ?? ''} · ${t.lugares} lugares` }));
  const alertasReservas = d.conTransporte.filter((r) => r.alertas.length);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/operaciones" className="text-sm font-semibold text-suave hover:text-tinta">← Operaciones</Link>
          <h1 className="text-2xl font-bold">Operación de ida · {fechaLarga(d.op.fecha)}</h1>
          <p className="text-sm text-suave">Archivo: {d.op.archivo_nombre ?? '—'} · Estado: {d.op.estado}</p>
        </div>
        {editar && (
          <div className="flex flex-wrap gap-2">
            <form action={regenerar}>
              <input type="hidden" name="operacion_id" value={d.op.id} />
              <button className="btn" title="Rehace los transportes que no están bloqueados">Regenerar propuesta</button>
            </form>
            {d.op.estado !== 'aprobada' && (
              <form action={aprobarOperacion}>
                <input type="hidden" name="operacion_id" value={d.op.id} />
                <button className="btn-primario" disabled={d.sinAsignar.length > 0} title={d.sinAsignar.length ? 'Asigna todas las reservas antes de aprobar' : ''}>
                  Aprobar operación
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 border-y border-linea py-3">
        {[
          [d.conTransporte.length, 'reservas con transporte'],
          [pax, 'pasajeros'],
          [inf, 'infantes'],
          [d.transportes.length, 'transportes'],
          [promedio, 'lugares por transporte'],
          [d.sinAsignar.length, 'sin asignar'],
        ].map(([v, l]) => (
          <div key={String(l)} className="grid">
            <b className={`tabular text-xl ${l === 'sin asignar' && Number(v) > 0 ? 'text-alerta' : ''}`}>{v}</b>
            <span className="text-xs text-suave">{l}</span>
          </div>
        ))}
      </div>

      {d.porResolver.length > 0 && (
        <section className="tarjeta grid gap-3 border-pend p-4">
          <h2 className="font-bold">Hoteles que no reconozco</h2>
          <p className="text-sm text-suave">Elige a qué hotel del catálogo corresponde cada uno. Queda guardado como alias y Alux vuelve a armar la propuesta.</p>
          {d.porResolver.map((txt) => (
            <form key={txt} action={resolverHotel} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="operacion_id" value={d.op.id} />
              <input type="hidden" name="hotel_texto" value={txt} />
              <span className="min-w-[220px] font-semibold">{txt}</span>
              <select name="hotel_id" className="campo max-w-sm" defaultValue="" required disabled={!editar} aria-label={`Hotel para ${txt}`}>
                <option value="" disabled>Elige el hotel…</option>
                {hoteles.map((h) => <option key={h.id} value={h.id}>{h.nombre} · {h.zona}</option>)}
              </select>
              {editar && <button className="btn">Guardar</button>}
              {editar && <Link href={`/catalogos/hoteles/nuevo`} className="text-sm font-semibold text-perlas hover:underline">Es un hotel nuevo</Link>}
            </form>
          ))}
        </section>
      )}

      {d.sinAsignar.length > 0 && (
        <section className="tarjeta grid gap-2 border-alerta p-4">
          <h2 className="font-bold">Reservas sin transporte</h2>
          <ListaReservas reservas={d.sinAsignar} operacionId={d.op.id} destinos={destinos} editar={editar} />
        </section>
      )}

      <div className="flex flex-wrap gap-2" aria-label="Filtrar por marina">
        <Link href={`/operaciones/${d.op.fecha}`} className={`btn ${!filtro ? 'border-tinta bg-tinta text-white hover:bg-tinta' : ''}`}>Todas</Link>
        {marinas.map((m) => (
          <Link key={m} href={`/operaciones/${d.op.fecha}?marina=${encodeURIComponent(m)}`} className={`btn ${filtro === m ? 'border-tinta bg-tinta text-white hover:bg-tinta' : ''}`}>{m}</Link>
        ))}
      </div>

      {[...grupos.entries()].map(([titulo, ts]) => (
        <section key={titulo} className="grid gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-lg font-bold">{titulo}</h2>
            <span className="text-sm text-suave">{ts.length} transportes · {ts.reduce((a, t) => a + t.lugares, 0)} lugares</span>
          </div>
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ts.map((t) => (
              <TarjetaTransporte key={t.id} t={t} operacionId={d.op.id} fecha={d.op.fecha} destinos={destinos} editar={editar}
                transportistas={transportistas} unidades={unidades} />
            ))}
          </div>
        </section>
      ))}

      {alertasReservas.length > 0 && (
        <details className="tarjeta p-4">
          <summary className="cursor-pointer font-bold">Alertas de la orden ({alertasReservas.length})</summary>
          <ul className="mt-3 grid gap-1 text-sm">
            {alertasReservas.map((r) => (
              <li key={r.id}><b>{r.hotel}</b> · {r.cliente} ({r.reserva}): {r.alertas.join(' · ')}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="tarjeta p-4">
        <summary className="cursor-pointer font-bold">Fuera de la propuesta automática ({d.fuera.length})</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Motivo</th><th>Cliente</th><th>Hotel</th><th>Producto</th><th className="text-right">Pax</th><th>Notas</th></tr></thead>
            <tbody>
              {d.fuera.map((r) => (
                <tr key={r.id}>
                  <td>{ESTADOS_FUERA[r.estado] ?? r.estado}</td>
                  <td>{r.cliente}<div className="text-xs text-suave">{r.agencia} · {r.reserva}</div></td>
                  <td>{r.hotel || '—'} {r.horaPickup && <span className="font-mono text-xs text-suave">{r.horaPickup}</span>}</td>
                  <td>{r.producto}</td>
                  <td className="tabular text-right">{r.adultos + r.menores}{r.infantes ? ` +${r.infantes}` : ''}</td>
                  <td className="text-xs">{[r.nota, ...r.alertas].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function ListaReservas({ reservas, operacionId, destinos, editar }: { reservas: ReservaVista[]; operacionId: number; destinos: { id: number; etiqueta: string }[]; editar: boolean }) {
  return (
    <ul className="grid gap-2">
      {reservas.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-linea px-3 py-2 text-sm">
          <span>
            <b>{r.hotel || 'Sin hotel'}</b> · {r.cliente} · {r.adultos + r.menores} pax{r.infantes ? ` +${r.infantes} inf` : ''} · {r.producto}
            {r.alertas.length > 0 && <span className="block text-xs text-alerta">{r.alertas.join(' · ')}</span>}
          </span>
          {editar && <MoverReserva reservaId={r.id} operacionId={operacionId} destinos={destinos} actual={null} />}
        </li>
      ))}
    </ul>
  );
}

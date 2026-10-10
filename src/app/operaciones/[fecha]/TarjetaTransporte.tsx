import Link from 'next/link';
import type { TransporteVista } from '@/lib/operacion';
import { actualizarTransporte, subirParada } from '../actions';
import { MoverReserva } from './MoverReserva';

const COLOR: Record<string, string> = { 'Las Perlas': 'border-l-perlas', 'Punta Norte': 'border-l-norte' };

export function TarjetaTransporte({
  t, operacionId, fecha, destinos, editar, transportistas, unidades,
}: {
  t: TransporteVista; operacionId: number; fecha: string; destinos: { id: number; etiqueta: string }[]; editar: boolean;
  transportistas: { id: number; nombre: string }[]; unidades: { id: number; transportista_id: number; etiqueta: string }[];
}) {
  const cap = t.capacidadUnidad ?? 20;
  const pct = Math.min(100, (t.lugares / cap) * 100);
  return (
    <article className={`tarjeta grid gap-3 border-l-4 p-3 ${COLOR[t.marina ?? ''] ?? 'border-l-pend'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">Transporte {t.numero}</h3>
          <p className="text-xs text-suave">
            {t.origen === 'manual' ? 'Creado a mano' : 'Propuesta de Alux'}{t.bloqueado ? ' · bloqueado' : ''}
          </p>
        </div>
        <span className="chip bg-fondo font-mono">{t.unidad ?? `Sin unidad`}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs text-suave">
        <div className="h-1.5 overflow-hidden rounded bg-linea"><div className={`h-full ${t.lugares > cap ? 'bg-alerta' : 'bg-tinta'}`} style={{ width: `${pct}%` }} /></div>
        <span><b className="tabular text-tinta">{t.lugares}</b> / {cap} lugares · {t.paradas.length} pick up{t.paradas.length === 1 ? '' : 's'}</span>
      </div>
      <ol className="grid gap-2">
        {t.paradas.map((p, i) => (
          <li key={p.clave} className="grid grid-cols-[3.2rem_1fr_auto] gap-2 text-sm">
            <span className="font-mono text-xs text-suave">
              {p.hora ?? '—'}
              {p.llegada && p.hora && p.llegada !== p.hora && (
                <span className={`block ${p.llegada > p.hora ? 'text-alerta' : 'text-ok'}`} title="Llegada estimada del transporte">llega {p.llegada}</span>
              )}
            </span>
            <div className="min-w-0">
              <div className="font-semibold">{p.hotel}</div>
              <div className="text-xs text-suave">{p.zona ?? 'Sin zona'} · {p.reservas.length} reserva{p.reservas.length === 1 ? '' : 's'}</div>
              <ul className="mt-1 grid gap-1">
                {p.reservas.map((r) => (
                  <li key={r.id} className="text-xs">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span>{r.cliente} · {r.adultos + r.menores}{r.infantes ? ` +${r.infantes} inf` : ''} · {r.producto}</span>
                      {editar && <MoverReserva reservaId={r.id} operacionId={operacionId} destinos={destinos} actual={t.id} />}
                    </div>
                    {r.nota && <div className="text-alerta">{r.nota}</div>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="tabular font-semibold">{p.pax}{p.infantes ? <span className="text-xs font-normal text-suave"> +{p.infantes}</span> : null}</span>
              {editar && t.paradas.length > 1 && (
                <div className="flex gap-1">
                  {i > 0 && <Orden t={t.id} clave={p.clave} dir="arriba" operacionId={operacionId} />}
                  {i < t.paradas.length - 1 && <Orden t={t.id} clave={p.clave} dir="abajo" operacionId={operacionId} />}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {t.alertas.length > 0 && (
        <div className="flex flex-wrap gap-1">{t.alertas.map((a) => <span key={a} className="chip bg-alerta-soft text-alerta">{a}</span>)}</div>
      )}
      {t.notas && <p className="text-xs text-suave">{t.notas}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t border-linea pt-2">
        <Link href={`/operaciones/${fecha}/transporte/${t.id}`} className="btn">Manifiesto</Link>
        {editar && (
          <form action={actualizarTransporte}>
            <input type="hidden" name="transporte_id" value={t.id} />
            <input type="hidden" name="operacion_id" value={operacionId} />
            <input type="hidden" name="campo" value="bloqueado" />
            <button className="btn" title="Un transporte bloqueado no se rehace al regenerar">{t.bloqueado ? 'Desbloquear' : 'Bloquear'}</button>
          </form>
        )}
        {editar && (
          <details className="w-full">
            <summary className="cursor-pointer text-xs font-semibold text-perlas">Asignar transportista y unidad</summary>
            <form action={actualizarTransporte} className="mt-2 grid gap-2">
              <input type="hidden" name="transporte_id" value={t.id} />
              <input type="hidden" name="operacion_id" value={operacionId} />
              <input type="hidden" name="campo" value="unidad" />
              <select name="transportista_id" defaultValue={t.transportistaId ?? ''} className="campo" aria-label="Transportista">
                <option value="">Transportista…</option>
                {transportistas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
              <select name="unidad_id" defaultValue={t.unidadId ?? ''} className="campo" aria-label="Unidad">
                <option value="">{unidades.length ? 'Unidad…' : 'Sin unidades cargadas todavía'}</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}
              </select>
              <button className="btn">Guardar asignación</button>
            </form>
          </details>
        )}
      </div>
    </article>
  );
}

function Orden({ t, clave, dir, operacionId }: { t: number; clave: string; dir: 'arriba' | 'abajo'; operacionId: number }) {
  return (
    <form action={subirParada}>
      <input type="hidden" name="transporte_id" value={t} />
      <input type="hidden" name="hotel_clave" value={clave} />
      <input type="hidden" name="dir" value={dir} />
      <input type="hidden" name="operacion_id" value={operacionId} />
      <button className="rounded border border-linea px-1 text-xs leading-5 text-suave hover:bg-fondo" aria-label={dir === 'arriba' ? 'Subir parada' : 'Bajar parada'}>
        {dir === 'arriba' ? '↑' : '↓'}
      </button>
    </form>
  );
}

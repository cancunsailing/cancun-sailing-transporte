import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q } from '@/lib/db';
import { PERMISOS, puede, requerir } from '@/lib/auth';
import { agregarAlias, guardarHotel, quitarAlias } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Hotel({ params, searchParams }: { params: { id: string }; searchParams: { guardado?: string } }) {
  const s = await requerir(PERMISOS.verCatalogos);
  const editar = puede(s, PERMISOS.editarCatalogos);
  const nuevo = params.id === 'nuevo';
  const [h] = nuevo
    ? [{ id: 0, nombre: '', zona_id: 0, lat: null, lon: null, ubicacion: 'por_confirmar' }]
    : await q<{ id: number; nombre: string; zona_id: number; lat: number | null; lon: number | null; ubicacion: string }>(
        'select id, nombre, zona_id, lat, lon, ubicacion from hoteles where id = $1',
        [Number(params.id)],
      );
  if (!h) notFound();
  const zonas = await q<{ id: number; nombre: string }>('select id, nombre from zonas order by id');
  const columnas = await q<{ id: number; nombre: string; hora: string | null }>(
    `select c.id, c.nombre, to_char(p.hora, 'HH24:MI') hora from columnas_horario c
     left join hotel_pickup p on p.columna_horario_id = c.id and p.hotel_id = $1 order by c.id`,
    [h.id],
  );
  const alias = nuevo ? [] : await q<{ id: number; alias: string }>('select id, alias from hotel_alias where hotel_id = $1 order by alias', [h.id]);
  const tiempos = nuevo ? [] : await q<{ marina: string; minutos: string; km: string }>(
    `select m.nombre marina, hm.minutos::text, hm.km::text from hotel_marina hm join marinas m on m.id = hm.marina_id where hm.hotel_id = $1 order by m.id`,
    [h.id],
  );
  const coord = h.lat != null ? `${h.lat}, ${h.lon}` : '';
  return (
    <div className="grid max-w-4xl gap-6">
      <Link href="/catalogos/hoteles" className="text-sm font-semibold text-suave hover:text-tinta">← Hoteles</Link>
      <h1 className="text-2xl font-bold">{nuevo ? 'Nuevo hotel o punto' : h.nombre}</h1>
      {searchParams.guardado && <p className="chip w-fit bg-ok-soft text-ok">Cambios guardados</p>}
      <form action={guardarHotel} className="tarjeta grid gap-4 p-5 sm:grid-cols-2">
        {!nuevo && <input type="hidden" name="id" value={h.id} />}
        <div className="sm:col-span-2">
          <label className="etiqueta" htmlFor="nombre">Nombre actual</label>
          <input id="nombre" name="nombre" defaultValue={h.nombre} required disabled={!editar} className="campo" />
        </div>
        <div>
          <label className="etiqueta" htmlFor="zona_id">Zona</label>
          <select id="zona_id" name="zona_id" defaultValue={h.zona_id || ''} required disabled={!editar} className="campo">
            <option value="" disabled>Elige una zona</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="coordenadas">Ubicación (latitud, longitud o liga de Google Maps)</label>
          <input id="coordenadas" name="coordenadas" defaultValue={coord} disabled={!editar} className="campo" placeholder="21.1563, -86.7989" />
          <p className="mt-1 text-xs text-suave">
            {h.ubicacion === 'alta' ? 'Ubicación confirmada.' : h.ubicacion === 'media' ? 'Ubicación aproximada.' : 'Ubicación por confirmar: es una estimación con hoteles de la misma zona.'}
            {coord && <> <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${h.lat},${h.lon}`}>Ver en mapa</a></>}
          </p>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="etiqueta">Horarios de pick up por producto</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {columnas.map((c) => (
              <label key={c.id} className="text-sm">
                <span className="mb-1 block text-suave">{c.nombre}</span>
                <input type="time" name={`pickup_${c.id}`} defaultValue={c.hora ?? ''} disabled={!editar} className="campo font-mono" />
              </label>
            ))}
          </div>
        </fieldset>
        {tiempos.length > 0 && (
          <p className="text-sm text-suave sm:col-span-2">
            Para ordenar rutas: {tiempos.map((t) => `${t.minutos} min a ${t.marina}`).join(' · ')}
          </p>
        )}
        {editar && <div className="sm:col-span-2"><button className="btn-primario">Guardar</button></div>}
      </form>
      {!nuevo && (
        <section className="tarjeta grid gap-3 p-5">
          <h2 className="text-lg font-bold">Alias</h2>
          <p className="text-sm text-suave">Nombres con los que este hotel llega en la orden de servicio. Con ellos el sistema lo reconoce solo.</p>
          <ul className="grid gap-2">
            {alias.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded border border-linea px-3 py-1.5 text-sm">
                <span>{a.alias}</span>
                {editar && a.alias !== h.nombre && (
                  <form action={quitarAlias}>
                    <input type="hidden" name="alias_id" value={a.id} />
                    <input type="hidden" name="hotel_id" value={h.id} />
                    <button className="text-xs font-semibold text-alerta hover:underline">Quitar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {editar && (
            <form action={agregarAlias} className="flex gap-2">
              <input type="hidden" name="hotel_id" value={h.id} />
              <input name="alias" placeholder="Otro nombre con el que llega" className="campo" aria-label="Nuevo alias" />
              <button className="btn">Agregar</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

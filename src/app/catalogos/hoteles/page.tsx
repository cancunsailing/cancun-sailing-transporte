import Link from 'next/link';
import { q } from '@/lib/db';
import { PERMISOS, puede, requerir } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UBIC: Record<string, [string, string]> = {
  alta: ['Ubicación confirmada', 'bg-ok-soft text-ok'],
  media: ['Ubicación aproximada', 'bg-perlas-soft text-perlas'],
  por_confirmar: ['Ubicación por confirmar', 'bg-pend-soft text-pend'],
};

export default async function Hoteles({ searchParams }: { searchParams: { q?: string; zona?: string; ubicacion?: string } }) {
  const s = await requerir(PERMISOS.verCatalogos);
  const zonas = await q<{ id: number; nombre: string }>('select id, nombre from zonas order by id');
  const params: unknown[] = [];
  const where: string[] = ['h.activo'];
  if (searchParams.q) {
    params.push(`%${searchParams.q}%`);
    where.push(`(h.nombre ilike $${params.length} or exists (select 1 from hotel_alias a where a.hotel_id = h.id and a.alias ilike $${params.length}))`);
  }
  if (searchParams.zona) { params.push(Number(searchParams.zona)); where.push(`h.zona_id = $${params.length}`); }
  if (searchParams.ubicacion) { params.push(searchParams.ubicacion); where.push(`h.ubicacion = $${params.length}`); }
  const hoteles = await q<{ id: number; nombre: string; zona: string; cobro: string | null; cobro_propio: boolean; ubicacion: string; alias: number; lp: string | null; pn: string | null }>(
    `select h.id, h.nombre, z.nombre zona, coalesce(th.nombre, tz.nombre) cobro, h.zona_tarifa_id is not null cobro_propio, h.ubicacion,
       (select count(*)::int - 1 from hotel_alias a where a.hotel_id = h.id) alias,
       (select minutos::text from hotel_marina hm join marinas m on m.id = hm.marina_id where hm.hotel_id = h.id and m.nombre = 'Las Perlas') lp,
       (select minutos::text from hotel_marina hm join marinas m on m.id = hm.marina_id where hm.hotel_id = h.id and m.nombre = 'Punta Norte') pn
     from hoteles h join zonas z on z.id = h.zona_id
     left join zonas_tarifa th on th.id = h.zona_tarifa_id left join zonas_tarifa tz on tz.id = z.zona_tarifa_id
     where ${where.join(' and ')} order by z.id, h.nombre limit 500`,
    params,
  );
  const [{ pendientes }] = await q<{ pendientes: number }>(`select count(*)::int pendientes from hoteles where activo and ubicacion = 'por_confirmar'`);
  const editar = puede(s, PERMISOS.editarCatalogos);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hoteles y puntos de recolección</h1>
          <p className="text-suave">Zona, alias con los que llegan en la orden de servicio, horarios de pick up y ubicación para ordenar las rutas.</p>
        </div>
        {editar && <Link href="/catalogos/hoteles/nuevo" className="btn-primario">Agregar hotel</Link>}
      </div>
      {pendientes > 0 && (
        <Link href="/catalogos/hoteles?ubicacion=por_confirmar" className="tarjeta block border-pend bg-pend-soft p-3 text-sm">
          <b>{pendientes} hoteles</b> tienen la ubicación por confirmar. Corregirla mejora el orden de las paradas que propone Alux.
        </Link>
      )}
      <form className="flex flex-wrap gap-3">
        <input name="q" defaultValue={searchParams.q} placeholder="Buscar por nombre o alias" className="campo max-w-xs" aria-label="Buscar" />
        <select name="zona" defaultValue={searchParams.zona ?? ''} className="campo max-w-[220px]" aria-label="Zona">
          <option value="">Todas las zonas</option>
          {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>
        <select name="ubicacion" defaultValue={searchParams.ubicacion ?? ''} className="campo max-w-[220px]" aria-label="Ubicación">
          <option value="">Cualquier ubicación</option>
          <option value="alta">Confirmada</option>
          <option value="media">Aproximada</option>
          <option value="por_confirmar">Por confirmar</option>
        </select>
        <button className="btn">Filtrar</button>
      </form>
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead><tr><th>Hotel</th><th>Zona</th><th>Se cobra como</th><th>Ubicación</th><th className="text-right">Min a Las Perlas</th><th className="text-right">Min a Punta Norte</th></tr></thead>
          <tbody>
            {hoteles.map((h) => (
              <tr key={h.id}>
                <td>
                  <Link href={`/catalogos/hoteles/${h.id}`} className="font-semibold hover:underline">{h.nombre}</Link>
                  {h.alias > 0 && <span className="ml-2 text-xs text-suave">{h.alias} alias</span>}
                </td>
                <td>{h.zona}</td>
                <td className={h.cobro_propio ? 'font-semibold' : 'text-suave'}>{h.cobro ?? '—'}</td>
                <td><span className={`chip ${UBIC[h.ubicacion][1]}`}>{UBIC[h.ubicacion][0]}</span></td>
                <td className="tabular text-right">{h.lp ?? '—'}</td>
                <td className="tabular text-right">{h.pn ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hoteles.length === 0 && <p className="p-4 text-suave">No hay hoteles con esos filtros.</p>}
      </div>
    </div>
  );
}

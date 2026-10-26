/** Costo estimado del día para la propuesta de una operación: Alux asigna proveedores y se suma con IVA aparte. */
import { q } from './db';
import { cargarOperacion } from './operacion';
import { cargarTarifario, etiquetaUnidad, resumirCosto } from './costos';
import { asignarProveedores, type ServicioIda } from './alux/asignar';

const aMin = (h: string | null | undefined) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(h ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Zona de cobro de cada hotel: la propia del hotel o la de su zona de operación. */
export async function zonasDeCobro(hotelIds: number[]): Promise<Map<number, string | null>> {
  if (!hotelIds.length) return new Map();
  const rows = await q<{ id: number; clave: string | null }>(
    `select h.id, coalesce(zh.clave, zz.clave) clave
     from hoteles h join zonas z on z.id = h.zona_id
     left join zonas_tarifa zh on zh.id = h.zona_tarifa_id
     left join zonas_tarifa zz on zz.id = z.zona_tarifa_id
     where h.id = any($1)`,
    [hotelIds],
  );
  return new Map(rows.map((r) => [r.id, r.clave]));
}

type Operacion = NonNullable<Awaited<ReturnType<typeof cargarOperacion>>>;

export async function serviciosDeOperacion(fecha: string, cargada?: Operacion) {
  const d = cargada ?? (await cargarOperacion(fecha));
  if (!d) return null;
  const hotelIds = [...new Set(d.transportes.flatMap((t) => t.paradas.map((p) => Number(p.clave)).filter(Number.isInteger)))];
  const zonas = await zonasDeCobro(hotelIds);
  const minutos = new Map<string, number>();
  for (const r of await q<{ hotel_id: number; marina_id: number; minutos: string | null }>(
    'select hotel_id, marina_id, minutos::text from hotel_marina where hotel_id = any($1)',
    [hotelIds],
  )) {
    if (r.minutos != null) minutos.set(`${r.hotel_id}-${r.marina_id}`, Number(r.minutos));
  }
  const marinas = (await q<{ id: number }>('select id from marinas')).map((m) => m.id);
  const servicios: ServicioIda[] = d.transportes
    .filter((t) => t.paradas.length)
    .map((t) => {
      const primero = Number(t.paradas[0].clave);
      const ultimo = Number(t.paradas[t.paradas.length - 1].clave);
      const llegadaUltimo = aMin(t.paradas[t.paradas.length - 1].llegada);
      const aMarina = t.marinaId != null ? minutos.get(`${ultimo}-${t.marinaId}`) : undefined;
      const tour = aMin(t.horaTour);
      return {
        id: t.id,
        lugares: t.lugares,
        zonas: t.paradas.map((p) => zonas.get(Number(p.clave)) ?? null),
        inicio: aMin(t.paradas[0].llegada),
        fin: llegadaUltimo != null && aMarina != null ? llegadaUltimo + Math.round(aMarina) : tour != null ? tour - 15 : null,
        marinaId: t.marinaId,
        minutosPrimerHotel: Object.fromEntries(marinas.map((m) => [m, minutos.get(`${primero}-${m}`) ?? null])),
      };
    });
  return { operacion: d, servicios };
}

export async function costoPropuesta(fecha: string, cargada?: Operacion) {
  const datos = await serviciosDeOperacion(fecha, cargada);
  if (!datos) return null;
  const tar = await cargarTarifario();
  const asignacion = asignarProveedores(datos.servicios, tar);
  const numero = new Map(datos.operacion.transportes.map((t) => [t.id, t.numero]));
  // Texto de lo que Alux sugiere para cada transporte
  const porServicio = new Map<number, typeof asignacion.unidades>();
  for (const u of asignacion.unidades) for (const id of new Set(u.servicios)) porServicio.set(id, [...(porServicio.get(id) ?? []), u]);
  const sugerencias: Record<number, string> = {};
  for (const [id, us] of porServicio) {
    const txt = (u: (typeof us)[number]) => {
      const otros = u.servicios.filter((x) => x !== id).map((x) => numero.get(x));
      return `${u.tipo.transportista} · ${etiquetaUnidad(u.tipo)}${u.renta ? ` · renta del día${otros.length ? `, también hace el ${otros.join(' y ')}` : ''}` : ''}`;
    };
    sugerencias[id] = us.length > 1 ? `Repartir en ${us.length} unidades: ${us.map(txt).join('; ')}` : txt(us[0]);
  }
  return { ...datos, tarifario: tar, asignacion, sugerencias, resumen: resumirCosto(asignacion.unidades, tar.iva) };
}

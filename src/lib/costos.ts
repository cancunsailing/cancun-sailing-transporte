/**
 * Costos de transporte: tarifas por zona de cobro, rentas del día e IVA.
 *
 * Reglas validadas con Jimmy Vera (26 oct 2026):
 * - Cada precio es por un traslado (solo ida o solo regreso), salvo los marcados como redondos.
 * - Un servicio se cobra con el precio de la zona más cara entre sus paradas (la más lejana).
 * - Una unidad con renta que hace 2 o más servicios en la mañana cobra la renta del día,
 *   que cubre todos sus servicios de ese día, idas y regresos. Si hace uno solo, se paga por servicio.
 * - Las tarifas son más IVA.
 *
 * Para estimar el costo del día a partir de la operación de ida, el regreso de cada servicio
 * se calcula al mismo precio que su ida.
 */
import { q } from './db';

export type TipoUnidad = {
  id: number;
  transportistaId: number;
  transportista: string;
  tipo: string;
  capacidad: number;
  capacidadMin: number | null;
  cantidad: number | null;
  rentaDia: number | null;
  redondo: boolean;
  segundaIda: boolean;
  /** clave de zona de cobro → precio por servicio sin IVA */
  precios: Record<string, number>;
};

export type ZonaTarifa = { id: number; clave: string; nombre: string; orden: number };

export type Tarifario = {
  tipos: TipoUnidad[];
  zonas: ZonaTarifa[];
  iva: number;
  rentaMinServicios: number;
  margenSegundaIdaMin: number;
  /** Idas que puede hacer en la mañana una unidad de renta */
  maxIdasPorUnidad: number;
};

export const redondear = (n: number) => Math.round(n * 100) / 100;

export function etiquetaUnidad(t: Pick<TipoUnidad, 'tipo' | 'capacidad' | 'capacidadMin'>): string {
  return t.capacidadMin && t.capacidadMin !== t.capacidad ? `${t.tipo} ${t.capacidadMin} a ${t.capacidad}` : `${t.tipo} ${t.capacidad}`;
}

/** Precio de un servicio: el de la zona más cara entre sus paradas. null si la unidad no tiene precio en alguna de ellas. */
export function precioServicio(t: Pick<TipoUnidad, 'precios'>, zonas: (string | null)[]): number | null {
  if (!zonas.length) return null;
  let max = 0;
  for (const z of zonas) {
    const p = z ? t.precios[z] : undefined;
    if (p == null) return null;
    if (p > max) max = p;
  }
  return max;
}

/** Costo de un servicio de ida con su regreso, cuando la unidad no cobra renta. */
export function costoIdaYRegreso(t: Pick<TipoUnidad, 'redondo'>, precio: number): number {
  return t.redondo ? precio : precio * 2;
}

/**
 * Costo del día de una unidad a partir de los precios de sus servicios de ida.
 * Con renta y rentaMin o más servicios en la mañana: la renta. Si no: cada ida con su regreso.
 */
export function costoDiaUnidad(
  t: Pick<TipoUnidad, 'rentaDia' | 'redondo'>,
  preciosIda: number[],
  rentaMin: number,
): { subtotal: number; renta: boolean } {
  if (t.rentaDia != null && preciosIda.length >= rentaMin) return { subtotal: t.rentaDia, renta: true };
  return { subtotal: redondear(preciosIda.reduce((a, p) => a + costoIdaYRegreso(t, p), 0)), renta: false };
}

export function conIva(subtotal: number, iva: number) {
  const s = redondear(subtotal);
  const i = redondear(s * iva);
  return { subtotal: s, iva: i, total: redondear(s + i) };
}

export type ResumenProveedor = { proveedor: string; unidades: number; servicios: number; rentas: number; subtotal: number };

/** Suma el costo del día por proveedor y en total, con IVA aparte. */
export function resumirCosto(
  unidades: { tipo: Pick<TipoUnidad, 'transportista'>; servicios: unknown[]; subtotal: number; renta: boolean }[],
  iva: number,
) {
  const por = new Map<string, ResumenProveedor>();
  for (const u of unidades) {
    const r = por.get(u.tipo.transportista) ?? { proveedor: u.tipo.transportista, unidades: 0, servicios: 0, rentas: 0, subtotal: 0 };
    r.unidades++;
    r.servicios += u.servicios.length;
    r.rentas += u.renta ? 1 : 0;
    r.subtotal = redondear(r.subtotal + u.subtotal);
    por.set(u.tipo.transportista, r);
  }
  const total = unidades.reduce((a, u) => a + u.subtotal, 0);
  return {
    ...conIva(total, iva),
    unidades: unidades.length,
    servicios: unidades.reduce((a, u) => a + u.servicios.length, 0),
    porProveedor: [...por.values()].sort((a, b) => b.subtotal - a.subtotal),
  };
}

export async function cargarTarifario(): Promise<Tarifario> {
  const zonas = await q<ZonaTarifa>('select id, clave, nombre, orden from zonas_tarifa order by orden');
  const filas = await q<{
    id: number; transportista_id: number; transportista: string; tipo: string; capacidad: number; capacidad_min: number | null;
    cantidad: number | null; renta_dia: string | null; precio_redondo: boolean; segunda_ida: boolean; precios: Record<string, string> | null;
  }>(
    `select f.id, f.transportista_id, tp.nombre transportista, f.tipo, f.capacidad, f.capacidad_min, f.cantidad, f.renta_dia::text,
            f.precio_redondo, tp.segunda_ida,
            (select json_object_agg(zt.clave, t.precio) from tarifas t join zonas_tarifa zt on zt.id = t.zona_tarifa_id where t.flota_id = f.id) precios
     from flota f join transportistas tp on tp.id = f.transportista_id
     where f.activa and tp.activo
     order by tp.nombre, f.capacidad`,
  );
  const par = Object.fromEntries((await q<{ clave: string; valor: string }>('select clave, valor from parametros')).map((p) => [p.clave, Number(p.valor)]));
  return {
    zonas,
    iva: par.iva ?? 0.16,
    rentaMinServicios: par.renta_min_servicios ?? 2,
    margenSegundaIdaMin: par.margen_segunda_ida_min ?? 10,
    maxIdasPorUnidad: par.max_idas_unidad ?? 2,
    tipos: filas.map((f) => ({
      id: f.id, transportistaId: f.transportista_id, transportista: f.transportista, tipo: f.tipo, capacidad: f.capacidad,
      capacidadMin: f.capacidad_min, cantidad: f.cantidad, rentaDia: f.renta_dia != null ? Number(f.renta_dia) : null,
      redondo: f.precio_redondo, segundaIda: f.segunda_ida,
      precios: Object.fromEntries(Object.entries(f.precios ?? {}).map(([k, v]) => [k, Number(v)])),
    })),
  };
}

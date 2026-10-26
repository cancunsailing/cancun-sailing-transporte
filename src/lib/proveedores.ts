/** Catálogo de proveedores: datos, flota y tarifas para las pantallas de catálogo. */
import { q } from './db';

export type FlotaCatalogo = {
  id: number;
  tipo: string;
  capacidad: number;
  capacidadMin: number | null;
  cantidad: number | null;
  rentaDia: number | null;
  redondo: boolean;
  activa: boolean;
  precios: Record<string, number>;
};

export type ProveedorCatalogo = {
  id: number;
  nombre: string;
  razonSocial: string | null;
  disponibilidad: string | null;
  segundaIda: boolean;
  notas: string | null;
  activo: boolean;
  flota: FlotaCatalogo[];
};

export const pesos = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export async function zonasDeTarifa() {
  return q<{ id: number; clave: string; nombre: string }>('select id, clave, nombre from zonas_tarifa order by orden');
}

export async function catalogoProveedores(id?: number): Promise<ProveedorCatalogo[]> {
  const provs = await q<{
    id: number; nombre: string; razon_social: string | null; disponibilidad: string | null; segunda_ida: boolean; notas: string | null; activo: boolean;
  }>(
    `select id, nombre, razon_social, disponibilidad, segunda_ida, notas, activo from transportistas
     where ($1::int is null or id = $1) order by activo desc, nombre`,
    [id ?? null],
  );
  const flota = await q<{
    id: number; transportista_id: number; tipo: string; capacidad: number; capacidad_min: number | null; cantidad: number | null;
    renta_dia: string | null; precio_redondo: boolean; activa: boolean; precios: Record<string, string> | null;
  }>(
    `select f.id, f.transportista_id, f.tipo, f.capacidad, f.capacidad_min, f.cantidad, f.renta_dia::text, f.precio_redondo, f.activa,
            (select json_object_agg(zt.clave, t.precio) from tarifas t join zonas_tarifa zt on zt.id = t.zona_tarifa_id where t.flota_id = f.id) precios
     from flota f where ($1::int is null or f.transportista_id = $1) order by f.capacidad, f.tipo`,
    [id ?? null],
  );
  return provs.map((p) => ({
    id: p.id, nombre: p.nombre, razonSocial: p.razon_social, disponibilidad: p.disponibilidad, segundaIda: p.segunda_ida, notas: p.notas, activo: p.activo,
    flota: flota.filter((f) => f.transportista_id === p.id).map((f) => ({
      id: f.id, tipo: f.tipo, capacidad: f.capacidad, capacidadMin: f.capacidad_min, cantidad: f.cantidad,
      rentaDia: f.renta_dia != null ? Number(f.renta_dia) : null, redondo: f.precio_redondo, activa: f.activa,
      precios: Object.fromEntries(Object.entries(f.precios ?? {}).map(([k, v]) => [k, Number(v)])),
    })),
  }));
}

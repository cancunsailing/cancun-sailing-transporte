'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { tx } from '@/lib/db';
import { PERMISOS, requerir } from '@/lib/auth';

const texto = (form: FormData, k: string) => String(form.get(k) ?? '').trim() || null;

function numero(form: FormData, k: string, { entero = false, min = 0 } = {}): number | null {
  const t = String(form.get(k) ?? '').trim().replace(/[$,\s]/g, '');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < min || (entero && !Number.isInteger(n))) throw new Error(`Valor inválido en ${k}: ${t}`);
  return n;
}

export async function guardarProveedor(form: FormData) {
  const s = await requerir(PERMISOS.editarCatalogos);
  const id = form.get('id') ? Number(form.get('id')) : null;
  const nombre = texto(form, 'nombre');
  if (!nombre) throw new Error('El nombre del proveedor es obligatorio.');
  const datos = [nombre, texto(form, 'razon_social'), texto(form, 'disponibilidad'), form.get('segunda_ida') === 'on', texto(form, 'notas'), form.get('activo') === 'on'];
  const pid = await tx(async (c) => {
    let out = id;
    if (id) {
      await c.query(
        `update transportistas set nombre = $2, razon_social = $3, disponibilidad = $4, segunda_ida = $5, notas = $6, activo = $7 where id = $1`,
        [id, ...datos],
      );
    } else {
      const [r] = await c.query<{ id: number }>(
        `insert into transportistas (nombre, razon_social, disponibilidad, segunda_ida, notas, activo) values ($1,$2,$3,$4,$5,$6) returning id`,
        datos,
      );
      out = r.id;
    }
    await c.query(`insert into ajustes (usuario_id, tipo, detalle) values ($1, 'proveedor', $2)`, [s.id, JSON.stringify({ transportista_id: out, nombre })]);
    return out!;
  });
  revalidatePath('/catalogos/proveedores');
  redirect(`/catalogos/proveedores/${pid}?guardado=1`);
}

/** Guarda un tipo de unidad de un proveedor con sus precios por zona de cobro (vacío = no va a esa zona). */
export async function guardarFlota(form: FormData) {
  const s = await requerir(PERMISOS.editarCatalogos);
  const transportistaId = Number(form.get('transportista_id'));
  const id = form.get('id') ? Number(form.get('id')) : null;
  const tipo = texto(form, 'tipo');
  const capacidad = numero(form, 'capacidad', { entero: true, min: 1 });
  if (!tipo || !capacidad) throw new Error('Tipo de unidad y capacidad son obligatorios.');
  const capacidadMin = numero(form, 'capacidad_min', { entero: true, min: 1 });
  if (capacidadMin != null && capacidadMin > capacidad) throw new Error('La capacidad mínima no puede ser mayor que la máxima.');
  const fila = [tipo, capacidad, capacidadMin, numero(form, 'cantidad', { entero: true }), numero(form, 'renta_dia'), form.get('precio_redondo') === 'on', form.get('activa') === 'on'];
  await tx(async (c) => {
    let fid = id;
    if (id) {
      await c.query(
        `update flota set tipo = $3, capacidad = $4, capacidad_min = $5, cantidad = $6, renta_dia = $7, precio_redondo = $8, activa = $9
         where id = $1 and transportista_id = $2`,
        [id, transportistaId, ...fila],
      );
    } else {
      const [r] = await c.query<{ id: number }>(
        `insert into flota (transportista_id, tipo, capacidad, capacidad_min, cantidad, renta_dia, precio_redondo, activa)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [transportistaId, ...fila],
      );
      fid = r.id;
    }
    const zonas = await c.query<{ id: number; clave: string }>('select id, clave from zonas_tarifa');
    const precios: Record<string, number> = {};
    await c.query('delete from tarifas where flota_id = $1', [fid]);
    for (const z of zonas) {
      const p = numero(form, `precio_${z.clave}`);
      if (p == null) continue;
      precios[z.clave] = p;
      await c.query('insert into tarifas (flota_id, zona_tarifa_id, precio) values ($1,$2,$3)', [fid, z.id, p]);
    }
    await c.query(`insert into ajustes (usuario_id, tipo, detalle) values ($1, 'tarifas', $2)`, [
      s.id, JSON.stringify({ transportista_id: transportistaId, flota_id: fid, tipo, capacidad, renta_dia: fila[4], precios }),
    ]);
  });
  revalidatePath('/catalogos/proveedores');
  redirect(`/catalogos/proveedores/${transportistaId}?guardado=1`);
}

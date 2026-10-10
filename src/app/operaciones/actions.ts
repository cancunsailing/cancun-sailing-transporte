'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { q, tx } from '@/lib/db';
import { PERMISOS, requerir } from '@/lib/auth';
import { importarOrden, reclasificarOperacion } from '@/lib/orden/importar';
import { generarPropuesta, renumerar } from '@/lib/alux/generar';
import { norm } from '@/lib/normalize';

async function fechaDe(operacionId: number) {
  const [o] = await q<{ fecha: string }>(`select to_char(fecha, 'YYYY-MM-DD') fecha from operaciones where id = $1`, [operacionId]);
  return o.fecha;
}

export async function subirOrden(_: unknown, form: FormData): Promise<{ error?: string }> {
  const s = await requerir(PERMISOS.editarOperacion);
  const f = form.get('archivo');
  if (!(f instanceof File) || f.size === 0) return { error: 'Elige el archivo de la orden de servicio.' };
  let fecha: string;
  try {
    const r = await importarOrden(await f.text(), f.name, s.id);
    fecha = r.fecha;
    const [{ n }] = await q<{ n: number }>('select count(*)::int n from transportes where operacion_id = $1', [r.operacionId]);
    if (n === 0) await generarPropuesta(r.operacionId, s.id);
    else if (r.altas + r.cambios > 0) await generarPropuesta(r.operacionId, s.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No pude leer el archivo.' };
  }
  revalidatePath('/operaciones');
  redirect(`/operaciones/${fecha}`);
}

export async function regenerar(form: FormData) {
  const s = await requerir(PERMISOS.editarOperacion);
  const id = Number(form.get('operacion_id'));
  await generarPropuesta(id, s.id);
  revalidatePath(`/operaciones/${await fechaDe(id)}`);
}

/** Liga un texto de hotel no reconocido a un hotel del catálogo (queda como alias para siempre). */
export async function resolverHotel(form: FormData) {
  const s = await requerir(PERMISOS.editarOperacion);
  const id = Number(form.get('operacion_id'));
  const texto = String(form.get('hotel_texto'));
  const hotelId = Number(form.get('hotel_id'));
  if (!hotelId) return;
  await q(
    `insert into hotel_alias (hotel_id, alias, alias_norm) values ($1,$2,$3)
     on conflict (alias_norm) do update set hotel_id = excluded.hotel_id`,
    [hotelId, texto, norm(texto)],
  );
  await q(`insert into ajustes (operacion_id, usuario_id, tipo, detalle) values ($1,$2,'alias_hotel',$3)`, [
    id, s.id, JSON.stringify({ texto, hotelId }),
  ]);
  await reclasificarOperacion(id);
  await generarPropuesta(id, s.id);
  revalidatePath(`/operaciones/${await fechaDe(id)}`);
}

export async function moverReserva(form: FormData) {
  const s = await requerir(PERMISOS.editarOperacion);
  const operacionId = Number(form.get('operacion_id'));
  const reservaId = Number(form.get('reserva_id'));
  const destino = String(form.get('destino') || '');
  const comentario = String(form.get('comentario') || '').trim() || null;
  if (!destino) return;
  await tx(async (c) => {
    const [r] = await c.query<{ hotel: string; marina_id: number | null; hora_tour: string | null; transporte_id: number | null; numero: number | null }>(
      `select coalesce(h.nombre, r.hotel_texto) hotel, r.marina_id, to_char(r.hora_tour,'HH24:MI') hora_tour, tr.transporte_id, t.numero
       from reservas r left join hoteles h on h.id = r.hotel_id
       left join transporte_reservas tr on tr.reserva_id = r.id left join transportes t on t.id = tr.transporte_id
       where r.id = $1 and r.operacion_id = $2`,
      [reservaId, operacionId],
    );
    if (!r) throw new Error('Reserva no encontrada.');
    let destinoId: number | null = null;
    let destinoNumero: number | null = null;
    if (destino === 'nuevo') {
      const [t] = await c.query<{ id: number; numero: number }>(
        `insert into transportes (operacion_id, marina_id, hora_tour, numero, origen)
         values ($1,$2,$3,(select coalesce(max(numero),0)+1 from transportes where operacion_id=$1),'manual') returning id, numero`,
        [operacionId, r.marina_id, r.hora_tour],
      );
      destinoId = t.id; destinoNumero = t.numero;
    } else if (destino !== 'sin_asignar') {
      destinoId = Number(destino);
      const [t] = await c.query<{ numero: number }>('select numero from transportes where id = $1 and operacion_id = $2', [destinoId, operacionId]);
      if (!t) throw new Error('Transporte no encontrado.');
      destinoNumero = t.numero;
    }
    await c.query('delete from transporte_reservas where reserva_id = $1', [reservaId]);
    if (destinoId) {
      // la parada se inserta junto a las reservas del mismo hotel, o al final
      await c.query(
        `insert into transporte_reservas (transporte_id, reserva_id, orden)
         values ($1, $2, coalesce((select max(orden) + 1 from transporte_reservas where transporte_id = $1), 0))`,
        [destinoId, reservaId],
      );
    }
    // lo que el coordinador ya tocó queda bloqueado para que Alux no lo rehaga al regenerar
    await c.query('update transportes set bloqueado = true where id = any($1::int[])', [[destinoId, r.transporte_id].filter(Boolean)]);
    // transportes que quedaron vacíos se eliminan
    await c.query(
      `delete from transportes t where t.operacion_id = $1
         and not exists (select 1 from transporte_reservas tr where tr.transporte_id = t.id)`,
      [operacionId],
    );
    const [aj] = await c.query<{ id: number }>(
      `insert into ajustes (operacion_id, usuario_id, tipo, detalle, comentario) values ($1,$2,'mover_reserva',$3,$4) returning id`,
      [operacionId, s.id, JSON.stringify({ reservaId, hotel: r.hotel, de: r.numero, a: destinoNumero }), comentario],
    );
    if (comentario) {
      await c.query(`insert into reglas_alux (texto, ajuste_id, creado_por) values ($1,$2,$3)`, [comentario, aj.id, s.id]);
    }
  });
  revalidatePath(`/operaciones/${await fechaDe(operacionId)}`);
}

export async function subirParada(form: FormData) {
  await requerir(PERMISOS.editarOperacion);
  const transporteId = Number(form.get('transporte_id'));
  const hotelClave = String(form.get('hotel_clave'));
  const dir = form.get('dir') === 'abajo' ? 1 : -1;
  const operacionId = Number(form.get('operacion_id'));
  await tx(async (c) => {
    const rs = await c.query<{ reserva_id: number; clave: string }>(
      `select tr.reserva_id, coalesce(r.hotel_id::text, r.hotel_texto) clave from transporte_reservas tr
       join reservas r on r.id = tr.reserva_id where tr.transporte_id = $1 order by tr.orden, tr.reserva_id`,
      [transporteId],
    );
    const claves = [...new Set(rs.map((r) => r.clave))];
    const i = claves.indexOf(hotelClave);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= claves.length) return;
    [claves[i], claves[j]] = [claves[j], claves[i]];
    await c.query('update transportes set bloqueado = true where id = $1', [transporteId]);
    let n = 0;
    for (const k of claves) for (const r of rs.filter((x) => x.clave === k)) {
      await c.query('update transporte_reservas set orden = $3 where transporte_id = $1 and reserva_id = $2', [transporteId, r.reserva_id, n++]);
    }
  });
  revalidatePath(`/operaciones/${await fechaDe(operacionId)}`);
}

export async function actualizarTransporte(form: FormData) {
  const s = await requerir(PERMISOS.editarOperacion);
  const id = Number(form.get('transporte_id'));
  const operacionId = Number(form.get('operacion_id'));
  const campo = String(form.get('campo'));
  if (campo === 'bloqueado') {
    await q('update transportes set bloqueado = not bloqueado where id = $1', [id]);
  } else if (campo === 'unidad') {
    const unidad = form.get('unidad_id') ? Number(form.get('unidad_id')) : null;
    const transportista = form.get('transportista_id') ? Number(form.get('transportista_id')) : null;
    await q(
      `update transportes set unidad_id = $2,
         transportista_id = coalesce((select transportista_id from unidades where id = $2), $3), bloqueado = true where id = $1`,
      [id, unidad, transportista],
    );
    await q(`insert into ajustes (operacion_id, usuario_id, tipo, detalle) values ($1,$2,'asignar_unidad',$3)`, [
      operacionId, s.id, JSON.stringify({ transporteId: id, unidad, transportista }),
    ]);
  } else if (campo === 'notas') {
    await q('update transportes set notas = $2 where id = $1', [id, String(form.get('notas') || '') || null]);
  }
  await tx((c) => renumerar(c, operacionId));
  revalidatePath(`/operaciones/${await fechaDe(operacionId)}`);
}

export async function aprobarOperacion(form: FormData) {
  const s = await requerir(PERMISOS.editarOperacion);
  const id = Number(form.get('operacion_id'));
  await q(`update operaciones set estado = 'aprobada' where id = $1`, [id]);
  await q(`insert into ajustes (operacion_id, usuario_id, tipo) values ($1,$2,'aprobar')`, [id, s.id]);
  revalidatePath(`/operaciones/${await fechaDe(id)}`);
}

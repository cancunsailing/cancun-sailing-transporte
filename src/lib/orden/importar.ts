import { q, tx } from '../db';
import { parsearOrden, type FilaOrden } from './parser';
import { clasificar, type Catalogo, type ReservaClasificada } from './clasificar';

export async function cargarCatalogo(): Promise<Catalogo> {
  const alias = new Map<string, number>();
  for (const a of await q<{ alias_norm: string; hotel_id: number }>('select alias_norm, hotel_id from hotel_alias')) alias.set(a.alias_norm, a.hotel_id);
  const productos = (
    await q<{ id: number; nombre: string; hora: string; marina_id: number | null; columna_horario_id: number | null; nombres_reporte: string[] }>(
      `select id, nombre, to_char(hora_salida, 'HH24:MI') hora, marina_id, columna_horario_id, nombres_reporte from productos where activo`,
    )
  ).map((p) => ({ id: p.id, nombre: p.nombre, hora: p.hora, marinaId: p.marina_id, columnaId: p.columna_horario_id, nombresReporte: p.nombres_reporte }));
  const pickups = new Map<string, string>();
  for (const p of await q<{ hotel_id: number; columna_horario_id: number; hora: string }>(
    `select hotel_id, columna_horario_id, to_char(hora, 'HH24:MI') hora from hotel_pickup`,
  )) pickups.set(`${p.hotel_id}:${p.columna_horario_id}`, p.hora);
  return { alias, productos, pickups };
}

export type ResumenImportacion = {
  operacionId: number;
  fecha: string;
  total: number;
  porEstado: Record<string, number>;
  altas: number;
  bajas: number;
  cambios: number;
  conservadas: number;
};

const CAMPOS = ['cliente', 'cupon', 'hotel_texto', 'hora_pickup', 'adultos', 'menores', 'infantes', 'excursion_texto', 'agencia', 'comentario'] as const;

function valores(r: ReservaClasificada) {
  return {
    reserva: r.reserva, cupon: r.cupon, cliente: r.cliente, hotel_texto: r.hotel, hotel_id: r.hotelId, hora_pickup: r.horaPickup,
    adultos: r.adultos, menores: r.menores, infantes: r.infantes, excursion_texto: r.excursion, producto_id: r.productoId,
    marina_id: r.marinaId, hora_tour: r.horaTour, agencia: r.agencia, preferencia: r.preferencia, rep: r.rep,
    comentario: r.comentario, nota_transporte: r.notaTransporte, estado: r.estado, alertas: r.alertas,
  };
}

/**
 * Importa la orden de servicio. Si la fecha ya existe, actualiza: agrega reservas nuevas, quita las que ya no vienen
 * y actualiza las que cambiaron, sin perder los transportes ya asignados a las que siguen igual.
 */
export async function importarOrden(html: string, archivo: string, usuarioId: string): Promise<ResumenImportacion> {
  const orden = parsearOrden(html);
  if (!orden.fecha) throw new Error('No encontré la fecha de la operación en el archivo.');
  const cat = await cargarCatalogo();
  const rs = clasificar(orden.filas, cat);

  return tx(async (c) => {
    const op = await c.query<{ id: number }>(
      `insert into operaciones (fecha, archivo_nombre, importado_por) values ($1,$2,$3)
       on conflict (fecha) do update set archivo_nombre = excluded.archivo_nombre, importado_por = excluded.importado_por, importado_en = now()
       returning id`,
      [orden.fecha, archivo, usuarioId],
    );
    const operacionId = op[0].id;
    const previas = await c.query<Record<string, unknown> & { id: number; reserva: string }>(
      `select id, reserva, cliente, cupon, hotel_texto, to_char(hora_pickup, 'HH24:MI') hora_pickup, adultos, menores, infantes,
              excursion_texto, agencia, comentario from reservas where operacion_id = $1`,
      [operacionId],
    );
    const porCodigo = new Map(previas.map((p) => [p.reserva, p]));
    const vistos = new Set<string>();
    let altas = 0, cambios = 0, conservadas = 0;
    for (const r of rs) {
      const v = valores(r);
      const prev = porCodigo.get(r.reserva);
      vistos.add(r.reserva);
      const cols = Object.keys(v);
      if (!prev) {
        await c.query(
          `insert into reservas (operacion_id, ${cols.join(', ')}) values ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')})`,
          [operacionId, ...Object.values(v)],
        );
        altas++;
        continue;
      }
      const cambio = CAMPOS.some((k) => String(prev[k] ?? '') !== String((v as Record<string, unknown>)[k] ?? ''));
      await c.query(
        `update reservas set ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`,
        [prev.id, ...Object.values(v)],
      );
      if (cambio) {
        cambios++;
        // si cambió algo que afecta la logística, la reserva sale de su transporte para revisarse
        await c.query('delete from transporte_reservas where reserva_id = $1', [prev.id]);
      } else conservadas++;
    }
    const bajas = previas.filter((p) => !vistos.has(p.reserva));
    for (const b of bajas) await c.query('delete from reservas where id = $1', [b.id]);
    await c.query(
      `insert into ajustes (operacion_id, usuario_id, tipo, detalle) values ($1,$2,'importacion',$3)`,
      [operacionId, usuarioId, JSON.stringify({ archivo, altas, bajas: bajas.length, cambios })],
    );
    const porEstado: Record<string, number> = {};
    for (const r of rs) porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1;
    return { operacionId, fecha: orden.fecha!, total: rs.length, porEstado, altas, bajas: bajas.length, cambios, conservadas };
  });
}

/** Vuelve a clasificar las reservas de una operación (por ejemplo, después de dar de alta alias de hoteles). */
export async function reclasificarOperacion(operacionId: number) {
  const cat = await cargarCatalogo();
  const filas = await q<{ id: number } & Record<string, string | number>>(
    `select id, cliente, cupon, '' hab, hotel_texto hotel, reserva, coalesce(to_char(hora_pickup, 'HH24:MI'), '') hora, adultos, menores, infantes,
            excursion_texto excursion, rep, agencia, preferencia, comentario from reservas where operacion_id = $1`,
    [operacionId],
  );
  const rs = clasificar(filas as unknown as FilaOrden[], cat);
  await tx(async (c) => {
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      await c.query(
        `update reservas set hotel_id=$2, producto_id=$3, marina_id=$4, hora_tour=$5, estado=$6, alertas=$7, nota_transporte=$8 where id=$1`,
        [filas[i].id, r.hotelId, r.productoId, r.marinaId, r.horaTour, r.estado, r.alertas, r.notaTransporte],
      );
    }
  });
}

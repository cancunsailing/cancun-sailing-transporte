'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { q, tx } from '@/lib/db';
import { PERMISOS, requerir } from '@/lib/auth';
import { hhmm, norm } from '@/lib/normalize';
import { leerCoordenadas, tiemposAMarinas } from '@/lib/rutas';

async function recalcularTiempos(hotelId: number, lat: number, lon: number) {
  const marinas = await q<{ id: number; lat: number; lon: number }>('select id, lat, lon from marinas where lat is not null');
  const t = await tiemposAMarinas({ lat, lon }, marinas);
  for (const x of t) {
    await q(
      `insert into hotel_marina (hotel_id, marina_id, minutos, km) values ($1,$2,$3,$4)
       on conflict (hotel_id, marina_id) do update set minutos = excluded.minutos, km = excluded.km`,
      [hotelId, x.marinaId, x.minutos, x.km],
    );
  }
}

export async function guardarHotel(form: FormData) {
  await requerir(PERMISOS.editarCatalogos);
  const id = form.get('id') ? Number(form.get('id')) : null;
  const nombre = String(form.get('nombre') || '').trim();
  const zona = Number(form.get('zona_id'));
  if (!nombre || !zona) throw new Error('Nombre y zona son obligatorios.');
  const coordTxt = String(form.get('coordenadas') || '');
  const coord = coordTxt ? leerCoordenadas(coordTxt) : null;
  if (coordTxt && !coord) throw new Error('No pude leer las coordenadas. Pega "latitud, longitud" o la liga de Google Maps.');
  const anterior = id ? (await q<{ lat: number | null; lon: number | null }>('select lat, lon from hoteles where id = $1', [id]))[0] : null;
  const cambioUbic = coord && (!anterior || anterior.lat !== coord.lat || anterior.lon !== coord.lon);

  const hotelId = await tx(async (c) => {
    let hid = id;
    if (hid) {
      await c.query(
        `update hoteles set nombre = $2, zona_id = $3, actualizado_en = now()
           ${cambioUbic ? `, lat = ${coord!.lat}, lon = ${coord!.lon}, ubicacion = 'alta'` : ''}
         where id = $1`,
        [hid, nombre, zona],
      );
    } else {
      const r = await c.query<{ id: number }>(
        `insert into hoteles (nombre, zona_id, lat, lon, ubicacion) values ($1,$2,$3,$4,$5) returning id`,
        [nombre, zona, coord?.lat ?? null, coord?.lon ?? null, coord ? 'alta' : 'por_confirmar'],
      );
      hid = r[0].id;
    }
    await c.query(
      `insert into hotel_alias (hotel_id, alias, alias_norm) values ($1,$2,$3)
       on conflict (alias_norm) do update set hotel_id = excluded.hotel_id`,
      [hid, nombre, norm(nombre)],
    );
    const cols = await c.query<{ id: number }>('select id from columnas_horario');
    for (const col of cols) {
      const v = hhmm(String(form.get(`pickup_${col.id}`) || ''));
      if (v) {
        await c.query(
          `insert into hotel_pickup (hotel_id, columna_horario_id, hora) values ($1,$2,$3)
           on conflict (hotel_id, columna_horario_id) do update set hora = excluded.hora`,
          [hid, col.id, v],
        );
      } else {
        await c.query('delete from hotel_pickup where hotel_id = $1 and columna_horario_id = $2', [hid, col.id]);
      }
    }
    return hid!;
  });
  if (cambioUbic) await recalcularTiempos(hotelId, coord!.lat, coord!.lon);
  revalidatePath('/catalogos/hoteles');
  redirect(`/catalogos/hoteles/${hotelId}?guardado=1`);
}

export async function agregarAlias(form: FormData) {
  await requerir(PERMISOS.editarCatalogos);
  const hotelId = Number(form.get('hotel_id'));
  const alias = String(form.get('alias') || '').trim();
  if (!alias) return;
  await q(
    `insert into hotel_alias (hotel_id, alias, alias_norm) values ($1,$2,$3)
     on conflict (alias_norm) do update set hotel_id = excluded.hotel_id, alias = excluded.alias`,
    [hotelId, alias, norm(alias)],
  );
  revalidatePath(`/catalogos/hoteles/${hotelId}`);
}

export async function quitarAlias(form: FormData) {
  await requerir(PERMISOS.editarCatalogos);
  const id = Number(form.get('alias_id'));
  const hotelId = Number(form.get('hotel_id'));
  await q('delete from hotel_alias where id = $1 and hotel_id = $2', [id, hotelId]);
  revalidatePath(`/catalogos/hoteles/${hotelId}`);
}

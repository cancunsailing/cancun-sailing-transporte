'use server';
import { revalidatePath } from 'next/cache';
import { q } from '@/lib/db';
import { PERMISOS, requerir } from '@/lib/auth';
import { hhmm, norm } from '@/lib/normalize';

export async function guardarProducto(form: FormData) {
  await requerir(PERMISOS.editarCatalogos);
  const id = form.get('id') ? Number(form.get('id')) : null;
  const nombre = String(form.get('nombre') || '').trim();
  const hora = hhmm(String(form.get('hora') || ''));
  if (!nombre || !hora) throw new Error('Nombre y hora de salida son obligatorios.');
  const marina = form.get('marina_id') ? Number(form.get('marina_id')) : null;
  const col = form.get('columna_horario_id') ? Number(form.get('columna_horario_id')) : null;
  const nombres = String(form.get('nombres') || nombre).split(',').map(norm).filter(Boolean);
  if (id) {
    await q(
      'update productos set nombre=$2, hora_salida=$3, marina_id=$4, columna_horario_id=$5, nombres_reporte=$6 where id=$1',
      [id, nombre, hora, marina, col, nombres],
    );
  } else {
    await q(
      `insert into productos (nombre, hora_salida, marina_id, columna_horario_id, nombres_reporte) values ($1,$2,$3,$4,$5)`,
      [nombre, hora, marina, col, nombres],
    );
  }
  revalidatePath('/catalogos/productos');
}

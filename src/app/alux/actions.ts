'use server';
import { revalidatePath } from 'next/cache';
import { q } from '@/lib/db';
import { PERMISOS, requerir } from '@/lib/auth';

export async function revisarRegla(form: FormData) {
  const s = await requerir(PERMISOS.revisarReglas);
  const estado = String(form.get('estado'));
  if (!['aprobada', 'descartada'].includes(estado)) return;
  await q('update reglas_alux set estado = $2, revisado_por = $3 where id = $1', [Number(form.get('id')), estado, s.id]);
  revalidatePath('/alux');
}

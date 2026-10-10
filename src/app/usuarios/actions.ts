'use server';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { q } from '@/lib/db';
import { PERMISOS, requerir } from '@/lib/auth';

const Nuevo = z.object({
  nombre: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  rol: z.enum(['admin', 'coordinador', 'finanzas', 'transportista', 'consulta']),
  password: z.string().min(8),
  transportista_id: z.string().optional(),
});

export async function crearUsuario(form: FormData) {
  await requerir(PERMISOS.administrarUsuarios);
  const d = Nuevo.parse(Object.fromEntries(form));
  const tid = d.rol === 'transportista' && d.transportista_id ? Number(d.transportista_id) : null;
  if (d.rol === 'transportista' && !tid) throw new Error('Un usuario de transportista necesita su empresa.');
  await q(
    `insert into usuarios (nombre, email, rol, password_hash, transportista_id) values ($1,$2,$3,$4,$5)
     on conflict (email) do update set nombre = excluded.nombre, rol = excluded.rol, password_hash = excluded.password_hash,
       transportista_id = excluded.transportista_id, activo = true`,
    [d.nombre, d.email, d.rol, await bcrypt.hash(d.password, 10), tid],
  );
  revalidatePath('/usuarios');
}

export async function cambiarEstadoUsuario(form: FormData) {
  await requerir(PERMISOS.administrarUsuarios);
  await q('update usuarios set activo = $2 where id = $1', [String(form.get('id')), form.get('activo') === 'true']);
  revalidatePath('/usuarios');
}

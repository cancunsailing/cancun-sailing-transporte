'use server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { COOKIE, crearToken, type Rol } from '@/lib/auth';

export async function iniciarSesion(_: unknown, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const pass = String(form.get('password') || '');
  const siguiente = String(form.get('siguiente') || '/');
  const [u] = await q<{ id: string; email: string; nombre: string; rol: Rol; transportista_id: number | null; password_hash: string; activo: boolean }>(
    'select * from usuarios where email = $1',
    [email],
  );
  if (!u || !u.activo || !(await bcrypt.compare(pass, u.password_hash))) {
    return { error: 'Correo o contraseña incorrectos.' };
  }
  const token = await crearToken({ id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, transportistaId: u.transportista_id });
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
  redirect(siguiente.startsWith('/') ? siguiente : '/');
}

export async function cerrarSesion() {
  cookies().delete(COOKIE);
  redirect('/login');
}

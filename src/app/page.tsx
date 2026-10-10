import { redirect } from 'next/navigation';
import { requerir } from '@/lib/auth';

export default async function Inicio() {
  const s = await requerir();
  redirect(s.rol === 'transportista' ? '/mis-servicios' : '/operaciones');
}

'use server';
import { redirect } from 'next/navigation';
import { tx } from '@/lib/db';
import { PERMISOS, requerir } from '@/lib/auth';

export async function guardarConfiguracion(form: FormData) {
  const s = await requerir(PERMISOS.editarCatalogos);
  const cambios: Record<string, unknown> = {};
  await tx(async (c) => {
    for (const [k, v] of form.entries()) {
      const txt = String(v).trim();
      if (k.startsWith('p_')) {
        const n = Number(txt);
        if (!Number.isInteger(n) || n < 0) throw new Error(`Valor inválido para ${k.slice(2)}`);
        await c.query('update parametros set valor = $2 where clave = $1', [k.slice(2), String(n)]);
        cambios[k.slice(2)] = n;
      } else if (k.startsWith('z_')) {
        const n = txt === '' ? null : Number(txt);
        if (n !== null && (!Number.isInteger(n) || n < 0)) throw new Error('Los minutos por zona deben ser enteros positivos.');
        await c.query('update zonas set min_entre_pickups = $2 where id = $1', [Number(k.slice(2)), n]);
        cambios[`zona_${k.slice(2)}`] = n;
      }
    }
    await c.query(`insert into ajustes (usuario_id, tipo, detalle) values ($1, 'configuracion', $2)`, [s.id, JSON.stringify(cambios)]);
  });
  redirect('/configuracion?guardado=1');
}

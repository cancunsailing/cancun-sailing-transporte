import { q } from '@/lib/db';
import { PERMISOS, ROL_NOMBRE, requerir, type Rol } from '@/lib/auth';
import { crearUsuario, cambiarEstadoUsuario } from './actions';

export const dynamic = 'force-dynamic';

export default async function Usuarios() {
  const s = await requerir(PERMISOS.administrarUsuarios);
  const usuarios = await q<{ id: string; email: string; nombre: string; rol: Rol; activo: boolean; transportista: string | null }>(
    `select u.id, u.email, u.nombre, u.rol, u.activo, t.nombre transportista
     from usuarios u left join transportistas t on t.id = u.transportista_id order by u.activo desc, u.nombre`,
  );
  const transportistas = await q<{ id: number; nombre: string }>('select id, nombre from transportistas where activo order by nombre');
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-suave">Cada persona entra con su propio usuario. El rol define qué puede ver y hacer; los choferes no tienen acceso.</p>
      </div>
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activo ? '' : 'text-suave'}>
                <td className="font-semibold">{u.nombre}</td>
                <td>{u.email}</td>
                <td>{ROL_NOMBRE[u.rol]}{u.transportista ? ` · ${u.transportista}` : ''}</td>
                <td>{u.activo ? <span className="chip bg-ok-soft text-ok">Activo</span> : <span className="chip bg-fondo text-suave">Inactivo</span>}</td>
                <td className="text-right">
                  {u.id !== s.id && (
                    <form action={cambiarEstadoUsuario}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="activo" value={u.activo ? 'false' : 'true'} />
                      <button className="btn">{u.activo ? 'Desactivar' : 'Reactivar'}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={crearUsuario} className="tarjeta grid max-w-3xl gap-4 p-5 sm:grid-cols-2">
        <h2 className="text-lg font-bold sm:col-span-2">Nuevo usuario</h2>
        <div><label className="etiqueta" htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" required className="campo" /></div>
        <div><label className="etiqueta" htmlFor="email">Correo</label><input id="email" name="email" type="email" required className="campo" /></div>
        <div>
          <label className="etiqueta" htmlFor="rol">Rol</label>
          <select id="rol" name="rol" className="campo" defaultValue="coordinador">
            {(Object.keys(ROL_NOMBRE) as Rol[]).map((r) => <option key={r} value={r}>{ROL_NOMBRE[r]}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="transportista_id">Transportista (solo para ese rol)</label>
          <select id="transportista_id" name="transportista_id" className="campo" defaultValue="">
            <option value="">—</option>
            {transportistas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="etiqueta" htmlFor="password">Contraseña inicial (mínimo 8 caracteres)</label>
          <input id="password" name="password" type="password" minLength={8} required className="campo" />
        </div>
        <div className="sm:col-span-2"><button className="btn-primario">Crear usuario</button></div>
      </form>
    </div>
  );
}

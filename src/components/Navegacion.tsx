import Link from 'next/link';
import { PERMISOS, ROL_NOMBRE, puede, type Sesion } from '@/lib/auth';
import { cerrarSesion } from '@/app/login/actions';

export function Navegacion({ sesion }: { sesion: Sesion }) {
  const links = [
    { href: '/operaciones', txt: 'Operación', ok: puede(sesion, PERMISOS.verOperacion) },
    { href: '/mis-servicios', txt: 'Mis servicios', ok: sesion.rol === 'transportista' },
    { href: '/catalogos/hoteles', txt: 'Hoteles', ok: puede(sesion, PERMISOS.verCatalogos) },
    { href: '/catalogos/productos', txt: 'Productos', ok: puede(sesion, PERMISOS.verCatalogos) },
    { href: '/alux', txt: 'Aprendizaje de Alux', ok: puede(sesion, PERMISOS.revisarReglas) },
    { href: '/usuarios', txt: 'Usuarios', ok: puede(sesion, PERMISOS.administrarUsuarios) },
  ].filter((l) => l.ok);
  return (
    <header className="sticky top-0 z-20 border-b border-linea bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-bold tracking-tight">
          Transporte <span className="text-suave">· Cancun Sailing</span>
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm font-semibold text-suave">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-tinta">
              {l.txt}
            </Link>
          ))}
        </nav>
        <form action={cerrarSesion} className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-suave">
            {sesion.nombre} · {ROL_NOMBRE[sesion.rol]}
          </span>
          <button className="btn" type="submit">Salir</button>
        </form>
      </div>
    </header>
  );
}

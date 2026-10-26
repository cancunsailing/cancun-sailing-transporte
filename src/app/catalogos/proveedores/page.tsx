import Link from 'next/link';
import { PERMISOS, puede, requerir } from '@/lib/auth';
import { q } from '@/lib/db';
import { catalogoProveedores, pesos, zonasDeTarifa } from '@/lib/proveedores';

export const dynamic = 'force-dynamic';

export default async function Proveedores() {
  const s = await requerir(PERMISOS.verCatalogos);
  const editar = puede(s, PERMISOS.editarCatalogos);
  const [provs, zonas, par] = await Promise.all([
    catalogoProveedores(),
    zonasDeTarifa(),
    q<{ clave: string; valor: string }>(`select clave, valor from parametros where clave in ('iva', 'renta_min_servicios', 'max_idas_unidad')`),
  ]);
  const p = Object.fromEntries(par.map((x) => [x.clave, Number(x.valor)]));
  const unidades = provs.filter((x) => x.activo).reduce((a, x) => a + x.flota.filter((f) => f.activa).reduce((b, f) => b + (f.cantidad ?? 0), 0), 0);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold">Proveedores de transporte</h1>
          <p className="text-suave">
            {provs.filter((x) => x.activo).length} proveedores y {unidades} unidades, más los autobuses sobre pedido. Precios por servicio sin IVA
            ({Math.round((p.iva ?? 0.16) * 100)}% aparte). Cada servicio se cobra con la zona más lejana de sus paradas. Las unidades con renta cobran la renta
            del día cuando hacen {p.renta_min_servicios ?? 2} o más servicios en la mañana, y hacen como máximo {p.max_idas_unidad ?? 2} idas.
          </p>
        </div>
        {editar && <Link href="/catalogos/proveedores/nuevo" className="btn-primario">Agregar proveedor</Link>}
      </div>
      {provs.length === 0 && <p className="tarjeta p-4 text-suave">Todavía no hay proveedores cargados.</p>}
      {provs.map((pr) => (
        <section key={pr.id} className={`tarjeta grid gap-3 p-4 ${pr.activo ? '' : 'opacity-60'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{pr.nombre}</h2>
              <p className="text-sm text-suave">
                {[pr.razonSocial, pr.disponibilidad ? `Disponibilidad: ${pr.disponibilidad}` : null].filter(Boolean).join(' · ') || 'Sin datos de disponibilidad'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pr.segundaIda && <span className="chip bg-perlas-soft text-perlas">Renta del día · segunda ida</span>}
              {!pr.activo && <span className="chip bg-fondo text-suave">Inactivo</span>}
              <Link href={`/catalogos/proveedores/${pr.id}`} className="btn">{editar ? 'Editar' : 'Ver'}</Link>
            </div>
          </div>
          {pr.flota.length === 0 ? (
            <p className="text-sm text-suave">Sin flota ni tarifas capturadas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Unidad</th><th className="text-right">Cantidad</th><th className="text-right">Renta del día</th>
                    {zonas.map((z) => <th key={z.id} className="text-right">{z.nombre}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pr.flota.map((f) => (
                    <tr key={f.id} className={f.activa ? '' : 'opacity-50'}>
                      <td className="whitespace-nowrap">
                        <b>{f.tipo}</b> {f.capacidadMin && f.capacidadMin !== f.capacidad ? `${f.capacidadMin} a ${f.capacidad}` : f.capacidad} lugares
                        {f.redondo && <span className="ml-2 chip bg-pend-soft text-pend">ida y regreso</span>}
                      </td>
                      <td className="tabular text-right">{f.cantidad ?? 'Sobre pedido'}</td>
                      <td className="tabular text-right">{f.rentaDia != null ? pesos(f.rentaDia) : '—'}</td>
                      {zonas.map((z) => (
                        <td key={z.id} className="tabular whitespace-nowrap text-right">{f.precios[z.clave] != null ? pesos(f.precios[z.clave]) : <span className="text-suave">No va</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pr.notas && <p className="text-xs text-suave">{pr.notas}</p>}
        </section>
      ))}
    </div>
  );
}

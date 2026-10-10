import { q } from '@/lib/db';
import { PERMISOS, requerir } from '@/lib/auth';
import { guardarConfiguracion } from './actions';

export const dynamic = 'force-dynamic';

const PARAMS: [string, string, string][] = [
  ['capacidad_bloque', 'Lugares máximos por transporte', 'lugares'],
  ['max_pickups', 'Pick ups ideales por transporte', 'pick ups'],
  ['max_pickups_excepcion', 'Pick ups máximos como excepción', 'pick ups'],
  ['infantes_sin_lugar', 'Infantes por transporte que no ocupan lugar', 'infantes'],
  ['tolerancia_orden_min', 'Tolerancia al ordenar paradas hacia la marina', 'min'],
];

export default async function Configuracion({ searchParams }: { searchParams: { guardado?: string } }) {
  await requerir(PERMISOS.editarCatalogos);
  const params = Object.fromEntries((await q<{ clave: string; valor: string }>('select clave, valor from parametros')).map((p) => [p.clave, p.valor]));
  const zonas = await q<{ id: number; nombre: string; min_entre_pickups: number | null }>('select id, nombre, min_entre_pickups from zonas order by id');
  return (
    <form action={guardarConfiguracion} className="grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración de Alux</h1>
        <p className="text-suave">Reglas generales con las que Alux arma la operación de ida. Los cambios aplican la próxima vez que se genere o regenere una propuesta.</p>
      </div>
      {searchParams.guardado && <p className="chip w-fit bg-ok-soft text-ok">Configuración guardada</p>}
      <section className="tarjeta grid gap-4 p-5">
        <h2 className="text-lg font-bold">Reglas generales</h2>
        {PARAMS.map(([clave, txt, unidad]) => (
          <label key={clave} className="grid grid-cols-[1fr_150px] items-center gap-3 text-sm">
            <span>{txt}</span>
            <span className="flex items-center gap-2">
              <input type="number" min={0} name={`p_${clave}`} defaultValue={params[clave]} required className="campo tabular" />
              <span className="whitespace-nowrap text-xs text-suave">{unidad}</span>
            </span>
          </label>
        ))}
      </section>
      <section className="tarjeta grid gap-4 p-5">
        <div>
          <h2 className="text-lg font-bold">Tiempo mínimo entre pick ups por zona</h2>
          <p className="text-sm text-suave">
            Minutos de traslado y acceso que debe haber, según las horas del catálogo, entre un pick up y el siguiente cuando el siguiente está en esa zona.
            Alux no junta paradas que no lo cumplan y el tablero avisa si un cambio manual lo rompe. Déjalo vacío si la zona no tiene restricción.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {zonas.map((z) => (
            <label key={z.id} className="grid grid-cols-[1fr_110px] items-center gap-3 text-sm">
              <span>{z.nombre}</span>
              <span className="flex items-center gap-2">
                <input type="number" min={0} name={`z_${z.id}`} defaultValue={z.min_entre_pickups ?? ''} placeholder="—"
                  className={`campo tabular ${z.min_entre_pickups == null ? 'border-pend bg-pend-soft' : ''}`} />
                <span className="text-xs text-suave">min</span>
              </span>
            </label>
          ))}
        </div>
      </section>
      <div><button className="btn-primario">Guardar configuración</button></div>
    </form>
  );
}

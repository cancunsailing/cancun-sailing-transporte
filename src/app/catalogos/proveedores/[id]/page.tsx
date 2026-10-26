import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PERMISOS, puede, requerir } from '@/lib/auth';
import { catalogoProveedores, zonasDeTarifa, type FlotaCatalogo } from '@/lib/proveedores';
import { guardarFlota, guardarProveedor } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Proveedor({ params, searchParams }: { params: { id: string }; searchParams: { guardado?: string } }) {
  const s = await requerir(PERMISOS.verCatalogos);
  const editar = puede(s, PERMISOS.editarCatalogos);
  const nuevo = params.id === 'nuevo';
  const [p] = nuevo
    ? [{ id: 0, nombre: '', razonSocial: null, disponibilidad: null, segundaIda: false, notas: null, activo: true, flota: [] as FlotaCatalogo[] }]
    : await catalogoProveedores(Number(params.id));
  if (!p) notFound();
  const zonas = await zonasDeTarifa();

  const formaFlota = (f?: FlotaCatalogo) => (
    <form key={f?.id ?? 'nueva'} action={guardarFlota} className="tarjeta grid gap-4 p-4">
      <input type="hidden" name="transportista_id" value={p.id} />
      {f && <input type="hidden" name="id" value={f.id} />}
      <h3 className="font-bold">{f ? `${f.tipo} ${f.capacidadMin && f.capacidadMin !== f.capacidad ? `${f.capacidadMin} a ${f.capacidad}` : f.capacidad} lugares` : 'Agregar tipo de unidad'}</h3>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <label className="text-sm"><span className="etiqueta">Tipo</span>
          <input name="tipo" defaultValue={f?.tipo} required disabled={!editar} className="campo" placeholder="Sprinter, JAC, Urban…" /></label>
        <label className="text-sm"><span className="etiqueta">Lugares mínimos</span>
          <input name="capacidad_min" type="number" min={1} defaultValue={f?.capacidadMin ?? ''} disabled={!editar} className="campo tabular" placeholder="Si da un rango" /></label>
        <label className="text-sm"><span className="etiqueta">Lugares</span>
          <input name="capacidad" type="number" min={1} defaultValue={f?.capacidad} required disabled={!editar} className="campo tabular" /></label>
        <label className="text-sm"><span className="etiqueta">Cantidad</span>
          <input name="cantidad" type="number" min={0} defaultValue={f?.cantidad ?? ''} disabled={!editar} className="campo tabular" placeholder="Sobre pedido" /></label>
        <label className="text-sm"><span className="etiqueta">Renta del día</span>
          <input name="renta_dia" inputMode="decimal" defaultValue={f?.rentaDia ?? ''} disabled={!editar} className="campo tabular" placeholder="Sin renta" /></label>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="precio_redondo" defaultChecked={f?.redondo} disabled={!editar} /> El precio cubre ida y regreso</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="activa" defaultChecked={f ? f.activa : true} disabled={!editar} /> Disponible para asignar</label>
      </div>
      <fieldset>
        <legend className="etiqueta">Precio por servicio sin IVA (vacío = no va a esa zona)</legend>
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {zonas.map((z) => (
            <label key={z.id} className="text-sm"><span className="mb-1 block text-suave">{z.nombre}</span>
              <input name={`precio_${z.clave}`} inputMode="decimal" defaultValue={f?.precios[z.clave] ?? ''} disabled={!editar} className="campo tabular" placeholder="No va" /></label>
          ))}
        </div>
      </fieldset>
      {editar && <div><button className={f ? 'btn' : 'btn-primario'}>{f ? 'Guardar unidad' : 'Agregar unidad'}</button></div>}
    </form>
  );

  return (
    <div className="grid max-w-5xl gap-6">
      <Link href="/catalogos/proveedores" className="text-sm font-semibold text-suave hover:text-tinta">← Proveedores</Link>
      <h1 className="text-2xl font-bold">{nuevo ? 'Nuevo proveedor' : p.nombre}</h1>
      {searchParams.guardado && <p className="chip w-fit bg-ok-soft text-ok">Cambios guardados</p>}
      <form action={guardarProveedor} className="tarjeta grid gap-4 p-5 sm:grid-cols-2">
        {!nuevo && <input type="hidden" name="id" value={p.id} />}
        <label className="text-sm"><span className="etiqueta">Nombre</span>
          <input name="nombre" defaultValue={p.nombre} required disabled={!editar} className="campo" /></label>
        <label className="text-sm"><span className="etiqueta">Razón social</span>
          <input name="razon_social" defaultValue={p.razonSocial ?? ''} disabled={!editar} className="campo" /></label>
        <label className="text-sm sm:col-span-2"><span className="etiqueta">Disponibilidad</span>
          <input name="disponibilidad" defaultValue={p.disponibilidad ?? ''} disabled={!editar} className="campo" placeholder="Cuándo confirma sus unidades, p. ej. La actualiza cada tarde" /></label>
        <label className="text-sm sm:col-span-2"><span className="etiqueta">Notas</span>
          <textarea name="notas" defaultValue={p.notas ?? ''} disabled={!editar} rows={2} className="campo" /></label>
        <div className="flex flex-wrap gap-5 text-sm sm:col-span-2">
          <label className="flex items-center gap-2"><input type="checkbox" name="segunda_ida" defaultChecked={p.segundaIda} disabled={!editar} /> Sus unidades cobran renta del día y pueden hacer segunda ida</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="activo" defaultChecked={p.activo} disabled={!editar} /> Activo</label>
        </div>
        {editar && <div className="sm:col-span-2"><button className="btn-primario">{nuevo ? 'Crear proveedor' : 'Guardar'}</button></div>}
      </form>
      {!nuevo && (
        <section className="grid gap-3">
          <div>
            <h2 className="text-lg font-bold">Flota y tarifas</h2>
            <p className="text-sm text-suave">Un renglón por tipo de unidad. Alux usa la cantidad para no asignar más unidades de las que hay, y el precio de cada zona para elegir la opción más barata.</p>
          </div>
          {p.flota.map((f) => formaFlota(f))}
          {editar && formaFlota()}
        </section>
      )}
    </div>
  );
}

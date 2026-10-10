import { q } from '@/lib/db';
import { PERMISOS, puede, requerir } from '@/lib/auth';
import { guardarProducto } from './actions';

export const dynamic = 'force-dynamic';

export default async function Productos() {
  const s = await requerir(PERMISOS.verCatalogos);
  const editar = puede(s, PERMISOS.editarCatalogos);
  const productos = await q<{ id: number; nombre: string; hora: string; marina_id: number | null; columna_horario_id: number | null; nombres_reporte: string[] }>(
    `select id, nombre, to_char(hora_salida, 'HH24:MI') hora, marina_id, columna_horario_id, nombres_reporte from productos where activo order by hora_salida, nombre`,
  );
  const marinas = await q<{ id: number; nombre: string }>('select id, nombre from marinas order by id');
  const columnas = await q<{ id: number; nombre: string }>('select id, nombre from columnas_horario order by id');
  const fila = (p?: (typeof productos)[number]) => (
    <form key={p?.id ?? 'nuevo'} action={guardarProducto} className="grid items-end gap-2 border-b border-linea p-3 md:grid-cols-[2fr_90px_1.2fr_2fr_2fr_auto]">
      {p && <input type="hidden" name="id" value={p.id} />}
      <label className="text-sm"><span className="etiqueta md:sr-only">Producto</span>
        <input name="nombre" defaultValue={p?.nombre} required disabled={!editar} className="campo" placeholder="Nombre del producto" /></label>
      <label className="text-sm"><span className="etiqueta md:sr-only">Salida</span>
        <input name="hora" type="time" defaultValue={p?.hora} required disabled={!editar} className="campo font-mono" /></label>
      <label className="text-sm"><span className="etiqueta md:sr-only">Marina</span>
        <select name="marina_id" defaultValue={p?.marina_id ?? ''} disabled={!editar} className={`campo ${p && !p.marina_id ? 'border-pend bg-pend-soft' : ''}`}>
          <option value="">Por confirmar</option>
          {marinas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select></label>
      <label className="text-sm"><span className="etiqueta md:sr-only">Horario de pick up</span>
        <select name="columna_horario_id" defaultValue={p?.columna_horario_id ?? ''} disabled={!editar} className="campo">
          <option value="">Sin columna</option>
          {columnas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select></label>
      <label className="text-sm"><span className="etiqueta md:sr-only">Nombres en la orden</span>
        <input name="nombres" defaultValue={p?.nombres_reporte.join(', ')} disabled={!editar} className="campo font-mono text-xs" placeholder="PLUSEXPERIENCE, …" /></label>
      {editar && <button className={p ? 'btn' : 'btn-primario'}>{p ? 'Guardar' : 'Agregar'}</button>}
    </form>
  );
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Productos</h1>
        <p className="text-suave">
          La marina la define el producto con su horario de salida. La columna indica qué horario del catálogo de hoteles se usa para validar el pick up.
          Los nombres en la orden son como aparecen en la columna Excursión, sin la hora.
        </p>
      </div>
      <div className="tarjeta">
        <div className="hidden grid-cols-[2fr_90px_1.2fr_2fr_2fr_auto] gap-2 border-b border-linea px-3 py-2 text-xs font-semibold uppercase tracking-wide text-suave md:grid">
          <span>Producto</span><span>Salida</span><span>Marina</span><span>Horario de pick up</span><span>Nombres en la orden</span><span></span>
        </div>
        {productos.map((p) => fila(p))}
        {editar && fila()}
      </div>
    </div>
  );
}

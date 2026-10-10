'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { subirOrden } from './actions';

function Boton() {
  const { pending } = useFormStatus();
  return <button className="btn-primario" disabled={pending}>{pending ? 'Procesando…' : 'Subir y armar propuesta'}</button>;
}

export function SubirOrden() {
  const [estado, accion] = useFormState(subirOrden, {});
  return (
    <form action={accion} className="tarjeta flex flex-wrap items-end gap-4 p-4">
      <div className="min-w-0 flex-1">
        <label htmlFor="archivo" className="etiqueta">Orden de servicio (archivo .xls tal cual se descarga)</label>
        <input id="archivo" name="archivo" type="file" accept=".xls,.html,.htm" required className="campo" />
        <p className="mt-1 text-xs text-suave">Si la fecha ya existe, se actualiza: entran las reservas nuevas, salen las canceladas y se conservan los transportes de las que no cambiaron.</p>
      </div>
      <Boton />
      {estado?.error && <p className="w-full text-sm font-semibold text-alerta">{estado.error}</p>}
    </form>
  );
}

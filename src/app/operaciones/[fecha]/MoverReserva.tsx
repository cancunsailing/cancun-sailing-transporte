'use client';
import { useState } from 'react';
import { moverReserva } from '../actions';

export function MoverReserva({ reservaId, operacionId, destinos, actual }: { reservaId: number; operacionId: number; destinos: { id: number; etiqueta: string }[]; actual: number | null }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return <button type="button" className="text-xs font-semibold text-perlas hover:underline" onClick={() => setAbierto(true)}>Mover</button>;
  }
  return (
    <form action={moverReserva} className="mt-2 grid w-full gap-2 rounded border border-linea bg-fondo p-2" onSubmit={() => setTimeout(() => setAbierto(false), 0)}>
      <input type="hidden" name="reserva_id" value={reservaId} />
      <input type="hidden" name="operacion_id" value={operacionId} />
      <label className="text-xs font-semibold text-suave" htmlFor={`destino-${reservaId}`}>Mover a</label>
      <select id={`destino-${reservaId}`} name="destino" required className="campo" defaultValue="">
        <option value="" disabled>Elige un transporte…</option>
        <option value="nuevo">Transporte nuevo</option>
        {actual !== null && <option value="sin_asignar">Sin asignar</option>}
        {destinos.filter((d) => d.id !== actual).map((d) => <option key={d.id} value={d.id}>{d.etiqueta}</option>)}
      </select>
      <label className="text-xs font-semibold text-suave" htmlFor={`com-${reservaId}`}>¿Por qué? Alux aprende de este comentario (opcional)</label>
      <textarea id={`com-${reservaId}`} name="comentario" rows={2} className="campo" placeholder="Ej. Este hotel siempre va con la ruta de Zona Hotelera km 9" />
      <div className="flex gap-2">
        <button className="btn-primario">Mover</button>
        <button type="button" className="btn" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </form>
  );
}

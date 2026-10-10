import type { FilaOrden } from './parser';
import { hhmm, norm, parseExcursion } from '../normalize';

export type ProductoCat = { id: number; nombre: string; hora: string; marinaId: number | null; columnaId: number | null; nombresReporte: string[] };
export type Catalogo = {
  alias: Map<string, number>;              // alias normalizado → hotel_id
  productos: ProductoCat[];
  pickups: Map<string, string>;            // `${hotelId}:${columnaId}` → "HH:MM"
};

export type EstadoReserva = 'transporte' | 'llegan_directo' | 'sin_datos' | 'charter' | 'solo_regreso';

export type ReservaClasificada = FilaOrden & {
  estado: EstadoReserva;
  hotelId: number | null;
  productoId: number | null;
  marinaId: number | null;
  horaTour: string | null;
  horaPickup: string | null;
  notaTransporte: string | null;
  alertas: string[];
};

const TRANSPORTE = /(PUP|PICK ?UP|RECOG|RECOJ|REGRES|VAN\b|UNIDAD|PUNTO DE ENCUENTRO|LOBBY|PLUMA|PUERTA)/i;
const NO_TRANSPORTE = /(PAGA|PAGO|BALANCE|USD|TAX|ALERG|CUMPLE|CELEBRA|PROMO|VENDE|CONTACT VALUE|INCLUSIONS|A CONFIRMAR)/i;

/** Conserva solo los fragmentos del comentario que tienen que ver con transporte. */
export function notaDeTransporte(comentario: string): string | null {
  const partes = comentario
    .split(/-\|-|\/\/|;/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => TRANSPORTE.test(p) && !NO_TRANSPORTE.test(p));
  return partes.length ? partes.join(' · ') : null;
}

export function clasificar(filas: FilaOrden[], cat: Catalogo): ReservaClasificada[] {
  return filas.map((f) => {
    const alertas: string[] = [];
    const hotelTxt = f.hotel.trim();
    const hora = hhmm(f.hora);
    const exc = parseExcursion(f.excursion);
    const nota = notaDeTransporte(f.comentario);
    let estado: EstadoReserva = 'transporte';

    if (norm(hotelTxt) === 'LLEGANDIRECTO') estado = 'llegan_directo';
    else if (norm(f.excursion) === 'CHARTER') estado = 'charter';
    else if (!hotelTxt && !hora) estado = 'sin_datos';
    else if (/SOLO SE LES DA EL REGRESO|SOLO REGRESO/i.test(f.comentario)) estado = 'solo_regreso';

    let hotelId: number | null = null;
    let producto: ProductoCat | undefined;
    if (estado === 'transporte' || estado === 'charter' || estado === 'solo_regreso') {
      hotelId = cat.alias.get(norm(hotelTxt)) ?? null;
      if (hotelTxt && !hotelId) alertas.push('Hotel no reconocido en el catálogo');
    }
    if (estado === 'charter') {
      alertas.push('Charter: logística manual según el cliente');
    }
    if (estado !== 'llegan_directo' && estado !== 'sin_datos') {
      if (hora === '00:00') alertas.push('Hora 00:00: verificar con reservas');
      if (!hora && estado === 'transporte') alertas.push('Sin hora de pick up');
    }
    if (estado === 'transporte' || estado === 'solo_regreso') {
      producto = cat.productos.find((p) => p.hora === exc.hora && p.nombresReporte.includes(exc.nombreNorm));
      if (!producto) alertas.push('Producto sin regla de marina en el catálogo');
      else if (!producto.marinaId) alertas.push('Marina por confirmar para este producto');
      if (producto && hotelId && producto.columnaId && hora && hora !== '00:00') {
        const esperado = cat.pickups.get(`${hotelId}:${producto.columnaId}`);
        if (esperado && esperado !== hora) alertas.push(`Pick up ${hora} distinto al catálogo (${esperado})`);
        if (!esperado) alertas.push('El hotel no tiene horario de catálogo para este producto');
      }
    }
    return {
      ...f,
      estado,
      hotelId,
      productoId: producto?.id ?? null,
      marinaId: producto?.marinaId ?? null,
      horaTour: exc.hora,
      horaPickup: hora,
      notaTransporte: nota,
      alertas,
    };
  });
}

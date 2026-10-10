import { parse } from 'node-html-parser';

/** Fila tal como viene en la orden de servicio del sistema de reservas. */
export type FilaOrden = {
  cliente: string;
  cupon: string;
  hab: string;
  hotel: string;
  reserva: string;
  hora: string;
  adultos: number;
  menores: number;
  infantes: number;
  excursion: string;
  rep: string;
  agencia: string;
  preferencia: string;
  comentario: string;
};

export type OrdenParseada = { fecha: string | null; filas: FilaOrden[] };

const MESES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07',
  agosto: '08', septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};

const COLS: Record<string, keyof FilaOrden> = {
  CLIENTE: 'cliente', CUPON: 'cupon', HAB: 'hab', HOTEL: 'hotel', RESERVA: 'reserva', HORA: 'hora',
  ADTS: 'adultos', MNRS: 'menores', INF: 'infantes', EXCURCION: 'excursion', EXCURSION: 'excursion',
  REP: 'rep', AGENCIA: 'agencia', PREFERENCIA: 'preferencia', COMENTARIO: 'comentario',
};

/** Repara texto doblemente codificado (p. ej. "CancÃºn" → "Cancún"). */
export function repararTexto(s: string): string {
  if (!/[ÃÂ]/.test(s)) return s;
  try {
    const bytes = Uint8Array.from([...s].map((ch) => ch.charCodeAt(0) & 0xff));
    const out = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return out;
  } catch {
    return s;
  }
}

function limpio(s: string | undefined): string {
  return repararTexto(
    String(s ?? '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function sinAcentos(s: string) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

/** Lee el archivo de la orden de servicio (HTML con extensión .xls). */
export function parsearOrden(html: string): OrdenParseada {
  const root = parse(html);
  const texto = limpio(root.text);
  let fecha: string | null = null;
  const f = sinAcentos(texto).match(/FECHA:\s*[A-Z]+,\s*(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/);
  if (f && MESES[f[2].toLowerCase()]) fecha = `${f[3]}-${MESES[f[2].toLowerCase()]}-${f[1].padStart(2, '0')}`;

  const rows = root.querySelectorAll('tr');
  let header: (keyof FilaOrden | null)[] | null = null;
  const filas: FilaOrden[] = [];
  for (const tr of rows) {
    const cells = tr.querySelectorAll('th, td').map((c) => limpio(c.text));
    if (!header) {
      const keys = cells.map((c) => COLS[sinAcentos(c).replace(/[^A-Z]/g, '')] ?? null);
      if (keys.includes('cliente') && keys.includes('reserva')) header = keys;
      continue;
    }
    const fila: Record<string, string | number> = {};
    header.forEach((k, i) => {
      if (k) fila[k] = cells[i] ?? '';
    });
    if (!fila.reserva) continue; // totales u otras filas sin reserva
    filas.push({
      cliente: String(fila.cliente ?? ''),
      cupon: String(fila.cupon ?? ''),
      hab: String(fila.hab ?? ''),
      hotel: String(fila.hotel ?? ''),
      reserva: String(fila.reserva ?? ''),
      hora: String(fila.hora ?? ''),
      adultos: Number(fila.adultos) || 0,
      menores: Number(fila.menores) || 0,
      infantes: Number(fila.infantes) || 0,
      excursion: String(fila.excursion ?? ''),
      rep: String(fila.rep ?? ''),
      agencia: String(fila.agencia ?? ''),
      preferencia: String(fila.preferencia ?? ''),
      comentario: String(fila.comentario ?? ''),
    });
  }
  if (!header) throw new Error('No se encontró la tabla de reservas (encabezados Cliente / Reserva).');
  return { fecha, filas };
}

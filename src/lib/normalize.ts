/** Normaliza un nombre para comparar: sin acentos, mayúsculas, solo letras y números. */
export function norm(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Convierte "8:50", "08:50" o "08:50:00" a "08:50". Devuelve null si no es una hora válida. */
export function hhmm(s: string | null | undefined): string | null {
  const m = String(s ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function minutos(h: string): number {
  const [a, b] = h.split(':').map(Number);
  return a * 60 + b;
}

/** Separa "Plus Experience ( 10:00 )" en nombre normalizado y hora. */
export function parseExcursion(s: string | null | undefined): { nombre: string; nombreNorm: string; hora: string | null } {
  const txt = String(s ?? '').trim();
  const m = txt.match(/^(.*?)\(\s*(\d{1,2}:\d{2})\s*\)\s*$/);
  const nombre = (m ? m[1] : txt).trim();
  return { nombre, nombreNorm: norm(nombre), hora: m ? hhmm(m[2]) : null };
}

export function titulo(s: string): string {
  return s.toLowerCase().replace(/(^|[\s/(.-])([a-záéíóúñ])/g, (_, a, b) => a + b.toUpperCase());
}

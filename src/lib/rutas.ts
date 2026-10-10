/**
 * Tiempo de manejo de un punto a las marinas. Sirve solo para ordenar paradas sobre la ruta;
 * los tiempos operativos entre hoteles los define transportación.
 * Usa OSRM (OSRM_URL); si no responde, estima por distancia en línea recta.
 */
export type Punto = { lat: number; lon: number };

export function kmLineaRecta(a: Punto, b: Punto): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function tiemposAMarinas(p: Punto, marinas: (Punto & { id: number })[]): Promise<{ marinaId: number; minutos: number; km: number }[]> {
  const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
  const coords = [p, ...marinas].map((x) => `${x.lon.toFixed(6)},${x.lat.toFixed(6)}`).join(';');
  try {
    const r = await fetch(`${base}/table/v1/driving/${coords}?sources=0&annotations=duration,distance`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j.code === 'Ok') {
      return marinas.map((m, i) => ({
        marinaId: m.id,
        minutos: Math.round((j.durations[0][i + 1] / 60) * 10) / 10,
        km: Math.round((j.distances[0][i + 1] / 1000) * 10) / 10,
      }));
    }
  } catch {
    /* se usa la estimación */
  }
  return marinas.map((m) => {
    const km = kmLineaRecta(p, m) * 1.3;
    return { marinaId: m.id, minutos: Math.round((km / 50) * 600) / 10, km: Math.round(km * 10) / 10 };
  });
}

/** Acepta "21.15, -86.79" o una liga de Google Maps (…/@21.15,-86.79,… o …!3d21.15!4d-86.79…). */
export function leerCoordenadas(txt: string): Punto | null {
  const s = txt.trim();
  const d = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (d) return { lat: Number(d[1]), lon: Number(d[2]) };
  const at = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lon: Number(at[2]) };
  const par = s.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (par) return { lat: Number(par[1]), lon: Number(par[2]) };
  return null;
}

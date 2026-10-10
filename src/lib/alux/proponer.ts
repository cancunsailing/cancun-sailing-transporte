/**
 * Alux · propuesta de operación de ida.
 *
 * Reglas confirmadas con operación:
 * - Solo se juntan reservas con la misma marina y el mismo horario de salida del tour.
 * - Cada transporte recoge del hotel más lejano al más cercano a su marina, sin regresarse.
 * - Rutas a Las Perlas: Sur (Tulum a Puerto Morelos) o Norte (Costa Mujeres, Playa Mujeres,
 *   Puerto Juárez); ambas pueden terminar en Cancún Centro y Zona Hotelera.
 * - Rutas a Punta Norte: Sur puede sumar Cancún Centro y Puerto Juárez. La Zona Hotelera va en
 *   transportes propios (entrar a ella camino a Punta Norte desperdicia tiempo). Costa y Playa
 *   Mujeres van directo.
 * - Límite de lugares por transporte (20). Adultos y menores ocupan lugar; los primeros 2
 *   infantes por transporte no, del tercero en adelante sí.
 * - Máximo ideal de 4 pick ups; un quinto se permite como excepción.
 * - Un pick up es una parada en un hotel o punto, sin importar cuántas reservas suban ahí.
 * - Entre dos pick ups consecutivos debe haber al menos el tiempo mínimo configurado para la zona
 *   a la que se llega (p. ej. Riviera Maya 10 min, Zona Hotelera 5, Playacar 1), según las horas
 *   de pick up del catálogo.
 */

export type ReservaAlux = {
  id: number;
  hotelId: number | null;
  hotelNombre: string;
  zonaClave: string | null;
  marinaId: number;
  marinaNombre: string;
  horaTour: string;
  horaPickup: string | null;
  pax: number;      // adultos + menores
  infantes: number;
  minutosMarina: number | null; // tiempo de manejo del hotel a su marina
};

export type ParametrosAlux = {
  capacidad: number;
  maxPickups: number;
  maxPickupsExcepcion: number;
  infantesSinLugar: number;
  toleranciaMin: number;
  /** Minutos mínimos entre pick ups consecutivos por clave de zona (sin valor = sin restricción). */
  minEntrePickups?: Record<string, number | null | undefined>;
};

export const PARAMETROS_BASE: ParametrosAlux = {
  capacidad: 20,
  maxPickups: 4,
  maxPickupsExcepcion: 5,
  infantesSinLugar: 2,
  toleranciaMin: 3,
};

export type TransportePropuesto = {
  marinaId: number;
  marinaNombre: string;
  horaTour: string;
  reservaIds: number[];  // en orden de recolección
  lugares: number;
  pickups: number;
  alertas: string[];
};

type Parada = {
  clave: string;
  reservas: ReservaAlux[];
  pax: number;
  infantes: number;
  dm: number;
  horaPickup: string;
  tramo: string;
  zona: string | null;
};

type Van = { paradas: Parada[]; pax: number; infantes: number };

const SUR = new Set(['TULUM', 'RM_Z1', 'RM_Z2', 'RM_Z3', 'PLAYACAR', 'PDC', 'PTO_MORELOS']);

export function tramo(marina: string, zona: string | null): string {
  if (!zona) return 'Sin zona';
  if (SUR.has(zona)) return 'Sur';
  if (zona === 'COSTA_MUJERES' || zona === 'PLAYA_MUJERES') return 'Norte';
  if (marina === 'Punta Norte') return zona === 'CUN_ZH' ? 'ZH' : 'Cancún'; // Centro y Puerto Juárez
  return zona === 'PTO_JUAREZ' ? 'Norte' : 'Cancún';                         // ZH y Centro
}

const PERMITIDOS: Record<string, string[][]> = {
  'Las Perlas': [['Sur', 'Cancún'], ['Norte', 'Cancún']],
  'Punta Norte': [['Sur', 'Cancún'], ['ZH', 'Cancún'], ['Norte']],
};

const aMin = (h: string) => (/^\d{2}:\d{2}$/.test(h) ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null);

/** Revisa que cada pick up quede al menos el tiempo mínimo de su zona después del anterior. */
export function violacionesTiempo(
  paradas: { horaPickup: string | null; zona: string | null }[],
  minimos: Record<string, number | null | undefined> = {},
): { indice: number; zona: string; minimo: number; diferencia: number }[] {
  const out: { indice: number; zona: string; minimo: number; diferencia: number }[] = [];
  for (let i = 1; i < paradas.length; i++) {
    const z = paradas[i].zona;
    const m = z ? minimos[z] : null;
    if (m == null || !z) continue;
    const a = aMin(paradas[i - 1].horaPickup ?? ''), b = aMin(paradas[i].horaPickup ?? '');
    if (a == null || b == null) continue;
    if (b - a < m) out.push({ indice: i, zona: z, minimo: m, diferencia: b - a });
  }
  return out;
}

export function lugares(pax: number, infantes: number, p: ParametrosAlux = PARAMETROS_BASE): number {
  return pax + Math.max(0, infantes - p.infantesSinLugar);
}

export function proponer(reservas: ReservaAlux[], p: ParametrosAlux = PARAMETROS_BASE): TransportePropuesto[] {
  const grupos = new Map<string, ReservaAlux[]>();
  for (const r of reservas) {
    const k = `${r.marinaNombre}|${r.horaTour}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(r);
  }
  const salida: TransportePropuesto[] = [];
  const claves = [...grupos.keys()].sort((a, b) => {
    const [ma, ha] = a.split('|');
    const [mb, hb] = b.split('|');
    return ma === mb ? ha.localeCompare(hb) : ma.localeCompare(mb);
  });

  for (const k of claves) {
    const rs = grupos.get(k)!;
    const marina = rs[0].marinaNombre;
    const permitidos = PERMITIDOS[marina];

    // Paradas: una por hotel (o por texto de hotel si no está en el catálogo)
    const porHotel = new Map<string, ReservaAlux[]>();
    for (const r of rs) {
      const c = r.hotelId ? `h${r.hotelId}` : `t${r.hotelNombre}`;
      if (!porHotel.has(c)) porHotel.set(c, []);
      porHotel.get(c)!.push(r);
    }
    let paradas: Parada[] = [...porHotel.entries()].map(([clave, list]) => ({
      clave,
      reservas: list,
      pax: list.reduce((a, r) => a + r.pax, 0),
      infantes: list.reduce((a, r) => a + r.infantes, 0),
      dm: list[0].minutosMarina ?? 0,
      horaPickup: list.map((r) => r.horaPickup ?? '99:99').sort()[0],
      tramo: tramo(marina, list[0].zonaClave),
      zona: list[0].zonaClave,
    }));
    paradas.sort((a, b) => b.dm - a.dm || a.horaPickup.localeCompare(b.horaPickup));

    const vans: Van[] = [];
    const nueva = (s: Parada): Van => ({ paradas: [s], pax: s.pax, infantes: s.infantes });

    // Paradas que no caben en un transporte: repartir sus reservas en transportes completos
    const pendientes: Parada[] = [];
    for (const s of paradas) {
      if (lugares(s.pax, s.infantes, p) <= p.capacidad) {
        pendientes.push(s);
        continue;
      }
      const orden = [...s.reservas].sort((a, b) => b.pax - a.pax);
      let actual: ReservaAlux[] = [];
      const cerrar = () => {
        if (!actual.length) return;
        vans.push(nueva({ ...s, reservas: actual, pax: actual.reduce((a, r) => a + r.pax, 0), infantes: actual.reduce((a, r) => a + r.infantes, 0) }));
        actual = [];
      };
      const resto: ReservaAlux[] = [];
      for (const r of orden) {
        const tmp = [...actual, r];
        const l = lugares(tmp.reduce((a, x) => a + x.pax, 0), tmp.reduce((a, x) => a + x.infantes, 0), p);
        if (l <= p.capacidad) actual = tmp;
        else if (lugares(r.pax, r.infantes, p) > p.capacidad) vans.push(nueva({ ...s, reservas: [r], pax: r.pax, infantes: r.infantes }));
        else { resto.push(...actual); actual = [r]; }
      }
      // lo que quedó suelto se vuelve una parada normal para barrerse con otras
      const sueltos = [...resto, ...actual];
      // empaca en transportes llenos lo más posible y deja el sobrante como pendiente
      let bolsa: ReservaAlux[] = [];
      for (const r of sueltos) {
        const tmp = [...bolsa, r];
        if (lugares(tmp.reduce((a, x) => a + x.pax, 0), tmp.reduce((a, x) => a + x.infantes, 0), p) <= p.capacidad) bolsa = tmp;
        else { actual = bolsa; cerrar(); bolsa = [r]; }
      }
      if (bolsa.length) pendientes.push({ ...s, reservas: bolsa, pax: bolsa.reduce((a, r) => a + r.pax, 0), infantes: bolsa.reduce((a, r) => a + r.infantes, 0) });
    }
    paradas = pendientes;

    // Dentro de un transporte las paradas van en el orden de sus horas de pick up del catálogo
    // (son fijas); la distancia a la marina decide qué paradas quedan de paso.
    const ordenar = (ps: Parada[]) => [...ps].sort((a, b) => a.horaPickup.localeCompare(b.horaPickup) || b.dm - a.dm);
    const avanza = (sec: Parada[]) => sec.every((x, i) => i === 0 || x.dm <= sec[i - 1].dm + p.toleranciaMin);
    const cabe = (v: Van, s: Parada, max: number) =>
      lugares(v.pax + s.pax, v.infantes + s.infantes, p) <= p.capacidad && v.paradas.length < max;
    const compatible = (v: Van, s: Parada) => {
      const tramos = new Set([...v.paradas.map((x) => x.tramo), s.tramo]);
      if (tramos.has('Sin zona')) return false;
      if (permitidos && !permitidos.some((ok) => [...tramos].every((t) => ok.includes(t)))) return false;
      const sec = ordenar([...v.paradas, s]);
      return avanza(sec) && violacionesTiempo(sec, p.minEntrePickups).length === 0;
    };
    const agregar = (v: Van, s: Parada) => {
      v.paradas = ordenar([...v.paradas, s]);
      v.pax += s.pax;
      v.infantes += s.infantes;
    };

    // Barrido: del más lejano al más cercano; cada parada entra al transporte más lleno que la acepte
    for (const s of paradas) {
      const opciones = vans.filter((v) => compatible(v, s) && cabe(v, s, p.maxPickups));
      if (opciones.length) agregar(opciones.reduce((a, b) => (b.pax > a.pax ? b : a)), s);
      else vans.push(nueva(s));
    }

    // Consolidar: transportes de una sola parada que caben en otro (permitiendo el quinto pick up)
    let cambio = true;
    while (cambio) {
      cambio = false;
      vans.sort((a, b) => lugares(a.pax, a.infantes, p) - lugares(b.pax, b.infantes, p));
      for (const chica of vans) {
        if (chica.paradas.length !== 1) continue;
        const s = chica.paradas[0];
        const ops = vans.filter((v) => v !== chica && compatible(v, s) && cabe(v, s, p.maxPickupsExcepcion));
        if (ops.length) {
          const destino = ops.reduce((a, b) => (b.pax > a.pax ? b : a));
          agregar(destino, s);
          destino.paradas = ordenar(destino.paradas);
          vans.splice(vans.indexOf(chica), 1);
          cambio = true;
          break;
        }
      }
    }

    vans.sort((a, b) => a.paradas[0].horaPickup.localeCompare(b.paradas[0].horaPickup));
    for (const v of vans) {
      const l = lugares(v.pax, v.infantes, p);
      const alertas: string[] = [];
      if (v.paradas.length > p.maxPickups) alertas.push(`${v.paradas.length} pick ups`);
      if (l > p.capacidad) alertas.push('Reserva más grande que la capacidad: requiere unidad mayor');
      if (l <= 4) alertas.push(marina === 'Punta Norte' ? 'Pocos pasajeros: evaluar drop off extra desde Las Perlas' : 'Pocos pasajeros');
      if (v.paradas.some((s) => s.tramo === 'Sin zona')) alertas.push('Hotel sin zona: revisar');
      salida.push({
        marinaId: rs[0].marinaId,
        marinaNombre: marina,
        horaTour: rs[0].horaTour,
        reservaIds: v.paradas.flatMap((s) => s.reservas.map((r) => r.id)),
        lugares: l,
        pickups: v.paradas.length,
        alertas,
      });
    }
  }
  return salida;
}

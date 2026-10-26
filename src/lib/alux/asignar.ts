/**
 * Alux asigna proveedor y tipo de unidad a cada servicio de ida.
 *
 * Reglas de operación (Jimmy Vera, 26 oct 2026):
 * - Se elige el proveedor más barato que esté disponible.
 * - Solo las unidades de renta (Link Shuttle, Lets Rent, JG Rent) hacen una segunda ida en la mañana;
 *   si no alcanzan, se usan proveedores por servicio con disponibilidad.
 * - Un proveedor puede ir a cualquier zona donde tenga precio.
 *
 * Es una heurística: primero arma las unidades de renta con dos o más idas cuando eso cuesta menos
 * que pagar cada servicio por separado, y después asigna un servicio por unidad, del más difícil al más fácil.
 */
import { costoDiaUnidad, costoIdaYRegreso, precioServicio, type Tarifario, type TipoUnidad } from '../costos';

export type ServicioIda = {
  id: number;
  lugares: number;
  /** Zona de cobro de cada parada */
  zonas: (string | null)[];
  /** Minuto del día en que la unidad llega al primer pick up */
  inicio: number | null;
  /** Minuto del día en que llega a la marina */
  fin: number | null;
  marinaId: number | null;
  /** Minutos de manejo del primer pick up a cada marina (para saber si una unidad alcanza a llegar desde la marina) */
  minutosPrimerHotel: Record<number, number | null | undefined>;
};

export type UnidadAsignada = {
  tipo: TipoUnidad;
  servicios: number[];
  precios: number[];
  subtotal: number;
  renta: boolean;
};

/** divididos: servicios que no caben en ninguna unidad de la flota y se reparten en varias, como hace operación con los grupos grandes */
export type Asignacion = { unidades: UnidadAsignada[]; sinUnidad: number[]; divididos: number[] };

/** Si no se conoce el tiempo de la marina al siguiente pick up, se supone media hora. */
const TRASLADO_DEFECTO_MIN = 30;
/** A partir de estos lugares la unidad es un autobús (sobre pedido o con pocas unidades). */
const CAPACIDAD_AUTOBUS = 30;

/** ¿La unidad que hizo el servicio a alcanza a llegar al primer pick up del servicio b? */
export function puedeEncadenar(a: ServicioIda, b: ServicioIda, margenMin: number): boolean {
  if (a.fin == null || b.inicio == null || a.marinaId == null) return false;
  const traslado = b.minutosPrimerHotel[a.marinaId] ?? TRASLADO_DEFECTO_MIN;
  return a.fin + margenMin + traslado <= b.inicio;
}

export function asignarProveedores(entrada: ServicioIda[], tar: Tarifario): Asignacion {
  const precio = (t: TipoUnidad, s: Pick<ServicioIda, 'lugares' | 'zonas'>) => (t.capacidad >= s.lugares ? precioServicio(t, s.zonas) : null);
  const masBarato = (s: Pick<ServicioIda, 'lugares' | 'zonas'>) =>
    Math.min(Infinity, ...tar.tipos.map((t) => precio(t, s)).map((p, i) => (p == null ? Infinity : costoIdaYRegreso(tar.tipos[i], p))));

  // Un grupo que no cabe en una van se reparte en varias unidades, como hace operación,
  // salvo que un autobús salga más barato que repartirlo
  const maxVan = Math.max(0, ...tar.tipos.filter((t) => t.cantidad != null && t.capacidad < CAPACIDAD_AUTOBUS).map((t) => t.capacidad));
  const original = new Map<number, number>();
  const divididos: number[] = [];
  const servicios: ServicioIda[] = [];
  let interno = -1;
  for (const s of entrada) {
    if (maxVan > 0 && s.lugares > maxVan) {
      const k = Math.ceil(s.lugares / maxVan);
      const cada = Math.ceil(s.lugares / k);
      const partes = Array.from({ length: k }, (_, i) => ({ ...s, id: interno - i, lugares: Math.min(cada, s.lugares - cada * i) }));
      if (partes.reduce((a, p) => a + masBarato(p), 0) <= masBarato(s)) {
        interno -= k;
        divididos.push(s.id);
        partes.forEach((p) => { original.set(p.id, s.id); servicios.push(p); });
        continue;
      }
    }
    original.set(s.id, s.id);
    servicios.push(s);
  }
  const opciones = new Map(servicios.map((s) => [s.id, tar.tipos.filter((t) => precio(t, s) != null)]));
  // Lo que costaría cada servicio por separado con la opción más barata, sin contar disponibilidad
  const alterno = new Map(
    servicios.map((s) => {
      const c = opciones.get(s.id)!.map((t) => costoIdaYRegreso(t, precio(t, s)!));
      return [s.id, c.length ? Math.min(...c) : Infinity];
    }),
  );
  const usadas = new Map<number, number>();
  const libres = (t: TipoUnidad) => (t.cantidad ?? 0) - (usadas.get(t.id) ?? 0);
  const pendientes = new Map(servicios.map((s) => [s.id, s]));
  const unidades: UnidadAsignada[] = [];
  const cerrar = (t: TipoUnidad, ss: ServicioIda[]) => {
    const precios = ss.map((s) => precio(t, s)!);
    const c = costoDiaUnidad(t, precios, tar.rentaMinServicios);
    unidades.push({ tipo: t, servicios: ss.map((s) => original.get(s.id)!), precios, subtotal: c.subtotal, renta: c.renta });
    ss.forEach((s) => pendientes.delete(s.id));
    usadas.set(t.id, (usadas.get(t.id) ?? 0) + 1);
  };

  // 1. Unidades de renta con dos o más idas
  const deRenta = tar.tipos.filter((t) => t.segundaIda && t.rentaDia != null);
  for (;;) {
    let mejor: { t: TipoUnidad; a: ServicioIda; b: ServicioIda; ahorro: number } | null = null;
    for (const t of deRenta) {
      if (libres(t) <= 0) continue;
      const elig = [...pendientes.values()].filter((s) => precio(t, s) != null);
      for (const a of elig) {
        for (const b of elig) {
          if (a === b || !puedeEncadenar(a, b, tar.margenSegundaIdaMin)) continue;
          const ahorro = alterno.get(a.id)! + alterno.get(b.id)! - t.rentaDia!;
          if (ahorro > 0 && (!mejor || ahorro > mejor.ahorro)) mejor = { t, a, b, ahorro };
        }
      }
    }
    if (!mejor) break;
    const t = mejor.t;
    const cadena = [mejor.a, mejor.b];
    pendientes.delete(mejor.a.id);
    pendientes.delete(mejor.b.id);
    // Con la renta pagada, cada ida extra que alcance a hacer esa unidad ya no cuesta (hasta el máximo de idas por unidad)
    while (cadena.length < tar.maxIdasPorUnidad) {
      const elig = [...pendientes.values()].filter((s) => precio(t, s) != null);
      const cand = [
        ...elig.filter((s) => puedeEncadenar(cadena[cadena.length - 1], s, tar.margenSegundaIdaMin)).map((s) => ({ s, alFinal: true })),
        ...elig.filter((s) => puedeEncadenar(s, cadena[0], tar.margenSegundaIdaMin)).map((s) => ({ s, alFinal: false })),
      ].sort((x, y) => alterno.get(y.s.id)! - alterno.get(x.s.id)!)[0];
      if (!cand) break;
      if (cand.alFinal) cadena.push(cand.s);
      else cadena.unshift(cand.s);
      pendientes.delete(cand.s.id);
    }
    cerrar(t, cadena);
  }

  // 2. Un servicio por unidad: primero los que tienen menos opciones y los más grandes
  const sinUnidad: number[] = [];
  const resto = [...pendientes.values()].sort(
    (a, b) => opciones.get(a.id)!.length - opciones.get(b.id)!.length || b.lugares - a.lugares || a.id - b.id,
  );
  for (const s of resto) {
    const ops = opciones
      .get(s.id)!
      .map((t) => ({ t, c: costoIdaYRegreso(t, precio(t, s)!) }))
      .sort((x, y) => x.c - y.c || x.t.capacidad - y.t.capacidad || x.t.id - y.t.id);
    // Las unidades sobre pedido (sin cantidad) quedan como último recurso
    const elegido = ops.find((o) => o.t.cantidad != null && libres(o.t) > 0) ?? ops.find((o) => o.t.cantidad == null);
    if (!elegido) {
      if (!sinUnidad.includes(original.get(s.id)!)) sinUnidad.push(original.get(s.id)!);
      continue;
    }
    cerrar(elegido.t, [s]);
  }
  return { unidades, sinUnidad, divididos };
}

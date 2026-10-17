import { q } from './db';
import { aHora, lugares, planHorario } from './alux/proponer';
import { cargarParametros } from './alux/generar';

export type ReservaVista = {
  id: number; reserva: string; cliente: string; cupon: string | null; hab: string | null; hotelId: number | null; hotel: string; hotelTexto: string; zona: string | null;
  horaPickup: string | null; adultos: number; menores: number; infantes: number; producto: string; marinaId: number | null;
  marina: string | null; horaTour: string | null; agencia: string; rep: string; nota: string | null; alertas: string[];
  estado: string; transporteId: number | null; orden: number;
};
export type Parada = { clave: string; hotel: string; zona: string | null; hora: string | null; llegada: string | null; pax: number; infantes: number; reservas: ReservaVista[] };
export type TransporteVista = {
  id: number; numero: number; marinaId: number | null; marina: string | null; horaTour: string | null; bloqueado: boolean;
  origen: string; notas: string | null; transportistaId: number | null; transportista: string | null; unidadId: number | null;
  unidad: string | null; capacidadUnidad: number | null; paradas: Parada[]; pax: number; infantes: number; lugares: number; alertas: string[];
};

export async function cargarOperacion(fecha: string) {
  const zonasCfg = await q<{ clave: string; nombre: string; min_entre_pickups: number | null }>('select clave, nombre, min_entre_pickups from zonas');
  const params = await cargarParametros();
  const claveZona = Object.fromEntries(zonasCfg.map((z) => [z.nombre, z.clave]));
  const [op] = await q<{ id: number; fecha: string; estado: string; archivo_nombre: string | null; importado_en: string }>(
    `select id, to_char(fecha,'YYYY-MM-DD') fecha, estado, archivo_nombre, importado_en::text from operaciones where fecha = $1`,
    [fecha],
  );
  if (!op) return null;
  const reservas = (
    await q<Record<string, unknown>>(
      `select r.id, r.reserva, r.cliente, r.cupon, r.hab, r.hotel_id, coalesce(h.nombre, r.hotel_texto) hotel, r.hotel_texto, z.nombre zona,
              to_char(r.hora_pickup,'HH24:MI') hora_pickup, r.adultos, r.menores, r.infantes,
              coalesce(p.nombre || ' ' || to_char(p.hora_salida,'HH24:MI'), r.excursion_texto) producto,
              r.marina_id, m.nombre marina, to_char(r.hora_tour,'HH24:MI') hora_tour, r.agencia, r.rep, r.nota_transporte,
              r.alertas, r.estado, tr.transporte_id, coalesce(tr.orden, 0) orden
       from reservas r
       left join hoteles h on h.id = r.hotel_id left join zonas z on z.id = h.zona_id
       left join productos p on p.id = r.producto_id left join marinas m on m.id = r.marina_id
       left join transporte_reservas tr on tr.reserva_id = r.id
       where r.operacion_id = $1 order by r.hora_pickup nulls last, r.id`,
      [op.id],
    )
  ).map((r) => ({
    id: r.id as number, reserva: r.reserva as string, cliente: r.cliente as string, cupon: (r.cupon as string) || null, hab: (r.hab as string) || null, hotelId: r.hotel_id as number | null,
    hotel: r.hotel as string, hotelTexto: r.hotel_texto as string, zona: r.zona as string | null, horaPickup: r.hora_pickup as string | null,
    adultos: r.adultos as number, menores: r.menores as number, infantes: r.infantes as number, producto: r.producto as string,
    marinaId: r.marina_id as number | null, marina: r.marina as string | null, horaTour: r.hora_tour as string | null,
    agencia: r.agencia as string, rep: r.rep as string, nota: r.nota_transporte as string | null, alertas: (r.alertas as string[]) ?? [],
    estado: r.estado as string, transporteId: r.transporte_id as number | null, orden: r.orden as number,
  })) as ReservaVista[];

  const ts = await q<Record<string, unknown>>(
    `select t.id, t.numero, t.marina_id, m.nombre marina, to_char(t.hora_tour,'HH24:MI') hora_tour, t.bloqueado, t.origen, t.notas,
            t.transportista_id, tp.nombre transportista, t.unidad_id, u.tipo || ' ' || u.numero unidad, u.capacidad
     from transportes t left join marinas m on m.id = t.marina_id left join transportistas tp on tp.id = t.transportista_id
     left join unidades u on u.id = t.unidad_id where t.operacion_id = $1 order by t.numero`,
    [op.id],
  );
  const transportes: TransporteVista[] = ts.map((t) => {
    const rs = reservas.filter((r) => r.transporteId === t.id).sort((a, b) => a.orden - b.orden || a.id - b.id);
    const paradas: Parada[] = [];
    for (const r of rs) {
      const clave = r.hotelId ? String(r.hotelId) : r.hotelTexto;
      let p = paradas.find((x) => x.clave === clave);
      if (!p) { p = { clave, hotel: r.hotel, zona: r.zona, hora: r.horaPickup, llegada: null, pax: 0, infantes: 0, reservas: [] }; paradas.push(p); }
      p.reservas.push(r);
      p.pax += r.adultos + r.menores;
      p.infantes += r.infantes;
      if (r.horaPickup && (!p.hora || r.horaPickup < p.hora)) p.hora = r.horaPickup;
    }
    const pax = paradas.reduce((a, p) => a + p.pax, 0);
    const infantes = paradas.reduce((a, p) => a + p.infantes, 0);
    const l = lugares(pax, infantes);
    const alertas: string[] = [];
    const cap = (t.capacidad as number | null) ?? 20;
    if (l > cap) alertas.push(`Excede ${cap} lugares`);
    if (paradas.length > 4) alertas.push(`${paradas.length} pick ups`);
    if (rs.some((r) => r.marinaId !== t.marina_id || r.horaTour !== t.hora_tour)) alertas.push('Mezcla marina u horario distinto');
    if (paradas.some((p, i) => i > 0 && p.hora && paradas[i - 1].hora && p.hora < paradas[i - 1].hora!)) alertas.push('Orden de pick ups fuera de horario');
    const plan = planHorario(paradas.map((p) => ({ horaPickup: p.hora, zona: p.zona ? claveZona[p.zona] : null })), params);
    paradas.forEach((p, i) => { const m = plan.llegadas[i]; p.llegada = m != null ? aHora(m) : null; });
    for (const x of plan.retrasos) {
      alertas.push(`Llega ${x.minutos} min tarde a ${paradas[x.indice].hotel} (tolerancia ${params.toleranciaRetrasoMin})`);
    }
    return {
      id: t.id as number, numero: t.numero as number, marinaId: t.marina_id as number | null, marina: t.marina as string | null,
      horaTour: t.hora_tour as string | null, bloqueado: t.bloqueado as boolean, origen: t.origen as string, notas: t.notas as string | null,
      transportistaId: t.transportista_id as number | null, transportista: t.transportista as string | null, unidadId: t.unidad_id as number | null,
      unidad: t.unidad as string | null, capacidadUnidad: t.capacidad as number | null, paradas, pax, infantes, lugares: l, alertas,
    };
  });

  const conTransporte = reservas.filter((r) => r.estado === 'transporte');
  const sinAsignar = conTransporte.filter((r) => !r.transporteId);
  const fuera = reservas.filter((r) => r.estado !== 'transporte');
  const porResolver = [...new Set(conTransporte.filter((r) => !r.hotelId && r.hotelTexto).map((r) => r.hotelTexto))];
  return { op, reservas, transportes, sinAsignar, fuera, porResolver, conTransporte };
}

export async function opcionesAsignacion() {
  const transportistas = await q<{ id: number; nombre: string }>('select id, nombre from transportistas where activo order by prioridad, nombre');
  const unidades = await q<{ id: number; transportista_id: number; etiqueta: string; capacidad: number }>(
    `select id, transportista_id, tipo || ' ' || numero || ' (' || capacidad || ')' etiqueta, capacidad from unidades where activa order by transportista_id, numero`,
  );
  return { transportistas, unidades };
}

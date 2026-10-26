import { describe, expect, it } from 'vitest';
import { conIva, costoDiaUnidad, precioServicio, resumirCosto, type Tarifario, type TipoUnidad } from '@/lib/costos';
import { asignarProveedores, puedeEncadenar, type ServicioIda } from '@/lib/alux/asignar';

// Tarifas de ejemplo (no son las reales)
const tipo = (o: Partial<TipoUnidad> & Pick<TipoUnidad, 'id' | 'transportista' | 'capacidad' | 'precios'>): TipoUnidad => ({
  transportistaId: o.id, tipo: 'Van', capacidadMin: null, cantidad: 5, rentaDia: null, redondo: false, segundaIda: false, ...o,
});
const chica = tipo({ id: 1, transportista: 'Chica', capacidad: 12, precios: { CANCUN: 500, PDC: 1000 } });
const grande = tipo({ id: 2, transportista: 'Grande', capacidad: 20, precios: { CANCUN: 800, PDC: 1500, TULUM: 2500 } });
const renta = tipo({ id: 3, transportista: 'Renta', capacidad: 16, precios: { CANCUN: 900, PDC: 1600 }, rentaDia: 4000, segundaIda: true, cantidad: 2 });
const redonda = tipo({ id: 4, transportista: 'Redonda', capacidad: 16, precios: { CANCUN: 1200 }, redondo: true, cantidad: 1 });
const tar = (tipos: TipoUnidad[]): Tarifario => ({ tipos, zonas: [], iva: 0.16, rentaMinServicios: 2, margenSegundaIdaMin: 10, maxIdasPorUnidad: 2 });
const serv = (o: Partial<ServicioIda> & Pick<ServicioIda, 'id'>): ServicioIda => ({
  lugares: 10, zonas: ['CANCUN'], inicio: 8 * 60, fin: 8 * 60 + 40, marinaId: 1, minutosPrimerHotel: { 1: 20 }, ...o,
});

describe('precio de un servicio', () => {
  it('cobra la zona más cara entre sus paradas', () => {
    expect(precioServicio(grande, ['CANCUN', 'PDC'])).toBe(1500);
  });
  it('no aplica si la unidad no tiene precio en alguna parada', () => {
    expect(precioServicio(chica, ['CANCUN', 'TULUM'])).toBeNull();
  });
});

describe('costo del día de una unidad', () => {
  it('cada ida se paga con su regreso', () => {
    expect(costoDiaUnidad(grande, [800], 2)).toEqual({ subtotal: 1600, renta: false });
  });
  it('el precio redondo ya incluye el regreso', () => {
    expect(costoDiaUnidad(redonda, [1200], 2)).toEqual({ subtotal: 1200, renta: false });
  });
  it('con dos idas en la mañana cobra la renta del día', () => {
    expect(costoDiaUnidad(renta, [900, 900], 2)).toEqual({ subtotal: 4000, renta: true });
    expect(costoDiaUnidad(renta, [900], 2)).toEqual({ subtotal: 1800, renta: false });
  });
  it('IVA aparte', () => {
    expect(conIva(1000, 0.16)).toEqual({ subtotal: 1000, iva: 160, total: 1160 });
  });
});

describe('Alux asigna proveedores', () => {
  it('elige la opción más barata que tenga lugar', () => {
    const r = asignarProveedores([serv({ id: 1, lugares: 10 }), serv({ id: 2, lugares: 18 })], tar([chica, grande]));
    const de = (id: number) => r.unidades.find((u) => u.servicios.includes(id))!.tipo.transportista;
    expect(de(1)).toBe('Chica');
    expect(de(2)).toBe('Grande');
  });
  it('respeta cuántas unidades tiene cada proveedor', () => {
    const r = asignarProveedores([1, 2, 3].map((id) => serv({ id })), tar([{ ...chica, cantidad: 2 }, grande]));
    expect(r.unidades.filter((u) => u.tipo.transportista === 'Chica')).toHaveLength(2);
    expect(r.unidades.filter((u) => u.tipo.transportista === 'Grande')).toHaveLength(1);
  });
  it('encadena dos idas en una unidad de renta cuando sale más barato', () => {
    const a = serv({ id: 1, zonas: ['PDC'], inicio: 6 * 60, fin: 7 * 60 });
    const b = serv({ id: 2, zonas: ['PDC'], inicio: 8 * 60, fin: 9 * 60 });
    const r = asignarProveedores([a, b], tar([grande, renta]));
    expect(r.unidades).toHaveLength(1);
    expect(r.unidades[0]).toMatchObject({ servicios: [1, 2], renta: true, subtotal: 4000 });
  });
  it('una unidad de renta hace como máximo las idas permitidas', () => {
    const ss = [6, 8, 10].map((h, i) => serv({ id: i + 1, zonas: ['PDC'], inicio: h * 60, fin: h * 60 + 50 }));
    const r = asignarProveedores(ss, tar([grande, renta]));
    expect(Math.max(...r.unidades.map((u) => u.servicios.length))).toBe(2);
  });
  it('no encadena si pagar por servicio cuesta menos que la renta', () => {
    const a = serv({ id: 1, inicio: 6 * 60, fin: 7 * 60 });
    const b = serv({ id: 2, inicio: 8 * 60, fin: 9 * 60 });
    const r = asignarProveedores([a, b], tar([chica, renta]));
    expect(r.unidades.every((u) => !u.renta)).toBe(true);
  });
  it('no encadena si la unidad no alcanza a llegar al siguiente pick up', () => {
    const a = serv({ id: 1, zonas: ['PDC'], inicio: 6 * 60, fin: 7 * 60 });
    const b = serv({ id: 2, zonas: ['PDC'], inicio: 7 * 60 + 20, fin: 8 * 60, minutosPrimerHotel: { 1: 40 } });
    expect(puedeEncadenar(a, b, 10)).toBe(false);
    expect(asignarProveedores([a, b], tar([grande, renta])).unidades).toHaveLength(2);
  });
  it('reparte en varias unidades un grupo que no cabe en ninguna', () => {
    const autobus = { ...redonda, id: 9, transportista: 'Autobús', cantidad: null, capacidad: 50 };
    const r = asignarProveedores([serv({ id: 7, lugares: 28 })], tar([grande, { ...autobus, precios: { CANCUN: 5000 } }]));
    expect(r.divididos).toEqual([7]);
    expect(r.unidades).toHaveLength(2);
    expect(r.unidades.every((u) => u.tipo.transportista === 'Grande' && u.servicios[0] === 7)).toBe(true);
    // Si el autobús cuesta menos que repartir el grupo, va en autobús
    const b = asignarProveedores([serv({ id: 7, lugares: 28 })], tar([grande, { ...autobus, precios: { CANCUN: 2000 } }]));
    expect(b.divididos).toEqual([]);
    expect(b.unidades.map((u) => u.tipo.transportista)).toEqual(['Autobús']);
  });
  it('usa unidades sobre pedido solo si no hay otra', () => {
    const r = asignarProveedores([serv({ id: 1 })], tar([{ ...redonda, cantidad: null }, { ...chica, cantidad: 0 }]));
    expect(r.unidades[0].tipo.transportista).toBe('Redonda');
    expect(asignarProveedores([serv({ id: 1, zonas: ['TULUM'] })], tar([chica])).sinUnidad).toEqual([1]);
  });
  it('resume por proveedor con IVA aparte', () => {
    const r = asignarProveedores([serv({ id: 1 }), serv({ id: 2, lugares: 18 })], tar([chica, grande]));
    const s = resumirCosto(r.unidades, 0.16);
    expect(s).toMatchObject({ subtotal: 2600, iva: 416, total: 3016, unidades: 2, servicios: 2 });
  });
});

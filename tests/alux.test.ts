import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PARAMETROS_BASE, aHora, lugares, planHorario, proponer, type ReservaAlux } from '@/lib/alux/proponer';
import { parsearOrden } from '@/lib/orden/parser';
import { clasificar } from '@/lib/orden/clasificar';
import { catalogoDePrueba } from './helpers';

const base = (o: Partial<ReservaAlux>): ReservaAlux => ({
  id: 1, hotelId: 1, hotelNombre: 'H', zonaClave: 'CUN_ZH', marinaId: 1, marinaNombre: 'Las Perlas',
  horaTour: '10:00', horaPickup: '08:30', pax: 2, infantes: 0, minutosMarina: 10, ...o,
});

const MINIMOS: Record<string, number> = { RM_Z1: 10, RM_Z2: 10, RM_Z3: 10 };

describe('horario de llegada a cada parada', () => {
  const P = { ...PARAMETROS_BASE, minEntrePickups: MINIMOS };
  it('en Riviera Maya suma 10 min y acepta hasta 5 de retraso', () => {
    const h = planHorario([{ horaPickup: '07:30', zona: 'RM_Z2' }, { horaPickup: '07:35', zona: 'RM_Z2' }], P);
    expect(h.llegadas.map((m) => aHora(m!))).toEqual(['07:30', '07:40']);
    expect(h.retrasos).toEqual([]);
    const h2 = planHorario([{ horaPickup: '07:30', zona: 'RM_Z2' }, { horaPickup: '07:30', zona: 'RM_Z2' }], P);
    expect(h2.retrasos).toEqual([{ indice: 1, minutos: 10 }]);
  });
  it('puede llegar hasta 5 min antes y recuperar tiempo', () => {
    const h = planHorario([{ horaPickup: '07:30', zona: 'RM_Z2' }, { horaPickup: '07:45', zona: 'RM_Z2' }], P);
    expect(aHora(h.llegadas[1]!)).toBe('07:40');
  });
  it('fuera de Riviera Maya, hoteles con la misma hora van juntos', () => {
    const r = [
      base({ id: 1, hotelId: 1, zonaClave: 'CUN_ZH', minutosMarina: 15, horaPickup: '08:30', pax: 4 }),
      base({ id: 2, hotelId: 2, zonaClave: 'CUN_ZH', minutosMarina: 14, horaPickup: '08:30', pax: 4 }),
      base({ id: 3, hotelId: 3, zonaClave: 'CUN_ZH', minutosMarina: 13, horaPickup: '08:30', pax: 4 }),
    ];
    expect(proponer(r, P)).toHaveLength(1);
  });
  it('en Riviera Maya separa hoteles a los que llegaría tarde', () => {
    const r = [
      base({ id: 1, hotelId: 1, zonaClave: 'RM_Z2', minutosMarina: 70, horaPickup: '07:30', pax: 4 }),
      base({ id: 2, hotelId: 2, zonaClave: 'RM_Z2', minutosMarina: 68, horaPickup: '07:30', pax: 4 }),
    ];
    expect(proponer(r, P)).toHaveLength(2);
    expect(proponer(r.map((x) => (x.id === 2 ? { ...x, horaPickup: '07:35' } : x)), P)).toHaveLength(1);
  });
});

describe('reglas de Alux', () => {
  it('los primeros 2 infantes no ocupan lugar', () => {
    expect(lugares(10, 2)).toBe(10);
    expect(lugares(10, 3)).toBe(11);
  });
  it('no mezcla marinas ni horarios', () => {
    const t = proponer([
      base({ id: 1 }),
      base({ id: 2, hotelId: 2, horaTour: '13:00' }),
      base({ id: 3, hotelId: 3, marinaId: 2, marinaNombre: 'Punta Norte' }),
    ]);
    expect(t).toHaveLength(3);
  });
  it('recoge del más lejano al más cercano y respeta 20 lugares', () => {
    const t = proponer([
      base({ id: 1, hotelId: 1, zonaClave: 'PDC', minutosMarina: 60, pax: 8 }),
      base({ id: 2, hotelId: 2, zonaClave: 'RM_Z3', minutosMarina: 50, pax: 8 }),
      base({ id: 3, hotelId: 3, zonaClave: 'CUN_ZH', minutosMarina: 15, pax: 4 }),
      base({ id: 4, hotelId: 4, zonaClave: 'CUN_ZH', minutosMarina: 12, pax: 4 }),
    ]);
    const v = t.find((x) => x.reservaIds.includes(1))!;
    expect(v.reservaIds.slice(0, 3)).toEqual([1, 2, 3]);
    expect(t.every((x) => x.lugares <= 20)).toBe(true);
  });
  it('no regresa de Cancún a Costa Mujeres camino a Las Perlas', () => {
    const t = proponer([
      base({ id: 1, hotelId: 1, zonaClave: 'CUN_ZH', minutosMarina: 30, horaPickup: '08:05', pax: 4 }),
      base({ id: 2, hotelId: 2, zonaClave: 'COSTA_MUJERES', minutosMarina: 28, horaPickup: '08:35', pax: 4 }),
    ]);
    expect(t).toHaveLength(2);
  });
  it('a Punta Norte no mete Zona Hotelera en rutas del sur', () => {
    const t = proponer([
      base({ id: 1, hotelId: 1, zonaClave: 'PTO_MORELOS', marinaNombre: 'Punta Norte', marinaId: 2, minutosMarina: 45, pax: 4 }),
      base({ id: 2, hotelId: 2, zonaClave: 'CUN_ZH', marinaNombre: 'Punta Norte', marinaId: 2, minutosMarina: 20, pax: 4 }),
    ]);
    expect(t).toHaveLength(2);
  });
  it('un hotel con más de 20 pasajeros se reparte por reservas', () => {
    const t = proponer([1, 2, 3, 4].map((i) => base({ id: i, pax: 10 })));
    expect(t).toHaveLength(2);
    expect(t.every((x) => x.lugares === 20)).toBe(true);
  });
});

const real = path.join(__dirname, '..', 'data', 'private', 'orden_servicio_2026-10-09.xls');
describe.skipIf(!fs.existsSync(real))('propuesta con la orden real', () => {
  it('arma la operación sin exceder capacidad ni pick ups', () => {
    const { cat, hoteles, marinaNombre } = catalogoDePrueba();
    const r = clasificar(parsearOrden(fs.readFileSync(real, 'utf8')).filas, cat).filter((x) => x.estado === 'transporte');
    const input: ReservaAlux[] = r.map((x, i) => {
      const h = hoteles.get(x.hotelId!)!;
      const m = marinaNombre[x.marinaId!];
      return {
        id: i + 1, hotelId: x.hotelId, hotelNombre: h.nombre, zonaClave: h.zona, marinaId: x.marinaId!, marinaNombre: m,
        horaTour: x.horaTour!, horaPickup: x.horaPickup, pax: x.adultos + x.menores, infantes: x.infantes, minutosMarina: h.minutos[m],
      };
    });
    const t = proponer(input, { ...PARAMETROS_BASE, minEntrePickups: MINIMOS });
    expect(new Set(t.flatMap((x) => x.reservaIds)).size).toBe(input.length);
    expect(t.every((x) => x.lugares <= 20 && x.pickups <= 5)).toBe(true);
    expect(t.length).toBeLessThanOrEqual(55);
    console.log(`Transportes propuestos: ${t.length}`);
  });
});

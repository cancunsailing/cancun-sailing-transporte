import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsearOrden, repararTexto } from '@/lib/orden/parser';
import { clasificar, notaDeTransporte } from '@/lib/orden/clasificar';
import { catalogoDePrueba } from './helpers';

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'orden_ejemplo.xls'), 'utf8');

describe('parser de la orden de servicio', () => {
  it('lee la fecha y las filas, ignorando la fila de totales', () => {
    const o = parsearOrden(fixture);
    expect(o.fecha).toBe('2026-10-09');
    expect(o.filas).toHaveLength(7);
    expect(o.filas[0]).toMatchObject({ hotel: 'RIU VENTURA', hora: '08:30', adultos: 2, excursion: 'Plus Experience ( 10:00 )' });
  });
  it('repara texto doblemente codificado', () => {
    expect(repararTexto('CancÃºn, MÃ©xico')).toBe('Cancún, México');
    expect(repararTexto('Cancún')).toBe('Cancún');
  });
});

describe('clasificación', () => {
  const { cat } = catalogoDePrueba();
  const r = clasificar(parsearOrden(fixture).filas, cat);
  it('aplica los filtros de operación', () => {
    expect(r.map((x) => x.estado)).toEqual(['transporte', 'llegan_directo', 'sin_datos', 'transporte', 'solo_regreso', 'charter', 'transporte']);
  });
  it('reconoce hoteles por alias y asigna marina por producto', () => {
    expect(r[0].hotelId).not.toBeNull();
    expect(r[0].marinaId).toBe(1); // Las Perlas
    expect(r[3].hotelId).not.toBeNull(); // Dreams Sapphire por alias
    expect(r[6].marinaId).toBe(2); // Privilege 10:00 → Punta Norte
  });
  it('genera alertas útiles', () => {
    expect(r[5].alertas).toContain('Hora 00:00: verificar con reservas');
    expect(r[6].alertas).toContain('Hotel no reconocido en el catálogo');
  });
  it('conserva solo comentarios de transporte', () => {
    expect(r[3].notaTransporte).toBe('PUP EN LA PLUMA');
    expect(notaDeTransporte('PAGAN LA TRANSPORTACION OK 18 USD PP')).toBeNull();
    expect(notaDeTransporte('OTROS: CELEBRA CUMPLEAÑOS')).toBeNull();
  });
});

// Prueba con la orden real del 9 de octubre (no se sube al repositorio por contener datos de pasajeros)
const real = path.join(__dirname, '..', 'data', 'private', 'orden_servicio_2026-10-09.xls');
describe.skipIf(!fs.existsSync(real))('orden real del 9 de octubre', () => {
  it('cuadra con el análisis manual', () => {
    const o = parsearOrden(fs.readFileSync(real, 'utf8'));
    const { cat } = catalogoDePrueba();
    const r = clasificar(o.filas, cat);
    const cuenta = (e: string) => r.filter((x) => x.estado === e).length;
    expect(o.filas).toHaveLength(291);
    expect(cuenta('llegan_directo')).toBe(80);
    expect(cuenta('sin_datos')).toBe(11);
    expect(cuenta('solo_regreso')).toBe(1);
    const t = r.filter((x) => x.estado === 'transporte');
    expect(t).toHaveLength(197);
    expect(t.filter((x) => !x.hotelId)).toHaveLength(0);
    expect(t.filter((x) => !x.marinaId)).toHaveLength(0);
  });
});

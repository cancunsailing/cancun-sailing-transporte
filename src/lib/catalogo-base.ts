/** Catálogos base confirmados con operación. Los usa la carga inicial y las pruebas. */
export const ZONAS: [string, string, string, 'sur' | 'cancun' | 'norte'][] = [
  // [nombre en el catálogo, clave, nombre, corredor]
  ['TULUM', 'TULUM', 'Tulum', 'sur'],
  ['RIVIERA MAYA Z1', 'RM_Z1', 'Riviera Maya Z1', 'sur'],
  ['RIVIERA MAYA Z2', 'RM_Z2', 'Riviera Maya Z2', 'sur'],
  ['RIVIERA MAYA Z3', 'RM_Z3', 'Riviera Maya Z3', 'sur'],
  ['PLAYACAR', 'PLAYACAR', 'Playacar', 'sur'],
  ['PLAYA DEL CARMEN', 'PDC', 'Playa del Carmen', 'sur'],
  ['PUERTO MORELOS', 'PTO_MORELOS', 'Puerto Morelos', 'sur'],
  ['Cancún Zona Hotelera', 'CUN_ZH', 'Cancún Zona Hotelera', 'cancun'],
  ['Cancún Centro', 'CUN_CENTRO', 'Cancún Centro', 'cancun'],
  ['Puerto Juárez', 'PTO_JUAREZ', 'Puerto Juárez', 'norte'],
  ['Costa Mujeres', 'COSTA_MUJERES', 'Costa Mujeres', 'norte'],
  ['Playa Mujeres', 'PLAYA_MUJERES', 'Playa Mujeres', 'norte'],
];

export const MARINAS: [string, number, number][] = [
  ['Las Perlas', 21.1563227, -86.798943],
  ['Punta Norte', 21.2073685, -86.8039464],
];

export const COLUMNAS: [string, string, string][] = [
  // [clave, nombre, encabezado en el CSV]
  ['P10_LP', '10:00 Las Perlas (Regular / Full Perlas)', 'Pickup 10:00 Las Perlas (Regular/Full Perlas)'],
  ['P10_PN', '10:00 Punta Norte (Contoy / Privilege / Plus PN)', 'Pickup 10:00 Punta Norte (Contoy/Privilege/Plus PN)'],
  ['REG12', 'Regular 12:00', 'Pickup Regular 12:00'],
  ['PRV12', 'Privilege 12:00', 'Pickup Privilege 12:00'],
  ['P13', '13:00 (Full Perlas / Privilege / Regular)', 'Pickup 13:00 (Full Perlas/Privilege/Regular)'],
  ['FULL0830', 'Full 8:30', 'Pickup Full 8:30'],
  ['FULL1130', 'Full Punta Norte 11:30', 'Pickup Full P.Norte 11:30'],
  ['FULL1430', 'Full Punta Norte 14:30', 'Pickup Full P.Norte 14:30'],
  ['NEWBLUE', 'New Blue', 'Pickup New Blue'],
  ['TCOL', 'T. Collection', 'Pickup T.Collection'],
  ['SUNSET', 'Sunset', 'Pickup Sunset'],
  ['NIGHT', 'Night', 'Pickup Night'],
];

export const LP = 'Las Perlas', PN = 'Punta Norte';
export const PRODUCTOS: [string, string, string | null, string, string[]][] = [
  // [nombre, hora, marina, columna, nombres en el reporte]
  ['Plus Experience', '10:00', LP, 'P10_LP', ['PLUS EXPERIENCE']],
  ['Plus Experience', '13:00', LP, 'P13', ['PLUS EXPERIENCE']],
  ['Plus Experience Adults Only', '10:00', LP, 'P10_LP', ['PLUS EXPERIENCE ADULT ONLY', 'PLUS EXPERIENCE ADULTS ONLY']],
  ['Connect', '10:00', LP, 'P10_LP', ['CONNECT']],
  ['Full Experience', '10:00', LP, 'P10_LP', ['FULL EXPERIENCE']],
  ['Full Experience', '13:00', LP, 'P13', ['FULL EXPERIENCE']],
  ['Full Experience', '08:30', PN, 'FULL0830', ['FULL EXPERIENCE']],
  ['Full Experience', '11:30', PN, 'FULL1130', ['FULL EXPERIENCE']],
  ['Full Experience', '14:30', PN, 'FULL1430', ['FULL EXPERIENCE']],
  ['Perlas Privilege', '10:00', LP, 'P10_LP', ['PERLAS PRIVILEGE']],
  ['Perlas Privilege', '13:00', LP, 'P13', ['PERLAS PRIVILEGE']],
  ['Privilege Experience', '10:00', PN, 'P10_PN', ['PRIVILEGE EXPERIENCE']],
  ['Privilege Experience', '12:00', PN, 'PRV12', ['PRIVILEGE EXPERIENCE']],
  ['Privilege Experience', '13:00', null, 'P13', ['PRIVILEGE EXPERIENCE']],
  ['Contoy', '10:00', PN, 'P10_PN', ['CONTOY']],
  ['Plus Punta Norte', '10:00', PN, 'P10_PN', ['PLUS PUNTA NORTE']],
  ['Plus Punta Norte', '12:00', PN, 'PRV12', ['PLUS PUNTA NORTE']],
];

// Transportistas confirmados por Joel (flota y tarifas pendientes)
export const TRANSPORTISTAS: [string, number, string[]][] = [
  ['Link Shuttle (MADI)', 1, ['CUN_CENTRO', 'CUN_ZH', 'PLAYA_MUJERES', 'COSTA_MUJERES', 'PTO_JUAREZ']],
];


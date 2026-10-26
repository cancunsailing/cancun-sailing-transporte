-- Proveedores, flota, tarifas y zonas de cobro.
-- Las zonas de tarifa son las que usan los proveedores para cobrar y no siempre coinciden
-- con las zonas de operación: Playacar se opera aparte pero se cobra como Playa del Carmen,
-- Playa Mujeres se cobra como Costa Mujeres, etc.

create table zonas_tarifa (
  id serial primary key,
  clave text not null unique,
  nombre text not null unique,
  orden int not null default 0
);

insert into zonas_tarifa (clave, nombre, orden) values
  ('CANCUN', 'Cancún', 1),
  ('COSTA_MUJERES', 'Costa Mujeres', 2),
  ('PTO_MORELOS', 'Puerto Morelos', 3),
  ('PDC', 'Playa del Carmen', 4),
  ('PTO_AVENTURAS', 'Puerto Aventuras', 5),
  ('AKUMAL', 'Akumal', 6),
  ('TULUM', 'Tulum', 7);

-- Zona de cobro por defecto de los hoteles de cada zona de operación
alter table zonas add column zona_tarifa_id int references zonas_tarifa(id);
-- Un hotel puede tener su propia zona de cobro (p. ej. los hoteles de Xcaret están en Riviera Maya Z2 y se cobran como Playa del Carmen)
alter table hoteles add column zona_tarifa_id int references zonas_tarifa(id);

update zonas z set zona_tarifa_id = t.id
from zonas_tarifa t
where t.clave = case z.clave
  when 'CUN_ZH' then 'CANCUN' when 'CUN_CENTRO' then 'CANCUN' when 'PTO_JUAREZ' then 'CANCUN'
  when 'COSTA_MUJERES' then 'COSTA_MUJERES' when 'PLAYA_MUJERES' then 'COSTA_MUJERES'
  when 'PTO_MORELOS' then 'PTO_MORELOS'
  when 'RM_Z3' then 'PDC' when 'PDC' then 'PDC' when 'PLAYACAR' then 'PDC'
  when 'RM_Z2' then 'PTO_AVENTURAS'
  when 'RM_Z1' then 'AKUMAL'
  when 'TULUM' then 'TULUM'
end;

alter table transportistas
  add column razon_social text,
  add column disponibilidad text,                          -- cuándo confirman unidades (p. ej. "La actualizan cada tarde")
  add column segunda_ida boolean not null default false,   -- sus unidades pueden hacer más de un servicio en la mañana
  add column notas text;

-- Flota por tipo de unidad: cuántas tiene cada proveedor, capacidad y forma de cobro
create table flota (
  id serial primary key,
  transportista_id int not null references transportistas(id) on delete cascade,
  tipo text not null,                                -- Sprinter, JAC, Urban, Toyota, Van, Autobús…
  capacidad int not null,                            -- lugares máximos
  capacidad_min int,                                 -- cuando el proveedor da un rango (JAC de 13 a 16)
  cantidad int,                                      -- null = sobre pedido o según disponibilidad
  renta_dia numeric(10,2),                           -- renta del día si la unidad hace 2 o más servicios en la mañana
  precio_redondo boolean not null default false,     -- el precio cubre ida y regreso
  activa boolean not null default true,
  unique (transportista_id, tipo, capacidad)
);

-- Precio por servicio (sin IVA) de cada tipo de unidad en cada zona de cobro. Sin fila = no va a esa zona.
create table tarifas (
  flota_id int not null references flota(id) on delete cascade,
  zona_tarifa_id int not null references zonas_tarifa(id),
  precio numeric(10,2) not null check (precio >= 0),
  primary key (flota_id, zona_tarifa_id)
);

-- Puerto Morelos (Riviera Maya Z4) lleva 10 minutos entre pick ups, como el resto de Riviera Maya
update zonas set min_entre_pickups = 10 where clave = 'PTO_MORELOS';

insert into parametros (clave, valor, descripcion) values
  ('iva', '0.16', 'IVA que se suma a las tarifas de los proveedores'),
  ('renta_min_servicios', '2', 'Servicios en la mañana a partir de los cuales una unidad de renta cobra la renta del día'),
  ('margen_segunda_ida_min', '10', 'Minutos entre dejar a los pasajeros en la marina y salir al siguiente pick up'),
  ('max_idas_unidad', '2', 'Idas que puede hacer en la mañana una unidad de renta')
on conflict (clave) do nothing;

-- Esquema inicial: operación de ida (Cancun Sailing · Alux)
-- SQL estándar de Postgres, compatible con Supabase.

create type rol_usuario as enum ('admin', 'coordinador', 'finanzas', 'transportista', 'consulta');
create type corredor as enum ('sur', 'cancun', 'norte');
create type confianza_ubicacion as enum ('alta', 'media', 'por_confirmar');
create type estado_reserva as enum ('transporte', 'llegan_directo', 'sin_datos', 'charter', 'solo_regreso');
create type estado_operacion as enum ('importada', 'propuesta', 'aprobada');
create type origen_transporte as enum ('alux', 'manual');
create type estado_regla as enum ('propuesta', 'aprobada', 'descartada');

-- Catálogos -----------------------------------------------------------------

create table zonas (
  id serial primary key,
  clave text not null unique,
  nombre text not null unique,
  corredor corredor not null
);

create table marinas (
  id serial primary key,
  nombre text not null unique,
  lat double precision,
  lon double precision
);

-- Columnas de horario de pick up del catálogo de hoteles (p. ej. "10:00 Las Perlas")
create table columnas_horario (
  id serial primary key,
  clave text not null unique,
  nombre text not null
);

create table productos (
  id serial primary key,
  nombre text not null,
  hora_salida time not null,
  marina_id int references marinas(id),
  columna_horario_id int references columnas_horario(id),
  -- nombres como vienen en la orden de servicio, sin la hora (normalizados)
  nombres_reporte text[] not null default '{}',
  activo boolean not null default true,
  unique (nombre, hora_salida)
);

create table hoteles (
  id serial primary key,
  nombre text not null unique,
  zona_id int not null references zonas(id),
  lat double precision,
  lon double precision,
  ubicacion confianza_ubicacion not null default 'por_confirmar',
  activo boolean not null default true,
  actualizado_en timestamptz not null default now()
);

create table hotel_alias (
  id serial primary key,
  hotel_id int not null references hoteles(id) on delete cascade,
  alias text not null,
  alias_norm text not null unique
);

create table hotel_pickup (
  hotel_id int not null references hoteles(id) on delete cascade,
  columna_horario_id int not null references columnas_horario(id),
  hora time not null,
  primary key (hotel_id, columna_horario_id)
);

-- Tiempo de manejo de cada hotel a cada marina: sirve para ordenar las paradas sobre la ruta
create table hotel_marina (
  hotel_id int not null references hoteles(id) on delete cascade,
  marina_id int not null references marinas(id),
  minutos numeric(6,1),
  km numeric(6,1),
  primary key (hotel_id, marina_id)
);

create table transportistas (
  id serial primary key,
  nombre text not null unique,
  contacto text,
  whatsapp text,
  prioridad int not null default 100,  -- menor número = se asigna primero
  activo boolean not null default true
);

create table transportista_zona (
  transportista_id int not null references transportistas(id) on delete cascade,
  zona_id int not null references zonas(id),
  primary key (transportista_id, zona_id)
);

create table unidades (
  id serial primary key,
  transportista_id int not null references transportistas(id) on delete cascade,
  numero text not null,
  tipo text not null default 'Van',
  capacidad int not null,
  marca text,
  activa boolean not null default true,
  unique (transportista_id, numero)
);

create table operadores (
  id serial primary key,
  transportista_id int not null references transportistas(id) on delete cascade,
  nombre text not null,
  telefono text,
  activo boolean not null default true
);

-- Usuarios ------------------------------------------------------------------

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nombre text not null,
  password_hash text not null,
  rol rol_usuario not null,
  transportista_id int references transportistas(id),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Operación diaria ----------------------------------------------------------

create table operaciones (
  id serial primary key,
  fecha date not null unique,
  archivo_nombre text,
  estado estado_operacion not null default 'importada',
  importado_por uuid references usuarios(id),
  importado_en timestamptz not null default now()
);

create table reservas (
  id serial primary key,
  operacion_id int not null references operaciones(id) on delete cascade,
  reserva text,
  cupon text,
  cliente text,
  hotel_texto text,
  hotel_id int references hoteles(id),
  hora_pickup time,
  adultos int not null default 0,
  menores int not null default 0,
  infantes int not null default 0,
  excursion_texto text,
  producto_id int references productos(id),
  marina_id int references marinas(id),
  hora_tour time,
  agencia text,
  preferencia text,
  rep text,
  comentario text,
  nota_transporte text,
  estado estado_reserva not null,
  alertas text[] not null default '{}'
);
create index reservas_operacion on reservas(operacion_id);

create table transportes (
  id serial primary key,
  operacion_id int not null references operaciones(id) on delete cascade,
  marina_id int references marinas(id),
  hora_tour time,
  numero int not null,
  transportista_id int references transportistas(id),
  unidad_id int references unidades(id),
  operador_id int references operadores(id),
  bloqueado boolean not null default false,
  origen origen_transporte not null default 'alux',
  notas text,
  creado_en timestamptz not null default now()
);
create index transportes_operacion on transportes(operacion_id);

create table transporte_reservas (
  transporte_id int not null references transportes(id) on delete cascade,
  reserva_id int not null references reservas(id) on delete cascade,
  orden int not null default 0,
  primary key (transporte_id, reserva_id)
);
create unique index transporte_reservas_unica on transporte_reservas(reserva_id);

-- Aprendizaje de Alux -------------------------------------------------------

create table ajustes (
  id serial primary key,
  operacion_id int references operaciones(id) on delete set null,
  usuario_id uuid references usuarios(id),
  tipo text not null,
  detalle jsonb not null default '{}',
  comentario text,
  creado_en timestamptz not null default now()
);

create table reglas_alux (
  id serial primary key,
  texto text not null,
  estado estado_regla not null default 'propuesta',
  ajuste_id int references ajustes(id) on delete set null,
  creado_por uuid references usuarios(id),
  revisado_por uuid references usuarios(id),
  creado_en timestamptz not null default now()
);

create table parametros (
  clave text primary key,
  valor text not null,
  descripcion text
);

insert into parametros (clave, valor, descripcion) values
  ('capacidad_bloque', '20', 'Lugares máximos por transporte al armar bloques'),
  ('max_pickups', '4', 'Pick ups ideales por transporte'),
  ('max_pickups_excepcion', '5', 'Pick ups máximos permitidos como excepción'),
  ('infantes_sin_lugar', '2', 'Infantes por transporte que no ocupan lugar'),
  ('tolerancia_orden_min', '3', 'Minutos de tolerancia al ordenar paradas hacia la marina');

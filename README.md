# Transporte · Cancun Sailing

Plataforma (PWA) para preparar y administrar la logística de transporte de pasajeros de los tours de Cancun Sailing.
Este primer corte cubre la **operación de ida**.

## Qué hace hoy

- **Usuarios y roles**: Admin, Coordinación de operación, Finanzas, Transportista y Consulta. Cada persona entra con su usuario; el rol define qué ve y qué edita. Los choferes no tienen acceso.
- **Catálogos**
  - Hoteles y puntos: zona, alias con los que llegan en la orden de servicio, horarios de pick up por producto, ubicación y minutos a cada marina (para ordenar rutas). Acepta coordenadas o una liga de Google Maps.
  - Productos: marina y horario de pick up que le corresponden a cada producto y hora de salida.
- **Importación de la orden de servicio**: se sube el `.xls` tal cual se descarga (es HTML). El sistema:
  - descarta *llegan directo* y reservas sin hotel ni hora; separa charters (manuales) y *solo regreso*;
  - reconoce hoteles por alias y pide ligar los que no conoce (el alias queda guardado);
  - asigna marina por producto y horario, valida el pick up contra el catálogo y conserva solo los comentarios de transporte;
  - alerta horas 00:00 para verificar con reservas;
  - si la fecha ya existe, actualiza sin perder los transportes de las reservas que no cambiaron.
- **Propuesta de Alux** (`src/lib/alux/proponer.ts`): junta reservas de la misma marina y horario, recoge del hotel más lejano al más cercano a la marina, respeta 20 lugares (los primeros 2 infantes no ocupan lugar), máximo 4 pick ups (5 como excepción) y las rutas confirmadas (la Zona Hotelera no entra en rutas a Punta Norte que vienen del sur).
- **Tablero editable**: mover reservas entre transportes (con comentario para Alux), crear transportes a mano, reordenar paradas, bloquear transportes para que no se rehagan, asignar transportista y unidad, aprobar la operación.
- **Manifiestos** por transporte: vista, texto listo para WhatsApp y PDF descargable. El transportista ve solo los suyos en *Mis servicios*.
- **Aprendizaje de Alux**: historial de cambios y comentarios convertidos en reglas para aprobar o descartar.

## Pendiente (siguientes cortes)

- Conectar el modelo de IA (API de Anthropic) para que Alux aplique las reglas aprobadas y atienda el chatbot.
- Flota, operadores y tarifas por transportista; asignación automática por prioridad y zona de cobertura.
- Operación de regreso como tablero en vivo (reacomodo de unidades conforme llegan los barcos).
- Chatbot de WhatsApp y bandeja de retrasos en tiempo real.
- Cierre y conciliación de costos (renta fija o por servicio) y reportes.
- Resolver las ubicaciones *por confirmar* del catálogo antes de cargarlo a producción.

## Correr en local

Requisitos: Node 20+ y Postgres 14+ (local o Supabase).

```bash
cp .env.example .env          # ajusta DATABASE_URL y SESSION_SECRET
npm install
npm run db:migrate            # crea las tablas (supabase/migrations)
npm run db:seed               # zonas, marinas, productos y 384 hoteles del catálogo 2027
npm run user:create -- tu@correo.com "Tu nombre" admin "una-clave-segura"
npm run dev                   # http://localhost:3000
```

Pruebas: `npm test`. Las pruebas con la orden real del 9 de octubre corren solo si el archivo existe en `data/private/` (esa carpeta no se sube al repositorio porque contiene datos de pasajeros).

## Supabase

Las migraciones en `supabase/migrations` son SQL estándar de Postgres. Para usar Supabase basta con poner la cadena de conexión del proyecto en `DATABASE_URL` y correr `npm run db:migrate` y `npm run db:seed`. La autenticación es propia (sesión firmada en cookie); se puede migrar a Supabase Auth más adelante sin cambiar el esquema de la operación.

## Estructura

```
src/lib/orden/      parser y clasificación de la orden de servicio
src/lib/alux/       algoritmo de propuesta y su persistencia
src/lib/operacion.ts, manifiesto.ts   lectura para tablero y manifiestos
src/app/            pantallas (App Router) y acciones de servidor
supabase/migrations esquema de base de datos
scripts/            migraciones, carga de catálogos y alta de usuarios
data/seed/          catálogo de hoteles con zonas, horarios y ubicaciones
```

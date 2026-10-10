-- Tiempo mínimo de traslado entre pick ups consecutivos, configurable por zona (minutos).
-- null = sin restricción (por definir).
alter table zonas add column min_entre_pickups int check (min_entre_pickups >= 0);

update zonas set min_entre_pickups = 10 where clave in ('RM_Z1', 'RM_Z2', 'RM_Z3');
update zonas set min_entre_pickups = 5 where clave = 'CUN_ZH';
update zonas set min_entre_pickups = 1 where clave = 'PLAYACAR';

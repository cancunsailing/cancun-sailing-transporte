-- Valor provisional de 5 minutos para las zonas que aún no tienen un mínimo definido.
-- Se ajustan después desde Configuración.
update zonas set min_entre_pickups = 5 where min_entre_pickups is null;

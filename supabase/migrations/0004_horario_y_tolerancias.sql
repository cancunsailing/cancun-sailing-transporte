-- Riviera Maya 10 minutos entre pick ups; el resto de las zonas sin mínimo.
update zonas set min_entre_pickups = case when clave in ('RM_Z1', 'RM_Z2', 'RM_Z3') then 10 else 0 end;

insert into parametros (clave, valor, descripcion) values
  ('anticipacion_min', '5', 'Minutos que el transporte puede llegar antes de la hora de pick up del catálogo'),
  ('tolerancia_retraso_min', '5', 'Minutos máximos de retraso contra la hora de pick up del catálogo')
on conflict (clave) do nothing;

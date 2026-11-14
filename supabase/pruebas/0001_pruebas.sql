-- Pruebas de 0001_init.sql. Pegar en Supabase → SQL Editor → Run DESPUÉS de la migración.
-- Todo corre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Si todo pasa, verás el aviso "Todas las pruebas pasaron". Si algo falla, verás el error.

begin;

do $$
declare
  s   uuid;
  a1  public.aportaciones;
  a2  public.aportaciones;
  a3  public.aportaciones;
  r   public.aportaciones;
  ses public.sesiones;
begin
  insert into public.sesiones (nombre, total_centavos)
  values ('Mesa de prueba', 120000)          -- $1,200.00
  returning id into s;

  -- 1. Reserva normal y nombre de pila
  select * into a1 from public.reservar_aportacion(s, '  Ana María López ', 70000);
  assert a1.nombre = 'Ana', 'nombre de pila: esperaba Ana, llegó ' || a1.nombre;
  assert a1.estado = 'reservada', 'a1 debe quedar reservada';

  select * into a2 from public.reservar_aportacion(s, 'Luis', 50000);   -- total comprometido: 1,200

  -- 2. No se puede exceder el total
  begin
    perform public.reservar_aportacion(s, 'Eva', 1);
    raise exception 'debio_fallar';
  exception when others then
    assert sqlerrm = 'excede_total', 'esperaba excede_total, llegó ' || sqlerrm;
  end;

  -- 3. Una reserva vencida libera su monto
  update public.aportaciones set expira_at = now() - interval '1 second' where id = a2.id;
  select * into a3 from public.reservar_aportacion(s, 'Eva', 50000);
  select * into r from public.aportaciones where id = a2.id;
  assert r.estado = 'expirada', 'a2 debe quedar expirada';

  -- 4. Pago e idempotencia
  update public.aportaciones set pey_link_id = 'link-prueba-1' where id = a1.id;
  perform public.marcar_pagada('link-prueba-1', 'tx-prueba-1', 70000);
  perform public.marcar_pagada('link-prueba-1', 'tx-prueba-1', 70000);   -- webhook repetido
  select * into ses from public.sesiones where id = s;
  assert ses.pagado_centavos = 70000, 'pagado debe ser 70000 (sin doble suma), es ' || ses.pagado_centavos;
  assert ses.estado = 'abierta', 'la sesión sigue abierta';

  -- 5. Pago que completa el total → liquidada
  update public.aportaciones set pey_link_id = 'link-prueba-3' where id = a3.id;
  perform public.marcar_pagada('link-prueba-3', 'tx-prueba-3', 50000);
  select * into ses from public.sesiones where id = s;
  assert ses.pagado_centavos = 120000, 'pagado debe ser 120000, es ' || ses.pagado_centavos;
  assert ses.estado = 'liquidada', 'la sesión debe quedar liquidada';
  assert ses.liquidada_at is not null, 'liquidada_at debe tener fecha';

  -- 6. Sesión liquidada no acepta reservas
  begin
    perform public.reservar_aportacion(s, 'Beto', 100);
    raise exception 'debio_fallar';
  exception when others then
    assert sqlerrm = 'sesion_cerrada', 'esperaba sesion_cerrada, llegó ' || sqlerrm;
  end;

  -- 7. Pago tardío de una reserva vencida, con monto distinto: se registra y se marca
  update public.aportaciones set pey_link_id = 'link-prueba-2' where id = a2.id;
  select * into r from public.marcar_pagada('link-prueba-2', 'tx-prueba-2', 100);
  assert r.estado = 'pagada', 'pago tardío debe quedar pagado';
  assert r.monto_no_coincide, 'debe marcar monto_no_coincide';

  -- 8. Link desconocido
  begin
    perform public.marcar_pagada('link-que-no-existe', 'tx-x', 100);
    raise exception 'debio_fallar';
  exception when others then
    assert sqlerrm = 'aportacion_no_existe', 'esperaba aportacion_no_existe, llegó ' || sqlerrm;
  end;

  -- 9. Validaciones de entrada
  begin
    perform public.reservar_aportacion(gen_random_uuid(), 'Ana', 100);
    raise exception 'debio_fallar';
  exception when others then
    assert sqlerrm = 'sesion_no_existe', 'esperaba sesion_no_existe, llegó ' || sqlerrm;
  end;
  begin
    perform public.reservar_aportacion(s, '   ', 100);
    raise exception 'debio_fallar';
  exception when others then
    assert sqlerrm = 'nombre_invalido', 'esperaba nombre_invalido, llegó ' || sqlerrm;
  end;
  begin
    perform public.reservar_aportacion(s, 'Ana', 0);
    raise exception 'debio_fallar';
  exception when others then
    assert sqlerrm = 'monto_invalido', 'esperaba monto_invalido, llegó ' || sqlerrm;
  end;

  -- 10. anon no puede ejecutar las funciones
  assert not has_function_privilege('anon', 'public.reservar_aportacion(uuid, text, integer)', 'execute'),
    'anon no debe poder ejecutar reservar_aportacion';
  assert not has_function_privilege('anon', 'public.marcar_pagada(text, text, integer, timestamptz)', 'execute'),
    'anon no debe poder ejecutar marcar_pagada';
  assert not has_table_privilege('anon', 'public.aportaciones', 'insert'), 'anon no debe poder insertar';

  raise notice 'Todas las pruebas pasaron';
end;
$$;

rollback;

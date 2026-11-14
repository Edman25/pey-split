-- pey-split · esquema inicial
-- Pegar completo en Supabase → SQL Editor → Run. Se ejecuta una sola vez.
--
-- Montos en centavos (enteros). pey manda pesos con decimales: convertir con
-- Math.round(transactions[0].amountBreakdown.base * 100).
-- Cobro por link de pago de pey (POST /payment-link/create); webhook payment_link.status_updated (solo "paid").
-- Escrituras: solo desde el servidor con SUPABASE_SECRET_KEY (rol service_role, ignora RLS).
-- Lecturas: anon puede leer (lobby público + Realtime).

begin;

-- ─────────────────────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────────────────────

create table public.sesiones (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (char_length(btrim(nombre)) between 1 and 80),
  total_centavos   integer not null check (total_centavos > 0),
  pagado_centavos  integer not null default 0 check (pagado_centavos >= 0),
  estado           text not null default 'abierta' check (estado in ('abierta', 'liquidada')),
  created_at       timestamptz not null default now(),
  liquidada_at     timestamptz
);

create table public.aportaciones (
  id                     uuid primary key default gen_random_uuid(),
  sesion_id              uuid not null references public.sesiones (id) on delete cascade,
  -- Solo nombre de pila: una palabra, máx. 30 caracteres (lo normaliza reservar_aportacion).
  nombre                 text not null check (char_length(nombre) between 1 and 30 and nombre !~ '\s'),
  monto_centavos         integer not null check (monto_centavos > 0),
  estado                 text not null default 'reservada' check (estado in ('reservada', 'pagada', 'expirada')),
  -- Reserva de 7 min. Ojo: el link de pey NO vence; si se paga después, marcar_pagada lo acepta igual.
  expira_at              timestamptz not null default now() + interval '7 minutes',
  pey_link_id            text unique,          -- id de POST /payment-link/create = paymentLinkId del webhook
  pey_link_url           text,                 -- url del checkout, para reabrirlo
  pey_transaction_id     text unique,          -- transactions[0].transactionId del webhook
  monto_pagado_centavos  integer,              -- lo que pey dice que se pagó
  monto_no_coincide      boolean not null default false,
  pagada_at              timestamptz,
  created_at             timestamptz not null default now()
);

create index aportaciones_sesion_id_idx on public.aportaciones (sesion_id);

-- ─────────────────────────────────────────────────────────────
-- reservar_aportacion: aparta un monto sin exceder el total
-- Errores (sqlerrm): monto_invalido, nombre_invalido, sesion_no_existe, sesion_cerrada, excede_total
-- ─────────────────────────────────────────────────────────────

create or replace function public.reservar_aportacion(
  p_sesion_id      uuid,
  p_nombre         text,
  p_monto_centavos integer
)
returns public.aportaciones
language plpgsql
set search_path = ''
as $$
declare
  v_sesion     public.sesiones;
  v_reservado  integer;
  v_disponible integer;
  v_nombre     text;
  v_aportacion public.aportaciones;
begin
  if p_monto_centavos is null or p_monto_centavos <= 0 then
    raise exception 'monto_invalido';
  end if;

  -- Nombre de pila: primera palabra, máx. 30 caracteres.
  v_nombre := left((regexp_split_to_array(btrim(coalesce(p_nombre, '')), '\s+'))[1], 30);
  if v_nombre is null or v_nombre = '' then
    raise exception 'nombre_invalido';
  end if;

  -- Candado sobre la sesión: serializa reservas y pagos de la misma cuenta.
  select * into v_sesion from public.sesiones where id = p_sesion_id for update;
  if not found then
    raise exception 'sesion_no_existe';
  end if;
  if v_sesion.estado <> 'abierta' then
    raise exception 'sesion_cerrada';
  end if;

  -- Libera reservas vencidas (el lobby las ve cambiar por Realtime).
  update public.aportaciones
     set estado = 'expirada'
   where sesion_id = p_sesion_id
     and estado = 'reservada'
     and expira_at <= now();

  select coalesce(sum(monto_centavos), 0) into v_reservado
    from public.aportaciones
   where sesion_id = p_sesion_id
     and estado = 'reservada';

  v_disponible := v_sesion.total_centavos - v_sesion.pagado_centavos - v_reservado;
  if p_monto_centavos > v_disponible then
    raise exception 'excede_total' using detail = format('disponible_centavos=%s', greatest(v_disponible, 0));
  end if;

  insert into public.aportaciones (sesion_id, nombre, monto_centavos)
  values (p_sesion_id, v_nombre, p_monto_centavos)
  returning * into v_aportacion;

  return v_aportacion;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- marcar_pagada: la llama el webhook (busca por paymentLinkId). Idempotente.
-- Acepta el pago aunque la reserva haya vencido (el dinero ya entró).
-- Error (sqlerrm): aportacion_no_existe
-- ─────────────────────────────────────────────────────────────

create or replace function public.marcar_pagada(
  p_pey_link_id        text,
  p_pey_transaction_id text,
  p_monto_centavos     integer,
  p_pagada_at          timestamptz default now()
)
returns public.aportaciones
language plpgsql
set search_path = ''
as $$
declare
  v_ap public.aportaciones;
begin
  select * into v_ap from public.aportaciones where pey_link_id = p_pey_link_id;
  if not found then
    raise exception 'aportacion_no_existe';
  end if;

  -- Mismo orden de candados que reservar_aportacion (sesión → aportación) para evitar deadlocks.
  perform 1 from public.sesiones where id = v_ap.sesion_id for update;
  select * into v_ap from public.aportaciones where id = v_ap.id for update;

  if v_ap.estado = 'pagada' then
    return v_ap;  -- webhook repetido: no sumar dos veces
  end if;

  update public.aportaciones
     set estado                = 'pagada',
         pey_transaction_id    = p_pey_transaction_id,
         monto_pagado_centavos = p_monto_centavos,
         monto_no_coincide     = (p_monto_centavos <> monto_centavos),
         pagada_at             = p_pagada_at
   where id = v_ap.id
  returning * into v_ap;

  update public.sesiones
     set pagado_centavos = pagado_centavos + p_monto_centavos,
         estado          = case when pagado_centavos + p_monto_centavos >= total_centavos
                                then 'liquidada' else estado end,
         liquidada_at    = case when pagado_centavos + p_monto_centavos >= total_centavos
                                then coalesce(liquidada_at, now()) else liquidada_at end
   where id = v_ap.sesion_id;

  return v_ap;
end;
$$;

-- Solo el servidor (service_role) puede ejecutar las funciones.
revoke all on function public.reservar_aportacion(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.marcar_pagada(text, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.reservar_aportacion(uuid, text, integer) to service_role;
grant execute on function public.marcar_pagada(text, text, integer, timestamptz) to service_role;

-- ─────────────────────────────────────────────────────────────
-- RLS: solo lectura para anon / authenticated
-- ─────────────────────────────────────────────────────────────

alter table public.sesiones     enable row level security;
alter table public.aportaciones enable row level security;

create policy "lectura publica" on public.sesiones
  for select to anon, authenticated using (true);

create policy "lectura publica" on public.aportaciones
  for select to anon, authenticated using (true);

-- Doble candado: aunque alguien agregue una política por error, anon no puede escribir.
revoke insert, update, delete, truncate on public.sesiones     from anon, authenticated;
revoke insert, update, delete, truncate on public.aportaciones from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.sesiones, public.aportaciones;

commit;

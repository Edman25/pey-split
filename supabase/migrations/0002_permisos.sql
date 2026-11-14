-- pey-split · permisos sobre tablas
-- Los proyectos nuevos de Supabase no dan permisos automáticos sobre tablas creadas por SQL.
-- Sin estos GRANT, anon no puede leer (lobby/Realtime) y service_role no puede usar las funciones
-- (son SECURITY INVOKER: corren con los permisos de quien las llama).
-- RLS sigue limitando a anon/authenticated a solo lectura (ver 0001_init.sql).
-- Aplicado en Supabase el 2026-11-14 y verificado por la API REST.

grant select on public.sesiones, public.aportaciones to anon, authenticated;
grant select, insert, update, delete on public.sesiones, public.aportaciones to service_role;

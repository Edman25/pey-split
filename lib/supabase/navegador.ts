"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | undefined;

/**
 * Cliente de Supabase para el navegador, con la clave publishable.
 * Solo puede leer (RLS) y escuchar cambios por Realtime.
 */
export function supabaseNavegador(): SupabaseClient {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !clave) {
      throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }
    cliente = createClient(url, clave, { auth: { persistSession: false } });
  }
  return cliente;
}

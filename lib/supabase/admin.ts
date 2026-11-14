import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { envObligatoria } from "@/lib/env";

let cliente: SupabaseClient | undefined;

/**
 * Cliente de Supabase con la clave secreta (rol service_role).
 * Solo para el servidor: puede escribir y llamar a reservar_aportacion / marcar_pagada.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(
      envObligatoria("NEXT_PUBLIC_SUPABASE_URL"),
      envObligatoria("SUPABASE_SECRET_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cliente;
}

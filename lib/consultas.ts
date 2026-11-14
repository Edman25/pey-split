import "server-only";

import { notFound } from "next/navigation";

import type { Cuenta } from "@/lib/resumen";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Aportacion, Sesion } from "@/lib/tipos";
import { esUuid } from "@/lib/validacion";

/** Carga la cuenta con sus aportaciones; llama a notFound() si no existe. */
export async function obtenerCuenta(sesionId: string): Promise<Cuenta> {
  if (!esUuid(sesionId)) notFound();

  const db = supabaseAdmin();
  const [sesion, aportaciones] = await Promise.all([
    db.from("sesiones").select().eq("id", sesionId).maybeSingle(),
    db.from("aportaciones").select().eq("sesion_id", sesionId).order("created_at"),
  ]);
  if (sesion.error) throw new Error(`No se pudo leer la cuenta: ${sesion.error.message}`);
  if (aportaciones.error) throw new Error(`No se pudieron leer las aportaciones: ${aportaciones.error.message}`);
  if (!sesion.data) notFound();

  return { sesion: sesion.data as Sesion, aportaciones: (aportaciones.data ?? []) as Aportacion[] };
}

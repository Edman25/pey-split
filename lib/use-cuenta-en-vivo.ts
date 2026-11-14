"use client";

import { useEffect, useState } from "react";

import type { Cuenta } from "@/lib/resumen";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import type { Aportacion, Sesion } from "@/lib/tipos";

/** Cada cuánto se vuelve a consultar por si Realtime se cae. */
const RESPALDO_MS = 15_000;
const ARRANQUE_REALTIME_MS = 3_000;

/**
 * Mantiene la cuenta al día: Realtime de Supabase + consulta de respaldo
 * cada 15 s y al volver a la pestaña.
 */
export function useCuentaEnVivo(inicial: Cuenta): { cuenta: Cuenta; conectado: boolean } {
  const [cuenta, setCuenta] = useState(inicial);
  const [conectado, setConectado] = useState(false);
  const sesionId = inicial.sesion.id;

  useEffect(() => {
    const sb = supabaseNavegador();
    let activo = true;

    async function recargar() {
      const [s, a] = await Promise.all([
        sb.from("sesiones").select().eq("id", sesionId).maybeSingle(),
        sb.from("aportaciones").select().eq("sesion_id", sesionId).order("created_at"),
      ]);
      if (activo && s.data && a.data) {
        setCuenta({ sesion: s.data as Sesion, aportaciones: a.data as Aportacion[] });
      }
    }

    const canal = sb
      .channel(`cuenta-${sesionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sesiones", filter: `id=eq.${sesionId}` },
        (cambio) => setCuenta((c) => ({ ...c, sesion: cambio.new as Sesion })),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aportaciones", filter: `sesion_id=eq.${sesionId}` },
        (cambio) => {
          if (cambio.eventType === "DELETE") {
            const id = (cambio.old as Partial<Aportacion>).id;
            setCuenta((c) => ({ ...c, aportaciones: c.aportaciones.filter((x) => x.id !== id) }));
            return;
          }
          const nueva = cambio.new as Aportacion;
          setCuenta((c) => {
            const otras = c.aportaciones.filter((x) => x.id !== nueva.id);
            return { ...c, aportaciones: [...otras, nueva] };
          });
        },
      )
      .subscribe((estado) => {
        if (!activo) return;
        setConectado(estado === "SUBSCRIBED");
        if (estado === "SUBSCRIBED") {
          // Al (re)conectar, ponerse al día con lo que pasó mientras no escuchábamos.
          void recargar();
          // Realtime tarda ~1–3 s en empezar a mandar cambios después de SUBSCRIBED (medido):
          // una segunda consulta cubre ese hueco.
          setTimeout(() => void recargar(), ARRANQUE_REALTIME_MS);
        }
      });

    const intervalo = setInterval(() => void recargar(), RESPALDO_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") void recargar();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      activo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      void sb.removeChannel(canal);
    };
  }, [sesionId]);

  return { cuenta, conectado };
}

/**
 * Fecha actual que se actualiza cada `cadaMs` (para cuentas regresivas).
 * Arranca con la hora del servidor para que el HTML del servidor y el del navegador coincidan.
 */
export function useAhora(inicialIso: string, cadaMs = 1000): Date {
  const [ahora, setAhora] = useState(() => new Date(inicialIso));
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}

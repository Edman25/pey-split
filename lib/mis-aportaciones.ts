"use client";

import { useMemo, useSyncExternalStore } from "react";

// Recuerda en este navegador qué aportaciones hizo el comensal (solo ids), para
// reconocerlo si vuelve al lobby. Si el almacenamiento no está disponible, no pasa nada.

const clave = (sesionId: string) => `pey-split:aportaciones:${sesionId}`;
const oyentes = new Set<() => void>();

function leerCrudo(sesionId: string): string {
  try {
    return localStorage.getItem(clave(sesionId)) ?? "[]";
  } catch {
    return "[]";
  }
}

function parsear(crudo: string): string[] {
  try {
    const valor: unknown = JSON.parse(crudo);
    return Array.isArray(valor) ? valor.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function guardarMiAportacion(sesionId: string, aportacionId: string): void {
  try {
    const ids = parsear(leerCrudo(sesionId)).filter((id) => id !== aportacionId);
    ids.push(aportacionId);
    localStorage.setItem(clave(sesionId), JSON.stringify(ids.slice(-10)));
  } catch {
    // modo privado o almacenamiento bloqueado: seguimos sin recordar
  }
  oyentes.forEach((avisar) => avisar());
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  window.addEventListener("storage", avisar);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener("storage", avisar);
  };
}

/** Ids de mis aportaciones en esta cuenta, de la más antigua a la más reciente. */
export function useMisAportaciones(sesionId: string): string[] {
  const crudo = useSyncExternalStore(
    suscribir,
    () => leerCrudo(sesionId),
    () => "[]",
  );
  return useMemo(() => parsear(crudo), [crudo]);
}

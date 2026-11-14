import "server-only";

import { peyReal } from "./real";
import { peySimulado } from "./simulado";
import type { PeyAdaptador } from "./types";

/** Adaptador según PEY_MODE (simulado por defecto). */
export function pey(): PeyAdaptador {
  const modo = process.env.PEY_MODE ?? "simulado";
  if (modo === "real") return peyReal;
  if (modo === "simulado") return peySimulado;
  throw new Error(`PEY_MODE inválido: "${modo}" (usar simulado o real)`);
}

export { simularPago } from "./simulado";
export * from "./types";

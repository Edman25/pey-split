// Verificación de webhooks Standard Webhooks (https://www.standardwebhooks.com), como los firma pey.
// Sin dependencias de Next.js para poder probarlo con Vitest.

import { createHmac, timingSafeEqual } from "node:crypto";

import { FirmaInvalidaError } from "./types";

export interface DatosFirma {
  /** Formato whsec_<base64>. */
  secreto: string;
  /** Header webhook-id. */
  id: string | null;
  /** Header webhook-timestamp (segundos Unix). */
  timestamp: string | null;
  /** Header webhook-signature: "v1,<base64>", puede traer varias separadas por espacio. */
  firma: string | null;
  /** Cuerpo crudo, exactamente como llegó (no re-serializar). */
  cuerpo: string;
  /** Para pruebas; por defecto el reloj actual. */
  ahora?: Date;
  /** Diferencia máxima aceptada entre webhook-timestamp y el reloj. */
  toleranciaSegundos?: number;
}

function llaveDesdeSecreto(secreto: string): Buffer {
  const base64 = secreto.startsWith("whsec_") ? secreto.slice("whsec_".length) : secreto;
  const llave = Buffer.from(base64, "base64");
  if (llave.length === 0) {
    throw new Error("PEY_WEBHOOK_SECRET vacío o mal formado");
  }
  return llave;
}

/** Calcula la firma v1 (base64) de un mensaje. Exportada para pruebas. */
export function calcularFirma(secreto: string, id: string, timestamp: string, cuerpo: string): string {
  return createHmac("sha256", llaveDesdeSecreto(secreto))
    .update(`${id}.${timestamp}.${cuerpo}`)
    .digest("base64");
}

/** Lanza FirmaInvalidaError si algo no cuadra; si regresa, el webhook es auténtico. */
export function verificarFirma({
  secreto,
  id,
  timestamp,
  firma,
  cuerpo,
  ahora = new Date(),
  toleranciaSegundos = 300,
}: DatosFirma): void {
  if (!id || !timestamp || !firma) {
    throw new FirmaInvalidaError("faltan headers webhook-id / webhook-timestamp / webhook-signature");
  }
  if (!/^\d+$/.test(timestamp)) {
    throw new FirmaInvalidaError("webhook-timestamp no es numérico");
  }
  const diferencia = Math.abs(Math.floor(ahora.getTime() / 1000) - Number(timestamp));
  if (diferencia > toleranciaSegundos) {
    throw new FirmaInvalidaError(`webhook-timestamp fuera de tolerancia (${diferencia} s)`);
  }

  const esperada = Buffer.from(calcularFirma(secreto, id, timestamp, cuerpo));
  const coincide = firma.split(" ").some((parte) => {
    const [version, valor] = parte.split(",", 2);
    if (version !== "v1" || !valor) return false;
    const recibida = Buffer.from(valor);
    return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
  });
  if (!coincide) {
    throw new FirmaInvalidaError("ninguna firma v1 coincide");
  }
}

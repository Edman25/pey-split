import "server-only";

import { randomUUID } from "node:crypto";

import { appUrl } from "@/lib/env";

import type { PagoConfirmado, PeyAdaptador } from "./types";

/**
 * Adaptador sin dinero real (plan B y desarrollo).
 * El "link" apunta a /simular/[linkId] dentro de la app; el botón de esa página
 * confirma el pago con simularPago() sin pasar por el webhook.
 */
export const peySimulado: PeyAdaptador = {
  modo: "simulado",

  async crearLink({ aportacionId }) {
    const linkId = `sim_${randomUUID()}`;
    const params = new URLSearchParams({ ref: aportacionId });
    return { linkId, url: `${appUrl()}/simular/${linkId}?${params}` };
  },

  leerWebhook() {
    // En modo simulado pey no manda webhooks; no aceptamos nada de fuera.
    return { tipo: "ignorado", motivo: "PEY_MODE=simulado no acepta webhooks" };
  },
};

/** Construye el pago que pey habría confirmado, para la página /simular. */
export function simularPago(linkId: string, montoCentavos: number, referencia: string | null): PagoConfirmado {
  if (!linkId.startsWith("sim_")) {
    throw new Error("Solo se pueden simular links creados en modo simulado");
  }
  return {
    linkId,
    transactionId: `simtx_${randomUUID()}`,
    montoCentavos,
    pagadoEn: new Date(),
    referencia,
  };
}

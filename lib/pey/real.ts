import "server-only";

import { envObligatoria } from "@/lib/env";

import { interpretarEvento } from "./evento";
import { verificarFirma } from "./firma";
import { FirmaInvalidaError, PeyError, type PeyAdaptador } from "./types";

/** Adaptador contra la API de producción de pey (https://api.pey.mx). */
export const peyReal: PeyAdaptador = {
  modo: "real",

  async crearLink({ aportacionId, montoCentavos, successUrl, backUrl }) {
    const apiUrl = envObligatoria("PEY_API_URL").replace(/\/+$/, "");
    const respuesta = await fetch(`${apiUrl}/payment-link/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${envObligatoria("PEY_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: montoCentavos / 100,
        successUrl,
        backUrl,
        hasTip: false,
        clientReferenceId: aportacionId,
        metadata: { aportacion_id: aportacionId },
      }),
      cache: "no-store",
      // Sin reintentos: si vence el tiempo, el link pudo haberse creado igual.
      signal: AbortSignal.timeout(15_000),
    });

    if (!respuesta.ok) {
      throw new PeyError(respuesta.status, (await respuesta.text()).slice(0, 500));
    }

    const datos: unknown = await respuesta.json();
    const { id, url } = (datos ?? {}) as { id?: unknown; url?: unknown };
    if (typeof id !== "string" || typeof url !== "string") {
      throw new PeyError(respuesta.status, "respuesta sin id/url");
    }
    return { linkId: id, url };
  },

  leerWebhook(cuerpoCrudo, headers) {
    verificarFirma({
      secreto: envObligatoria("PEY_WEBHOOK_SECRET"),
      id: headers.get("webhook-id"),
      timestamp: headers.get("webhook-timestamp"),
      firma: headers.get("webhook-signature"),
      cuerpo: cuerpoCrudo,
    });

    let datos: unknown;
    try {
      datos = JSON.parse(cuerpoCrudo);
    } catch {
      // Firmado por pey pero ilegible: no tiene caso que reintente.
      return { tipo: "ignorado", motivo: "JSON inválido" };
    }
    return interpretarEvento(datos);
  },
};

export { FirmaInvalidaError };

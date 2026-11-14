// Traduce el JSON de un webhook de pey (ya verificado) a algo que la app entiende.
// Formato real documentado en docs/pey-payment-link-ejemplo.md.
// Sin dependencias de Next.js para poder probarlo con Vitest.

import type { ResultadoWebhook } from "./types";

type Objeto = Record<string, unknown>;

const esObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** pey manda pesos con decimales (0.01). */
export function pesosACentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function interpretarEvento(datos: unknown): ResultadoWebhook {
  if (!esObjeto(datos)) {
    return { tipo: "ignorado", motivo: "cuerpo no es un objeto JSON" };
  }

  const tipoEvento = texto(datos.type);
  if (tipoEvento !== "payment_link.status_updated") {
    return { tipo: "ignorado", motivo: `evento ${tipoEvento ?? "sin type"} no se usa` };
  }

  const status = texto(datos.status);
  if (status !== "paid") {
    return { tipo: "ignorado", motivo: `status ${status ?? "vacío"} (solo se procesa paid)` };
  }

  const linkId = texto(datos.paymentLinkId);
  if (!linkId) {
    return { tipo: "ignorado", motivo: "falta paymentLinkId" };
  }

  const transacciones = Array.isArray(datos.transactions) ? datos.transactions.filter(esObjeto) : [];
  if (transacciones.length === 0) {
    return { tipo: "ignorado", motivo: "paid sin transactions" };
  }

  // Un link se paga una sola vez (probado), pero si llegaran varias transacciones se suman.
  let montoCentavos = 0;
  let pagadoEnSegundos = 0;
  for (const t of transacciones) {
    const desglose = esObjeto(t.amountBreakdown) ? t.amountBreakdown : {};
    // base excluye propina; si no viniera, usar amount.
    const pesos = numero(desglose.base) ?? numero(t.amount);
    if (pesos === null) {
      return { tipo: "ignorado", motivo: "transacción sin monto" };
    }
    montoCentavos += pesosACentavos(pesos);
    pagadoEnSegundos = Math.max(pagadoEnSegundos, numero(t.datePaid) ?? 0);
  }

  const transactionId = texto(transacciones[0].transactionId);
  if (!transactionId) {
    return { tipo: "ignorado", motivo: "falta transactionId" };
  }

  return {
    tipo: "pago",
    pago: {
      linkId,
      transactionId,
      montoCentavos,
      pagadoEn: pagadoEnSegundos > 0 ? new Date(pagadoEnSegundos * 1000) : new Date(),
      referencia: texto(datos.clientReferenceId),
    },
  };
}

export type ModoPey = "simulado" | "real";

export interface CrearLinkEntrada {
  /** Nuestro id de aportación; viaja a pey como clientReferenceId. */
  aportacionId: string;
  montoCentavos: number;
  /** HTTPS obligatorio en modo real. */
  successUrl: string;
  backUrl: string;
}

export interface LinkCreado {
  linkId: string;
  url: string;
}

/** Pago confirmado, ya normalizado (centavos, Date). */
export interface PagoConfirmado {
  linkId: string;
  transactionId: string;
  montoCentavos: number;
  pagadoEn: Date;
  /** clientReferenceId (nuestro id de aportación), si vino. */
  referencia: string | null;
}

export type ResultadoWebhook =
  | { tipo: "pago"; pago: PagoConfirmado }
  | { tipo: "ignorado"; motivo: string };

export interface PeyAdaptador {
  modo: ModoPey;
  /** Crea un link de pago. Sin reintentos: pey no tiene llave de idempotencia. */
  crearLink(entrada: CrearLinkEntrada): Promise<LinkCreado>;
  /**
   * Verifica la firma y traduce un webhook.
   * Lanza FirmaInvalidaError si la firma no es válida.
   */
  leerWebhook(cuerpoCrudo: string, headers: Headers): ResultadoWebhook;
}

export class FirmaInvalidaError extends Error {
  constructor(motivo: string) {
    super(`Firma de webhook inválida: ${motivo}`);
    this.name = "FirmaInvalidaError";
  }
}

export class PeyError extends Error {
  constructor(
    readonly status: number,
    detalle: string,
  ) {
    super(`pey respondió ${status}: ${detalle}`);
    this.name = "PeyError";
  }
}

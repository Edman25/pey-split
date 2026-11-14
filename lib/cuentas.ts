import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { appUrl } from "@/lib/env";
import { pey, type PagoConfirmado } from "@/lib/pey";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Aportacion, Sesion } from "@/lib/tipos";

/** Error esperado que se traduce a una respuesta HTTP con código y mensaje para el usuario. */
export class ErrorCuenta extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(mensaje);
    this.name = "ErrorCuenta";
  }
}

export const urlLobby = (sesionId: string) => `${appUrl()}/s/${sesionId}`;
export const urlCaja = (sesionId: string) => `${appUrl()}/s/${sesionId}/caja`;

// Las funciones SQL que regresan una fila llegan como objeto; por si acaso, aceptar arreglo.
function unaFila<T>(datos: unknown): T {
  return (Array.isArray(datos) ? datos[0] : datos) as T;
}

function errorInesperado(contexto: string, error: PostgrestError): Error {
  console.error(`[cuentas] ${contexto}:`, error);
  return new Error(`${contexto}: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────

export async function crearSesion(nombre: string, totalCentavos: number): Promise<Sesion> {
  const { data, error } = await supabaseAdmin()
    .from("sesiones")
    .insert({ nombre, total_centavos: totalCentavos })
    .select()
    .single();
  if (error) throw errorInesperado("crear sesión", error);
  return data as Sesion;
}

export interface AportacionCreada {
  aportacionId: string;
  url: string;
  expiraAt: string;
  montoCentavos: number;
  nombre: string;
}

/** Reserva el monto, crea el link de pago en pey y lo guarda en la aportación. */
export async function aportar(sesionId: string, nombre: string, montoCentavos: number): Promise<AportacionCreada> {
  const adaptador = pey();
  const base = appUrl();
  if (adaptador.modo === "real" && !base.startsWith("https://")) {
    throw new ErrorCuenta(500, "configuracion", "APP_URL debe ser https:// con PEY_MODE=real (pey lo exige)");
  }

  const db = supabaseAdmin();

  // 1. Reservar (la función SQL bloquea la sesión y no deja exceder el total).
  const { data, error } = await db.rpc("reservar_aportacion", {
    p_sesion_id: sesionId,
    p_nombre: nombre,
    p_monto_centavos: montoCentavos,
  });
  if (error) {
    switch (error.message) {
      case "sesion_no_existe":
        throw new ErrorCuenta(404, error.message, "Esta cuenta no existe");
      case "sesion_cerrada":
        throw new ErrorCuenta(409, error.message, "Esta cuenta ya está liquidada");
      case "excede_total": {
        const disponible = Number(/disponible_centavos=(\d+)/.exec(error.details ?? "")?.[1] ?? 0);
        throw new ErrorCuenta(409, error.message, "Ese monto supera lo que falta por pagar", {
          disponibleCentavos: disponible,
        });
      }
      case "monto_invalido":
      case "nombre_invalido":
        throw new ErrorCuenta(400, error.message, "Revisa tu nombre y el monto");
      default:
        throw errorInesperado("reservar aportación", error);
    }
  }
  const aportacion = unaFila<Aportacion>(data);

  // 2. Crear el link de pago. Sin reintentos: pey no tiene llave de idempotencia.
  let link;
  try {
    link = await adaptador.crearLink({
      aportacionId: aportacion.id,
      montoCentavos,
      successUrl: `${urlLobby(sesionId)}?aportacion=${aportacion.id}`,
      backUrl: urlLobby(sesionId),
    });
  } catch (e) {
    console.error("[cuentas] pey no creó el link:", e);
    // Liberar la reserva de inmediato para que otro pueda tomar ese monto.
    const { error: errorLiberar } = await db
      .from("aportaciones")
      .update({ estado: "expirada" })
      .eq("id", aportacion.id)
      .eq("estado", "reservada");
    if (errorLiberar) console.error("[cuentas] no se pudo liberar la reserva:", errorLiberar);
    throw new ErrorCuenta(502, "pey_fallo", "No se pudo generar el cobro. Intenta de nuevo.");
  }

  // 3. Guardar el link (el webhook lo busca por pey_link_id).
  const { error: errorGuardar } = await db
    .from("aportaciones")
    .update({ pey_link_id: link.linkId, pey_link_url: link.url })
    .eq("id", aportacion.id);
  if (errorGuardar) {
    // El link existe en pey pero no lo podremos ligar: avisar en el log con todo lo necesario.
    console.error("[cuentas] link creado pero no guardado", { aportacionId: aportacion.id, ...link }, errorGuardar);
    throw errorInesperado("guardar link", errorGuardar);
  }

  return {
    aportacionId: aportacion.id,
    url: link.url,
    expiraAt: aportacion.expira_at,
    montoCentavos: aportacion.monto_centavos,
    nombre: aportacion.nombre,
  };
}

export type ResultadoPago =
  | { estado: "registrado"; aportacion: Aportacion }
  | { estado: "link_desconocido" };

/** Marca la aportación como pagada (idempotente). Lo usan el webhook y el pago simulado. */
export async function registrarPago(pago: PagoConfirmado): Promise<ResultadoPago> {
  const { data, error } = await supabaseAdmin().rpc("marcar_pagada", {
    p_pey_link_id: pago.linkId,
    p_pey_transaction_id: pago.transactionId,
    p_monto_centavos: pago.montoCentavos,
    p_pagada_at: pago.pagadoEn.toISOString(),
  });
  if (error) {
    if (error.message === "aportacion_no_existe") {
      console.warn("[cuentas] pago de un link que no es nuestro:", pago.linkId);
      return { estado: "link_desconocido" };
    }
    throw errorInesperado("marcar pagada", error);
  }

  const aportacion = unaFila<Aportacion>(data);
  if (pago.referencia && pago.referencia !== aportacion.id) {
    console.warn("[cuentas] clientReferenceId no coincide con la aportación", {
      referencia: pago.referencia,
      aportacionId: aportacion.id,
    });
  }
  if (aportacion.monto_no_coincide) {
    console.warn("[cuentas] monto pagado distinto al reservado", {
      aportacionId: aportacion.id,
      reservado: aportacion.monto_centavos,
      pagado: aportacion.monto_pagado_centavos,
    });
  }
  return { estado: "registrado", aportacion };
}

export async function buscarAportacionPorLink(linkId: string): Promise<Aportacion | null> {
  const { data, error } = await supabaseAdmin()
    .from("aportaciones")
    .select()
    .eq("pey_link_id", linkId)
    .maybeSingle();
  if (error) throw errorInesperado("buscar aportación", error);
  return data as Aportacion | null;
}

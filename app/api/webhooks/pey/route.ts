import { registrarPago } from "@/lib/cuentas";
import { error } from "@/lib/http";
import { FirmaInvalidaError, pey } from "@/lib/pey";

/**
 * Webhook de pey (uno por API key; configurarlo en portal.mipey.mx → Desarrollador).
 * - 401: firma inválida.
 * - 200: procesado, ignorado o link que no es nuestro (pey no debe reintentar).
 * - 500: falló la base de datos (pey reintenta; marcar_pagada es idempotente).
 */
export async function POST(request: Request) {
  // Cuerpo crudo: la firma se calcula sobre los bytes exactos, no sobre JSON re-serializado.
  const cuerpo = await request.text();

  let resultado;
  try {
    resultado = pey().leerWebhook(cuerpo, request.headers);
  } catch (e) {
    if (e instanceof FirmaInvalidaError) {
      console.warn("[webhook pey]", e.message);
      return error(401, "firma_invalida", "Firma inválida");
    }
    console.error("[webhook pey] error al leer:", e);
    return error(500, "error_interno", "No se pudo leer el webhook");
  }

  if (resultado.tipo === "ignorado") {
    console.info("[webhook pey] ignorado:", resultado.motivo);
    return Response.json({ ok: true, ignorado: resultado.motivo });
  }

  try {
    const r = await registrarPago(resultado.pago);
    return Response.json({ ok: true, estado: r.estado });
  } catch (e) {
    console.error("[webhook pey] no se pudo registrar el pago:", e);
    return error(500, "error_interno", "No se pudo registrar el pago");
  }
}

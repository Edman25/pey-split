import "server-only";

import { ErrorCuenta } from "@/lib/cuentas";

/** Respuesta de error uniforme: { error: codigo, mensaje, ...extra }. */
export function error(status: number, codigo: string, mensaje: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error: codigo, mensaje, ...extra }, { status });
}

/** Convierte cualquier excepción en respuesta; las inesperadas van al log y salen como 500. */
export function respuestaDeExcepcion(e: unknown): Response {
  if (e instanceof ErrorCuenta) {
    return error(e.status, e.codigo, e.message, e.extra);
  }
  console.error("[api] error inesperado:", e);
  return error(500, "error_interno", "Algo salió mal. Intenta de nuevo.");
}

/** Lee el cuerpo como objeto JSON; null si no es JSON o no es objeto. */
export async function leerJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const datos: unknown = await request.json();
    return typeof datos === "object" && datos !== null && !Array.isArray(datos)
      ? (datos as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

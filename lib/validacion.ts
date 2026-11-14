// Validación de lo que manda el navegador. Sin dependencias de Next.js (se prueba con Vitest).

/** Tope por cuenta y por aportación: $100,000.00. */
export const MAX_CENTAVOS = 10_000_000;

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

/**
 * Monto en pesos → centavos. Acepta número (12.5) o texto ("1,200.50", "$80").
 * Máximo 2 decimales, mayor que 0 y hasta MAX_CENTAVOS.
 */
export function montoACentavos(valor: unknown): Resultado<number> {
  let pesos: number;
  if (typeof valor === "number") {
    pesos = valor;
  } else if (typeof valor === "string") {
    const limpio = valor.trim().replace(/^\$/, "").replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(limpio)) {
      return { ok: false, error: "El monto debe ser un número, por ejemplo 250 o 250.50" };
    }
    pesos = Number(limpio);
  } else {
    return { ok: false, error: "Falta el monto" };
  }

  if (!Number.isFinite(pesos) || pesos <= 0) {
    return { ok: false, error: "El monto debe ser mayor que cero" };
  }
  const centavos = Math.round(pesos * 100);
  if (Math.abs(pesos * 100 - centavos) > 1e-6) {
    return { ok: false, error: "El monto admite máximo 2 decimales" };
  }
  if (centavos > MAX_CENTAVOS) {
    return { ok: false, error: "El monto máximo es $100,000" };
  }
  return { ok: true, valor: centavos };
}

/** Texto obligatorio, recortado, de 1 a `maximo` caracteres. */
export function textoObligatorio(valor: unknown, campo: string, maximo: number): Resultado<string> {
  if (typeof valor !== "string" || valor.trim() === "") {
    return { ok: false, error: `Falta ${campo}` };
  }
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (limpio.length > maximo) {
    return { ok: false, error: `${campo} admite máximo ${maximo} caracteres` };
  }
  return { ok: true, valor: limpio };
}

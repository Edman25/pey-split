// Montos sugeridos en el lobby. Sin dependencias de React (se prueba con Vitest).

/**
 * Parte igual: total ÷ personas, redondeado hacia arriba al centavo
 * (así la suma de las partes nunca queda corta). Nunca más de lo disponible.
 */
export function parteIgual(totalCentavos: number, personas: number, disponibleCentavos: number): number {
  if (personas < 1 || disponibleCentavos <= 0) return 0;
  return Math.min(Math.ceil(totalCentavos / personas), disponibleCentavos);
}

/** Centavos → texto para el campo de monto: 45050 → "450.50", 45000 → "450". */
export function centavosACampo(centavos: number): string {
  return centavos % 100 === 0 ? String(centavos / 100) : (centavos / 100).toFixed(2);
}

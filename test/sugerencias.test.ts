import { describe, expect, it } from "vitest";

import { centavosACampo, parteIgual } from "@/lib/sugerencias";
import { montoACentavos } from "@/lib/validacion";

describe("parteIgual", () => {
  it.each([
    // total, personas, disponible, esperado
    [120000, 4, 120000, 30000], // $1,200 / 4 = $300
    [120000, 7, 120000, 17143], // $171.428… → $171.43 (hacia arriba)
    [100000, 3, 100000, 33334], // $333.333… → $333.34
    [120000, 2, 20000, 20000], // no más de lo disponible
    [120000, 4, 0, 0], // nada disponible
    [120000, 0, 120000, 0], // personas inválidas
  ])("total %i entre %i (disponible %i) → %i", (total, personas, disponible, esperado) => {
    expect(parteIgual(total, personas, disponible)).toBe(esperado);
  });

  it("las partes suman al menos el total", () => {
    for (const personas of [2, 3, 6, 7, 8]) {
      expect(parteIgual(99999, personas, 99999) * personas).toBeGreaterThanOrEqual(99999);
    }
  });
});

describe("centavosACampo", () => {
  it.each([
    [45000, "450"],
    [45050, "450.50"],
    [17143, "171.43"],
    [1, "0.01"],
  ])("%i → %s", (centavos, texto) => {
    expect(centavosACampo(centavos)).toBe(texto);
  });

  it("lo que escribe el campo lo entiende la validación", () => {
    for (const c of [1, 99, 17143, 45000, 10000000]) {
      expect(montoACentavos(centavosACampo(c))).toEqual({ ok: true, valor: c });
    }
  });
});

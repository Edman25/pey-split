import { describe, expect, it } from "vitest";

import { esUuid, montoACentavos, textoObligatorio } from "@/lib/validacion";

describe("montoACentavos", () => {
  it.each([
    [250, 25000],
    [0.01, 1],
    [0.29, 29],
    [1199.99, 119999],
    [100000, 10000000],
    ["250", 25000],
    ["250.5", 25050],
    [" 1,200.50 ", 120050],
    ["$80", 8000],
  ])("%j → %i centavos", (entrada, centavos) => {
    expect(montoACentavos(entrada)).toEqual({ ok: true, valor: centavos });
  });

  it.each([
    [0],
    [-5],
    [12.345],
    ["12.345"],
    [100000.01],
    ["abc"],
    ["1e3"],
    ["-5"],
    [""],
    [null],
    [undefined],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [{ monto: 5 }],
  ])("rechaza %j", (entrada) => {
    expect(montoACentavos(entrada).ok).toBe(false);
  });
});

describe("textoObligatorio", () => {
  it("recorta y junta espacios", () => {
    expect(textoObligatorio("  Mesa   12 ", "el nombre", 80)).toEqual({ ok: true, valor: "Mesa 12" });
  });

  it.each([[""], ["   "], [null], [42], ["x".repeat(81)]])("rechaza %j", (entrada) => {
    expect(textoObligatorio(entrada, "el nombre", 80).ok).toBe(false);
  });
});

describe("esUuid", () => {
  it("acepta un UUID", () => {
    expect(esUuid("0b6f4f5e-3c2a-4f7e-9d1a-2b3c4d5e6f70")).toBe(true);
  });

  it.each([["no-es-uuid"], [""], [null], ["0b6f4f5e-3c2a-4f7e-9d1a-2b3c4d5e6f7"]])("rechaza %j", (entrada) => {
    expect(esUuid(entrada)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { formatoPesos } from "@/lib/formato";
import { resumirCuenta } from "@/lib/resumen";
import type { Aportacion, Sesion } from "@/lib/tipos";

const AHORA = new Date("2026-11-14T20:00:00Z");
const enMin = (min: number) => new Date(AHORA.getTime() + min * 60_000).toISOString();

const sesion: Sesion = {
  id: "s1",
  nombre: "Mesa 4",
  total_centavos: 120000,
  pagado_centavos: 50000,
  estado: "abierta",
  created_at: enMin(-30),
  liquidada_at: null,
};

function aportacion(id: string, monto: number, estado: Aportacion["estado"], expiraEnMin: number, creadaHaceMin: number): Aportacion {
  return {
    id,
    sesion_id: "s1",
    nombre: id,
    monto_centavos: monto,
    estado,
    expira_at: enMin(expiraEnMin),
    pey_link_id: null,
    pey_link_url: null,
    pey_transaction_id: null,
    monto_pagado_centavos: null,
    monto_no_coincide: false,
    pagada_at: null,
    created_at: enMin(-creadaHaceMin),
  };
}

describe("resumirCuenta", () => {
  const r = resumirCuenta(
    {
      sesion,
      aportaciones: [
        aportacion("Ana", 50000, "pagada", -10, 20),
        aportacion("Luis", 30000, "reservada", 3, 4), // vigente
        aportacion("Eva", 20000, "reservada", -1, 8), // venció, la base aún no lo sabe
        aportacion("Beto", 10000, "expirada", -5, 12),
      ],
    },
    AHORA,
  );

  it("calcula montos y porcentajes", () => {
    expect(r).toMatchObject({
      totalCentavos: 120000,
      pagadoCentavos: 50000,
      faltaCentavos: 70000,
      reservadoCentavos: 30000,
      disponibleCentavos: 40000,
      liquidada: false,
    });
    expect(r.porcentajePagado).toBeCloseTo(41.67, 1);
    expect(r.porcentajeComprometido).toBeCloseTo(66.67, 1);
  });

  it("marca como vencida una reserva cuyo plazo pasó", () => {
    const estados = Object.fromEntries(r.aportaciones.map((a) => [a.nombre, a.estadoVisible]));
    expect(estados).toEqual({ Ana: "pagada", Luis: "reservada", Eva: "vencida", Beto: "vencida" });
  });

  it("cuenta regresiva solo en reservas vigentes", () => {
    const luis = r.aportaciones.find((a) => a.nombre === "Luis");
    expect(luis?.segundosRestantes).toBe(180);
    expect(r.aportaciones.find((a) => a.nombre === "Eva")?.segundosRestantes).toBe(0);
  });

  it("ordena de la más reciente a la más antigua", () => {
    expect(r.aportaciones.map((a) => a.nombre)).toEqual(["Luis", "Eva", "Beto", "Ana"]);
  });

  it("no pasa de 100% ni da negativos si se pagó de más", () => {
    const deMas = resumirCuenta({ sesion: { ...sesion, pagado_centavos: 125000, estado: "liquidada" }, aportaciones: [] }, AHORA);
    expect(deMas).toMatchObject({ faltaCentavos: 0, disponibleCentavos: 0, porcentajePagado: 100, liquidada: true });
  });
});

describe("formatoPesos", () => {
  it.each([
    [120000, "$1,200.00"],
    [1, "$0.01"],
    [25050, "$250.50"],
  ])("%i → %s", (centavos, texto) => {
    expect(formatoPesos(centavos)).toBe(texto);
  });
});

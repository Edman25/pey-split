import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { calcularFirma, verificarFirma } from "@/lib/pey/firma";
import { FirmaInvalidaError } from "@/lib/pey/types";

// ── Con un secreto de prueba (siempre corren) ──────────────────────────────

const SECRETO = `whsec_${Buffer.from("secreto-de-prueba-pey-split-32by").toString("base64")}`;
const ID = "msg_prueba";
const TS = "1794690653";
const AHORA = new Date(Number(TS) * 1000);
const CUERPO = '{"type":"payment_link.status_updated","status":"paid"}';
const FIRMA = `v1,${calcularFirma(SECRETO, ID, TS, CUERPO)}`;

const base = { secreto: SECRETO, id: ID, timestamp: TS, firma: FIRMA, cuerpo: CUERPO, ahora: AHORA };

describe("verificarFirma (secreto de prueba)", () => {
  it("acepta una firma correcta", () => {
    expect(() => verificarFirma(base)).not.toThrow();
  });

  it("acepta si una de varias firmas coincide", () => {
    expect(() => verificarFirma({ ...base, firma: `v1,AAAA ${FIRMA}` })).not.toThrow();
  });

  it.each([
    ["cuerpo alterado", { cuerpo: CUERPO.replace("paid", "pending") }],
    ["JSON re-serializado", { cuerpo: JSON.stringify(JSON.parse(CUERPO), null, 1) }],
    ["webhook-id distinto", { id: "msg_otro" }],
    ["timestamp distinto", { timestamp: String(Number(TS) + 1), ahora: AHORA }],
    ["versión distinta de v1", { firma: FIRMA.replace("v1,", "v2,") }],
    ["firma basura", { firma: "v1,no-es-base64" }],
    ["otro secreto", { secreto: `whsec_${Buffer.from("otro-secreto").toString("base64")}` }],
    ["falta webhook-id", { id: null }],
    ["falta webhook-signature", { firma: null }],
    ["timestamp no numérico", { timestamp: "ayer" }],
    ["timestamp de hace 6 min", { ahora: new Date(AHORA.getTime() + 6 * 60_000) }],
  ])("rechaza: %s", (_nombre, cambios) => {
    expect(() => verificarFirma({ ...base, ...cambios })).toThrow(FirmaInvalidaError);
  });
});

// ── Con los webhooks reales de pey (solo local: fixtures y secreto no se suben) ─

const secretoReal = process.env.PEY_WEBHOOK_SECRET;
const fixtures = ["test/fixtures/pey-webhook-real.json", "test/fixtures/pey-webhook-link-real.json"];

for (const ruta of fixtures) {
  describe.skipIf(!secretoReal || !existsSync(ruta))(`firma real de pey: ${ruta}`, () => {
    const fx = existsSync(ruta)
      ? (JSON.parse(readFileSync(ruta, "utf8")) as { headers: Record<string, string>; body: string })
      : { headers: {}, body: "" };
    const real = {
      secreto: secretoReal ?? "",
      id: fx.headers["webhook-id"],
      timestamp: fx.headers["webhook-timestamp"],
      firma: fx.headers["webhook-signature"],
      cuerpo: fx.body,
      ahora: new Date(Number(fx.headers["webhook-timestamp"]) * 1000),
    };

    it("acepta la firma real", () => {
      expect(() => verificarFirma(real)).not.toThrow();
    });

    it("rechaza el cuerpo con el monto alterado", () => {
      const cuerpo = real.cuerpo.replace('"amount":0.01', '"amount":100');
      expect(cuerpo).not.toBe(real.cuerpo);
      expect(() => verificarFirma({ ...real, cuerpo })).toThrow(FirmaInvalidaError);
    });

    it("rechaza el JSON re-serializado", () => {
      expect(() => verificarFirma({ ...real, cuerpo: JSON.stringify(JSON.parse(real.cuerpo), null, 2) })).toThrow(
        FirmaInvalidaError,
      );
    });

    it("rechaza un reenvío fuera de la ventana de 5 min", () => {
      expect(() => verificarFirma({ ...real, ahora: new Date() })).toThrow(FirmaInvalidaError);
    });
  });
}

import { describe, expect, it } from "vitest";

import { interpretarEvento, pesosACentavos } from "@/lib/pey/evento";

// Mismo formato que el webhook real (docs/pey-payment-link-ejemplo.md), con datos ficticios.
const linkPagado = {
  apiKeyId: "01XXXXXXXXXXXXXXXXXXXXXXXX",
  paymentLinkId: "01AAAAAAAAAAAAAAAAAAAAAAAA",
  status: "paid",
  type: "payment_link.status_updated",
  clientReferenceId: "prueba-link-1",
  transactions: [
    {
      transactionId: "01BBBBBBBBBBBBBBBBBBBBBBBB",
      paymentMethod: "CODI",
      datePaid: 1794690648,
      amount: 0.01,
      amountBreakdown: { base: 0.01, tip: 0 },
      applicationFee: null,
      metadata: { externalMetadata: { prueba: "p0-link" } },
    },
  ],
  metadata: { prueba: "p0-link" },
};

describe("interpretarEvento", () => {
  it("traduce un link pagado", () => {
    expect(interpretarEvento(linkPagado)).toEqual({
      tipo: "pago",
      pago: {
        linkId: "01AAAAAAAAAAAAAAAAAAAAAAAA",
        transactionId: "01BBBBBBBBBBBBBBBBBBBBBBBB",
        montoCentavos: 1,
        pagadoEn: new Date(1794690648 * 1000),
        referencia: "prueba-link-1",
      },
    });
  });

  it("usa base y no la propina", () => {
    const conPropina = structuredClone(linkPagado);
    conPropina.transactions[0].amount = 345.5;
    conPropina.transactions[0].amountBreakdown = { base: 300.25, tip: 45.25 };
    const r = interpretarEvento(conPropina);
    expect(r.tipo === "pago" && r.pago.montoCentavos).toBe(30025);
  });

  it("si no viene base, usa amount", () => {
    const sinBase = structuredClone(linkPagado) as Record<string, unknown>;
    sinBase.transactions = [{ transactionId: "tx", amount: 12.34, datePaid: 1794690648 }];
    const r = interpretarEvento(sinBase);
    expect(r.tipo === "pago" && r.pago.montoCentavos).toBe(1234);
  });

  it.each([
    ["el evento del QR", { ...linkPagado, type: "codi.qr.payment_received" }],
    ["status pending", { ...linkPagado, status: "pending" }],
    ["status processing", { ...linkPagado, status: "processing" }],
    ["sin paymentLinkId", { ...linkPagado, paymentLinkId: undefined }],
    ["sin transacciones", { ...linkPagado, transactions: [] }],
    ["transacción sin id", { ...linkPagado, transactions: [{ amount: 1 }] }],
    ["transacción sin monto", { ...linkPagado, transactions: [{ transactionId: "tx" }] }],
    ["algo que no es objeto", "hola"],
    ["null", null],
  ])("ignora %s", (_nombre, datos) => {
    expect(interpretarEvento(datos).tipo).toBe("ignorado");
  });
});

describe("pesosACentavos", () => {
  it.each([
    [0.01, 1],
    [0.07, 7],
    [0.29, 29], // 0.29 * 100 = 28.999999999999996
    [12.34, 1234],
    [1200, 120000],
    [1199.99, 119999],
  ])("%s pesos → %s centavos", (pesos, centavos) => {
    expect(pesosACentavos(pesos)).toBe(centavos);
  });
});

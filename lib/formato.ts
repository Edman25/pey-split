const pesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/** 120000 → "$1,200.00" */
export function formatoPesos(centavos: number): string {
  return pesos.format(centavos / 100);
}

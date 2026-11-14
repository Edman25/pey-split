import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PagoSimulado } from "@/components/pago-simulado";
import { buscarAportacionPorLink } from "@/lib/cuentas";
import { formatoPesos } from "@/lib/formato";
import { pey } from "@/lib/pey";

export const metadata: Metadata = { title: "Pago simulado · pey-split" };

/** Checkout de mentira para PEY_MODE=simulado. En modo real no existe (404). */
export default function PaginaPagoSimulado({ params }: PageProps<"/simular/[linkId]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-3xl bg-superficie" aria-busy="true" />}>
        <Checkout params={params} />
      </Suspense>
    </main>
  );
}

async function Checkout({ params }: Pick<PageProps<"/simular/[linkId]">, "params">) {
  const { linkId } = await params;
  if (pey().modo !== "simulado" || !linkId.startsWith("sim_")) notFound();

  const aportacion = await buscarAportacionPorLink(linkId);
  if (!aportacion) notFound();

  return (
    <PagoSimulado
      linkId={linkId}
      sesionId={aportacion.sesion_id}
      aportacionId={aportacion.id}
      nombre={aportacion.nombre}
      monto={formatoPesos(aportacion.monto_centavos)}
      yaPagada={aportacion.estado === "pagada"}
    />
  );
}

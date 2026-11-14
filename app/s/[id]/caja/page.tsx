import type { Metadata } from "next";
import QRCode from "qrcode";
import { Suspense } from "react";

import { VistaCaja } from "@/components/vista-caja";
import { obtenerCuenta } from "@/lib/consultas";
import { urlLobby } from "@/lib/cuentas";

export const metadata: Metadata = { title: "Caja · pey-split" };

export default function PaginaCaja({ params }: PageProps<"/s/[id]/caja">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <Suspense fallback={<CargandoCaja />}>
        <Caja params={params} />
      </Suspense>
    </main>
  );
}

// Lee params y la base de datos: con Cache Components va dentro de <Suspense>.
async function Caja({ params }: { params: PageProps<"/s/[id]/caja">["params"] }) {
  const { id } = await params;
  const cuenta = await obtenerCuenta(id);
  const lobbyUrl = urlLobby(id);
  const qrSvg = await QRCode.toString(lobbyUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1c1917", light: "#ffffff" },
  });

  return <VistaCaja cuentaInicial={cuenta} lobbyUrl={lobbyUrl} qrSvg={qrSvg} generadoEn={new Date().toISOString()} />;
}

function CargandoCaja() {
  return (
    <div className="grid w-full animate-pulse gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]" aria-busy="true">
      <div className="h-[30rem] rounded-3xl border border-borde bg-superficie" />
      <div className="h-[30rem] rounded-3xl border border-borde bg-superficie" />
      <span className="sr-only">Cargando la cuenta…</span>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { VistaLobby } from "@/components/vista-lobby";
import { obtenerCuenta } from "@/lib/consultas";
import { esUuid } from "@/lib/validacion";

export const metadata: Metadata = { title: "Paga tu parte · pey-split" };

export default function PaginaLobby({ params, searchParams }: PageProps<"/s/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <Suspense fallback={<CargandoLobby />}>
        <Lobby params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Lee params, searchParams y la base de datos: con Cache Components va dentro de <Suspense>.
async function Lobby({ params, searchParams }: Pick<PageProps<"/s/[id]">, "params" | "searchParams">) {
  const [{ id }, consulta] = await Promise.all([params, searchParams]);
  const cuenta = await obtenerCuenta(id);
  const aportacion = typeof consulta.aportacion === "string" && esUuid(consulta.aportacion) ? consulta.aportacion : null;

  return <VistaLobby cuentaInicial={cuenta} generadoEn={new Date().toISOString()} aportacionDeRegreso={aportacion} />;
}

function CargandoLobby() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true">
      <div className="h-16 rounded-2xl bg-superficie" />
      <div className="h-32 rounded-3xl border border-borde bg-superficie" />
      <div className="h-80 rounded-3xl border border-borde bg-superficie" />
      <span className="sr-only">Cargando la cuenta…</span>
    </div>
  );
}

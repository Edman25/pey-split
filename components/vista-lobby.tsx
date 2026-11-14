"use client";

import { useState } from "react";

import { BarraProgreso } from "@/components/barra-progreso";
import { FormAportar } from "@/components/form-aportar";
import { ListaAportaciones } from "@/components/lista-aportaciones";
import { MiAportacion } from "@/components/mi-aportacion";
import { formatoPesos } from "@/lib/formato";
import { useMisAportaciones } from "@/lib/mis-aportaciones";
import { resumirCuenta, type Cuenta } from "@/lib/resumen";
import { useAhora, useCuentaEnVivo } from "@/lib/use-cuenta-en-vivo";

interface Props {
  cuentaInicial: Cuenta;
  generadoEn: string;
  /** ?aportacion=… cuando el comensal vuelve del checkout. */
  aportacionDeRegreso: string | null;
}

export function VistaLobby({ cuentaInicial, generadoEn, aportacionDeRegreso }: Props) {
  const { cuenta, conectado } = useCuentaEnVivo(cuentaInicial);
  const ahora = useAhora(generadoEn);
  const r = resumirCuenta(cuenta, ahora);
  const sesionId = cuenta.sesion.id;

  const misIds = useMisAportaciones(sesionId);
  const miId = aportacionDeRegreso ?? misIds.at(-1) ?? null;
  const mia = miId ? r.aportaciones.find((a) => a.id === miId) : undefined;
  const [otraParte, setOtraParte] = useState(false);

  const mostrarFormulario =
    !r.liquidada && (!mia || mia.estadoVisible === "vencida" || (mia.estadoVisible === "pagada" && otraParte));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-widest text-pagado">pey-split</p>
          <h1 className="truncate text-3xl font-bold">{cuenta.sesion.nombre}</h1>
        </div>
        <span className="mt-1 flex shrink-0 items-center gap-2 text-xs text-suave" aria-live="polite">
          <span className={`size-2 rounded-full ${conectado ? "bg-pagado" : "bg-vencido"}`} />
          {conectado ? "En vivo" : "Conectando…"}
        </span>
      </header>

      <section className="flex flex-col gap-3 rounded-3xl border border-borde bg-superficie p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-x-3">
          <p className="text-4xl font-bold tabular-nums">{formatoPesos(r.pagadoCentavos)}</p>
          <p className="whitespace-nowrap pb-1 text-suave tabular-nums">de {formatoPesos(r.totalCentavos)}</p>
        </div>
        <BarraProgreso resumen={r} alto="h-5" />
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-suave tabular-nums">
          <span>
            Faltan <strong className="text-texto">{formatoPesos(r.faltaCentavos)}</strong>
          </span>
          {r.reservadoCentavos > 0 && (
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-reservado" />
              {formatoPesos(r.reservadoCentavos)} pagándose
            </span>
          )}
        </div>
      </section>

      {r.liquidada && (
        <section role="status" className="rounded-3xl bg-pagado px-6 py-6 text-center text-white dark:text-black">
          <p className="text-3xl font-bold">¡Cuenta liquidada!</p>
          <p className="opacity-90">Se pagaron {formatoPesos(r.pagadoCentavos)}. Gracias a todos.</p>
        </section>
      )}

      {mia && (
        <MiAportacion
          aportacion={mia}
          deRegreso={mia.id === aportacionDeRegreso}
          liquidada={r.liquidada}
          onAportarOtra={() => setOtraParte(true)}
        />
      )}

      {mostrarFormulario && (
        <FormAportar sesionId={sesionId} totalCentavos={r.totalCentavos} disponibleCentavos={r.disponibleCentavos} />
      )}

      <section className="rounded-3xl border border-borde bg-superficie px-5 py-3 shadow-sm">
        <h2 className="pt-2 text-sm font-semibold uppercase tracking-wider text-suave">Quién ya aportó</h2>
        <ListaAportaciones aportaciones={r.aportaciones} />
      </section>
    </div>
  );
}

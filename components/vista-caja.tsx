"use client";

import { BarraProgreso } from "@/components/barra-progreso";
import { ListaAportaciones } from "@/components/lista-aportaciones";
import { formatoPesos } from "@/lib/formato";
import { resumirCuenta, type Cuenta } from "@/lib/resumen";
import { useAhora, useCuentaEnVivo } from "@/lib/use-cuenta-en-vivo";

interface Props {
  cuentaInicial: Cuenta;
  lobbyUrl: string;
  /** SVG del QR generado en el servidor a partir de lobbyUrl. */
  qrSvg: string;
  generadoEn: string;
}

export function VistaCaja({ cuentaInicial, lobbyUrl, qrSvg, generadoEn }: Props) {
  const { cuenta, conectado } = useCuentaEnVivo(cuentaInicial);
  const ahora = useAhora(generadoEn);
  const r = resumirCuenta(cuenta, ahora);

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* QR del lobby */}
      <section className="flex flex-col items-center gap-4 rounded-3xl border border-borde bg-superficie p-6 text-center shadow-sm">
        <h2 className="text-2xl font-bold">Escanea para pagar tu parte</h2>
        {/* El QR siempre oscuro sobre blanco para que lo lea cualquier cámara. */}
        <div
          className="w-full max-w-80 rounded-2xl bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
          aria-label={`Código QR para abrir ${lobbyUrl}`}
          role="img"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="text-sm text-suave">Paga con CoDi desde la app de tu banco</p>
        <a href={lobbyUrl} target="_blank" rel="noreferrer" className="break-all font-mono text-xs text-suave underline">
          {lobbyUrl}
        </a>
      </section>

      {/* Progreso */}
      <section className="flex flex-col gap-6 rounded-3xl border border-borde bg-superficie p-6 shadow-sm">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-suave">Cuenta</p>
            <h1 className="truncate text-3xl font-bold">{cuenta.sesion.nombre}</h1>
          </div>
          <span className="flex shrink-0 items-center gap-2 text-xs text-suave" aria-live="polite">
            <span className={`size-2 rounded-full ${conectado ? "bg-pagado" : "bg-vencido"}`} />
            {conectado ? "En vivo" : "Conectando…"}
          </span>
        </header>

        {r.liquidada && (
          <div role="status" className="rounded-2xl bg-pagado px-6 py-5 text-center text-white dark:text-black">
            <p className="text-3xl font-bold">¡Cuenta liquidada!</p>
            <p className="opacity-90">Se pagaron {formatoPesos(r.pagadoCentavos)}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4">
            <p className="text-5xl font-bold tabular-nums">{formatoPesos(r.pagadoCentavos)}</p>
            <p className="whitespace-nowrap pb-1 text-lg text-suave tabular-nums">de {formatoPesos(r.totalCentavos)}</p>
          </div>
          <BarraProgreso resumen={r} />
          <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm text-suave tabular-nums">
            <span>
              Faltan <strong className="text-texto">{formatoPesos(r.faltaCentavos)}</strong>
            </span>
            {r.reservadoCentavos > 0 && (
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-reservado" />
                {formatoPesos(r.reservadoCentavos)} pagándose
              </span>
            )}
            <span>{Math.round(r.porcentajePagado)}%</span>
          </div>
        </div>

        <div>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-suave">Aportaciones</h2>
          <ListaAportaciones aportaciones={r.aportaciones} />
        </div>
      </section>
    </div>
  );
}

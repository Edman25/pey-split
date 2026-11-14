"use client";

import { useState } from "react";

interface Props {
  linkId: string;
  sesionId: string;
  aportacionId: string;
  nombre: string;
  monto: string;
  yaPagada: boolean;
}

/** Imita el checkout de pey: confirmar el pago y regresar al lobby (successUrl). */
export function PagoSimulado({ linkId, sesionId, aportacionId, nombre, monto, yaPagada }: Props) {
  const [estado, setEstado] = useState<"listo" | "pagando" | "error">("listo");
  const lobby = `/s/${sesionId}`;
  const exito = `${lobby}?aportacion=${aportacionId}`;

  async function pagar() {
    setEstado("pagando");
    try {
      const respuesta = await fetch(`/api/simular/${linkId}`, { method: "POST" });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      window.location.assign(exito);
    } catch {
      setEstado("error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-full bg-reservado-suave px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-reservado">
        Pago simulado · sin dinero real
      </p>

      <section className="flex flex-col items-center gap-2 rounded-3xl border border-borde bg-superficie p-6 text-center shadow-sm">
        <p className="text-sm text-suave">Pago con CoDi de {nombre}</p>
        <p className="text-5xl font-bold tabular-nums">{monto}</p>
        <p className="text-sm text-suave">En modo real aquí aparece el checkout de pey.</p>
      </section>

      {yaPagada ? (
        <a href={exito} className="rounded-xl bg-pagado px-6 py-4 text-center text-lg font-semibold text-white dark:text-black">
          Ya está pagado · volver a la cuenta
        </a>
      ) : (
        <>
          <button
            type="button"
            onClick={pagar}
            disabled={estado === "pagando"}
            className="rounded-xl bg-pagado px-6 py-4 text-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-60 dark:text-black"
          >
            {estado === "pagando" ? "Pagando…" : `Pagar ${monto} (simulado)`}
          </button>
          {estado === "error" && (
            <p role="alert" className="rounded-lg bg-error/10 px-4 py-2 text-sm text-error">
              No se pudo simular el pago. Intenta de nuevo.
            </p>
          )}
          <a href={lobby} className="text-center text-sm text-suave underline">
            Cancelar y volver
          </a>
        </>
      )}
    </div>
  );
}

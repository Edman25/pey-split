"use client";

import { useState, type FormEvent } from "react";

import { formatoPesos } from "@/lib/formato";
import { guardarMiAportacion } from "@/lib/mis-aportaciones";
import { centavosACampo, parteIgual } from "@/lib/sugerencias";
import { montoACentavos } from "@/lib/validacion";

const PERSONAS = [2, 3, 4, 5, 6, 7, 8];

interface Props {
  sesionId: string;
  totalCentavos: number;
  disponibleCentavos: number;
}

export function FormAportar({ sesionId, totalCentavos, disponibleCentavos }: Props) {
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [personas, setPersonas] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoValido = montoACentavos(monto);
  const sinDisponible = disponibleCentavos <= 0;

  function elegirMonto(centavos: number, nuevasPersonas: number | null) {
    setMonto(centavosACampo(centavos));
    setPersonas(nuevasPersonas);
    setError(null);
  }

  async function aportar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!montoValido.ok) {
      setError(montoValido.error);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/sesiones/${sesionId}/aportar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, monto }),
      });
      const cuerpo = (await respuesta.json()) as {
        aportacionId?: string;
        url?: string;
        error?: string;
        mensaje?: string;
        disponibleCentavos?: number;
      };
      if (respuesta.ok && cuerpo.aportacionId && cuerpo.url) {
        guardarMiAportacion(sesionId, cuerpo.aportacionId);
        window.location.assign(cuerpo.url);
        return; // el botón se queda en "Abriendo pago…" mientras navega
      }
      if (cuerpo.error === "excede_total" && typeof cuerpo.disponibleCentavos === "number") {
        const d = cuerpo.disponibleCentavos;
        if (d > 0) elegirMonto(d, null); // antes del mensaje: elegirMonto limpia el error
        setError(d > 0 ? `Alguien se adelantó: solo quedan ${formatoPesos(d)} disponibles.` : "Ya no queda nada disponible.");
      } else {
        setError(cuerpo.mensaje ?? "No se pudo generar el cobro. Intenta de nuevo.");
      }
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    }
    setEnviando(false);
  }

  if (sinDisponible) {
    return (
      <p className="rounded-2xl border border-borde bg-superficie p-5 text-center text-suave">
        Todo lo que falta ya lo están pagando otros comensales. Si alguna reserva vence, se libera aquí.
      </p>
    );
  }

  return (
    <form onSubmit={aportar} className="flex flex-col gap-5 rounded-3xl border border-borde bg-superficie p-5 shadow-sm">
      <h2 className="text-xl font-bold">Paga tu parte</h2>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-suave">Tu nombre</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          maxLength={30}
          placeholder="Ana"
          autoComplete="given-name"
          className="rounded-xl border border-borde bg-fondo px-4 py-3 text-lg outline-none focus:border-pagado focus:ring-2 focus:ring-pagado/30"
        />
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="monto" className="text-sm font-medium text-suave">
          ¿Cuánto vas a pagar?
        </label>
        <div className="flex items-center rounded-xl border border-borde bg-fondo px-4 focus-within:border-pagado focus-within:ring-2 focus-within:ring-pagado/30">
          <span className="text-2xl text-suave">$</span>
          <input
            id="monto"
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value);
              setPersonas(null);
            }}
            required
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            className="w-full min-w-0 bg-transparent px-2 py-3 text-3xl font-semibold tabular-nums outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => elegirMonto(disponibleCentavos, null)}
          className="self-start rounded-full border border-borde px-3 py-1.5 text-sm font-medium hover:border-pagado"
        >
          Todo lo que falta · {formatoPesos(disponibleCentavos)}
        </button>

        <div className="flex flex-col gap-2 pt-1">
          <span className="text-sm text-suave">Partes iguales, ¿cuántos son?</span>
          <div className="flex flex-wrap gap-2">
            {PERSONAS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={personas === n}
                onClick={() => elegirMonto(parteIgual(totalCentavos, n, disponibleCentavos), n)}
                className={`size-10 rounded-full border text-sm font-semibold tabular-nums ${
                  personas === n ? "border-pagado bg-pagado text-white dark:text-black" : "border-borde hover:border-pagado"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {personas && (
            <p className="text-sm text-suave">
              {formatoPesos(totalCentavos)} entre {personas} = {formatoPesos(Math.ceil(totalCentavos / personas))} c/u
              {parteIgual(totalCentavos, personas, disponibleCentavos) < Math.ceil(totalCentavos / personas) &&
                ` (solo quedan ${formatoPesos(disponibleCentavos)})`}
            </p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error/10 px-4 py-2 text-sm text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-xl bg-pagado px-6 py-4 text-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-60 dark:text-black"
      >
        {enviando
          ? "Abriendo pago…"
          : montoValido.ok
            ? `Pagar ${formatoPesos(montoValido.valor)} con CoDi`
            : "Pagar con CoDi"}
      </button>
      <p className="-mt-2 text-center text-xs text-suave">Tu monto queda apartado 7 minutos mientras pagas.</p>
    </form>
  );
}

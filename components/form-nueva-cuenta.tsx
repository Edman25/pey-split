"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function FormNuevaCuenta() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: datos.get("nombre"), total: datos.get("total") }),
      });
      const cuerpo = (await respuesta.json()) as { id?: string; mensaje?: string };
      if (!respuesta.ok || !cuerpo.id) {
        setError(cuerpo.mensaje ?? "No se pudo crear la cuenta");
        setEnviando(false);
        return;
      }
      router.push(`/s/${cuerpo.id}/caja`);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={crear} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-suave">Mesa o nombre de la cuenta</span>
        <input
          name="nombre"
          required
          maxLength={80}
          placeholder="Mesa 12"
          autoComplete="off"
          className="rounded-xl border border-borde bg-superficie px-4 py-3 text-lg outline-none focus:border-pagado focus:ring-2 focus:ring-pagado/30"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-suave">Total a pagar</span>
        <div className="flex items-center rounded-xl border border-borde bg-superficie px-4 focus-within:border-pagado focus-within:ring-2 focus-within:ring-pagado/30">
          <span className="text-2xl text-suave">$</span>
          <input
            name="total"
            required
            inputMode="decimal"
            placeholder="1,200.00"
            autoComplete="off"
            className="w-full bg-transparent px-2 py-3 text-3xl font-semibold tabular-nums outline-none"
          />
          <span className="text-sm text-suave">MXN</span>
        </div>
      </label>

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
        {enviando ? "Creando…" : "Crear cuenta y mostrar QR"}
      </button>
    </form>
  );
}

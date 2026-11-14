import { formatoPesos } from "@/lib/formato";
import type { AportacionVisible } from "@/lib/resumen";

interface Props {
  aportacion: AportacionVisible;
  /** Viene de regreso del checkout (?aportacion=…). */
  deRegreso: boolean;
  liquidada: boolean;
  onAportarOtra: () => void;
}

function minutos(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

/** Estado de la aportación de este comensal (la que recordamos en su navegador). */
export function MiAportacion({ aportacion: a, deRegreso, liquidada, onAportarOtra }: Props) {
  const monto = formatoPesos(a.monto_centavos);

  if (a.estadoVisible === "pagada") {
    return (
      <section role="status" className="flex flex-col gap-3 rounded-3xl bg-pagado p-5 text-white dark:text-black">
        <p className="text-2xl font-bold">¡Gracias, {a.nombre}!</p>
        <p>Tu pago de {monto} quedó registrado.</p>
        {!liquidada && (
          <button
            type="button"
            onClick={onAportarOtra}
            className="self-start rounded-full border border-current px-4 py-2 text-sm font-semibold"
          >
            Pagar otra parte
          </button>
        )}
      </section>
    );
  }

  if (a.estadoVisible === "reservada") {
    return (
      <section role="status" className="flex flex-col gap-3 rounded-3xl border border-reservado/40 bg-reservado-suave p-5">
        <p className="flex items-center gap-3 text-xl font-bold text-reservado">
          {deRegreso && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
          {deRegreso ? "Confirmando tu pago…" : `Tu pago de ${monto} está pendiente`}
        </p>
        <p className="text-sm">
          {deRegreso
            ? `En cuanto el banco confirme tus ${monto}, aparecerá aquí. `
            : ""}
          Si no terminaste de pagar, tienes <strong className="tabular-nums">{minutos(a.segundosRestantes)}</strong> para hacerlo.
        </p>
        {a.pey_link_url && (
          <a
            href={a.pey_link_url}
            className="self-start rounded-full bg-reservado px-4 py-2 text-sm font-semibold text-white dark:text-black"
          >
            Volver al pago
          </a>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-borde bg-superficie p-5 text-suave">
      Tu reserva de {monto} venció sin pago. Puedes apartar de nuevo abajo.
    </section>
  );
}

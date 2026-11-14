import { formatoPesos } from "@/lib/formato";
import type { AportacionVisible } from "@/lib/resumen";

function cuentaRegresiva(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Estado({ a }: { a: AportacionVisible }) {
  if (a.estadoVisible === "pagada") {
    return <span className="rounded-full bg-pagado-suave px-3 py-1 text-xs font-semibold text-pagado">Pagó</span>;
  }
  if (a.estadoVisible === "reservada") {
    return (
      <span className="rounded-full bg-reservado-suave px-3 py-1 text-xs font-semibold tabular-nums text-reservado">
        Pagando · {cuentaRegresiva(a.segundosRestantes)}
      </span>
    );
  }
  return <span className="rounded-full border border-borde px-3 py-1 text-xs font-medium text-vencido">Venció</span>;
}

export function ListaAportaciones({ aportaciones }: { aportaciones: AportacionVisible[] }) {
  if (aportaciones.length === 0) {
    return <p className="py-6 text-center text-suave">Aún nadie ha aportado. Comparte el QR.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-borde">
      {aportaciones.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 py-3">
          <span className={`truncate text-lg font-medium ${a.estadoVisible === "vencida" ? "text-vencido" : ""}`}>
            {a.nombre}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span
              className={`text-lg font-semibold tabular-nums ${a.estadoVisible === "vencida" ? "text-vencido line-through" : ""}`}
            >
              {formatoPesos(a.monto_centavos)}
            </span>
            <Estado a={a} />
          </span>
        </li>
      ))}
    </ul>
  );
}

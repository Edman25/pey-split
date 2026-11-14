import type { Resumen } from "@/lib/resumen";

/** Barra con dos capas: pagado (sólido) y reservado en curso (claro). */
export function BarraProgreso({ resumen, alto = "h-6" }: { resumen: Resumen; alto?: string }) {
  const pagado = Math.round(resumen.porcentajePagado);
  return (
    <div
      role="progressbar"
      aria-label="Pagado de la cuenta"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pagado}
      aria-valuetext={`${pagado}% pagado`}
      className={`relative w-full overflow-hidden rounded-full bg-borde ${alto}`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-reservado-suave transition-[width] duration-700 ease-out"
        style={{ width: `${resumen.porcentajeComprometido}%` }}
      />
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-pagado transition-[width] duration-700 ease-out"
        style={{ width: `${resumen.porcentajePagado}%` }}
      />
    </div>
  );
}

// Cálculos de la vista (caja y lobby). Sin dependencias de React ni Next (se prueba con Vitest).

import type { Aportacion, Sesion } from "@/lib/tipos";

export interface Cuenta {
  sesion: Sesion;
  aportaciones: Aportacion[];
}

/** Estado que se muestra: una reserva cuyo plazo pasó se ve como vencida aunque la base aún diga "reservada". */
export type EstadoVisible = "pagada" | "reservada" | "vencida";

export interface AportacionVisible extends Aportacion {
  estadoVisible: EstadoVisible;
  /** Segundos que le quedan a una reserva vigente; 0 en otro caso. */
  segundosRestantes: number;
}

export interface Resumen {
  totalCentavos: number;
  pagadoCentavos: number;
  /** Lo que nadie ha pagado todavía (nunca negativo). */
  faltaCentavos: number;
  /** Reservas vigentes, aún sin pagar. */
  reservadoCentavos: number;
  /** Lo que todavía se puede apartar. */
  disponibleCentavos: number;
  /** 0–100, solo lo pagado. */
  porcentajePagado: number;
  /** 0–100, pagado + reservado (para la parte clara de la barra). */
  porcentajeComprometido: number;
  liquidada: boolean;
  aportaciones: AportacionVisible[];
}

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.min(100, (parte / total) * 100) : 0);

export function resumirCuenta({ sesion, aportaciones }: Cuenta, ahora: Date): Resumen {
  const visibles: AportacionVisible[] = aportaciones
    .map((a) => {
      const restanteMs = new Date(a.expira_at).getTime() - ahora.getTime();
      let estadoVisible: EstadoVisible;
      if (a.estado === "pagada") estadoVisible = "pagada";
      else if (a.estado === "reservada" && restanteMs > 0) estadoVisible = "reservada";
      else estadoVisible = "vencida";
      return {
        ...a,
        estadoVisible,
        segundosRestantes: estadoVisible === "reservada" ? Math.ceil(restanteMs / 1000) : 0,
      };
    })
    // Más recientes primero.
    .sort((x, y) => y.created_at.localeCompare(x.created_at));

  const total = sesion.total_centavos;
  const pagado = sesion.pagado_centavos;
  const reservado = visibles
    .filter((a) => a.estadoVisible === "reservada")
    .reduce((suma, a) => suma + a.monto_centavos, 0);

  return {
    totalCentavos: total,
    pagadoCentavos: pagado,
    faltaCentavos: Math.max(0, total - pagado),
    reservadoCentavos: reservado,
    disponibleCentavos: Math.max(0, total - pagado - reservado),
    porcentajePagado: porcentaje(pagado, total),
    porcentajeComprometido: porcentaje(pagado + reservado, total),
    liquidada: sesion.estado === "liquidada",
    aportaciones: visibles,
  };
}

import { buscarAportacionPorLink, registrarPago } from "@/lib/cuentas";
import { error, respuestaDeExcepcion } from "@/lib/http";
import { pey, simularPago } from "@/lib/pey";

/** Confirma el pago de un link simulado. Solo existe con PEY_MODE=simulado. */
export async function POST(_request: Request, ctx: RouteContext<"/api/simular/[linkId]">) {
  if (pey().modo !== "simulado") return error(404, "no_disponible", "No disponible");

  const { linkId } = await ctx.params;
  if (!linkId.startsWith("sim_")) return error(404, "link_no_existe", "Este link no existe");

  try {
    const aportacion = await buscarAportacionPorLink(linkId);
    if (!aportacion) return error(404, "link_no_existe", "Este link no existe");

    const r = await registrarPago(simularPago(linkId, aportacion.monto_centavos, aportacion.id));
    return Response.json({ ok: true, estado: r.estado });
  } catch (e) {
    return respuestaDeExcepcion(e);
  }
}

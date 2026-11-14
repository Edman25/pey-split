import { aportar } from "@/lib/cuentas";
import { error, leerJson, respuestaDeExcepcion } from "@/lib/http";
import { esUuid, montoACentavos, textoObligatorio } from "@/lib/validacion";

/**
 * Reserva una aportación y regresa el link de pago.
 * Body: { nombre: "Ana", monto: 250 | "250.50" } (pesos). Se guarda solo el nombre de pila.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/sesiones/[id]/aportar">) {
  const { id } = await ctx.params;
  if (!esUuid(id)) return error(404, "sesion_no_existe", "Esta cuenta no existe");

  const body = await leerJson(request);
  if (!body) return error(400, "json_invalido", "El cuerpo debe ser JSON");

  const nombre = textoObligatorio(body.nombre, "tu nombre", 80);
  if (!nombre.ok) return error(400, "nombre_invalido", nombre.error);
  const monto = montoACentavos(body.monto);
  if (!monto.ok) return error(400, "monto_invalido", monto.error);

  try {
    return Response.json(await aportar(id, nombre.valor, monto.valor), { status: 201 });
  } catch (e) {
    return respuestaDeExcepcion(e);
  }
}

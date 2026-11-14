import { crearSesion, urlCaja, urlLobby } from "@/lib/cuentas";
import { error, leerJson, respuestaDeExcepcion } from "@/lib/http";
import { montoACentavos, textoObligatorio } from "@/lib/validacion";

/** Crea una cuenta. Body: { nombre: "Mesa 12", total: 1200 | "1,200.00" } (pesos). */
export async function POST(request: Request) {
  const body = await leerJson(request);
  if (!body) return error(400, "json_invalido", "El cuerpo debe ser JSON");

  const nombre = textoObligatorio(body.nombre, "el nombre de la cuenta", 80);
  if (!nombre.ok) return error(400, "nombre_invalido", nombre.error);
  const total = montoACentavos(body.total);
  if (!total.ok) return error(400, "total_invalido", total.error);

  try {
    const sesion = await crearSesion(nombre.valor, total.valor);
    return Response.json(
      {
        id: sesion.id,
        nombre: sesion.nombre,
        totalCentavos: sesion.total_centavos,
        lobbyUrl: urlLobby(sesion.id),
        cajaUrl: urlCaja(sesion.id),
      },
      { status: 201 },
    );
  } catch (e) {
    return respuestaDeExcepcion(e);
  }
}

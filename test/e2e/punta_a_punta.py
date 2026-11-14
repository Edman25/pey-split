"""Prueba de punta a punta de los endpoints (paso 4b). Crea datos reales en Supabase: limpiar al final.

Se corre desde la raíz del repo con la app levantada (npm run build && npx next start):
  python3 -I test/e2e/punta_a_punta.py .env simulado http://localhost:3000
      → flujo completo con pago simulado (servidor con PEY_MODE=simulado); imprime sesion_id
  python3 -I test/e2e/punta_a_punta.py .env preparar http://localhost:3000
      → crea cuenta $50 + aportación en modo simulado; imprime: sesion_id link_id aportacion_id
  python3 -I test/e2e/punta_a_punta.py .env real http://localhost:3001 <sesion_id> <link_id> <aportacion_id>
      → webhooks firmados con PEY_WEBHOOK_SECRET contra un servidor con PEY_MODE=real (no llama a pey)
  python3 -I test/e2e/punta_a_punta.py .env limpiar <sesion_id> [<sesion_id> ...]
      → borra las cuentas de prueba (y sus aportaciones)
Nunca imprime secretos. La fase "real" usa test/fixtures/pey-webhook-link-real.json (solo local).
"""
import base64, hashlib, hmac, json, sys, time, urllib.request, urllib.error, uuid

env = {}
for linea in open(sys.argv[1]):
    if "=" in linea and not linea.lstrip().startswith("#"):
        k, v = linea.rstrip("\n").split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
fase = sys.argv[2]
fallas = 0


def http(metodo, url, cuerpo=None, headers=None, crudo=None):
    datos = crudo if crudo is not None else (json.dumps(cuerpo).encode() if cuerpo is not None else None)
    req = urllib.request.Request(url, data=datos, method=metodo, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            texto = r.read().decode()
            return r.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        try:
            return e.code, json.loads(texto)
        except ValueError:
            return e.code, texto


def revisa(nombre, condicion, detalle=""):
    global fallas
    if not condicion:
        fallas += 1
    print(f"[{'OK ' if condicion else 'FALLA'}] {nombre}" + (f"  → {detalle}" if detalle and not condicion else ""))


def supa(metodo, ruta, clave="SUPABASE_SECRET_KEY"):
    k = env[clave]
    h = {"apikey": k}
    if clave == "SUPABASE_SECRET_KEY":
        h["Authorization"] = f"Bearer {k}"
    return http(metodo, f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{ruta}", headers=h)


def sesion(id_):
    return supa("GET", f"sesiones?id=eq.{id_}&select=*", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")[1][0]


if fase == "simulado":
    app = sys.argv[3]
    s, r = http("POST", f"{app}/api/sesiones", {"nombre": "  Prueba   e2e ", "total": "100"})
    revisa("crear cuenta $100 → 201", s == 201, r)
    sid = r["id"]
    print(f"   sesion_id={sid}")
    revisa("nombre normalizado y URLs", r["nombre"] == "Prueba e2e" and r["lobbyUrl"].endswith(f"/s/{sid}") and r["cajaUrl"].endswith("/caja"), r)

    s, r = http("POST", f"{app}/api/sesiones", {"nombre": "x", "total": "abc"})
    revisa("total inválido → 400", s == 400 and r["error"] == "total_invalido", r)
    s, r = http("POST", f"{app}/api/sesiones", crudo=b"no es json")
    revisa("cuerpo no JSON → 400", s == 400 and r["error"] == "json_invalido", r)
    s, r = http("POST", f"{app}/api/sesiones/no-es-uuid/aportar", {"nombre": "Ana", "monto": 1})
    revisa("id no UUID → 404", s == 404, r)
    s, r = http("POST", f"{app}/api/sesiones/{uuid.uuid4()}/aportar", {"nombre": "Ana", "monto": 1})
    revisa("cuenta inexistente → 404 sesion_no_existe", s == 404 and r["error"] == "sesion_no_existe", r)
    s, r = http("POST", f"{app}/api/sesiones/{sid}/aportar", {"nombre": "Ana", "monto": 12.345})
    revisa("monto con 3 decimales → 400", s == 400 and r["error"] == "monto_invalido", r)

    s, a1 = http("POST", f"{app}/api/sesiones/{sid}/aportar", {"nombre": "Ana María López", "monto": 60})
    revisa("aportar $60 → 201", s == 201, a1)
    revisa("solo nombre de pila (Ana)", a1.get("nombre") == "Ana", a1)
    revisa("link simulado apunta a /simular/sim_…", "/simular/sim_" in a1.get("url", ""), a1)
    s, a2 = http("POST", f"{app}/api/sesiones/{sid}/aportar", {"nombre": "Luis", "monto": "40.00"})
    revisa("aportar $40 → 201", s == 201, a2)
    s, r = http("POST", f"{app}/api/sesiones/{sid}/aportar", {"nombre": "Eva", "monto": 1})
    revisa("aportar $1 de más → 409 excede_total con disponible 0", s == 409 and r["error"] == "excede_total" and r["disponibleCentavos"] == 0, r)

    link1 = a1["url"].split("/simular/")[1].split("?")[0]
    link2 = a2["url"].split("/simular/")[1].split("?")[0]
    s, r = http("POST", f"{app}/api/simular/{link1}")
    revisa("pagar link de Ana → 200 registrado", s == 200 and r["estado"] == "registrado", r)
    s, r = http("POST", f"{app}/api/simular/{link1}")
    revisa("pagar otra vez el mismo link → 200 (idempotente)", s == 200, r)
    ses = sesion(sid)
    revisa("pagado = $60, sigue abierta (sin doble suma)", ses["pagado_centavos"] == 6000 and ses["estado"] == "abierta", ses)
    s, r = http("POST", f"{app}/api/simular/sim_no-existe")
    revisa("link simulado inexistente → 404", s == 404, r)

    s, r = http("POST", f"{app}/api/webhooks/pey", {"type": "payment_link.status_updated", "status": "paid"})
    revisa("webhook en modo simulado → 200 ignorado", s == 200 and "ignorado" in r, r)

    s, r = http("POST", f"{app}/api/simular/{link2}")
    revisa("pagar link de Luis → 200", s == 200 and r["estado"] == "registrado", r)
    ses = sesion(sid)
    revisa("cuenta liquidada con $100 (leída como anon)", ses["pagado_centavos"] == 10000 and ses["estado"] == "liquidada" and ses["liquidada_at"], ses)
    s, r = http("POST", f"{app}/api/sesiones/{sid}/aportar", {"nombre": "Eva", "monto": 1})
    revisa("aportar a cuenta liquidada → 409 sesion_cerrada", s == 409 and r["error"] == "sesion_cerrada", r)
    _, aps = supa("GET", f"aportaciones?sesion_id=eq.{sid}&select=nombre,estado,pey_transaction_id&order=created_at", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    revisa("anon ve 2 aportaciones pagadas con transacción", [a["estado"] for a in aps] == ["pagada", "pagada"] and all(a["pey_transaction_id"] for a in aps), aps)

elif fase == "preparar":
    app = sys.argv[3]
    _, r = http("POST", f"{app}/api/sesiones", {"nombre": "Prueba webhook real", "total": 50})
    _, a = http("POST", f"{app}/api/sesiones/{r['id']}/aportar", {"nombre": "Beto", "monto": 50})
    print(r["id"], a["url"].split("/simular/")[1].split("?")[0], a["aportacionId"])

elif fase == "real":
    app, sid, link, ap_id = sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6]
    secreto = env["PEY_WEBHOOK_SECRET"]
    llave = base64.b64decode(secreto.removeprefix("whsec_"))

    def firmado(cuerpo_dict, ts=None, msg=None):
        cuerpo = json.dumps(cuerpo_dict, separators=(",", ":"))
        ts = str(ts or int(time.time()))
        msg = msg or f"msg_{uuid.uuid4().hex}"
        firma = base64.b64encode(hmac.new(llave, f"{msg}.{ts}.{cuerpo}".encode(), hashlib.sha256).digest()).decode()
        return cuerpo.encode(), {"webhook-id": msg, "webhook-timestamp": ts, "webhook-signature": f"v1,{firma}"}

    def evento(link_id, status="paid", pesos=50):
        return {"apiKeyId": "x", "paymentLinkId": link_id, "status": status, "type": "payment_link.status_updated",
                "clientReferenceId": ap_id, "transactions": [{"transactionId": f"tx_{uuid.uuid4().hex[:12]}", "paymentMethod": "CODI",
                "datePaid": int(time.time()), "amount": pesos, "amountBreakdown": {"base": pesos, "tip": 0}, "applicationFee": None, "metadata": {}}],
                "metadata": {}}

    fx = json.load(open("test/fixtures/pey-webhook-link-real.json"))
    s, r = http("POST", f"{app}/api/webhooks/pey", crudo=fx["body"].encode(), headers=fx["headers"])
    revisa("webhook real de pey de hace horas → 401 (fuera de ventana)", s == 401, r)
    c, h = firmado(evento(link))
    s, r = http("POST", f"{app}/api/webhooks/pey", crudo=c.replace(b'"base":50', b'"base":1'), headers=h)
    revisa("cuerpo alterado → 401", s == 401, r)
    s, r = http("POST", f"{app}/api/webhooks/pey", crudo=c, headers={**h, "webhook-signature": "v1,AAAA"})
    revisa("firma falsa → 401", s == 401, r)
    s, r = http("POST", f"{app}/api/webhooks/pey", crudo=c)
    revisa("sin headers de firma → 401", s == 401, r)

    c2, h2 = firmado(evento(link, status="pending"))
    s, r = http("POST", f"{app}/api/webhooks/pey", crudo=c2, headers=h2)
    revisa("firmado con status pending → 200 ignorado", s == 200 and "ignorado" in r, r)
    c3, h3 = firmado(evento("01LINKQUENOESNUESTRO0000000"))
    s, r = http("POST", f"{app}/api/webhooks/pey", crudo=c3, headers=h3)
    revisa("firmado, link ajeno → 200 link_desconocido", s == 200 and r.get("estado") == "link_desconocido", r)

    s, r = http("POST", f"{app}/api/webhooks/pey", crudo=c, headers=h)
    revisa("firmado y pagado → 200 registrado", s == 200 and r.get("estado") == "registrado", r)
    s, r = http("POST", f"{app}/api/webhooks/pey", crudo=c, headers=h)
    revisa("pey reintenta el mismo webhook → 200", s == 200, r)
    ses = sesion(sid)
    revisa("cuenta $50 liquidada, sin doble suma", ses["pagado_centavos"] == 5000 and ses["estado"] == "liquidada", ses)
    s, r = http("POST", f"{app}/api/simular/{link}")
    revisa("/api/simular no existe en modo real → 404", s == 404, r)
    s, r = http("POST", f"{app}/api/sesiones/{sid}/aportar", {"nombre": "Eva", "monto": 1})
    revisa("aportar en modo real con APP_URL http → 409/500 sin llamar a pey", s in (409, 500), r)

elif fase == "limpiar":
    for id_ in sys.argv[3:]:
        s, _ = supa("DELETE", f"sesiones?id=eq.{id_}")
        print(f"borrar {id_} → HTTP {s}")
    _, quedan = supa("GET", "sesiones?select=id,nombre")
    print("sesiones que quedan:", quedan)

print(f"\n{fallas} fallas" if fase in ("simulado", "real") else "")
sys.exit(1 if fallas else 0)

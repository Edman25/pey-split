# Ejemplo de webhook de pey: `codi.qr.payment_received`

Payload real de la prueba P0-2 (QR de $0.01 creado con `POST /codi/qr`, pagado desde una app bancaria
y recibido en webhook.site el 2026-11-14). Los datos personales y los identificadores se reemplazaron
por valores ficticios que conservan el mismo formato.

```json
{
  "amount": 0.01,
  "apiKeyId": "01XXXXXXXXXXXXXXXXXXXXXXXX",
  "bankAccountId": null,
  "codiQrId": "abc123def4",
  "concept": "Prueba peysplit",
  "datePaid": 1794686315,
  "numRef": "1",
  "transactionId": "01YYYYYYYYYYYYYYYYYYYYYYYY",
  "type": "codi.qr.payment_received",
  "metadata": {
    "accountType": 40,
    "bankCode": 40002,
    "clabe": "000000000000000000",
    "description": "Prueba peysplit",
    "externalMetadata": { "prueba": "p0-2" },
    "trackingKey": "000000000000000000"
  }
}
```

## Lo que nos dice para el diseño

| Campo | Observación | Cómo lo usamos |
|---|---|---|
| `type` | `codi.qr.payment_received` | Filtrar eventos; ignorar otros tipos con 200. |
| `amount` | Pesos con decimales (número), no centavos. | Convertir con `Math.round(amount * 100)` y comparar contra el monto reservado. |
| `codiQrId` | Mismo `id` que regresa `POST /codi/qr`. | Llave para encontrar la aportación (`pey_qr_id`, único). |
| `transactionId` | ULID de pey. | Guardarlo; sirve para idempotencia y auditoría. |
| `datePaid` | Unix timestamp **en segundos**. | `to_timestamp(datePaid)` → `pagada_at`. |
| `numRef` | Llega como **string** aunque se envió número. | No depender de él. |
| `metadata.externalMetadata` | **Aquí** llega el `metadata` que mandamos al crear el QR (no en `metadata` directo). | Enviar `{ "aportacion_id": "<uuid>" }` y leerlo de `metadata.externalMetadata.aportacion_id` como respaldo de `codiQrId`. |
| `metadata.clabe`, `bankCode`, `trackingKey` | Datos bancarios del **pagador**. | **No guardarlos** (privacidad). |
| `bankAccountId` | `null` cuando el QR se creó sin especificar cuenta. | Sin uso. |

## Headers de la petición

Valores de firma e id reemplazados por ficticios con el mismo formato.

```
POST <URL del webhook>
content-type: application/json
content-length: 422
user-agent: python-requests/2.32.3
webhook-id: msg_<64 caracteres hex>
webhook-timestamp: 1794686318
webhook-signature: v1,<firma HMAC-SHA256 en base64, 44 caracteres>
```

(También llegan `baggage` y `sentry-trace` de su monitoreo; se ignoran).

### Lo que implica para verificar la firma (Standard Webhooks)

- **Contenido firmado**: `"{webhook-id}.{webhook-timestamp}.{cuerpo crudo}"`, con HMAC-SHA256 usando
  el secreto `PEY_WEBHOOK_SECRET` (si viene con prefijo `whsec_`, se quita y el resto se decodifica de base64).
- **Cuerpo crudo**: en la ruta de Next.js leer con `await req.text()` y verificar **antes** de
  `JSON.parse`. Si se re-serializa el JSON, la firma no coincide.
- **`webhook-signature`** puede traer varias firmas separadas por espacio (`v1,xxx v1,yyy`);
  aceptar si cualquiera coincide y comparar en tiempo constante.
- **`webhook-timestamp`** está en segundos y llegó 3 s después de `datePaid`. Rechazar si difiere
  más de 5 min del reloj del servidor (protege contra reenvíos).
- **`webhook-id`** es único por mensaje: sirve como llave de deduplicación si pey reintenta.

### Prueba con la firma real

La petición original sin tapar está en `test/fixtures/pey-webhook-real.json` (ignorado por git, solo local).
El 2026-11-14 se comprobó con `PEY_WEBHOOK_SECRET` (formato `whsec_` + base64) que el algoritmo de arriba
acepta la firma real y rechaza: cuerpo alterado, JSON re-serializado, timestamp cambiado y `webhook-id` cambiado.
Usar ese archivo como caso de prueba de `lib/pey/real.ts`.

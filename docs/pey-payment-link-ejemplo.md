# Prueba de link de pago CoDi de pey (2026-11-14)

Link de $0.01 creado con `POST /payment-link/create`, pagado una vez y luego reabierto para intentar
un segundo pago. Datos personales e identificadores reemplazados por ficticios con el mismo formato.

## Crear

```http
POST https://api.pey.mx/payment-link/create
Authorization: Bearer <PEY_API_KEY>
Content-Type: application/json

{"amount":0.01,"successUrl":"https://example.com/exito","backUrl":"https://example.com/regreso",
 "hasTip":false,"clientReferenceId":"prueba-link-1","metadata":{"prueba":"p0-link"}}
```

Respuesta **HTTP 200** (no 201 como el QR):

```json
{"id": "01AAAAAAAAAAAAAAAAAAAAAAAA", "url": "https://app.mipey.mx/checkout/payment-link/01AAAAAAAAAAAAAAAAAAAAAAAA"}
```

## Estado después del pago: `GET /payment-link/{id}`

```json
{
  "id": "01AAAAAAAAAAAAAAAAAAAAAAAA",
  "amount": 0.01,
  "status": "paid",
  "successUrl": "https://example.com/exito",
  "backUrl": "https://example.com/regreso",
  "hasTip": false,
  "paymentMethods": ["CODI"],
  "dateCreated": 1794690507,
  "transactions": [
    {
      "transactionId": "01BBBBBBBBBBBBBBBBBBBBBBBB",
      "paymentMethod": "CODI",
      "datePaid": 1794690648,
      "amount": 0.01,
      "amountBreakdown": { "base": 0.01, "tip": 0 },
      "applicationFee": null,
      "metadata": {
        "accountType": 40,
        "bankCode": 40002,
        "clabe": "000000000000000000",
        "description": "Pago en peyslit",
        "externalMetadata": { "prueba": "p0-link" },
        "trackingKey": "000000000000000000"
      }
    }
  ],
  "metadata": { "prueba": "p0-link" },
  "clientReferenceId": "prueba-link-1"
}
```

## Hallazgos

| Pregunta | Resultado |
|---|---|
| ¿Se puede pagar dos veces el mismo link? | **No.** El segundo intento mostró "ya se pagó". Una sola transacción, `status: "paid"`. |
| ¿Vence el link? | No hay campo de expiración. Mientras esté `pending` se puede pagar sin límite de tiempo. |
| ¿Cómo se identifica? | `id` (ULID) = `paymentLinkId` del webhook. `clientReferenceId` regresa intacto: ahí va nuestro `aportacion_id`. |
| ¿Dónde queda nuestro `metadata`? | Plano en el link (`metadata`), pero **anidado** en cada transacción (`transactions[].metadata.externalMetadata`), igual que el QR. |
| ¿Comisión? | En la API no aparece: `amountBreakdown` no trae `fee` y `applicationFee` es `null`. `amount` = `base`. |
| Fechas | Segundos Unix (`dateCreated`, `datePaid`). |
| Datos del pagador | `transactions[].metadata` trae CLABE, banco y clave de rastreo: **no guardarlos**. |

## Implicaciones para el diseño

- Un link por aportación: pey ya impide el doble cobro del mismo link.
- Como el link no vence, una reserva que expiró en nuestro lado aún puede pagarse; `marcar_pagada` ya acepta
  pagos tardíos (puede dejar la cuenta pagada de más). No hay endpoint para cancelar el link.
- Tomar el monto de `amountBreakdown.base` (excluye propina si algún día se activa `hasTip`).
- Solo llamar `marcar_pagada` cuando `status === "paid"`.

## Webhook `payment_link.status_updated`

Llegó **un solo evento**, con `status: "paid"`, 5 s después del pago (`webhook-timestamp` 1794690653 vs
`datePaid` 1794690648). No llegaron eventos `pending` ni `processing`. El segundo intento de pago no generó evento.

Headers (mismo esquema Standard Webhooks que el QR):

```
content-type: application/json
content-length: 575
webhook-id: msg_<64 caracteres hex>
webhook-timestamp: 1794690653
webhook-signature: v1,<firma HMAC-SHA256 en base64>
```

Cuerpo:

```json
{
  "apiKeyId": "01XXXXXXXXXXXXXXXXXXXXXXXX",
  "paymentLinkId": "01AAAAAAAAAAAAAAAAAAAAAAAA",
  "status": "paid",
  "type": "payment_link.status_updated",
  "clientReferenceId": "prueba-link-1",
  "transactions": [
    {
      "transactionId": "01BBBBBBBBBBBBBBBBBBBBBBBB",
      "paymentMethod": "CODI",
      "datePaid": 1794690648,
      "amount": 0.01,
      "amountBreakdown": { "base": 0.01, "tip": 0 },
      "applicationFee": null,
      "metadata": {
        "accountType": 40,
        "bankCode": 40002,
        "clabe": "000000000000000000",
        "description": "Pago en peyslit",
        "externalMetadata": { "prueba": "p0-link" },
        "trackingKey": "000000000000000000"
      }
    }
  ],
  "metadata": { "prueba": "p0-link" }
}
```

Diferencias con el webhook del QR (`codi.qr.payment_received`):

| | QR | Link |
|---|---|---|
| Identificador | `codiQrId` | `paymentLinkId` |
| Monto | `amount` en la raíz | `transactions[].amountBreakdown.base` |
| Transacción | `transactionId` en la raíz | `transactions[].transactionId` |
| Nuestra referencia | `metadata.externalMetadata` | `clientReferenceId` (raíz) y `metadata` plano |
| Estado | implícito (solo se envía al pagar) | `status` explícito: procesar solo `"paid"` |

### Firma verificada

La petición original sin tapar está en `test/fixtures/pey-webhook-link-real.json` (ignorado por git).
Con `PEY_WEBHOOK_SECRET` (el mismo secreto que el QR: un webhook por API key) la firma real es válida y
se rechazan cuerpo alterado, JSON re-serializado, timestamp cambiado y `webhook-id` cambiado.

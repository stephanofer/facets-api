# Accounts Core — plan rápido de prueba manual

> Nota corta: en la app real la ruta es **`/api/v1/accounts`**. En los e2e del repo hoy se usa **`/api/accounts`** porque el helper de tests no habilita versionado URI.

## Headers comunes

- `Authorization: Bearer <token>`
- `Content-Type: application/json`

## Roles esperados

- `ADMIN` / `MEMBER`: pueden leer y mutar
- `GUEST`: solo lectura

## Envelope esperado

### Success

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-04-03T12:00:00.000Z"
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_PROFILE_INCOMPATIBLE",
    "message": "...",
    "details": []
  },
  "meta": {
    "timestamp": "2026-04-03T12:00:00.000Z",
    "path": "/api/v1/accounts"
  }
}
```

---

## 1) Crear cuenta — `POST /api/v1/accounts`

### ¿Por qué existe?

Para crear la cuenta base del workspace actual y, si corresponde, su profile tipado.

### Caso feliz recomendado

```json
{
  "name": "Visa hogar",
  "type": "CREDIT_CARD",
  "currencyCode": "ARS",
  "includeInReports": false,
  "notes": "Uso familiar",
  "profile": {
    "issuerName": "Visa",
    "last4": "1234",
    "creditLimit": 5000,
    "closingDayOfMonth": 25,
    "dueDayOfMonth": 10
  }
}
```

### Debería responder

- `201 Created`
- `data.type = CREDIT_CARD`
- `data.status = ACTIVE`
- `data.profile.last4 = "1234"`
- **No** debería exponer `initialBalance` ni `currentBalanceCached`

### Casos donde debe fallar

#### A. Profile incompatible

```json
{
  "name": "Banco incompatible",
  "type": "BANK",
  "currencyCode": "ARS",
  "profile": {
    "lenderName": "Banco Nación",
    "termMonths": 24
  }
}
```

Esperado:

- `400 Bad Request`
- `error.code = ACCOUNT_PROFILE_INCOMPATIBLE`

#### B. `last4` inválido en tarjeta

```json
{
  "name": "Visa inválida",
  "type": "CREDIT_CARD",
  "currencyCode": "ARS",
  "profile": {
    "issuerName": "Visa",
    "last4": "12A4"
  }
}
```

Esperado:

- `400 Bad Request`
- `error.code = VALIDATION_ERROR`
- `error.details` con algo como `profile.last4`

#### C. Campo diferido no soportado en `LENT_MONEY`

```json
{
  "name": "Préstamo a Juan",
  "type": "LENT_MONEY",
  "currencyCode": "ARS",
  "profile": {
    "borrowerName": "Juan Pérez",
    "status": "SETTLED"
  }
}
```

Esperado:

- `400 Bad Request`
- `error.code = VALIDATION_ERROR`
- `error.details` con algo como `profile.status`

#### D. Guest intentando crear

Esperado:

- `403 Forbidden`

---

## 2) Listar cuentas — `GET /api/v1/accounts`

### ¿Por qué existe?

Para ver las cuentas del workspace actual sin mezclar tenants.

### Caso feliz recomendado

Llamar sin query:

```http
GET /api/v1/accounts
```

### Debería responder

- `200 OK`
- solo cuentas del workspace actual
- por default solo `ACTIVE`

### Caso útil extra

```http
GET /api/v1/accounts?status=ARCHIVED
```

Debería traer solo archivadas.

---

## 3) Ver detalle — `GET /api/v1/accounts/:id`

### ¿Por qué existe?

Para traer una cuenta puntual del workspace actual. Soporta `ACTIVE` y `ARCHIVED`.

### Caso feliz recomendado

```http
GET /api/v1/accounts/{accountId}
```

### Debería responder

- `200 OK`
- el `id` correcto
- `type`, `status`, `includeInReports`, `notes`, `profile`

### Caso donde debe fallar

Si el `accountId` existe pero pertenece a otro workspace:

- `404 Not Found`
- `error.code = ACCOUNT_NOT_FOUND`

---

## 4) Editar metadata — `PATCH /api/v1/accounts/:id`

### ¿Por qué existe?

Para editar solo metadata mutable del core: nombre, notas, `includeInReports` y profile compatible.

### Caso feliz recomendado

```json
{
  "notes": "Solo gastos del hogar",
  "includeInReports": true
}
```

### Debería responder

- `200 OK`
- misma cuenta
- `notes` actualizado
- `includeInReports` actualizado

### Caso donde debe fallar

```json
{
  "currencyCode": "USD"
}
```

Esperado:

- `409 Conflict`
- `error.code = ACCOUNT_FIELD_IMMUTABLE`

---

## 5) Archivar — `PATCH /api/v1/accounts/:id/archive`

### ¿Por qué existe?

Para sacar una cuenta del set activo sin borrar nada y sin tocar metadata independiente.

### Caso feliz recomendado

```http
PATCH /api/v1/accounts/{accountId}/archive
```

### Debería responder

- `200 OK`
- `data.status = ARCHIVED`
- `includeInReports` se mantiene igual

### Check rápido posterior

- `GET /api/v1/accounts` → ya no debería aparecer
- `GET /api/v1/accounts?status=ARCHIVED` → sí debería aparecer

---

## 6) Reactivar — `PATCH /api/v1/accounts/:id/reactivate`

### ¿Por qué existe?

Para volver a activar una cuenta archivada sin reescribir metadata.

### Caso feliz recomendado

```http
PATCH /api/v1/accounts/{accountId}/reactivate
```

### Debería responder

- `200 OK`
- `data.status = ACTIVE`
- `includeInReports` se mantiene igual

---

## Smoke test recomendado en 5 minutos

1. Crear una `CREDIT_CARD` con profile válido.
2. Verificar que el response venga con `status = ACTIVE` y profile tipado.
3. Listar `/accounts` y confirmar que aparece.
4. Pedir detalle por `id`.
5. Hacer `PATCH` solo de `notes`.
6. Archivar la cuenta.
7. Confirmar que desaparece del listado default.
8. Confirmar que aparece en `?status=ARCHIVED`.
9. Reactivar.
10. Confirmar que vuelve a `ACTIVE`.

---

## Casos rápidos de error que sí o sí conviene probar

1. `BANK` + profile de préstamo → `400 ACCOUNT_PROFILE_INCOMPATIBLE`
2. `CREDIT_CARD.profile.last4 = 12A4` → `400 VALIDATION_ERROR`
3. `LENT_MONEY.profile.status = SETTLED` → `400 VALIDATION_ERROR`
4. `PATCH` queriendo cambiar `currencyCode` → `409 ACCOUNT_FIELD_IMMUTABLE`
5. `GET /accounts/:id` desde otro workspace → `404 ACCOUNT_NOT_FOUND`
6. `POST /accounts` con token `GUEST` → `403 Forbidden`

---

## Qué NO debería pasar en esta fase

Crear una cuenta **no** debería crear automáticamente:

- transacciones
- balances diarios
- reconciliaciones
- transfers
- cálculos de reporting

Si ves algo de eso, hay fuga de scope.

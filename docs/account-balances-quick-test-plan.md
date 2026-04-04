# Account Balances y Reconciliaciones — plan rápido de prueba manual

> Objetivo: probar rápido en la práctica qué hace cada endpoint nuevo y validar la idea clave del feature: **la conciliación corrige saldo observado, pero no crea un gasto/ingreso falso**.

## Base URL y headers

- Base URL: `/api/v1/accounts`
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`

## Roles esperados

- `ADMIN` / `MEMBER`: pueden leer y mutar conciliaciones
- `GUEST`: solo puede leer

## Envelope esperado

### Success

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "..."
  },
  "meta": {
    "timestamp": "2026-04-04T12:00:00.000Z",
    "path": "/api/v1/accounts/..."
  }
}
```

---

## Precondición recomendada para probar rápido

> Importante: hoy este slice **todavía no expone endpoints públicos de transacciones**. Entonces, para probar reconciliaciones de forma realista con lo que YA existe, el caso más simple es arrancar desde `initialBalance`.

Usá una cuenta del workspace actual con este caso simple:

- `initialBalance = 130`
- sin transacciones nuevas
- conciliación a `115` el `2026-03-26`

Sin conciliación, el sistema debería quedar en:

- saldo actual = `130`

Con una conciliación a `115` el `2026-03-26`, la diferencia debería ser `-15`.

---

## Escenario real recomendado hoy (de punta a punta, sin transacciones)

Si querés entenderlo **en la práctica**, probalo en este orden:

### Paso 0 — Crear la cuenta

Usá el endpoint existente de Accounts Core:

`POST /api/v1/accounts`

Payload ejemplo:

```json
{
  "name": "Banco pruebas conciliacion",
  "type": "BANK",
  "currencyCode": "ARS",
  "initialBalance": 130,
  "includeInReports": true,
  "notes": "Cuenta para probar balances"
}
```

### Qué revisar acá

- la cuenta se crea bien;
- el módulo `accounts` sigue siendo solo metadata;
- `currentBalanceCached` debería nacer en `130` internamente;
- **no** deberían aparecer conciliaciones ni snapshots diarios por solo crear la cuenta.

> OJO: eso es importante. Crear la cuenta NO debería inventar balances diarios ni reconciliaciones.

### Paso 1 — Verificar el estado base sin conciliación

Sin hacer nada más, pedí:

- `GET /api/v1/accounts/:accountId/balance-summary`
- `GET /api/v1/accounts/:accountId/daily-balances?from=2026-03-26&to=2026-03-26`

### Qué revisar acá

- el `balance-summary` debería mostrar `130` en todo:
  - `currentBalance = 130`
  - `calculatedBalance = 130`
  - `reconciledBalance = 130`
  - `difference = 0`
- el timeline probablemente venga vacío porque todavía no hubo ninguna fuente que materializar para esa fecha.

> Este paso es útil porque te deja clarísimo el punto de partida: la cuenta vale `130` por saldo inicial, sin ajustes.

> Nota importante de alcance: en este slice el recompute fuerte quedó conectado al flujo de conciliaciones. La prueba práctica más clara hoy arranca desde `initialBalance`, no desde transacciones públicas.

### Paso 2 — Crear conciliación

Ahí recién activás el caso clave del feature:

`POST /api/v1/accounts/:accountId/reconciliations`

con saldo observado `115` para el `2026-03-26`.

### Qué revisar en otros lados justo después

Después de crear la conciliación, revisá estas 3 cosas:

1. **Listado de conciliaciones**
   - tiene que aparecer la nueva fila
   - `isEffective` debería ser `true`

2. **Balance summary**
   - `calculatedBalance` debería ser `130`
   - `reconciledBalance` debería ser `115`
   - `difference` debería ser `-15`

3. **Daily balances timeline**
   - `2026-03-26` debería abrir en `130`, calcular `130`, ajustar `-15`, cerrar `115`

### Qué significa si todo eso pasó

Que el sistema hizo bien estas actualizaciones indirectas:

- materializó `AccountDailyBalance`;
- actualizó `Account.currentBalanceCached`;
- mantuvo separado saldo base vs ajuste de conciliación.

### Paso 3 — Editar conciliación

Cambiala de `115` a `120`.

### Qué revisar en otros lados

- el detalle/lista debe mostrar `targetBalance = 120`;
- el summary debe pasar a:
  - `reconciledBalance = 120`
  - `difference = -10`
- el timeline del `2026-03-26` debe reflejar ajuste `-10` en vez de `-15`.

### Paso 4 — Borrar conciliación

Eliminala.

### Qué revisar en otros lados

- la conciliación desaparece del detalle/lista;
- el summary vuelve al saldo calculado:
  - `reconciledBalance = 130`
  - `difference = 0`
- el timeline del `2026-03-26` debería quedar vacío otra vez o sin ajuste, porque ya no queda fuente que materializar para ese día.

### Traducción simple del escenario completo

- la cuenta sola no hace nada raro;
- el saldo inicial da la base del caso;
- la conciliación corrige el saldo observado;
- summary, timeline y cache se actualizan a partir de eso.

### Si querés un escenario con transacciones reales hoy

Como todavía no hay endpoint público de transacciones en este slice, solo hay 2 formas:

1. esperar a que exista el módulo/endpoint de transacciones;
2. cargar filas manualmente en DB/Prisma Studio para una prueba técnica interna.

Para validación funcional rápida de este slice, **recomendado hoy: usar el escenario basado en `initialBalance`**.

---

## 1) Crear conciliación — `POST /api/v1/accounts/:accountId/reconciliations`

### ¿Por qué existe?

Para registrar el saldo real observado de una cuenta en una fecha sin inventar una transacción falsa.

### Payload ejemplo

```json
{
  "date": "2026-03-26",
  "targetBalance": 115,
  "reason": "Saldo real del banco"
}
```

### Debería responder

- `201 Created`
- `data.targetBalance = "115"`
- `data.date = "2026-03-26"`
- `data.isEffective = true`
- `data.reason = "Saldo real del banco"`

### Qué valida en la práctica

- que se guardó la conciliación;
- que quedó marcada como efectiva para ese día;
- que el sistema ajusta saldo, no cashflow.

### Casos donde debe fallar

- `403` si el token es `GUEST`
- `404 ACCOUNT_NOT_FOUND` si la cuenta no existe o no pertenece al workspace
- `400` si `accountId` no es CUID válido
- `400` si `date` es inválida
- `400` si `targetBalance` no es numérico

---

## 2) Listar conciliaciones — `GET /api/v1/accounts/:accountId/reconciliations`

### ¿Por qué existe?

Para ver el historial/auditoría de conciliaciones de una cuenta y saber cuál manda en cada fecha.

### Payload

Sin body.

### Debería responder

- `200 OK`
- array ordenado por fecha y recencia
- cada item con:
  - `id`
  - `date`
  - `targetBalance`
  - `reason`
  - `isEffective`
  - `author`

### Qué valida en la práctica

- que hay trail de auditoría;
- que si hay varias conciliaciones el mismo día, solo una queda efectiva.

### Casos donde debe fallar

- `404 ACCOUNT_NOT_FOUND` si la cuenta no existe o no pertenece al workspace
- `400` si `accountId` no es CUID válido

---

## 3) Ver detalle de conciliación — `GET /api/v1/accounts/:accountId/reconciliations/:reconciliationId`

### ¿Por qué existe?

Para inspeccionar una conciliación puntual y verificar autor, fecha y estado efectivo.

### Payload

Sin body.

### Debería responder

- `200 OK`
- `data.id = reconciliationId`
- `data.author.email` con el usuario que la creó
- `data.isEffective` correcto

### Casos donde debe fallar

- `404 ACCOUNT_RECONCILIATION_NOT_FOUND` si no existe o está fuera del workspace
- `400` si `accountId` o `reconciliationId` no son CUID válidos

---

## 4) Ver resumen de balance — `GET /api/v1/accounts/:accountId/balance-summary`

### ¿Por qué existe?

Para ver rápido el estado actual de la cuenta y entender la diferencia entre:

- saldo calculado;
- saldo reconciliado;
- diferencia.

### Payload

Sin body.

### Debería responder para el caso ejemplo con conciliación a `115`

```json
{
  "accountId": "<accountId>",
  "currencyCode": "ARS",
  "currentBalance": "115",
  "calculatedBalance": "130",
  "reconciledBalance": "115",
  "difference": "-15",
  "hasDifference": true,
  "lastSnapshotDate": "2026-03-26"
}
```

### Qué valida en la práctica

- que `currentBalanceCached` quedó alineado con el último snapshot;
- que la conciliación entra como diferencia/ajuste y no como movimiento falso.

### Casos donde debe fallar

- `404 ACCOUNT_NOT_FOUND` si la cuenta no existe o está fuera del workspace
- `400` si `accountId` no es CUID válido

---

## 5) Ver timeline diario — `GET /api/v1/accounts/:accountId/daily-balances?from=2026-03-26&to=2026-03-26`

### ¿Por qué existe?

Para ver la cadena diaria materializada: cómo abrió, qué entró, qué salió, qué ajuste hubo y cómo cerró cada día.

### Payload

Sin body. Solo query params:

- `from`
- `to`

### Debería responder para el caso ejemplo actual

```json
[
  {
    "date": "2026-03-26",
    "openingBalance": "130",
    "inflowsAmount": "0",
    "outflowsAmount": "0",
    "adjustmentsAmount": "-15",
    "closingBalance": "115",
    "calculatedBalance": "130",
    "reconciledBalance": "115",
    "difference": "-15"
  }
]
```

### Qué valida en la práctica

- que el recompute desde fecha afectada funciona;
- que la conciliación modifica `adjustmentsAmount`, no `inflows/outflows`;
- que el timeline aparece cuando existe una fuente que materializar.

### Casos donde debe fallar

- `400 VALIDATION_ERROR` si `from > to`
- `400` si `from` o `to` no son fechas válidas
- `404 ACCOUNT_NOT_FOUND` si la cuenta no existe o está fuera del workspace

---

## 6) Actualizar conciliación — `PATCH /api/v1/accounts/:accountId/reconciliations/:reconciliationId`

### ¿Por qué existe?

Para corregir una conciliación existente y forzar rematerialización desde la fecha afectada.

### Payload ejemplo

```json
{
  "targetBalance": 120
}
```

### Debería responder

- `200 OK`
- `data.targetBalance = "120"`

Y luego, al pedir `balance-summary`, debería quedar:

- `reconciledBalance = "120"`
- `difference = "-10"`

### Qué valida en la práctica

- que editar una conciliación sí mueve el snapshot diario;
- que el sistema recalcula desde la fecha afectada.

### Casos donde debe fallar

- `403` si el token es `GUEST`
- `404 ACCOUNT_RECONCILIATION_NOT_FOUND` si no existe o está fuera del workspace
- `400` si el payload es inválido

---

## 7) Eliminar conciliación — `DELETE /api/v1/accounts/:accountId/reconciliations/:reconciliationId`

### ¿Por qué existe?

Para sacar una conciliación y volver al saldo calculado si ya no hay ajuste efectivo ese día.

### Payload

Sin body.

### Debería responder

- `204 No Content`

Y luego, al pedir `balance-summary`, debería quedar:

- `reconciledBalance = "130"`
- `difference = "0"`

### Qué valida en la práctica

- que el sistema recompone el balance sin esa conciliación;
- que no deja basura en snapshots ni en cache.

### Casos donde debe fallar

- `403` si el token es `GUEST`
- `404 ACCOUNT_RECONCILIATION_NOT_FOUND` si no existe o está fuera del workspace

---

## Casos rápidos de seguridad

### Workspace aislado

Con un token de otro workspace, pedir:

`GET /api/v1/accounts/:accountId/balance-summary`

Debería fallar con:

- `404 ACCOUNT_NOT_FOUND`

### ¿Qué valida?

Que balances y conciliaciones no se filtren entre workspaces.

---

## Checklist final de prueba rápida

- [ ] crear conciliación con `MEMBER` → `201`
- [ ] intentar crear conciliación con `GUEST` → `403`
- [ ] listar conciliaciones y ver `isEffective`
- [ ] ver detalle y confirmar `author`
- [ ] ver `balance-summary` y confirmar `130 / 115 / -15`
- [ ] ver `daily-balances` y confirmar `130 -> ajuste -15 -> 115`
- [ ] actualizar conciliación a `120` y confirmar diferencia `-10`
- [ ] eliminar conciliación y confirmar diferencia `0`
- [ ] probar token de otro workspace y confirmar `404`
- [ ] probar `from > to` y confirmar `400 VALIDATION_ERROR`

## Qué cosas se tuvieron que actualizar “en otro lado”

Cuando probás esta funcionalidad, no revises solo el endpoint que llamaste. Revisá también:

### Después de crear/editar/borrar conciliación

- `GET /reconciliations` → auditoría y `isEffective`
- `GET /balance-summary` → saldo actual/calculado/reconciliado/diferencia
- `GET /daily-balances` → cadena diaria materializada

### A nivel de modelo mental

Lo que debería haber cambiado internamente es esto:

- `AccountReconciliation` → nueva fila o fila actualizada/eliminada
- `AccountDailyBalance` → snapshots recalculados desde la fecha afectada
- `Account.currentBalanceCached` → saldo actual alineado con el último snapshot

### Lo que NO debería haber cambiado

- no debería aparecer una `Transaction` falsa;
- no debería cambiarse el saldo base por fuera del ajuste esperado;
- no debería mezclarse información entre workspaces.

## En una frase

Si este plan pasa, queda probado en la práctica que el feature hace lo correcto: **corrige saldo observado sin inventar transacciones falsas y mantiene consistentes timeline, summary y cache**.

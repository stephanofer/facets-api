# Design: Balances y Reconciliaciones

## Technical Approach

Primer slice con módulo nuevo `account-balances`; `accounts` sigue siendo Accounts Core (metadata). El módulo nuevo concentra conciliaciones, lectura de balances y un único motor de recompute inline por cuenta. Se apoya en modelos ya existentes: `Account`, `AccountDailyBalance`, `AccountReconciliation`, `Transaction`, `Transfer`.

## Architecture Decisions

| Decisión              | Opciones                                  | Elección                               | Rationale                                                                                                       |
| --------------------- | ----------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Boundary              | meter lógica en `accounts` / módulo nuevo | módulo `account-balances`              | respeta el límite ya documentado en `accounts.controller.ts` y evita mezclar metadata con matemática financiera |
| Recompute             | on-demand / materializado                 | materializado + cache                  | `AccountDailyBalance` y `currentBalanceCached` ya existen y sirven para timeline rápido                         |
| Conciliación efectiva | única por día / varias con precedencia    | varias; gana `createdAt DESC, id DESC` | preserva auditoría y da desempate determinístico sin cambiar schema                                             |
| Consistencia          | jobs async / inline                       | inline en slice 1                      | simple-first; menor complejidad operativa; deja listo el contrato para mover a background luego                 |

## Data Flow

### Create/Update/Delete reconciliation

`Controller -> Service -> Prisma $transaction -> Repository writes reconciliation -> RecomputeService.recomputeFromDate(accountId, workspaceId, date, tx) -> update Account.currentBalanceCached + Workspace.financialDataUpdatedAt`

Para update/delete, primero se valida que la conciliación pertenezca a una cuenta del `workspaceId` autenticado; luego se toma `affectedDate = reconciliation.date` y se rematerializa desde ahí.

### Trigger de recompute por writes financieros

Contrato reusable: cualquier futuro write de `Transaction` o `Transfer` debe llamar el mismo `recomputeFromDate(...)` con la fecha afectada, dentro de la misma transacción interactiva. En este slice sólo lo ejecutan conciliaciones, pero el diseño ya centraliza el trigger.

### Cálculo diario paso a paso

1. Resolver cuenta por `{ id, workspaceId }`.
2. Normalizar `affectedDate` a fecha.
3. Buscar snapshot previo `< affectedDate`; si no existe, `opening = initialBalance`.
4. Borrar `AccountDailyBalance` desde `affectedDate` para evitar filas stale.
5. Calcular `throughDate = max(última transaction ACTIVE, última reconciliation, último snapshot previo borrado)` para esa cuenta; si no hay fuentes futuras, dejar sin snapshots y cache = `initialBalance`.
6. Leer agregados diarios de transacciones ACTIVE por fecha: `INFLOW` suma `inflows`, `OUTFLOW` suma `outflows`.
7. Leer conciliaciones del rango ordenadas `date ASC, createdAt DESC, id DESC`; por cada día elegir la primera.
8. Iterar día por día hasta `throughDate`:
   - `calculatedBalance = opening + inflows - outflows`
   - `adjustmentsAmount = targetBalance - calculatedBalance` si hay conciliación efectiva; si no `0`
   - `closingBalance = calculatedBalance + adjustmentsAmount`
   - persistir snapshot con `currencyCode = account.currencyCode`
   - siguiente `opening = closingBalance`
9. Actualizar `Account.currentBalanceCached` con el último `closingBalance`; si no quedaron snapshots, usar `initialBalance`.

Saldo calculado = `opening + inflows - outflows`. Saldo reconciliado = `closingBalance`. Diferencia = `adjustmentsAmount`.

## File Changes

| File                                                                       | Action    | Description                                       |
| -------------------------------------------------------------------------- | --------- | ------------------------------------------------- |
| `src/modules/account-balances/account-balances.module.ts`                  | Create    | módulo feature                                    |
| `src/modules/account-balances/account-balances.controller.ts`              | Create    | endpoints de reconciliaciones, summary y timeline |
| `src/modules/account-balances/account-balances.service.ts`                 | Create    | orquestación, validación y permisos               |
| `src/modules/account-balances/account-balances.repository.ts`              | Create    | queries Prisma scoped por workspace vía `Account` |
| `src/modules/account-balances/domain/account-balance-recompute.service.ts` | Create    | motor único de materialización                    |
| `src/modules/account-balances/dtos/*.ts`                                   | Create    | request/response Swagger                          |
| `src/app.module.ts`                                                        | Modify    | registrar módulo                                  |
| `prisma/schema.prisma`                                                     | No change | schema suficiente para slice 1                    |

## Interfaces / Contracts

Endpoints iniciales:

- `POST /api/v1/accounts/:accountId/reconciliations`
- `GET /api/v1/accounts/:accountId/reconciliations`
- `GET /api/v1/accounts/:accountId/reconciliations/:reconciliationId`
- `PATCH /api/v1/accounts/:accountId/reconciliations/:reconciliationId`
- `DELETE /api/v1/accounts/:accountId/reconciliations/:reconciliationId`
- `GET /api/v1/accounts/:accountId/balance-summary`
- `GET /api/v1/accounts/:accountId/daily-balances?from=&to=`

Todos usan `@CurrentPrincipal()` + `@RequireWorkspaceRole(ADMIN|MEMBER)` para mutaciones y `GUEST` para lecturas.

## Testing Strategy

| Layer       | What to test                                                                   | Approach                                                                  |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Unit        | matemática diaria, precedencia `createdAt/id`, cache final                     | specs de `account-balance-recompute.service` y `account-balances.service` |
| Integration | queries scoped por `account.workspaceId`, recompute desde fecha, update/delete | Prisma real en `src/modules/account-balances/*.integration.spec.ts`       |
| E2E         | contratos HTTP, roles, envelope, aislamiento entre workspaces                  | `test/account-balances.e2e-spec.ts`                                       |

## Migration / Rollout

No migration required para slice 1. Los índices actuales (`accountId,date` y `accountId,date,createdAt`) alcanzan. Rollout: registrar módulo, exponer Swagger y mantener recompute inline. Si aparecen conflictos `P2034`, reintentar la transacción.

## Open Questions

- [ ] Si en el futuro se necesita orden total más fuerte que `createdAt/id`, agregar columna monotónica de precedencia.
- [ ] Si la rematerialización por cuenta crece mucho, mover `recomputeFromDate` a job en background sin cambiar contratos HTTP ni repositorios.

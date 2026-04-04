# Tasks: Balances y Reconciliaciones (Slice 1)

## Phase 1: Foundation (prerrequisito de todo lo demás)

- [x] 1.1 Crear `src/modules/account-balances/` con `account-balances.module.ts` y registrar el módulo en `src/app.module.ts`.
- [x] 1.2 Crear DTOs y response models en `src/modules/account-balances/dtos/` para create/update/list/detail/summary/timeline, con Swagger y validaciones.
- [x] 1.3 Crear `account-balances.repository.ts` con queries Prisma scoped por `Account.workspaceId`; incluir lookup de cuenta, conciliaciones y snapshots diarios.
- [x] 1.4 Crear `domain/account-balance-recompute.service.ts` con el contrato `recomputeFromDate(accountId, workspaceId, affectedDate, tx)`.

## Phase 2: Core domain (depende de 1.3-1.4)

- [x] 2.1 Implementar en el recompute: snapshot previo, borrado desde fecha afectada, agregados diarios de `Transaction` ACTIVE y selección de conciliación efectiva por `createdAt DESC, id DESC`.
- [x] 2.2 Actualizar `Account.currentBalanceCached` y `Workspace.financialDataUpdatedAt` dentro de la misma transacción; manejar caso sin snapshots futuros.
- [x] 2.3 Crear `account-balances.service.ts` para create/update/delete/list/detail de conciliaciones con validación por workspace y recompute inline.
- [x] 2.4 Agregar métodos de lectura para `GET /balance-summary` y `GET /daily-balances?from=&to=` devolviendo saldo calculado, reconciliado y diferencia.

## Phase 3: HTTP + docs (depende de 2.3-2.4)

- [x] 3.1 Crear `account-balances.controller.ts` con rutas bajo `/accounts/:accountId/...`, `@CurrentPrincipal()` y `@RequireWorkspaceRole`; mutaciones ADMIN|MEMBER, lecturas GUEST.
- [x] 3.2 Documentar todos los endpoints con Swagger (`@ApiOperation`, `@ApiParam`, `@ApiResponse`) y preservar el boundary: reconciliaciones fuera de `accounts.controller.ts`.
- [x] 3.3 Actualizar `docs/facets-financial-schema-walkthrough-es.md` para aclarar que conciliación ajusta estado, no cashflow.

## Phase 4: Tests (depende de 3.1)

- [x] 4.1 Unit: `account-balance-recompute.service.spec.ts` para día conciliado, día sin conciliación, precedencia por timestamps/id y recompute retroactivo.
- [x] 4.2 Unit: `account-balances.service.spec.ts` para permisos, trigger de recompute, update/delete de conciliación efectiva y no creación de transacciones falsas.
- [x] 4.3 Integration: `src/modules/account-balances/account-balances.integration.spec.ts` con Prisma real para scoping por workspace, queries de timeline/resumen y realineación de snapshots/cache.
- [x] 4.4 E2E: `test/account-balances.e2e-spec.ts` para contratos HTTP, roles, envelope, aislamiento entre workspaces y CRUD completo de conciliaciones.

## Phase 5: Verification (depende de 4.1-4.4)

- [x] 5.1 Ejecutar verificación estática con `pnpm exec tsc --noEmit` y corregir wiring/DI del módulo.
- [x] 5.2 Ejecutar unit tests focalizados de `account-balances`.
- [x] 5.3 Ejecutar integration tests de `account-balances`.
- [x] 5.4 Ejecutar `pnpm test:e2e -- account-balances.e2e-spec.ts` o equivalente del repo y validar Swagger/envelope.

## Batch recomendado

- Batch A: 1.1-1.4
- Batch B: 2.1-2.4
- Batch C: 3.1-3.3 + 4.1-4.2
- Batch D: 4.3-5.4

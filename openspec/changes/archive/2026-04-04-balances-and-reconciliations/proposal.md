# Proposal: Balances and Reconciliations

## Intent

Facets necesita una base financiera que diga la verdad. El problema hoy no es “mostrar un saldo”, sino separar correctamente: movimientos reales, correcciones de saldo observado e historial diario materializado.

Ejemplo: saldo calculado `1200`, saldo bancario real `1150`. Debemos registrar una **conciliación** a `1150`, no un gasto falso de `50`.

## Scope

### In Scope

- Introducir capacidad formal de conciliaciones por cuenta.
- Definir motor de materialización de `AccountDailyBalance` y actualización de `Account.currentBalanceCached`.
- Exponer primera API de conciliación y lectura de balance diario/resumen.
- Formalizar reglas de auditoría, rematerialización y scoping por `workspaceId` vía `Account`.

### Out of Scope

- Import bancario, auto-match, jobs distribuidos complejos.
- Transfers completos, budgets nuevos y reporting avanzado.
- Reemplazar `accounts` core como módulo de metadata.

## Capabilities

### New Capabilities

- `account-balances`: cálculo, materialización y lectura de saldos diarios/cached.
- `account-reconciliations`: CRUD auditado de conciliaciones por cuenta.

### Modified Capabilities

- None.

## Approach

Decisión: crear un módulo NestJS dedicado (`account-balances`) con servicio de dominio interno y repositorios separados; `accounts` sigue siendo metadata. Responsabilidades:

- `Account`: identidad, moneda, `initialBalance`, `currentBalanceCached`.
- `Transaction`: cashflow real.
- `AccountReconciliation`: saldo observado; la última creada del día gana.
- `AccountDailyBalance`: snapshot derivado (`opening + inflows - outflows + adjustments = closing`).

Las diferencias entre saldo calculado y observado viven en `adjustmentsAmount`; NO crean transacciones. Ante write backdated o conciliación nueva/editada/borrada, recomputar desde la fecha afectada hacia adelante hasta restaurar consistencia. Primera implementación: recompute sincrónico acotado por cuenta/rango, dentro de transacción Prisma cuando aplique.

API inicial: crear/listar/ver/editar/eliminar conciliación y leer timeline/resumen de balance por cuenta. Debe incluir saldo calculado, saldo reconciliado y diferencia.

Auditoría: preservar historial de conciliaciones, timestamps, motivo opcional y consistencia entre snapshots y cache. Cada write financiero debe tocar `Workspace.financialDataUpdatedAt`.

## Affected Areas

| Area                                             | Impact   | Description                                |
| ------------------------------------------------ | -------- | ------------------------------------------ |
| `openspec/changes/balances-and-reconciliations/` | Modified | Proposal y futuros artefactos SDD          |
| `prisma/schema.prisma`                           | Modified | Reglas backend sobre modelos ya existentes |
| `src/modules/accounts/`                          | Modified | Mantener boundary de metadata              |
| `src/app.module.ts`                              | Modified | Registrar módulo nuevo                     |
| `docs/facets-financial-schema-walkthrough-es.md` | Modified | Alinear contrato semántico                 |

## Risks

| Risk                                   | Likelihood | Mitigation                                     |
| -------------------------------------- | ---------- | ---------------------------------------------- |
| Reconciliación como transacción falsa  | High       | Regla explícita: ajuste de estado, no cashflow |
| Desync entre snapshot y cached balance | Med        | Un solo motor de recompute                     |
| Fuga multi-tenant                      | Med        | Scoping siempre vía `Account.workspaceId`      |

## Rollback Plan

No exponer endpoints productivos hasta validar contrato, tests y docs; si falla, retirar módulo y mantener `accounts` sin lógica financiera nueva.

## Dependencies

- Contrato semántico aprobado.
- Specs de `account-balances` y `account-reconciliations`.

## Success Criteria

- [ ] Conciliación no altera cashflow ni budget/reportes.
- [ ] `currentBalanceCached` y último snapshot cuentan la misma historia.
- [ ] Backdated writes rematerializan desde la fecha afectada.
- [ ] Endpoints nuevos tienen Swagger, unit tests, integración y e2e.

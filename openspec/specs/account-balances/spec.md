# Especificación de Account Balances

## Purpose

Definir snapshots diarios y saldo actual.

## Requirements

### Requirement: Materialización diaria y cache consistente

El sistema MUST derivar `AccountDailyBalance` desde `Account.initialBalance`, cashflow real y conciliación efectiva. `openingBalance` MUST ser el `closingBalance` previo, o `initialBalance` si no hay día previo. `inflowsAmount` y `outflowsAmount` MUST contar sólo movimientos reales. `adjustmentsAmount` MUST ser `targetBalance - (opening + inflows - outflows)` cuando exista conciliación efectiva; si no, `0`. `closingBalance` MUST ser `opening + inflows - outflows + adjustmentsAmount`. `Account.currentBalanceCached` MUST igualar el último `closingBalance`, o `initialBalance`.

#### Scenario: Día conciliado

- GIVEN `openingBalance = 1200` y conciliación efectiva a `1150`
- WHEN el sistema materializa el día
- THEN `adjustmentsAmount` es `-50` y `closingBalance` es `1150`
- AND `currentBalanceCached` refleja ese cierre si es el último día

#### Scenario: Día sin conciliación

- GIVEN `openingBalance = 100`, `inflowsAmount = 40` y `outflowsAmount = 10`
- WHEN el sistema materializa el día
- THEN `adjustmentsAmount` es `0`
- AND `closingBalance` es `130`

### Requirement: Recompute por mutaciones backdated

Ante una mutación backdated o un create/update/delete de conciliación, el sistema MUST recomputar desde la fecha afectada hacia adelante para esa cuenta. Consistencia significa que cada día encadena contra el anterior y que `currentBalanceCached` coincide con el último snapshot.

#### Scenario: Escritura retroactiva

- GIVEN snapshots correctos hasta el 2026-03-31 y una escritura en 2026-03-28
- WHEN la escritura se confirma
- THEN el sistema recomputa desde 2026-03-28 hacia adelante
- AND deja cache y snapshots alineados

### Requirement: APIs iniciales de lectura y límites

El sistema MUST exponer una API de timeline y una de resumen por cuenta, ambas scoped por `Account.workspaceId`. El timeline MUST devolver por día `opening`, `inflows`, `outflows`, `adjustments`, `closing`, saldo calculado, reconciliado y diferencia. El resumen MUST devolver saldo actual, fecha del último snapshot y si hay diferencia entre saldo calculado y reconciliado. Este slice MUST NOT definir import bancario, matching automático, jobs distribuidos ni DTOs cerrados.

#### Scenario: Lectura de timeline o resumen

- GIVEN una cuenta del workspace autenticado con snapshots
- WHEN el cliente consulta timeline o resumen
- THEN recibe sólo datos de esa cuenta y workspace
- AND puede distinguir saldo calculado, reconciliado y diferencia

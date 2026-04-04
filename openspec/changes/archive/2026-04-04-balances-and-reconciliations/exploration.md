## Exploration: balances-and-reconciliations

### Current State

#### Estado real del codebase hoy

- `prisma/schema.prisma` YA define `Account`, `AccountDailyBalance`, `AccountReconciliation`, `Transaction` y `Transfer`.
- `src/modules/accounts/*` sólo cubre **Accounts Core**: crear/listar/detallar/editar metadata de cuentas.
- El propio controller de accounts declara que esta superficie **excluye balances, transfers, reconciliation y reporting math**.
- El test de integración `src/modules/accounts/accounts.repository.integration.spec.ts` valida explícitamente que crear una cuenta **NO** crea `transactions`, `accountDailyBalance` ni `accountReconciliation`.
- Hoy no existe módulo NestJS dedicado para reconciliaciones, balances diarios, transacciones ni transfers.
- `Account.currentBalanceCached` existe en schema, pero hoy sólo se inicializa al crear la cuenta; no hay todavía motor implementado para mantenerlo sincronizado cuando haya movimientos financieros.

#### Intención de dominio, en lenguaje simple

La app necesita separar TRES cosas distintas:

1. **qué pasó** → movimientos reales (`Transaction`, y después `Transfer` para unir movimientos internos);
2. **cómo quedó la cuenta ese día** → snapshot diario (`AccountDailyBalance`);
3. **qué saldo real confirmó el usuario contra el mundo externo** → conciliación (`AccountReconciliation`).

Si mezclamos esas tres cosas, el producto empieza a mentir.

#### Qué problema resuelve `AccountDailyBalance`

`AccountDailyBalance` resuelve lectura rápida e histórica:

- charts por cuenta;
- sparklines;
- series diarias confiables;
- lectura predecible sin recalcular todo el ledger en cada request.

NO es la fuente primaria del cashflow. Es una tabla **derivada/materializada**.

#### Qué problema resuelve `AccountReconciliation`

`AccountReconciliation` resuelve una corrección de estado:

- el sistema cree un saldo;
- el banco, efectivo real o extracto muestra otro;
- el usuario necesita decir “la verdad observable ahora es esta”.

Eso corrige saldo, pero NO significa que ocurrió un gasto o ingreso nuevo.

#### Ejemplo mínimo

- saldo calculado por sistema al 2026-03-26: `1200`
- saldo real del banco al 2026-03-26: `1150`
- se crea una conciliación con `targetBalance = 1150`

Resultado correcto:

- la cuenta queda reconciliada a `1150`;
- el ajuste del día puede verse en snapshots como `adjustmentsAmount = -50`;
- NO aparece un gasto de `50` en reportes, budget ni cashflow.

### Affected Areas

- `prisma/schema.prisma` — ya contiene los modelos base y varias reglas implícitas que el backend todavía no materializa.
- `docs/facets-financial-schema-walkthrough-es.md` — documenta la semántica correcta: reconciliación corrige estado, snapshots son derivados y múltiples conciliaciones por día toman la última creada.
- `docs/facets-roadmap-implementacion-financiera.md` — fija esta fase antes de transacciones estándar y transfers porque es fundacional.
- `docs/facets.md` — refuerza que reconciliar no debe ensuciar analytics.
- `src/modules/accounts/accounts.controller.ts` — marca el límite actual del módulo de cuentas; balances/reconciliaciones deberían vivir aparte.
- `src/modules/accounts/accounts.repository.integration.spec.ts` — prueba contractual de que Accounts Core no invade artefactos financieros downstream.
- `src/app.module.ts` — habrá que registrar módulos nuevos.
- `src/database/prisma.service.ts` — lugar natural para soportar transacciones Prisma del futuro flujo de materialización.

### Approaches

1. **Usar transacción falsa para reconciliar** — crear un ingreso/gasto artificial para que el saldo “cierre”.
   - Pros: implementación rápida, lectura simple del saldo final.
   - Cons: ROMPE cashflow, budget, categorías, reportes, auditoría semántica y futuras features de transfers/deudas/préstamos.
   - Effort: Low

2. **Separar ledger, conciliación y snapshots** — `Transaction` como verdad de cashflow, `AccountReconciliation` como corrección de estado, `AccountDailyBalance` como lectura derivada.
   - Pros: semántica correcta, analytics limpios, base sólida para transfers, pagos internos, deuda/préstamo y dashboard.
   - Cons: exige motor de recomputación/materialización y reglas claras de precedencia.
   - Effort: Medium

3. **Calcular todo on-demand desde ledger + conciliaciones** — sin materializar snapshots.
   - Pros: menos tablas derivadas para mantener.
   - Cons: queries caras, charts lentos, lógica repetida, más riesgo de inconsistencias entre endpoints.
   - Effort: Medium/High

### Recommendation

#### Recomendación principal

Adoptar el enfoque **2**: separar estrictamente

- **cashflow real** = `Transaction` (+ `Transfer` para movimientos internos),
- **corrección de estado** = `AccountReconciliation`,
- **lectura histórica rápida** = `AccountDailyBalance`,
- **saldo actual rápido** = `Account.currentBalanceCached`.

#### Modelo de fuente de verdad recomendado

La historia correcta es esta:

1. `Account.initialBalance` = punto de partida de la cuenta.
2. `Transaction` = eventos reales que mueven dinero o deuda según su semántica.
3. `Transfer` = une dos transacciones internas; NO agrega cashflow nuevo.
4. `AccountReconciliation` = redefine el saldo observado para una fecha, sin crear evento de gasto/ingreso.
5. `AccountDailyBalance` = materialización diaria derivada de 1-4.
6. `Account.currentBalanceCached` = último closing consistente de la cuenta.

#### Por qué reconciliación NO debe crear transacción falsa

Porque una conciliación responde “**cómo está la cuenta realmente**”, no “**qué movimiento económico ocurrió**”.

Si la convertimos en gasto/ingreso falso:

- el usuario ve cashflow inventado;
- budgets se desvían;
- reportes mensuales mienten;
- una diferencia operativa o error de carga termina pareciendo consumo real;
- después transfers, pagos de tarjeta, préstamos y deuda heredan una base podrida.

#### Cómo deben convivir snapshots y conciliaciones sin corromper el ledger

Regla mental diaria:

- `openingBalance`
- `+ inflowsAmount`
- `- outflowsAmount`
- `+ adjustmentsAmount`
- `= closingBalance`

`adjustmentsAmount` debe absorber el efecto de la conciliación efectiva del día.

El ledger de transacciones NO cambia por reconciliar. Cambia la lectura del saldo observado.

#### Invariantes clave a preservar

1. Una conciliación jamás crea ni reemplaza `Transaction`.
2. `AccountDailyBalance` nunca es fuente primaria de cashflow; sólo lectura derivada.
3. `currentBalanceCached`, `AccountDailyBalance` y reconciliaciones deben contar la MISMA historia.
4. La conciliación efectiva de un día debe ser la **última creada** para esa cuenta y fecha.
5. La rematerialización debe arrancar desde la fecha afectada hacia adelante.
6. `Account.currencyCode` y `AccountDailyBalance.currencyCode` deben permanecer coherentes.
7. Todo acceso de negocio sigue scoped por `workspaceId`, aunque `AccountDailyBalance` y `AccountReconciliation` no tengan `workspaceId` propio.
8. Reconciliar una cuenta no debe contaminar budget/reportes con gasto o ingreso artificial.
9. Borrar o editar una conciliación vieja debe recomputar snapshots futuros.
10. Futuras transfers/pagos internos deben seguir afectando saldo, pero no analytics operativos, con la misma matriz semántica.

#### Flujos esperados de usuario / UX

1. **Ver saldo actual de cuenta**
   - lee `currentBalanceCached` y/o último snapshot consistente.
2. **Ver historial diario**
   - lee `AccountDailyBalance`.
3. **Conciliar saldo actual**
   - usuario ingresa fecha, saldo observado y motivo opcional.
   - backend guarda `AccountReconciliation` y rematerializa desde esa fecha.
4. **Editar o eliminar conciliación**
   - backend vuelve a calcular desde esa fecha hacia adelante.
5. **Entender diferencia**
   - UI debería poder explicar: “saldo calculado”, “saldo reconciliado”, “ajuste aplicado”.

#### Riesgos concretos si se implementa mal

- doble conteo en reportes;
- gasto/ingreso falso por reconciliación;
- charts mostrando una historia distinta al dashboard;
- transferencias futuras apoyadas sobre saldos inconsistentes;
- bugs multi-tenant por consultar conciliaciones/snapshots sin pasar por `Account.workspaceId`;
- race conditions si varias escrituras financieras recomputan el mismo rango sin estrategia clara;
- backfills lentos o parciales que dejan `currentBalanceCached` desfasado.

#### Boundaries y secuencia recomendada para fases posteriores

1. **Cerrar contrato semántico**
   - definir oficialmente cálculo de saldo, precedencia de conciliación y política de rematerialización.
2. **Crear módulo dedicado**
   - sugerido: `account-balances` o `reconciliations`.
   - NO meter esta lógica dentro de `accounts` core.
3. **Implementar motor interno de balance/materialización**
   - servicio puro o de dominio para recomputar snapshots y saldo cached.
4. **Exponer reconciliación primero**
   - create/list/detail/update/delete reconciliation.
   - endpoint para timeline/resumen de balance por cuenta.
5. **Integrar transacciones estándar**
   - cada write financiero dispara el mismo motor.
6. **Integrar transfers y pagos internos**
   - reutilizan el mismo motor, sin reinterpretar analytics por endpoint.

#### Implicancias API / testing / documentación en NestJS + Prisma

- Necesitaremos DTOs y Swagger para conciliaciones y lecturas de balance.
- Nuevos endpoints deberían cubrir mínimo:
  - crear conciliación;
  - listar conciliaciones de cuenta;
  - editar/eliminar conciliación;
  - ver serie diaria / balance summary.
- Unit tests:
  - cálculo de opening/inflows/outflows/adjustments/closing;
  - última conciliación del día gana;
  - editar/borrar conciliación rematerializa bien.
- Integration tests Prisma:
  - scope por workspace vía `Account`;
  - rematerialización consistente de varios días;
  - coherencia entre `currentBalanceCached` y último snapshot.
- E2E tests Nest:
  - permisos por `@CurrentPrincipal()` y roles de workspace;
  - contrato HTTP y error envelopes;
  - swagger docs correctas para request/response.
- También conviene centralizar el “touch” de `Workspace.financialDataUpdatedAt` en cada write financiero, porque hoy la regla está documentada pero no está institucionalizada en un módulo común.

#### Gaps y ambigüedades detectadas

1. El schema permite múltiples conciliaciones por día, pero esa regla de “gana la última creada” hoy sólo vive en docs.
2. `AccountReconciliation` no tiene `workspaceId`; la seguridad/filtrado depende de pasar siempre por `Account`.
3. `AccountDailyBalance` tampoco tiene `workspaceId`; mismo riesgo de scoping y performance.
4. No hay todavía módulo/servicio/repository para balances o reconciliaciones.
5. No existe aún un helper explícito para mantener `financialDataUpdatedAt` ante writes financieros.
6. No está cerrada la estrategia de concurrencia/rematerialización: inline sincrónico, job, o recompute acotado por rango.
7. No está definido todavía qué endpoint expone “saldo calculado vs saldo reconciliado vs diferencia”.
8. `AccountDailyBalance.currencyCode` duplica dato de `Account.currencyCode`; backend debe tratarlo como copia controlada, no como libertad semántica.

### Risks

- Diseñar reconciliación como transacción falsa y contaminar todo el dominio financiero.
- Dejar snapshots y `currentBalanceCached` desincronizados.
- Implementar filtros multi-tenant incorrectos por ausencia de `workspaceId` en snapshots/reconciliaciones.
- Postergar esta decisión y después reescribir transacciones, transfers, budgets y dashboard.

### Ready for Proposal

Sí.

La base conceptual está clara: reconciliación es **corrección de estado**, no **cashflow**. El siguiente paso recomendado es `sdd-propose`, bajando esta exploración a un plan de cambio con límites de módulo, endpoints iniciales, reglas de materialización y estrategia de pruebas.

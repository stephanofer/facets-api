# Facets MVP - Estrategia Logica de Implementacion

> Documento de estrategia para engineering y product. Define el orden recomendado para implementar Facets MVP de forma producible, sin romper dependencias reales del dominio ni degradar la verdad semantica que despues consumiran UX, analytics y reportes.

**Proyecto**: Facets  
**Repositorio**: `facets-api`  
**Estado**: Estrategia recomendada para llevar el MVP a produccion  
**Idioma**: Espanol  
**Fecha**: 2026-03-19

---

## 1. Proposito del documento

Este documento explica **que** debemos implementar para llevar Facets a produccion, **en que orden**, **por que ese orden importa**, **que depende de que** y **como evitar retrabajo, deuda semantica y numeros mentirosos**.

No es una lista de features. Es una estrategia de ejecucion para que producto, backend, app y reporting construyan sobre la misma verdad financiera.

La tesis operativa es explicita:

- primero verdad semantica;
- despues flujos de captura y operacion;
- despues reportes y lectura de negocio;
- despues optional MVP y aceleradores;
- despues extensiones post-MVP.

Si invertimos ese orden, el producto puede parecer avanzar rapido, pero se rompe donde mas importa: balances, pagos de tarjeta, transferencias, prestamos, multicurrency y reportes.

---

## 2. Principios de implementacion

1. **La semantica manda sobre la pantalla**  
   La UX puede simplificar la interaccion, pero no puede redefinir el significado financiero del movimiento.

2. **Capturar una vez, derivar muchas**  
   Accounts tipadas + financial events tipados deben ser la fuente operacional. Balances, cashflow, deuda, comparativas y budgets salen de esa misma base.

3. **Movimiento interno no es gasto real**  
   Transfers, `cc_payment`, `loan_payment`, `debt_payment` y reconciliaciones no pueden contaminar gasto, income-vs-expense ni budgets.

4. **Obligaciones separadas de cash disponible**  
   `credit_card`, `debt` y `loan` no son variaciones cosmeticas de `cash_or_bank`.

5. **Multicurrency nace en foundations**  
   Moneda base por workspace, moneda original preservada y conversion explicita desde el inicio. Parchearlo al final obliga a reabrir contracts, reports y UX.

6. **Reports nacen sobre motor semantico estable**  
   Dashboard, detalle y comparativas deben reconciliar bajo las mismas reglas. Si cada vista inventa exclusiones, el producto miente.

7. **Optional MVP no puede crear una verdad paralela**  
   Tags, recurring, budgets, CSV import, reglas y offline minimo solo pueden montarse sobre el core; nunca redefinirlo.

8. **Produccion significa confianza, no solo deploy**  
   Llegar a produccion implica que los numeros cierren, los casos borde criticos esten cubiertos y los equipos tengan criterios comunes.

---

## 3. Estrategia general por fases

La estrategia recomendada es:

| Fase                           | Objetivo                                       | Resultado buscado                               |
| ------------------------------ | ---------------------------------------------- | ----------------------------------------------- |
| 1. Semantic Foundation         | Cerrar contratos, invariantes y exclusions     | Una verdad financiera unica y auditable         |
| 2. Workspace Activation        | Hacer usable el producto desde dia 1           | Workspace activado con defaults sanos           |
| 3. Core Ledger Flows           | Registrar hechos financieros reales e internos | Captura y operacion sin doble conteo            |
| 4. Liabilities + Multicurrency | Resolver obligaciones y FX fundacional         | Saldos y pagos correctos en mono y multi moneda |
| 5. Reporting Read Models       | Exponer valor de negocio sobre la misma base   | Reportes confiables, comparables y coherentes   |
| 6. Optional Lanes              | Extender sin contaminar el core                | Features accesorias reversibles y aisladas      |

El camino critico es lineal hasta cerrar reporting. Reci en ese momento conviene abrir lanes paralelos.

---

## 4. Dependencias reales entre dominios

Esta es la parte que NO se puede ignorar.

| Dominio                        | Depende de                                | Por que                                                    |
| ------------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| Workspace settings             | none                                      | Define base currency, locale, month start y defaults       |
| Accounts                       | workspace settings                        | El tipo y la moneda de cuenta condicionan semantica futura |
| Financial events               | accounts + workspace settings             | Cada evento necesita cuenta tipada, moneda y workspace     |
| Transfers                      | financial events + accounts               | Requieren origen, destino y reglas de exclusion            |
| Credit card flows              | transfers + typed accounts                | Compra y pago comparten semantica con pasivo               |
| Debt / loan flows              | transfers + typed accounts                | Pago de obligacion no puede modelarse como gasto comun     |
| Reconciliation                 | accounts + financial events               | Corrige estado, no historia ni analytics                   |
| Multicurrency                  | workspace settings + accounts + events    | Necesita moneda base, original y conversion explicita      |
| Categories / merchants         | events                                    | Clasifican gasto e ingreso real, no movimiento interno     |
| Reports                        | events + exclusions + FX + classification | Son vistas derivadas del mismo motor semantico             |
| Budgets / recurring / optional | reports + semantic engine estable         | Si entran antes, nacen con reglas incorrectas              |

### Dependencia critica

`accounts tipadas -> ledger/eventos semanticos -> transfers/cc payments/loan payments/reconciliation -> multicurrency consistente -> reports -> optional MVP`

Ese es el orden real del dominio. No el orden visual del backlog.

---

## 5. Por que accounts y ledger semantico van antes que transactions UX completas

Porque una UX de transacciones sin semantica cerrada produce CRUD rapido pero datos incorrectos.

Si implementamos primero una pantalla linda de `transactions` y despues intentamos injertar cuentas tipadas, transferencias o pasivos, pasan cuatro cosas malas:

- se redefine el significado de movimientos ya creados;
- aparecen migraciones conceptuales caras (`expense` que en realidad era `transfer` o `cc_payment`);
- los reportes empiezan a depender de excepciones y parches;
- el usuario pierde confianza porque los numeros cambian cuando "mejoramos" logica.

Por eso el MVP no debe pensar `transaction` como un CRUD aislado, sino como una familia de hechos financieros tipados sobre cuentas tipadas.

---

## 6. Por que transfers, cc payments, loan payments y reconciliation son fundacionales

Porque son los casos donde mas rapido explota la mentira semantica.

| Caso                   | Si se implementa mal                 | Impacto                                       |
| ---------------------- | ------------------------------------ | --------------------------------------------- |
| Transfer interna       | Se cuenta como gasto + ingreso       | Rompe cashflow y reportes                     |
| Pago de tarjeta        | Se duplica gasto                     | El usuario cree que gasto dos veces           |
| Pago de prestamo/deuda | Se mezcla con consumo diario         | Se distorsiona lectura operativa              |
| Reconciliacion         | Se registra como ingreso/gasto falso | Balances cierran pero analytics quedan sucios |

No son edge cases. Son pilares del trust model del producto.

---

## 7. Por que multicurrency no puede parchearse al final

Porque toca foundations, no solo presentacion.

Multicurrency afecta:

- `Workspace` (base currency);
- `Account` (currency propia);
- `FinancialEvent` (monto y currency original);
- transfers cross-currency (dos puntas explicitas);
- reporting (conversion a moneda base);
- UX (distinguir original vs convertido);
- testing (paridad numerica y trazabilidad).

Si se agrega tarde, hay que reabrir schemas, contratos, agregaciones, exclusiones, fixtures, reportes y copy de UI. Eso NO es un patch; es una cirugia del core.

La politica correcta para MVP es austera pero fundacional:

- una moneda base por workspace;
- monto original preservado siempre;
- conversion explicita con snapshot;
- sin FX gains/losses ni valuacion sofisticada.

---

## 8. Por que reports no deben empezar hasta que el motor semantico este estable

Porque reports no son decoracion. Son read models del core.

Si reporting arranca antes de fijar exclusiones y tipos semanticos, aparecen:

- dashboards que cuentan distinto que el detalle;
- category totals que incluyen transfers o pagos internos;
- comparativas de periodos con reglas inconsistentes;
- budgets que consumen movimientos que no deberian existir analiticamente.

El criterio sano es simple: primero cerrar **que significa cada evento** y despues exponer **que pregunta responde cada reporte**.

---

## 9. Orden recomendado de implementacion

1. **Semantic foundation**
2. **Workspace activation y master data**
3. **Core ledger flows**
4. **Liabilities y multicurrency**
5. **Reports y observabilidad**
6. **Optional MVP lanes**

### Lo que entra en cada fase

| Fase | Entra                                                                                               | No entra todavia                              |
| ---- | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1    | contratos de `Account`, `FinancialEvent`, exclusions, policy FX, ADRs                               | pantallas completas, budgets, offline         |
| 2    | onboarding, settings, seeds, creacion de cuentas                                                    | reportes avanzados, automatizaciones          |
| 3    | `expense/income`, transfers, `cc_purchase`, `cc_payment`, reconciliation, `one_time`                | debt/loan enriquecidos, BI extra              |
| 4    | `debt`, `loan`, repayment semantics, cross-currency transfers, FX snapshots                         | forecast, amortizacion sofisticada            |
| 5    | balances, obligations, income-vs-expense, category breakdown, previous-period comparison, telemetry | tags como driver analitico, budgets complejos |
| 6    | budgets simples, recurring, tags, CSV import, offline minimo, reglas deterministicas                | AI, docs, MCP, public API                     |

---

## 10. Batches o streams concretos

### Stream A - Core de verdad financiera [bloqueante]

**Batch 1 - Semantic Foundation**

- cerrar taxonomia de cuentas y eventos;
- fijar exclusion matrix para reports y budgets;
- cerrar meaning de balances y obligaciones;
- definir `FxRateSnapshot` y conversion explicita;
- decidir ADR de `loan_disbursement`.

**Salida esperada**: ningun equipo discute ya si algo es gasto, movimiento interno, correccion o cancelacion de obligacion.

**Batch 2 - Workspace Activation**

- onboarding usable;
- defaults editables;
- month start;
- base currency;
- seeds de categorias, subcategorias y merchants;
- reglas de alta de cuentas tipadas.

**Salida esperada**: un workspace nuevo puede arrancar sin configuracion toxica.

**Batch 3 - Core Ledger Flows**

- transacciones standard;
- transfer flow first-class;
- compras en tarjeta;
- pago de tarjeta como transferencia especializada;
- balances iniciales;
- reconciliacion auditable;
- soporte `one_time`.

**Salida esperada**: el producto ya captura vida financiera real sin duplicar gasto.

**Batch 4 - Liabilities + Multicurrency**

- cuentas `debt` y `loan`;
- pagos de obligaciones;
- vista separada de obligations;
- cross-currency transfers;
- reporting en moneda base con snapshot.

**Salida esperada**: el modelo soporta pasivos y multi moneda sin inventar semantica nueva.

**Batch 5 - Reports + Observability**

- balances por cuenta;
- available cash vs obligations;
- income vs expense;
- breakdown por categoria padre con drill-down;
- comparacion contra periodo anterior;
- eventos de telemetry semanticos.

**Salida esperada**: Facets entrega valor de negocio visible y verificable.

### Stream B - Lanes opcionales [despues del Batch 5]

| Lane                   | Orden sugerido             | Regla                                            |
| ---------------------- | -------------------------- | ------------------------------------------------ |
| Budgets simples        | primero entre opcionales   | Solo sobre gasto real clasificado                |
| Recurring              | despues de budgets o junto | Nunca redefine hechos historicos                 |
| Tags                   | paralelo                   | Dimension secundaria, no core                    |
| CSV import             | paralelo                   | Debe mapear al mismo motor semantico             |
| Reglas deterministicas | paralelo                   | Reversibles y auditables                         |
| Offline minimo         | ultimo o slice controlado  | Sin crear duplicados ni verdad local alternativa |

---

## 11. Que no debe arrancarse antes de tiempo

No deberia empezar antes de cerrar el core semantico:

- reports detallados o dashboards finales;
- budgets;
- recurring sofisticado;
- importadores masivos;
- automatizacion agresiva;
- offline-first amplio;
- AI, documentos, semantic search, chat, MCP o API publica.

La regla es brutal pero sana: **si una feature necesita decidir por su cuenta que es gasto real y que es movimiento interno, arranco demasiado temprano**.

---

## 12. Riesgos de implementacion y mitigaciones

| Riesgo                                       | Sintoma                                       | Mitigacion                                                     |
| -------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| CRUD-first en transactions                   | velocity inicial alta, semantica rota despues | congelar primero event types e invariantes                     |
| Accounts mal tipadas                         | tarjetas o loans tratadas como cash           | modelar balance meaning y actions permitidas desde foundations |
| Exclusion matrix no compartida               | dashboard y detalle no coinciden              | centralizar reglas de agregacion y parity tests                |
| Reconciliation como transaccion comun        | balances correctos, analytics falsos          | modelarla como ajuste explicito y excluido                     |
| Multicurrency superficial                    | montos convertidos ambiguos                   | preservar original, snapshot y labels claros                   |
| Optional MVP contaminando core               | budgets o CSV crean reglas propias            | exigir reuse obligatorio del semantic engine                   |
| Scope creep                                  | backlog enorme, producto no sale              | usar gates de fase y out-of-scope explicito                    |
| Testing demasiado funcional y poco semantico | UI pasa, dominio miente                       | agregar matrices de invariantes por fase                       |

---

## 13. Criterios de salida por fase

| Fase                           | Criterio de salida                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| 1. Semantic Foundation         | Existe vocabulario unico, event matrix, exclusion matrix y policy FX cerrada                 |
| 2. Workspace Activation        | Un usuario nuevo puede crear workspace, cuenta y defaults validos sin romper historia futura |
| 3. Core Ledger Flows           | Transfer, compra con tarjeta, pago de tarjeta y reconciliacion cierran sin doble conteo      |
| 4. Liabilities + Multicurrency | Debt/loan y cross-currency funcionan con balances y reporting coherentes                     |
| 5. Reports + Observability     | Dashboard, detalle y comparativas reconcilian bajo las mismas reglas                         |
| 6. Optional Lanes              | Cada feature opcional demuestra que reutiliza el core y puede apagarse sin romper semantica  |

Sin esos criterios, pasar de fase es optimismo, no estrategia.

---

## 14. Validacion y testing semantico por fase

### Fase 1 - contratos e invariantes

- tests de contrato para tipos de cuenta y tipos de evento;
- tablas de verdad para exclusions;
- fixtures canonicos por caso borde.

### Fase 2 - activacion

- tests de onboarding valido/parcial;
- tests de mutacion de settings sin reescritura historica;
- validacion de seeds curados por locale.

### Fase 3 - ledger core

- unit/integration tests para `expense_standard`, `transfer_internal`, `cc_purchase`, `cc_payment`, `reconciliation_adjustment`;
- e2e de flujo compra -> pago de tarjeta;
- e2e de reconciliacion sin impacto en gasto.

### Fase 4 - liabilities y FX

- tests de pago de `debt` y `loan` sin contaminar consumo;
- tests de transfer cross-currency con montos origen/destino;
- parity tests entre monto original y monto convertido.

### Fase 5 - reports

- cross-report parity tests;
- snapshots de read models con periodos equivalentes;
- tests de `one_time` incluido/excluido segun vista;
- telemetry checks de eventos clave.

### Fase 6 - opcionales

- tests de no regresion semantica;
- pruebas de reversibilidad;
- contract tests para CSV/offline/reglas.

### Matriz minima obligatoria

- transfer interna;
- compra con tarjeta;
- pago de tarjeta;
- pago de prestamo;
- reconciliacion;
- cambio de inicio de mes;
- gasto `one_time`;
- gasto en moneda extranjera;
- transferencia entre monedas.

---

## 15. Como esta estrategia nos lleva a produccion

Nos lleva a produccion porque construye primero el sistema que dice la verdad y despues el sistema que se ve bien.

El camino a produccion queda asi:

1. fijamos contratos y reglas semanticas para que no cambien a mitad de implementacion;
2. activamos workspaces usables con defaults correctos;
3. habilitamos los flujos que generan los datos fundacionales del producto;
4. cerramos liabilities y multicurrency antes de abrir lectura ejecutiva;
5. publicamos reportes que nacen sobre la misma verdad operacional;
6. agregamos opcionales solo cuando el core ya resiste uso real.

Eso reduce cuatro costos de produccion:

- menos migraciones conceptuales;
- menos retrabajo de reporting;
- menos divergencia entre backend y app;
- menos perdida de confianza por numeros cambiantes.

En otras palabras: esta estrategia no optimiza solo entrega. Optimiza **credibilidad**.

---

## 16. Reglas de oro para developers

1. **Nunca modeles una transferencia como gasto + ingreso.**
2. **Nunca modeles un pago de tarjeta como gasto nuevo.**
3. **Nunca mezcles obligaciones con cash disponible.**
4. **Nunca uses reconciliacion para arreglar analytics.** Reconciliacion corrige saldo, no significado.
5. **Nunca pierdas moneda original.** El convertido es derivado, no fuente.
6. **Nunca dejes que un reporte invente reglas propias.** Toda vista consume el mismo motor semantico.
7. **Nunca metas optional MVP redefiniendo entidades core.** Si no reusa el core, no esta listo.
8. **Nunca confundas avanzar pantallas con avanzar producto.** En Facets, la verdad financiera va primero.

---

## 17. Cierre ejecutivo

La implementacion correcta del MVP de Facets no empieza por `transactions` como CRUD bonito. Empieza por el **ledger semantico** que permite distinguir cash, obligaciones, movimientos internos, correcciones y conversion monetaria.

Sobre esa base recien tiene sentido construir flujos, reportes y opcionales. Ese orden evita retrabajo, preserva semantica y nos deja llegar a produccion con un producto que no solo funciona: **merece confianza**.

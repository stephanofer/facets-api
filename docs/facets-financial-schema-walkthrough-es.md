# Facets — walkthrough ultra simple del schema financiero MVP

## 1. Objetivo de este documento

Este archivo sirve para explicarle a otra persona del equipo **cómo quedó pensado el schema financiero del MVP de Facets**, de forma:

- simple;
- práctica;
- orientada a producto;
- y con alertas claras sobre qué cosas **NO resuelve Prisma solo** y deben ser manejadas en backend.

La idea es que quien implemente o revise el backend no se lleve sólo las tablas, sino también la **semántica correcta**.

---

## 2. Idea general del modelo

Facets es **cashflow-first**.

Eso significa que el núcleo del MVP no está pensado todavía para:

- inversiones complejas;
- patrimonio neto completo;
- valuaciones avanzadas;
- materialización analítica compleja estilo Sure.

Está pensado primero para responder bien preguntas como:

1. cuánto dinero disponible tengo;
2. si gasto menos de lo que gano;
3. cuánto gasté este período vs el anterior;
4. en qué categorías se va mi plata;
5. cómo se mueven pagos internos entre banco, tarjeta, deuda o préstamo.

---

## 3. Walkthrough por bloques

## BLOQUE A — contexto del workspace

### `Workspace`

Es el contenedor principal del usuario o grupo.

### Ejemplo simple

- `Workspace: Finanzas de Stephano`

### Qué cuelga de acá

- cuentas;
- categorías;
- merchants propios del workspace;
- tags;
- transacciones;
- transfers;
- budgets;
- reminders.

### Campo importante

- `financialDataUpdatedAt`

### Para qué sirve

Sirve para invalidar cache del dashboard y reportes sin depender de queries caras tipo `MAX(updated_at)` sobre tablas grandes.

---

### `WorkspaceSettings`

Guarda configuración compartida del workspace.

### Ejemplo simple

- `baseCurrencyCode = PEN`
- `contentLocale = es-PE`
- `dateFormat = DD/MM/YYYY`
- `financialTimezone = America/Lima`
- `monthStartDay = 26`

### Para qué sirve

Esto define cómo se leen:

- reportes;
- budgets;
- comparaciones de período;
- consolidación multicurrency.

---

### `WorkspaceUserPreference`

Guarda preferencias personales del usuario **dentro de ese workspace**.

### Ejemplo simple

Para Stephano en `Finanzas de Stephano`:

- `uiLocale = es-AR`
- `theme = DARK`
- `dateFormat = null`
- `dashboardPreferences = { ... }`

### Para qué sirve

Esto define cómo ESA persona usa ese workspace:

- idioma visual de la UI;
- tema;
- formato de fecha personalizado;
- layout del dashboard;
- preferencias de reportes y transacciones.

### Regla simple de resolución

- `baseCurrencyCode` SIEMPRE viene de `WorkspaceSettings`;
- `contentLocale` viene de `WorkspaceSettings`, salvo que `WorkspaceUserPreference.uiLocale` lo overridee para la UI;
- `dateFormat` usa `WorkspaceUserPreference.dateFormat` si existe; si no, cae al default de `WorkspaceSettings.dateFormat`;
- `theme` viene de `WorkspaceUserPreference`.

### Qué NO debe pasar

- que un usuario cambie la moneda base consolidada del workspace;
- mezclar settings compartidos con preferencias visuales personales;
- guardar preferencias globales que choquen entre workspaces.

---

## BLOQUE B — cuentas

### `Account`

Es la tabla más importante del dominio financiero.

### Qué representa

Un contenedor financiero donde vive:

- plata;
- deuda;
- préstamo;
- dinero prestado a terceros.

### Ejemplos simples

#### Cuenta 1

- nombre: `BCP sueldo`
- `type = BANK`
- `currencyCode = PEN`
- `currentBalanceCached = 2500`

#### Cuenta 2

- nombre: `Visa Interbank`
- `type = CREDIT_CARD`
- `currencyCode = PEN`
- `currentBalanceCached = 800`

#### Cuenta 3

- nombre: `Préstamo auto`
- `type = LOAN`
- `currencyCode = PEN`
- `currentBalanceCached = 15000`

### Importante

`Account.type` es la semántica principal de la cuenta.

No hay una tabla polimórfica estilo Sure con `accountable_type/accountable_id`.
En Facets, `Account` es la raíz y los detalles específicos cuelgan por 1:1.

### Punto extra importante

`Account.currentBalanceCached` resuelve el saldo actual rápido.
La historia diaria vive aparte en `AccountDailyBalance`.

---

### `LoanProfile`

Es el detalle extra de una cuenta préstamo.

### Ejemplo simple

Cuenta:

- `Préstamo auto`

LoanProfile:

- `lenderName = BBVA`
- `interestRate = 12.5`
- `estimatedInstallmentAmount = 850`
- `dueDayOfMonth = 10`

### Regla práctica

La lista general de cuentas no necesita leer `LoanProfile` siempre.
El detalle del préstamo sí.

---

### `CreditCardProfile`

Detalle extra de una tarjeta de crédito.

### Ejemplo simple

Cuenta:

- `Visa Interbank`

CreditCardProfile:

- `issuerName = Interbank`
- `last4 = 1234`
- `creditLimit = 5000`
- `closingDayOfMonth = 25`
- `dueDayOfMonth = 5`

### Para qué sirve

No define el gasto real. Sólo agrega metadata útil para UI y lectura de la cuenta.

---

### `DebtProfile`

Representa una deuda simple, no un préstamo estructurado.

### Ejemplo simple

Cuenta:

- `Deuda con Juan`

DebtProfile:

- `creditorName = Juan`
- `dueDate = 2026-04-15`

### Para qué sirve

Cubrir casos donde el usuario necesita registrar obligación pendiente, pero no tiene ni quiere modelar tasa, plazo o cuota formal.

---

### `LentMoneyProfile`

Representa plata que el usuario prestó y espera recuperar.

### Ejemplo simple

Cuenta:

- `Préstamo a Martín`

LentMoneyProfile:

- `borrowerName = Martín`
- `expectedRepaymentDate = 2026-05-01`
- `status = OPEN`

### Punto semántico importante

Cuando esa plata vuelve, **no es ingreso nuevo**. Es recupero de capital.

---

## BLOQUE C — corrección de saldo

### `AccountReconciliation`

Sirve para ajustar saldo de una cuenta sin crear una transacción falsa.

### Ejemplo simple

Cuenta banco:

- el sistema dice `1200`
- el banco real dice `1150`

Entonces se crea:

- `date = 2026-03-26`
- `targetBalance = 1150`
- `reason = saldo real del banco`

### Qué NO debe pasar

Esto no debe transformarse en:

- gasto;
- ingreso;
- categoría;
- evento de budget.

Es corrección de estado, no cashflow.
La API de conciliaciones vive en un módulo aparte de `accounts` justamente para no mezclar metadata de cuentas con matemática financiera.

---

### `AccountDailyBalance`

Sirve para guardar snapshots diarios de saldo por cuenta.

### Ejemplo simple

Para `BCP sueldo`:

- `2026-03-25`: abre en `1000`, entra `500`, sale `100`, cierra en `1400`
- `2026-03-26`: abre en `1400`, sale `300`, ajuste `-50`, cierra en `1050`

### Para qué sirve

- history charts por cuenta;
- series de saldo diario;
- lectura histórica rápida y predecible.

### Qué NO debe pasar

No debe reemplazar a `Transaction` ni convertirse en otra fuente primaria del cashflow.
Es una tabla derivada para lectura.

---

## BLOQUE D — clasificación

### `Category`

Taxonomía financiera del workspace.

### Ejemplo simple

Categoría padre:

- `Comida`

Subcategorías:

- `Supermercado`
- `Delivery`

### Para qué sirve

- reportes;
- budgets;
- breakdown de gasto;
- clasificación de transacciones.

### Regla importante

Máximo dos niveles:

- padre
- hija

Nada de árbol infinito.

---

### `SystemMerchant` + `WorkspaceMerchant`

Comercio o contraparte de una transacción.

### Ejemplo simple

Merchant del sistema:

- `Starbucks`
- `normalizedName = starbucks`
- `suggestedCategoryKey = food`

Merchant privado del workspace:

- `Bodega Don Pepe`

### Para qué sirve

- mejorar consistencia de nombres;
- autocompletar;
- facilitar sugerencia de categoría;
- mejorar reportes por merchant.

### Regla importante

Hay dos tablas porque tienen ownership distinto:

- `SystemMerchant` = catálogo global compartido;
- `WorkspaceMerchant` = merchant privado de un workspace.

Eso evita que una transacción de un workspace apunte por error a un merchant privado de otro.

### Regla importante 2

`SystemMerchant` no apunta por FK a una categoría del workspace.
Usa `suggestedCategoryKey` porque la categoría real depende del locale/seeds/config del workspace.

---

### `Tag`

Representa una etiqueta reutilizable dentro del workspace.

### Ejemplos simples

- `trabajo`
- `vacaciones`
- `reembolsable`

### Para qué sirve

Agregar una dimensión transversal sin romper la taxonomía principal.

---

### `TransactionTag`

Tabla puente entre transacción y tag.

### Ejemplo simple

Transacción:

- `Taxi al cliente`

Tags:

- `trabajo`
- `reembolsable`

Entonces:

- `transaction_tags` une esa transacción con esos dos tags.

### Por qué existe

Porque una transacción puede tener muchos tags y un tag puede vivir en muchas transacciones.

---

## BLOQUE E — movimientos

### `Transaction`

Es la tabla central del cashflow MVP.

### Qué guarda

- cuenta;
- fecha;
- monto;
- dirección;
- moneda original;
- descripción;
- kind semántico;
- categoría;
- `systemMerchant` o `workspaceMerchant`;
- notas.

### Importante

Una transacción puede tener:

- merchant global del sistema;
- merchant privado del workspace;
- o ningún merchant.

Pero NO ambos al mismo tiempo.

### Ejemplo simple 1 — sueldo

- `account = BCP sueldo`
- `amount = 3000`
- `direction = INFLOW`
- `currency = PEN`
- `kind = STANDARD`

### Ejemplo simple 2 — supermercado con tarjeta

- `account = Visa Interbank`
- `amount = 120`
- `direction = OUTFLOW`
- `currency = PEN`
- `kind = STANDARD`
- `category = Comida`

### Ejemplo simple 3 — mudanza excepcional

- `amount = 2000`
- `direction = OUTFLOW`
- `kind = ONE_TIME`

### Ejemplo simple 4 — gasto en USD

- `amount = 10`
- `currency = USD`
- `direction = OUTFLOW`
- `description = Netflix US`

### Regla importante

`Transaction.kind` debe quedar **persistido en la fila**.
No conviene derivarlo cada vez leyendo joins con `Transfer` o tipo de cuenta.

---

## BLOQUE F — transferencias internas

### `Transfer`

Une dos transacciones que representan el mismo movimiento interno.

### Qué guarda de verdad

- workspace;
- transacción origen;
- transacción destino;
- `fxRateUsed` si hubo cambio de moneda;
- notas.

### Importante

La semántica del movimiento vive en `Transaction.kind`, no en `Transfer`.

### Ejemplo simple 1 — pago de tarjeta

Transacción 1:

- sale `300 PEN` de `BCP sueldo`
- `kind = CC_PAYMENT`

Transacción 2:

- entra `300 PEN` a `Visa Interbank`
- `kind = CC_PAYMENT`

Transfer:

- une ambas transacciones

### Resultado esperado

El dashboard NO debe decir “gastaste 300 más”.

---

### Ejemplo simple 2 — mover plata entre monedas

Transacción origen:

- sale `380 PEN`
- `kind = FUNDS_MOVEMENT`

Transacción destino:

- entra `100 USD`
- `kind = FUNDS_MOVEMENT`

Transfer:

- `fxRateUsed = 3.80`

### Resultado esperado

No es gasto nuevo ni ingreso nuevo. Sólo movimiento entre cuentas.

---

## BLOQUE G — multicurrency

### `ExchangeRate`

Guarda tipos de cambio por fecha.

### Ejemplo simple

- `fromCurrencyCode = USD`
- `toCurrencyCode = PEN`
- `date = 2026-03-26`
- `rate = 3.80`

### Cómo se usa

#### Caso 1 — dashboard consolidado

Cuenta Wise:

- saldo real = `100 USD`

Tipo de cambio:

- `1 USD = 3.80 PEN`

Entonces en el dashboard consolidado:

- equivalente = `380 PEN`

#### Caso 2 — gasto histórico

Transacción:

- `10 USD`
- fecha `2026-03-26`

Rate del día:

- `3.80`

En reporte consolidado:

- `38 PEN`

### Regla importante

La moneda original nunca se pierde.
La conversión existe para comparar/consolidar, no para reemplazar el dato real.

---

## BLOQUE H — planificación

### `Budget`

Representa el presupuesto del período.

### Ejemplo simple

- período `2026-03-26` → `2026-04-25`
- moneda `PEN`

### Para qué sirve

Agrupar líneas presupuestarias del mismo ciclo operativo.

---

### `BudgetLine`

Cada línea es una categoría padre con monto planificado.

### Ejemplo simple

Budget del mes:

- `Comida = 400`
- `Transporte = 150`

### Regla importante

Debe apuntar a categoría padre, no a subcategoría.

---

## BLOQUE I — recordatorios recurrentes

### `RecurringReminder`

Es un recordatorio manual desacoplado de la transacción real.

### Ejemplo simple

- nombre: `Internet`
- día esperado: `15`
- monto variable: `80..110`

### Qué hace

El sistema recuerda que ese gasto suele ocurrir.
Después el usuario crea la transacción real por separado.

### Qué NO hace

No autogenera movimientos financieros.

---

## 4. Ejemplo completo de uso real

Workspace:

- `Finanzas de Stephano`
- moneda base = `PEN`

Cuentas:

- `BCP sueldo`
- `Visa Interbank`
- `Préstamo auto`

Categorías:

- `Comida`
- `Transporte`

Movimientos:

- sueldo `3000 PEN`
- supermercado `120 PEN` con tarjeta
- pago tarjeta `120 PEN` desde banco
- mudanza `2000 PEN` como `ONE_TIME`

### Qué tablas participan

- `Account` guarda las cuentas
- `Transaction` guarda movimientos
- `Transfer` evita doble conteo del pago de tarjeta
- `Category` clasifica
- `Budget` y `BudgetLine` comparan gasto vs plan
- `AccountReconciliation` corrige saldo si hace falta
- `ExchangeRate` convierte si hay monedas distintas

---

## 5. Cosas que Prisma NO resuelve solo y deben implementarse en backend

Esta sección es CRÍTICA.
Si el desarrollador sólo crea tablas y no implementa estas reglas, el dominio queda roto aunque el schema compile.

## 5.1 `classification` derivada de `type`

No está persistida como campo libre en el schema financiero.

### Regla de backend

- `BANK`, `CASH`, `LENT_MONEY` → `ASSET`
- `CREDIT_CARD`, `LOAN`, `DEBT` → `LIABILITY`

### Qué no debe pasar

- `type = LOAN` con clasificación tratada como activo

---

## 5.2 `currentBalanceCached` debe mantenerse sincronizado

Prisma no lo recalcula solo.

### El backend debe actualizarlo cuando cambia:

- una `Transaction`
- un `Transfer`
- una `AccountReconciliation`

### Qué no debe pasar

Que el dashboard lea `currentBalanceCached` viejo mientras las transacciones nuevas ya existen.

---

## 5.3 `Workspace.financialDataUpdatedAt` debe tocarse en cada write financiero

Si queremos invalidación barata de cache, el backend debe actualizar este timestamp cuando cambia algo financiero.

### Eventos típicos

- create/update/delete de `Account`
- create/update/delete de `Transaction`
- create/update/delete de `Transfer`
- create/update/delete de `AccountReconciliation`
- rematerialización de `AccountDailyBalance`
- cambios de `Budget`

---

## 5.4 `Transaction.kind` debe materializarse correctamente

No se debe deducir siempre en tiempo de lectura.

### Ejemplos

- transferencia interna → `FUNDS_MOVEMENT`
- pago de tarjeta → `CC_PAYMENT`
- pago de deuda → `DEBT_PAYMENT`
- pago de préstamo → `LOAN_PAYMENT`
- gasto excepcional → `ONE_TIME`

### Qué debe hacer backend

Cuando se crea o edita un `Transfer`, actualizar el `kind` correcto de las `Transaction` involucradas.

---

## 5.5 Regla analítica de budget/reportes

Esto NO debe quedar implícito.

### Quedó decidido

- `FUNDS_MOVEMENT` → fuera de budget
- `CC_PAYMENT` → fuera de budget
- `DEBT_PAYMENT` → fuera de budget operativo
- `LOAN_PAYMENT` → fuera de budget operativo
- `ONE_TIME` → fuera de promedios y budget operativo

### Consecuencia

Summary, budget y reportes deben usar la MISMA regla, no implementaciones distintas.

---

## 5.6 Múltiples reconciliaciones por día

El schema permite múltiples reconciliaciones por cuenta en la misma fecha.

### Regla de backend

La reconciliación efectiva para una cuenta y fecha dada es:

> la última creada de ese día

### Qué no debe pasar

Tomar una reconciliación vieja del mismo día por error.

---

## 5.7 `Account.currencyCode` no debería cambiar libremente con historial

El schema no lo prohíbe solo.

### Regla de backend

Si la cuenta ya tiene movimientos, cambiar la moneda debería:

- estar bloqueado;
- o pasar por un flujo explícito de migración.

### Qué no debe pasar

Cambiar una cuenta de `PEN` a `USD` y dejar transacciones históricas inconsistentes.

---

## 5.8 Multicurrency user-facing: no usar `fallback_rate = 1` silencioso

Esto es muy importante.

### Regla de backend

Si falta el tipo de cambio para una conversión usada en analytics del usuario:

- usar la tasa anterior más cercana dentro de una ventana acotada;
- o marcar el dato como no consolidable todavía.

### Qué no debe pasar

Mostrar silenciosamente `1 USD = 1 PEN` por ausencia de rate.

---

## 5.9 `Merchant.suggestedCategoryKey` debe resolverse contra categorías reales del workspace

El merchant global del sistema no apunta por FK a `Category`.

### Regla de backend

Cuando se quiera sugerir categoría:

1. leer `suggestedCategoryKey`
2. buscar categoría del workspace con ese `key`
3. aplicar sugerencia si existe

---

## 5.10 `BudgetLine` debe usarse sólo con categorías padre

El schema relacional no garantiza por sí solo que la categoría elegida sea una categoría raíz.

### Regla de backend

Antes de crear/update `BudgetLine`, verificar:

- que `category.parentId == null`

---

## 5.11 `Transfer` debe validar coherencia entre puntas

El schema no garantiza toda la semántica.

### El backend debería validar

- que ambas transacciones pertenezcan al mismo workspace
- que sean cuentas distintas
- que una sea salida y la otra entrada
- que las fechas sean coherentes
- que `fxRateUsed` exista si hay conversión cross-currency real

---

## 5.12 La home debe salir de una lectura agregada

El schema no obliga arquitectura de API.

### Regla de backend

No hacer que el front consulte 6 widgets separados pegándole a la base por separado si pueden salir de un agregado común.

---

## 5.13 `AccountDailyBalance` debe materializarse con reglas consistentes

Prisma no calcula snapshots solo.

### Regla de backend

Cuando cambia una transacción, transferencia o reconciliación de una cuenta, el backend debe recomputar los snapshots diarios afectados desde esa fecha hacia adelante, al menos hasta restablecer consistencia.

### Orden mental correcto

- `openingBalance`
- `+ inflowsAmount`
- `- outflowsAmount`
- `+ adjustmentsAmount`
- `= closingBalance`

### Qué no debe pasar

- recalcular charts desde cero en cada request;
- dejar `currentBalanceCached` y `AccountDailyBalance` contando historias distintas;
- mezclar reconciliaciones como si fueran gasto/ingreso real.
- usar conciliaciones para “inventar” transacciones que distorsionen analytics, budgets o cashflow.

---

## 6. Qué NO hace este schema todavía

Y está bien que no lo haga en MVP:

- no tiene `Entry`
- no tiene `Valuation` general
- no tiene `balances` materializados estilo Sure
- no tiene bank sync/imports todavía
- no tiene auto-match de transfers

---

## 7. Conclusión simple

El schema financiero de Facets quedó pensado para:

- ser simple de entender;
- ser fuerte relacionalmente en Prisma/Postgres;
- no copiar complejidad innecesaria de Sure;
- conservar la semántica correcta de cuentas, pagos internos, deuda, reconciliación y multicurrency.

Pero hay algo clave:

> el schema solo NO alcanza.

La implementación backend tiene que respetar las reglas semánticas documentadas arriba, porque ahí está la diferencia entre una app que guarda datos y una app que responde bien preguntas financieras.

---

## 8. La DB entendida desde flujos reales de la app

Esta sección NO mira la base “tabla por tabla”.
La mira como se usaría de verdad en Facets.

La idea es que leas los flujos completos y detectes si algo suena raro, innecesario o caro.

---

### 8.1 Flujo: registro de usuario y creación del primer workspace

#### Qué pasa en la app

1. el usuario se registra;
2. verifica email;
3. entra al onboarding;
4. crea su primer workspace.

#### Qué tablas participan

- `User`
- `OtpCode`
- `UserProfile`
- `Workspace`
- `WorkspaceMembership`
- `WorkspaceSettings`
- `WorkspaceUserPreference`
- `Subscription`

#### Qué se crea realmente

1. en `User`
   - email, password, estado
2. en `UserProfile`
   - datos básicos de perfil
3. en `Workspace`
   - nombre, tipo, estado
4. en `WorkspaceMembership`
   - el usuario entra como `ADMIN`
5. en `WorkspaceSettings`
   - moneda base, locale base, date format, timezone financiera
6. en `WorkspaceUserPreference`
   - tema, locale UI, prefs visuales de ese workspace
7. en `Subscription`
   - una fila desde día 0, normalmente apuntando al plan free

#### Qué lee después la app

Cuando el usuario entra al workspace, la app necesita traer como mínimo:

- `Workspace`
- `WorkspaceMembership`
- `WorkspaceSettings`
- `WorkspaceUserPreference`
- `Subscription`

#### Qué decisión toma la app con eso

- qué workspace está activo;
- qué permisos tiene el usuario;
- cómo se ve la UI;
- cuál es la moneda base del tenant;
- qué plan/features tiene disponibles.

---

### 8.2 Flujo: abrir la app y pintar el dashboard

#### Qué necesita mostrar Facets

- cuentas con saldo actual;
- ingreso vs gasto del período;
- budget actual;
- próximos recordatorios;
- acceso a charts históricos simples.

#### Qué tablas se leen

- `Workspace`
- `WorkspaceSettings`
- `WorkspaceUserPreference`
- `Account`
- `AccountDailyBalance`
- `Transaction`
- `Transfer`
- `Budget`
- `BudgetLine`
- `RecurringReminder`
- `ExchangeRate`

#### Cómo se usa cada una en la práctica

- `Account.currentBalanceCached` evita recalcular saldo en cada request;
- `AccountDailyBalance` alimenta charts/sparklines;
- `Transaction` alimenta cashflow y breakdowns;
- `Transfer` evita doble conteo analítico;
- `Budget` y `BudgetLine` comparan plan vs real;
- `ExchangeRate` sirve si hay consolidación multicurrency.

#### Qué no debería hacer la app

- pegarle 8 veces a la DB desde el front por cada widget;
- recalcular saldos desde cero;
- derivar transfer semantics leyendo joins raros todo el tiempo.

---

### 8.3 Flujo: crear una cuenta nueva

#### Caso simple

El usuario agrega una cuenta banco.

#### Qué se crea

- `Account`

Si la cuenta es especial, además:

- `CreditCardProfile`
  o
- `LoanProfile`
  o
- `DebtProfile`
  o
- `LentMoneyProfile`

#### Qué lee luego la app

- lista general: sólo `Account`
- detalle: `Account + Profile específico`

#### Qué decisión importante toma backend

- si `type = CREDIT_CARD`, puede crear `CreditCardProfile`
- si `type = LOAN`, puede crear `LoanProfile`

No debería mezclar perfiles incompatibles en una misma cuenta.

---

### 8.4 Flujo: registrar una transacción normal

#### Caso simple

El usuario carga “supermercado 120 PEN” en tarjeta.

#### Qué tablas participan

- `Transaction`
- opcional `Category`
- opcional `SystemMerchant` o `WorkspaceMerchant`
- opcional `TransactionTag`

#### Qué se guarda realmente

- cuenta
- fecha
- monto
- dirección
- moneda
- descripción
- `kind = STANDARD`
- categoría si existe
- merchant si existe

#### Qué hace backend además

- actualiza `Account.currentBalanceCached`
- toca `Workspace.financialDataUpdatedAt`
- rematerializa snapshots diarios afectados

---

### 8.5 Flujo: pago de tarjeta o transferencia interna

#### Caso simple

Se pagan 300 PEN desde banco a tarjeta.

#### Qué se crea

1. una `Transaction` de salida en la cuenta banco
2. una `Transaction` de entrada en la cuenta tarjeta
3. un `Transfer` que une ambas

#### Qué semántica usa la app

La semántica vive en `Transaction.kind`:

- `CC_PAYMENT`
  o
- `FUNDS_MOVEMENT`
  según corresponda

`Transfer` no clasifica; sólo une las dos puntas del movimiento interno.

#### Qué logra esto

- no duplicar gasto;
- no mostrar ingreso falso;
- mantener trazabilidad de ambas cuentas.

---

### 8.6 Flujo: merchant en uso real

#### Caso simple 1

El usuario escribe “Starbucks”.

La app puede sugerir un `SystemMerchant` existente.

#### Caso simple 2

El usuario escribe “Bodega Don Pepe”, que no existe globalmente.

La app crea un `WorkspaceMerchant` privado para ese workspace.

#### Qué ventaja tiene este modelo

- los merchants globales se reutilizan;
- los merchants privados no se mezclan entre workspaces;
- la transacción puede apuntar a uno u otro sin fuga multi-tenant.

---

### 8.7 Flujo: budgets

#### Caso simple

El usuario crea presupuesto del período actual.

#### Qué se crea

1. `Budget`
2. varias `BudgetLine`

#### Qué necesita leer luego la app

- el budget vigente del workspace;
- sus líneas;
- gasto real del período desde `Transaction`

#### Qué pregunta responde

- cuánto planeé gastar en comida;
- cuánto gasté realmente;
- cuánto me queda.

---

### 8.8 Flujo: reminders

#### Caso simple

El usuario quiere recordar “Internet entre 80 y 110 PEN el día 15”.

#### Qué se crea

- `RecurringReminder`

#### Qué NO crea

- NO crea `Transaction`
- NO afecta saldos

#### Para qué sirve de verdad

Sirve para anticipación y UI, no para contabilidad real.

---

### 8.9 Flujo: metering y billing en uso real

#### Caso simple

El workspace usa una feature consumible, por ejemplo OCR o AI messages.

#### Qué tablas participan

- `Subscription`
- `Plan`
- `FeatureDefinition`
- `PlanFeature`
- `UsageEvent`
- `UsageRecord`

#### Qué hace backend

1. mira qué plan tiene el workspace;
2. mira qué límite tiene esa feature;
3. revisa el `UsageRecord` del período;
4. si puede usarla:
   - registra `UsageEvent`
   - actualiza el rollup `UsageRecord`

#### Qué logra esto

- gating rápido;
- trazabilidad del consumo;
- no recalcular todo desde cero en cada request.

---

### 8.10 Flujo: import de transacciones

#### Caso simple

Plaid o CSV manda movimientos.

#### Qué guarda la transacción además del dato financiero

- `sourceProvider`
- `sourceExternalId`
- o `sourceDedupKey`

#### Para qué sirve en la práctica

Evitar duplicados cuando:

- un provider reintenta;
- un sync corre dos veces;
- el usuario reimporta el mismo archivo.

---

### 8.11 Flujo: settings y preferences en uso real

#### Qué decide `WorkspaceSettings`

- moneda base del workspace
- locale base del contenido
- date format default
- timezone financiera
- día de inicio de período

#### Qué decide `WorkspaceUserPreference`

- tema
- locale UI
- date format override
- layout y preferencias visuales

#### Ejemplo simple

Workspace `Casa`:

- `baseCurrency = ARS`
- `dateFormat = DD/MM/YYYY`

Stephano en ese workspace:

- `theme = DARK`
- `uiLocale = es-AR`

La verdad financiera sigue viniendo del workspace.
La experiencia visual viene de la preferencia personal dentro de ese workspace.

---

### 8.12 Qué leer cuando querés entender si algo está raro

Si querés detectar rarezas o ineficiencias, estas son buenas preguntas mientras leés el schema:

1. ¿esta tabla guarda verdad operativa o sólo lectura derivada?
2. ¿esto pertenece al workspace o al usuario?
3. ¿esto genera cashflow real o sólo metadata/UI?
4. ¿esta relación puede cruzar tenants por error?
5. ¿esta columna evita trabajo caro en lectura o duplica semántica al pedo?
6. ¿esto se crea sincrónicamente en el flujo real o por jobs/materialización?

Si una tabla no responde claramente una de esas preguntas, probablemente haya que revisarla.

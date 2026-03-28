# Sure — cómo el equipo resolvió simplicidad, promedios mensuales y escenarios financieros difíciles

> Este documento está basado en el código real del proyecto. Tomé tus ejemplos como marco conceptual, pero la explicación está aterrizada a **Sure**, no a una app hipotética. Donde el comportamiento del repo coincide con tu idea, lo explico. Donde el repo hace algo distinto, también te lo marco.

---

## 1. La idea más importante: no eliminaron la complejidad del dominio, la escondieron detrás de una UX simple

Si tuviera que resumir cómo el equipo logró esto, te lo digo así de directo:

**No simplificaron el problema financiero. Simplificaron la interfaz y centralizaron la complejidad en el modelo de dominio.**

Eso se ve clarísimo en el código:

- la UI intenta responder pocas preguntas importantes;
- pero por debajo hay modelos separados para:
  - `Entry`
  - `Transaction`
  - `Transfer`
  - `Valuation`
  - `BalanceSheet`
  - `IncomeStatement`
  - `Trend`
  - `Period`

O sea: la experiencia parece simple, pero el motor interno es bastante sofisticado.

Y eso está bien. Porque en finanzas, si hacés el backend “demasiado simple”, terminás mostrando números mentirosos.

---

## 2. Cómo funciona el cálculo del promedio mensual de gastos

Acá hay un detalle CLAVE: en Sure no existe un solo “promedio mensual”. Hay **dos niveles** de promedio, según para qué pantalla o feature lo necesiten.

---

## 3. Primer nivel: el promedio mensual “canónico” del motor financiero

Este es el promedio que usa la lógica central de analytics.

### Dónde vive

- `app/models/income_statement.rb`
- `app/models/income_statement/family_stats.rb`
- `app/models/income_statement/category_stats.rb`

### Cómo se calcula

`IncomeStatement#avg_expense` delega en una consulta SQL que hace esto:

1. toma todas las transacciones relevantes de la family;
2. las agrupa por período (`date_trunc('month', ae.date)` si el intervalo es mensual);
3. clasifica cada período como ingreso o gasto;
4. convierte monedas a la moneda base de la family;
5. calcula:
   - `AVG(total)` → promedio mensual
   - `PERCENTILE_CONT(0.5)` → mediana mensual

### Qué excluye

Y acá está la magia del diseño: **no promedia cualquier cosa**.

Excluye:

- transacciones pendientes (`pending`)
- entries marcados como `excluded`
- movimientos de tipos excluidos del budget:
  - `funds_movement`
  - `one_time`
  - `cc_payment`
- cuentas tax-advantaged en ciertos cálculos de cashflow/budget

### Qué significa esto funcionalmente

El promedio mensual no intenta responder:

> “¿Cuánto se movió en total?”

Sino:

> “¿Cuál es mi patrón normal de gasto real?”

### Ejemplo simple

Supongamos estos meses:

- Enero: 1.000
- Febrero: 1.200
- Marzo: 900
- Abril: 3.000, pero 2.000 fueron una mudanza marcada como `one_time`

Para el promedio mensual, el sistema conceptualmente toma:

- Enero: 1.000
- Febrero: 1.200
- Marzo: 900
- Abril: 1.000

Promedio = `(1000 + 1200 + 900 + 1000) / 4 = 1.025`

No 1.525. Y eso es EXACTAMENTE lo que querías entender.

---

## 4. Segundo nivel: el promedio mensual mostrado en la pantalla de tendencias

Además del promedio “canónico”, hay un promedio más UI-driven en el reporte de tendencias.

### Dónde vive

- `app/controllers/reports_controller.rb` → `build_trends_data`
- `app/views/reports/_trends_insights.html.erb`

### Cómo funciona

El controlador arma una fila por mes dentro del período seleccionado:

- income del mes
- expenses del mes
- net del mes

Después, la vista hace algo mucho más directo:

- suma ingresos de todos los meses visibles y divide por cantidad de meses;
- suma gastos de todos los meses visibles y divide por cantidad de meses;
- suma ahorro neto y divide por cantidad de meses.

### Ojo con esta diferencia

Ese promedio depende del **rango que el usuario eligió en la pantalla**.

O sea:

- si mirás 6 meses, promedia esos 6;
- si mirás 3 meses, promedia esos 3;
- si mirás un rango custom, promedia ese rango.

### Resumen corto

- **IncomeStatement avg/median** = promedio “oficial” del motor
- **Trends view avg** = promedio del período visible en ese reporte

Los dos tienen sentido, pero responden preguntas distintas.

---

## 5. Cómo compara el sistema con el mes pasado

Acá también hay dos mecanismos.

---

## 6. Comparación tipo “vs. período anterior” en reportes

### Dónde vive

- `app/controllers/reports_controller.rb`

### Cómo lo hace

Cuando armás reportes:

1. el sistema calcula el período actual;
2. construye un `previous_period` de igual duración;
3. obtiene income y expenses para ambos;
4. calcula porcentaje de cambio con `calculate_percentage_change`.

### Fórmula

La fórmula es la clásica:

`((actual - anterior) / anterior) * 100`

### Ejemplo simple

- gastos período actual: 900
- gastos período anterior: 1.000

Cambio = `(900 - 1000) / 1000 * 100 = -10%`

La UI lo muestra como mejora para gastos, porque gastar menos suele ser favorable.

### Qué se compara exactamente

No siempre es literalmente “mes calendario anterior”.

Es:

- el período actual elegido,
- contra un período anterior de **igual largo**.

Entonces:

- si elegiste mensual, suele ser mes actual vs mes anterior;
- si elegiste quarterly, compara contra el trimestre previo equivalente;
- si elegiste custom, compara contra el bloque inmediatamente anterior.

Eso hace que la comparación sea consistente.

---

## 7. Comparación tipo “vs. start of month / vs. last month / vs. yesterday” en gráficos

### Dónde vive

- `app/models/period.rb`
- `app/models/trend.rb`
- `app/views/shared/_trend_change.html.erb`

### Cómo funciona

El sistema tiene un objeto `Period` con etiquetas como:

- `vs. yesterday`
- `vs. start of week`
- `vs. start of month`
- `vs. last month`

Y un objeto `Trend` que compara:

- valor actual
- valor previo

y calcula:

- dirección (`up`, `down`, `flat`)
- delta
- porcentaje
- color correcto según si subir es bueno o malo.

### Ejemplo práctico

En net worth:

- subir = bueno

En una liability individual:

- bajar = bueno

Por eso existe `favorable_direction`.

Es un detalle técnico chico, pero muy fino. Hace que el mismo componente visual no mienta según el tipo de dato.

---

## 8. Soporte de “mes pasado” con meses personalizados

Esto está MUY bien resuelto.

### Dónde vive

- `app/models/family.rb`
- `app/models/period.rb`

### Qué hace

La family puede tener `month_start_day` distinto de 1.

Entonces “mes actual” y “mes pasado” no siempre significan:

- 1 al 31
- o 1 al 30

Pueden significar, por ejemplo:

- del 26 de un mes al 25 del siguiente.

### Ejemplo simple

Si la family cierra el mes el día 25:

- mes actual = 26 feb → 25 mar
- mes pasado = 26 ene → 25 feb

Eso evita un problema real: que el presupuesto del usuario no coincida con su forma real de organizarse.

---

## 9. Cómo el equipo resolvió la idea de “menos complejidad” a nivel funcional

Acá te digo algo importante:

**Sure no reduce el producto a 4 pantallas mágicas. Pero sí organiza la experiencia alrededor de pocas preguntas de alto valor.**

No es minimalismo tonto. Es **curación**.

---

## 10. Las 4 preguntas, aterrizadas al código real de Sure

### Pregunta 1: ¿Cuánto dinero tengo?

Sure la responde principalmente con:

- `balance_sheet`
- `net_worth_chart`

### Qué ve el usuario

- activos;
- pasivos;
- patrimonio neto;
- composición por grupos de cuentas;
- evolución en el tiempo.

### Cómo lo resuelven técnicamente

- `BalanceSheet` consolida assets y liabilities;
- `BalanceSheet#net_worth` hace assets - liabilities;
- `NetWorthSeriesBuilder` arma la serie histórica;
- `Balance::ChartSeriesBuilder` agrega balances por fecha y convierte monedas.

### Por qué esto simplifica

Porque en vez de mostrar 25 widgets distintos, muestran una pregunta clara:

> “¿Dónde estoy parado patrimonialmente?”

---

### Pregunta 2: ¿Gasto menos de lo que gano?

Sure la responde con:

- `cashflow_sankey`
- `summary_dashboard`
- ahorro neto
- savings rate en tendencias

### Qué ve el usuario

- ingresos totales;
- gastos totales;
- ahorro neto;
- flujo desde categorías de ingreso hacia categorías de gasto;
- si queda surplus.

### Cómo lo resuelven técnicamente

- `IncomeStatement` calcula income y expenses;
- `PagesController#build_cashflow_sankey_data` arma nodos y links;
- `ReportsController#build_summary_metrics` calcula `net_savings`.

### Por qué esto simplifica

Porque no te obliga a leer 15 ratios. Te responde una pregunta existencial de plata:

> “¿Estoy generando excedente o no?”

---

### Pregunta 3: ¿Cuánto gasté el mes pasado?

Sure la responde con:

- `Period.last_month_for`
- summary de reportes
- trends mensuales

### Cómo lo resuelven técnicamente

- el período es una abstracción compartida;
- reportes reutilizan el mismo motor de income/expense totals;
- el período anterior se construye automáticamente.

### Por qué esto simplifica

Porque la respuesta sale del mismo sistema que alimenta budget, tendencias y breakdown. No hay tres motores distintos peleándose entre sí.

---

### Pregunta 4: ¿En qué gasto mi plata?

Sure la responde con:

- `outflows_donut`
- `transactions_breakdown`

### Cómo lo resuelven técnicamente

- `PagesController#build_outflows_donut_data` usa categorías de gasto;
- muestra **categorías raíz**, no todo el árbol de subcategorías de entrada;
- cada categoría tiene peso porcentual;
- desde ahí podés drill-down a transacciones.

### Por qué esto simplifica

Porque evita el error clásico de mostrar 40 categorías en un dashboard principal.

Primero te dice:

- Vivienda
- Comida
- Transporte
- Salud

Y recién si querés profundizar, bajás a detalle.

Eso es una decisión de producto MUY deliberada.

---

## 11. Cómo logran simplicidad sin empobrecer el producto

Hay varias decisiones de diseño que van todas en la misma dirección.

### 1. Dashboard curado, no enciclopédico

En `PagesController#build_dashboard_sections` hay pocas secciones visibles y con reglas claras:

- cashflow sankey
- outflows donut
- investment summary
- net worth chart
- balance sheet

No muestran todo junto porque sí.

### 2. Secciones colapsables y reordenables

Tanto dashboard como reports permiten:

- colapsar;
- reordenar.

Eso baja carga cognitiva sin romper poder de usuario.

### 3. Se ocultan secciones sin datos

Ejemplos:

- si no hay outflows, no hay donut;
- si no hay inversiones, no se muestra investment summary.

Menos ruido, más señal.

### 4. El dashboard usa categorías padre

La dona de gastos no tira subcategorías de una. Eso es intencional.

### 5. El detalle existe, pero no invade la home

El usuario ve resumen arriba y detalle abajo, bajo demanda.

Eso es exactamente cómo se diseña un producto financiero usable.

---

## 12. La idea central detrás de esta simplicidad

Te la digo en una frase:

**La complejidad semántica vive en el backend; la complejidad visual NO.**

Ese es el truco.

Si hicieran simple también el dominio, romperían:

- transferencias;
- pagos de deuda;
- reconciliaciones;
- activos no cash;
- multimoneda.

Entonces hacen lo correcto:

- motor rico adentro;
- superficie clara afuera.

---

## 13. “A place for everything”: cómo resolvieron transferencias y pagos sin mentir en analytics

Este es uno de los mejores logros del diseño.

---

## 14. El problema real de las transferencias

Ejemplo clásico:

- cuenta corriente: sale 500
- tarjeta: entra 500 como reducción de deuda

Si lo tratás como dos transacciones normales:

- parece que gastaste 500 extra;
- parece que tuviste un ingreso falso;
- el presupuesto queda contaminado.

Eso está MAL.

---

## 15. La solución funcional que implementaron

Sure hace varias cosas:

1. detecta o permite crear un vínculo de transferencia entre dos movimientos;
2. cambia el tipo semántico de esas transacciones;
3. saca del budget lo que no debe impactar budget;
4. en UI deja de tratarlas como gasto/ingreso común;
5. no permite categorizar ciertos transfers porque no tendría sentido.

---

## 16. La solución técnica detrás de eso

### Pieza 1: `Transfer`

Hay un modelo `Transfer` que une:

- `inflow_transaction`
- `outflow_transaction`

No es un tag. No es un booleano suelto. Es una entidad real.

### Pieza 2: validaciones fuertes

`Transfer` valida que:

- las cuentas sean distintas;
- pertenezcan a la misma family;
- los signos sean opuestos;
- la fecha esté dentro de una ventana razonable.

### Pieza 3: el tipo depende del destino

`Transfer.kind_for_account(account)` decide la semántica según la cuenta destino:

- destino préstamo → `loan_payment`
- destino tarjeta/liability → `cc_payment`
- destino investment/crypto → `investment_contribution`
- resto → `funds_movement`

Esto es MUY importante.

Porque el equipo no dijo:

> “todo movimiento entre cuentas es igual”

Dijo:

> “la intención del movimiento importa”

Y eso está perfecto.

---

## 17. Qué excluyen del budget y qué no

Acá hay una sutileza muy buena.

`Transaction::BUDGET_EXCLUDED_KINDS` contiene:

- `funds_movement`
- `one_time`
- `cc_payment`

### Ojo

**`loan_payment` e `investment_contribution` NO están excluidos.**

Eso significa que el equipo decidió:

- pago de tarjeta → no cuenta como gasto nuevo de budget;
- transferencia simple entre cuentas → no cuenta;
- gasto único → no cuenta en promedios/budget analytics;
- pero aporte a inversión o pago de préstamo puede seguir tratándose como salida real de cash para ciertas lecturas.

Eso no es un error. Es una decisión funcional.

Y está buena porque evita simplificaciones brutas.

---

## 18. Auto-match de transferencias

### Dónde vive

- `app/models/family/auto_transfer_matchable.rb`
- `app/models/transaction/transferable.rb`

### Cómo funciona

El sistema busca pares de movimientos que cumplan:

- uno negativo y uno positivo;
- cuentas distintas;
- misma family;
- cercanía temporal;
- monto opuesto exacto si es misma moneda;
- tolerancia con FX si cambia moneda;
- que no estén ya matcheados;
- que no hayan sido rechazados antes.

### Flujo funcional

1. llega transacción A;
2. llega transacción B;
3. Sure detecta posible match;
4. crea `Transfer` pendiente;
5. la UI marca “Auto-matched”;
6. el usuario confirma o rechaza.

### ¿Por qué es bueno?

Porque mezcla:

- automatización,
- control del usuario,
- prevención de rematches molestos.

---

## 19. Matcher manual de transferencias

Si el auto-match no alcanza, existe flujo manual.

### Dónde vive

- `app/controllers/transfer_matches_controller.rb`
- `app/views/transfer_matches/new.html.erb`

### Qué permite

- matchear con una transacción existente;
- o crear la contraparte faltante en otra cuenta.

Eso es recontra útil cuando sólo una de las dos puntas existe en el sistema.

---

## 20. Por qué no te deja categorizar una transferencia normal

### Dónde vive

- `app/models/transfer.rb`
- `app/views/transactions/_transaction_category.html.erb`

`Transfer#categorizable?` devuelve verdadero sólo para `Loan`.

O sea:

- transferencia común → no categorizable;
- pago de tarjeta → no categorizable como gasto normal;
- pago de préstamo → sí puede admitir semántica particular.

### Traducción funcional

El sistema protege al usuario de meter basura analítica.

Buenísimo. Porque si dejás categorizar cualquier transferencia, destruís el modelo.

---

## 21. Ejemplo práctico completo de transferencia bien resuelta

### Caso

- Checking: 2.000
- Tarjeta: deuda 800
- hacés un pago de 500

### Qué pasa en Sure

1. sale `+500` de checking como outflow;
2. entra `-500` a la tarjeta como inflow/reducción de deuda;
3. se crea un `Transfer` entre ambas;
4. el outflow queda como `cc_payment`;
5. el inflow queda como `funds_movement`;
6. `cc_payment` se excluye del budget analytics;
7. la UI muestra badge de payment/transfer, no categoría común.

### Resultado

Tu presupuesto no dice que gastaste 500 extra.

Y eso es exactamente la clase de corrección semántica que diferencia un producto serio de uno mediocre.

---

## 22. El caso de aportes a inversión: parecido, pero no idéntico

Otro ejemplo:

- salen 1.000 de checking;
- entran al broker.

Sure también lo modela como transferencia.

Pero el outflow puede quedar como `investment_contribution`.

### ¿Qué implica?

Que el equipo distingue entre:

- “moví plata internamente sin impacto de budget”
- y “saqué plata de mi cashflow cotidiano para llevarla a inversión”

Es una decisión más matizada que el ejemplo típico de Maybe. Y honestamente, me parece más rica.

---

## 23. Cómo resolvieron el problema de gastos únicos (`one_time`)

Este también está muy bien pensado.

---

## 24. El problema funcional

Ejemplo:

- mudanza: 2.000

Si eso entra crudo al promedio mensual, parece que vivís gastando 2.000 más por mes. Y no es verdad.

---

## 25. La solución funcional

El usuario puede marcar una transacción como `one_time`.

### Dónde se ve

- `app/views/transactions/show.html.erb`
- `app/views/transactions/_transaction.html.erb`

En la UI:

- hay un toggle `one_time`;
- en el listado aparece un asterisco;
- el tooltip dice que está excluida de promedios.

Esto es excelente UX porque:

- el usuario entiende qué hizo;
- la excepción queda visible;
- no desaparece el dato, sólo cambia su tratamiento analítico.

---

## 26. La solución técnica

`Transaction` tiene un enum `kind` con:

- `standard`
- `funds_movement`
- `cc_payment`
- `loan_payment`
- `one_time`
- `investment_contribution`

Y `one_time` está dentro de `BUDGET_EXCLUDED_KINDS`.

Eso hace que quede fuera de:

- `IncomeStatement::Totals`
- `IncomeStatement::FamilyStats`
- `IncomeStatement::CategoryStats`
- `ReportsController` breakdowns que reutilizan esa lógica

### Traducción simple

La transacción sigue existiendo.

Pero deja de contaminar:

- el promedio mensual;
- el budget analytics;
- parte de los reportes de gasto corriente.

---

## 27. Flujo práctico de `one_time`

1. el usuario abre la transacción;
2. activa el toggle “one-time”;
3. el `kind` pasa de `standard` a `one_time`;
4. el listado la marca visualmente;
5. los cálculos futuros la excluyen.

### Por qué esto está bueno

Porque no inventan una categoría rara tipo:

- “ajuste”
- “miscellaneous weird expense”
- “ignore this manually in your head”

No. Le dan semántica propia.

---

## 28. Ejemplo completo de gasto único

Supongamos:

- gasto normal mensual: 1.000
- en mayo: mudanza 2.000

Sin `one_time`:

- promedio visible se dispara

Con `one_time`:

- el movimiento sigue registrado;
- el histórico contable existe;
- pero el promedio mensual y el budget operativo no quedan deformados.

Eso es diseño de producto bien hecho.

---

## 29. Cómo resolvieron reconciliaciones sin crear transacciones basura

Este punto es arquitectónicamente excelente.

---

## 30. El problema funcional

Ejemplo:

- vos sabés que la cuenta tiene 1.000;
- la app deriva 950;
- hay una diferencia de 50.

Muchas apps te fuerzan a crear algo como:

- “Ajuste +50”

Y después nadie sabe:

- si eso fue ingreso;
- si fue gasto;
- si se categoriza;
- si entra a reportes;
- si es una corrección contable.

Un desastre.

---

## 31. La decisión técnica correcta: separar `Transaction` de `Valuation`

### Dónde vive

- `app/models/entry.rb`
- `app/models/valuation.rb`

`Entry` puede ser:

- `Transaction`
- `Trade`
- `Valuation`

Esta es la base de todo.

### ¿Qué les permite?

Decir:

- una transacción no es lo mismo que una valuación;
- una corrección de balance no es lo mismo que un gasto o ingreso;
- un ancla de saldo no es lo mismo que un movimiento de dinero.

Y listo. Ahí ya ganaron media batalla.

---

## 32. Reconciliation manager: cómo opera realmente

### Dónde vive

- `app/models/account/reconciliation_manager.rb`

### Qué hace

Cuando se reconcilia un saldo:

1. busca el balance anterior del día;
2. prepara una entry con `Valuation.new(kind: "reconciliation")`;
3. le asigna:
   - fecha
   - monto
   - moneda
4. la guarda;
5. devuelve resultado antes/después.

### Lo importante

No crea una transacción “falsa”.

Crea una **valuación de reconciliación**.

Eso mantiene el modelo limpio.

---

## 33. Cómo impacta eso en balances sin romper cashflow

### Dónde vive

- `app/models/balance/forward_calculator.rb`
- `app/models/balance/reverse_calculator.rb`
- `app/models/balance/base_calculator.rb`

Los balances se calculan usando:

- anchors de apertura o current;
- flows de entries;
- valuations cuando corresponde;
- separación cash / non-cash.

### Traducción funcional

Podés corregir el saldo de una cuenta sin ensuciar:

- tu presupuesto;
- tus categorías;
- tu reporte de gastos.

Porque reconciliar saldo **no es** gastar ni ganar plata.

---

## 34. Estrategia especial para cuentas manuales

Esto es una joyita del código.

### Dónde vive

- `app/models/account/current_balance_manager.rb`

### Qué hace

Para cuentas manuales, el sistema no siempre mete una reconciliación nueva.

Tiene dos estrategias:

#### Estrategia A — ajustar opening balance con delta

Si es una cuenta cash manual y no tiene reconciliaciones previas:

- en vez de apilar reconciliaciones;
- ajusta el opening balance para llegar al saldo deseado.

#### Estrategia B — crear/update reconciliation

Si ya hay reconciliaciones o no es un cash account simple:

- crea o actualiza una `Valuation` de reconciliación.

### ¿Por qué esto está buenísimo?

Porque el sistema intenta respetar la intención del usuario.

Si el usuario piensa la cuenta como:

> “saldo inicial + transacciones”

no le mete ruido innecesario.

Pero si ya está manejando la cuenta por valores/reconciliaciones, sigue esa estrategia.

Eso es UX pensada desde la semántica, no sólo desde la base de datos.

---

## 35. Estrategia especial para cuentas linkeadas

Para cuentas conectadas a proveedores, el sistema usa `current_anchor`.

### Dónde vive

- `app/models/account/current_balance_manager.rb`
- `app/models/valuation.rb`

### Qué significa

El saldo actual de una cuenta linkeada se ancla con una valuación especial, sin obligar al usuario a “inventar” movimientos.

Eso mantiene simple la UX y robusto el sync.

---

## 36. Ejemplo práctico de reconciliación bien resuelta

### Caso

- caja de ahorro debería tener 1.000;
- Sure deriva 950.

### Solución mala

Crear transacción `+50 Ajuste`.

### Solución de Sure

1. el usuario reconcilia saldo a 1.000;
2. el sistema crea una `Valuation` de tipo `reconciliation`;
3. el cálculo de balance queda alineado;
4. el cashflow mensual no se ensucia;
5. no aparece una categoría absurda para ese +50.

Listo. Era por ahí.

---

## 37. Lo mismo aplicado a activos no cash

Este modelo no sirve sólo para cuentas bancarias.

También sirve para:

- propiedades;
- vehículos;
- otros activos;
- ciertos escenarios de inversión.

Porque muchas veces querés decir:

> “este activo ahora vale X”

sin crear una transacción falsa.

Ahí `Valuation` vuelve a ser la pieza correcta.

---

## 38. El patrón arquitectónico que une todo esto

Si juntás promedio mensual, transferencias, one-time y reconciliaciones, aparece un patrón clarísimo.

### Capa 1 — captura semántica correcta

Cada cosa importante tiene su tipo:

- gasto/ingreso → `Transaction`
- movimiento entre cuentas → `Transfer`
- gasto único → `Transaction.kind = one_time`
- corrección de saldo → `Valuation`

### Capa 2 — analytics centralizados

Los cálculos importantes viven en:

- `IncomeStatement`
- `BalanceSheet`
- `Trend`
- `Period`

No están duplicados desordenadamente por la UI.

### Capa 3 — UX curada

La UI muestra pocas preguntas y evita meter al usuario en el barro contable.

---

## 39. Por qué este enfoque funciona tan bien

Porque evita dos errores clásicos.

### Error 1: interfaz “simple” con modelo tonto

Eso rompe:

- transferencias;
- deuda;
- patrimonio;
- reconciliación.

### Error 2: modelo correcto con interfaz inusable

Eso te da:

- 14 gráficos;
- 35 tabs;
- 80 filtros;
- dashboard imposible de leer.

### Lo que hace Sure

Hace algo intermedio y mucho más inteligente:

- modelo serio;
- superficie simple;
- drill-down opcional;
- analytics consistentes.

---

## 40. Flujo completo: cómo viaja un dato desde el movimiento real hasta la respuesta simple

### Caso A — gasto normal

1. entra una transacción de supermercado;
2. se categoriza como comida;
3. `IncomeStatement` la cuenta como gasto;
4. aparece en donut, cashflow y reports;
5. suma a promedio mensual.

### Caso B — pago de tarjeta

1. sale dinero de checking;
2. entra a tarjeta como reducción de deuda;
3. se crea `Transfer`;
4. el outflow queda como `cc_payment`;
5. queda excluido del budget analytics;
6. no infla el gasto mensual.

### Caso C — gasto único

1. el usuario marca `one_time`;
2. la transacción sigue visible;
3. los promedios y budgets la excluyen;
4. el patrón mensual no queda deformado.

### Caso D — diferencia de saldo

1. el usuario reconcilia el balance;
2. se crea `Valuation(reconciliation)`;
3. los balances cambian;
4. el cashflow no se contamina.

---

## 41. Lo más valioso del diseño, en lenguaje de producto

El equipo parece haber entendido algo que muchos no entienden:

**la gente no quiere ver toda la contabilidad; quiere respuestas confiables.**

Entonces el producto hace esto:

- modela correctamente el caos financiero real;
- pero le muestra al usuario sólo lo que necesita para decidir.

Eso explica:

- el promedio mensual limpio;
- la comparación contra períodos anteriores;
- el tratamiento correcto de transferencias;
- la exclusión de gastos únicos;
- la reconciliación sin transacciones basura.

---

## 42. Conclusión final

Si me preguntás “¿cómo logró el equipo este resultado?”, mi respuesta es esta:

### A nivel funcional

Eligieron responder pocas preguntas de altísimo valor:

- cuánto tengo;
- si gasto menos de lo que gano;
- cuánto gasté el período pasado;
- en qué se va mi plata.

Y protegieron esas respuestas de falsos positivos:

- transferencias,
- gastos únicos,
- reconciliaciones.

### A nivel técnico

Lo lograron porque separaron semánticas que otras apps mezclan:

- `Transaction`
- `Transfer`
- `Valuation`
- `Period`
- `Trend`
- `IncomeStatement`
- `BalanceSheet`

### La enseñanza importante

La simplicidad buena no sale de borrar casos difíciles.

Sale de esto:

**modelar bien los casos difíciles y evitar que exploten en la cara del usuario.**

Y, viendo este repo, eso es bastante exactamente lo que hicieron.

---

## 43. Archivos clave revisados para esta explicación

- `app/models/income_statement.rb`
- `app/models/income_statement/totals.rb`
- `app/models/income_statement/family_stats.rb`
- `app/models/income_statement/category_stats.rb`
- `app/models/transaction.rb`
- `app/models/transfer.rb`
- `app/models/transfer/creator.rb`
- `app/models/transaction/transferable.rb`
- `app/models/family/auto_transfer_matchable.rb`
- `app/models/entry.rb`
- `app/models/valuation.rb`
- `app/models/account/reconciliation_manager.rb`
- `app/models/account/current_balance_manager.rb`
- `app/models/account/opening_balance_manager.rb`
- `app/models/period.rb`
- `app/models/trend.rb`
- `app/models/balance_sheet.rb`
- `app/models/balance_sheet/net_worth_series_builder.rb`
- `app/models/balance/chart_series_builder.rb`
- `app/controllers/pages_controller.rb`
- `app/controllers/reports_controller.rb`
- `app/controllers/transfer_matches_controller.rb`
- `app/views/reports/_summary_dashboard.html.erb`
- `app/views/reports/_trends_insights.html.erb`
- `app/views/pages/dashboard/_cashflow_sankey.html.erb`
- `app/views/pages/dashboard/_outflows_donut.html.erb`
- `app/views/pages/dashboard/_net_worth_chart.html.erb`
- `app/views/pages/dashboard/_balance_sheet.html.erb`
- `app/views/transactions/show.html.erb`
- `app/views/transactions/_transaction.html.erb`
- `app/views/transactions/_transaction_category.html.erb`

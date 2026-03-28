# Sure — análisis funcional profundo del producto

> Documento armado a partir de una revisión amplia del código, rutas, modelos, controladores, vistas, seeds, documentación y app mobile. La idea de este archivo es explicar el producto como sistema de negocio y de uso real, no sólo como código.

---

## 1. Resumen ejecutivo

Sure es una plataforma de finanzas personales y familiares que combina **seguimiento diario del dinero**, **control patrimonial**, **inversiones**, **sincronización con bancos/proveedores**, **automatización con reglas**, **presupuestos**, **reportes**, **importaciones/exportaciones** y una capa de **AI/asistente**.

La idea central del producto es esta:

- una persona o grupo crea un espacio compartido llamado **Family** o **Group**;
- dentro de ese espacio administra **cuentas**;
- cada cuenta recibe **movimientos** y/o **valuaciones**;
- con eso el sistema calcula:
  - ingresos y gastos,
  - balances por cuenta,
  - patrimonio neto,
  - evolución histórica,
  - presupuesto,
  - performance de inversiones.

En otras palabras: el producto no piensa sólo en “gastos del mes”. Piensa en la **vida financiera completa** del usuario.

Ejemplo simple:

- tenés una cuenta bancaria,
- una tarjeta,
- una hipoteca,
- una casa,
- una cuenta de inversión,
- y una wallet crypto.

Sure intenta unir todo eso en un solo modelo y responder preguntas como:

- cuánto tengo hoy;
- cuánto debo;
- cuánto gasté este mes;
- en qué categorías se me va la plata;
- cómo viene mi patrimonio;
- cuánto aporté a inversiones;
- qué movimientos son recurrentes;
- qué transacciones puedo automatizar o categorizar mejor.

---

## 2. Modelo mental del producto

La mejor forma de entender Sure es con este mapa mental:

1. **Family/Group** = el contenedor principal.
2. **Users** = personas que participan en ese contenedor.
3. **Accounts** = dónde vive el dinero, la deuda o el activo.
4. **Entries** = eventos contables base.
5. **Transactions / Trades / Valuations** = tipos concretos de eventos.
6. **Categories / Tags / Merchants / Rules** = capa de clasificación y automatización.
7. **Budgets / Reports** = capa de análisis.
8. **Providers / Imports / API / Mobile** = capa de entrada y sincronización.
9. **AI / Documents / Search** = capa de asistencia inteligente.

La lógica fuerte del producto está en mezclar dos mundos:

- **cashflow**: ingresos, gastos, pagos, transferencias;
- **net worth**: activos, pasivos, valuaciones, holdings, inversiones.

Eso es CLAVE. No es sólo una app de budgeting. Tampoco es sólo un tracker de inversiones. Es un sistema híbrido.

---

## 3. Unidad organizacional: Family o Group

El objeto principal del dominio es `Family`.

### ¿Qué representa?

Representa el espacio financiero compartido donde vive casi toda la información:

- usuarios;
- cuentas;
- transacciones;
- trades;
- holdings;
- budgets;
- reglas;
- categorías;
- tags;
- merchants;
- importaciones;
- exportaciones;
- uso de AI.

### ¿Por qué existe?

Porque el producto está pensado para:

- uso individual;
- pareja;
- familia;
- grupo pequeño;
- incluso una especie de “household finance workspace”.

### Naming configurable

El sistema deja cambiar el “moniker” de la unidad organizacional:

- **Family**
- **Group**

Eso revela una intención de producto: no atarse sólo al concepto de familia tradicional.

### Limitación importante

Por lo que muestra el código, **cada usuario pertenece a una sola family a la vez**. No parece haber membresía real a múltiples families simultáneamente.

Ejemplo práctico:

- Ana usa Sure con su pareja.
- La family contiene las cuentas compartidas, categorías, reglas y reportes.
- Si luego Ana recibe invitación a otro espacio, la lógica actual puede moverla de familia, no convivir en varias.

---

## 4. Usuarios, roles e invitaciones

### Roles

Hay varios roles:

- `guest`
- `member`
- `admin`
- `super_admin`

### ¿Qué resuelve esto?

Permite distinguir entre:

- quien sólo mira o participa parcialmente;
- quien administra la family;
- quien administra toda la instalación/plataforma.

### Invitaciones

Hay flujo de invitaciones para sumar gente al espacio.

### Uso real

Ejemplo:

- un matrimonio comparte gastos y patrimonio;
- uno crea la family;
- invita al otro;
- ambos ven cuentas, reportes y presupuestos.

### Super admin

El `super_admin` es un rol de operación/plataforma. Sirve para:

- administrar usuarios globalmente;
- gestionar configuración más sensible;
- operar features de hosting/SSO;
- usar impersonation bajo flujo aprobado.

---

## 5. Onboarding

Hay un flujo de onboarding con varias pantallas, incluyendo preferencias y objetivos.

### ¿Para qué existe?

Para que el producto pueda arrancar con contexto:

- moneda base;
- posibles preferencias;
- objetivos financieros;
- preparación de datos iniciales.

### Qué revela del producto

Que Sure no quiere ser sólo una planilla donde empezás a cargar cosas. Quiere guiar el setup inicial para que los cálculos posteriores tengan sentido.

---

## 6. Cuentas: el corazón operativo

Las cuentas son el centro de la experiencia.

### Tipos de cuenta soportados

El sistema soporta:

- `Depository`
- `Investment`
- `Crypto`
- `Property`
- `Vehicle`
- `OtherAsset`
- `CreditCard`
- `Loan`
- `OtherLiability`

### Qué significa esto en negocio

Sure modela tanto:

- cuentas de efectivo y banco,
- como inversiones,
- como activos físicos,
- como deudas.

Eso le permite calcular **patrimonio neto** real.

### Ejemplos prácticos

- **Depository**: caja de ahorro, checking, savings, HSA, money market.
- **Investment**: broker, IRA, 401k, TFSA, RRSP, etc.
- **Crypto**: exchange o wallet.
- **CreditCard**: deuda rotativa de tarjeta.
- **Loan**: hipoteca, préstamo estudiantil, auto loan.
- **Property**: casa, departamento, inversión inmobiliaria.
- **Vehicle**: auto con valuación.

### Cuentas manuales y linkeadas

El producto soporta dos formas de alta:

- **manual**: el usuario carga la cuenta y sus movimientos/balances;
- **linkeada a proveedor**: se sincroniza desde Plaid, SimpleFIN, etc.

### Estados de cuenta

Existen estados como:

- `active`
- `draft`
- `disabled`
- `pending_deletion`

### ¿Por qué es importante?

Porque permite flujos de configuración progresiva, revisión y limpieza sin borrar todo de golpe.

---

## 7. Activos, pasivos y clasificación automática

Las cuentas se clasifican automáticamente como:

- **asset**
- **liability**

### Regla general

- `Loan`, `CreditCard`, `OtherLiability` → liability
- el resto → asset

### ¿Qué gana el producto con esto?

Que no necesita que el usuario entienda contabilidad formal para calcular patrimonio. La app sabe qué suma y qué resta.

Ejemplo:

- Banco: +10.000
- Inversiones: +25.000
- Casa: +120.000
- Tarjeta: -2.000
- Hipoteca: -80.000

Patrimonio neto = 10.000 + 25.000 + 120.000 - 2.000 - 80.000 = 73.000

---

## 8. Balances, anchors y reconciliación

Sure tiene una capa fuerte para gestionar balances históricos.

### Conceptos importantes

- `opening_anchor`
- `current_anchor`
- `reconciliation`

### Qué hacen

- **Opening anchor**: fija el balance inicial.
- **Current anchor**: ayuda a reflejar balance actual cuando el dato viene del proveedor o del usuario.
- **Reconciliation**: ajusta diferencias entre el cálculo derivado y la realidad.

### ¿Por qué existe esta capa?

Porque en productos financieros reales casi nunca alcanza con “sumar transacciones”.

Problemas reales:

- faltan movimientos;
- un proveedor trae saldo pero no todo el historial;
- un activo físico no tiene transacciones diarias;
- un préstamo cambia por intereses o ajustes externos.

Entonces el producto necesita combinar:

- eventos,
- saldos de referencia,
- valuaciones.

### Ejemplo práctico

Tu cuenta bancaria debería tener 1.200 según movimientos, pero el banco dice 1.150.
Sure puede registrar una reconciliación para alinear el sistema con la realidad.

---

## 9. Entries: la base contable real

Aunque el usuario ve transacciones, debajo hay un modelo más general: `Entry`.

### Tipos de entryables

Un `Entry` puede representar:

- `Transaction`
- `Trade`
- `Valuation`

### ¿Qué implica esto?

Que el producto piensa todos los movimientos financieros como eventos sobre una cuenta y una fecha, no sólo como “gastos”.

Eso es una decisión de arquitectura muy buena porque unifica:

- cashflow,
- inversión,
- ajustes de valor.

---

## 10. Transacciones: ingresos, gastos y movimientos cotidianos

Las transacciones son la feature más cotidiana del producto.

### Datos clave de una transacción

Para crear una transacción hacen falta, en esencia:

- cuenta,
- fecha,
- monto,
- moneda,
- nombre.

Opcionalmente se agregan:

- categoría,
- merchant,
- tags,
- notas,
- kind,
- etiqueta de actividad de inversión.

### Convención de signos

Ojo con esto porque es importante:

- **income / inflow = monto negativo**
- **expense / outflow = monto positivo**

### ¿Por qué harían eso?

Porque para ciertas cuentas y balances internos resulta más consistente con el motor contable que están usando.

### Ejemplo práctico

- sueldo: `-3000`
- supermercado: `+120`
- suscripción Netflix: `+18`

Después el reporting interpreta correctamente qué es ingreso y qué es gasto.

---

## 11. Tipos de transacción

`Transaction.kind` soporta varios casos:

- `standard`
- `funds_movement`
- `cc_payment`
- `loan_payment`
- `one_time`
- `investment_contribution`

### ¿Para qué sirve distinguirlos?

Porque no todo movimiento debe impactar igual en presupuesto y reportes.

Ejemplos:

- una compra en supermercado = gasto real;
- una transferencia entre tus cuentas = no debería contarse como gasto nuevo;
- un pago a tarjeta = cancela una deuda, no es consumo nuevo del día;
- un aporte a inversión = puede ser movimiento patrimonial, no gasto de estilo de vida.

---

## 12. Transferencias y pagos entre cuentas

Sure tiene modelo de `Transfer` para unir dos transacciones espejo.

### Qué resuelve

Evita duplicar erróneamente el impacto de mover plata entre tus propias cuentas.

### Casos que reconoce

- transferencia normal entre cuentas;
- pago de tarjeta;
- pago de préstamo;
- aporte a inversión.

### Lógica contextual

El tipo de transferencia depende de la cuenta destino:

- si destino es préstamo → `loan_payment`
- si destino es tarjeta o liability → `cc_payment`
- si destino es investment/crypto → `investment_contribution`
- si no → `funds_movement`

### Auto-match de transferencias

El sistema intenta detectar pares automáticamente usando:

- mismo monto;
- misma moneda o tolerancia FX;
- cercanía temporal;
- exclusión de matches rechazados por el usuario.

### Ejemplo práctico

- sale 500 USD de checking;
- entra 500 USD a brokerage;
- Sure intenta unirlos como una sola transferencia, no como “gasto + ingreso”.

---

## 13. Tarjetas y liabilities: comportamiento contable especial

Las cuentas de deuda tienen lógica distinta.

### Regla general

En liabilities:

- saldo positivo = deuda pendiente;
- un gasto en tarjeta aumenta deuda;
- un pago a tarjeta reduce deuda.

### ¿Por qué importa?

Porque si tratás una tarjeta como una cuenta bancaria normal, el patrimonio y los reportes salen mal.

Ejemplo:

- compra con tarjeta: la deuda sube 200;
- pago desde checking: la deuda baja 200;
- el gasto real ya fue la compra, no el pago.

---

## 14. Categorías y subcategorías

Sure tiene un sistema de categorías con jerarquía de dos niveles.

### Estructura

- categoría padre
- subcategoría

### Datos asociados

- clasificación (`income` o `expense`)
- color
- icono

### Categorías especiales

Hay categorías sintéticas como:

- `uncategorized`
- `other_investments`

### ¿Para qué existe esta jerarquía?

Para resolver dos necesidades al mismo tiempo:

- reporting de alto nivel;
- detalle fino para budget y análisis.

Ejemplo:

- Padre: Vivienda
- Hijas: Alquiler, Expensas, Reparaciones

Así podés ver “Vivienda” agregada o abrir el detalle.

---

## 15. Tags

Los tags son una capa flexible y many-to-many sobre transacciones.

### ¿Para qué sirven?

Para clasificaciones que no encajan bien en categorías rígidas.

Ejemplos:

- `vacaciones`
- `trabajo`
- `reembolsable`
- `hijos`
- `salud`

### Diferencia con categorías

- **Categoría**: clasifica el tipo principal del gasto/ingreso.
- **Tag**: agrega una dimensión transversal.

---

## 16. Merchants

Hay soporte de merchants con dos variantes:

- `FamilyMerchant`
- `ProviderMerchant`

### Qué problema resuelve

Los proveedores suelen traer nombres sucios o inconsistentes.

Ejemplo:

- “STARBUCKS #1821”
- “Starbucks Store 1821”
- “STARBUCKS 1821 SEATTLE”

El producto permite:

- desvincular merchants de proveedor;
- promover uno a merchant propio de la family;
- mergear merchants.

### ¿Por qué esto está bueno?

Porque mejora:

- categorización automática,
- consistencia histórica,
- reporting por comercio.

---

## 17. Reglas de automatización

Sure tiene un motor de reglas bastante potente.

### Qué pueden hacer las reglas

Aplicar acciones como:

- setear categoría;
- agregar tags;
- asignar merchant;
- renombrar;
- setear investment activity label;
- excluir del análisis;
- marcar como transferencia o payment;
- disparar auto-categorize o auto-detect merchant con AI.

### ¿Por qué existe esta feature?

Porque en finanzas personales el valor real aparece cuando el sistema aprende patrones repetidos.

Ejemplo práctico:

Si la descripción contiene “UBER”:

- categoría = Transporte
- tag = movilidad
- merchant = Uber

Y listo, nunca más lo hacés manualmente.

---

## 18. Transacciones recurrentes

El sistema detecta y administra recurrencias.

### Qué guarda

- si fue manual o auto-detectada;
- variación aceptable del monto;
- día esperado del mes;
- próxima fecha esperada.

### ¿Para qué sirve?

Para anticipar gastos/ingresos futuros y detectar patrones estables.

### Ejemplos

- sueldo mensual;
- alquiler;
- suscripciones;
- cuota del auto;
- factura de celular.

### Valor de producto

Esto ayuda a pasar de “mirar el pasado” a “proyectar lo que viene”.

---

## 19. Duplicados y pending vs posted

Sure tiene bastante lógica para manejar duplicados.

### Casos contemplados

- deduplicación al importar;
- pending que luego se convierte en posted;
- exclusión exacta automática;
- sugerencias fuzzy para posible match.

### ¿Por qué es clave?

Porque en banca real esto pasa TODO el tiempo.

Ejemplo:

- una compra aparece como pending por 19,50;
- luego se confirma como posted por 19,47;
- si no unís esos dos eventos, arruinás balances y reportes.

### Acciones user-facing

El usuario puede:

- mergear duplicados;
- descartar sugerencias.

---

## 20. Presupuestos

Los budgets son una pata central del producto.

### Qué soporta

- presupuestos mensuales;
- meses custom según `family.month_start_day`;
- presupuesto de gasto (`budgeted_spending`);
- ingreso esperado (`expected_income`);
- categorías de presupuesto sincronizadas automáticamente;
- copiar presupuesto anterior.

### ¿Qué problema resuelve?

Ayuda a planificar antes de gastar, no sólo mirar después.

### BudgetCategory

Cada categoría de presupuesto puede tener métricas como:

- gasto real;
- promedio mensual;
- mediana mensual;
- disponible para gastar;
- porcentaje consumido;
- over budget;
- near limit;
- gasto diario sugerido.

### Soporte de subcategorías

Una subcategoría puede:

- heredar presupuesto del padre;
- o tener presupuesto propio separado.

### Ejemplo práctico

Presupuesto “Comida” = 600

- Supermercado = 450
- Delivery = 100
- Cafés = 50

Sure puede mostrarte que:

- gastaste 500;
- te quedan 100;
- si seguís así, tu gasto diario sugerido es X.

---

## 21. Qué movimientos se excluyen del budget

No todos los movimientos entran al presupuesto.

Hay tipos excluidos como:

- `funds_movement`
- `one_time`
- `cc_payment`

### ¿Por qué?

Porque si contás transferencias internas o pagos de deuda como gasto cotidiano, el presupuesto queda inflado artificialmente.

Esto muestra una decisión de producto madura: separar **consumo real** de **movimientos internos**.

---

## 22. Reportes

La capa de reportes combina cashflow, patrimonio e inversión.

### Reportes detectados

- resumen general;
- net worth;
- trends;
- investment performance;
- investment flows;
- breakdown de transacciones.

### Qué busca resolver

Convertir datos operativos en decisiones.

### Preguntas que responde

- ¿cómo evolucionó mi patrimonio?
- ¿qué categorías explican más gasto?
- ¿cuánto aporté a inversión este período?
- ¿cómo vienen mis activos vs pasivos?

### Export y consumo externo

Hay export a CSV, layouts imprimibles e incluso orientación para Google Sheets.

---

## 23. Income statement

El producto tiene una capa de `IncomeStatement` para cálculos de ingresos y gastos.

### Qué excluye

- pending;
- transaction kinds excluidos del budget;
- labels internas de inversión como transfer/sweep;
- ciertas cuentas con tratamiento especial.

### ¿Por qué es importante?

Porque no todo lo que se mueve cambia tu “resultado operativo” del mes.

Ejemplo:

- mover 1000 de checking a brokerage no te hizo más pobre;
- comprar un ETF tampoco es igual a gastar en supermercado.

---

## 24. Patrimonio neto (net worth)

El net worth es una feature de primer nivel, no un agregado secundario.

### Cómo se calcula conceptualmente

- suma de activos
- menos suma de pasivos

### Qué incluye

- cash y bancos;
- inversiones;
- crypto;
- propiedades;
- vehículos;
- otros activos;
- tarjetas;
- préstamos;
- otras liabilities.

### Valor de producto

Esto permite que el usuario vea si está mejorando financieramente aunque su gasto mensual fluctúe.

Ejemplo:

Podés tener un mes con mucho gasto, pero si aumentó el valor de tu portfolio y bajó la deuda, tu patrimonio neto puede igual haber mejorado.

---

## 25. Valuaciones

Las `Valuation` sirven para representar cambios de valor que no son simplemente transacciones.

### Casos típicos

- una propiedad sube de valor;
- un vehículo se revalúa;
- una reconciliación corrige saldo;
- un anchor fija un balance.

### ¿Por qué esta feature es necesaria?

Porque muchos activos no “mueven dinero” todos los días, pero sí cambian de valor.

---

## 26. Inversiones: holdings, trades y securities

Sure tiene un subdominio de inversiones bastante sólido.

### Holdings

`Holding` representa snapshots diarios por:

- cuenta,
- security,
- fecha,
- moneda.

### Trades

`Trade` representa operaciones de compra/venta.

### Securities

`Security` modela instrumentos con datos como:

- ticker;
- exchange/MIC;
- logo;
- website;
- metadata de precio.

### ¿Qué intenta lograr el producto?

Separar claramente:

- el movimiento operativo (trade),
- del estado consolidado (holding),
- y del activo financiero en sí (security).

Eso está MUY bien pensado.

---

## 27. Cost basis

Los holdings soportan cost basis con distintas fuentes.

### Prioridad detectada

- manual
- calculated
- provider

### ¿Qué significa?

El usuario puede corregir o fijar un valor mejor que el del proveedor.

### Uso real

Si un broker trae mal el costo histórico de una posición, Sure permite priorizar el dato manual o calculado.

---

## 28. Ganancias realizadas y limitación actual

Existe cálculo de `realized_gain_loss` en trades.

### Pero ojo

No parece haber una capa avanzada de tax lots real tipo:

- FIFO completo;
- LIFO;
- specific lot identification sofisticada.

### Conclusión

La app tiene visión patrimonial y de performance, pero no parece enfocarse todavía en contabilidad fiscal avanzada de inversión.

---

## 29. Investment statement e investment flows

Hay reportes específicos para inversiones.

### InvestmentStatement

Busca calcular cosas como:

- valor de portfolio;
- cash balance;
- holdings value;
- top holdings;
- tendencia de ganancias no realizadas.

### InvestmentFlowStatement

Busca distinguir flujos como:

- contributions;
- withdrawals.

### ¿Qué problema de negocio resuelve?

Separar dos preguntas que la gente mezcla mucho:

- ¿cuánto vale mi portfolio?
- ¿cuánta plata metí o saqué?

No es lo mismo performance que aporte neto.

---

## 30. Crypto

Crypto aparece como tipo de cuenta de primera clase.

### Qué soporta

- cuentas/wallets o exchanges;
- holdings;
- integración con providers crypto;
- tax treatment;
- trades manuales cuando la cuenta es tipo exchange.

### ¿Por qué importa?

Porque para el producto crypto no es una rareza: es parte del patrimonio del usuario.

---

## 31. Propiedades y vehículos

Sure también administra activos no financieros clásicos.

### Property

Tiene wizard específico con pasos como:

- detalles;
- balance;
- dirección.

### Vehicle

Guarda cosas como:

- make;
- model;
- year;
- mileage.

### Valor de producto

Esto expande Sure desde “money tracker” a “personal balance sheet platform”.

Ejemplo:

- tu casa vale 180.000;
- tu auto vale 12.000;
- aunque no generen transacciones diarias, sí importan para tu patrimonio.

---

## 32. Préstamos

`Loan` tiene datos como:

- tasa;
- plazo;
- initial_balance;
- cálculo de monthly_payment.

### ¿Para qué sirve?

Para modelar deudas de largo plazo con algo más de semántica que una liability genérica.

Ejemplos:

- mortgage;
- student loan;
- auto loan.

---

## 33. Multimoneda

La app tiene soporte fuerte de multimoneda.

### Dónde aparece

- family con moneda base;
- cuentas en monedas distintas;
- entries y transactions con moneda propia;
- holdings y trades con moneda propia;
- exchange rates para conversiones y series.

### ¿Por qué es una feature importante?

Porque sin esto, una app financiera global queda rota para:

- expats;
- inversiones internacionales;
- cuentas en USD/EUR/ARS/GBP;
- portfolios multicurrency.

### Ejemplo práctico

- familia en EUR;
- cuenta bancaria en EUR;
- brokerage en USD;
- propiedad valuada en GBP.

Sure intenta consolidar todo en una moneda base para reporting y patrimonio.

### Observación de producto

Hay indicios de que algunos cálculos de investment reporting multimoneda podrían no estar completamente refinados. O sea: el soporte existe, pero probablemente hay áreas perfectibles.

---

## 34. Integraciones con proveedores

Sure tiene una capa bastante grande de sincronización externa.

### Providers identificados

- Plaid
- SimpleFIN
- Lunchflow
- Enable Banking
- Mercury
- Coinbase
- CoinStats
- SnapTrade
- Indexa Capital

### Qué aportan en general

- importar cuentas;
- traer balances;
- sincronizar transacciones;
- traer holdings;
- traer liabilities;
- mantener conexión viva;
- reautorizar cuando expira.

### Visión de producto

El sistema quiere reducir la carga manual y convertirse en un hub financiero centralizado.

---

## 35. Plaid

Plaid parece ser una integración importante.

### Soporta

- cuentas;
- transacciones;
- holdings;
- liabilities;
- metadata institucional;
- webhooks.

### Caso de uso

Un usuario en EE.UU. conecta su banco o broker y Sure trae gran parte del historial sin carga manual.

---

## 36. SimpleFIN

SimpleFIN soporta:

- cuentas;
- transacciones;
- holdings;
- pending;
- metadata FX.

### Configuración interesante

Hay toggles runtime para:

- incluir pending;
- debug raw payload.

### Qué revela

Que el producto está pensado para self-hosting y para operar providers con bastante control.

---

## 37. Lunchflow

Lunchflow también soporta:

- cuentas;
- transacciones;
- holdings;
- pending mediante `include_pending`.

### Valor

Amplía cobertura bancaria con lógica consistente con el resto de providers.

---

## 38. Enable Banking

Integración orientada a open banking europeo.

### Casos funcionales detectados

- selección de banco;
- autorización;
- reautorización;
- manejo de expiración de sesión.

### Significado de negocio

El producto no está pensado sólo para un mercado.

---

## 39. Mercury, Coinbase, CoinStats, SnapTrade, Indexa

### Mercury

Parece cubrir cuentas y transacciones para banca/business banking.

### Coinbase / CoinStats

Cubren la parte crypto y posiciones/wallets.

### SnapTrade / Indexa Capital

Apuntan a inversiones y brokers.

### Qué te dice esto del producto

Que Sure quiere ser una capa unificada sobre fuentes heterogéneas, no una app limitada a “banco tradicional”.

---

## 40. Pending transactions

El producto soporta pending transactions según provider.

### Providers con soporte detectado

- SimpleFIN
- Plaid
- Lunchflow

### UI

Hay badge “Pending” cuando corresponde.

### ¿Por qué esto es importante?

Porque mejora la imagen del presente financiero del usuario. Sin pending, el saldo operativo del día puede verse incompleto.

---

## 41. Importaciones

La plataforma tiene una capa de import muy fuerte.

### Tipos detectados

- `TransactionImport`
- `TradeImport`
- `AccountImport`
- `MintImport`
- `CategoryImport`
- `RuleImport`
- `PdfImport`

### Flujo general

- upload
- configuración
- limpieza
- confirmación
- publicación

### Capacidades importantes

- mapeo de columnas;
- formatos numéricos internacionales;
- filas a saltear;
- convención de signos;
- deduplicación;
- reutilización de configuración previa.

### ¿Qué problema resuelve?

Facilita migrar desde:

- CSVs;
- otras apps;
- exports viejos;
- bancos sin API directa.

---

## 42. PDF import con AI

`PdfImport` usa AI para entender documentos.

### Qué hace

- clasifica tipo de documento;
- genera resumen AI;
- si detecta un statement, intenta extraer transacciones y convertirlas en rows importables.

### Valor brutal de producto

Esto baja mucho la fricción de cargar datos cuando sólo tenés un PDF del banco o tarjeta.

Ejemplo:

- subís el resumen bancario en PDF;
- la AI interpreta el documento;
- genera una importación casi lista.

---

## 43. Documentos de la family y búsqueda vectorial

Sure no sólo guarda movimientos. También puede almacenar documentos de la family.

### Componentes detectados

- `FamilyDocument`
- `VectorStore`
- búsqueda semántica en archivos

### ¿Para qué sirve?

Para que el sistema pueda responder preguntas o ayudar con contexto documental.

Ejemplos:

- extractos;
- documentos financieros;
- archivos de soporte;
- statements históricos.

---

## 44. Exportaciones

Existe `FamilyExport` con serialización bastante amplia.

### Contenido detectado del export

- `accounts.csv`
- `transactions.csv`
- `trades.csv`
- `categories.csv`
- `rules.csv`
- `all.ndjson`

Además se serializan cosas como:

- budgets;
- budget categories;
- tags;
- merchants;
- valuations;
- rules.

### ¿Por qué existe?

Por portabilidad, backup, análisis externo y confianza del usuario.

Muy bien pensado, de hecho.

---

## 45. Asistente AI

El producto tiene una capa de assistant integrada.

### Modos detectados

- `builtin`
- `external`

### Qué significa

- **builtin**: la app resuelve internamente el flujo con function calling;
- **external**: delega la conversación a un agente remoto.

### ¿Por qué esto importa?

Porque deja al producto operar como:

- app con AI integrada out of the box;
- o como frontend/orquestador hacia un agente más personalizado.

---

## 46. Herramientas del assistant

Entre las tools detectadas están:

- `get_transactions`
- `get_accounts`
- `get_holdings`
- `get_balance_sheet`
- `get_income_statement`
- `import_bank_statement`
- `search_family_files`

### Qué revela esto

Que la AI no es sólo un chat decorativo. Tiene acceso a capacidades reales del producto.

### Ejemplos de uso

- “mostrame mis gastos en comida del último mes”
- “cuánto vale hoy mi portfolio”
- “buscá en mis documentos el statement del banco”
- “importá este PDF como extracto bancario”

---

## 47. Auto-categorización y auto-detección de merchants con AI

Además del assistant, hay AI operativa de fondo.

### Casos detectados

- auto-categorize;
- auto-detect merchants.

### Cómo encaja con reglas

Las reglas pueden invocar estas acciones, combinando automatización determinística con heurística AI.

### Valor de negocio

Menos carga manual, mejor calidad de datos, mejor reporting.

---

## 48. Chat, mensajes y tool calls

Hay modelos de:

- `Chat`
- `Message`
- `ToolCall`

### ¿Qué implica?

Que existe una experiencia conversacional persistente, no sólo prompts sueltos.

### Probable experiencia de usuario

El usuario tiene conversaciones financieras dentro de la app y el sistema puede ejecutar herramientas para responder mejor.

---

## 49. MCP / extensibilidad externa

Existe un endpoint `/mcp` con JSON-RPC 2.0.

### ¿Por qué es importante?

Porque abre la puerta a integrar Sure con ecosistemas externos de tools/agents.

Eso lo vuelve más extensible y moderno que una app cerrada.

---

## 50. Medición de uso de LLM

Hay un modelo `LlmUsage`.

### Qué resuelve

- tracking de uso;
- tokens;
- costos;
- dashboards de consumo AI.

### ¿Por qué existe?

Porque en self-hosting o entornos con costos variables, la AI no puede ser una caja negra.

---

## 51. Seguridad y autenticación

Sure tiene una capa bastante seria de auth.

### Soportes detectados

- login local email/password;
- reset de password;
- confirmación de email;
- OIDC;
- Google;
- GitHub;
- SAML.

### MFA

Soporta:

- TOTP;
- backup codes.

### Qué revela

Que el producto puede apuntar tanto a usuarios finales como a despliegues más organizacionales.

---

## 52. SSO y hosting self-managed

La documentación y settings muestran una intención fuerte de self-hosting configurable.

### Se detecta soporte para

- habilitar o no login local;
- override para super admin;
- create/link de usuarios vía SSO;
- allowed domains;
- providers en YAML o base de datos;
- UI admin para SSO providers.

### Significado

No es sólo una app SaaS simple. También parece pensada para instalaciones propias o entornos administrados.

---

## 53. Impersonation

Hay una feature de impersonation con flujo explícito.

### Etapas detectadas

- create
- join
- leave
- approve
- reject
- complete

### ¿Para qué sirve?

Para soporte, debugging o asistencia administrativa con trazabilidad y cierto control.

Eso es una feature bien enterprise-ish.

---

## 54. API keys y API pública/privada

Hay soporte de API keys con scopes:

- `read`
- `read_write`

### Qué implica

Que el sistema puede ser consumido por:

- mobile;
- scripts;
- integraciones propias;
- herramientas externas.

### Dato importante

Hay seed de OAuth para “Sure Mobile”, pero el comentario indica que desarrolladores externos deberían usar API keys, no OAuth. Eso sugiere una separación clara entre cliente oficial e integradores externos.

---

## 55. Mobile app

El repo incluye una app mobile en Flutter, bastante más rica de lo que uno esperaría por una README mínima.

### Pantallas detectadas

- dashboard;
- chats;
- lista de transacciones;
- formulario de transacción;
- calendario;
- recientes;
- settings;
- more;
- intro.

### Qué significa

Que el producto no es “web con mobile accesorio”. Hay una intención real de experiencia móvil.

---

## 56. Mobile offline-first

La app mobile tiene rasgos claros de offline-first.

### Capacidades detectadas

- SQLite local;
- sync pendiente;
- auto-sync al volver online;
- delete offline / pending delete;
- limpiar datos locales.

### Valor de producto

Esto mejora muchísimo la experiencia real del usuario cuando:

- no tiene señal;
- está viajando;
- quiere rapidez local.

---

## 57. Configuración global y preferencias

La sección de settings es amplia.

### Áreas detectadas

- preferencias de perfil;
- hosting;
- providers;
- securities;
- API keys;
- AI prompts;
- usage AI;
- pagos;
- guías;
- security center;
- bank sync.

### Qué revela

Que el producto está pensado como plataforma configurable, no sólo como app monolítica cerrada.

---

## 58. Seeds y datos iniciales

Los seeds y bootstrap de categorías muestran que el sistema intenta arrancar con estructura útil:

- categorías default;
- aplicaciones OAuth necesarias para mobile;
- setup base del entorno.

### ¿Por qué importa?

Porque un producto financiero vacío es medio hostil. Tener defaults mejora muchísimo el arranque.

---

## 59. Flujos end-to-end más importantes

### Flujo A — usuario nuevo que empieza manualmente

1. se registra;
2. crea su family/group;
3. define preferencias básicas;
4. crea cuentas manuales;
5. carga transacciones o balances iniciales;
6. categoriza;
7. arma presupuesto;
8. mira reportes y net worth.

### Flujo B — usuario que conecta bancos

1. entra a providers/bank sync;
2. conecta Plaid/SimpleFIN/etc.;
3. se crean cuentas linkeadas;
4. entran transacciones y balances;
5. Sure intenta detectar pending, transfers y merchants;
6. el usuario revisa, corrige y automatiza con reglas;
7. obtiene reportes más rápidos y consistentes.

### Flujo C — usuario inversor

1. conecta broker/exchange o importa holdings/trades;
2. se crean securities, holdings y trades;
3. el sistema calcula portfolio, flows y top holdings;
4. el usuario ve net worth consolidado con activos tradicionales y financieros.

### Flujo D — usuario con PDFs

1. sube statement PDF;
2. AI clasifica el documento;
3. extrae resumen y/o filas;
4. se genera importación;
5. se publica en transacciones.

### Flujo E — familia o pareja

1. un admin crea el espacio;
2. invita a otro usuario;
3. ambos comparten vista de cuentas, gastos, deudas e inversiones;
4. usan presupuesto y reportes comunes.

---

## 60. Cómo se relacionan las features entre sí

Esta parte es CLAVE para entender cómo pensaron el producto.

### Relación 1: cuentas ↔ entries ↔ balances

- la cuenta define el “contenedor”;
- los entries registran eventos;
- los balances consolidan el estado en el tiempo.

### Relación 2: transacciones ↔ categorías ↔ presupuesto ↔ reportes

- las transacciones alimentan categorías;
- las categorías alimentan presupuesto;
- el presupuesto y las transacciones alimentan reportes.

### Relación 3: transfers ↔ liabilities ↔ investment contributions

- una misma mecánica de transferencia resuelve movimientos internos, pagos de tarjeta, pagos de préstamo y aportes a inversión.

### Relación 4: holdings/trades ↔ securities ↔ net worth

- los trades actualizan o explican posiciones;
- los holdings representan estado consolidado;
- las securities aportan metadata y precios;
- todo eso entra en patrimonio neto.

### Relación 5: AI ↔ documents ↔ imports ↔ transactions

- la AI puede leer PDFs;
- generar importaciones;
- buscar en documentos;
- responder preguntas sobre datos financieros.

### Relación 6: providers ↔ data quality ↔ rules

- los providers aceleran carga de datos;
- las reglas corrigen, limpian y enriquecen esos datos;
- el resultado final mejora presupuesto, reportes y assistant.

---

## 61. Qué parece haber querido resolver el producto, de fondo

Viendo todo junto, la intención parece ser esta:

### 1. Unificar la vida financiera completa

No separar “gastos” de “patrimonio” ni de “inversiones”.

### 2. Bajar fricción de carga

Con providers, CSV, PDF import y mobile.

### 3. Mejorar calidad del dato

Con categorías, merchants, dedup, rules y AI.

### 4. Hacer el dato accionable

Con budgets, reportes, net worth y assistant.

### 5. Ser flexible en despliegue

Con self-hosting, settings, SSO, API keys, mobile y AI configurable.

Dicho simple: quisieron construir un **sistema financiero personal/familiar bastante completo**, no sólo una app para anotar gastos.

---

## 62. Limitaciones o ambigüedades detectadas

Esto no invalida el producto; al contrario, ayuda a entenderlo honestamente.

### 1. Multi-family membership

No parece haber soporte real para que un usuario pertenezca a varias families simultáneamente.

### 2. Inversión multimoneda

Hay señales de que algunos cálculos de reporting de inversión multimoneda podrían no estar totalmente pulidos.

### 3. Tax lots avanzados

No se ve una capa avanzada de cost basis fiscal estilo broker profesional.

### 4. Algunas integraciones parecen más maduras que otras

Plaid/SimpleFIN se sienten más centrales que ciertos providers más específicos.

### 5. Hay features amplias pero con profundidades distintas

Por ejemplo, propiedades/vehículos existen como parte del patrimonio, pero no necesariamente con la misma riqueza operativa que transacciones bancarias o inversiones.

---

## 63. Explicación corta de los conceptos de dominio más importantes

### Account

Un contenedor financiero o patrimonial.

### Entry

El evento base que impacta una cuenta en una fecha.

### Transaction

Un ingreso, gasto o movimiento cotidiano.

### Transfer

Un vínculo entre dos transacciones espejo para mover plata entre cuentas propias o pagar una liability.

### Valuation

Un ajuste o registro de valor para balances, reconciliaciones o activos no transaccionales.

### Budget

Plan de gasto e ingreso esperado para un período.

### Holding

Foto de una posición de inversión en una fecha.

### Trade

Compra o venta concreta de un activo financiero.

### Security

El instrumento financiero subyacente: acción, ETF, etc.

### Net worth

Activos menos pasivos.

### Merchant

Comercio o contraparte de una transacción.

### Rule

Automatización que transforma o clasifica transacciones.

---

## 64. Ejemplo integral simple para entender todo junto

Supongamos esta familia:

- cuenta bancaria: 5.000 USD
- tarjeta: deuda 800 USD
- broker: 12.000 USD
- casa: 150.000 USD
- hipoteca: 90.000 USD

### En el mes pasa esto

- entra sueldo: 3.000
- supermercado: 400
- alquiler no, porque viven en casa propia;
- pagan tarjeta: 500
- transfieren 1.000 al broker;
- el portfolio sube 300;
- la casa se revalúa 2.000.

### Cómo lo interpreta Sure

- el sueldo entra como income;
- supermercado como gasto categorizado;
- pago de tarjeta reduce liability, no duplica gasto;
- transferencia al broker es aporte a inversión, no gasto corriente;
- suba del portfolio impacta patrimonio;
- revaluación de la casa impacta patrimonio;
- presupuesto mira principalmente consumo/ingresos operativos;
- net worth mira todo junto.

### Resultado

El usuario obtiene a la vez:

- cashflow del mes,
- estado de presupuesto,
- patrimonio neto actualizado,
- evolución de inversiones,
- trazabilidad documental si subió statements,
- asistencia AI para consultar o automatizar.

Ese es el valor real del producto.

---

## 65. Conclusión final

Sure está pensado como una plataforma de finanzas personales/familiares **integral**.

No se limita a una sola categoría de producto:

- no es sólo budgeting,
- no es sólo net worth,
- no es sólo portfolio tracking,
- no es sólo bank sync,
- no es sólo AI finance chat.

Es la combinación de todo eso sobre un modelo común.

### La idea central del producto, en una sola frase

**Dar una visión unificada, automatizable y cada vez más inteligente de la vida financiera completa de una persona, pareja o grupo.**

### Lo más fuerte del diseño

- modelo unificado de cuentas/entries/balances;
- soporte de patrimonio real, no sólo gastos;
- buena base para automatización;
- import/export fuerte;
- integraciones variadas;
- AI conectada a tools reales;
- mobile y self-hosting presentes.

### Lo más importante para entenderlo bien

Si pensás Sure como “una app para registrar gastos”, te quedás corto.

La forma correcta de verlo es:

**un sistema operativo de finanzas personales y patrimoniales para individuos o households.**

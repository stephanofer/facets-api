# Facets MVP - Definicion de Producto

> Documento final de definicion de producto para el MVP de Facets. Este documento fija alcance, semantica, prioridades y criterios de producto para alinear producto, UX y engineering sobre una misma tesis: resolver cashflow real con numeros confiables, sin disfrazar complejidad critica ni inflar el MVP con dominios que todavia no corresponden.

**Proyecto**: Facets  
**Estado**: Definicion final de producto para MVP  
**Idioma**: Espanol  
**Fecha**: 2026-03-19

---

## 1. Vision del producto

Facets debe convertirse en el sistema financiero diario para personas, parejas y households livianos que necesitan entender su plata operativa con claridad: cuanto dinero tienen disponible, si estan gastando menos de lo que ganan, en que se va la plata y como se mueven sus obligaciones entre cuentas, tarjetas y prestamos.

La tesis del MVP es deliberada:

- **cashflow-first**: el foco principal es flujo de caja, no patrimonio neto;
- **reportes first-class**: el valor no esta solo en cargar datos, sino en responder preguntas utiles;
- **semantica correcta antes que CRUD rapido**: transferencias, pagos de tarjeta, pagos de prestamo y multicurrency no son detalles, son fundamentos;
- **simple en superficie, serio en el dominio**: la app debe sentirse clara, pero por debajo necesita modelar correctamente los casos dificiles para no mostrar numeros mentirosos.

---

## 2. Problema que resuelve

La mayoria de las personas no falla por no tener datos. Falla porque sus datos estan dispersos, mezclados o mal interpretados.

Problemas concretos que Facets resuelve:

- tienen varias cuentas, tarjetas, deudas o monedas y no saben cuanto dinero operativo tienen de verdad;
- confunden gasto real con movimiento interno;
- pagan la tarjeta y sienten que gastaron dos veces porque su app lo cuenta mal;
- no pueden comparar periodos de forma limpia porque gastos excepcionales deforman los promedios;
- no entienden donde se va la plata porque la clasificacion es pobre o inconsistente;
- registran cosas manualmente pero despues no obtienen reportes confiables;
- en mobile necesitan rapidez, captura simple y tolerancia a conectividad imperfecta.

El costo del estado actual no es abstracto. Se traduce en:

- decisiones financieras basadas en numeros falsos;
- perdida de confianza en la herramienta;
- abandono del producto a las pocas semanas;

---

## 3. Perfil de usuario y JTBD

## 3.1 Usuario primario

Personas, parejas y freelancers con complejidad financiera real pero no enterprise:

- 2 a 10 cuentas activas;
- 1 a 4 tarjetas de credito;
- una o mas deudas o prestamos;
- necesidad de operar en una o varias monedas;
- deseo de entender flujo mensual, no solo registrar gastos aislados.

## 3.2 Usuario secundario

- households que comparten decision financiera;
- usuarios mobile-first que cargan movimientos en el momento.

## 3.3 Jobs To Be Done

Cuando uso Facets, quiero:

1. saber cuanto dinero tengo disponible de forma confiable;
2. entender si estoy viviendo por debajo o por encima de mis ingresos;
3. distinguir gasto real de pagos internos entre cuentas, tarjetas o prestamos;
4. ver claramente en que categorias se va mi plata;
5. comparar mi periodo actual contra el anterior sin ruido innecesario;
6. poder capturar y corregir datos rapido desde mobile sin destruir la calidad analitica.

## 3.4 Anti-JTBD del MVP

El MVP NO busca resolver de entrada:

- analisis patrimonial completo;
- seguimiento avanzado de inversiones;
- chat financiero universal;
- plataforma abierta para terceros;

---

## 4. Principios rectores del MVP

1. **Cashflow**  
   El producto optimiza primero para dinero disponible, ingresos, gastos y obligaciones operativas.

2. **Reportes como producto, no como decorado**  
   El valor del MVP aparece cuando el usuario entiende su situacion, no solo cuando carga transacciones.

3. **Semantica correcta o nada**  
   Si una feature rompe analytics, no puede entrar como simplificacion temporal.

4. **Progresive disclosure**  
   Primero resumenes claros, despues drill-down. La home responde pocas preguntas. El detalle vive donde corresponde.

5. **Opinionated defaults**  
   El producto debe arrancar util desde el dia 1 con seeds, categorias y configuraciones iniciales curadas.

6. **Mobile real, no mobile accesorio**  
   Crear y corregir movimientos desde el telefono debe ser rapido y tolerante a conectividad imperfecta.

7. **Multicurrency fundacional, pero sobria**  
   La V1 soporta moneda base y conversion consistente para reporting, sin intentar resolver todos los problemas de FX del mundo.

8. **IA y extensibilidad dependen de una base sana**  
   Primero dato limpio y semantica fuerte. Despues AI, documentos, vector search, chat persistente, MCP y API abierta.

---

## 5. Arquitectura funcional del producto

Esta arquitectura es de producto y dominio, no de codigo.

## 5.1 Workspace financiero

Todo vive dentro de un espacio compartido de trabajo. En Facets esto representa la unidad financiera principal: individuo, pareja o household liviano.

El workspace define:

- moneda base;
- inicio de mes operativo;
- preferencias globales;
- catalogo de categorias, merchants y seeds;
- miembros con acceso compartido cuando corresponda.

## 5.2 Cuentas como contenedores operativos

Las cuentas representan donde vive el dinero o la obligacion. Para el MVP interesan sobre todo:

- efectivo y banco;
- tarjeta de credito;
- deuda generica;
- prestamo.

## 5.3 Eventos financieros con semantica explicita

El producto necesita distinguir, aunque la UI sea simple:

- transaccion normal;
- transferencia entre cuentas propias;
- pago de tarjeta;
- pago de prestamo;
- gasto one-time;
- ajuste de saldo o reconciliacion.

La idea central es simple: no todo lo que mueve plata significa lo mismo.

## 5.4 Capa analitica comun

Budgets, reportes, comparativas y dashboards deben consumir la misma verdad semantica. Si una pantalla trata un movimiento como gasto y otra como transferencia, el producto queda roto.

## 5.5 Capa de clasificacion

La lectura del usuario se organiza sobre:

- categorias;
- subcategorias;
- merchants;
- tags opcionales;
- reglas y sugerencias futuras.

## 5.6 Capa de inteligencia y extensibilidad

Documentos, busqueda semantica, AI assistant, chat persistente, tool calling, MCP y API keys existen en la vision del producto, pero solo tienen sentido cuando la base transaccional ya es confiable.

---

## 6. Onboarding inicial

## 6.1 Que es en Facets

El onboarding es el flujo que convierte una instalacion vacia en un workspace util y comprensible.

## 6.2 Por que existe

En finanzas, arrancar sin contexto genera errores tempranos: moneda mal definida, categorias pobres, cuentas cargadas a medias y reportes inutiles.

## 6.3 Como funcionara en el MVP

El onboarding debe pedir solo lo necesario:

1. nombre del workspace;
2. moneda base;
3. pais o locale para defaults;
4. inicio de mes operativo;
5. tipo de uso: individual, pareja o household liviano;
6. alta de primeras cuentas;
7. opcion de cargar balances iniciales;
8. opcion de activar seeds de categorias y merchants frecuentes.

## 6.4 Como debe realizarse logicamente

- no debe pedir veinte pantallas ni preguntas aspiracionales irrelevantes;
- tiene que optimizar activacion, no exhaustividad;
- debe dejar al usuario viendo valor rapido: al menos una cuenta, saldo inicial y estructura categorica lista;
- debe permitir saltear pasos y completarlos despues.

## 6.5 Ejemplos practicos

- usuario individual en ARS: elige ARS, inicio de mes dia 1, agrega banco y tarjeta, carga saldo inicial y ya puede registrar gastos;
- pareja en EUR: elige EUR, inicio de mes dia 26, crea cuenta conjunta, agrega dos tarjetas y obtiene reportes alineados a su ciclo real.

## 6.6 Que dejamos fuera

- onboarding por objetivos de vida sofisticados;
- simuladores de perfil financiero;
- conexion bancaria compleja de entrada;
- configuracion profunda de AI o integraciones.

---

## 7. Accounts

## 7.1 Que es en Facets

Una cuenta es el contenedor financiero donde vive dinero disponible o una obligacion a pagar.

## 7.2 Por que existe

Sin cuentas tipadas no se puede distinguir correctamente entre efectivo, pasivos y movimientos internos.

## 7.3 Como funcionara en el MVP

Tipos core:

- `cash_or_bank`;
- `credit_card`;
- `debt`;
- `loan`.

Cada cuenta tendra como minimo:

- nombre;
- tipo;
- moneda;
- estado;
- balance inicial opcional;
- balance actual visible;
- flags de cuenta manual u origen futuro si luego se integra sync.

## 7.4 Como debe realizarse logicamente

- el tipo de cuenta debe condicionar semantica y UI;
- tarjeta y prestamo no pueden tratarse como banco con otro nombre;
- la cuenta define como se interpreta el saldo y como impactan los pagos;
- el producto debe permitir archivar o desactivar cuentas sin borrar historia.

## 7.5 Ejemplos practicos

- cuenta "Santander sueldo" en ARS para ingresos y gastos del mes;
- cuenta "Visa Macro" como tarjeta de credito;
- cuenta "Prestamo auto" como loan;
- cuenta "Caja chica USD" como efectivo en moneda extranjera.

## 7.6 Que dejamos fuera

- investment, property, vehicle, crypto y otros activos no cash como tipos core del MVP;
- linking bancario robusto desde dia 1;
- cuentas con logica fiscal o patrimonial avanzada.

---

## 8. Balances

## 8.1 Que es en Facets

El balance representa el estado financiero actual o de referencia de una cuenta.

## 8.2 Por que existe

Sumar transacciones no siempre alcanza. Puede faltar historia, puede haber diferencias reales y el usuario necesita reconciliar contra la realidad.

## 8.3 Como funcionara en el MVP

Facets soportara:

- balance inicial;
- balance actual derivado de movimientos;
- accion de ajuste o reconciliacion;
- historial simple de cambios de saldo relevantes.

## 8.4 Como debe realizarse logicamente

- una reconciliacion no debe aparecer como gasto o ingreso comun;
- el producto debe tratar el ajuste de saldo como correccion de estado, no como transaccion falsa;
- los balances tienen que servir para confiabilidad, no para contaminar analytics;
- en cuentas manuales, la UX debe priorizar "ajustar saldo actual" por encima de terminologia contable compleja.

## 8.5 Ejemplos practicos

- una cuenta bancaria deberia tener 1200 pero el banco muestra 1150: el usuario reconcilia a 1150 y el cashflow no se ensucia;
- una tarjeta arranca con deuda previa de 800: se carga balance inicial y despues las compras y pagos operan sobre esa base.

## 8.6 Que dejamos fuera

- motor sofisticado de anchors expuesto al usuario;
- valuaciones patrimoniales avanzadas;
- reconciliaciones automagicas a partir de proveedores.

---

## 9. Transactions

## 9.1 Que es en Facets

La transaccion es el evento cotidiano que registra ingreso, gasto o movimiento operativo.

## 9.2 Por que existe

Es la unidad central de captura para responder flujo mensual, clasificacion y reportes.

## 9.3 Como funcionara en el MVP

Campos minimos:

- cuenta;
- fecha;
- monto;
- moneda;
- tipo de movimiento;
- categoria o sugerencia de categoria;
- merchant opcional;
- nota opcional;
- flag `one_time` cuando corresponda.

Se priorizara carga rapida desde mobile y web.

## 9.4 Como debe realizarse logicamente

- la transaccion comun no debe absorber semanticas que merecen entidad o tipo propio;
- el usuario debe sentir un flujo simple, pero el dominio debe distinguir `standard`, `funds_movement`, `cc_payment`, `loan_payment` y `one_time`;
- pending o borradores pueden existir en el futuro, pero no deben complicar la V1 innecesariamente.

## 9.5 Ejemplos practicos

- sueldo en cuenta bancaria;
- compra en supermercado con debito;
- gasto en farmacia con tarjeta;
- pago de seguro marcado como recurrente mas adelante;
- mudanza marcada como `one_time` para no deformar promedios.

## 9.6 Que dejamos fuera

- transacciones de inversion;
- ingestion compleja desde múltiples proveedores;
- deduplicacion avanzada en V1 base.

---

## 10. Transfers

## 10.1 Que es en Facets

Una transferencia es el movimiento entre dos cuentas propias que une dos puntas de una misma intencion financiera.

## 10.2 Por que existe

Porque si el sistema la trata como gasto mas ingreso, rompe balances, presupuesto y reportes.

## 10.3 Como funcionara en el MVP

Facets soportara transferencia first-class entre cuentas propias con estas variantes:

- transferencia comun;
- pago de tarjeta;
- pago de prestamo.

El usuario debe poder:

- crearla explicitamente como accion dedicada;
- elegir origen, destino, fecha, monto y moneda;
- ver el badge semantico correcto en ambas cuentas;
- evitar doble conteo en reportes.

## 10.4 Como debe realizarse logicamente

- transferencia es entidad o semantica dedicada, no checkbox cosmetico;
- ambas puntas deben quedar vinculadas;
- deben pertenecer al mismo workspace;
- el destino condiciona la interpretacion del movimiento;
- los reportes deben excluir o tratar correctamente lo que sea movimiento interno.

## 10.5 Ejemplos practicos

- mover 500 de banco a efectivo: no aumenta gasto ni ingreso;
- mover 1000 de ARS a cuenta USD: es movimiento interno con posible conversion visible;
- pagar 300 de la tarjeta desde banco: reduce deuda, no agrega gasto nuevo.

## 10.6 Que dejamos fuera

- auto-match sofisticado con tolerancias y sugerencias complejas en el core inicial;
- transferencias entre workspaces;
- trazabilidad multi-step compleja.

---

## 11. Credit cards

## 11.1 Que es en Facets

La tarjeta de credito es una cuenta de pasivo con semantica propia.

## 11.2 Por que existe

Es el caso mas comun donde las apps de finanzas mienten: compra y pago no pueden contarse como el mismo tipo de salida.

## 11.3 Como funcionara en el MVP

- las compras en tarjeta aumentan deuda pendiente;
- el pago de tarjeta reduce esa deuda;
- el gasto real ocurre en la compra, no en el pago;
- el producto mostrara saldo adeudado, movimientos y pagos asociados.

## 11.4 Como debe realizarse logicamente

- tarjeta no es banco;
- su saldo debe leerse como obligacion;
- el pago debe modelarse como transferencia semantica `cc_payment`;
- el dashboard debe ayudar a entender consumo y deuda sin duplicacion.

## 11.5 Ejemplos practicos

- compra de supermercado por 120 con tarjeta: impacta categoria comida y sube deuda;
- pago de 120 desde cuenta sueldo: baja deuda, no suma gasto del periodo;
- pago parcial de resumen: reduce parte de la obligacion sin alterar el gasto historico original.

## 11.6 Que dejamos fuera

- statement parser avanzado;
- cierre y vencimiento altamente sofisticados en V1;
- promociones, cuotas complejas y reward engines.

---

## 12. Debts

## 12.1 Que es en Facets

Debt representa una obligacion financiera que no necesariamente necesita toda la semantica de un prestamo estructurado.

## 12.2 Por que existe

Muchos usuarios tienen deudas informales o simples que igual afectan cashflow y dinero disponible.

## 12.3 Como funcionara en el MVP

- cuenta tipo `debt` con saldo pendiente;
- pagos manuales registrados correctamente;
- visibilidad de deuda actual y reduccion en el tiempo.

## 12.4 Como debe realizarse logicamente

- debt cubre obligaciones simples;
- si la deuda requiere calendario, tasa y cuota, debe migrar conceptualmente a `loan`;
- los pagos deben evitar contaminar gasto corriente si representan cancelacion de obligacion ya reconocida.

## 12.5 Ejemplos practicos

- deuda con familiar o amigo;
- saldo adeudado a proveedor;
- gasto grande financiado fuera de tarjeta.

## 12.6 Que dejamos fuera

- motor legal o contractual;
- intereses automaticos complejos;
- cobranzas y recordatorios automatizados avanzados.

---

## 13. Loans

## 13.1 Que es en Facets

Loan representa un prestamo estructurado que merece tratamiento distinto a una deuda generica.

## 13.2 Por que existe

Prestamos de auto, estudio o personales afectan cashflow futuro y necesitan semantica especifica.

## 13.3 Como funcionara en el MVP

- cuenta tipo `loan`;
- balance inicial o saldo pendiente;
- pago registrado como `loan_payment`;
- campos simples opcionales para cuota estimada, tasa o fecha de vencimiento si aportan valor.

## 13.4 Como debe realizarse logicamente

- loan tiene que permitir leer claramente obligacion restante y pagos aplicados;
- los pagos deben diferenciarse de gasto corriente cotidiano;
- si se decide categorizar parte de un pago, eso debe ser una evolucion futura bien pensada, no improvisada.

## 13.5 Ejemplos practicos

- prestamo automotor con cuota mensual;
- prestamo personal que se cancela mes a mes;
- deuda estudiantil simple registrada con saldo inicial.

## 13.6 Que dejamos fuera

- tabla de amortizacion completa;
- desglose automatico capital/interes sofisticado;
- refinanciaciones y simuladores.

---

## 14. Categories

## 14.1 Que es en Facets

Las categorias agrupan el significado principal de ingresos y gastos.

## 14.2 Por que existe

Sin una taxonomia curada no hay reportes utiles, budgets consistentes ni automatizacion futura.

## 14.3 Como funcionara en el MVP

- categorias raiz separadas por `income` y `expense`;
- icono, color y nombre;
- editables por el usuario;
- seeds iniciales por locale.

## 14.4 Como debe realizarse logicamente

- la categoria raiz es la unidad principal de lectura en dashboard y reportes de alto nivel;
- debe evitarse una taxonomia hiperfragmentada desde el dia 1;
- las categorias default deben ser opinionadas, no una lista infinita.

## 14.5 Ejemplos practicos

- Ingresos: sueldo, freelance, otros ingresos;
- Gastos: vivienda, comida, transporte, salud, entretenimiento, servicios, deuda.

## 14.6 Que dejamos fuera

- taxonomias regionales exhaustivas;
- catalogos multi-industria complejos;
- recomendaciones AI tempranas como unica forma de clasificar.

---

## 15. Subcategories

## 15.1 Que es en Facets

Las subcategorias refinan una categoria raiz sin reemplazarla.

## 15.2 Por que existe

Permiten detalle util sin romper la simplicidad del dashboard principal.

## 15.3 Como funcionara en el MVP

- jerarquia maxima de dos niveles;
- opcion de asignar transacciones a subcategoria;
- reportes con agregacion a padre y drill-down a hijas.

## 15.4 Como debe realizarse logicamente

- el producto debe leer primero categoria padre, despues detalle;
- budgets iniciales pueden operar al nivel padre, dejando nivel hijo como evolucion;
- subcategoria no debe convertirse en un arbol profundo.

## 15.5 Ejemplos practicos

- Comida -> supermercado, delivery, cafes;
- Vivienda -> alquiler, expensas, reparaciones;
- Transporte -> combustible, taxi, transporte publico.

## 15.6 Que dejamos fuera

- tres o mas niveles jerarquicos;
- reglas de herencia excesivamente complejas;
- vistas que muestren todo el arbol de entrada.

---

## 16. Tags

## 16.1 Que es en Facets

Los tags son una dimension transversal opcional para clasificar transacciones mas alla de su categoria principal.

## 16.2 Por que existe

Algunos cortes utiles no encajan en la estructura fija de categorias.

## 16.3 Como funcionara en el MVP

Tags quedan como **optional MVP**:

- alta simple de tags;
- asignacion manual;
- uso basico en filtros o vistas futuras.

## 16.4 Como debe realizarse logicamente

- categoria responde "que fue";
- tag responde "bajo que contexto lo miro";
- no debe reemplazar una taxonomia mal pensada.

## 16.5 Ejemplos practicos

- `trabajo`;
- `vacaciones`;
- `reembolsable`;
- `hijos`.

## 16.6 Que dejamos fuera

- dependencia fuerte de tags para reportes core;
- automatizacion avanzada basada en tags desde dia 1;
- complejidad de governance de tags compartidos.

---

## 17. Merchants

## 17.1 Que es en Facets

Merchant representa el comercio o contraparte asociado a una transaccion.

## 17.2 Por que existe

Los nombres libres son inconsistentes y eso degrada automatizacion, busqueda y analitica.

## 17.3 Como funcionara en el MVP

- merchant manual o sugerido;
- normalizacion simple;
- posibilidad de reusar merchants existentes;
- reportes y filtros basicos por merchant.

## 17.4 Como debe realizarse logicamente

- merchant debe mejorar la calidad del dato, no agregar friccion innecesaria;
- el sistema debe tolerar descripciones crudas pero tender a consolidarlas;
- la capa merchant prepara el camino para reglas futuras.

## 17.5 Ejemplos practicos

- varias descripciones de Starbucks se consolidan bajo un merchant comun;
- "Uber \*Trip" y "Uber Eats" pueden vivir como merchants separados o normalizados segun criterio futuro.

## 17.6 Que dejamos fuera

- merge complejo entre merchants de proveedor y merchants propios;
- catalogos externos grandes;

---

## 18. Detecciones y automatizaciones

## 18.1 Que es en Facets

Son mecanismos para reducir trabajo manual y mejorar calidad del dato con reglas o sugerencias.

## 18.2 Por que existe

En finanzas personales, el valor crece cuando el producto aprende patrones repetidos sin inventar cosas.

## 18.3 Como funcionara en el MVP

Como **optional MVP**:

- reglas deterministicas simples por texto, merchant o cuenta;
- sugerencias de categoria;
- posibles seeds de merchants frecuentes;
- deteccion manual-asistida de transferencias en iteraciones posteriores.

## 18.4 Como debe realizarse logicamente

- primero reglas confiables, despues heuristicas;
- toda automatizacion debe ser visible y reversible;
- no se puede sacrificar confianza por conveniencia.

## 18.5 Ejemplos practicos

- si descripcion contiene "Uber", sugerir categoria Transporte;
- si merchant es Netflix, sugerir Servicios Digitales;
- si todos los meses aparece una cuota similar, sugerir recurrencia.

## 18.6 Que dejamos fuera

- motor AI de autocategorizacion como base del MVP;
- auto-match muy agresivo sin aprobacion del usuario;
- orquestacion compleja de reglas encadenadas.

---

## 19. Recurring y one-time

## 19.1 Que es en Facets

Recurring identifica patrones repetidos; `one_time` identifica excepciones que no deben deformar la lectura operativa.

## 19.2 Por que existe

Sin esta distincion, el producto mezcla habitos reales con anomalías y los promedios se vuelven inutiles.

## 19.3 Como funcionara en el MVP

Core MVP:

- flag `one_time` manual y visible.

Optional MVP:

- recurrencias simples o sugeridas;
- calendario basico de proximos movimientos esperados si el costo lo permite.

## 19.4 Como debe realizarse logicamente

- `one_time` excluye de ciertos promedios y lecturas operativas, pero no borra historia;
- recurring debe servir para anticipacion, no para inflar complejidad del core;
- el usuario siempre debe entender por que algo fue tratado como excepcional o recurrente.

## 19.5 Ejemplos practicos

- mudanza por 2000 marcada como `one_time`;
- seguro mensual detectado luego como recurrente;
- sueldo mensual sugerido como ingreso recurrente.

## 19.6 Que dejamos fuera

- motor forecast complejo;
- cashflow proyectado largo plazo sofisticado;
- dependencias automaticas entre recurrencias y budgets complejos.

---

## 20. Budgets

## 20.1 Que es en Facets

Budget es la capa de planificacion que traduce observacion historica en control futuro.

## 20.2 Por que existe

Sin budget el producto responde solo "que paso". Con budget empieza a responder "como voy".

## 20.3 Como funcionara en el MVP

Como **optional MVP** con alcance sobrio:

- presupuesto mensual por categoria padre;
- lectura consumido vs disponible;
- respeto del inicio de mes configurado;
- exclusion de movimientos que no deben contaminar budget, como transferencias internas y pagos de tarjeta.

## 20.4 Como debe realizarse logicamente

- budget debe apoyarse en la misma semantica que reportes;
- no debe castigar al usuario con setup infinito;
- la primera iteracion debe ser clara antes que exhaustiva.

## 20.5 Ejemplos practicos

- Comida: presupuesto 400, gastado 280, disponible 120;
- Transporte: presupuesto 150, gastado 165, estado excedido;
- pago de tarjeta: no consume presupuesto como gasto nuevo.

## 20.6 Que dejamos fuera

- daily allowance sofisticado;
- presupuestos por subcategoria con herencia compleja;
- forecast probabilistico;
- envelopes avanzados.

---

## 21. Reports

## 21.1 Que es en Facets

Los reportes son la forma principal en que el usuario obtiene valor de negocio del producto.

## 21.2 Por que existe

Una app que solo registra movimientos pero no responde preguntas claras obliga al usuario a hacer el trabajo mental que el producto deberia resolver.

## 21.3 Como funcionara en el MVP

Los reportes core deben responder, como minimo, estas preguntas:

1. cuanto dinero disponible tengo por cuenta;
2. si gasto menos de lo que gano en el periodo;
3. cuanto gaste en el periodo pasado versus el actual;
4. en que categorias se va mi plata.

Reportes y vistas minimas:

- resumen de balances por cuenta;
- income vs expense del periodo;
- breakdown por categoria padre con drill-down;
- comparacion contra periodo anterior;
- tendencia basica mensual si el costo lo permite;
- filtros por cuenta, categoria y moneda base consolidada.

## 21.4 Como debe realizarse logicamente

- reportes no son un modulo accesorio: deben guiar la home y el producto;
- categorias padre primero, detalle despues;
- comparativas deben usar periodos equivalentes;
- movimientos internos no deben mentir en analitica;
- `one_time` debe poder quedar fuera de ciertas lecturas operativas;
- los mismos numeros deben cerrar entre dashboard, detalle y resumen.

## 21.5 Ejemplos practicos

- "Gastaste 920 este mes vs 1030 el mes pasado";
- "Tu categoria principal fue Comida con 31 por ciento del gasto";
- "Tus cuentas operativas muestran 1450 disponibles y tu tarjeta adeuda 380".

## 21.6 Que dejamos fuera

- net worth;
- performance de inversiones;
- reportes fiscales;
- BI configurable de alta complejidad;
- dashboards con demasiados widgets y ruido visual.

---

## 22. Multicurrency

## 22.1 Que es en Facets

Multicurrency permite operar cuentas y transacciones en distintas monedas, consolidando la lectura del workspace en una moneda base.

## 22.2 Por que existe

Sin multicurrency, una app financiera global queda rota muy rapido para expats, freelancers internacionales o usuarios con cuentas en USD/EUR/ARS y similares.

## 22.3 Como funcionara en el MVP

Como core fundacional pero austero:

- cada workspace tiene moneda base;
- cada cuenta tiene su moneda;
- cada transaccion conserva su moneda original;
- reportes muestran consolidacion en moneda base con conversion consistente;
- transferencias entre monedas deben ser posibles con visibilidad clara del monto origen y destino.

## 22.4 Como debe realizarse logicamente

- la moneda original nunca debe perderse;
- la conversion para reporting debe ser consistente y explicable;
- el producto debe dejar claro cuando una cifra esta convertida;
- la V1 no necesita resolver el mejor motor de FX del mercado, pero SI necesita evitar ambiguedad y doble interpretacion.

## 22.5 Ejemplos practicos

- cuenta bancaria en EUR y tarjeta en USD dentro de un workspace base EUR;
- gasto de viaje cargado en USD pero consolidado a ARS para el resumen;
- transferencia de ARS a caja USD mostrando ambos montos.

## 22.6 Que dejamos fuera

- FX trading;
- valorizacion sofisticada historica para patrimonio;
- performance avanzada de inversiones multicurrency;
- contabilidad internacional avanzada.

---

## 23. Settings globales y preferencias

## 23.1 Que es en Facets

Son las configuraciones que dan coherencia al workspace y a la experiencia diaria.

## 23.2 Por que existe

Sin defaults y preferencias globales, el producto se vuelve inconsistente entre cuentas, periodos y reportes.

## 23.3 Como funcionara en el MVP

Settings core:

- moneda base;
- inicio de mes operativo;
- locale o pais de seeds;
- preferencias basicas de visualizacion;
- administracion simple de categorias y cuentas.

## 23.4 Como debe realizarse logicamente

- settings deben servir al uso cotidiano, no convertirse en cementerio de opciones;
- las configuraciones globales tienen que impactar reportes y budgets de forma consistente;
- el usuario debe poder corregir defaults sin perder historia innecesariamente.

## 23.5 Ejemplos practicos

- cambiar inicio de mes del dia 1 al 26 para alinear sueldos y gastos recurrentes;
- definir USD como moneda base aunque haya cuentas en ARS y EUR;
- ajustar categorias default a un contexto local.

## 23.6 Que dejamos fuera

- settings enterprise;
- configuracion avanzada de proveedores;
- centros de AI, SSO o seguridad organizacional compleja.

---

## 24. Seeds y defaults iniciales

## 24.1 Que es en Facets

Son los datos iniciales y estructuras opinionadas que permiten que el producto arranque util.

## 24.2 Por que existe

Un producto financiero vacio genera friccion, errores y abandono.

## 24.3 Como funcionara en el MVP

Seeds iniciales:

- categorias y subcategorias por locale;
- merchants frecuentes opcionales;
- tipos de cuenta sugeridos;
- ejemplos o plantillas de setup rapido.

## 24.4 Como debe realizarse logicamente

- seeds deben ser curados y editables;
- no deben sentirse como taxonomia enciclopédica;
- tienen que optimizar tiempo hasta el primer insight util.

## 24.5 Ejemplos practicos

- un usuario nuevo ya ve Comida, Vivienda, Salud, Transporte y Servicios listos para usar;
- al crear una tarjeta, el producto sugiere comportamiento semantico y reportes compatibles.

## 24.6 Que dejamos fuera

- seeds gigantescos por industria;
- catálogos infinitos por pais;
- automatizaciones complejas preinstaladas.

---

## 25. Mobile offline-first

## 25.1 Que es en Facets

Es la capacidad de capturar y operar movimientos desde mobile con buena performance, aun cuando la conectividad sea pobre.

## 25.2 Por que existe

Muchos movimientos se cargan en el momento. Si la experiencia mobile es lenta o frágil, el habito se rompe.

## 25.3 Como funcionara en el MVP

Como **optional MVP** o iteracion inmediata posterior:

- captura rapida local de transacciones;
- cola simple de sincronizacion;
- feedback claro de estado pendiente/sincronizado;
- lectura reciente aun sin red cuando ya hay datos locales.

## 25.4 Como debe realizarse logicamente

- offline-first debe priorizar pocos casos, pero bien resueltos;
- crear una transaccion offline vale mas que intentar soporte universal desde dia 1;
- el usuario debe entender si algo ya se sincronizo o no.

## 25.5 Ejemplos practicos

- cargar un gasto en taxi sin señal y verlo sincronizado mas tarde;
- corregir una categoria en el subte y que el cambio suba despues.

## 25.6 Que dejamos fuera

- sync bidireccional compleja con conflictos avanzados;
- todo el producto offline completo;
- automatizaciones y reportes muy pesados sin conectividad.

---

## 26. Documentos y family docs

## 26.1 Que es en Facets

Es la capacidad de almacenar documentos financieros asociados al workspace.

## 26.2 Por que existe

Extractos, contratos, comprobantes y archivos de soporte agregan contexto y abren la puerta a busqueda, AI y auditoria ligera.

## 26.3 Como funcionara en el MVP

No entra en core. Queda como **post-MVP**.

## 26.4 Como debe realizarse logicamente

- los documentos deben ser del workspace, no de un movimiento aislado solamente;
- el sistema necesita permisos, metadata y relacion clara con cuentas o periodos;
- esta capa debe nacer pensando en recuperacion y contexto, no solo en upload de archivos.

## 26.5 Ejemplos practicos

- guardar resumen de tarjeta del mes;
- subir contrato de prestamo o comprobante relevante;
- conservar extractos para consultas futuras.

## 26.6 Que dejamos fuera

- OCR avanzado;
- pipelines AI de ingestion;
- experiencia documental central en el MVP.

---

## 27. Busqueda vectorial y semantica

## 27.1 Que es en Facets

Es la capacidad de buscar informacion por significado, no solo por texto exacto, sobre documentos y eventualmente datos financieros.

## 27.2 Por que existe

Puede transformar un repositorio de archivos en una base consultable y util para AI assistant.

## 27.3 Como funcionara en el MVP

No entra. Queda como **post-MVP**.

## 27.4 Como debe realizarse logicamente

- depende de documentos bien modelados;
- debe cuidar privacidad, costos y relevancia;
- no tiene sentido antes de tener casos reales de consulta documental.

## 27.5 Ejemplos practicos

- buscar "ultimo resumen de visa" aunque el nombre del archivo no coincida;
- encontrar documentos donde aparezca una cuenta o prestamo especifico.

## 27.6 Que dejamos fuera

- embeddings desde el inicio;
- chat RAG serio en el MVP;
- indexacion semantica de toda la plataforma demasiado temprano.

---

## 28. AI assistant

## 28.1 Que es en Facets

Es un asistente capaz de responder preguntas financieras y eventualmente ejecutar herramientas sobre datos del usuario.

## 28.2 Por que existe

Puede convertir un producto de lectura en uno de consulta accionable, siempre que los datos sean confiables.

## 28.3 Como funcionara en el MVP

No entra al core. Queda como **post-MVP**.

## 28.4 Como debe realizarse logicamente

- AI debe apoyarse en reportes y datos bien definidos, no inventar respuestas;
- las herramientas disponibles deben tener semantica clara y auditabilidad;
- el asistente debe llegar cuando el producto ya puede responder bien sin AI.

## 28.5 Ejemplos practicos

- "Cuanto gaste en comida el ultimo mes";
- "Mostrame mis cuentas con menos saldo";
- "Que pagos grandes tuve este trimestre".

## 28.6 Que dejamos fuera

- chat generalista precoz;
- decisiones automaticas sin control;
- dependencia del asistente para tareas que la UI deberia resolver sola.

---

## 29. Chat persistente con mensajes y tool calls

## 29.1 Que es en Facets

Es la capa conversacional persistente donde el usuario mantiene historico de conversaciones con el asistente y sus tool calls.

## 29.2 Por que existe

Da continuidad, trazabilidad y contexto a un sistema de AI financiero serio.

## 29.3 Como funcionara en el MVP

No entra. Queda como **post-MVP**.

## 29.4 Como debe realizarse logicamente

- cada mensaje y tool call debe quedar asociado al workspace;
- la persistencia necesita gobierno, limites y auditable history;
- no conviene abrir este frente antes de estabilizar la base funcional.

## 29.5 Ejemplos practicos

- continuar una conversacion sobre gastos del ultimo trimestre;
- revisar que consultas y acciones ejecutó el asistente.

## 29.6 Que dejamos fuera

- chat como feature principal del MVP;
- multimodalidad compleja;
- orchestration avanzada de agentes.

---

## 30. MCP y extensibilidad externa

## 30.1 Que es en Facets

Es la capacidad de exponer herramientas y capacidades del producto a agentes o sistemas externos mediante un protocolo de integracion.

## 30.2 Por que existe

Puede convertir a Facets en plataforma y no solo en aplicacion cerrada.

## 30.3 Como funcionara en el MVP

No entra. Queda como **post-MVP**.

## 30.4 Como debe realizarse logicamente

- primero hay que definir bien entidades, permisos y contratos internos;
- despues se exponen capacidades externas con autentificacion y alcance claro;
- si se abre demasiado pronto, se congela el modelo cuando todavia deberia evolucionar.

## 30.5 Ejemplos practicos

- un agente externo consulta cuentas y reportes;
- una herramienta automatizada crea transacciones bajo permisos limitados.

## 30.6 Que dejamos fuera

- MCP en V1;
- ecosistema abierto a terceros desde el inicio;
- soporte contractual publico temprano.

---

## 31. API keys y API publica-privada

## 31.1 Que es en Facets

Es la capa de acceso programatico para clientes propios y, mas adelante, para integradores externos.

## 31.2 Por que existe

Permite extensibilidad, mobile robusto, scripts internos y eventual ecosistema externo.

## 31.3 Como funcionara en el MVP

- API privada para clientes oficiales y aplicaciones propias;
- no abrir aun una API publica para terceros;
- las API keys externas quedan como **post-MVP**, salvo necesidad muy justificada.

## 31.4 Como debe realizarse logicamente

- primero contrato interno estable;
- luego scopes claros y seguridad fuerte;
- separar cliente oficial de integradores externos es sano desde el producto.

## 31.5 Ejemplos practicos

- mobile consume API oficial para transacciones y reportes;
- en el futuro un script personal lee balances con una API key `read`.

## 31.6 Que dejamos fuera

- developer platform publica;
- OAuth abierto a terceros desde el inicio;
- marketplace de integraciones.

---

## 32. Scope matrix

| Dominio / Feature                 | Core MVP | Optional MVP | Post-MVP | Racional corto                                              |
| --------------------------------- | -------- | ------------ | -------- | ----------------------------------------------------------- |
| Onboarding inicial                | Yes      |              |          | Necesario para activacion y coherencia                      |
| Workspace y preferencias globales | Yes      |              |          | Define moneda base, periodo y defaults                      |
| Accounts tipadas                  | Yes      |              |          | Fundacion del dominio                                       |
| Balances y reconciliacion         | Yes      |              |          | Necesario para confianza                                    |
| Transactions                      | Yes      |              |          | Captura central del flujo                                   |
| Transfers                         | Yes      |              |          | Evita doble conteo y errores graves                         |
| Credit cards                      | Yes      |              |          | Caso critico de semantica                                   |
| Debts                             | Yes      |              |          | Impacto directo en cashflow                                 |
| Loans                             | Yes      |              |          | Mismo motivo, con semantica propia                          |
| Categories                        | Yes      |              |          | Sin clasificacion no hay lectura util                       |
| Subcategories                     | Yes      |              |          | Drill-down sin romper simplicidad                           |
| Merchants                         | Yes      |              |          | Calidad de dato y reporting                                 |
| Reports                           | Yes      |              |          | Primera clase del producto                                  |
| Multicurrency lite                | Yes      |              |          | Fundacional para producto global                            |
| Seeds y defaults                  | Yes      |              |          | Reduce friccion inicial                                     |
| Tags                              |          | Yes          |          | Utiles, pero no necesarios para valor inicial               |
| Reglas deterministicas            |          | Yes          |          | Mejoran eficiencia sin cambiar tesis base                   |
| Recurrencias simples              |          | Yes          |          | Aportan proyeccion y orden                                  |
| Budgets mensuales simples         |          | Yes          |          | Muy valiosos, pero pueden entrar despues del core semantico |
| CSV import                        |          | Yes          |          | Acelera adopcion, no define esencia del dominio             |
| Mobile offline-first minimo       |          | Yes          |          | Diferencial fuerte, pero tecnicamente costoso               |
| Documentos / family docs          |          |              | Yes      | Requiere modelo y permisos extra                            |
| Busqueda vectorial / semantica    |          |              | Yes      | Depende de documentos y AI                                  |
| AI assistant                      |          |              | Yes      | Llega despues de datos confiables                           |
| Chat persistente y tool calls     |          |              | Yes      | Complejidad alta sin valor base asegurado                   |
| MCP / extensibilidad externa      |          |              | Yes      | Plataforma futura                                           |
| API keys externas / API publica   |          |              | Yes      | Abrir contrato demasiado pronto es caro                     |
| Net worth                         |          |              | Yes      | Explicitamente fuera del foco MVP                           |
| Inversiones y activos no cash     |          |              | Yes      | Scope explosion si entran temprano                          |

---

## 33. Flujos practicos clave del MVP

## 33.1 Flujo A - Usuario nuevo manual

1. crea workspace;
2. define moneda base e inicio de mes;
3. crea cuenta bancaria y tarjeta;
4. carga balances iniciales;
5. registra ingresos y gastos;
6. clasifica movimientos;
7. ve resumen por cuenta e income vs expense;
8. entiende en que categoria se va la plata.

Valor entregado: activacion rapida y primera lectura financiera real.

## 33.2 Flujo B - Pago de tarjeta bien resuelto

1. compra en tarjeta por 200 en categoria comida;
2. la deuda de tarjeta sube;
3. dias despues paga 200 desde cuenta bancaria;
4. Facets crea o registra `cc_payment`;
5. el pago reduce deuda, pero no suma gasto nuevo;
6. reportes siguen mostrando el gasto real solo una vez.

Valor entregado: confianza. El usuario siente que la app no le miente.

## 33.3 Flujo C - Prestamo simple

1. usuario crea loan con saldo pendiente inicial;
2. cada mes registra pago de prestamo;
3. el saldo baja;
4. el movimiento queda diferenciado del gasto cotidiano.

Valor entregado: visibilidad de obligacion sin contaminar lectura de consumo.

## 33.4 Flujo D - Gasto one-time

1. usuario paga mudanza o arreglo mayor;
2. lo marca como `one_time`;
3. el movimiento sigue existiendo;
4. ciertas comparativas y promedios operativos no lo usan como gasto habitual.

Valor entregado: reportes mas honestos.

## 33.5 Flujo E - Multicurrency basico

1. usuario tiene cuenta base en EUR y caja USD;
2. registra un gasto en USD;
3. lo ve en su moneda original y consolidado a EUR para resumen;
4. transfiere entre monedas con visibilidad de origen y destino.

Valor entregado: producto usable para vida financiera real, no solo mono-moneda.

---

## 34. Tradeoffs y racionales

## 34.1 Por que net worth queda fuera del MVP

Porque el MVP tiene que resolver primero flujo operativo con alta confianza. Net worth agrega mucho valor, pero tambien exige soportar activos no cash, valuaciones, inversiones y consolidaciones mas complejas.

Tradeoff:

- ventaja: foco, velocidad, coherencia;
- costo: la vision patrimonial completa llega despues.

## 34.2 Por que reports son first-class

Porque sin lectura clara el producto queda reducido a una planilla con UI bonita. El objetivo del usuario no es registrar por registrar, sino decidir mejor.

Tradeoff:

- ventaja: time-to-value alto;
- costo: obliga a modelar semantica bien desde el principio.

## 34.3 Por que transferencias, tarjetas y prestamos son fundacionales

Porque son los casos que mas rapido rompen confianza si se modelan como CRUD generico.

Tradeoff:

- ventaja: base correcta y escalable;
- costo: mas trabajo de diseno al inicio.

## 34.4 Por que multicurrency entra en core, pero lite

Porque no es una rareza del futuro, pero tampoco conviene convertir el MVP en un motor financiero global extremo.

Tradeoff:

- ventaja: producto mas universal;
- costo: hay que ser muy claro con conversiones y limites.

## 34.5 Por que AI, documentos y extensibilidad se postergan

Porque multiplican valor solo si el dato base es bueno. Antes de eso, solo agregan complejidad cara y vistosa.

Tradeoff:

- ventaja: se evita humo de producto;
- costo: algunas features atractivas para marketing llegan despues.

## 34.6 Por que budgets no son core duro

Porque un budget mal apoyado sobre semantica floja es peor que no tener budget. Conviene estabilizar primero transacciones, transfers, tarjetas, categorias y reportes.

Tradeoff:

- ventaja: menos retrabajo;
- costo: la capa de planificacion puede entrar un poco mas tarde.

---

## 35. Riesgos de producto y mitigaciones

| Riesgo                                            | Impacto                                    | Mitigacion                                                             |
| ------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Modelar transferencias como transacciones comunes | Reportes falsos y perdida de confianza     | Transfer first-class y tipos semanticos dedicados desde el dia 1       |
| Duplicar gasto en tarjetas                        | El usuario abandona por numeros mentirosos | `cc_payment` excluido de gasto corriente y UX dedicada                 |
| Reconciliar con transacciones basura              | Cashflow contaminado                       | Ajuste de saldo separado de gasto/ingreso comun                        |
| Multicurrency ambigua                             | Inconsistencia en balances y reportes      | Moneda original preservada, moneda base clara y conversion consistente |
| Taxonomia pobre de categorias                     | Reportes inutiles y budgets flojos         | Seeds curados, dos niveles maximo y categorias padre fuertes           |
| Scope creep por AI, docs o API publica            | Retrasos y base debil                      | Scope matrix explicita y gates de madurez                              |
| Budget prematuro                                  | Mala experiencia y retrabajo               | Posicionarlo como optional MVP apoyado en semantica estable            |
| Mobile offline demasiado ambicioso                | Complejidad tecnica excesiva               | Empezar por captura offline minima y sync simple                       |
| Exceso de configuracion                           | Onboarding pesado y abandono               | Defaults fuertes y progressive disclosure                              |
| Falta de ejemplos y reglas de negocio claras      | Producto inconsistente entre equipos       | Usar este documento como contrato de producto y dominio                |

---

## 36. Decisiones de producto cerradas

1. El MVP de Facets es **cashflow-first**. Net worth queda fuera del foco inicial.
2. **Reports** son una capability central del MVP, no una fase posterior decorativa.
3. **Transfers**, **credit card payments**, **loan payments** y **multicurrency** son fundamentos del modelo.
4. **Credit cards** y **loans** deben ser tipos semanticos reales, no variantes cosmeticas de cuenta comun.
5. **Reconciliacion** no debe crear gasto o ingreso falso.
6. **Categories y subcategories** se limitan a una jerarquia clara de dos niveles.
7. **Budgets**, **tags**, **recurring**, **CSV import** y **offline-first minimo** pueden entrar como optional MVP si no comprometen el core.
8. **Documentos**, **vector search**, **AI assistant**, **chat persistente**, **MCP** y **API publica** quedan correctamente ubicados en post-MVP.

---

## 37. Criterio de exito del MVP

El MVP esta bien logrado si un usuario puede:

- crear su workspace y primeras cuentas sin friccion excesiva;
- registrar ingresos, gastos y movimientos internos con rapidez;
- pagar tarjeta o prestamo sin romper reportes;
- entender su dinero disponible por cuenta;
- ver si gasta menos de lo que gana;
- comparar periodos relevantes;
- ver donde se va su plata por categoria;
- confiar en que la app no esta duplicando ni deformando movimientos.

La prueba de fuego no es tener muchas pantallas. Es que las pantallas principales respondan bien las preguntas correctas.

---

## 38. Cierre

Facets tiene que arrancar donde mas duele y mas valor genera: flujo de caja confiable, semantica financiera correcta y reportes claros.

El recorte sano del MVP no consiste en borrar la complejidad importante. Consiste en dejar afuera dominios valiosos pero diferibles para que lo central salga BIEN.

La apuesta de producto es esta:

- una base operativa seria;
- una experiencia simple en superficie;
- una arquitectura funcional preparada para crecer;
- y una hoja de ruta donde AI, documentos y extensibilidad se apoyen sobre verdad financiera real.

Ese es el MVP correcto para Facets.

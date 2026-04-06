## Vision del Producto

Facets debe convertirse en el sistema financiero diario para personas, parejas y households livianos que necesitan entender su plata operativa con claridad: cuanto dinero tienen disponible, si estan gastando menos de lo que ganan, en que se va la plata y como se mueven sus obligaciones entre cuentas, tarjetas y prestamos.

Para el MVP principalemtne el producto saldra para todo el peru ese sera el publico objetivo pero todo tiene que estar pensado a que en un futuro si funciona el proyecto podamos ir a mas paises y que el cambio y la implementacion sea lo mas eficietne posible y menos dolorosa

La tesis del MVP es deliberada:

- **cashflow-first**: el foco principal es flujo de caja, no patrimonio neto;
- **reportes first-class**: el valor no esta solo en cargar datos, sino en responder preguntas utiles;
- **semantica correcta antes que CRUD rapido**: transferencias, pagos de tarjeta, pagos de prestamo y multicurrency no son detalles, son fundamentos;
- **simple en superficie, serio en el dominio**: la app debe sentirse clara, pero por debajo necesita modelar correctamente los casos dificiles para no mostrar numeros mentirosos.

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
- plataforma abierta para terceros;

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

Features

### Workspace

Todo vivira dentro de un espacio financiero que puede ser compartido. En Facets esto representara la unidad financiera principal por ejemplo

- Individuo
- Pareja
- Household liviano
- Grupos

Dentro de un Workspace se podra definir

- Moneda base
- Inicio de mes operativo
- Preferencias globales
- Categorias, merchants, seeds de datos, etc
- Miembros con acceso compartido

MVP:

- Para nuestro MVP solamente vamos a dar soporte indivual que quiere decir que por el momento no se va a poder invitar a mas personas a un workspace pero todo tiene que estar preparado para que de forma facil se pueda implementar y todo el sistema de Autherizacion y Authenticacion debe estar funcionando

### Accounts

Basicamente las cuentas van a representar donde vive el dinero o una obligacion a pagar ya que Sin cuentas tipadas no se puede distinguir correctamente entre efectivo, pasivos y movimientos internos.

MVP:

- Efectivo
- Banco
- Tarjeta de credito
- Deuda Generica
- Prestamo
- Dinero que yo preste a otras personas

Por ejemplo

- cuenta "Santander sueldo" en ARS para ingresos y gastos del mes;
- cuenta "Visa Macro" como tarjeta de credito;
- cuenta "Prestamo auto" como loan;
- cuenta "Caja chica USD" como efectivo en moneda extranjera.

Para el tema del os balances

El balance representa el estado financiero actual o de referencia de una cuenta.

Tendremos

- balance inicial;
- balance actual derivado de movimientos;
- accion de ajuste o reconciliacion;
- historial simple de cambios de saldo relevantes.

Ademas

- una reconciliacion no debe aparecer como gasto o ingreso comun;
- el producto debe tratar el ajuste de saldo como correccion de estado, no como transaccion falsa;
- los balances tienen que servir para confiabilidad, no para contaminar analytics;
- en cuentas manuales, la UX debe priorizar "ajustar saldo actual" por encima de terminologia contable compleja.
  Por ejemplo

- una cuenta bancaria deberia tener 1200 pero el banco muestra 1150: el usuario reconcilia a 1150 y el cashflow no se ensucia;
- una tarjeta arranca con deuda previa de 800: se carga balance inicial y despues las compras y pagos operan sobre esa base.

## Eventos financieros con semantica explicita

El producto necesita distinguir, aunque la UI sea simple:

- transaccion normal;
- transferencia entre cuentas propias;
- pago de tarjeta;
- pago de prestamo;
- gasto one-time;
- ajuste de saldo o reconciliacion.

La idea central es simple: no todo lo que mueve plata significa lo mismo.

## Capa analitica comun

Budgets, reportes, comparativas y dashboards deben consumir la misma verdad semantica. Si una pantalla trata un movimiento como gasto y otra como transferencia, el producto queda roto.

##  Capa de clasificacion

La lectura del usuario se organiza sobre:

- categorias;
- subcategorias;
- merchants;
- tags opcionales.

## Capa de inteligencia y extensibilidad

Documentos, busqueda semantica, AI assistant, chat persistente, tool calling, MCP y API keys existen en la vision del producto, pero solo tienen sentido cuando la base transaccional ya es confiable.

## Transactions

La transaccion es el evento cotidiano que registra ingreso, gasto o movimiento operativo. Es la unidad central de captura para responder flujo mensual, clasificacion y reportes.

Lo que se debe tener en cuenta es

- la transaccion comun no debe absorber semanticas que merecen entidad o tipo propio;
- el usuario debe sentir un flujo simple, pero el dominio debe distinguir `standard`, `funds_movement`, `cc_payment`, `loan_payment` y `one_time`;
- pending o borradores pueden existir en el futuro, pero no deben complicar la V1 innecesariamente.

Por ejemplo

- sueldo en cuenta bancaria;
- compra en supermercado con debito;
- gasto en farmacia con tarjeta;
- pago de seguro marcado como recurrente mas adelante;
- mudanza marcada como `one_time` para no deformar promedios.

## Transfers

Una transferencia es el movimiento entre dos cuentas propias que une dos puntas de una misma intencion financiera. Debemos tener en cuenta que si el sistema la trata como gasto mas ingreso, rompe balances, presupuesto y reportes.

Por ejemplo

- transferencia comun;
- pago de tarjeta;
- pago de prestamo.

Super importante

- evitar doble conteo en reportes.
- - crearla explicitamente como accion dedicada;
- elegir origen, destino, fecha, monto y moneda;
- ver el badge semantico correcto en ambas cuentas;

Uso

- mover 500 de banco a efectivo: no aumenta gasto ni ingreso;
- mover 1000 de ARS a cuenta USD: es movimiento interno con posible conversion visible;
- pagar 300 de la tarjeta desde banco: reduce deuda, no agrega gasto nuevo.

### Credit Cards

La tarjeta de credito es una cuenta de pasivo con semantica propia.Es el caso mas comun donde las apps de finanzas mienten: compra y pago no pueden contarse como el mismo tipo de salida.

Por ejemplo

- las compras en tarjeta aumentan deuda pendiente;
- el pago de tarjeta reduce esa deuda;
- el gasto real ocurre en la compra, no en el pago;
- el producto mostrara saldo adeudado, movimientos y pagos asociados.

Uso

- compra de supermercado por 120 con tarjeta: impacta categoria comida y sube deuda;
- pago de 120 desde cuenta sueldo: baja deuda, no suma gasto del periodo;
- pago parcial de resumen: reduce parte de la obligacion sin alterar el gasto historico original.

## Debts

Debt representa una obligacion financiera que no necesariamente necesita toda la semantica de un prestamo estructurado.Muchos usuarios tienen deudas informales o simples que igual afectan cashflow y dinero disponible.

- pagos manuales registrados correctamente;
- visibilidad de deuda actual y reduccion en el tiempo.
- - debt cubre obligaciones simples;
- si la deuda requiere calendario, tasa y cuota, debe migrar conceptualmente a `loan`;
- los pagos deben evitar contaminar gasto corriente si representan cancelacion de obligacion ya reconocida.

USO

- deuda con familiar o amigo;
- saldo adeudado a proveedor;
- gasto grande financiado fuera de tarjeta.

##  Loans

Loan representa un prestamo estructurado que merece tratamiento distinto a una deuda generica.Prestamos de auto, estudio o personales afectan cashflow futuro y necesitan semantica especifica.

- balance inicial o saldo pendiente;
- pago registrado como `loan_payment`;
- campos simples opcionales para cuota estimada, tasa o fecha de vencimiento si aportan valor.
- - loan tiene que permitir leer claramente obligacion restante y pagos aplicados;
- los pagos deben diferenciarse de gasto corriente cotidiano;
- si se decide categorizar parte de un pago, eso debe ser una evolucion futura bien pensada, no improvisada.

Uso

- prestamo automotor con cuota mensual;
- prestamo personal que se cancela mes a mes;
- deuda estudiantil simple registrada con saldo inicial.

## LentMoney

LentMoney representa dinero que el usuario prestó a otras personas o empresas y que espera recuperar. Es el caso inverso de Debt — no es una obligación del usuario sino un derecho de cobro.

**Cómo funciona:**

- el usuario registra a quién le prestó, cuánto y opcionalmente por qué y cuándo espera que le paguen
- cuando recibe un pago lo registra indicando el monto y la cuenta donde entró el dinero
- el monto pendiente baja con cada pago registrado
- cuando se cobra todo queda SETTLED, si decide no cobrar lo puede marcar como FORGIVEN

**Regla importante:** cuando alguien te devuelve plata prestada ese cobro no es un ingreso real — es recupear lo tuyo. Los pagos ractualizan el saldo de la cuenta pero no contaminan los reportes de cashflow como ingreso del período.

**Uso:**

- un amigo al que le prestaste para una emergencia
- un familiar al que le adelantaste dinero
- un cliente o proveedor que te quedó debiendo

## Categories

Las categorias agrupan el significado principal de ingresos y gastos.Sin una taxonomia curada no hay reportes utiles, budgets consistentes ni automatizacion futura.

- categorias raiz separadas por `income` y `expense`;
- icono, color y nombre;
- editables por el usuario;
- seeds iniciales por locale.
- la categoria raiz es la unidad principal de lectura en dashboard y reportes de alto nivel;
- las categorias default deben ser opinionadas, no una lista infinita.

Ejemplo

- Ingresos: sueldo, freelance, otros ingresos;
- Gastos: vivienda, comida, transporte, salud, entretenimiento, servicios, deuda.

## Subcategories

Las subcategorias refinan una categoria raiz sin reemplazarla.Permiten detalle util sin romper la simplicidad del dashboard principal.

- jerarquia maxima de dos niveles;
- reportes con agregacion a padre y drill-down a hijas.
- el producto debe leer primero categoria padre, despues detalle;
- budgets iniciales pueden operar al nivel padre, dejando nivel hijo como evolucion;
- subcategoria no debe convertirse en un arbol profundo.

Ejemplo

- Comida -> supermercado, delivery, cafes;
- Vivienda -> alquiler, expensas, reparaciones;
- Transporte -> combustible, taxi, transporte publico.

## Tags

Los tags son una dimension transversal opcional para clasificar transacciones mas alla de su categoria principal.Algunos cortes utiles no encajan en la estructura fija de categorias.

- alta simple de tags;
- asignacion manual;
- uso basico en filtros o vistas futuras.
- - categoria responde "que fue";
- tag responde "bajo que contexto lo miro";
- no debe reemplazar una taxonomia mal pensada.

Por ejemplo

- `trabajo`;
- `vacaciones`;
- `reembolsable`;
- `hijos`

## Merchants

Merchant representa el comercio o contraparte asociado a una transaccion.Los nombres libres son inconsistentes y eso degrada automatizacion, busqueda y analitica.

- merchant manual;
- normalizacion simple;
- posibilidad de reusar merchants existentes;
- reportes y filtros basicos por merchant
- - merchant debe mejorar la calidad del dato, no agregar friccion innecesaria;
- el sistema debe tolerar descripciones crudas pero tender a consolidarlas;
- la capa merchant prepara el camino para reglas futuras.

Ejemplos

- El sistema de merchants usa un modelo **copy-on-first-use** con dos piezas: un **catálogo global** (`SystemMerchantCatalog`) que nosotros mantenemos con marcas conocidas como Starbucks, McDonald's, Netflix — con logo y color — y una tabla unificada **`Merchant`** por workspace donde vive la verdad operativa. Cuando el usuario selecciona una marca del catálogo, se copia a su workspace como merchant con `source = SYSTEM`. Si no encuentra lo que busca, crea uno custom con `source = CUSTOM`. Una vez en el workspace, el merchant es 100% del usuario: puede renombrarlo, cambiarle el color o el logo. La transacción apunta a una sola FK (`merchantId`) contra el merchant del workspace, nunca contra el catálogo directamente. No hay sugerencia automática de categoría basada en merchant — la categorización es decisión del usuario al registrar cada transacción.

## Recurring y one-time

Recurring establece los pagos repetidos; `one_time` identifica excepciones que no deben deformar la lectura operativa. sin esta distincion, el producto mezcla habitos reales con anomalías y los promedios se vuelven inutiles.

- `one_time` excluye de ciertos promedios y lecturas operativas, pero no borra historia;
- Los pagos frecuentes son una lista de recordatorios configurados manualmente por el usuario que indican nombre, día del mes esperado y monto. El monto tiene dos modalidades: fijo o variable. Si el usuario elige monto fijo ingresa un único valor en `amount`. Si elige variable ingresa un rango con `amountMin` y `amountMax` — útil para servicios como luz o agua que cambian cada mes. Cuando llega el día configurado la app muestra un recordatorio notificando al usuario que tiene ese pago pendiente. El usuario lo cierra y registra la transacción de forma completamente normal cuando la realice, sin ningún vínculo entre el recordatorio y la transacción. El sistema de pagos frecuentes es puramente una capa de recordatorio desacoplada del registro de transacciones.

Por ejemplo

- mudanza por 2000 marcada como `one_time`;
- seguro mensual registrado como pago recurrente;
- sueldo mensual registrado como ingreso recurrente.

## Budgets

Budget es la capa de planificacion que traduce observacion historica en control futuro.Sin budget el producto responde solo "que paso". Con budget empieza a responder "como voy".

- presupuesto mensual por categoria padre;
- lectura consumido vs disponible;
- respeto del inicio de mes configurado;
- exclusion de movimientos que no deben contaminar budget, como transferencias internas y pagos de tarjeta.
- - budget debe apoyarse en la misma semantica que reportes;
- no debe castigar al usuario con setup infinito;

Uso

- Comida: presupuesto 400, gastado 280, disponible 120;
- Transporte: presupuesto 150, gastado 165, estado excedido;
- pago de tarjeta: no consume presupuesto como gasto nuevo.

## Reports

Los reportes son la forma principal en que el usuario obtiene valor de negocio del producto.Una app que solo registra movimientos pero no responde preguntas claras obliga al usuario a hacer el trabajo mental que el producto deberia resolver.

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

A tener en cuenta

- reportes no son un modulo accesorio: deben guiar la home y el producto;
- categorias padre primero, detalle despues;
- comparativas deben usar periodos equivalentes;
- movimientos internos no deben mentir en analitica;
- `one_time` debe poder quedar fuera de ciertas lecturas operativas;
- los mismos numeros deben cerrar entre dashboard, detalle y resumen.
  uso

- "Gastaste 920 este mes vs 1030 el mes pasado";
- "Tu categoria principal fue Comida con 31 por ciento del gasto";
- "Tus cuentas operativas muestran 1450 disponibles y tu tarjeta adeuda 380".

## Multicurrency

Multicurrency permite operar cuentas y transacciones en distintas monedas, consolidando la lectura del workspace en una moneda base.Sin multicurrency, una app financiera global queda rota muy rapido para expats, freelancers internacionales o usuarios con cuentas en USD/EUR/ARS y similares.

- cada workspace tiene moneda base;
- cada cuenta tiene su moneda;
- cada transaccion conserva su moneda original;
- reportes muestran consolidacion en moneda base con conversion consistente;
- transferencias entre monedas deben ser posibles con visibilidad clara del monto origen y destino.
- - la moneda original nunca debe perderse;
- la conversion para reporting debe ser consistente y explicable;
- el producto debe dejar claro cuando una cifra esta convertida;
- la V1 no necesita resolver el mejor motor de FX del mercado, pero SI necesita evitar ambiguedad y doble interpretacion.

USO

- cuenta bancaria en EUR y tarjeta en USD dentro de un workspace base EUR;
- gasto de viaje cargado en USD pero consolidado a ARS para el resumen;
- transferencia de ARS a caja USD mostrando ambos montos.

## Settings globales y preferencias

Son las configuraciones que dan coherencia al workspace y a la experiencia diaria. Sin defaults y preferencias globales, el producto se vuelve inconsistente entre cuentas, periodos y reportes.

- moneda base;
- inicio de mes operativo;
- locale o pais de seeds;
- preferencias basicas de visualizacion;
- administracion simple de categorias y cuentas.
- - settings deben servir al uso cotidiano, no convertirse en cementerio de opciones;
- las configuraciones globales tienen que impactar reportes y budgets de forma consistente;
- el usuario debe poder corregir defaults sin perder historia innecesariamente.

Uso

- cambiar inicio de mes del dia 1 al 26 para alinear sueldos y gastos recurrentes;
- definir USD como moneda base aunque haya cuentas en ARS y EUR;
- ajustar categorias default a un contexto local.

## Seeds y defaults iniciales

Son los datos iniciales y estructuras opinionadas que permiten que el producto arranque util.Un producto financiero vacio genera friccion, errores y abandono.

- categorias y subcategorias por locale;
- merchants frecuentes opcionales;
- tipos de cuenta sugeridos;
- ejemplos o plantillas de setup rapido.
- - seeds deben ser curados y editables;
- no deben sentirse como taxonomia enciclopédica;
- tienen que optimizar tiempo hasta el primer insight util.

Uso

- un usuario nuevo ya ve Comida, Vivienda, Salud, Transporte y Servicios listos para usar;
- al crear una tarjeta, el producto sugiere comportamiento semantico y reportes compatibles.

## Mobile offline-first

Es la capacidad de capturar y operar movimientos desde mobile con buena performance, aun cuando la conectividad sea pobre.Muchos movimientos se cargan en el momento. Si la experiencia mobile es lenta o frágil, el habito se rompe.

- captura rapida local de transacciones;
- cola simple de sincronizacion;
- feedback claro de estado pendiente/sincronizado;
- lectura reciente aun sin red cuando ya hay datos locales.
- - offline-first debe priorizar pocos casos, pero bien resueltos;
- crear una transaccion offline vale mas que intentar soporte universal desde dia 1;
- el usuario debe entender si algo ya se sincronizo o

uso

- cargar un gasto en taxi sin señal y verlo sincronizado mas tarde;
- corregir una categoria en el subte y que el cambio suba despues.

MVP

Para nuestor MVP no vamos a contemplat el tema de mobile offline-fiirst mas que todo porque es mucha complejidad para esta etapa entonces lo que se tiene en mente es lo siguiente: sI EL PRODUCTO FUNCIONA ENTONCES SE IMPLEMENTARA SOPORTE PARA ESTO. PERO TODO TIENE QUE ESTAR PENSADO PARA EL DIA QUE SE HAGA ESTO HACERLO DE FORMA EFICIETNE SENCILLA Y SIN DOLOR.

##  Documentos y family docs

Es la capacidad de almacenar documentos financieros asociados al workspace. Extractos, contratos, comprobantes y archivos de soporte agregan contexto y abren la puerta a busqueda, AI y auditoria ligera.

- los documentos deben ser del workspace, no de un movimiento aislado solamente;
- el sistema necesita permisos, metadata y relacion clara con cuentas o periodos;
- esta capa debe nacer pensando en recuperacion y contexto, no solo en upload de archivos.

uso

- guardar resumen de tarjeta del mes;
- subir contrato de prestamo o comprobante relevante;
- conservar extractos para consultas futuras.
- Los usuarios suben documentos (contratos, manuales, facturas locas) Y LUEGO SE PUEDE AGREGAR FUNCIONALAIDES COMO INDEXACARLO Y HACER BUSQUEDA EN UN VECTOR STORE Y LUEGO QUE EL USAURIO PUEDA PREGUNTARLE A LA AI COSAS COMO ¿Che, cuándo vence el contrato del alquiler.

##  AI assistant

Es un asistente capaz de responder preguntas financieras y ejecutar herramientas sobre datos del usuario. Puede convertir un producto de lectura en uno de consulta accionable, siempre que los datos sean confiables.

EL "ASISTENTE" CON ACCESO A LA POSTA (Tool Calling)
El chat no es solo un loro que repite cosas. Tiene "Functions".
Cómo funciona: Si el usuario pregunta "¿Cuánto gasté en pizza este mes?", la IA no adivina. El sistema le da herramientas (funciones de nestjs)
para que ella misma haga el query a la base de datos, sume los montos y le devuelva la respuesta real al usuario. Se llama Function Calling.
Importante

- Lo importante es que nunca envía información personal identificable como email, nombre o números de cuenta al proveedor de AI. Solo envía montos, categorías y balances agregados.

Uso

- "Cuanto gaste en comida el ultimo mes";
- "Mostrame mis cuentas con menos saldo";
- "Que pagos grandes tuve este trimestre".
- O tambien cosas como tiene sus documentos y ya se indexaron y vectorizaron entonces le podemosh acer preguntas al chat

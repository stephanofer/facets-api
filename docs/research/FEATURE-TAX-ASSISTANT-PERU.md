# Feature Research: AI Tax Assistant para Perú (y LATAM)

> **Fecha**: Febrero 2026  
> **Estado**: Investigación / Propuesta  
> **Mercado primario**: Perú  
> **Escalabilidad**: Aplicable a Colombia, México, Chile, Argentina, Ecuador

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [El Problema: Dolores Reales del Contribuyente Peruano](#el-problema)
3. [Contexto Tributario Peruano](#contexto-tributario)
4. [Feature Propuesta: Facets Tax AI](#feature-propuesta)
5. [Casos de Uso Prácticos](#casos-de-uso)
6. [Análisis Competitivo](#análisis-competitivo)
7. [Modelo de Monetización](#modelo-de-monetización)
8. [Consideraciones Legales](#consideraciones-legales)
9. [Roadmap Técnico Sugerido](#roadmap-técnico)
10. [Escalabilidad a Otros Países](#escalabilidad)

---

## Resumen Ejecutivo

El contribuyente peruano promedio (personas naturales y MYPEs) enfrenta un ecosistema tributario complejo con SUNAT que incluye múltiples categorías de renta, deducciones con reglas específicas, cronogramas estrictos y penalidades severas por incumplimiento. **La mayoría de la gente deja dinero en la mesa** porque no sabe qué gastos puede deducir, no guarda comprobantes correctamente, o simplemente no entiende el sistema.

**Oportunidad**: Un asistente de impuestos con AI integrado en un finance tracker puede resolver esto de forma AUTOMÁTICA. El usuario ya está registrando sus gastos en Facets — nosotros podemos analizar esos gastos en tiempo real y decirle: _"Oye, este gasto en el dentista es deducible, guardá la boleta electrónica"_.

### Propuesta de Valor en Una Línea

> **"Facets te ayuda a pagar menos impuestos legalmente, sin que tengas que saber nada de impuestos."**

---

## El Problema

### Dolores Reales del Contribuyente Peruano

#### 1. No saben qué pueden deducir (y pierden plata)

SUNAT permite deducir hasta **3 UIT adicionales** (~S/. 15,450 en 2025, con UIT = S/. 5,150) en gastos específicos para rentas de trabajo (4ta y 5ta categoría). Pero la MAYORÍA de contribuyentes no lo aprovecha porque:

- No saben que ir al **dentista** es deducible
- No saben que el **alquiler** de su depa es deducible
- No saben que comer en **restaurantes** registrados puede ser deducible
- No piden **comprobante electrónico** (solo piden boleta normal)
- No llevan control de cuánto han acumulado vs. el tope de 3 UIT

**Dato clave**: Para que un gasto sea deducible, el comprobante DEBE estar emitido electrónicamente y registrado en SUNAT. Si pedís boleta de papel en un restaurante chiquito que no emite electrónica, NO te sirve.

#### 2. No entienden en qué categoría de renta están

El sistema peruano tiene **5 categorías de renta**, cada una con reglas distintas:

| Categoría | Qué es                        | Ejemplo                    |
| --------- | ----------------------------- | -------------------------- |
| **1ra**   | Alquiler de inmuebles/muebles | Alquilás tu depto          |
| **2da**   | Ganancias de capital          | Vendés acciones en la BVL  |
| **3ra**   | Rentas empresariales          | Tenés un negocio/empresa   |
| **4ta**   | Trabajo independiente         | Freelancer, consultor, CAS |
| **5ta**   | Trabajo dependiente           | Empleado en planilla       |

Un freelancer peruano puede tener renta de 4ta (sus recibos por honorarios), 5ta (un trabajo part-time en planilla) y 1ra (alquila un cuarto en Airbnb). **Cada una tributa distinto y tiene deducciones distintas.** Es una locura para la persona promedio.

#### 3. No saben cuándo deben declarar

SUNAT tiene un **cronograma específico** basado en tu último dígito de RUC. Si lo incumplís, multa. Y el cronograma cambia cada año. Además hay cronogramas diferentes para:

- Personas naturales y MYPEs (hasta 1700 UIT de ingresos)
- Empresas del Régimen General (más de 1700 UIT)

#### 4. No llevan control de retenciones y pagos a cuenta

- Los empleados de 5ta categoría tienen retenciones mensuales que su empleador hace
- Los independientes de 4ta categoría tienen retención del 8% por cada recibo por honorarios
- Estos pagos a cuenta SE PUEDEN usar como CRÉDITO contra el impuesto anual
- Pero **nadie lleva el control** → terminan pagando de más o no piden su devolución

#### 5. Freelancers: Caos total con recibos por honorarios

Los trabajadores independientes (4ta categoría) deben:

- Emitir **Recibos por Honorarios Electrónicos** (obligatorio desde 2017)
- Aplicar retención del 8% (o solicitar suspensión si ganan menos de S/. 43,313 anuales aprox.)
- Deducir el 20% de sus ingresos brutos automáticamente
- Además deducir hasta 3 UIT adicionales en gastos calificados
- Declarar mensualmente si superan el límite

**El dolor**: No saben si deben retener o no, no llevan control de cuánto acumulan, no saben si les conviene pedir suspensión de retenciones.

#### 6. MYPEs: No distinguen gastos personales de empresariales

Uno de los problemas MÁS grandes que SUNAT identifica (y fiscaliza agresivamente):

- Dueños de negocios piden **factura** por gastos personales (almuerzo familiar, combustible personal)
- Registran esos gastos en la contabilidad de la empresa
- Deducen IGV como crédito fiscal indebidamente
- **Consecuencia**: Multas + tributo omitido + intereses moratorios

SUNAT lo tiene clarísimo: _"Los gastos personales y de sustento del contribuyente y sus familiares NO son deducibles"_ (Art. 44 de la Ley del IR).

#### 7. No saben que pueden pedir DEVOLUCIÓN

Muchos contribuyentes pagan más impuestos de los que deben porque:

- Las retenciones acumuladas superan el impuesto real
- No aprovecharon las 3 UIT de deducciones adicionales
- No saben que SUNAT devuelve dinero (sí, **SUNAT te devuelve plata** si pagaste de más)

SUNAT incluso tiene "Devolución de Oficio" donde automáticamente devuelven si detectan que pagaste de más. Pero muchos casos requieren que el contribuyente lo solicite activamente.

#### 8. IGV: La gente no entiende qué es ni cómo funciona

- El **IGV (Impuesto General a las Ventas)** es del 18% (16% IGV + 2% IPM)
- Está incluido en TODAS las compras
- Para empresas es un crédito fiscal (lo descuentan)
- Para personas naturales NO es crédito fiscal pero sí puede ser gasto deducible en ciertos casos
- La gente no distingue entre el precio con IGV y sin IGV

---

## Contexto Tributario

### Estructura del Sistema Tributario Peruano

```
Sistema Tributario Nacional (D.Leg. 771)
├── Gobierno Central
│   ├── Impuesto a la Renta (IR)
│   │   ├── 1ra Categoría: 6.25% sobre renta neta (alquileres)
│   │   ├── 2da Categoría: 6.25% sobre renta neta (ganancias de capital)
│   │   ├── 4ta Categoría: Escalas progresivas 8%-30% (independientes)
│   │   ├── 5ta Categoría: Escalas progresivas 8%-30% (dependientes)
│   │   └── 3ra Categoría: 29.5% o escala MYPE (empresas)
│   ├── IGV: 18%
│   ├── ISC (Selectivo al Consumo)
│   ├── ITF (Impuesto a las Transacciones Financieras): 0.005%
│   └── Aranceles
├── Gobierno Local
│   ├── Impuesto Predial
│   ├── Impuesto de Alcabala
│   └── Impuesto Vehicular
└── Contribuciones
    ├── ESSALUD: 9%
    ├── ONP: 13%
    └── AFP (privadas): variable
```

### Tasas Progresivas para Rentas de Trabajo (4ta y 5ta)

| Tramo de Renta Neta        | Tasa |
| -------------------------- | ---- |
| Hasta 5 UIT                | 8%   |
| Más de 5 UIT hasta 20 UIT  | 14%  |
| Más de 20 UIT hasta 35 UIT | 17%  |
| Más de 35 UIT hasta 45 UIT | 20%  |
| Más de 45 UIT              | 30%  |

> **UIT 2025** = S/. 5,150

### Las 5 Deducciones Adicionales (Hasta 3 UIT = ~S/. 15,450)

| Gasto Deducible                                 | Requisito                                   | % Deducible      |
| ----------------------------------------------- | ------------------------------------------- | ---------------- |
| **Arrendamiento/subarrendamiento** de inmuebles | Comprobante electrónico                     | 30% del alquiler |
| **Hoteles y restaurantes**                      | Comprobante electrónico del establecimiento | 25% del gasto    |
| **Honorarios de médicos y odontólogos**         | Recibo por honorarios electrónico           | 30% del servicio |
| **Servicios profesionales** (4ta categoría)     | Recibo por honorarios electrónico           | 30% del servicio |
| **ESSALUD de trabajadores del hogar**           | Formulario de pago                          | 100% del aporte  |

### Regímenes Tributarios para Empresas/Negocios

| Régimen                   | Ingresos Máximos | Tasa IR                        | Contabilidad                  |
| ------------------------- | ---------------- | ------------------------------ | ----------------------------- |
| **NRUS** (Nuevo RUS)      | S/. 96,000/año   | Cuota fija S/.20-50/mes        | Ninguna                       |
| **RER** (Especial)        | S/. 525,000/año  | 1.5% mensual sobre ingresos    | Registros de compras y ventas |
| **RMT** (MYPE Tributario) | 1,700 UIT/año    | 10% hasta 15 UIT, 29.5% exceso | Simplificada o completa       |
| **Régimen General**       | Sin límite       | 29.5%                          | Completa                      |

---

## Feature Propuesta

### Nombre: **"Facets Tax AI"** (o "Asistente Tributario")

### Visión General

Convertir a Facets de un simple "tracker de gastos" a un **asesor tributario inteligente** que automáticamente:

1. **Clasifica** cada gasto del usuario según su potencial tributario
2. **Trackea** en tiempo real cuánto llevas deducido vs. el tope permitido
3. **Alerta** cuando un gasto es deducible y te falta el comprobante correcto
4. **Calcula** tu impuesto estimado mes a mes
5. **Recuerda** fechas de declaración según tu RUC
6. **Genera** un reporte pre-declaración para tu contador o para declarar vos mismo

### Módulos Propuestos

---

### Módulo 1: Perfil Tributario del Usuario

Al onboarding, el usuario configura su perfil tributario:

```
┌─────────────────────────────────────────┐
│  👋 Configurá tu perfil tributario       │
│                                          │
│  ¿Cómo generas ingresos?                │
│  ☑ Trabajo en planilla (5ta categoría)   │
│  ☑ Freelancer (4ta categoría)            │
│  ☐ Alquilo propiedades (1ra categoría)   │
│  ☐ Tengo un negocio (3ra categoría)      │
│  ☐ Invierto en bolsa (2da categoría)     │
│                                          │
│  RUC (opcional): [___________]           │
│  Último dígito: [_]                      │
│                                          │
│  → Con esto te armo tu calendario        │
│    tributario personalizado              │
└─────────────────────────────────────────┘
```

**Datos que capturamos**:

- Categorías de renta que aplican
- RUC (opcional, para cronograma)
- Régimen tributario (si tiene negocio)
- Si tiene trabajador del hogar
- Si alquila departamento

---

### Módulo 2: Clasificación Inteligente de Gastos (AI)

Cada vez que el usuario registra un gasto, la AI lo analiza:

**Ejemplo 1: Gasto deducible detectado**

```
Usuario registra: "Dentista Dra. García - S/. 350"
Categoría: Salud

┌─────────────────────────────────────────┐
│  🦷 ¡Este gasto es deducible!           │
│                                          │
│  Honorarios médicos/odontológicos        │
│  pueden deducirse hasta 30%.             │
│                                          │
│  Deducción estimada: S/. 105            │
│                                          │
│  ⚠️ Necesitás:                           │
│  → Recibo por Honorarios Electrónico     │
│  → Verificá que la Dra. emita RHE       │
│                                          │
│  📸 [Adjuntar comprobante]               │
│  ✅ [Ya lo tengo]  ❌ [No lo pedí]       │
└─────────────────────────────────────────┘
```

**Ejemplo 2: Gasto en restaurante**

```
Usuario registra: "Almuerzo La Mar - S/. 180"
Categoría: Restaurantes

┌─────────────────────────────────────────┐
│  🍽️ ¡Potencialmente deducible!          │
│                                          │
│  Consumo en restaurantes: deducible      │
│  al 25% con comprobante electrónico.     │
│                                          │
│  Deducción estimada: S/. 45             │
│                                          │
│  ⚠️ Requisitos:                          │
│  → Boleta o factura ELECTRÓNICA          │
│  → El restaurante debe emitir            │
│    comprobante electrónico               │
│                                          │
│  💡 Tip: Siempre pedí comprobante        │
│  electrónico, no ticket manual           │
│                                          │
│  Acumulado restaurantes 2025: S/. 2,340  │
│  Tope 3 UIT total: S/. 15,450          │
│  Disponible: S/. 13,110                │
└─────────────────────────────────────────┘
```

**Ejemplo 3: Gasto personal en contexto empresarial**

```
Usuario tiene perfil empresarial + personal
Registra: "Cena familiar cumpleaños - S/. 450"
Categoría: Restaurantes

┌─────────────────────────────────────────┐
│  ⚠️ Ojo con este gasto                  │
│                                          │
│  Detectamos que es un gasto PERSONAL.    │
│  Si tenés negocio, NO lo deduzcas        │
│  como gasto empresarial.                 │
│                                          │
│  ❌ NO pidas factura para tu empresa     │
│  ✅ Pedí boleta de venta a tu nombre     │
│                                          │
│  📌 SUNAT fiscaliza activamente          │
│  gastos personales en contabilidad       │
│  empresarial. Multa + tributo + interés  │
│                                          │
│  Sin embargo, SÍ es deducible como       │
│  persona natural (25% hasta 3 UIT)       │
└─────────────────────────────────────────┘
```

---

### Módulo 3: Dashboard Tributario en Tiempo Real

```
┌─────────────────────────────────────────────────┐
│  📊 Tu Resumen Tributario 2025                   │
│                                                   │
│  Ingresos Brutos Acumulados                       │
│  ├── 4ta categoría: S/. 48,000                   │
│  ├── 5ta categoría: S/. 62,400                   │
│  └── Total: S/. 110,400                          │
│                                                   │
│  Deducciones                                      │
│  ├── 20% de 4ta: -S/. 9,600 (automático)         │
│  ├── 7 UIT: -S/. 36,050 (automático)             │
│  └── 3 UIT adicionales: -S/. 8,730 de 15,450    │
│      ├── 🍽️ Restaurantes: S/. 2,340              │
│      ├── 🏠 Alquiler: S/. 4,800                  │
│      ├── 🦷 Dentista: S/. 1,050                  │
│      ├── 👩‍⚕️ Médico: S/. 540                     │
│      └── Disponible: S/. 6,720                   │
│                                                   │
│  Renta Neta Estimada: S/. 56,020                 │
│  Impuesto Estimado: S/. 6,453                    │
│  Retenciones acumuladas: -S/. 7,840              │
│                                                   │
│  💰 Saldo a FAVOR: S/. 1,387                    │
│  → ¡Podés pedir DEVOLUCIÓN!                      │
│                                                   │
│  [📋 Generar reporte para contador]               │
│  [📅 Ver cronograma de declaración]               │
└─────────────────────────────────────────────────┘
```

---

### Módulo 4: Calendario Tributario Personalizado

Basado en el último dígito del RUC del usuario:

```
┌─────────────────────────────────────────┐
│  📅 Tu Calendario Tributario 2025        │
│                                          │
│  RUC termina en: 3                       │
│                                          │
│  📌 Próximas fechas:                     │
│                                          │
│  Mar 2026 │ Declaración mensual Feb      │
│  15 Mar   │ ⚡ Vence para dígito 3       │
│                                          │
│  Jun 2026 │ Declaración Anual 2025       │
│  16 Jun   │ ⚡ Vence para dígito 3       │
│           │ (MYPE/Personas naturales)     │
│                                          │
│  🔔 Notificaciones activadas            │
│  → 7 días antes                          │
│  → 3 días antes                          │
│  → Día del vencimiento                   │
└─────────────────────────────────────────┘
```

---

### Módulo 5: Optimizador de Impuestos con AI

El corazón de la feature. La AI analiza los gastos del usuario y PROACTIVAMENTE sugiere cómo pagar menos (legalmente):

**Sugerencias Inteligentes que la AI puede dar:**

```
┌─────────────────────────────────────────┐
│  💡 Sugerencias para optimizar           │
│     tus impuestos (Noviembre 2025)       │
│                                          │
│  1. 🦷 Te faltan S/. 6,720 para llenar  │
│     tus 3 UIT de deducciones.            │
│     → ¿Tenés consultas médicas           │
│       pendientes? Agendalas antes        │
│       de diciembre.                      │
│                                          │
│  2. 📱 Notamos que pagás alquiler de     │
│     S/. 1,600/mes pero no lo estás       │
│     deduciendo. Si tu arrendador         │
│     emite comprobante electrónico,       │
│     podés deducir S/. 480/mes            │
│     (S/. 5,760/año).                     │
│                                          │
│  3. 💰 Con tus retenciones actuales      │
│     (S/. 7,840) y tu impuesto estimado   │
│     (S/. 6,453), tenés un saldo a        │
│     favor de S/. 1,387.                  │
│     → Configurá tu CCI para pedir        │
│       devolución automática.             │
│                                          │
│  4. 💼 Tus ingresos de 4ta categoría     │
│     son < S/. 43,313. Podrías pedir      │
│     SUSPENSIÓN de retenciones para       │
│     tener más liquidez mensual.          │
│                                          │
│  Ahorro estimado si seguís estos tips:   │
│  💰 S/. 3,420 este año                  │
└─────────────────────────────────────────┘
```

---

### Módulo 6: Scanner/Validador de Comprobantes

Integración con cámara para:

1. **Escanear** boletas/facturas electrónicas
2. **Validar** que el comprobante sea electrónico (tiene código QR o código de barras de SUNAT)
3. **Extraer** datos (monto, RUC emisor, fecha, tipo de comprobante)
4. **Clasificar** automáticamente si es deducible
5. **Almacenar** como respaldo para la declaración

```
┌─────────────────────────────────────────┐
│  📸 Escaneá tu comprobante               │
│                                          │
│  [Foto capturada]                        │
│                                          │
│  ✅ Comprobante electrónico válido       │
│  📋 Boleta de Venta B001-00042587       │
│  🏪 CEVICHERÍA LA MAR S.A.C.            │
│  🔢 RUC: 20601234567                    │
│  💰 Total: S/. 180.00                   │
│  📅 Fecha: 15/11/2025                   │
│                                          │
│  Categoría detectada: Restaurantes       │
│  Deducible: ✅ SÍ (25% = S/. 45)       │
│                                          │
│  [Guardar y vincular al gasto]           │
└─────────────────────────────────────────┘
```

---

### Módulo 7: Reporte Pre-Declaración

Genera un resumen listo para:

- Usar directamente en el Formulario Virtual 709 (personas) de SUNAT
- Enviar al contador con toda la info organizada
- Exportar como PDF/Excel

```
REPORTE PRE-DECLARACIÓN ANUAL 2025
===================================

DATOS DEL CONTRIBUYENTE
RUC: 10XXXXXXXX3
Nombre: Juan Pérez García
Categorías: 4ta + 5ta

RENTAS DE 4TA CATEGORÍA
Ingresos brutos: S/. 48,000.00
Deducción 20%: -S/. 9,600.00
Renta neta 4ta: S/. 38,400.00

RENTAS DE 5TA CATEGORÍA
Ingresos brutos: S/. 62,400.00

TOTAL RENTAS DE TRABAJO: S/. 100,800.00

DEDUCCIONES
7 UIT automáticas: -S/. 36,050.00
Deducciones adicionales (3 UIT):
  - Alquiler depto (12 meses): S/. 5,760.00
  - Restaurantes (23 comprobantes): S/. 2,340.00
  - Dentista (3 consultas): S/. 1,050.00
  - Médico (2 consultas): S/. 540.00
  Subtotal: -S/. 9,690.00

RENTA NETA IMPONIBLE: S/. 55,060.00

CÁLCULO DEL IMPUESTO
Hasta 5 UIT (S/. 25,750): 8% = S/. 2,060.00
De 5 a 20 UIT (S/. 29,310): 14% = S/. 4,103.40
Total impuesto: S/. 6,163.40

CRÉDITOS
Retenciones 4ta cat: -S/. 3,840.00
Retenciones 5ta cat: -S/. 4,000.00
Total retenciones: -S/. 7,840.00

RESULTADO: SALDO A FAVOR S/. 1,676.60
→ Solicitar devolución: SÍ
```

---

## Casos de Uso

### Caso 1: María - Empleada que alquila departamento

**Perfil**: Trabaja en planilla (5ta categoría), gana S/. 5,200/mes, paga alquiler de S/. 1,400/mes.

**Sin Facets Tax AI**:

- María nunca supo que su alquiler es deducible
- No pedía comprobante electrónico al arrendador
- Pagó S/. 2,800 de impuesto a la renta anual
- No pidió devolución

**Con Facets Tax AI**:

1. Al registrar "Alquiler departamento - S/. 1,400", Facets detecta que es deducible
2. Le avisa: _"Tu alquiler es deducible al 30%. Necesitás comprobante electrónico del arrendador"_
3. Acumula S/. 5,040 en deducciones solo por alquiler (12 × S/. 1,400 × 30%)
4. Más restaurantes y médico → llena casi las 3 UIT
5. Su impuesto baja a S/. 1,200 (ahorro de S/. 1,600)
6. Facets le avisa que tiene saldo a favor y le explica cómo pedir devolución

**Ahorro anual**: ~S/. 1,600

---

### Caso 2: Carlos - Freelancer Desarrollador

**Perfil**: Trabaja como independiente (4ta categoría), factura S/. 8,000/mes a 3 clientes.

**Sin Facets Tax AI**:

- Le retienen 8% por cada recibo (S/. 640/mes = S/. 7,680/año)
- No sabe que puede pedir suspensión de retenciones
- No aprovecha deducciones adicionales
- Impuesto real: S/. 5,900, pero le retuvieron S/. 7,680
- Saldo a favor de S/. 1,780 que NUNCA reclamó

**Con Facets Tax AI**:

1. Al configurar su perfil, Facets calcula que sus ingresos anuales (S/. 96,000) superan el límite para suspensión
2. Le trackea todas las retenciones automáticamente
3. Le sugiere gastos deducibles (coworking, consultas médicas, etc.)
4. En diciembre le muestra: _"Tus retenciones superan tu impuesto real en S/. 1,780. Pedí devolución."_
5. Le genera el reporte para llenar el Formulario 709

**Ahorro/recuperación anual**: ~S/. 1,780

---

### Caso 3: Rosa - Dueña de Tienda de Ropa (MYPE)

**Perfil**: Tiene una tienda en el Régimen MYPE Tributario, factura S/. 15,000/mes.

**Sin Facets Tax AI**:

- Mezcla gastos personales con los del negocio
- Pide factura cuando lleva a su familia a comer
- Su contador registra todo como gasto del negocio
- SUNAT la fiscaliza y le cae multa + tributo omitido

**Con Facets Tax AI**:

1. Rosa registra todos sus gastos en Facets
2. Cuando registra "Cena familiar - S/. 350", Facets la alerta: _"⚠️ Este es un gasto personal. NO pidas factura para tu negocio. Pedí boleta."_
3. Facets separa automáticamente gastos personales vs. empresariales
4. Le genera dos reportes: uno para su contador (solo gastos del negocio) y uno personal (con deducciones personales)
5. Le alerta sobre el IGV: _"Tu crédito fiscal de IGV este mes es S/. 2,700 (solo de compras del negocio)"_

**Valor**: Evita multas (que pueden ser de miles de soles) + optimiza deducciones personales

---

### Caso 4: Pedro - Empleado que invierte en bolsa

**Perfil**: Trabaja en planilla (5ta cat) y tiene inversiones en la BVL (2da cat).

**Con Facets Tax AI**:

1. Trackea sus ganancias/pérdidas de capital
2. Le explica que la ganancia de capital tributa al 6.25% sobre la renta neta
3. Le muestra que puede compensar pérdidas con ganancias
4. Le recuerda que las rentas de 2da categoría se declaran por separado de las de trabajo

---

## Análisis Competitivo

### Soluciones Existentes en Perú

| Solución                     | Qué hace                           | Limitaciones                                                         |
| ---------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| **SUNAT App**                | Consulta RUC, emisión comprobantes | No da recomendaciones, no trackea gastos, UX horrible                |
| **Contadores tradicionales** | Declaración anual                  | Caro (S/. 200-500/declaración), solo al final del año, no preventivo |
| **Excel manual**             | El usuario lleva su propia hoja    | Nadie lo mantiene, no sabe las reglas                                |
| **Contífico, Alegra**        | Software contable para empresas    | Para empresas/contadores, no para personas naturales                 |
| **Wally, Fintonic**          | Finance trackers genéricos         | No tienen módulo tributario, no conocen reglas de SUNAT              |

### Nuestra Ventaja Competitiva

**NO EXISTE** un finance tracker en Perú que:

1. ✅ Clasifique gastos tributariamente en tiempo real
2. ✅ Trackee deducciones vs. tope de 3 UIT
3. ✅ Alerte sobre comprobantes electrónicos
4. ✅ Calcule impuesto estimado mes a mes
5. ✅ Recuerde fechas de declaración personalizadas
6. ✅ Separe gastos personales vs. empresariales con AI
7. ✅ Genere reporte pre-declaración
8. ✅ Sugiera optimizaciones proactivamente

**El gap es ENORME.** Nadie está resolviendo esto de forma integrada para la persona común.

---

## Modelo de Monetización

### Integración con Pricing Actual de Facets

| Feature                                   | Free       | Plan Pro    | Plan Premium |
| ----------------------------------------- | ---------- | ----------- | ------------ |
| Clasificación básica de gastos deducibles | ✅         | ✅          | ✅           |
| Alerta de comprobante electrónico         | ✅ (3/mes) | ✅          | ✅           |
| Dashboard tributario básico               | ✅         | ✅          | ✅           |
| Deducciones tracker (3 UIT)               | ❌         | ✅          | ✅           |
| Calendario tributario personalizado       | ❌         | ✅          | ✅           |
| AI Optimizador de impuestos               | ❌         | ❌          | ✅           |
| Scanner de comprobantes                   | ❌         | ✅ (10/mes) | ✅ Ilimitado |
| Reporte pre-declaración                   | ❌         | ❌          | ✅           |
| Exportar para contador                    | ❌         | ❌          | ✅           |
| Múltiples categorías de renta             | ❌         | ✅          | ✅           |
| Separador personal/empresarial            | ❌         | ❌          | ✅           |

**Pricing sugerido (Perú)**:

- Free: S/. 0
- Pro: S/. 14.90/mes (~$4 USD)
- Premium: S/. 29.90/mes (~$8 USD)

**ROI para el usuario Premium**: Si ahorra mínimo S/. 1,500/año en impuestos, el plan se paga solo 4 veces.

---

## Consideraciones Legales

### IMPORTANTE - Disclaimer

1. **Facets NO es un asesor tributario certificado**. Toda la funcionalidad debe presentarse como "herramienta informativa y de seguimiento", no como asesoría profesional.

2. **Disclaimer obligatorio**: "La información proporcionada por Facets Tax AI es de carácter informativo y educativo. Para decisiones tributarias finales, consultá con un contador público colegiado."

3. **No nos conectamos a SUNAT**: No accedemos a la Clave SOL del usuario ni hacemos operaciones en su nombre. Solo generamos reportes que el usuario o su contador usan para declarar.

4. **Privacidad del RUC**: Si el usuario ingresa su RUC, se almacena encriptado y solo se usa para calcular cronogramas. Nunca se comparte.

5. **Actualización de reglas**: Las tasas, UIT, y reglas de deducción cambian cada año. Necesitamos un sistema de configuración que permita actualizar estas reglas sin deploy (feature flags o config remota).

### Regulaciones a Considerar

- **Ley de Protección de Datos Personales** (Ley 29733): Datos financieros y tributarios son datos sensibles en Perú.
- **Regulación de fintech**: Facets NO opera como entidad financiera, pero debemos asegurarnos de no cruzar la línea.
- **Código Tributario**: No podemos facilitar ni promover la evasión. Toda recomendación debe ser 100% legal (elusión ≠ evasión).

---

## Roadmap Técnico

### Fase 1: Fundación (MVP) — 4-6 semanas

**Objetivo**: Clasificación básica de gastos deducibles + dashboard

- [ ] Modelo de datos: `TaxProfile`, `TaxDeduction`, `TaxCalendar`
- [ ] Perfil tributario del usuario (categorías de renta, RUC)
- [ ] Reglas de deducción configurables (tabla de reglas por país/año)
- [ ] Clasificación básica: mapear categorías de gastos a tipos deducibles
- [ ] Dashboard tributario simple (acumulado de deducciones vs. tope)
- [ ] Notificación simple cuando un gasto es potencialmente deducible

### Fase 2: Inteligencia — 4-6 semanas

**Objetivo**: AI para clasificación avanzada + optimizaciones

- [ ] Integración con AI (OpenAI/Claude) para clasificación inteligente de gastos
- [ ] Detector de gastos personal vs. empresarial
- [ ] Calculadora de impuesto estimado en tiempo real
- [ ] Sugerencias proactivas de optimización ("te faltan X para llenar 3 UIT")
- [ ] Calendario tributario personalizado con notificaciones push

### Fase 3: Comprobantes — 3-4 semanas

**Objetivo**: Scanner y validación de comprobantes

- [ ] OCR para escanear comprobantes (cámara del celular)
- [ ] Detección de comprobante electrónico vs. manual
- [ ] Extracción de datos (monto, RUC, fecha, tipo)
- [ ] Vinculación automática con transacción registrada
- [ ] Almacenamiento seguro de imágenes de comprobantes

### Fase 4: Reportes — 2-3 semanas

**Objetivo**: Generación de reportes pre-declaración

- [ ] Reporte anual detallado con cálculo de impuesto
- [ ] Export PDF / Excel para contador
- [ ] Formato compatible con casillas del Formulario 709 (personas)
- [ ] Reporte separado personal vs. empresarial
- [ ] Historial de reportes por año fiscal

### Fase 5: Escalabilidad Multi-país — Ongoing

**Objetivo**: Adaptar las reglas a otros países

- [ ] Arquitectura de reglas tributarias configurable por país
- [ ] Colombia: DIAN, retención en la fuente, IVA
- [ ] México: SAT, CFDI, ISR, IVA
- [ ] Chile: SII, IVA, impuesto a la renta
- [ ] Argentina: AFIP, monotributo, ganancias

---

## Escalabilidad

### Arquitectura de Reglas Tributarias

Para escalar a otros países, las reglas tributarias deben ser **data-driven**, no hardcodeadas:

```typescript
// Ejemplo conceptual de cómo modelar reglas por país
interface TaxRule {
  country: 'PE' | 'CO' | 'MX' | 'CL' | 'AR';
  fiscalYear: number;
  ruleType: 'DEDUCTION' | 'TAX_RATE' | 'THRESHOLD' | 'DEADLINE';
  category: string;
  value: number;
  unit: 'PERCENTAGE' | 'FIXED' | 'UIT' | 'UVT' | 'UMA';
  maxAmount?: number;
  requirements: string[];
  metadata: Record<string, any>;
}

// Ejemplo: Regla de deducción de restaurantes en Perú
const restaurantDeductionPeru: TaxRule = {
  country: 'PE',
  fiscalYear: 2025,
  ruleType: 'DEDUCTION',
  category: 'RESTAURANTS',
  value: 25, // 25% del gasto
  unit: 'PERCENTAGE',
  maxAmount: 15450, // 3 UIT compartidas con otras deducciones
  requirements: ['ELECTRONIC_RECEIPT', 'REGISTERED_ESTABLISHMENT'],
  metadata: {
    sharedCap: '3_UIT_ADDITIONAL',
    uitValue: 5150,
  },
};
```

### Mapeo Rápido por País

| Concepto            | Perú                       | Colombia            | México            | Chile             | Argentina           |
| ------------------- | -------------------------- | ------------------- | ----------------- | ----------------- | ------------------- |
| Entidad tributaria  | SUNAT                      | DIAN                | SAT               | SII               | AFIP                |
| Unidad de medida    | UIT (S/.5,150)             | UVT ($47,065 COP)   | UMA ($108.57 MXN) | UTM ($66,362 CLP) | -                   |
| Impuesto al consumo | IGV 18%                    | IVA 19%             | IVA 16%           | IVA 19%           | IVA 21%             |
| Comprobante digital | Factura/Boleta electrónica | Factura electrónica | CFDI              | DTE               | Factura electrónica |
| Declaración anual   | Formulario 709/710         | Formulario 210/110  | Declaración anual | F22               | DDJJ Ganancias      |

### Qué se reutiliza entre países

1. **Dashboard tributario**: Misma UI, diferentes reglas
2. **Scanner de comprobantes**: OCR es agnóstico, solo cambia la validación
3. **Sistema de alertas**: Misma lógica, diferentes triggers
4. **Calendario**: Misma funcionalidad, diferentes fechas
5. **Motor de AI**: El modelo aprende reglas por país via configuración

---

## Conclusiones

### ¿Por qué esta feature es un game-changer?

1. **El mercado está vacío**: Nadie resuelve esto de forma integrada en LATAM
2. **El dolor es real y cuantificable**: La gente pierde dinero REAL por no aprovechar deducciones
3. **Ya tenemos los datos**: El usuario ya registra gastos en Facets, solo necesitamos analizarlos
4. **AI es el diferenciador**: La clasificación automática y las sugerencias proactivas son imposibles de hacer manualmente
5. **Monetización natural**: El usuario paga porque AHORRA más de lo que paga
6. **Escalable**: Las reglas tributarias cambian por país, pero la arquitectura es la misma
7. **Retención brutal**: Si Facets me ahorra S/. 1,500/año en impuestos, JAMÁS lo desinstalo

### Métricas de Éxito Propuestas

| Métrica                                  | Target Año 1                          |
| ---------------------------------------- | ------------------------------------- |
| Usuarios con perfil tributario           | 30% de usuarios activos               |
| Gastos clasificados como deducibles      | 15% de todas las transacciones        |
| Usuarios que generan reporte anual       | 10% de usuarios con perfil tributario |
| Ahorro promedio reportado por usuario    | > S/. 1,000/año                       |
| Conversión Free → Pro por tax feature    | 5%                                    |
| Conversión Pro → Premium por tax feature | 15%                                   |
| NPS del módulo tributario                | > 60                                  |

---

> **Nota**: Esta investigación está basada en la legislación tributaria peruana vigente a febrero 2026. Las tasas, UIT, y reglas de deducción deben actualizarse anualmente. Para la implementación, se recomienda consultar con un contador público colegiado peruano para validar todas las reglas antes del go-live.

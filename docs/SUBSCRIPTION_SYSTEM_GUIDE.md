# Sistema de Planes y Features - Guía Completa

> **Versión**: 1.0  
> **Fecha**: Febrero 2026  
> **Audiencia**: Desarrolladores del equipo Facets

---

## Tabla de Contenidos

1. [Conceptos Fundamentales](#conceptos-fundamentales)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Tipos de Features](#tipos-de-features)
4. [Cómo Funciona el Conteo de Uso](#cómo-funciona-el-conteo-de-uso)
5. [Implementar Limitaciones en Código](#implementar-limitaciones-en-código)
6. [Agregar Nuevas Features](#agregar-nuevas-features)
7. [Ejemplos Prácticos Completos](#ejemplos-prácticos-completos)
8. [FAQs](#faqs)

---

## Conceptos Fundamentales

### ¿Qué es un Plan?

Un **plan** es un nivel de suscripción que determina qué puede hacer un usuario en la aplicación. Facets tiene 3 planes:

| Plan        | Precio    | Target                             |
| ----------- | --------- | ---------------------------------- |
| **Free**    | $0/mes    | Nuevos usuarios que quieren probar |
| **Pro**     | $4.99/mes | Power users que necesitan más      |
| **Premium** | $9.99/mes | Usuarios que quieren TODO          |

### ¿Qué es una Feature?

Una **feature** es una funcionalidad o recurso que puede tener límites según el plan. Ejemplos:

- "Poder crear cuentas bancarias" (máximo 2 en Free, 10 en Pro, ilimitadas en Premium)
- "Poder crear transacciones" (máximo 100/mes en Free, 1000/mes en Pro)
- "Acceso a reportes avanzados" (No en Free, Sí en Pro y Premium)

### Modelo de Datos Simplificado

```
┌──────────┐      ┌──────────────┐      ┌──────────────┐
│   User   │──────│ Subscription │──────│     Plan     │
└──────────┘      └──────────────┘      └──────────────┘
                                               │
                                               │ tiene muchas
                                               ▼
                                        ┌──────────────┐
                                        │ PlanFeature  │
                                        └──────────────┘
                                        - featureCode: "accounts"
                                        - limitType: COUNT
                                        - limitValue: 2
                                        - featureType: RESOURCE
```

---

## Arquitectura del Sistema

### Tablas en la Base de Datos

```prisma
// El Plan (Free, Pro, Premium)
model Plan {
  id            String   @id
  code          String   @unique  // 'free', 'pro', 'premium'
  name          String             // "Free", "Pro", "Premium"
  priceMonthly  Decimal            // 0, 4.99, 9.99
  isDefault     Boolean            // true para 'free'
  sortOrder     Int                // 0, 1, 2 (para ordenar y comparar)

  planFeatures  PlanFeature[]      // Las features de este plan
}

// Qué plan tiene cada usuario
model Subscription {
  id      String @id
  userId  String @unique
  planId  String
  plan    Plan   @relation(...)
}

// Qué features tiene cada plan y con qué límites
model PlanFeature {
  planId      String
  featureCode String           // "accounts", "transactions_per_month"
  limitType   FeatureLimitType // BOOLEAN, COUNT, UNLIMITED
  limitValue  Int              // 0/1 para BOOLEAN, número para COUNT
  featureType FeatureType      // RESOURCE o CONSUMABLE
  limitPeriod LimitPeriod?     // MONTHLY, DAILY, etc. (solo CONSUMABLE)
}

// Registro de uso para features CONSUMABLE
model UsageRecord {
  userId      String
  featureCode String
  periodStart DateTime  // Inicio del mes/semana/día
  periodEnd   DateTime  // Fin del período
  count       Int       // Cuántas veces usó la feature
}
```

---

## Tipos de Features

Hay **3 tipos de límites** y **2 tipos de features**. Es CRÍTICO entender la diferencia:

### Tipos de Límites (limitType)

#### 1. `BOOLEAN` - On/Off

La feature está habilitada o no. No hay conteo.

```typescript
// Ejemplos:
{ featureCode: 'advanced_reports', limitType: 'BOOLEAN', limitValue: 0 } // Deshabilitado
{ featureCode: 'advanced_reports', limitType: 'BOOLEAN', limitValue: 1 } // Habilitado
```

**Pregunta que responde:** "¿Puede el usuario acceder a esta feature?"

#### 2. `COUNT` - Límite numérico

El usuario puede usar la feature hasta X veces.

```typescript
// Ejemplos:
{ featureCode: 'accounts', limitType: 'COUNT', limitValue: 2 }   // Máximo 2 cuentas
{ featureCode: 'goals', limitType: 'COUNT', limitValue: 5 }      // Máximo 5 metas
```

**Pregunta que responde:** "¿Cuántos puede tener/crear el usuario?"

#### 3. `UNLIMITED` - Sin límite

El usuario puede usar la feature sin restricciones.

```typescript
// Ejemplo:
{ featureCode: 'accounts', limitType: 'UNLIMITED', limitValue: -1 }
```

### Tipos de Features (featureType)

#### 1. `RESOURCE` - Recursos que se pueden eliminar

**Características:**

- Se cuenta desde la tabla real (ej: `prisma.account.count()`)
- Si el usuario elimina uno, puede crear otro
- NO usa la tabla `UsageRecord`

**Ejemplos:**

- Cuentas bancarias (`accounts`)
- Metas financieras (`goals`)
- Deudas (`debts`)
- Préstamos (`loans`)
- Categorías personalizadas (`custom_categories`)
- Pagos recurrentes (`recurring_payments`)

**Cómo se verifica:**

```typescript
// El sistema pregunta: "¿Cuántas cuentas tiene AHORA?"
const currentCount = await prisma.account.count({
  where: { userId, deletedAt: null },
});
// Si tiene 2 y el límite es 2, NO puede crear más
// Si elimina una y tiene 1, PUEDE crear otra
```

#### 2. `CONSUMABLE` - Recursos que se "gastan"

**Características:**

- Se cuenta desde la tabla `UsageRecord`
- El contador NO se restaura si eliminas el recurso
- Se resetea al inicio de cada período (mes, semana, día)
- Usa `limitPeriod` para definir cuándo se resetea

**Ejemplos:**

- Transacciones por mes (`transactions_per_month`)
- Exportaciones por mes (futuro)
- Llamadas a API de IA por mes (futuro)

**Cómo se verifica:**

```typescript
// El sistema pregunta: "¿Cuántas transacciones creó ESTE MES?"
const usageRecord = await prisma.usageRecord.findUnique({
  where: {
    userId_featureCode_periodStart: {
      userId,
      featureCode: 'transactions_per_month',
      periodStart,
    },
  },
});
const currentCount = usageRecord?.count ?? 0;
// Si creó 100 y el límite es 100, NO puede crear más
// Si elimina una transacción, el contador SIGUE en 100
// El 1ro del próximo mes, el contador vuelve a 0
```

### Tabla Comparativa

| Aspecto                | RESOURCE                         | CONSUMABLE           |
| ---------------------- | -------------------------------- | -------------------- |
| **Se cuenta desde**    | Tabla real (account, goal, etc.) | UsageRecord          |
| **Eliminar restaura?** | ✅ Sí                            | ❌ No                |
| **Se resetea?**        | ❌ No                            | ✅ Sí (por período)  |
| **Ejemplo**            | "Máx 5 cuentas"                  | "Máx 100 tx/mes"     |
| **limitPeriod**        | No aplica                        | MONTHLY, DAILY, etc. |

---

## Cómo Funciona el Conteo de Uso

### Para RESOURCE Features

El conteo es DIRECTO desde la tabla:

```typescript
// En tu AccountsService cuando el usuario quiere crear una cuenta:

async createAccount(userId: string, dto: CreateAccountDto) {
  // 1. Contar cuántas cuentas tiene AHORA
  const currentCount = await this.prisma.account.count({
    where: { userId, deletedAt: null }
  });

  // 2. Verificar si puede crear más
  const check = await this.subscriptionsService.checkFeatureAccess(
    userId,
    'accounts',
    currentCount  // <-- Pasamos el conteo actual
  );

  if (!check.allowed) {
    throw new ForbiddenException(`Has alcanzado el límite de ${check.limit} cuentas`);
  }

  // 3. Crear la cuenta
  return this.prisma.account.create({ data: { ...dto, userId } });
}
```

### Para CONSUMABLE Features

El conteo usa `UsageRecord` y hay que **incrementar después de crear**:

```typescript
// En tu TransactionsService cuando el usuario crea una transacción:

async createTransaction(userId: string, dto: CreateTransactionDto) {
  // 1. Verificar si puede crear más (el conteo viene de UsageRecord)
  const check = await this.subscriptionsService.checkFeatureAccess(
    userId,
    'transactions_per_month'
    // NO pasamos resourceCount porque es CONSUMABLE
  );

  if (!check.allowed) {
    throw new ForbiddenException(
      `Has alcanzado tu límite de ${check.limit} transacciones este mes`
    );
  }

  // 2. Crear la transacción
  const transaction = await this.prisma.transaction.create({
    data: { ...dto, userId }
  });

  // 3. IMPORTANTE: Incrementar el contador de uso
  await this.subscriptionsService.incrementUsage(
    userId,
    'transactions_per_month',
    LimitPeriod.MONTHLY
  );

  return transaction;
}
```

### ¿Por qué eliminar NO restaura CONSUMABLE?

Piénsalo así:

- **RESOURCE**: "Tu plan te permite TENER hasta 5 metas al mismo tiempo"
- **CONSUMABLE**: "Tu plan te permite CREAR hasta 100 transacciones por mes"

Si eliminas una transacción, ya la creaste. El acto de crearla es lo que se cuenta, no el hecho de que exista.

---

## Implementar Limitaciones en Código

### Opción 1: Usando el Guard + Decorator (Recomendado para BOOLEAN y CONSUMABLE)

```typescript
// accounts.controller.ts
import { RequireFeature } from '@common/decorators/feature.decorator';
import { FeatureGuard } from '@common/guards/feature.guard';
import { FEATURES } from '@modules/subscriptions/constants/features.constant';

@Controller('accounts')
@UseGuards(FeatureGuard) // Activa la verificación de features
export class AccountsController {
  // Verificar feature BOOLEAN
  @RequireFeature(FEATURES.ADVANCED_REPORTS)
  @Get('reports/advanced')
  async getAdvancedReports() {
    // Solo usuarios con advanced_reports = 1 pueden acceder
    return this.accountsService.getAdvancedReports();
  }

  // Para CONSUMABLE, el guard verifica automáticamente
  @RequireFeature(FEATURES.TRANSACTIONS_PER_MONTH)
  @Post('transactions')
  async createTransaction(@Body() dto: CreateTransactionDto) {
    // El guard ya verificó que no exceda el límite
    // Pero DEBES incrementar el uso en el service
    return this.transactionsService.create(dto);
  }
}
```

### Opción 2: Verificación Manual en el Service (Recomendado para RESOURCE)

```typescript
// accounts.service.ts
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async create(userId: string, dto: CreateAccountDto) {
    // 1. Contar recursos actuales
    const currentCount = await this.prisma.account.count({
      where: { userId, deletedAt: null },
    });

    // 2. Verificar acceso
    const check = await this.subscriptionsService.checkFeatureAccess(
      userId,
      FEATURES.ACCOUNTS,
      currentCount,
    );

    if (!check.allowed) {
      throw new BusinessException(
        ERROR_CODES.FEATURE_LIMIT_EXCEEDED,
        `Has alcanzado el límite de ${check.limit} cuentas. ` +
          `Actualmente tienes ${check.current}. Actualiza tu plan para más.`,
        HttpStatus.FORBIDDEN,
      );
    }

    // 3. Crear el recurso
    return this.prisma.account.create({
      data: { ...dto, userId },
    });
  }
}
```

### El FeatureGuard Explicado

```typescript
// src/common/guards/feature.guard.ts

@Injectable()
export class FeatureGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Obtener el feature requerido del decorator
    const featureOptions = this.reflector.get<RequireFeatureOptions>(
      FEATURE_KEY,
      context.getHandler(),
    );

    // Si no hay decorator, dejar pasar
    if (!featureOptions) return true;

    // 2. Obtener el usuario del request
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;

    // 3. Obtener la feature del plan del usuario
    const planFeature = await this.subscriptionsService.getFeatureLimit(
      userId,
      featureOptions.feature,
    );

    // 4. Verificar según el tipo de límite
    switch (planFeature.limitType) {
      case 'UNLIMITED':
        return true; // Siempre permitir

      case 'BOOLEAN':
        if (planFeature.limitValue !== 1) {
          throw new ForbiddenException('Feature no disponible en tu plan');
        }
        return true;

      case 'COUNT':
        // Para CONSUMABLE, verificar usage
        if (planFeature.featureType === 'CONSUMABLE') {
          const check = await this.subscriptionsService.checkFeatureAccess(
            userId,
            featureOptions.feature,
          );
          if (!check.allowed) {
            throw new ForbiddenException('Límite excedido');
          }
        }
        // Para RESOURCE, dejar que el service haga la verificación
        return true;
    }
  }
}
```

---

## Agregar Nuevas Features

### Paso 1: Agregar al Constant

```typescript
// src/modules/subscriptions/constants/features.constant.ts

export const FEATURES = {
  // ... features existentes ...

  // Nueva feature RESOURCE
  BUDGETS: 'budgets',

  // Nueva feature CONSUMABLE
  AI_QUERIES_PER_MONTH: 'ai_queries_per_month',

  // Nueva feature BOOLEAN
  DARK_MODE: 'dark_mode',
} as const;
```

### Paso 2: Agregar al Seed

```typescript
// prisma/seed.ts

const features: Record<string, FeatureSeedData[]> = {
  free: [
    // ... existentes ...

    // Nueva RESOURCE: máximo 1 budget
    {
      featureCode: 'budgets',
      limitType: FeatureLimitType.COUNT,
      limitValue: 1,
      featureType: FeatureType.RESOURCE,
    },

    // Nueva CONSUMABLE: máximo 5 consultas IA por mes
    {
      featureCode: 'ai_queries_per_month',
      limitType: FeatureLimitType.COUNT,
      limitValue: 5,
      featureType: FeatureType.CONSUMABLE,
      limitPeriod: LimitPeriod.MONTHLY,
    },

    // Nueva BOOLEAN: sin dark mode
    {
      featureCode: 'dark_mode',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 0, // Deshabilitado
    },
  ],

  pro: [
    // ... existentes ...

    // Pro tiene más budgets
    {
      featureCode: 'budgets',
      limitType: FeatureLimitType.COUNT,
      limitValue: 10,
      featureType: FeatureType.RESOURCE,
    },

    // Pro tiene más consultas IA
    {
      featureCode: 'ai_queries_per_month',
      limitType: FeatureLimitType.COUNT,
      limitValue: 50,
      featureType: FeatureType.CONSUMABLE,
      limitPeriod: LimitPeriod.MONTHLY,
    },

    // Pro tiene dark mode
    {
      featureCode: 'dark_mode',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1, // Habilitado
    },
  ],

  premium: [
    // Premium tiene todo ilimitado/habilitado
    {
      featureCode: 'budgets',
      limitType: FeatureLimitType.UNLIMITED,
      limitValue: -1,
    },
    {
      featureCode: 'ai_queries_per_month',
      limitType: FeatureLimitType.UNLIMITED,
      limitValue: -1,
    },
    {
      featureCode: 'dark_mode',
      limitType: FeatureLimitType.BOOLEAN,
      limitValue: 1,
    },
  ],
};
```

### Paso 3: Ejecutar el Seed

```bash
pnpm prisma db seed
```

### Paso 4: Usar en tu Código

```typescript
// budgets.service.ts (RESOURCE)
async createBudget(userId: string, dto: CreateBudgetDto) {
  const currentCount = await this.prisma.budget.count({
    where: { userId, deletedAt: null }
  });

  const check = await this.subscriptionsService.checkFeatureAccess(
    userId,
    FEATURES.BUDGETS,
    currentCount
  );

  if (!check.allowed) {
    throw new ForbiddenException(`Límite de ${check.limit} presupuestos alcanzado`);
  }

  return this.prisma.budget.create({ data: { ...dto, userId } });
}

// ai.service.ts (CONSUMABLE)
async queryAI(userId: string, query: string) {
  const check = await this.subscriptionsService.checkFeatureAccess(
    userId,
    FEATURES.AI_QUERIES_PER_MONTH
  );

  if (!check.allowed) {
    throw new ForbiddenException(
      `Has usado ${check.current}/${check.limit} consultas IA este mes`
    );
  }

  const result = await this.openai.query(query);

  // IMPORTANTE: Incrementar uso DESPUÉS de usar
  await this.subscriptionsService.incrementUsage(
    userId,
    FEATURES.AI_QUERIES_PER_MONTH,
    LimitPeriod.MONTHLY
  );

  return result;
}

// settings.controller.ts (BOOLEAN)
@RequireFeature(FEATURES.DARK_MODE)
@Post('dark-mode')
async enableDarkMode() {
  // Solo accesible si dark_mode = 1 en el plan
}
```

---

## Ejemplos Prácticos Completos

### Ejemplo 1: Módulo de Cuentas Bancarias (RESOURCE)

```typescript
// src/modules/accounts/accounts.service.ts

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Crear una nueva cuenta bancaria
   * RESOURCE Feature: El límite se basa en cuántas cuentas EXISTEN
   */
  async create(userId: string, dto: CreateAccountDto): Promise<Account> {
    // Paso 1: Contar cuentas actuales
    const currentCount = await this.prisma.account.count({
      where: {
        userId,
        deletedAt: null, // Solo cuentas activas
      },
    });

    // Paso 2: Verificar límite del plan
    const check = await this.subscriptionsService.checkFeatureAccess(
      userId,
      FEATURES.ACCOUNTS,
      currentCount, // <-- Importante: pasar el conteo actual
    );

    // Paso 3: Lanzar error si excede límite
    if (!check.allowed) {
      throw new BusinessException(
        ERROR_CODES.FEATURE_LIMIT_EXCEEDED,
        `Tu plan permite máximo ${check.limit} cuentas. ` +
          `Actualmente tienes ${check.current}. ` +
          `Elimina una cuenta o actualiza tu plan.`,
        HttpStatus.FORBIDDEN,
      );
    }

    // Paso 4: Crear la cuenta
    return this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        balance: dto.initialBalance ?? 0,
      },
    });
  }

  /**
   * Eliminar una cuenta
   * Al eliminar, el usuario puede crear otra (RESOURCE se libera)
   */
  async delete(userId: string, accountId: string): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId, userId },
      data: { deletedAt: new Date() },
    });

    // NO necesitamos hacer nada con subscriptions
    // La próxima vez que intente crear, el count será menor
  }
}
```

### Ejemplo 2: Módulo de Transacciones (CONSUMABLE)

```typescript
// src/modules/transactions/transactions.service.ts

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Crear una nueva transacción
   * CONSUMABLE Feature: El límite se basa en cuántas se CREARON este mes
   */
  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    // Paso 1: Verificar límite (NO pasamos resourceCount)
    const check = await this.subscriptionsService.checkFeatureAccess(
      userId,
      FEATURES.TRANSACTIONS_PER_MONTH,
      // No pasamos nada porque es CONSUMABLE - se lee de UsageRecord
    );

    // Paso 2: Lanzar error si excede límite
    if (!check.allowed) {
      throw new BusinessException(
        ERROR_CODES.FEATURE_LIMIT_EXCEEDED,
        `Has creado ${check.current} de ${check.limit} transacciones este mes. ` +
          `El contador se reinicia el 1ro del próximo mes. ` +
          `Actualiza tu plan para más transacciones.`,
        HttpStatus.FORBIDDEN,
      );
    }

    // Paso 3: Crear la transacción
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        type: dto.type,
        description: dto.description,
        date: dto.date,
      },
    });

    // Paso 4: CRÍTICO - Incrementar el contador de uso
    await this.subscriptionsService.incrementUsage(
      userId,
      FEATURES.TRANSACTIONS_PER_MONTH,
      LimitPeriod.MONTHLY,
    );

    return transaction;
  }

  /**
   * Eliminar una transacción
   * El contador NO se decrementa (CONSUMABLE = ya se "gastó")
   */
  async delete(userId: string, transactionId: string): Promise<void> {
    await this.prisma.transaction.delete({
      where: { id: transactionId, userId },
    });

    // NO decrementamos el uso
    // Si creó 50 transacciones y elimina 10, sigue en 50/100
  }

  /**
   * Crear múltiples transacciones (importación)
   */
  async createBulk(
    userId: string,
    transactions: CreateTransactionDto[],
  ): Promise<Transaction[]> {
    const count = transactions.length;

    // Verificar si puede crear TODAS
    const check = await this.subscriptionsService.checkFeatureAccess(
      userId,
      FEATURES.TRANSACTIONS_PER_MONTH,
    );

    const remaining = check.limit - check.current;

    if (count > remaining) {
      throw new BusinessException(
        ERROR_CODES.FEATURE_LIMIT_EXCEEDED,
        `Intentas importar ${count} transacciones pero solo te quedan ${remaining} ` +
          `de tu límite mensual de ${check.limit}.`,
        HttpStatus.FORBIDDEN,
      );
    }

    // Crear todas
    const created = await this.prisma.$transaction(
      transactions.map((dto) =>
        this.prisma.transaction.create({
          data: { ...dto, userId },
        }),
      ),
    );

    // Incrementar uso por la cantidad creada
    await this.subscriptionsService.incrementUsage(
      userId,
      FEATURES.TRANSACTIONS_PER_MONTH,
      LimitPeriod.MONTHLY,
      count, // <-- Incrementar por la cantidad, no por 1
    );

    return created;
  }
}
```

### Ejemplo 3: Feature con Acceso Booleano

```typescript
// src/modules/reports/reports.controller.ts

@Controller('reports')
@UseGuards(JwtAuthGuard, FeatureGuard)
export class ReportsController {
  // Cualquiera puede ver reportes básicos
  @Get('basic')
  async getBasicReport(@CurrentUser() user: JwtPayload) {
    return this.reportsService.getBasicReport(user.sub);
  }

  // Solo Pro y Premium pueden ver reportes avanzados
  @RequireFeature(FEATURES.ADVANCED_REPORTS)
  @Get('advanced')
  async getAdvancedReport(@CurrentUser() user: JwtPayload) {
    // Si el usuario es Free, nunca llega aquí
    // El FeatureGuard lanza 403 Forbidden
    return this.reportsService.getAdvancedReport(user.sub);
  }

  // Solo Premium puede ver insights de IA
  @RequireFeature(FEATURES.AI_INSIGHTS)
  @Get('ai-insights')
  async getAIInsights(@CurrentUser() user: JwtPayload) {
    return this.reportsService.getAIInsights(user.sub);
  }
}
```

---

## FAQs

### ¿Por qué necesito dos tipos de features (RESOURCE vs CONSUMABLE)?

Porque el negocio las trata diferente:

- **RESOURCE**: "Tu plan te permite TENER hasta X al mismo tiempo"
  - Si eliminas uno, puedes crear otro
  - Ejemplo: "2 cuentas bancarias" - si cierras una, puedes abrir otra
- **CONSUMABLE**: "Tu plan te permite HACER hasta X por período"
  - Una vez hecho, está hecho
  - Ejemplo: "100 transacciones/mes" - si eliminas una, ya la creaste

### ¿Qué pasa si el usuario hace downgrade y tiene más recursos que el nuevo límite?

El sistema usa **Soft Limit + Grace Period**:

1. Los recursos existentes NO se eliminan
2. El usuario NO puede crear nuevos
3. Se le da un período de gracia (7 días) para reducir manualmente

```typescript
// Cuando el usuario intenta crear con soft limit activo:
if (check.reason === 'FEATURE_LIMIT_EXCEEDED') {
  throw new ForbiddenException(
    'Has superado el límite de tu plan actual. ' +
      'Por favor elimina algunos recursos o actualiza tu plan.',
  );
}
```

### ¿Cómo sé si usar el Guard o la verificación manual?

| Situación                   | Usar                                              |
| --------------------------- | ------------------------------------------------- |
| Feature BOOLEAN simple      | `@RequireFeature` decorator                       |
| Feature CONSUMABLE          | `@RequireFeature` + `incrementUsage()` en service |
| Feature RESOURCE            | Verificación manual en service                    |
| Lógica condicional compleja | Verificación manual                               |

### ¿El contador de CONSUMABLE se resetea automáticamente?

Sí, por diseño. El `UsageRepository` usa fechas de período:

```typescript
// Cuando pedimos el uso actual:
const { periodStart, periodEnd } = this.getCurrentPeriod(LimitPeriod.MONTHLY);

// periodStart = 1 de febrero 2026 00:00:00
// periodEnd = 28 de febrero 2026 23:59:59

// El 1 de marzo, periodStart cambia y no encuentra el registro anterior
// Por lo tanto, el conteo vuelve a 0
```

### ¿Puedo tener una feature que sea tanto RESOURCE como CONSUMABLE?

No directamente, pero puedes crear dos features separadas:

```typescript
// Límite de cuántos pueden existir
{ featureCode: 'active_exports', limitType: 'COUNT', featureType: 'RESOURCE' }

// Límite de cuántos se pueden crear por mes
{ featureCode: 'exports_per_month', limitType: 'COUNT', featureType: 'CONSUMABLE' }
```

---

## Resumen Visual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE VERIFICACIÓN DE FEATURE                     │
└─────────────────────────────────────────────────────────────────────────────┘

Usuario quiere crear un recurso
           │
           ▼
    ┌──────────────┐
    │ ¿Qué tipo de │
    │   feature?   │
    └──────────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────────┐
│ BOOLEAN │ │    COUNT    │
└─────────┘ └─────────────┘
     │            │
     ▼      ┌─────┴─────┐
¿limitValue │           │
   = 1?     ▼           ▼
     │  ┌────────┐ ┌────────────┐
     │  │RESOURCE│ │CONSUMABLE  │
     │  └────────┘ └────────────┘
     │       │           │
     │       ▼           ▼
     │  Contar de    Contar de
     │  tabla real   UsageRecord
     │       │           │
     │       └─────┬─────┘
     │             │
     ▼             ▼
┌─────────────────────────────┐
│   ¿current < limit?         │
│                             │
│   Sí → Permitir creación    │
│   No → Lanzar 403 Forbidden │
└─────────────────────────────┘
           │
           │ (Si es CONSUMABLE y se permitió)
           ▼
    ┌──────────────┐
    │ Incrementar  │
    │ UsageRecord  │
    └──────────────┘
```

---

**Siguiente documento:** Ver [PERFORMANCE_ANALYSIS.md](./PERFORMANCE_ANALYSIS.md) para entender por qué algunos endpoints son lentos y cómo optimizarlos.

# Authentication & Subscription Plans - Design Document

> **Status**: Implemented (95%+ Complete)  
> **Version**: 1.0  
> **Date**: February 2026
> **Last Audit**: February 4, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Scope](#scope)
3. [Implementation Phases](#implementation-phases)
   - [Phase 1: Core Authentication](#phase-1-core-authentication)
   - [Phase 2: Email Verification & Password Recovery](#phase-2-email-verification--password-recovery)
   - [Phase 3: Subscription System & Feature Access](#phase-3-subscription-system--feature-access)
   - [Phase 4: Plan Management (Upgrade/Downgrade)](#phase-4-plan-management-upgradedowngrade)
4. [Security](#security)
5. [API Reference](#api-reference)
6. [Directory Structure](#directory-structure)

---

## Executive Summary

Sistema completo de autenticación y suscripciones para Facets:

| Componente  | Descripción                                                              |
| ----------- | ------------------------------------------------------------------------ |
| **Auth**    | Registro/login con JWT, verificación de email via OTP, password recovery |
| **Tokens**  | Access token (1h) + Refresh token (7d) con rotación                      |
| **Planes**  | Free, Pro ($4.99), Premium ($9.99)                                       |
| **Límites** | RESOURCE (cuentan de tabla real) vs CONSUMABLE (cuentan de UsageRecord)  |

### Decisiones Clave

| Decisión         | Valor                         | Razón                      |
| ---------------- | ----------------------------- | -------------------------- |
| OTP              | 6 dígitos, 10 min, 5 intentos | Estándar de la industria   |
| Access Token     | 1 hora                        | Balance UX móvil           |
| Refresh Token    | 7 días, rotación              | Seguridad + conveniencia   |
| Upgrade          | Inmediato                     | Usuario paga más           |
| Downgrade        | Fin del período               | Usuario ya pagó            |
| Overage Strategy | Soft Limit + Grace Period     | Proteger datos financieros |

---

## Scope

### In Scope

- Registro/login con email y password
- Verificación de email via OTP
- Password reset via OTP
- JWT access + refresh tokens con rotación
- Planes de suscripción (Free, Pro, Premium)
- Control de acceso por features
- Tracking de uso y enforcement de límites
- Upgrade/downgrade/cancel de planes

### Out of Scope (Futuro)

- Social login (Google, Apple)
- Two-factor authentication
- Payment processing (Stripe)
- Admin panel

---

## Implementation Phases

---

## Phase 1: Core Authentication

### Objetivo

Implementar registro, login, manejo de tokens JWT con rotación, y logout.

### Database Schema

```prisma
model User {
  id              String       @id @default(cuid(2))
  email           String       @unique
  password        String       // bcrypt hashed
  firstName       String
  lastName        String
  emailVerified   Boolean      @default(false)
  emailVerifiedAt DateTime?
  status          UserStatus   @default(PENDING_VERIFICATION)

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  deletedAt       DateTime?

  refreshTokens   RefreshToken[]

  @@index([email])
  @@index([status])
  @@map("users")
}

enum UserStatus {
  PENDING_VERIFICATION
  ACTIVE
  SUSPENDED
  DELETED
}

model RefreshToken {
  id        String    @id @default(cuid(2))
  token     String    @unique // hashed
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userAgent String?
  ipAddress String?
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("refresh_tokens")
}
```

### Flujos

**Registration:**

1. Usuario envía `POST /auth/register` con email, password, firstName, lastName
2. Validar email único, hashear password (bcrypt, 12 rounds)
3. Crear User con `status=PENDING_VERIFICATION`
4. Responder con mensaje de verificación (OTP se envía en Phase 2)

**Login:**

1. Usuario envía `POST /auth/login` con email y password
2. Buscar usuario, verificar password con bcrypt
3. Validar `status=ACTIVE` (no PENDING, SUSPENDED, DELETED)
4. Generar access token (1h) y refresh token (7d)
5. Guardar refresh token hasheado en DB
6. Responder con tokens y datos de usuario

**Token Refresh (con Rotación):**

1. Usuario envía `POST /auth/refresh` con refreshToken
2. Buscar token por hash, validar no expirado/revocado
3. **Revocar el token usado** (single-use)
4. Generar nuevos access + refresh tokens
5. Guardar nuevo refresh token

**Beneficios de rotación:**

- Si roban un token, solo funciona una vez
- Usuario legítimo detecta el robo cuando su token falla

**Logout:**

- `POST /auth/logout` - Revoca refresh token específico
- `POST /auth/logout-all` - Revoca TODOS los refresh tokens del usuario

### Endpoints

| Method | Endpoint           | Auth   | Descripción        |
| ------ | ------------------ | ------ | ------------------ |
| POST   | `/auth/register`   | Public | Registrar usuario  |
| POST   | `/auth/login`      | Public | Login              |
| POST   | `/auth/refresh`    | Public | Refrescar tokens   |
| POST   | `/auth/logout`     | JWT    | Logout             |
| POST   | `/auth/logout-all` | JWT    | Logout all devices |
| GET    | `/auth/me`         | JWT    | Usuario actual     |

### Checklist

**DB:**

- [x] User model (email, password, status, emailVerified, emailVerifiedAt, firstName, lastName)
- [x] RefreshToken model
- [x] Migration

**Auth Module:**

- [x] JWT Strategy (access tokens)
- [x] JWT Refresh Strategy (refresh tokens)
- [x] AuthService (register, login, refresh, logout, logoutAll)
- [x] AuthController

**Users Module:**

- [x] UsersRepository
- [x] UsersService

**Tests:**

- [x] Unit tests AuthService
- [ ] E2E tests: register, login, refresh, logout

---

## Phase 2: Email Verification & Password Recovery

### Objetivo

Implementar verificación de email via OTP y flujo de password recovery.

### Database Schema (adicional)

```prisma
model OtpCode {
  id          String   @id @default(cuid(2))
  code        String   // 6 dígitos
  type        OtpType
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  attempts    Int      @default(0)
  maxAttempts Int      @default(5)
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([userId, type, usedAt, expiresAt])
  @@index([expiresAt])
  @@map("otp_codes")
}

enum OtpType {
  EMAIL_VERIFICATION
  PASSWORD_RESET
}

// Agregar relación en User:
// otpCodes OtpCode[]
```

### Configuración OTP

| Parámetro    | Valor       |
| ------------ | ----------- |
| Longitud     | 6 dígitos   |
| Expiración   | 10 minutos  |
| Max intentos | 5           |
| Cooldown     | 60 segundos |
| Rate limit   | 5 OTPs/hora |

### Flujos

**Email Verification:**

1. Usuario envía `POST /auth/verify-email` con email y código OTP
2. Validar: código correcto, no expirado, no usado, intentos < 5
3. Si inválido: incrementar intentos
4. Si válido: marcar OTP usado, User `status=ACTIVE`, `emailVerified=true`
5. Generar tokens y auto-login

**Resend Verification:**

1. `POST /auth/resend-verification` con email
2. Check cooldown (60s desde último OTP)
3. Check rate limit (5 por hora)
4. Invalidar OTPs anteriores del mismo tipo
5. Generar nuevo OTP y enviar email

**Password Recovery:**

1. `POST /auth/forgot-password` - Genera OTP tipo PASSWORD_RESET (siempre responder success para evitar email enumeration)
2. `POST /auth/verify-reset-code` - Valida OTP, retorna token temporal (5 min)
3. `POST /auth/reset-password` - Valida token/OTP, actualiza password, revoca TODOS los refresh tokens

**Actualizar Registration (Phase 1):**

- Después de crear usuario, generar OTP y enviar email de verificación
- Asignar plan FREE automáticamente (requiere Phase 3)

### Endpoints

| Method | Endpoint                    | Auth   | Descripción             |
| ------ | --------------------------- | ------ | ----------------------- |
| POST   | `/auth/verify-email`        | Public | Verificar email con OTP |
| POST   | `/auth/resend-verification` | Public | Reenviar OTP            |
| POST   | `/auth/forgot-password`     | Public | Solicitar reset         |
| POST   | `/auth/verify-reset-code`   | Public | Verificar código reset  |
| POST   | `/auth/reset-password`      | Public | Cambiar password        |

### Checklist

**DB:**

- [x] OtpCode model
- [x] Migration

**OTP Module:**

- [x] OtpRepository
- [x] OtpService (generate, verify, invalidate, checkRateLimit, checkCooldown)

**Email Module:**

- [x] EmailService (interface + stub implementation)
- [x] Templates: EMAIL_VERIFICATION, PASSWORD_RESET

**Auth Updates:**

- [x] verify-email endpoint (auto-login después de verificar)
- [x] resend-verification endpoint
- [x] forgot-password endpoint
- [x] verify-reset-code endpoint
- [x] reset-password endpoint (invalidar todas las sesiones)
- [x] Actualizar register para enviar OTP
- [x] Actualizar login para verificar status=ACTIVE

**Tests:**

- [x] Unit tests OtpService
- [ ] E2E tests: verify-email, resend, forgot-password, reset-password

---

## Phase 3: Subscription System & Feature Access

### Objetivo

Implementar planes de suscripción, asignación automática del plan FREE, control de acceso por features, y tracking de uso.

### Database Schema (adicional)

```prisma
model Plan {
  id            String   @id @default(cuid(2))
  code          String   @unique // 'free', 'pro', 'premium'
  name          String
  description   String?
  priceMonthly  Decimal  @db.Decimal(10, 2)
  priceCurrency String   @default("USD") @db.VarChar(3)
  priceYearly   Decimal? @db.Decimal(10, 2)
  isActive      Boolean  @default(true)
  isDefault     Boolean  @default(false)
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  subscriptions  Subscription[]
  planFeatures   PlanFeature[]

  @@index([code])
  @@index([isActive, sortOrder])
  @@map("plans")
}

model Subscription {
  id                 String             @id @default(cuid(2))
  userId             String             @unique
  user               User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  planId             String
  plan               Plan               @relation(fields: [planId], references: [id])
  status             SubscriptionStatus @default(ACTIVE)
  currentPeriodStart DateTime           @default(now())
  currentPeriodEnd   DateTime?          // null for free plan

  // Trial
  trialStart DateTime?
  trialEnd   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([planId])
  @@index([status])
  @@map("subscriptions")
}

enum SubscriptionStatus {
  ACTIVE
  TRIALING
  PAST_DUE
  CANCELLED
  EXPIRED
}

model PlanFeature {
  id          String           @id @default(cuid(2))
  planId      String
  plan        Plan             @relation(fields: [planId], references: [id], onDelete: Cascade)
  featureCode String
  limitType   FeatureLimitType @default(BOOLEAN)
  limitValue  Int              @default(1)
  limitPeriod LimitPeriod?
  featureType FeatureType      @default(RESOURCE)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@unique([planId, featureCode])
  @@index([featureCode])
  @@map("plan_features")
}

enum FeatureLimitType {
  BOOLEAN   // on/off
  COUNT     // numeric limit
  UNLIMITED // sin límite
}

enum FeatureType {
  RESOURCE   // Count from actual table (accounts, goals) - deletable
  CONSUMABLE // Count from UsageRecord (transactions) - period-based
}

enum LimitPeriod {
  DAILY
  WEEKLY
  MONTHLY
  YEARLY
}

model UsageRecord {
  id          String      @id @default(cuid(2))
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  featureCode String
  periodType  LimitPeriod
  periodStart DateTime
  periodEnd   DateTime
  count       Int         @default(0)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@unique([userId, featureCode, periodStart])
  @@index([userId, featureCode])
  @@index([periodEnd])
  @@map("usage_records")
}

// Agregar relaciones en User:
// subscription   Subscription?
// usageRecords   UsageRecord[]
```

### Planes

| Plan    | Código    | Precio    | Target          |
| ------- | --------- | --------- | --------------- |
| Free    | `free`    | $0        | Nuevos usuarios |
| Pro     | `pro`     | $4.99/mes | Power users     |
| Premium | `premium` | $9.99/mes | Business        |

### Feature Matrix

| Feature            | Free | Pro   | Premium         |
| ------------------ | ---- | ----- | --------------- |
| Accounts           | 2    | 10    | Unlimited       |
| Transactions/month | 100  | 1,000 | Unlimited       |
| Custom Categories  | 5    | 20    | Unlimited       |
| Goals              | 1    | 5     | Unlimited       |
| Debts              | 2    | 10    | Unlimited       |
| Loans              | 1    | 5     | Unlimited       |
| Recurring Payments | 3    | 20    | Unlimited       |
| Advanced Reports   | No   | Yes   | Yes             |
| Export Data        | No   | CSV   | CSV, PDF, Excel |
| Multi-Currency     | No   | No    | Yes             |
| Budget Alerts      | No   | Yes   | Yes             |
| AI Insights        | No   | No    | Yes             |

### Tipos de Límites

**RESOURCE (cuentan de tabla real):**

- Ejemplos: accounts, goals, debts, loans, custom_categories, recurring_payments
- Si usuario elimina un recurso, puede crear otro
- Query: `prisma.account.count({ where: { userId, deletedAt: null } })`

**CONSUMABLE (cuentan de UsageRecord):**

- Ejemplos: transactions_per_month
- Se resetea cada período
- Eliminar el recurso NO restaura el contador
- Query: `prisma.usageRecord.findUnique(...)`

### Control de Acceso

```typescript
// Decorator en controller
@RequireFeature(FEATURES.ACCOUNTS)
@Post()
createAccount(@Body() dto: CreateAccountDto) { ... }

// Guard verifica:
// 1. Tipo de límite (BOOLEAN, COUNT, UNLIMITED)
// 2. Para COUNT: tipo de feature (RESOURCE vs CONSUMABLE)
// 3. Retorna { allowed, reason, current, limit }
```

### Seed Data

```typescript
// prisma/seed.ts
const plans = [
  {
    code: 'free',
    name: 'Free',
    priceMonthly: 0,
    isDefault: true,
    sortOrder: 0,
  },
  { code: 'pro', name: 'Pro', priceMonthly: 4.99, sortOrder: 1 },
  { code: 'premium', name: 'Premium', priceMonthly: 9.99, sortOrder: 2 },
];

const features = {
  free: [
    // RESOURCE
    {
      featureCode: 'accounts',
      limitType: 'COUNT',
      limitValue: 2,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'goals',
      limitType: 'COUNT',
      limitValue: 1,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'debts',
      limitType: 'COUNT',
      limitValue: 2,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'loans',
      limitType: 'COUNT',
      limitValue: 1,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'custom_categories',
      limitType: 'COUNT',
      limitValue: 5,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'recurring_payments',
      limitType: 'COUNT',
      limitValue: 3,
      featureType: 'RESOURCE',
    },
    // CONSUMABLE
    {
      featureCode: 'transactions_per_month',
      limitType: 'COUNT',
      limitValue: 100,
      featureType: 'CONSUMABLE',
      limitPeriod: 'MONTHLY',
    },
    // BOOLEAN
    { featureCode: 'advanced_reports', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'export_data', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'multi_currency', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'budget_alerts', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'ai_insights', limitType: 'BOOLEAN', limitValue: 0 },
  ],
  pro: [
    // RESOURCE
    {
      featureCode: 'accounts',
      limitType: 'COUNT',
      limitValue: 10,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'goals',
      limitType: 'COUNT',
      limitValue: 5,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'debts',
      limitType: 'COUNT',
      limitValue: 10,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'loans',
      limitType: 'COUNT',
      limitValue: 5,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'custom_categories',
      limitType: 'COUNT',
      limitValue: 20,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'recurring_payments',
      limitType: 'COUNT',
      limitValue: 20,
      featureType: 'RESOURCE',
    },
    // CONSUMABLE
    {
      featureCode: 'transactions_per_month',
      limitType: 'COUNT',
      limitValue: 1000,
      featureType: 'CONSUMABLE',
      limitPeriod: 'MONTHLY',
    },
    // BOOLEAN
    { featureCode: 'advanced_reports', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'export_data', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'multi_currency', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'budget_alerts', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'ai_insights', limitType: 'BOOLEAN', limitValue: 0 },
  ],
  premium: [
    // UNLIMITED
    { featureCode: 'accounts', limitType: 'UNLIMITED', limitValue: -1 },
    { featureCode: 'goals', limitType: 'UNLIMITED', limitValue: -1 },
    { featureCode: 'debts', limitType: 'UNLIMITED', limitValue: -1 },
    { featureCode: 'loans', limitType: 'UNLIMITED', limitValue: -1 },
    {
      featureCode: 'custom_categories',
      limitType: 'UNLIMITED',
      limitValue: -1,
    },
    {
      featureCode: 'recurring_payments',
      limitType: 'UNLIMITED',
      limitValue: -1,
    },
    {
      featureCode: 'transactions_per_month',
      limitType: 'UNLIMITED',
      limitValue: -1,
    },
    // BOOLEAN (all enabled)
    { featureCode: 'advanced_reports', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'export_data', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'multi_currency', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'budget_alerts', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'ai_insights', limitType: 'BOOLEAN', limitValue: 1 },
  ],
};
```

### Endpoints

| Method | Endpoint                 | Auth   | Descripción        |
| ------ | ------------------------ | ------ | ------------------ |
| GET    | `/plans`                 | Public | Listar planes      |
| GET    | `/plans/:code`           | Public | Detalle de plan    |
| GET    | `/subscriptions/current` | JWT    | Suscripción actual |
| GET    | `/subscriptions/usage`   | JWT    | Uso del período    |

### Checklist

**DB:**

- [x] Plan, Subscription, PlanFeature, UsageRecord models
- [x] Migration

**Seed (prisma/seed.ts):**

- [x] Crear 3 planes: Free (isDefault: true), Pro, Premium
- [x] Crear PlanFeatures para cada plan según Feature Matrix
- [x] Usar upsert para que sea idempotente
- [x] Marcar featureType correcto: RESOURCE vs CONSUMABLE

**Subscriptions Module:**

- [x] PlansRepository
- [x] SubscriptionsRepository
- [x] UsageRepository
- [x] SubscriptionsService
  - [x] getUserSubscription()
  - [x] getPlanFeature()
  - [x] checkFeatureAccess() - diferencia RESOURCE vs CONSUMABLE
  - [x] incrementUsage()
  - [x] decrementUsage()
  - [x] getCurrentUsage()
  - [x] getCurrentPeriod() helper
- [x] PlansController
- [x] SubscriptionsController

**Constants:**

- [x] features.constant.ts con todos los feature codes

**Guards & Decorators:**

- [x] FeatureGuard
- [x] @RequireFeature decorator

**Auth Updates:**

- [x] Asignar plan FREE en registro
- [x] Incluir plan en response de usuario (/auth/me, login)

**Integration Example:**

- [ ] Actualizar un module existente (ej: Accounts) con @RequireFeature

**Tests:**

- [ ] Unit tests SubscriptionsService
- [ ] E2E tests: plans list, subscription current, usage, feature limits

---

## Phase 4: Plan Management (Upgrade/Downgrade)

### Objetivo

Implementar upgrade/downgrade de planes, cancelación, reactivación, manejo de overages, y cron jobs para cambios programados.

### Database Schema (adicional)

```prisma
// Agregar a Subscription:
model Subscription {
  // ... campos existentes ...

  // Scheduled changes (for downgrades)
  scheduledPlanId   String?
  scheduledPlan     Plan?     @relation("ScheduledPlan", fields: [scheduledPlanId], references: [id])
  scheduledChangeAt DateTime?

  // Cancellation
  cancelledAt  DateTime?
  cancelReason String?

  // Grace period (for overages after downgrade)
  graceOverages   Json?
  gracePeriodEnd  DateTime?
}

// Agregar relación en Plan:
// scheduledSubscriptions Subscription[] @relation("ScheduledPlan")

model PlanChangeLog {
  id              String         @id @default(cuid(2))
  userId          String
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  fromPlanId      String
  fromPlan        Plan           @relation("FromPlan", fields: [fromPlanId], references: [id])
  toPlanId        String
  toPlan          Plan           @relation("ToPlan", fields: [toPlanId], references: [id])
  changeType      PlanChangeType
  requestedAt     DateTime       @default(now())
  effectiveAt     DateTime?
  scheduledFor    DateTime?
  prorationAmount Decimal?       @db.Decimal(10, 2)
  reason          String?
  metadata        Json?
  createdAt       DateTime       @default(now())

  @@index([userId])
  @@index([createdAt])
  @@map("plan_change_logs")
}

enum PlanChangeType {
  UPGRADE
  DOWNGRADE_SCHEDULED
  DOWNGRADE_APPLIED
  CANCELLATION
  CANCELLATION_APPLIED
  REACTIVATION
}

// Agregar relaciones en Plan:
// fromChangeLogs PlanChangeLog[] @relation("FromPlan")
// toChangeLogs   PlanChangeLog[] @relation("ToPlan")

// Agregar relación en User:
// planChangeLogs PlanChangeLog[]
```

### Reglas de Upgrade/Downgrade

| Acción       | Timing              | Razón            |
| ------------ | ------------------- | ---------------- |
| Upgrade      | **Inmediato**       | Usuario paga más |
| Downgrade    | **Fin del período** | Usuario ya pagó  |
| Cancellation | **Fin del período** | Usuario ya pagó  |

**Upgrade:**

1. Validar que es upgrade (sortOrder mayor)
2. Cancelar cualquier downgrade programado
3. Calcular prorrateo si aplica
4. Aplicar plan nuevo INMEDIATAMENTE
5. Loguear cambio

**Downgrade:**

1. Validar que es downgrade (sortOrder menor)
2. Detectar overages (recursos que exceden nuevo límite)
3. Programar cambio para fin de período (`scheduledPlanId`)
4. Loguear cambio programado

**Cancellation:**

1. Validar que no es plan FREE
2. Programar cambio a FREE para fin de período
3. Marcar cancelledAt

**Reactivation:**

1. Validar que hay cancelación pendiente
2. Remover scheduledPlanId y cancelledAt

### Manejo de Overages

| Tipo de Recurso        | Estrategia   | Razón                              |
| ---------------------- | ------------ | ---------------------------------- |
| accounts, debts, loans | Soft Limit   | Datos financieros críticos         |
| goals, categories      | Grace Period | Usuario puede elegir cuáles borrar |

**Soft Limit:** Bloquear creación pero mantener existentes
**Grace Period:** 7 días para reducir recursos

### Cron Jobs

Usar `@nestjs/schedule`:

```typescript
// Cada hora: Aplicar cambios programados
@Cron('0 * * * *')
async applyScheduledPlanChanges() {
  // Buscar subscriptions con scheduledPlanId y currentPeriodEnd <= now
  // Aplicar cambio, detectar overages, enviar email
}

// Diario: Manejar grace periods expirados
@Cron('0 0 * * *')
async handleExpiredGracePeriods() {
  // Buscar subscriptions con gracePeriodEnd < now
  // Enviar email urgente
}
```

### Endpoints

| Method | Endpoint                    | Auth | Descripción                |
| ------ | --------------------------- | ---- | -------------------------- |
| GET    | `/subscriptions/preview`    | JWT  | Preview de cambio de plan  |
| POST   | `/subscriptions/upgrade`    | JWT  | Upgrade (inmediato)        |
| POST   | `/subscriptions/downgrade`  | JWT  | Downgrade (programado)     |
| POST   | `/subscriptions/cancel`     | JWT  | Cancelar suscripción       |
| POST   | `/subscriptions/reactivate` | JWT  | Reactivar cancelación      |
| DELETE | `/subscriptions/scheduled`  | JWT  | Cancelar cambio programado |

### Checklist

**DB:**

- [x] Agregar scheduledPlanId, scheduledChangeAt, cancelledAt, cancelReason, graceOverages, gracePeriodEnd a Subscription
- [x] PlanChangeLog model
- [x] Migration

**Subscriptions Service (adicional):**

- [x] upgradePlan()
- [x] downgradePlan()
- [x] cancelSubscription()
- [x] reactivateSubscription()
- [x] cancelScheduledChange()
- [x] previewPlanChange()
- [x] checkResourceOverages()
- [x] calculateProration()
- [x] logPlanChange()

**Cron Service:**

- [x] SubscriptionsCronService
- [x] applyScheduledPlanChanges() (hourly)
- [x] handleExpiredGracePeriods() (daily)

**Email Templates:**

- [ ] SUBSCRIPTION_CANCELLED (placeholder UUID)
- [ ] PLAN_CHANGED (placeholder UUID)
- [ ] PLAN_CHANGED_WITH_GRACE (placeholder UUID)
- [ ] GRACE_PERIOD_WARNING (placeholder UUID)
- [ ] GRACE_PERIOD_EXPIRED (placeholder UUID)

**Tests:**

- [ ] Unit tests: upgradePlan, downgradePlan, proration, overages
- [ ] E2E tests: upgrade, downgrade, cancel, reactivate, scheduled changes

---

## Security

### Password

| Aspecto    | Implementación                 |
| ---------- | ------------------------------ |
| Hash       | bcrypt, 12 rounds              |
| Mínimo     | 8 caracteres                   |
| Requisitos | Mayúscula + minúscula + número |
| Máximo     | 128 caracteres                 |

### Tokens

| Token   | Expiración | Storage                |
| ------- | ---------- | ---------------------- |
| Access  | 1 hora     | JWT firmado            |
| Refresh | 7 días     | Hash en DB, single-use |

### Rate Limiting

| Endpoint                  | Límite   |
| ------------------------- | -------- |
| /auth/register            | 5/hora   |
| /auth/login               | 10/15min |
| /auth/forgot-password     | 3/hora   |
| /auth/verify-email        | 5/min    |
| /auth/resend-verification | 5/hora   |

---

## API Reference

### Error Codes

**Auth:**

- `INVALID_CREDENTIALS` (401) - Email o password incorrecto
- `EMAIL_NOT_VERIFIED` (403) - Requiere verificación
- `ACCOUNT_SUSPENDED` (403) - Cuenta suspendida
- `EMAIL_ALREADY_EXISTS` (409) - Email ya registrado
- `TOKEN_EXPIRED` (401) - Token expirado
- `REFRESH_TOKEN_REVOKED` (401) - Token revocado

**OTP:**

- `INVALID_OTP` (400) - Código incorrecto
- `OTP_EXPIRED` (400) - Código expirado
- `OTP_MAX_ATTEMPTS` (429) - Demasiados intentos
- `OTP_RATE_LIMITED` (429) - Rate limit

**Subscriptions:**

- `FEATURE_NOT_AVAILABLE` (403) - Feature no incluida
- `FEATURE_LIMIT_EXCEEDED` (403) - Límite alcanzado
- `NOT_AN_UPGRADE` (400) - Usar endpoint correcto
- `NOT_A_DOWNGRADE` (400) - Usar endpoint correcto
- `ALREADY_ON_PLAN` (400) - Ya tiene ese plan
- `RESOURCE_OVERAGE` (400) - Reducir recursos primero

---

## Directory Structure

```
src/modules/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── jwt-refresh.strategy.ts
│   └── dtos/
├── users/
│   ├── users.module.ts
│   ├── users.service.ts
│   └── users.repository.ts
├── email/
│   ├── email.module.ts
│   └── email.service.ts
├── otp/
│   ├── otp.module.ts
│   ├── otp.service.ts
│   └── otp.repository.ts
└── subscriptions/
    ├── subscriptions.module.ts
    ├── subscriptions.controller.ts
    ├── subscriptions.service.ts
    ├── subscriptions.cron.ts
    ├── plans.controller.ts
    ├── repositories/
    │   ├── plans.repository.ts
    │   ├── subscriptions.repository.ts
    │   └── usage.repository.ts
    └── constants/
        └── features.constant.ts

src/common/
├── guards/
│   ├── jwt-auth.guard.ts
│   └── feature.guard.ts
└── decorators/
    ├── public.decorator.ts
    ├── current-user.decorator.ts
    └── feature.decorator.ts

prisma/
└── seed.ts
```

---

## Implementation Status Summary

**Last Audit: February 4, 2026**

### Completed (✅)

| Phase   | Description                                                                | Status  |
| ------- | -------------------------------------------------------------------------- | ------- |
| Phase 1 | Core Authentication (register, login, JWT, refresh tokens, logout)         | ✅ 100% |
| Phase 2 | Email Verification & Password Recovery (OTP, verify email, reset password) | ✅ 100% |
| Phase 3 | Subscription System & Feature Access (plans, features, guards, decorators) | ✅ 95%  |
| Phase 4 | Plan Management (upgrade, downgrade, cancel, cron jobs)                    | ✅ 90%  |

### Pending Items

1. **E2E Tests** - No E2E tests for auth or subscription flows (only health check exists)
2. **Unit Tests** - Missing unit tests for SubscriptionsService and PlanManagementService
3. **Email Templates** - Phase 4 email templates have placeholder UUIDs in Mailtrap registry
4. **Integration Example** - No feature module (Accounts, Goals, etc.) integrated with @RequireFeature yet
5. **Resource Counting** - `getResourceCount()` in PlanManagementService returns 0 (needs feature modules)

### Files Structure (Actual)

```
src/modules/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.service.spec.ts          ✅
│   ├── refresh-tokens.repository.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── jwt-refresh.strategy.ts
│   └── dtos/
│       ├── register.dto.ts
│       ├── login.dto.ts
│       ├── refresh-token.dto.ts
│       ├── verification.dto.ts
│       └── auth-response.dto.ts
├── users/
│   ├── users.module.ts
│   ├── users.service.ts
│   └── users.repository.ts
├── otp/
│   ├── otp.module.ts
│   ├── otp.service.ts
│   ├── otp.service.spec.ts           ✅
│   └── otp.repository.ts
└── subscriptions/
    ├── subscriptions.module.ts
    ├── subscriptions.controller.ts
    ├── subscriptions.service.ts
    ├── plans.controller.ts
    ├── plan-management.service.ts
    ├── subscriptions-cron.service.ts
    ├── constants/
    │   └── features.constant.ts
    ├── repositories/
    │   ├── plans.repository.ts
    │   ├── subscriptions.repository.ts
    │   ├── usage.repository.ts
    │   └── plan-change-log.repository.ts
    └── dtos/
        ├── subscription.dto.ts
        └── plan-management.dto.ts

src/mail/
├── mail.module.ts
├── mail.service.ts
├── mail.service.spec.ts              ✅
├── providers/
│   ├── mail-provider.interface.ts
│   └── mailtrap.provider.ts
└── templates/
    ├── template.types.ts
    ├── template.registry.ts
    └── html/
        ├── welcome.html
        ├── email-verification.html
        └── password-reset.html

src/common/
├── guards/
│   ├── jwt-auth.guard.ts
│   └── feature.guard.ts
└── decorators/
    ├── public.decorator.ts
    ├── current-user.decorator.ts
    └── feature.decorator.ts

prisma/
├── schema.prisma                     ✅ All models
└── seed.ts                           ✅ 3 plans + 12 features each

test/
└── app.e2e-spec.ts                   ⚠️ Only health check
```

### Next Steps

1. Create actual Mailtrap templates for Phase 4 emails
2. Add E2E tests for auth and subscription flows
3. Add unit tests for SubscriptionsService and PlanManagementService
4. Implement first feature module (Accounts) with @RequireFeature integration

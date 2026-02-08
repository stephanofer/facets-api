# Facets API - Performance Analysis & Optimization Guide

> Análisis detallado de problemas de rendimiento, queries redundantes y soluciones propuestas.

## Table of Contents

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Análisis por Endpoint](#análisis-por-endpoint)
   - [POST /auth/register](#post-authregister)
   - [POST /auth/login](#post-authlogin)
   - [POST /auth/verify-email](#post-authverify-email)
   - [POST /auth/verify-reset-code](#post-authverify-reset-code)
   - [POST /auth/reset-password](#post-authreset-password)
   - [POST /auth/refresh](#post-authrefresh)
   - [GET /auth/me](#get-authme)
   - [GET /subscriptions/usage](#get-subscriptionsusage)
   - [POST /subscriptions/downgrade](#post-subscriptionsdowngrade)
   - [POST /subscriptions/upgrade](#post-subscriptionsupgrade)
3. [Problemas Globales](#problemas-globales)
4. [Soluciones Propuestas](#soluciones-propuestas)
5. [Prioridad de Implementación](#prioridad-de-implementación)

---

## Resumen Ejecutivo

El API tiene varios cuellos de botella de rendimiento que causan tiempos de respuesta de **1.5 - 3+ segundos** en algunos endpoints. Las causas principales son:

| Causa | Impacto | Endpoints Afectados |
|-------|---------|---------------------|
| **bcrypt con 12 salt rounds** | ~250-600ms por cada hash | `/register`, `/reset-password`, `/login` |
| **Queries secuenciales (no paralelas)** | Se suman los tiempos de cada query | `/register`, `/verify-email`, `/login`, `/me` |
| **OTP: 3 queries previas al crear** | ~50-150ms adicionales | `/register`, `/resend-verification`, `/forgot-password` |
| **Email enviado sincrónicamente** | ~200-800ms por request HTTP a Mailtrap | `/register`, `/verify-email`, `/forgot-password` |
| **JWT Strategy valida user en cada request** | 1 query extra por cada request autenticado | Todos los endpoints protegidos |
| **N+1 queries en usage reporting** | Crece linealmente con features del plan | `/subscriptions/usage` |
| **Queries duplicadas** | Mismos datos consultados múltiples veces | `/verify-email`, `/login`, `/register` |

---

## Análisis por Endpoint

### POST /auth/register

**Tiempo estimado: ~1.5 - 3 segundos** ⚠️ **MÁS LENTO**

#### Flujo completo de queries:

```
1. [QUERY]  emailExists() → SELECT user WHERE email (findUnique)         ~5-15ms
2. [CPU]    bcrypt.hash(password, 12) → 12 rounds de hashing             ~250-600ms ⚡
3. [QUERY]  usersRepository.create() → INSERT user                       ~10-20ms
4. [QUERY]  plansRepository.findDefault() → SELECT plan WHERE isDefault  ~5-15ms
5. [QUERY]  subscriptionsRepository.create() → INSERT subscription       ~10-20ms
6. [QUERY]  otpRepository.countRecentOtps() → COUNT otp_codes            ~5-10ms
7. [QUERY]  otpRepository.findMostRecent() → SELECT otp ORDER BY desc    ~5-10ms
8. [QUERY]  otpRepository.invalidateAllForUser() → UPDATE otp_codes      ~5-10ms
9. [QUERY]  otpRepository.create() → INSERT otp_code                     ~5-10ms
10. [HTTP]  mailService.sendTemplate() → HTTP POST a Mailtrap API        ~200-800ms ⚡
```

**Total: 10 operaciones = ~500-1500ms (sin contar latencia de red)**

#### Problemas identificados:

**1. bcrypt con SALT_ROUNDS = 12 (el mayor cuello de botella)**

```typescript
// app.constants.ts
SALT_ROUNDS: 12  // Cada hash toma ~250-600ms dependiendo del CPU
```

12 rounds es seguro pero costoso. Cada ronda duplica el tiempo de cómputo. En un servidor básico, esto solo puede tomar 400-600ms.

**2. OTP generation hace 3 queries secuenciales antes de crear**

```typescript
// otp.service.ts - generate()
await this.checkRateLimit(userId, type);  // Query 1: COUNT
await this.checkCooldown(userId, type);   // Query 2: findFirst
await this.otpRepository.invalidateAllForUser(userId, type);  // Query 3: UPDATE
const otp = await this.otpRepository.create({...});  // Query 4: INSERT
```

Estas 4 queries se ejecutan en **secuencia**, cuando las primeras 2 (rate limit + cooldown) podrían ejecutarse en **paralelo**.

**3. Email enviado sincrónicamente bloquea la respuesta**

```typescript
// auth.service.ts - register()
await this.sendVerificationEmail(user);  // ← BLOQUEA hasta que Mailtrap responde
```

El usuario espera a que la API de Mailtrap responda (~200-800ms) antes de recibir la confirmación de registro.

**4. No hay transacción de base de datos**

La creación del usuario, la suscripción y el OTP se hacen en queries separadas sin transacción. Si falla el paso 5, queda un usuario sin suscripción.

---

### POST /auth/login

**Tiempo estimado: ~300-800ms**

#### Flujo de queries:

```
1. [QUERY]  findByEmail() → SELECT user WHERE email                      ~5-15ms
2. [CPU]    bcrypt.compare(password, hash) → Verifica contra hash         ~250-600ms ⚡
3. [CPU]    jwtService.signAsync (access) ─┐
   [CPU]    jwtService.signAsync (refresh) ┘ → Promise.all              ~5-10ms ✅
4. [CPU]    crypto.createHash (SHA-256) → Hash del refresh token          ~1ms
5. [QUERY]  refreshTokensRepository.create() → INSERT refresh_token      ~10-20ms
6. [QUERY]  subscriptionsRepository.findByUserId() → SELECT subscription ~10-20ms
                                                      JOIN plan
                                                      JOIN planFeatures
```

#### Problemas identificados:

**1. bcrypt.compare también es lento (~250-600ms)**

Cada login paga el costo de bcrypt. Esto es por diseño de seguridad, pero es el mayor contribuyente al tiempo.

**2. getUserPlan hace una query separada después de generar tokens**

```typescript
const tokens = await this.generateTokens(user, metadata);  // Queries 3-5
const plan = await this.getUserPlan(user.id);  // Query 6 - ¡SECUENCIAL!
```

La query del plan podría ejecutarse en paralelo con `generateTokens`.

---

### POST /auth/verify-email

**Tiempo estimado: ~400-1000ms**

#### Flujo de queries:

```
1. [QUERY]  findByEmail() → SELECT user                                  ~5-15ms
2. [QUERY]  otpRepository.findActiveOtp() → SELECT otp_code              ~5-10ms
3. [QUERY]  otpRepository.markAsUsed() → UPDATE otp_code                 ~5-10ms
4. [QUERY]  usersRepository.markEmailVerified() → UPDATE user            ~5-10ms
5. [ASYNC]  sendWelcomeEmail() → NO BLOQUEA (usa .catch()) ✅            ~0ms
6. [CPU]    jwtService.signAsync (access + refresh) → Promise.all        ~5-10ms
7. [CPU]    crypto.createHash (SHA-256)                                   ~1ms
8. [QUERY]  refreshTokensRepository.create() → INSERT refresh_token      ~10-20ms
9. [QUERY]  subscriptionsRepository.findByUserId() → SELECT subscription ~10-20ms
```

#### Problemas identificados:

**1. Queries 3 y 4 podrían ser paralelas**

```typescript
await this.otpService.verify(dto.code, user.id, OtpType.EMAIL_VERIFICATION);
const updatedUser = await this.usersService.verifyEmail(user.id);
```

El `verify` del OTP y el `verifyEmail` del usuario son independientes y podrían ejecutarse con `Promise.all`.

**2. getUserPlan es secuencial (misma issue que login)**

---

### POST /auth/verify-reset-code

**Tiempo estimado: ~500-1200ms** ⚠️ **PROBLEMAS DE DISEÑO**

#### Flujo de queries:

```
1. [QUERY]  findByEmail() → SELECT user                                  ~5-15ms
2. [QUERY]  otpRepository.findActiveOtp() → SELECT otp_code              ~5-10ms
3. [QUERY]  otpRepository.markAsUsed() → UPDATE otp_code                 ~5-10ms
   ── OTP CONSUMIDO ──
4. [QUERY]  otpRepository.countRecentOtps() → COUNT                      ~5-10ms
5. [QUERY]  otpRepository.findMostRecent() → SELECT otp                  ~5-10ms
6. [QUERY]  otpRepository.invalidateAllForUser() → UPDATE otp_codes      ~5-10ms
7. [QUERY]  otpRepository.create() → INSERT otp_code                     ~5-10ms
8. [HTTP]   mailService.sendTemplate() → HTTP POST a Mailtrap            ~200-800ms ⚡
```

#### Problemas identificados:

**1. Re-genera un OTP inmediatamente después de verificar (DISEÑO CUESTIONABLE)**

```typescript
async verifyResetCode(dto: VerifyResetCodeDto): Promise<VerifyResetCodeResponseDto> {
    // ...
    await this.otpService.verify(dto.code, user.id, OtpType.PASSWORD_RESET);
    // ↑ Consume el OTP

    await this.sendPasswordResetEmail(user);
    // ↑ Genera uno NUEVO y envía otro email
}
```

Esto significa que:
- Se consume el OTP que el usuario acaba de verificar
- Se genera un OTP **NUEVO** y se envía **OTRO email**
- El usuario tiene que usar el **segundo** código para hacer reset
- **8 queries + 1 HTTP call** para un endpoint que solo debería ser de verificación

**2. Email enviado sincrónicamente bloquea la respuesta**

---

### POST /auth/reset-password

**Tiempo estimado: ~500-1000ms**

#### Flujo de queries:

```
1. [QUERY]  findByEmail() → SELECT user                                  ~5-15ms
2. [QUERY]  otpRepository.findActiveOtp() → SELECT otp_code              ~5-10ms
3. [QUERY]  otpRepository.markAsUsed() → UPDATE otp_code                 ~5-10ms
4. [CPU]    bcrypt.hash(newPassword, 12) → Hash del nuevo password        ~250-600ms ⚡
5. [QUERY]  usersRepository.updatePassword() → UPDATE user               ~5-10ms
6. [QUERY]  refreshTokensRepository.revokeAllForUser() → UPDATE tokens   ~5-10ms
```

#### Problemas identificados:

**1. bcrypt.hash es el mayor cuello de botella** (igual que register)

**2. Queries 5 y 6 podrían ser paralelas**

```typescript
await this.usersService.updatePassword(user.id, hashedPassword);
await this.refreshTokensRepository.revokeAllForUser(user.id);
// ↑ Estas dos operaciones son independientes
```

---

### POST /auth/refresh

**Tiempo estimado: ~50-150ms** ✅ Razonable

#### Flujo de queries:

```
1. [QUERY]  findById(tokenId) → SELECT refresh_token                    ~5-10ms
2. [CPU]    hashToken() + comparación                                     ~1ms
3. [QUERY]  revoke(storedToken.id) → UPDATE refresh_token                ~5-10ms
4. [QUERY]  findById(userId) → SELECT user                              ~5-10ms
5. [CPU]    Promise.all([signAsync, signAsync])                           ~5-10ms
6. [QUERY]  refreshTokensRepository.create() → INSERT token             ~10-20ms
```

#### Problemas identificados:

**1. Queries 3 y 4 podrían ser paralelas**

Revocar el token antiguo y buscar el usuario son operaciones independientes.

---

### GET /auth/me

**Tiempo estimado: ~30-80ms** ✅ Razonable

Pero recordar que el `JwtStrategy` ya hizo una query para verificar al usuario. Ver [Problemas Globales](#jwt-strategy-doble-query).

#### Flujo de queries:

```
[GUARD]  JwtStrategy.validate() → SELECT user WHERE id                  ~5-15ms  ⚡ DUPLICADA
1. [QUERY]  findById(userId) → SELECT user WHERE id                     ~5-15ms  ⚡ DUPLICADA
2. [QUERY]  subscriptionsRepository.findByUserId() → SELECT subscription ~10-20ms
```

`findById` se ejecuta **2 veces** para el mismo usuario: una en el JwtStrategy y otra en `getMe()`.

---

### GET /subscriptions/usage

**Tiempo estimado: ~200-500ms+** (crece con número de features) ⚠️ **N+1 PROBLEM**

#### Flujo de queries:

```
[GUARD]  JwtStrategy.validate() → SELECT user                           ~5-15ms
1. [QUERY]  findByUserId() → SELECT subscription + plan + planFeatures   ~10-20ms
   ── POR CADA FEATURE (ej: 8 features) ──
2. [QUERY]  getCurrentUsage() → SELECT usage_record                      ~5-10ms  × 8
3. [QUERY]  getOrCreateForPeriod() → SELECT + (INSERT si no existe)      ~10-20ms × 8
```

#### Problemas identificados:

**1. Clásico problema N+1: loop secuencial sobre features**

```typescript
for (const planFeature of subscription.plan.planFeatures) {
    const featureUsage = await this.getFeatureUsage(userId, planFeature);
    features.push(featureUsage);
}
```

Con 8 features, esto son **16-24 queries** ejecutadas en **secuencia**. Cada una espera a la anterior.

**2. getFeatureUsage hace 2 queries por feature CONSUMABLE**

```typescript
current = await this.usageRepository.getCurrentUsage(userId, ...);  // Query 1
const usageRecord = await this.usageRepository.getOrCreateForPeriod(userId, ...); // Query 2
```

`getOrCreateForPeriod` consulta la **misma tabla** que `getCurrentUsage`. Se podría unificar en una sola query.

---

### POST /subscriptions/upgrade y /downgrade

**Tiempo estimado: ~300-1200ms**

#### Problemas identificados:

**1. Queries duplicadas para obtener subscription y plan**

```typescript
// Se obtiene la subscription
const subscription = await this.subscriptionsRepository.findByUserId(userId);
// Se obtiene el plan target
const targetPlan = await this.plansRepository.findByCode(targetPlanCode);
```

Ambas queries son independientes y podrían ejecutarse en paralelo.

**2. detectResourceOverages tiene un loop secuencial**

```typescript
for (const feature of resourceFeatures) {
    const currentCount = await this.getResourceCount(userId, feature.featureCode);
}
```

Cuando se implementen los módulos de features, esto será otro N+1.

**3. downgradePlan recarga la subscription al final**

```typescript
// Después de scheduleDowngrade()
const updatedSubscription = await this.subscriptionsRepository.findByUserId(userId);
```

El método `scheduleDowngrade` ya podría retornar la subscription actualizada (y de hecho lo hace, pero se ignora su retorno).

---

## Problemas Globales

### 1. JwtStrategy Doble Query

**Cada request autenticado ejecuta una query adicional innecesaria.**

```typescript
// jwt.strategy.ts - validate()
async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersService.findById(payload.sub);  // ← QUERY en cada request
    if (!user) throw new UnauthorizedException('User not found');
    // ...
    return { sub: payload.sub, email: payload.email };  // ← Solo retorna el payload original
}
```

El strategy consulta al usuario solo para verificar que existe, pero **no adjunta el resultado al request**. Luego, los endpoints como `getMe()` vuelven a consultar al mismo usuario.

**Impacto:** 1 query extra × cada request autenticado × cada usuario = significativo a escala.

### 2. Sin Connection Pooling Optimizado

```typescript
// prisma.service.ts
const pool = new Pool({
    connectionString: configService.database.url,
});
```

El pool de `pg` usa defaults que podrían no ser óptimos:
- `max`: 10 conexiones (default)
- No hay `idleTimeoutMillis` configurado
- No hay `connectionTimeoutMillis` configurado

### 3. No Hay Caching

Datos que casi nunca cambian se consultan en cada request:
- **Plans** (`findDefault()`, `findByCode()`): Los planes cambian muy raramente
- **PlanFeatures**: Las features de un plan son estáticas
- **User subscription plan**: Cambia solo cuando el usuario hace upgrade/downgrade

### 4. Cold Start de Prisma

La primera query después de iniciar la aplicación o después de un periodo de inactividad puede ser lenta (~100-300ms) porque Prisma necesita preparar las queries.

### 5. bcrypt Bloquea el Event Loop

`bcrypt.hash()` y `bcrypt.compare()` son operaciones CPU-bound que **bloquean el event loop de Node.js**. Mientras se ejecuta un hash, ninguna otra request puede ser procesada en ese thread.

---

## Soluciones Propuestas

#### S1: Hacer el envío de email asíncrono en TODOS los endpoints

**Impacto: -200 a -800ms en `/register`, `/forgot-password`, `/resend-verification`, `/verify-reset-code`**

Muy imporante devolver igualmente que se completo el proceso osea que se envie la respuesta con exito aunque el email se este enviando aparte, para no bloquear al usuario por un error externo. ya si el usaurio no recibe el email, se puede reintentar desde el cliente o hacer un nuevo request de resend verification.

```typescript
// ❌ ACTUAL - Bloquea la respuesta
await this.sendVerificationEmail(user);

// ✅ PROPUESTO - Fire-and-forget con logging de error
this.sendVerificationEmail(user).catch((error) => {
    this.logger.error('Failed to send verification email:', error);
});
```

#### S3: Paralelizar queries independientes

**Impacto: -30 a -100ms por endpoint**

```typescript
// ❌ ACTUAL - login()
const tokens = await this.generateTokens(user, metadata);
const plan = await this.getUserPlan(user.id);

// ✅ PROPUESTO
const [tokens, plan] = await Promise.all([
    this.generateTokens(user, metadata),
    this.getUserPlan(user.id),
]);
```

```typescript
// ❌ ACTUAL - OTP generate()
await this.checkRateLimit(userId, type);
await this.checkCooldown(userId, type);

// ✅ PROPUESTO
await Promise.all([
    this.checkRateLimit(userId, type),
    this.checkCooldown(userId, type),
]);
```

#### S4: Cachear planes y features (datos casi estáticos)


usar `@nestjs/cache-manager`. SUPER IMPORANTE PENSA BIEN LA ESTRATEGIA QUE SE USARA Y EL TIEMPO DE EXPIRACION NOSE CUAL ES LA FORMA RECOMENDADA DE HACERLO BUSCA INFORMACION EN LA DOCUEMTNACION DE NESTJS PARA LA IMPLEMENTACION Y TENER PENSADOO COMO PROCEDER CUANDO CAMBIA UN PLAN

#### S5: Eliminar la doble query del JwtStrategy

**Impacto: -5 a -15ms en CADA request autenticado**

```typescript
// ❌ ACTUAL - Consulta user pero solo retorna el payload
async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return { sub: payload.sub, email: payload.email };
}

// ✅ OPCIÓN A - Retornar el usuario completo para evitar re-query
async validate(payload: JwtPayload): Promise<JwtPayload & { user: User }> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return { sub: payload.sub, email: payload.email, user };
}
```
#### S6: Resolver N+1 en getUserUsage

**Impacto: De ~16-24 queries a 2-3 queries**

```typescript
// ❌ ACTUAL - N+1 loop
for (const planFeature of subscription.plan.planFeatures) {
    const featureUsage = await this.getFeatureUsage(userId, planFeature);
}

// ✅ PROPUESTO - Batch query
async getUserUsage(userId: string): Promise<UsageResponseDto> {
    const subscription = await this.subscriptionsRepository.findByUserId(userId);
    if (!subscription) throw ...;

    // Una sola query para todos los usage records del usuario
    const allUsage = await this.usageRepository.getAllCurrentUsage(userId);
    const usageMap = new Map(allUsage.map(u => [u.featureCode, u]));

    const features = subscription.plan.planFeatures.map(planFeature => {
        const usage = usageMap.get(planFeature.featureCode);
        return this.mapFeatureUsage(planFeature, usage);
    });

    return { planCode: subscription.plan.code, planName: subscription.plan.name, features };
}
```

#### S7: Usar transacciones para operaciones atómicas

**Impacto: Integridad de datos + posible mejora de rendimiento**

```typescript
// ✅ PROPUESTO - register() con transacción
async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const emailExists = await this.usersService.emailExists(dto.email);
    if (emailExists) throw new ConflictException(...);

    const hashedPassword = await bcrypt.hash(dto.password, APP_CONSTANTS.SALT_ROUNDS);

    // Todo en una transacción
    const { user, subscription } = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { ... } });
        const defaultPlan = await tx.plan.findFirst({ where: { isDefault: true } });
        const subscription = await tx.subscription.create({
            data: { userId: user.id, planId: defaultPlan!.id },
            include: { plan: { include: { planFeatures: true } } },
        });
        return { user, subscription };
    });

    // Email async (fire-and-forget)
    this.sendVerificationEmail(user).catch(err => this.logger.error(err));

    return { ... };
}
```

#### S8: Unificar queries duplicadas en OTP

**Impacto: -10 a -30ms en generación de OTP**

```typescript
// ❌ ACTUAL - 2 queries separadas
// checkRateLimit: COUNT otpCodes WHERE userId, type, createdAt > 1h ago
// checkCooldown: findFirst WHERE userId, type ORDER BY createdAt DESC

// ✅ PROPUESTO - 1 query que retorna ambos datos
async checkRateLimitAndCooldown(
    userId: string,
    type: OtpType,
): Promise<{ recentCount: number; mostRecent: OtpCode | null }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [recentCount, mostRecent] = await Promise.all([
        this.prisma.otpCode.count({
            where: { userId, type, createdAt: { gte: oneHourAgo } },
        }),
        this.prisma.otpCode.findFirst({
            where: { userId, type },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    return { recentCount, mostRecent };
}
```


#### S9: Configurar el Pool de PostgreSQL

```typescript
// ✅ PROPUESTO
const pool = new Pool({
    connectionString: configService.database.url,
    max: 20,                    // Aumentar máximo de conexiones
    idleTimeoutMillis: 30000,   // Cerrar conexiones inactivas después de 30s
    connectionTimeoutMillis: 5000, // Timeout de conexión de 5s
});
```

#### S10: Usar Argon2id en lugar de bcrypt

```bash
pnpm add argon2
```

Argon2id es más moderno, resistente a ataques GPU, y puede configurarse para ser más eficiente:

```typescript
import * as argon2 from 'argon2';

// Hash: ~50-100ms (vs bcrypt ~250-600ms)
const hash = await argon2.hash(password);

// Verify: ~50-100ms
const valid = await argon2.verify(hash, password);
```

#### S11: Rediseñar el flujo de verify-reset-code

```typescript
// ❌ ACTUAL: Consume OTP + Genera NUEVO OTP + Envía OTRO email = 8 queries + 1 HTTP

// ✅ PROPUESTO: Solo verificar sin consumir, consumir en reset-password
async verifyResetCode(dto: VerifyResetCodeDto): Promise<VerifyResetCodeResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw ...;

    // Solo verificar que el código es válido sin consumirlo
    const otp = await this.otpRepository.findActiveOtp(user.id, OtpType.PASSWORD_RESET);
    if (!otp || otp.code !== dto.code || otp.expiresAt < new Date()) {
        throw new BusinessException(...);
    }

    return { message: 'Code verified.', valid: true };
}
```

Esto reduce de **8 queries + 1 HTTP** a **2 queries + 0 HTTP**.


---

## Resumen de Mejoras Esperadas

| Endpoint | Tiempo Actual 
|----------|--------------|-------------------|-------------------|
| `POST /register` | 1.5-3s | 300-600ms | 200-400ms |
| `POST /login` | 300-800ms | 100-300ms | 80-200ms |
| `POST /verify-email` | 400-1000ms | 200-500ms | 150-300ms |
| `POST /verify-reset-code` | 500-1200ms | 300-600ms | 50-100ms |
| `POST /reset-password` | 500-1000ms | 200-500ms | 150-350ms |
| `GET /auth/me` | 30-80ms | 30-80ms | 15-40ms |
| `GET /usage` | 200-500ms+ | 200-500ms+ | 50-100ms |
| General (autenticados) | +5-15ms overhead | +5-15ms | +0-5ms |

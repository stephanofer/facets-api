# Auditoría de Seguridad — Facets API

**Fecha:** 8 de Febrero, 2026
**Alcance:** Revisión completa del codebase (NestJS 11 + Prisma 7 + PostgreSQL)
**Tipo:** White-box analysis (acceso total al código fuente)
**Estado:** Solo diagnóstico — sin cambios implementados

---

## Resumen Ejecutivo

Facets es un SaaS de finanzas personales. Maneja datos financieros sensibles (transacciones, deudas, cuentas bancarias), lo que lo convierte en un objetivo de alto valor.

**Lo que está bien hecho:**

- Argon2id para hashing de passwords (superior a bcrypt)
- Refresh tokens hasheados con SHA-256 antes de almacenarlos
- Token rotation en refresh (revoke + re-issue)
- Detección de token theft (hash mismatch → revoca todos los tokens del usuario)
- Global JWT Guard con opt-out via `@Public()` (secure by default)
- Helmet habilitado
- ValidationPipe con `whitelist: true` y `forbidNonWhitelisted: true`
- Anti-enumeración de emails en forgot-password y resend-verification
- OTP con rate limiting por usuario (5/hora) y cooldown (60s)
- Sentry para monitoring de errores
- Zod para validación de environment variables

**Lo que necesita atención:** 10 hallazgos (3 CRITICAL, 3 HIGH, 3 MEDIUM, 1 LOW)

---

## Hallazgos

### 🔴 CRITICAL-01: Credenciales reales expuestas en `.env`

**Archivo:** `.env`

El archivo `.env` contiene credenciales reales de desarrollo. Si bien `.gitignore` lo excluye, el archivo existe en disco con datos sensibles que no deberían ser placeholder-like.

```env
# Lo que tenés ahora:
DATABASE_URL="postgresql://stephanofer:helloworld@localhost:5432/facets?schema=public"
MAILTRAP_API_TOKEN="6103a3e4b27bb833d55418fcb220c6dd"
SENTRY_DSN=https://3d1537aefaf1c7d76d3bd20cb576709f@o4508385501839360.ingest.us.sentry.io/...
JWT_ACCESS_SECRET="your-access-secret-min-32-chars-here"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars-here"
```

**Impacto:** Password de DB predecible (`helloworld`), API token de Mailtrap real, y los JWT secrets son strings predecibles (NO son criptográficamente seguros). Cualquier persona que adivine `your-access-secret-min-32-chars-here` puede forjar JWTs válidos.

**Solución:**

```bash
# 1. Generar secrets criptográficamente seguros
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
# Ejemplo: kX9vQ2mZ...8fL3nW (86 chars)

# 2. Usar password seguro para PostgreSQL
# En desarrollo: al menos usar un password generado
# En producción: usar managed database con credenciales rotadas

# 3. Rotar INMEDIATAMENTE el Mailtrap API token
# 4. Regenerar el Sentry DSN si fue expuesto en algún commit anterior
```

```env
# .env (NUNCA commitear este archivo)
JWT_ACCESS_SECRET="kX9vQ2mZ7...generado-con-crypto..."
JWT_REFRESH_SECRET="pL4wR8nY1...generado-con-crypto..."
DATABASE_URL="postgresql://facets_dev:$(openssl rand -base64 32)@localhost:5432/facets"
```

---

### 🔴 CRITICAL-02: Sin Rate Limiting HTTP Global

**Archivos:** `src/main.ts`, `src/app.module.ts`, `package.json`

La configuración tiene `RATE_LIMIT_TTL` y `RATE_LIMIT_MAX` definidos en `.env` y parseados en `configuration.ts`, pero **NO se usa `@nestjs/throttler` ni ningún rate limiter HTTP**. El paquete ni siquiera está instalado.

Los endpoints públicos `/auth/login`, `/auth/register`, `/auth/forgot-password` están completamente expuestos a brute force.

**Impacto:** Un atacante puede:

- Hacer brute force de passwords en `/auth/login` sin límite
- Hacer credential stuffing masivo
- Generar DDoS a nivel aplicación
- Abusar de `/auth/forgot-password` para bombardear emails (el OTP rate limit es por userId, pero el endpoint acepta cualquier email sin límite HTTP)

**Solución:**

```bash
pnpm add @nestjs/throttler
```

```typescript
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short', // Protección contra bursts
          ttl: 1000, // 1 segundo
          limit: 3,
        },
        {
          name: 'medium', // Protección general
          ttl: 60000, // 1 minuto
          limit: 30,
        },
        {
          name: 'long', // Protección contra abuse sostenido
          ttl: 3600000, // 1 hora
          limit: 500,
        },
      ],
    }),
    // ...resto de imports
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

```typescript
// auth.controller.ts — rate limits más agresivos para auth
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 5, ttl: 60000 },
  })
  @Post('login')
  async login() {
    /* ... */
  }

  @Throttle({
    short: { limit: 1, ttl: 2000 },
    medium: { limit: 3, ttl: 60000 },
  })
  @Post('register')
  async register() {
    /* ... */
  }

  @Throttle({
    short: { limit: 1, ttl: 3000 },
    medium: { limit: 3, ttl: 300000 },
  })
  @Post('forgot-password')
  async forgotPassword() {
    /* ... */
  }
}
```

---

### 🔴 CRITICAL-03: OTP Almacenado y Comparado en Texto Plano

**Archivos:** `src/modules/otp/otp.service.ts`, `src/modules/otp/otp.repository.ts`, `prisma/schema.prisma`

El código OTP de 6 dígitos se almacena tal cual en la base de datos y se compara con `===`:

```typescript
// otp.service.ts:109 y :174
if (otp.code !== code) {
  // Comparación directa en texto plano
}
```

```prisma
// schema.prisma:69
model OtpCode {
  code String // 6 digits — almacenado SIN hashear
}
```

**Impacto:** Si un atacante obtiene acceso de lectura a la DB (SQL injection, backup expuesto, acceso al servidor), puede leer TODOS los OTPs activos y resetear cualquier cuenta.

**Solución:**

```typescript
// otp.service.ts — hashear antes de almacenar
import * as crypto from 'crypto';

private hashOtp(code: string): string {
  return crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');
}

async generate(userId: string, type: OtpType): Promise<OtpGenerationResult> {
  // ... rate limit checks ...

  const code = this.generateSecureCode();
  const hashedCode = this.hashOtp(code);

  const otp = await this.otpRepository.create({
    code: hashedCode,  // ← Almacenar el HASH, no el código
    type,
    userId,
    expiresAt,
  });

  return { code, expiresAt, otpId: otp.id }; // Devolver el code en limpio (para el email)
}

async verify(code: string, userId: string, type: OtpType): Promise<OtpVerificationResult> {
  const otp = await this.otpRepository.findActiveOtp(userId, type);
  // ...validaciones...

  const hashedInput = this.hashOtp(code);
  if (otp.code !== hashedInput) {  // ← Comparar hashes
    await this.otpRepository.incrementAttempts(otp.id);
    // ...throw error...
  }
  // ...mark as used...
}
```

> **Nota:** Usar timing-safe comparison sería ideal (`crypto.timingSafeEqual`), pero con SHA-256 el riesgo de timing attack es mínimo para un OTP de 6 dígitos con max 5 intentos.

---

### 🟠 HIGH-01: Sin Account Lockout en Login

**Archivo:** `src/modules/auth/auth.service.ts`

El flujo de login no implementa ningún mecanismo de lockout. Un atacante puede intentar infinitas combinaciones de password para un email conocido.

```typescript
// auth.service.ts:158-178
async login(dto: LoginDto): Promise<LoginResponseDto> {
  const user = await this.usersService.findByEmail(dto.email);
  if (!user) { throw new UnauthorizedException(...); }

  const isPasswordValid = await argon2.verify(user.password, dto.password);
  if (!isPasswordValid) {
    throw new UnauthorizedException(...);
    // ❌ No se registra el intento fallido
    // ❌ No hay lockout después de N intentos
  }
}
```

**Impacto:** Brute force de passwords sin consecuencias (especialmente grave sin rate limiting HTTP).

**Solución:**

```typescript
// Opción 1: Campo en User model
// prisma/schema.prisma
model User {
  // ...campos existentes...
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?
}

// auth.service.ts
async login(dto: LoginDto): Promise<LoginResponseDto> {
  const user = await this.usersService.findByEmail(dto.email);
  if (!user) { throw new UnauthorizedException(...); }

  // Verificar si la cuenta está bloqueada
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000
    );
    throw new BusinessException(
      ERROR_CODES.ACCOUNT_LOCKED,
      `Account locked. Try again in ${minutesLeft} minutes.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const isPasswordValid = await argon2.verify(user.password, dto.password);
  if (!isPasswordValid) {
    const attempts = user.failedLoginAttempts + 1;
    const MAX_ATTEMPTS = 5;

    await this.usersService.incrementFailedLogin(user.id, attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + 15 * 60 * 1000) // Lock 15 min
      : undefined
    );

    throw new UnauthorizedException({
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid email or password',
    });
  }

  // Reset en login exitoso
  if (user.failedLoginAttempts > 0) {
    await this.usersService.resetFailedLogins(user.id);
  }
  // ...continuar con token generation...
}
```

---

### 🟠 HIGH-02: `verifyResetCode` No Consume el OTP — Riesgo de Replay

**Archivo:** `src/modules/auth/auth.service.ts:337-361`, `src/modules/otp/otp.service.ts:75-127`

El endpoint `POST /auth/verify-reset-code` valida el OTP SIN consumirlo. El diseño intencional es que se consuma en `resetPassword()`, pero esto crea una ventana donde:

```typescript
// auth.service.ts:350
await this.otpService.verifyWithoutConsuming(
  dto.code,
  user.id,
  OtpType.PASSWORD_RESET,
);
// ↑ El OTP sigue activo y se puede usar múltiples veces en verify-reset-code
```

**Impacto:**

1. **Timing oracle:** Un atacante puede llamar `verify-reset-code` repetidamente para confirmar si un OTP es válido sin consumirlo (limitado a 5 intentos por los max attempts, pero cada llamada exitosa no incrementa)
2. **Window of vulnerability:** Entre `verify-reset-code` y `reset-password`, el OTP es reutilizable
3. **Information leak:** Confirma que el email existe (a diferencia de `forgot-password` que siempre devuelve éxito)

**Solución:**

```typescript
// Opción A: Usar un reset token temporal
async verifyResetCode(dto: VerifyResetCodeDto): Promise<VerifyResetCodeResponseDto> {
  const user = await this.usersService.findByEmail(dto.email);
  if (!user) {
    throw new BusinessException(ERROR_CODES.INVALID_OTP, '...', HttpStatus.BAD_REQUEST);
  }

  // Consumir el OTP aquí
  await this.otpService.verify(dto.code, user.id, OtpType.PASSWORD_RESET);

  // Generar un token temporal de corta duración para el reset
  const resetToken = crypto.randomBytes(32).toString('hex');
  await this.cacheOrDb.set(`reset:${user.id}`, this.hashToken(resetToken), { ttl: 300 }); // 5 min

  return {
    message: 'Code verified successfully.',
    valid: true,
    resetToken, // El cliente usa esto en reset-password
  };
}

// Opción B (más simple): Eliminar verify-reset-code y hacer todo en reset-password
// El mobile app verifica el OTP directamente en el paso de reset-password
```

---

### 🟠 HIGH-03: `enableImplicitConversion: true` en ValidationPipe

**Archivo:** `src/main.ts:43-45`

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true, // ← PELIGROSO
    },
  }),
);
```

**Impacto:** class-transformer convierte tipos automáticamente basándose en el tipo de TypeScript. Esto puede causar:

- Un string `"true"` se convierte a boolean `true`
- Un string `"0"` se convierte a number `0`
- Type confusion attacks donde se bypasean validaciones

```typescript
// Ejemplo de ataque:
// Si un DTO tiene: @IsOptional() isAdmin?: boolean
// El atacante envía: { "isAdmin": "true" }
// Con enableImplicitConversion, "true" → true ANTES de la validación
```

**Solución:**

```typescript
// main.ts — desactivar implicit conversion
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // ❌ ELIMINAR enableImplicitConversion
  }),
);

// En los DTOs que necesiten conversión, usar decorators explícitos:
import { Type } from 'class-transformer';

export class PaginationDto {
  @Type(() => Number) // ← Conversión EXPLÍCITA
  @IsInt()
  @Min(1)
  page: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;
}
```

---

### 🟡 MEDIUM-01: Refresh Token en Body (No en HttpOnly Cookie)

**Archivo:** `src/modules/auth/strategies/jwt-refresh.strategy.ts:27`

```typescript
super({
  jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'), // ← Body, no cookie
});
```

**Impacto:** El refresh token se envía en el body del request y se devuelve en el response body. Esto lo hace accesible desde JavaScript, vulnerable a XSS. Si un atacante inyecta JS, puede robar el refresh token y obtener acceso persistente.

**Solución:**

```typescript
// Opción para Web: HttpOnly cookie
// main.ts
import * as cookieParser from 'cookie-parser';
app.use(cookieParser());

// auth.service.ts — setear el refresh token como cookie
async login(dto, res: Response): Promise<LoginResponseDto> {
  const tokens = await this.generateTokens(user);

  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,      // No accesible desde JS
    secure: true,        // Solo HTTPS
    sameSite: 'strict',  // Protección CSRF
    path: '/api/v1/auth/refresh',  // Solo para este endpoint
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  });

  return { accessToken: tokens.accessToken, user };
}

// jwt-refresh.strategy.ts — leer de cookie
super({
  jwtFromRequest: ExtractJwt.fromExtractors([
    (req: Request) => req.cookies?.refreshToken,  // Cookie para web
    ExtractJwt.fromBodyField('refreshToken'),       // Body para mobile
  ]),
});
```

> **Nota:** Para mobile (Expo), el body approach es aceptable porque no hay XSS en apps nativas. Pero para web, cookies HttpOnly son mandatorias.

---

### 🟡 MEDIUM-02: Health Endpoint Expone Estado de la DB

**Archivo:** `src/health/health.controller.ts`

```typescript
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database'), // ← Info de DB pública
    ]);
  }
}
```

**Impacto:** Terminus devuelve detalles del estado de cada servicio (up/down, latencia). Un atacante puede:

- Confirmar que la app usa PostgreSQL
- Monitorear la disponibilidad de la DB para timing de ataques
- Detectar degradación del servicio

**Solución:**

```typescript
@Public()
@Controller('health')
export class HealthController {
  // Endpoint público: solo retorna OK/ERROR (para load balancers)
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  // Endpoint protegido: detalles completos (para monitoring interno)
  // Quitar @Public() para que requiera JWT
  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaHealth.pingCheck('database')]);
  }

  // Readiness también protegido
  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaHealth.pingCheck('database')]);
  }
}
```

---

### 🟡 MEDIUM-03: CORS Permisivo (Array Vacío como Fallback)

**Archivo:** `src/config/configuration.ts:22`, `src/main.ts:23-26`

```typescript
// configuration.ts
cors: {
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],  // ← [] si no se define
}

// main.ts
app.enableCors({
  origin: configService.cors.allowedOrigins,  // [] = ¿qué hace?
  credentials: true,
});
```

**Impacto:** Cuando `origin` es un array vacío `[]`, el comportamiento de CORS depende del framework. En Express/NestJS, un array vacío puede bloquear todo (bueno) o dejar pasar requests sin `Origin` header (parcialmente malo). Además, no se configuran `methods`, `allowedHeaders`, ni `maxAge`.

**Solución:**

```typescript
// main.ts
app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = configService.cors.allowedOrigins;

    // Permitir requests sin origin (mobile apps, curl, etc.)
    // PERO solo en desarrollo
    if (!origin && configService.isDevelopment) {
      return callback(null, true);
    }

    if (!origin || !allowedOrigins.includes(origin)) {
      return callback(new Error('Not allowed by CORS'));
    }

    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // Cache preflight 24h
});

// env.validation.ts — REQUIRED en producción
ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS is required'),
```

---

### 🔵 LOW-01: Comentario Desactualizado en Schema (Stale Documentation)

**Archivo:** `prisma/schema.prisma:17`

```prisma
model User {
  password String // bcrypt hashed  ← INCORRECTO: se usa Argon2id
}
```

**Impacto:** Bajo. Pero documentación incorrecta puede llevar a decisiones equivocadas durante incident response o onboarding.

**Solución:**

```prisma
model User {
  password String // Argon2id hashed
}
```

---

## Resumen de Prioridades

| #    | Severidad   | Hallazgo                                              | Esfuerzo  |
| ---- | ----------- | ----------------------------------------------------- | --------- |
| C-01 | 🔴 CRITICAL | Credenciales reales en .env + JWT secrets predecibles | 30 min    |
| C-02 | 🔴 CRITICAL | Sin rate limiting HTTP global                         | 1-2 horas |
| C-03 | 🔴 CRITICAL | OTP en texto plano en DB                              | 1-2 horas |
| H-01 | 🟠 HIGH     | Sin account lockout en login                          | 2-3 horas |
| H-02 | 🟠 HIGH     | verifyResetCode no consume OTP (replay)               | 1-2 horas |
| H-03 | 🟠 HIGH     | enableImplicitConversion: true                        | 1 hora    |
| M-01 | 🟡 MEDIUM   | Refresh token en body (no httpOnly cookie)            | 3-4 horas |
| M-02 | 🟡 MEDIUM   | Health endpoint expone estado de DB                   | 15 min    |
| M-03 | 🟡 MEDIUM   | CORS mal configurado (fallback vacío)                 | 30 min    |
| L-01 | 🔵 LOW      | Comentario stale en schema                            | 1 min     |

---

## Plan de Acción Recomendado

### Semana 1 — Críticos (Bloquean el deploy a producción)

1. Rotar TODOS los secrets (JWT, DB password, Mailtrap token, Sentry DSN)
2. Instalar y configurar `@nestjs/throttler`
3. Hashear OTPs antes de almacenarlos

### Semana 2 — High

4. Implementar account lockout en login
5. Refactorizar verify-reset-code (consumir OTP + reset token temporal)
6. Quitar `enableImplicitConversion`, agregar `@Type()` explícitos en DTOs

### Semana 3 — Medium + Mejoras

7. Implementar refresh token via HttpOnly cookies (al menos para web)
8. Proteger health endpoints detallados
9. Fortalecer configuración CORS
10. Actualizar documentación de schema

---

## Consideraciones Adicionales (No Son Hallazgos, Pero Vale Pensarlas)

- **CSRF:** Al no usar cookies para auth actualmente, CSRF no es un vector. Pero si se migra a HttpOnly cookies, agregar protección CSRF (o usar `sameSite: strict`)
- **Security Headers adicionales:** Helmet ya cubre lo básico, pero considerar Content-Security-Policy cuando haya frontend web
- **Dependency Audit:** Correr `pnpm audit` periódicamente. Considerar Snyk o GitHub Dependabot
- **Logs de auditoría:** Para un SaaS financiero, loggear TODAS las acciones sensibles (login, cambio de password, cambio de plan) con IP y user-agent en una tabla de audit trail
- **Encryption at rest:** Los datos financieros (transacciones, cuentas) deberían cifrarse en la DB cuando esos módulos se implementen
- **API Versioning + Deprecation:** Ya tienen URI versioning (`/v1/`), asegurar que haya un plan de deprecación seguro

---

_Auditoría realizada sobre el commit `46da368` — Security Auditor Skill_

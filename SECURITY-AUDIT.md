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

## Consideraciones Adicionales (No Son Hallazgos, Pero Vale Pensarlas)

- **CSRF:** Al no usar cookies para auth actualmente, CSRF no es un vector. Pero si se migra a HttpOnly cookies, agregar protección CSRF (o usar `sameSite: strict`)
- **Security Headers adicionales:** Helmet ya cubre lo básico, pero considerar Content-Security-Policy cuando haya frontend web
- **Dependency Audit:** Correr `pnpm audit` periódicamente. Considerar Snyk o GitHub Dependabot
- **Logs de auditoría:** Para un SaaS financiero, loggear TODAS las acciones sensibles (login, cambio de password, cambio de plan) con IP y user-agent en una tabla de audit trail
- **Encryption at rest:** Los datos financieros (transacciones, cuentas) deberían cifrarse en la DB cuando esos módulos se implementen
- **API Versioning + Deprecation:** Ya tienen URI versioning (`/v1/`), asegurar que haya un plan de deprecación seguro

---

_Auditoría realizada sobre el commit `46da368` — Security Auditor Skill_

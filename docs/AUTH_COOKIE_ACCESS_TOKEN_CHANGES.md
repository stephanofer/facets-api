# Changelog: Auth Cookie-Based Access Token (Mobile-First)

> Cambios realizados para soportar autenticación dual (Bearer + Cookie) en el access token, con prioridad móvil.

## Problema

El access token solo se extraía del header `Authorization: Bearer <token>`. Esto funcionaba para mobile pero en web obligaba a guardar el access token en memoria JavaScript y mandarlo manualmente en cada request, exponiéndolo a XSS.

## Solución

Ahora el access token también se setea como cookie HttpOnly en las respuestas de login/verify/refresh. La estrategia JWT lo extrae con **prioridad Bearer** (mobile) y **fallback a cookie** (web).

---

## Archivos modificados

### 1. `src/modules/auth/strategies/jwt.strategy.ts`

**Antes:** Extraía SOLO de `Authorization: Bearer`.

**Después:** Extracción dual con prioridad:

```typescript
jwtFromRequest: ExtractJwt.fromExtractors([
  // Prioridad 1: Bearer header (mobile)
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  // Prioridad 2: HttpOnly cookie (web)
  (req: Request) => req.cookies?.['accessToken'] ?? null,
]),
```

**Agregado:** Constante `ACCESS_TOKEN_COOKIE_NAME = 'accessToken'` exportada para uso consistente.

---

### 2. `src/modules/auth/auth.service.ts`

**Agregado:**

- `setAccessTokenCookie(res, accessToken)` — Setea cookie HttpOnly con `path: '/'`, `sameSite: 'strict'`, `maxAge` = duración del access token.
- `clearAccessTokenCookie(res)` — Limpia la cookie.
- `getAccessTokenCookieOptions()` — Configuración privada de la cookie.
- Import de `ACCESS_TOKEN_COOKIE_NAME`.

---

### 3. `src/modules/auth/auth.controller.ts`

**Modificado:**

| Endpoint             | Antes                        | Después                        |
| -------------------- | ---------------------------- | ------------------------------ |
| `POST /login`        | Solo seteaba cookie refresh  | Setea cookie access + refresh  |
| `POST /verify-email` | Solo seteaba cookie refresh  | Setea cookie access + refresh  |
| `POST /refresh`      | Solo seteaba cookie refresh  | Setea cookie access + refresh  |
| `POST /logout`       | Solo limpiaba cookie refresh | Limpia cookie access + refresh |
| `POST /logout-all`   | Solo limpiaba cookie refresh | Limpia cookie access + refresh |

---

### 4. `src/common/interceptors/logging.interceptor.ts`

**Modificado:** La detección de `Cookie` como auth source ahora busca AMBAS cookies (`accessToken` o `refreshToken`).

**Agregado:** Import de `ACCESS_TOKEN_COOKIE_NAME`.

---

### 5. `src/modules/auth/auth.service.spec.ts`

**Agregado 2 tests:**

- `setAccessTokenCookie` — Verifica que setea cookie con `httpOnly: true`, `sameSite: 'strict'`, `path: '/'`, `maxAge` = 1 hora en ms.
- `clearAccessTokenCookie` — Verifica que limpia la cookie con las opciones correctas.

---

## Verificación

- ✅ Build: pasa sin errores
- ✅ Unit tests: 91/91 pasan
- ✅ Sin errores de lint nuevos introducidos

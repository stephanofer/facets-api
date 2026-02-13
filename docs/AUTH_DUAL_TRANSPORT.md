# Auth Dual Transport: Cookie + Bearer (Mobile-First)

> Autenticación dual para Mobile (Bearer tokens) y Web (HttpOnly cookies) con prioridad móvil.

## Principio fundamental

> **Mobile-first**: La extracción de tokens SIEMPRE prioriza el header `Authorization: Bearer`. Si no lo encuentra, busca en las HttpOnly cookies. Esto aplica para AMBOS tokens (access y refresh).

---

## Cómo funciona el sistema

El sistema usa **dos tokens** con propósitos distintos y **dos transportes** según la plataforma:

| Token             | Vida útil   | Propósito               | Mobile                         | Web                            |
| ----------------- | ----------- | ----------------------- | ------------------------------ | ------------------------------ |
| **Access Token**  | Corta (15m) | Autenticar CADA request | Header `Authorization: Bearer` | Cookie HttpOnly `accessToken`  |
| **Refresh Token** | Larga (7d)  | Obtener nuevos tokens   | Body JSON `refreshToken`       | Cookie HttpOnly `refreshToken` |

### Punto clave

> Ambos tokens se devuelven SIEMPRE en el body del response. Mobile los toma del body. Web los ignora del body porque las cookies se setean automáticamente por el servidor.

---

## Estrategia de extracción (ambos tokens)

```
Request llega al servidor
        │
        ▼
┌─ Prioridad 1: ¿Tiene Authorization: Bearer <token>? ─── SÍ → Usar Bearer (Mobile)
│
└─ Prioridad 2: ¿Tiene cookie HttpOnly? ─── SÍ → Usar Cookie (Web)
                                             │
                                             NO → 401 Unauthorized
```

Esto se implementa con `ExtractJwt.fromExtractors()` de Passport en ambas strategies.

---

## Flujos por plataforma

### 📱 Mobile (React Native / Expo)

```
1. POST /auth/login  →  body: { email, password }
   ← Recibe: { tokens: { accessToken, refreshToken }, user }
   → Guarda accessToken y refreshToken en SecureStore

2. GET /auth/me  (o cualquier ruta protegida)
   → Header: Authorization: Bearer <accessToken>

3. POST /auth/refresh  (cuando accessToken expira)
   → body: { refreshToken: "<token guardado>" }
   ← Recibe: { accessToken, refreshToken } (nuevos)
   → Reemplaza ambos en SecureStore

4. POST /auth/logout
   → Header: Authorization: Bearer <accessToken>
   → body: { refreshToken: "<token guardado>" }
```

### 🌐 Web (Browser)

```
1. POST /auth/login  →  body: { email, password }
   ← Recibe: { tokens: { accessToken, refreshToken }, user }
   ← El servidor setea cookie HttpOnly 'accessToken' (path: /)
   ← El servidor setea cookie HttpOnly 'refreshToken' (path: /api/v1/auth/refresh)
   → NO guardar tokens en localStorage/sessionStorage (las cookies hacen el trabajo)

2. GET /auth/me  (o cualquier ruta protegida)
   → El browser envía cookie 'accessToken' automáticamente
   → JwtStrategy la extrae del cookie como fallback

3. POST /auth/refresh  (cuando accessToken expira)
   → El browser envía cookie 'refreshToken' automáticamente (path coincide)
   ← El servidor setea NUEVAS cookies para ambos tokens

4. POST /auth/logout
   → El browser envía cookie 'accessToken' automáticamente
   ← El servidor limpia AMBAS cookies con clearCookie()
```

---

## Arquitectura de los componentes

### JwtStrategy (Access Token)

```
Archivo: src/modules/auth/strategies/jwt.strategy.ts
Extrae de: 1) Bearer header (prioridad) → 2) Cookie 'accessToken' (fallback)
Valida con: JWT_ACCESS_SECRET
Constante: ACCESS_TOKEN_COOKIE_NAME = 'accessToken'
```

### JwtRefreshStrategy (Refresh Token)

```
Archivo: src/modules/auth/strategies/jwt-refresh.strategy.ts
Extrae de: 1) Cookie 'refreshToken' (prioridad) → 2) Body field (fallback)
Valida con: JWT_REFRESH_SECRET
Constante: REFRESH_TOKEN_COOKIE_NAME = 'refreshToken'
```

### AuthController

```
Archivo: src/modules/auth/auth.controller.ts

Login / Verify Email / Refresh:
  → Setea cookie 'accessToken' (path: /, maxAge: accessTokenExpiry)
  → Setea cookie 'refreshToken' (path: /api/v1/auth/refresh, maxAge: refreshTokenExpiry)

Logout / Logout All:
  → Limpia cookie 'accessToken'
  → Limpia cookie 'refreshToken'
```

### AuthService - Cookie Management

```
Archivo: src/modules/auth/auth.service.ts

Access Token:
  setAccessTokenCookie(res, token)    → Cookie HttpOnly, path: /
  clearAccessTokenCookie(res)         → Limpia cookie

Refresh Token:
  setRefreshTokenCookie(res, token)   → Cookie HttpOnly, path: /api/v1/auth/refresh
  clearRefreshTokenCookie(res)        → Limpia cookie
```

---

## Seguridad de las cookies

| Propiedad  | Access Token Cookie | Refresh Token Cookie   | Por qué                                                          |
| ---------- | ------------------- | ---------------------- | ---------------------------------------------------------------- |
| `httpOnly` | `true`              | `true`                 | JavaScript NO puede leer la cookie (previene XSS)                |
| `secure`   | `true` en prod      | `true` en prod         | Solo se envía por HTTPS                                          |
| `sameSite` | `'strict'`          | `'strict'`             | Protección contra CSRF                                           |
| `path`     | `/`                 | `/api/v1/auth/refresh` | Access va a todas las rutas, refresh solo al endpoint de refresh |
| `maxAge`   | 15 minutos          | 7 días                 | Se autodestruye cuando expira                                    |

### ¿Por qué paths distintos?

- **Access Token** (`path: /`): Se necesita en TODOS los endpoints protegidos, por eso el browser lo envía siempre.
- **Refresh Token** (`path: /api/v1/auth/refresh`): SOLO se necesita para renovar tokens. Restringir el path minimiza la superficie de ataque.

---

## Diagrama de flujo

```
                    ┌─────────────┐
                    │   Cliente   │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         📱 Mobile                  🌐 Web
              │                         │
    POST /login                  POST /login
    body: {email,pass}           body: {email,pass}
              │                         │
              ▼                         ▼
    ┌─────────────────────────────────────────────────┐
    │              AuthController.login()              │
    │  1. authService.login(dto) → tokens              │
    │  2. setAccessTokenCookie(res, accessToken)       │
    │  3. setRefreshTokenCookie(res, refreshToken)     │
    │  4. return { tokens, user }                      │
    └─────────────────────────────────────────────────┘
              │                         │
              ▼                         ▼
    Guarda tokens              Ignora body tokens
    en SecureStore             (cookies se setearon)
              │                         │
              ▼                         ▼
    ┌─────────────────────────────────────────────────┐
    │         Requests autenticados                    │
    │  Mobile: Authorization: Bearer <access>          │
    │  Web:    Cookie 'accessToken' (automático)       │
    │  → JwtStrategy extrae con prioridad Bearer       │
    │  → Fallback a cookie si no hay Bearer            │
    └─────────────────────────────────────────────────┘
              │                         │
              ▼                         ▼
    POST /refresh               POST /refresh
    body: {refreshToken}        (cookie automática)
              │                         │
              ▼                         ▼
    ┌─────────────────────────────────────────────────┐
    │   JwtRefreshStrategy.fromExtractors()            │
    │   1. ¿Cookie? → usar cookie (web)                │
    │   2. ¿Body?   → usar body  (mobile)              │
    │   → Valida → rota tokens → responde nuevos       │
    │   → Setea nuevas cookies (ambos tokens)          │
    └─────────────────────────────────────────────────┘
```

---

## Logging

El `LoggingInterceptor` detecta el origen de autenticación:

```
GET /api/v1/auth/me 200 - 45ms | Auth: Bearer (Mobile/API)
GET /api/v1/auth/me 200 - 30ms | Auth: Cookie (Web)
POST /api/v1/auth/login 200 - 200ms | Auth: None (Mobile/API)
```

Detecta `Cookie` si encuentra CUALQUIERA de las dos cookies (`accessToken` o `refreshToken`).

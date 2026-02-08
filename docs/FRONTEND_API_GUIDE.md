
## Autenticación

### 1. Registro de Usuario

**Endpoint:** `POST /auth/register`  
**Auth:** Public

```json
// Request
{
  "email": "usuario@ejemplo.com",
  "password": "Password123",
  "firstName": "Juan",
  "lastName": "Pérez"
}

// Response 201
{
  "message": "User registered successfully. Please check your email to verify your account."
}
```

**Feedback al usuario:**

- ✅ "Registro exitoso. Revisa tu email para verificar tu cuenta."

SUPER IMPORANTE CUANDO EL USUARIO SE REGISTRA: HAY QUE LLEVALO A UNA PAGINA  PARA QUE PUEDA VERIFICAR SU CUENTA UTIZIANDO EL OTP OSEA SE REGISTRA LE DA A REGISTRAR LUEGO LO LLEVA A UNA PAGINA PARA QEU PONGA EL OTP UNA VES PONGA EL OTP LO LLEVE AL DASHBOARD YA QUE AL VERIFICAR LE DA TOKENS DE ACCESO.
---

### 2. Login

**Endpoint:** `POST /auth/login`  
**Auth:** Public

```json
// Request
{
  "email": "usuario@ejemplo.com",
  "password": "Password123"
}

// Response 200
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cm123abc",
    "email": "usuario@ejemplo.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "emailVerified": true,
    "status": "ACTIVE",
    "subscription": {
      "planCode": "free",
      "planName": "Free",
      "status": "ACTIVE"
    }
  }
}
```
---

### 4. Logout

**Endpoint:** `POST /auth/logout`  
**Auth:** Bearer Token (JWT)

```json
// Request
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// Response 200
{
  "message": "Logged out successfully"
}
```

**Feedback al usuario:**

- ✅ "Sesión cerrada correctamente"
- 🗑️ Eliminar tokens

---

### 6. Obtener Usuario Actual

**Endpoint:** `GET /auth/me`  
**Auth:** Bearer Token (JWT)

```json
// Response 200
{
  "id": "cm123abc",
  "email": "usuario@ejemplo.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "emailVerified": true,
  "status": "ACTIVE",
  "subscription": {
    "planCode": "pro",
    "planName": "Pro",
    "status": "ACTIVE",
    "currentPeriodEnd": "2026-03-05T00:00:00Z"
  }
}
```

---

## Verificación de Email y Password Recovery

### 7. Verificar Email con OTP

**Endpoint:** `POST /auth/verify-email`  
**Auth:** Public

```json
// Request
{
  "email": "usuario@ejemplo.com",
  "code": "123456"
}

// Response 200 (AUTO-LOGIN)
{
  "message": "Email verified successfully",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cm123abc",
    "email": "usuario@ejemplo.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "emailVerified": true,
    "status": "ACTIVE"
  }
}
```

**Feedback al usuario:**

- ✅ "Email verificado correctamente. Bienvenido a Facets!"

**Intentos restantes:**

- Si el código es incorrecto, la respuesta incluye: `"attemptsRemaining": 3`
- Mostrar: "Código incorrecto. Te quedan 3 intentos."

---

### 8. Reenviar Código de Verificación

**Endpoint:** `POST /auth/resend-verification`  
**Auth:** Public

```json
// Request
{
  "email": "usuario@ejemplo.com"
}

// Response 200
{
  "message": "Verification code sent successfully"
}
```

**Feedback al usuario:**

- ✅ "Código enviado a tu email. Revisa tu bandeja de entrada."
- ⏱️ Deshabilitar botón por 60 segundos (cooldown)

---

### 9. Olvidé mi Contraseña

**Endpoint:** `POST /auth/forgot-password`  
**Auth:** Public

```json
// Request
{
  "email": "usuario@ejemplo.com"
}

// Response 200
{
  "message": "If an account exists with this email, you will receive a password reset code"
}
```

**⚠️ IMPORTANTE:** Siempre responde success (evita email enumeration)

**Feedback al usuario:**

- ✅ "Si tu email está registrado, recibirás un código para restablecer tu contraseña."

---


---

### 11. Restablecer Contraseña

**Endpoint:** `POST /auth/reset-password`  
**Auth:** Public

```json
// Request (opción 1: con resetToken)
{
  "resetToken": "temp_token_12345",
  "newPassword": "NewPassword123"
}

// Request (opción 2: con email + code)
{
  "email": "usuario@ejemplo.com",
  "code": "123456",
  "newPassword": "NewPassword123"
}

// Response 200
{
  "message": "Password reset successfully. All active sessions have been terminated."
}
```

**Feedback al usuario:**

- ✅ "Contraseña actualizada correctamente."
- 🔒 "Por seguridad, hemos cerrado todas tus sesiones activas. Por favor inicia sesión nuevamente."

---

### 14. Obtener Suscripción Actual

**Endpoint:** `GET /subscriptions/current`  
**Auth:** Bearer Token (JWT)

```json
// Response 200
{
  "id": "sub_789",
  "status": "ACTIVE",
  "currentPeriodStart": "2026-02-05T00:00:00Z",
  "currentPeriodEnd": "2026-03-05T00:00:00Z",
  "plan": {
    "code": "pro",
    "name": "Pro",
    "priceMonthly": "4.99"
  },
  "scheduledChange": null, // o datos del downgrade programado
  "cancelledAt": null
}
```

**Con downgrade programado:**

```json
{
  "scheduledChange": {
    "toPlanCode": "free",
    "toPlanName": "Free",
    "effectiveDate": "2026-03-05T00:00:00Z",
    "reason": "User requested downgrade"
  }
}
```

**Feedback al usuario:**

- Si hay `scheduledChange`: ⚠️ "Tu plan cambiará a Free el 5 de marzo."
- Botón: "Cancelar cambio programado"

---

### 15. Obtener Uso Actual

**Endpoint:** `GET /subscriptions/usage`  
**Auth:** Bearer Token (JWT)

```json
// Response 200
{
  "plan": {
    "code": "free",
    "name": "Free"
  },
  "usage": {
    "accounts": { "current": 2, "limit": 2, "percentage": 100 },
    "transactions_per_month": { "current": 87, "limit": 100, "percentage": 87 },
    "goals": { "current": 0, "limit": 1, "percentage": 0 },
    "custom_categories": { "current": 3, "limit": 5, "percentage": 60 }
  }
}
```

**Mostrar al usuario:**

```
📊 Uso del Plan Free

Cuentas: 2/2 [████████████████████] 100% ⚠️ Límite alcanzado
Transacciones este mes: 87/100 [█████████████░░░] 87%
Metas: 0/1 [░░░░░░░░░░░░░░░░░░░░] 0%
```

---

---

## Manejo de Errores

### Códigos de Error Comunes

| Código HTTP | Error Code               | Descripción                              | Feedback al Usuario                                                  |
| ----------- | ------------------------ | ---------------------------------------- | -------------------------------------------------------------------- |
| **400**     | `INVALID_OTP`            | Código OTP incorrecto                    | "Código incorrecto. Te quedan X intentos."                           |
| **400**     | `OTP_EXPIRED`            | Código OTP expirado                      | "El código expiró. Solicita uno nuevo."                              |
| **400**     | `NOT_AN_UPGRADE`         | Intenta usar upgrade para downgrade      | "Usa el flujo de downgrade para cambiar a un plan inferior."         |
| **400**     | `ALREADY_ON_PLAN`        | Ya tiene ese plan                        | "Ya estás en el plan Pro."                                           |
| **400**     | `RESOURCE_OVERAGE`       | Tiene recursos que exceden el nuevo plan | "Tienes 5 cuentas activas. Elimina 3 para cambiar a Free."           |
| **401**     | `INVALID_CREDENTIALS`    | Email o password incorrecto              | "Email o contraseña incorrectos."                                    |
| **401**     | `TOKEN_EXPIRED`          | Access token expirado                    | (Llamar `/auth/refresh` automáticamente)                             |
| **401**     | `REFRESH_TOKEN_REVOKED`  | Refresh token inválido                   | "Tu sesión expiró. Por favor inicia sesión nuevamente."              |
| **403**     | `EMAIL_NOT_VERIFIED`     | Email no verificado                      | "Verifica tu email antes de iniciar sesión."                         |
| **403**     | `ACCOUNT_SUSPENDED`      | Cuenta suspendida                        | "Tu cuenta está suspendida. Contacta a soporte."                     |
| **403**     | `FEATURE_NOT_AVAILABLE`  | Feature no incluida en el plan           | "Esta función no está disponible en tu plan. Actualiza a Pro."       |
| **403**     | `FEATURE_LIMIT_EXCEEDED` | Límite de recurso alcanzado              | "Alcanzaste el límite de 2 cuentas. Actualiza a Pro para crear más." |
| **409**     | `EMAIL_ALREADY_EXISTS`   | Email ya registrado                      | "Este email ya está registrado. ¿Deseas iniciar sesión?"             |
| **429**     | `OTP_MAX_ATTEMPTS`       | Demasiados intentos de OTP               | "Demasiados intentos. Solicita un nuevo código."                     |
| **429**     | `OTP_RATE_LIMITED`       | Límite de OTPs alcanzado                 | "Espera 60 segundos antes de solicitar otro código."                 |

### Estructura de Respuesta de Error

```json
{
  "statusCode": 403,
  "errorCode": "FEATURE_LIMIT_EXCEEDED",
  "message": "You have reached the limit for this feature",
  "details": {
    "featureCode": "accounts",
    "featureName": "Accounts",
    "current": 2,
    "limit": 2,
    "planCode": "free",
    "planName": "Free"
  }
}
```

### Manejo de Límites de Features en Tiempo Real

Cuando el usuario intenta crear un recurso (cuenta, meta, etc.):

**Error 403 - FEATURE_LIMIT_EXCEEDED:**

```typescript
// Respuesta del backend
{
  "statusCode": 403,
  "errorCode": "FEATURE_LIMIT_EXCEEDED",
  "details": {
    "featureCode": "accounts",
    "current": 2,
    "limit": 2
  }
}

// Frontend debe mostrar:
"Has alcanzado el límite de 2 cuentas del plan Free.
[Ver Planes] para crear cuentas ilimitadas."
```

---

## Headers y Tokens

### Requests Públicos

```http
POST /auth/login HTTP/1.1
Content-Type: application/json
```

### Requests Autenticados

```http
GET /subscriptions/current HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Flujo de Renovación Automática

1. Frontend hace request con `accessToken`
2. Si responde `401` + `TOKEN_EXPIRED`:
   - Llamar `POST /auth/refresh` con `refreshToken`
   - Si success: guardar nuevos tokens y reintentar request original
   - Si falla: redirigir a login

```typescript
// Pseudo-código
async function fetchWithAuth(url, options) {
  let response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    // Intentar refresh
    const refreshResponse = await fetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const { accessToken: newAccess, refreshToken: newRefresh } =
        await refreshResponse.json();
      // Guardar nuevos tokens
      saveTokens(newAccess, newRefresh);
      // Reintentar request original
      response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${newAccess}`,
        },
      });
    } else {
      // Refresh falló, logout
      redirectToLogin();
    }
  }

  return response;
}
```

---

## Resumen de Validaciones

### Passwords

- Mínimo 8 caracteres
- Al menos 1 mayúscula
- Al menos 1 minúscula
- Al menos 1 número

### Códigos OTP

- 6 dígitos numéricos
- Expiran en 10 minutos
- Máximo 5 intentos
- Cooldown de 60 segundos entre envíos

### Tokens JWT

- Access Token: expira en 1 hora
- Refresh Token: expira en 7 días
- Refresh token es single-use (se invalida al usarse)

---

## Testing Rápido

### Flujo Completo de Registro

```bash
# 1. Registrar
POST /auth/register
{
  "email": "test@example.com",
  "password": "Test1234",
  "firstName": "Test",
  "lastName": "User"
}
✅ 201 - "Please check your email"

# 2. Verificar email (usar código del email)
POST /auth/verify-email
{
  "email": "test@example.com",
  "code": "123456"
}
✅ 200 - Recibe accessToken + refreshToken

# 3. Ver mi suscripción
GET /subscriptions/current
Authorization: Bearer {accessToken}
✅ 200 - Plan "free"

# 4. Ver uso
GET /subscriptions/usage
✅ 200 - Límites del plan free
```

---

## Notas Finales

1. **Siempre validar inputs en frontend** antes de enviar al backend
2. **Mostrar feedback claro** para cada acción (success, error, loading)
3. **Manejar estados de carga** mientras se procesan requests
4. **Refresh tokens automático** para mejor UX (usuario no ve errores de sesión)
5. **Preview antes de downgrade** para evitar sorpresas al usuario
6. **Mostrar uso en tiempo real** para que usuario sepa cuándo alcanza límites

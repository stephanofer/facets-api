# Backend contract update for mobile

Documento corto para alinear la app móvil con el backend actual.

## Base response envelope

Salvo `204 No Content`, las respuestas exitosas siguen este formato:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

## Endpoints modificados

### 1. `POST /api/auth/register`

### Cambio

- sigue creando usuario + workspace personal + membership admin + workspace settings
- **ya no crea subscription**
- `user.plan` **ya no existe**

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "message": "Registration successful. Please check your email to verify your account.",
    "user": {
      "id": "cuid_user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": false,
      "status": "PENDING_VERIFICATION",
      "createdAt": "2026-03-30T18:00:00.000Z",
      "workspace": {
        "id": "cwksp_123",
        "name": "John Doe Workspace",
        "type": "PERSONAL",
        "status": "ACTIVE"
      },
      "membership": {
        "id": "cmship_123",
        "role": "ADMIN",
        "status": "ACTIVE"
      },
      "platformRole": "USER"
    }
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 2. `POST /api/auth/login`

### Cambio

- el path no cambió
- `user.plan` **ya no existe**
- el user ahora devuelve solo identidad + workspace activo + membership activa

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "expiresIn": 3600
    },
    "user": {
      "id": "cuid_user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": true,
      "status": "ACTIVE",
      "createdAt": "2026-03-30T18:00:00.000Z",
      "workspace": {
        "id": "cwksp_123",
        "name": "John Doe Workspace",
        "type": "PERSONAL",
        "status": "ACTIVE"
      },
      "membership": {
        "id": "cmship_123",
        "role": "ADMIN",
        "status": "ACTIVE"
      },
      "platformRole": "USER"
    }
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 3. `POST /api/auth/verify-email`

### Cambio

- devuelve tokens + user
- `user.plan` **ya no existe**

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully. You are now logged in.",
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "expiresIn": 3600
    },
    "user": {
      "id": "cuid_user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": true,
      "status": "ACTIVE",
      "createdAt": "2026-03-30T18:00:00.000Z",
      "workspace": {
        "id": "cwksp_123",
        "name": "John Doe Workspace",
        "type": "PERSONAL",
        "status": "ACTIVE"
      },
      "membership": {
        "id": "cmship_123",
        "role": "ADMIN",
        "status": "ACTIVE"
      },
      "platformRole": "USER"
    }
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 4. `GET /api/auth/me`

### Cambio

- `user.plan` **ya no existe**
- ahora es un **bootstrap response** con bloques separados
- el response expone:
  - `user`
  - `workspace`
  - `membership`
  - `profile`
  - `workspaceSettings`
  - `needsOnboarding`
- si el usuario tiene avatar, viene en `user.avatarUrl`
- `profile` **no incluye `phone`**
- `/api/auth/me` **no incluye `WorkspaceUserPreference`**

### Qué significa para mobile

- usar este endpoint para boot inicial después de login / app reopen
- con esto ya sabés:
  - quién es el usuario
  - en qué workspace está parado
  - qué role tiene
  - si necesita onboarding
  - qué summary de perfil ya existe
  - cuáles son los shared settings del workspace
- si necesitás `phone` o preferencias personales por workspace, hay que pedirlos en endpoints separados

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "cuid_user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": true,
      "status": "ACTIVE",
      "platformRole": "USER",
      "createdAt": "2026-03-30T18:00:00.000Z",
      "avatarUrl": "https://cdn.facets.test/avatars/avatar-123.webp"
    },
    "workspace": {
      "id": "cwksp_123",
      "name": "John Doe Workspace",
      "type": "PERSONAL",
      "status": "ACTIVE"
    },
    "membership": {
      "id": "cmship_123",
      "role": "ADMIN",
      "status": "ACTIVE"
    },
    "profile": {
      "countryCode": "AR",
      "theme": "SYSTEM",
      "onboardingCompletedAt": null
    },
    "workspaceSettings": {
      "baseCurrencyCode": "USD",
      "contentLocale": "en-US",
      "dateFormat": "DD/MM/YYYY",
      "monthStartDay": 1,
      "weekStartDay": 1,
      "financialTimezone": "UTC"
    },
    "needsOnboarding": true
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

> Si el usuario no tiene avatar, `user.avatarUrl` puede venir en `null` o directamente no venir serializado por la app consumidora. Para mobile, tratarlo como opcional.

---

### 5. `GET /api/me/profile`

### Para qué sirve

Trae el recurso `UserProfile` del usuario autenticado.

### Este endpoint es dueño de

- `phone`
- `countryCode`
- `theme`
- `onboardingCompletedAt`

### Importante para mobile

- `theme` ahora es **user-level** y pertenece a `UserProfile`
- `phone` también pertenece a `UserProfile`
- `phone` **no forma parte del onboarding inicial**

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "phone": "+5491155557777",
    "countryCode": "AR",
    "theme": "DARK",
    "onboardingCompletedAt": null
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 6. `PATCH /api/me/profile`

### Para qué sirve

Actualiza campos user-level del perfil. No toca workspace settings ni completion state del onboarding.

### Ejemplo de request

```json
{
  "phone": "+5491155557777",
  "countryCode": "AR",
  "theme": "DARK"
}
```

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "phone": "+5491155557777",
    "countryCode": "AR",
    "theme": "DARK",
    "onboardingCompletedAt": null
  },
  "meta": {
    "timestamp": "2026-03-30T18:05:00.000Z"
  }
}
```

### Nota práctica

Si querés guardar `countryCode` o `theme`, hacelo acá. NO en `/api/me/onboarding` y NO en `/api/workspaces/current/preferences`.

---

### 7. `GET /api/me/onboarding`

### Para qué sirve

Trae **solo** el estado de completion del onboarding.

### Este endpoint es dueño de

- `onboardingCompletedAt`
- `needsOnboarding`

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "onboardingCompletedAt": null,
    "needsOnboarding": true
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 8. `PATCH /api/me/onboarding`

### Para qué sirve

Marca onboarding como completo o incompleto.

### Importante para mobile

- `/api/me/onboarding` **solo** maneja completion state
- no mandar `theme`
- no mandar `countryCode`
- no mandar `phone`

### Ejemplo de request

```json
{
  "completed": true
}
```

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "onboardingCompletedAt": "2026-03-30T18:10:00.000Z",
    "needsOnboarding": false
  },
  "meta": {
    "timestamp": "2026-03-30T18:10:00.000Z"
  }
}
```

---

### 9. `PUT /api/auth/me/avatar`

### Cambio

- sigue siendo multipart/form-data
- ahora devuelve el user actualizado con **`avatarUrl`**
- ya no devuelve file metadata ni avatar object separado

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "id": "cuid_user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": true,
    "status": "ACTIVE",
    "createdAt": "2026-03-30T18:00:00.000Z",
    "avatarUrl": "https://cdn.facets.test/avatars/avatar-456.webp",
    "workspace": {
      "id": "cwksp_123",
      "name": "John Doe Workspace",
      "type": "PERSONAL",
      "status": "ACTIVE"
    },
    "membership": {
      "id": "cmship_123",
      "role": "ADMIN",
      "status": "ACTIVE"
    },
    "platformRole": "USER"
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 10. `DELETE /api/auth/me/avatar`

### Cambio

- sigue devolviendo **`204 No Content`**
- no devuelve body
- después de borrar, `GET /api/auth/me` ya no devuelve avatar cargado en `user.avatarUrl`

---

### 11. `GET /api/workspaces`

### Para qué sirve

Lista solo los workspaces donde el usuario tiene membership activa.

### Qué le importa a mobile

- sirve para selector de workspace
- cada item trae `workspace`, `membership` e `isCurrent`

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": [
    {
      "workspace": {
        "id": "cwksp_personal",
        "name": "Personal",
        "type": "PERSONAL",
        "status": "ACTIVE",
        "createdAt": "2026-03-30T18:00:00.000Z",
        "updatedAt": "2026-03-30T18:00:00.000Z"
      },
      "membership": {
        "id": "cmship_admin",
        "role": "ADMIN",
        "status": "ACTIVE",
        "joinedAt": null
      },
      "isCurrent": true
    },
    {
      "workspace": {
        "id": "cwksp_team",
        "name": "Shared Team",
        "type": "GROUP",
        "status": "ACTIVE",
        "createdAt": "2026-03-30T18:00:00.000Z",
        "updatedAt": "2026-03-30T18:00:00.000Z"
      },
      "membership": {
        "id": "cmship_member",
        "role": "MEMBER",
        "status": "ACTIVE",
        "joinedAt": null
      },
      "isCurrent": false
    }
  ],
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 12. `GET /api/workspaces/current`

### Cambio

- el bloque `settings` ya no incluye `displayLabel`
- **campos actuales válidos**:
  - `baseCurrencyCode`
  - `contentLocale`
  - `dateFormat`
  - `monthStartDay`
  - `weekStartDay`
  - `financialTimezone`

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "workspace": {
      "id": "cwksp_123",
      "name": "John Doe Workspace",
      "type": "PERSONAL",
      "status": "ACTIVE",
      "createdAt": "2026-03-30T18:00:00.000Z",
      "updatedAt": "2026-03-30T18:00:00.000Z"
    },
    "membership": {
      "id": "cmship_123",
      "role": "ADMIN",
      "status": "ACTIVE",
      "joinedAt": null
    },
    "settings": {
      "baseCurrencyCode": "USD",
      "contentLocale": "en-US",
      "dateFormat": "DD/MM/YYYY",
      "monthStartDay": 1,
      "weekStartDay": 1,
      "financialTimezone": "UTC"
    }
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 13. `GET /api/workspaces/current/settings`

### Cambio

- mismo contrato de settings compartidos, sin `displayLabel`

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "settings": {
      "baseCurrencyCode": "USD",
      "contentLocale": "en-US",
      "dateFormat": "DD/MM/YYYY",
      "monthStartDay": 1,
      "weekStartDay": 1,
      "financialTimezone": "UTC"
    }
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 14. `PATCH /api/workspaces/current/preferences`

### Para qué sirve

Lee o actualiza `WorkspaceUserPreference`, o sea preferencias personales de UI para **ese usuario dentro de ese workspace**.

### `WorkspaceUserPreference`, simple

- es data personal-per-workspace de UI
- se trae **separado** de `/api/auth/me`
- **no** es shared workspace settings
- **no** es dueño de `theme`

### Campos actuales

- `uiLocale`
- `dateFormat`
- `dashboardPreferences`
- `reportPreferences`
- `transactionPreferences`

### Ejemplo de request

```json
{
  "uiLocale": "es-AR",
  "dateFormat": "YYYY-MM-DD",
  "dashboardPreferences": {
    "compact": true
  },
  "reportPreferences": {
    "defaultPeriod": "month"
  },
  "transactionPreferences": {
    "showPending": true
  }
}
```

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "uiLocale": "es-AR",
    "dateFormat": "YYYY-MM-DD",
    "dashboardPreferences": {
      "compact": true
    },
    "reportPreferences": {
      "defaultPeriod": "month"
    },
    "transactionPreferences": {
      "showPending": true
    }
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

### Nota práctica

Si querés guardar overrides visuales por workspace, usá este recurso. Si querés guardar `theme`, usá `/api/me/profile`.

---

### 15. `GET /api/workspaces/current/preferences`

### Para qué sirve

Devuelve el recurso actual de `WorkspaceUserPreference` para el usuario autenticado en el workspace actual.

### Ejemplo de respuesta vacía estable

```json
{
  "success": true,
  "data": {
    "uiLocale": null,
    "dateFormat": null,
    "dashboardPreferences": {},
    "reportPreferences": {},
    "transactionPreferences": {}
  },
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 16. `PATCH /api/workspaces/current`

### Cambio

- nuevo endpoint para editar identidad del workspace
- hoy **solo permite cambiar `name`**
- `type` sigue apareciendo en responses, pero **no se edita** por API

### Ejemplo de request

```json
{
  "name": "Casa"
}
```

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "workspace": {
      "id": "cwksp_123",
      "name": "Casa",
      "type": "PERSONAL",
      "status": "ACTIVE",
      "createdAt": "2026-03-30T18:00:00.000Z",
      "updatedAt": "2026-03-30T18:30:00.000Z"
    },
    "membership": {
      "id": "cmship_123",
      "role": "ADMIN",
      "status": "ACTIVE",
      "joinedAt": null
    },
    "settings": {
      "baseCurrencyCode": "USD",
      "contentLocale": "en-US",
      "dateFormat": "DD/MM/YYYY",
      "monthStartDay": 1,
      "weekStartDay": 1,
      "financialTimezone": "UTC"
    }
  },
  "meta": {
    "timestamp": "2026-03-30T18:30:00.000Z"
  }
}
```

---

### 17. `PATCH /api/workspaces/current/settings`

### Cambio

- request body cambió nombres
- el endpoint **ya no acepta**:
  - `displayLabel`
  - `workspaceType`
- **ya no usar**:
  - `baseLanguage`
  - `locale`
  - `timezone`
- **usar ahora**:
  - `contentLocale`
  - `financialTimezone`
- si querés cambiar el nombre del workspace, usar `PATCH /api/workspaces/current`

### Ejemplo de request

```json
{
  "baseCurrencyCode": "ARS",
  "contentLocale": "es-AR",
  "dateFormat": "YYYY-MM-DD",
  "monthStartDay": 5,
  "weekStartDay": 1,
  "financialTimezone": "America/Argentina/Buenos_Aires"
}
```

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": {
    "workspace": {
      "id": "cwksp_123",
      "name": "John Doe Workspace",
      "type": "PERSONAL",
      "status": "ACTIVE",
      "createdAt": "2026-03-30T18:00:00.000Z",
      "updatedAt": "2026-03-30T18:30:00.000Z"
    },
    "membership": {
      "id": "cmship_123",
      "role": "ADMIN",
      "status": "ACTIVE",
      "joinedAt": null
    },
    "settings": {
      "baseCurrencyCode": "ARS",
      "contentLocale": "es-AR",
      "dateFormat": "YYYY-MM-DD",
      "monthStartDay": 5,
      "weekStartDay": 1,
      "financialTimezone": "America/Argentina/Buenos_Aires"
    }
  },
  "meta": {
    "timestamp": "2026-03-30T18:30:00.000Z"
  }
}
```

---

### 18. `GET /api/reference/countries`

### Para qué sirve

Lista países activos para formularios de onboarding o profile.

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": [
    {
      "code": "AR",
      "name": "Argentina",
      "callingCode": "+54",
      "defaultCurrencyCode": "ARS",
      "defaultLocale": "es-AR"
    }
  ],
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

### 19. `GET /api/reference/currencies`

### Para qué sirve

Lista monedas activas para flujos de selección/configuración.

### Ejemplo de respuesta

```json
{
  "success": true,
  "data": [
    {
      "code": "USD",
      "name": "US Dollar",
      "symbol": "$",
      "decimalScale": 2
    }
  ],
  "meta": {
    "timestamp": "2026-03-30T18:00:00.000Z"
  }
}
```

---

## Endpoints eliminados

Estos endpoints **ya no existen** en runtime y ahora deben considerarse removidos del contrato mobile:

- `GET /api/plans`
- `GET /api/plans/:code`
- `GET /api/subscriptions/current`
- `GET /api/subscriptions/usage`
- `GET /api/subscriptions/preview?planCode=...`
- `POST /api/subscriptions/upgrade`
- `POST /api/subscriptions/downgrade`
- `POST /api/subscriptions/cancel`
- `POST /api/subscriptions/reactivate`
- `DELETE /api/subscriptions/scheduled`
- `GET /api/subscriptions/history`

### Comportamiento esperado ahora

- esas rutas deben tratarse como **eliminadas**
- si el frontend las llama, va a recibir **404 Not Found**

---

## Ownership rápido

### `UserProfile`

- dueño de `phone`
- dueño de `countryCode`
- dueño de `theme`
- guarda `onboardingCompletedAt`

### `/api/me/onboarding`

- dueño del **completion state** (`needsOnboarding` + `onboardingCompletedAt` como recurso derivado)
- no es dueño de `phone`, `countryCode` ni `theme`

### `WorkspaceSettings`

- dueño de settings compartidos del workspace
- ejemplo: `baseCurrencyCode`, `contentLocale`, `financialTimezone`

### `WorkspaceUserPreference`

- dueño de preferencias personales de UI por workspace
- ejemplo: `uiLocale`, `dateFormat`, dashboard/report/transaction preferences
- **no** es dueño de `theme`

---

## Campos eliminados del contrato

### Auth

- `user.plan` eliminado de:
  - register
  - login
  - verify-email
  - get me
  - avatar upload response

### Workspace settings

- eliminados del contrato API:
  - `baseLanguage`
  - `locale`
  - `timezone`
  - `displayLabel`
  - `workspaceType` en `PATCH /api/workspaces/current/settings`

### Avatar

- eliminados del contrato API:
  - `avatarFileId`
  - file metadata/avatar object en responses

---

## Resumen para mobile

1. **No usar más ninguna pantalla o llamada de plans/subscriptions/usage**.
2. En auth, **no esperar `user.plan`**.
3. Usar `GET /api/auth/me` como bootstrap inicial.
4. En bootstrap, leer:
   - `user`
   - `workspace`
   - `membership`
   - `profile`
   - `workspaceSettings`
   - `needsOnboarding`
5. Si necesitás `phone`, pedir `GET /api/me/profile`.
6. Si querés guardar `theme`, usar `PATCH /api/me/profile`.
7. Si querés marcar onboarding completo, usar `PATCH /api/me/onboarding`.
8. `WorkspaceUserPreference` se trae aparte con `/api/workspaces/current/preferences`.
9. En `/api/workspaces/current/preferences`, **no esperar ni mandar `theme`**.
10. En `/api/workspaces/current/preferences`, **no esperar shared workspace settings**.
11. Para cambiar el nombre del workspace, usar **`PATCH /api/workspaces/current`** con `name`.
12. En workspace settings, migrar a:
    - `contentLocale`
    - `financialTimezone`
13. En `PATCH /api/workspaces/current/settings`, **no mandar** `displayLabel` ni `workspaceType`.
14. Si todavía existe código mobile llamando `/api/plans` o `/api/subscriptions/*`, hay que removerlo o aislarlo.

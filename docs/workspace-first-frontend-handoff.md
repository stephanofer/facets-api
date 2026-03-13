# Workspace-First Frontend Handoff

## Que cambio

- El tenant boundary ya no es el usuario: ahora es el `workspace` activo.
- Auth devuelve contexto canonico de sesion: `workspace`, `membership`, `workspaceRole` y `platformRole`.
- Registro bootstrappea workspace personal + membership `ADMIN` + settings compartidos + suscripcion `free`.
- Billing, usage, settings compartidos y recursos de negocio se resuelven por `workspaceId`, no por `userId`.

## Response shape a esperar

- Salvo `204 No Content`, las respuestas exitosas vienen envueltas asi:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-03-12T18:22:11.000Z"
  }
}
```

- Los errores vienen asi:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient workspace role for this route"
  },
  "meta": {
    "timestamp": "2026-03-12T18:22:11.000Z",
    "path": "/api/v1/accounts",
    "requestId": "req_01HVXYZ123"
  }
}
```

- `DELETE /accounts/:id` y `DELETE /categories/:id` devuelven `204` sin body.

## Auth (`/auth/*`)

- `POST /auth/register`: crea usuario pending + workspace personal + plan free.

```json
{
  "success": true,
  "data": {
    "message": "Registration successful. Please check your email to verify your account.",
    "user": {
      "id": "cm8usr1234567890abcd1234",
      "email": "ana@example.com",
      "firstName": "Ana",
      "lastName": "Lopez",
      "emailVerified": false,
      "status": "PENDING_VERIFICATION",
      "createdAt": "2026-03-12T18:20:00.000Z",
      "plan": {
        "code": "free",
        "name": "Free"
      },
      "workspace": {
        "id": "cm8wsp1234567890abcd1234",
        "name": "Ana Lopez Workspace",
        "type": "PERSONAL",
        "status": "ACTIVE"
      },
      "membership": {
        "id": "cm8mem1234567890abcd1234",
        "role": "ADMIN",
        "status": "ACTIVE"
      },
      "platformRole": "USER"
    }
  },
  "meta": {
    "timestamp": "2026-03-12T18:20:00.000Z"
  }
}
```

- `POST /auth/login` y `POST /auth/verify-email`: devuelven `tokens` + `user` workspace-aware.

```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh",
      "expiresIn": 3600
    },
    "user": {
      "id": "cm8usr1234567890abcd1234",
      "email": "ana@example.com",
      "firstName": "Ana",
      "lastName": "Lopez",
      "emailVerified": true,
      "status": "ACTIVE",
      "createdAt": "2026-03-12T18:20:00.000Z",
      "plan": {
        "code": "free",
        "name": "Free"
      },
      "workspace": {
        "id": "cm8wsp1234567890abcd1234",
        "name": "Ana Lopez Workspace",
        "type": "PERSONAL",
        "status": "ACTIVE"
      },
      "membership": {
        "id": "cm8mem1234567890abcd1234",
        "role": "ADMIN",
        "status": "ACTIVE"
      },
      "platformRole": "USER"
    }
  },
  "meta": {
    "timestamp": "2026-03-12T18:25:00.000Z"
  }
}
```

- `GET /auth/me`: devuelve el mismo shape de `user` sin `tokens`.
- `POST /auth/refresh`: devuelve solo `tokens`; si necesitan estado canonico, relean `/auth/me`.

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-access",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-refresh",
    "expiresIn": 3600
  },
  "meta": {
    "timestamp": "2026-03-12T19:25:00.000Z"
  }
}
```

- `POST /auth/logout`: devuelve mensaje y limpia cookies en web.

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "meta": {
    "timestamp": "2026-03-12T19:26:00.000Z"
  }
}
```

- Errores relevantes de auth:

`401 invalid credentials`

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  },
  "meta": {
    "timestamp": "2026-03-12T18:26:00.000Z",
    "path": "/api/v1/auth/login",
    "requestId": "req_auth_401"
  }
}
```

`403 email no verificado / cuenta suspendida`

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_VERIFIED",
    "message": "Please verify your email before logging in"
  },
  "meta": {
    "timestamp": "2026-03-12T18:27:00.000Z",
    "path": "/api/v1/auth/login",
    "requestId": "req_auth_403"
  }
}
```

`401 refresh invalido/revocado o membership ya no activa`

```json
{
  "success": false,
  "error": {
    "code": "REFRESH_TOKEN_REVOKED",
    "message": "Refresh token has been revoked or expired"
  },
  "meta": {
    "timestamp": "2026-03-12T19:27:00.000Z",
    "path": "/api/v1/auth/refresh",
    "requestId": "req_refresh_401"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Workspace membership is no longer active"
  },
  "meta": {
    "timestamp": "2026-03-12T19:28:00.000Z",
    "path": "/api/v1/auth/refresh",
    "requestId": "req_refresh_membership"
  }
}
```

`400/404 verify-email`

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_VERIFIED",
    "message": "Email is already verified. Please login."
  },
  "meta": {
    "timestamp": "2026-03-12T18:29:00.000Z",
    "path": "/api/v1/auth/verify-email",
    "requestId": "req_verify_400"
  }
}
```

## Workspaces (`/workspaces/current*`)

- `GET /workspaces/current`: fuente de verdad para workspace activo + membership + shared settings.

```json
{
  "success": true,
  "data": {
    "workspace": {
      "id": "cm8wsp1234567890abcd1234",
      "name": "Ana Lopez Workspace",
      "type": "PERSONAL",
      "status": "ACTIVE",
      "createdAt": "2026-03-12T18:20:00.000Z",
      "updatedAt": "2026-03-12T18:20:00.000Z"
    },
    "membership": {
      "id": "cm8mem1234567890abcd1234",
      "role": "ADMIN",
      "status": "ACTIVE",
      "joinedAt": "2026-03-12T18:20:00.000Z"
    },
    "settings": {
      "baseCurrencyCode": "USD",
      "baseLanguage": "en",
      "dateFormat": "DD/MM/YYYY",
      "monthStartDay": 1,
      "weekStartDay": 1,
      "timezone": "UTC",
      "locale": "en-US",
      "displayLabel": "Ana Lopez Workspace"
    }
  },
  "meta": {
    "timestamp": "2026-03-12T18:30:00.000Z"
  }
}
```

- `GET /workspaces/current/settings`: mismo `settings`, sin `workspace` ni `membership`.
- `PATCH /workspaces/current/settings`: `ADMIN` only; devuelve `workspace + membership + settings` actualizado.

- Errores relevantes:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient workspace role for this route"
  },
  "meta": {
    "timestamp": "2026-03-12T18:31:00.000Z",
    "path": "/api/v1/workspaces/current/settings",
    "requestId": "req_workspace_role"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Workspace settings not found"
  },
  "meta": {
    "timestamp": "2026-03-12T18:32:00.000Z",
    "path": "/api/v1/workspaces/current/settings",
    "requestId": "req_workspace_404"
  }
}
```

## Subscriptions (`/subscriptions/*`)

- `GET /subscriptions/current`: lectura del plan del workspace activo.

```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "cm8sub1234567890abcd1234",
      "status": "ACTIVE",
      "currentPeriodStart": "2026-03-01T00:00:00.000Z",
      "currentPeriodEnd": null,
      "plan": {
        "id": "cm8plan_free",
        "code": "free",
        "name": "Free",
        "description": "Starter plan",
        "priceMonthly": 0,
        "priceCurrency": "USD",
        "isDefault": true,
        "sortOrder": 0,
        "features": [
          {
            "featureCode": "accounts",
            "limitType": "COUNT",
            "limitValue": 2,
            "featureType": "RESOURCE"
          }
        ]
      }
    }
  },
  "meta": {
    "timestamp": "2026-03-12T18:35:00.000Z"
  }
}
```

- `GET /subscriptions/usage`: lectura de usage/limits del workspace.

```json
{
  "success": true,
  "data": {
    "planCode": "free",
    "planName": "Free",
    "features": [
      {
        "featureCode": "accounts",
        "current": 2,
        "limit": 2,
        "limitType": "COUNT",
        "featureType": "RESOURCE",
        "usagePercentage": 100,
        "limitReached": true
      },
      {
        "featureCode": "custom_categories",
        "current": 1,
        "limit": 10,
        "limitType": "COUNT",
        "featureType": "RESOURCE",
        "usagePercentage": 10,
        "limitReached": false
      }
    ]
  },
  "meta": {
    "timestamp": "2026-03-12T18:36:00.000Z"
  }
}
```

- `GET /subscriptions/preview`, `POST /subscriptions/upgrade`, `POST /subscriptions/downgrade`, `POST /subscriptions/cancel`, `POST /subscriptions/reactivate`, `DELETE /subscriptions/scheduled`, `GET /subscriptions/history`: todos son `ADMIN` only a nivel workspace.

```json
{
  "success": true,
  "data": {
    "preview": {
      "currentPlan": {
        "id": "cm8plan_free",
        "code": "free",
        "name": "Free",
        "priceMonthly": 0,
        "priceCurrency": "USD",
        "isDefault": true,
        "sortOrder": 0,
        "features": []
      },
      "targetPlan": {
        "id": "cm8plan_pro",
        "code": "pro",
        "name": "Pro",
        "priceMonthly": 9.99,
        "priceYearly": 99.99,
        "priceCurrency": "USD",
        "isDefault": false,
        "sortOrder": 1,
        "features": []
      },
      "changeType": "UPGRADE",
      "immediate": true,
      "prorationAmount": 2.5,
      "overages": [],
      "hasOverages": false
    }
  },
  "meta": {
    "timestamp": "2026-03-12T18:37:00.000Z"
  }
}
```

```json
{
  "success": true,
  "data": {
    "message": "Successfully upgraded to Pro plan",
    "subscription": {
      "id": "cm8sub1234567890abcd1234",
      "status": "ACTIVE",
      "currentPeriodStart": "2026-03-12T18:38:00.000Z",
      "currentPeriodEnd": "2026-04-11T18:38:00.000Z",
      "plan": {
        "id": "cm8plan_pro",
        "code": "pro",
        "name": "Pro",
        "priceMonthly": 9.99,
        "priceYearly": 99.99,
        "priceCurrency": "USD",
        "isDefault": false,
        "sortOrder": 1,
        "features": []
      }
    },
    "prorationAmount": 2.5
  },
  "meta": {
    "timestamp": "2026-03-12T18:38:00.000Z"
  }
}
```

- Errores relevantes:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Only workspace admins can manage billing and plan changes"
  },
  "meta": {
    "timestamp": "2026-03-12T18:39:00.000Z",
    "path": "/api/v1/subscriptions/upgrade",
    "requestId": "req_billing_403"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "PLAN_NOT_FOUND",
    "message": "Plan 'enterprise' not found"
  },
  "meta": {
    "timestamp": "2026-03-12T18:40:00.000Z",
    "path": "/api/v1/subscriptions/preview",
    "requestId": "req_plan_404"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_ON_PLAN",
    "message": "You are already on this plan"
  },
  "meta": {
    "timestamp": "2026-03-12T18:41:00.000Z",
    "path": "/api/v1/subscriptions/upgrade",
    "requestId": "req_plan_400"
  }
}
```


## Frontend handling / UX feedback

- `401 auth/session`: limpiar sesion local, cortar retries de refresh, redirigir a login y mostrar un mensaje corto tipo `Tu sesion vencio. Volve a iniciar sesion.`.
- `403 membership/role`: NO desloguear automaticamente. Mantener sesion, refrescar `/auth/me` o `/workspaces/current` si hace falta, bloquear acciones de escritura y mostrar feedback especifico: `No tenes permisos para esta accion en este workspace.`.
- `403 billing/plan`: para `FEATURE_NOT_AVAILABLE` o `FEATURE_LIMIT_EXCEEDED`, mostrar CTA de upgrade si el usuario es `ADMIN`; si es `MEMBER`/`GUEST`, mostrar `Necesitas que un admin cambie el plan o ajuste limites.`.
- `404 cross-workspace`: tratarlo como `recurso no disponible para este workspace`, no como bug de permisos. UX sugerida: cerrar drawer/modal actual, volver a lista y mostrar `Este recurso no existe o ya no esta disponible en tu workspace actual.`.
- `400/409 form/business`: mantener datos cargados, mapear `error.code` a copy especifico e inline. Ejemplos: nombre duplicado, categoria system, cuenta con transacciones, parent/type mismatch.
- `429/OTP`: en auth, deshabilitar resend/verify temporalmente y mostrar countdown; no spammear retries automaticos.

## Checklist de adaptacion frontend

- Guardar `workspace`, `membership`, `workspaceRole`, `platformRole` y `plan` en el estado de sesion.
- Usar `workspaceRole` para guards y visibilidad de acciones: `GUEST` es read-only para `accounts`, `categories` y `workspaces/current*`.
- Tratar `workspaces/current` y `workspaces/current/settings` como shared settings del workspace, no como preferencias personales.
- Tratar `subscriptions/current`, `usage`, `preview`, `upgrade`, `downgrade`, `cancel`, `reactivate`, `history` y `scheduled` como surfaces del workspace activo.
- Despues de `refresh`, si necesitan rehidratar permisos/plan/workspace canonicos, releer `/auth/me`.
- En web pueden apoyarse en cookies HttpOnly; en mobile sigan usando los tokens del body.

## Caveats que frontend SI o SI tiene que saber

- `refresh` NO devuelve `user`; si cambia el contexto canonico, el frontend lo ve recien al releer `/auth/me`.
- En item endpoints (`/accounts/:id`, `/categories/:id`), un recurso de otro workspace cae como `404`, no como `403`.
- Los errores de permisos y membership viven en `403`; no asuman que todo `403` implica logout.
- `subscriptions/*` de management es `ADMIN` only aunque el usuario este autenticado y dentro del workspace.

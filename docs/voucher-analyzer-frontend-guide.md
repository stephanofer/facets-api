# Voucher Analyzer — guía rápida para Frontend

## 1. Qué hace esta feature

`voucher-analyzer` permite que la app suba una imagen y reciba un análisis estructurado del comprobante.

En esta v1 el backend:

- acepta **solo imágenes** (`JPEG`, `PNG`, `WebP`)
- valida **tipo declarado + contenido real del archivo**
- rechaza archivos disfrazados o pasados de tamaño
- analiza la imagen **en memoria** (no la persiste)
- devuelve un resultado de negocio con dos estados:
  - `VOUCHER`
  - `NOT_VOUCHER`

IMPORTANTE: `NOT_VOUCHER` **NO es un error HTTP**. Es una respuesta exitosa de negocio.

---

## 2. Endpoint

- **Método:** `POST`
- **Path productivo:** `/api/v1/voucher-analyzer`
- **Auth:** `Authorization: Bearer <accessToken>`
- **Content-Type:** `multipart/form-data`
- **Campo de archivo:** `file`
- **Tipos permitidos:** `image/jpeg`, `image/png`, `image/webp`
- **Tamaño máximo:** `5 MB`

### Recomendación para la app

No hardcodeen rutas raras por todos lados. Lo correcto es que la app tenga un `API_BASE_URL` que ya apunte a la base versionada, por ejemplo:

```text
https://api.tudominio.com/api/v1
```

Y desde ahí consumir:

```text
POST {API_BASE_URL}/voucher-analyzer
```

> Nota: en los tests internos del backend aparece `/api/voucher-analyzer` porque ese harness no habilita versionado URI. El frontend NO debe copiar esa URL de tests.

---

## 3. Request esperado desde la app

El request lleva **solo un archivo** en multipart.

### Ejemplo genérico en TypeScript

```ts
type VoucherAnalysisApiResponse =
  | {
      success: true;
      data: {
        status: 'VOUCHER' | 'NOT_VOUCHER';
        document: {
          type: 'voucher' | 'unknown';
          confidence?: number;
        };
        extraction: {
          text: string | null;
          fields: {
            merchantName: string | null;
            issuedAt: string | null;
            totalAmount: string | null;
            currency: string | null;
            taxAmount: string | null;
            paymentMethod: string | null;
          } | null;
        };
        diagnostics: {
          model: string;
          warnings: string[];
        };
      };
      meta: {
        timestamp: string;
      };
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: Array<{ field?: string; message: string }>;
      };
      meta: {
        timestamp: string;
        path: string;
        requestId?: string;
      };
    };

async function analyzeVoucher(
  apiBaseUrl: string,
  accessToken: string,
  file: { uri: string; name: string; type: string },
): Promise<VoucherAnalysisApiResponse> {
  const formData = new FormData();
  formData.append('file', file as any);

  const response = await fetch(`${apiBaseUrl}/voucher-analyzer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  return response.json();
}
```

### Qué mandar desde mobile/web

- `file.name`: nombre de archivo
- `file.type`: MIME real del archivo (`image/jpeg`, `image/png`, `image/webp`)
- `file.uri` o equivalente según plataforma

---

## 4. Envelope de respuesta del backend

Todas las respuestas siguen el estándar global del backend.

### Éxito

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-03-09T10:30:00.000Z"
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "message": "Validation failed (allowed file types: image/jpeg, image/png, image/webp)"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-03-09T10:30:00.000Z",
    "path": "/api/v1/voucher-analyzer",
    "requestId": "req_abc123"
  }
}
```

---

## 5. Payload de éxito (`success: true`)

El `data` del endpoint tiene este shape estable:

```json
{
  "status": "VOUCHER",
  "document": {
    "type": "voucher",
    "confidence": 0.94
  },
  "extraction": {
    "text": "Supermercado X TOTAL 123.45",
    "fields": {
      "merchantName": "Supermercado X",
      "issuedAt": "2026-03-09",
      "totalAmount": "123.45",
      "currency": "ARS",
      "taxAmount": null,
      "paymentMethod": "debit_card"
    }
  },
  "diagnostics": {
    "model": "workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct",
    "warnings": []
  }
}
```

### Significado de cada bloque

#### `status`

- `VOUCHER`: la imagen sí parece un voucher/comprobante
- `NOT_VOUCHER`: la imagen no parece un voucher

#### `document`

- `type`
  - `voucher`
  - `unknown`
- `confidence`
  - score de clasificación entre `0` y `1`
  - es **top-level**, no por campo

#### `extraction`

- `text`: texto humano legible derivado del análisis, o `null`
- `fields`: objeto estructurado, o `null`

Regla importante del contrato actual:

- `text` **NO** debe tratarse como fuente principal de datos
- `text` puede venir `null` incluso cuando `fields` sí trae datos útiles
- `fields` es la fuente de verdad para autocompletar UI
- el backend ya no expone JSON serializado dentro de `text`

Campos actuales:

- `merchantName: string | null`
- `issuedAt: string | null`
- `totalAmount: string | null`
- `currency: string | null`
- `taxAmount: string | null`
- `paymentMethod: string | null`

#### `diagnostics`

- `model`: modelo/ruta usada por backend
- `warnings`: advertencias no fatales

Notas:

- `diagnostics` sirve más para soporte, debugging y QA que para UX principal
- `warnings` sí pueden mostrarse si ayudan al usuario a entender faltantes o baja calidad de extracción
- `model` normalmente no hace falta mostrarlo en UI final

---

## 6. Escenarios que el frontend TIENE que manejar

### A. Voucher detectado con datos completos

HTTP `200`

```json
{
  "success": true,
  "data": {
    "status": "VOUCHER",
    "document": {
      "type": "voucher",
      "confidence": 0.94
    },
    "extraction": {
      "text": "Supermercado X TOTAL 123.45",
      "fields": {
        "merchantName": "Supermercado X",
        "issuedAt": "2026-03-09",
        "totalAmount": "123.45",
        "currency": "ARS",
        "taxAmount": null,
        "paymentMethod": "debit_card"
      }
    },
    "diagnostics": {
      "model": "workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct",
      "warnings": []
    }
  },
  "meta": {
    "timestamp": "2026-03-09T10:30:00.000Z"
  }
}
```

### Qué hacer en UI

- autocompletar el formulario de gasto
- dejar los campos editables
- no mostrar error
- `diagnostics.model` no hace falta mostrarlo al usuario final

---

### B. Voucher detectado, pero parcial

HTTP `200`

```json
{
  "success": true,
  "data": {
    "status": "VOUCHER",
    "document": {
      "type": "voucher",
      "confidence": 0.67
    },
    "extraction": {
      "text": "SUPERMERCADO X\nTOTAL 123.45",
      "fields": {
        "merchantName": "SUPERMERCADO X",
        "issuedAt": null,
        "totalAmount": "123.45",
        "currency": null,
        "taxAmount": null,
        "paymentMethod": null
      }
    },
    "diagnostics": {
      "model": "workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct",
      "warnings": ["Issued date could not be determined."]
    }
  },
  "meta": {
    "timestamp": "2026-03-09T10:30:00.000Z"
  }
}
```

### Qué hacer en UI

- autocompletar lo que sí vino
- dejar en blanco lo que vino `null`
- mostrar un mensaje suave, no bloqueante
  - ejemplo: **"Pudimos extraer parte de la info. Revisá y completá los campos faltantes."**
- mostrar `warnings` si aportan contexto útil

---

### C. Voucher detectado con campos estructurados pero sin texto legible

HTTP `200`

```json
{
  "success": true,
  "data": {
    "status": "VOUCHER",
    "document": {
      "type": "voucher",
      "confidence": 0.9
    },
    "extraction": {
      "text": null,
      "fields": {
        "merchantName": "BCP",
        "issuedAt": "2026-03-08T12:15:00",
        "totalAmount": "30.00",
        "currency": "PEN",
        "taxAmount": null,
        "paymentMethod": "YAPE"
      }
    },
    "diagnostics": {
      "model": "workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct",
      "warnings": []
    }
  },
  "meta": {
    "timestamp": "2026-03-09T10:30:00.000Z"
  }
}
```

### Qué hacer en UI

- usar `fields` normalmente para autocompletar
- no tratar `text: null` como error
- no inventar que faltó el análisis; simplemente no hubo texto legible para exponer
- si necesitás mostrar resumen al usuario, armalo desde `fields`, no desde `text`

---

### D. La imagen no es un voucher

HTTP `200`

```json
{
  "success": true,
  "data": {
    "status": "NOT_VOUCHER",
    "document": {
      "type": "unknown",
      "confidence": 0.81
    },
    "extraction": {
      "text": null,
      "fields": null
    },
    "diagnostics": {
      "model": "workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct",
      "warnings": [
        "The uploaded image does not appear to be a voucher document."
      ]
    }
  },
  "meta": {
    "timestamp": "2026-03-09T10:30:00.000Z"
  }
}
```

### Qué hacer en UI

- NO tratarlo como crash ni como error técnico
- mostrar feedback claro
  - ejemplo: **"No pudimos detectar un voucher en esta imagen. Probá con otra foto."**
- ofrecer CTA para:
  - volver a sacar foto
  - elegir otra imagen
- no autocompletar campos

---

## 7. Cómo mapear esto al formulario de gasto

Mapeo sugerido:

- `merchantName` → comercio
- `issuedAt` → fecha
- `totalAmount` → monto total
- `currency` → moneda
- `taxAmount` → impuestos
- `paymentMethod` → método de pago

### Reglas prácticas

- los montos hoy llegan como **string**, no como number
- la fecha hoy llega como **string**, no asuman parsing perfecto sin validar
- `paymentMethod` hoy es **string libre** en v1, no enum cerrado
- si un campo viene `null`, el usuario lo debe poder completar manualmente
- si `text` viene `null` pero `fields` tiene datos, el frontend debe seguir usando `fields` con normalidad

---

## 8. Manejo de feedback recomendado en la app

### Estados de UI sugeridos

1. **idle**
   - usuario todavía no subió imagen

2. **validating-local**
   - validar tipo y tamaño antes de pegarle al backend

3. **analyzing**
   - mostrar loading
   - copy sugerido: **"Estamos analizando tu voucher..."**

4. **success-full**
   - extracción completa o casi completa

5. **success-partial**
   - extracción usable pero con `null` y/o warnings

6. **not-voucher**
   - la imagen no era un comprobante

7. **validation-error**
   - archivo inválido

8. **temporary-error**
   - error de AI, timeout, rate limit o error interno

### Feedback visual recomendado

| Caso                       | Qué mostrar                          | Qué debería poder hacer el usuario |
| -------------------------- | ------------------------------------ | ---------------------------------- |
| `VOUCHER` completo         | formulario prellenado                | editar y guardar                   |
| `VOUCHER` parcial          | formulario parcial + aviso           | completar campos faltantes         |
| `VOUCHER` con `text: null` | formulario prellenado desde `fields` | editar y guardar                   |
| `NOT_VOUCHER`              | mensaje amistoso                     | reintentar con otra imagen         |
| error 422                  | mensaje de validación                | cambiar archivo                    |
| error 502 / timeout / red  | mensaje temporal                     | reintentar                         |
| error 401                  | sesión expirada                      | volver a autenticarse              |

---

## 9. Errores que el frontend debe contemplar

### 401 — no autenticado

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized"
  },
  "meta": {
    "timestamp": "2026-03-09T10:30:00.000Z",
    "path": "/api/v1/voucher-analyzer"
  }
}
```

**Acción recomendada:** refrescar sesión o mandar al login.

---

### 422 — archivo inválido

Pasa cuando:

- el archivo no es imagen válida
- el MIME no está permitido
- el archivo está disfrazado
- supera 5 MB

Código esperado:

- `VALIDATION_ERROR`

**Acción recomendada:** mostrar mensaje inline. No auto-retry.

Copy sugerido:

- **"Subí una imagen JPG, PNG o WebP de hasta 5 MB."**

---

### 502 — falla temporal de AI

Puede llegar como:

- `AI_EXECUTION_FAILED`
- `AI_RESPONSE_INVALID`

Ejemplo:

```json
{
  "success": false,
  "error": {
    "code": "AI_EXECUTION_FAILED",
    "message": "AI execution failed"
  },
  "meta": {
    "timestamp": "2026-03-09T10:30:00.000Z",
    "path": "/api/v1/voucher-analyzer",
    "requestId": "req_abc123"
  }
}
```

**Acción recomendada:**

- mostrar error temporal
- permitir reintento
- si existe `requestId`, guardarlo para soporte/debug

Copy sugerido:

- **"No pudimos analizar la imagen en este momento. Probá de nuevo."**

---

### Timeout / errores de red / 5xx generales

El backend tiene timeout global de request, así que el front debe tratar también como reintentable:

- timeout
- red caída
- `500`
- `429`

**Acción recomendada:**

- no perder la imagen seleccionada si es posible
- permitir retry
- no borrar el estado del formulario si ya había datos

---

## 10. Checklist de implementación para Frontend

- [ ] validar en cliente tipo de archivo y tamaño antes de enviar
- [ ] mandar el archivo en el campo `file`
- [ ] enviar token Bearer
- [ ] manejar `200 + NOT_VOUCHER` como caso funcional válido
- [ ] manejar `200 + VOUCHER parcial` sin bloquear al usuario
- [ ] usar `error.code` + HTTP status para decidir UX
- [ ] guardar `requestId` si viene en errores
- [ ] no asumir que todos los campos extraídos vienen completos
- [ ] no asumir que montos/fechas vienen parseados para UI final
- [ ] no asumir que `extraction.text` siempre existe cuando `status = VOUCHER`
- [ ] usar `extraction.fields` como fuente principal para autocompletar

---

## 11. Prueba manual desde PowerShell

> Recomendado: **PowerShell 7+**. Microsoft documenta `Invoke-RestMethod -Form` para `multipart/form-data`, usando `Get-Item` cuando querés mandar un archivo.

### Ejemplo simple

```powershell
$token = 'TU_ACCESS_TOKEN'
$uri = 'https://api.tudominio.com/api/v1/voucher-analyzer'
$file = Get-Item 'C:\temp\voucher.png'

$headers = @{
  Authorization = "Bearer $token"
  Accept        = 'application/json'
}

$response = Invoke-RestMethod `
  -Uri $uri `
  -Method Post `
  -Headers $headers `
  -Form @{ file = $file }

$response | ConvertTo-Json -Depth 10
```

### Ejemplo capturando status HTTP + body aunque falle

Esto sirve para QA o debugging, porque deja ver el envelope de error aunque la respuesta sea 4xx/5xx.

```powershell
$token = 'TU_ACCESS_TOKEN'
$uri = 'https://api.tudominio.com/api/v1/voucher-analyzer'
$file = Get-Item 'C:\temp\voucher.png'

$headers = @{
  Authorization = "Bearer $token"
  Accept        = 'application/json'
}

$status = $null

$response = Invoke-RestMethod `
  -Uri $uri `
  -Method Post `
  -Headers $headers `
  -Form @{ file = $file } `
  -StatusCodeVariable status `
  -SkipHttpErrorCheck

"HTTP $status"
$response | ConvertTo-Json -Depth 10
```

### Qué esperar en PowerShell

- si la imagen es voucher: `HTTP 200` + `success: true`
- si no es voucher: `HTTP 200` + `success: true` + `status: NOT_VOUCHER`
- si el archivo es inválido: `HTTP 422` + `success: false`
- si falla AI: `HTTP 502` + `success: false`

---

## 12. Resumen corto para el equipo Front

Si querés pasarlo en una línea, es esta:

> Suban una imagen en `multipart/form-data` al endpoint `POST /api/v1/voucher-analyzer`, manejando `VOUCHER` y `NOT_VOUCHER` como respuestas exitosas, usando los campos extraídos para prellenar el formulario y tratando `422`/`502`/timeouts como errores recuperables según el caso.

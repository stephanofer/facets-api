# Email Module

> Documentación del módulo de email para Facets API

## Resumen

El módulo de email proporciona una abstracción de alto nivel para envío de emails con:

- **Type-safety completo** - TypeScript valida las variables de cada template
- **Fácil cambio de proveedor** - Cambiar de Mailtrap a SendGrid/Resend sin tocar código de negocio
- **Fácil extensión** - Agregar nuevos templates con mínimo esfuerzo

**Proveedor actual:** Mailtrap (SDK oficial)  
**Método de integración:** API (no SMTP)  
**Sistema de templates:** Mailtrap Templates (Handlebars)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     Tu Código de Negocio                     │
│         (AuthService, UsersService, OrdersService)          │
└─────────────────────────┬───────────────────────────────────┘
                          │ Inyecta
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        MailService                           │
│   • sendTemplate<T>(template, to, variables)                │
│   • send(to, subject, content)                              │
│   • Type-safe con TemplateVariablesMap                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ Usa interface
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      MailProvider                            │
│                      (Interface)                             │
│   • send(options): Promise<void>                            │
│   • sendTemplate<T>(options): Promise<void>                 │
└─────────────────────────┬───────────────────────────────────┘
                          │ Implementa
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Mailtrap   │   │  SendGrid   │   │   Resend    │
│  Provider   │   │  Provider   │   │  Provider   │
│   (Actual)  │   │  (Futuro)   │   │  (Futuro)   │
└─────────────┘   └─────────────┘   └─────────────┘
```

### Principios de Diseño

| Principio                 | Implementación                                                                |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Dependency Inversion**  | `MailService` depende de `MailProvider` (interface), no de `MailtrapProvider` |
| **Open/Closed**           | Agregar nuevos templates sin modificar `MailService`                          |
| **Single Responsibility** | `MailService` = orquestación, `MailtrapProvider` = envío                      |
| **Type Safety**           | `TemplateVariablesMap` garantiza variables correctas por template             |

---

## Estructura de Archivos

```
src/
└── mail/
    ├── mail.module.ts                    # Módulo principal (@Global)
    ├── mail.service.ts                   # Servicio de alto nivel
    ├── mail.service.spec.ts              # Tests unitarios
    │
    ├── providers/
    │   ├── mail-provider.interface.ts    # Contrato (interface + token)
    │   └── mailtrap.provider.ts          # Implementación Mailtrap
    │
    └── templates/
        ├── template.types.ts             # Tipos de variables por template
        └── template.registry.ts          # UUIDs de templates
```

---

## Configuración

### Variables de Entorno

```bash
# .env
MAILTRAP_API_TOKEN="your-mailtrap-api-token"
MAILTRAP_SENDER_EMAIL="noreply@yourdomain.com"
MAILTRAP_SENDER_NAME="Facets"
MAILTRAP_SANDBOX=true
MAILTRAP_TEST_INBOX_ID=123456
```

| Variable                 | Descripción                                        | Requerida   |
| ------------------------ | -------------------------------------------------- | ----------- |
| `MAILTRAP_API_TOKEN`     | Token de API de Mailtrap                           | ✅          |
| `MAILTRAP_SENDER_EMAIL`  | Email del remitente                                | ✅          |
| `MAILTRAP_SENDER_NAME`   | Nombre del remitente (default: "Facets")           | ❌          |
| `MAILTRAP_SANDBOX`       | Usar sandbox para testing (default: true)          | ❌          |
| `MAILTRAP_TEST_INBOX_ID` | ID del inbox de prueba (requerido si sandbox=true) | Condicional |

### Obtener Credenciales

1. Ir a [Mailtrap Dashboard](https://mailtrap.io)
2. Crear una cuenta o iniciar sesión
3. Ir a **API Tokens** → Crear nuevo token
4. Copiar el token al `.env`

Para el sandbox:

1. Ir a **Email Testing** → **Inboxes**
2. Copiar el **Inbox ID** del inbox que quieras usar

---

## Uso

### Enviar Email con Template (Recomendado)

```typescript
import { Injectable } from '@nestjs/common';
import { MailService } from '@mail/mail.service';

@Injectable()
export class AuthService {
  constructor(private readonly mailService: MailService) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);

    // ✅ Type-safe: TypeScript valida las variables
    await this.mailService.sendTemplate('welcome', user.email, {
      userName: user.name,
      appName: 'Facets',
      loginUrl: 'https://app.facets.com/login',
    });

    return user;
  }

  async requestPasswordReset(email: string) {
    const token = await this.generateResetToken(email);

    await this.mailService.sendTemplate('password-reset', email, {
      userName: user.name,
      resetUrl: `https://app.facets.com/reset?token=${token}`,
      expiresInMinutes: 30,
    });
  }
}
```

### Enviar a Múltiples Destinatarios

```typescript
await this.mailService.sendTemplate(
  'welcome',
  [
    { email: 'user1@example.com', name: 'User 1' },
    { email: 'user2@example.com', name: 'User 2' },
  ],
  {
    userName: 'Team',
    appName: 'Facets',
    loginUrl: 'https://app.facets.com/login',
  },
);
```

### Enviar Email Simple (sin template)

```typescript
await this.mailService.send('admin@example.com', 'Alert!', {
  text: 'Something happened',
  html: '<h1>Something happened</h1>',
});
```

---

## Cómo Agregar un Nuevo Template

### Paso 1: Crear el Template en Mailtrap

1. Ir a [Mailtrap Templates](https://mailtrap.io/sending/templates)
2. Click **"Create New Template"**
3. Diseñar usando el editor visual o HTML
4. Usar variables Handlebars: `{{variableName}}`
5. Guardar y copiar el UUID

### Paso 2: Agregar los Tipos

```typescript
// src/mail/templates/template.types.ts

// Agregar la interface con las variables
export interface OrderConfirmationVariables extends TemplateVariables {
  orderNumber: string;
  totalAmount: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

// Agregar al mapa de templates
export interface TemplateVariablesMap {
  welcome: WelcomeEmailVariables;
  'password-reset': PasswordResetEmailVariables;
  'email-verification': EmailVerificationVariables;
  'order-confirmation': OrderConfirmationVariables; // ← Nuevo
}
```

### Paso 3: Registrar el UUID

```typescript
// src/mail/templates/template.registry.ts

export const TEMPLATE_IDS: Record<TemplateName, string> = {
  // ... existentes
  'order-confirmation': 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // ← UUID de Mailtrap
};
```

### Paso 4: Usar el Template

```typescript
// TypeScript valida automáticamente las variables
await this.mailService.sendTemplate('order-confirmation', customer.email, {
  orderNumber: 'ORD-12345',
  totalAmount: 150.0,
  items: [
    { name: 'Product A', quantity: 2, price: 50.0 },
    { name: 'Product B', quantity: 1, price: 50.0 },
  ],
});
```

---

### Testing con Sandbox

Para probar sin enviar emails reales:

1. Ir a **Email Testing** → **Inboxes** en Mailtrap
2. Copiar el **Inbox ID**
3. Configurar en `.env`:
   ```bash
   MAILTRAP_SANDBOX=true
   MAILTRAP_TEST_INBOX_ID=tu-inbox-id
   ```
4. Los emails llegarán al inbox de testing en vez de al destinatario real

---

## Cómo Cambiar de Proveedor

### Ejemplo: Migrar a SendGrid

**Paso 1:** Crear el nuevo provider

```typescript
// src/mail/providers/sendgrid.provider.ts

import { Injectable } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

import { ConfigService } from '@config/config.service';
import {
  MailProvider,
  SendEmailOptions,
  SendTemplateEmailOptions,
  TemplateVariables,
} from '@mail/providers/mail-provider.interface';

@Injectable()
export class SendGridProvider implements MailProvider {
  constructor(private readonly config: ConfigService) {
    sgMail.setApiKey(this.config.sendgridApiKey);
  }

  async send(options: SendEmailOptions): Promise<void> {
    await sgMail.send({
      from: this.config.senderEmail,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  async sendTemplate<T extends TemplateVariables>(
    options: SendTemplateEmailOptions<T>,
  ): Promise<void> {
    await sgMail.send({
      from: this.config.senderEmail,
      to: options.to,
      templateId: options.templateId,
      dynamicTemplateData: options.variables,
    });
  }
}
```

**Paso 2:** Cambiar el binding en el módulo

```typescript
// src/mail/mail.module.ts

import { SendGridProvider } from '@mail/providers/sendgrid.provider';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_PROVIDER,
      useClass: SendGridProvider, // ← Cambiar ACÁ
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
```

**Paso 3:** Actualizar `template.registry.ts` con los IDs de SendGrid

**¡Listo!** El resto del código sigue funcionando igual.

---

## Templates Disponibles

| Template             | Descripción                     | Variables                                 |
| -------------------- | ------------------------------- | ----------------------------------------- |
| `welcome`            | Bienvenida después del registro | `userName`, `appName`, `loginUrl`         |
| `email-verification` | Verificación de email via OTP   | `userName`, `otpCode`, `expiresInMinutes` |
| `password-reset`     | Solicitud de reset de password  | `userName`, `otpCode`, `expiresInMinutes` |

### Templates HTML de Referencia

Los templates HTML están disponibles en `src/mail/templates/html/` para copiar a Mailtrap:

```
src/mail/templates/html/
├── welcome.html             # Template de bienvenida
├── email-verification.html  # Template de verificación de email
└── password-reset.html      # Template de reset de password
```

---

## Testing

### Mockear MailService en Tests

```typescript
const mockMailService = {
  sendTemplate: jest.fn(),
  send: jest.fn(),
};

const module = await Test.createTestingModule({
  providers: [AuthService, { provide: MailService, useValue: mockMailService }],
}).compile();

// Verificar que se envió el email
expect(mockMailService.sendTemplate).toHaveBeenCalledWith(
  'welcome',
  'user@example.com',
  expect.objectContaining({ userName: 'John' }),
);
```

### Ejecutar Tests del Módulo

```bash
pnpm test -- src/mail/mail.service.spec.ts
```

---

## Seguridad

- **NUNCA** loguear el contenido de los emails
- **NUNCA** incluir el API token en logs o errores
- Usar sandbox para desarrollo/testing
- Verificar el dominio antes de enviar a producción
- Validar emails de destinatarios antes de enviar

---

## Referencias

- [Mailtrap Node.js SDK](https://www.npmjs.com/package/mailtrap)
- [Mailtrap Email Templates](https://docs.mailtrap.io/email-api-smtp/email-templates)
- [Handlebars en Mailtrap](https://docs.mailtrap.io/email-api-smtp/email-templates/handlebars)
- [NestJS Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [Mailtrap API Reference](https://api-docs.mailtrap.io/)

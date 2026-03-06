# Storage Architecture — Plan de Implementación

## Decisiones de Diseño

| Decisión           | Elección                                                                                          | Por qué                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Provider cloud     | Cloudflare R2 (S3-compatible API)                                                                 | Sin egress fees, S3-compatible, económico                         |
| SDK                | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`                                            | API estándar S3, provider-swappable                               |
| Upload strategy    | Client → API → R2 (passthrough via Multer memory storage)                                         | Archivos pequeños (<5MB), control total de validación server-side |
| File validation    | `ParseFilePipe` de NestJS con `FileTypeValidator` (magic bytes built-in) + `MaxFileSizeValidator` | NestJS ya valida magic bytes por defecto, no reinventar la rueda  |
| Nombres de archivo | UUID v4 generado por el servidor                                                                  | Evita path traversal, colisiones, y filtra nombre original        |
| Organización R2    | 2 buckets: `facets-public`, `facets-private`                                                      | Separación de concerns a nivel de acceso                          |
| Acceso público     | Custom domain o `r2.dev` subdomain en bucket público                                              | URL directa, sin presigned URL                                    |
| Acceso privado     | Presigned URL con TTL corto (15min)                                                               | Seguridad temporal, sin proxy permanente                          |
| Modelo de datos    | Tabla `File` centralizada como source of truth                                                    | Un solo lugar para buscar cualquier archivo del sistema           |
| Borrado            | Soft delete (`deletedAt`), limpieza de R2 via cron job                                            | Recuperable, consistencia eventual                                |
| SVG                | Prohibido en todos los propósitos                                                                 | Riesgo XSS                                                        |

---

## Paso 1 — Infraestructura Cloudflare R2

### 1.1 Crear los buckets en Cloudflare Dashboard

1. Ir a **R2 Object Storage** en el dashboard de Cloudflare
2. Crear bucket `facets-public`:
   - Habilitar public access vía **Settings > Public Access > r2.dev subdomain** (o configurar custom domain si tenés uno)
   - Configurar CORS (permitir GET desde los orígenes de tu app)
3. Crear bucket `facets-private`:
   - **NO** habilitar public access
   - CORS no necesario (acceso solo via presigned URLs)

### 1.2 Crear API Token

1. En R2 Overview → **Manage R2 API Tokens** → **Create API token**
2. Permisos: **Object Read & Write**
3. Scope: Ambos buckets (`facets-public`, `facets-private`)
4. Copiar: **Access Key ID** y **Secret Access Key**
5. Anotar tu **Account ID** (visible en la URL del dashboard: `dash.cloudflare.com/<ACCOUNT_ID>/r2`)

### 1.3 Variables de entorno resultantes

```env
R2_ACCOUNT_ID=tu_account_id
R2_ACCESS_KEY_ID=tu_access_key_id
R2_SECRET_ACCESS_KEY=tu_secret_access_key
R2_PUBLIC_BUCKET=facets-public
R2_PRIVATE_BUCKET=facets-private
R2_PUBLIC_URL=https://pub-xxx.r2.dev   # o tu custom domain
```

---

## Paso 2 — Base de Datos

### 2.1 Modelo `File` y enum `FilePurpose`

```prisma
enum FilePurpose {
  AVATAR
  TRANSACTION_RECEIPT
  // Agregar futuros propósitos acá
}

model File {
  id     String @id @default(cuid(2))
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  purpose    FilePurpose
  bucket     String      @db.VarChar(100) // "facets-public" | "facets-private"
  key        String      @db.VarChar(500) // path completo en R2: "avatars/<uuid>.webp"
  mimeType   String      @db.VarChar(100) // detectado por magic bytes
  size       Int         // bytes
  originalName String    @db.VarChar(255) // nombre original del cliente (solo para display)

  publicUrl  String?     @db.VarChar(500) // solo si bucket público, URL directa

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // soft delete

  @@unique([bucket, key])
  @@index([userId])
  @@index([userId, purpose])
  @@index([deletedAt])
  @@map("files")
}
```

### 2.2 Cambios en modelos existentes

**UserProfile** — reemplazar `avatarUrl String?` por relación al modelo File:

```prisma
model UserProfile {
  // ... campos existentes ...
  // BORRAR: avatarUrl String? @db.VarChar(500)
  avatarFileId String? @unique
  avatarFile   File?   @relation("ProfileAvatar", fields: [avatarFileId], references: [id], onDelete: SetNull)
}
```

**Transaction** — reemplazar `attachments Json?` por relación:

```prisma
model Transaction {
  // ... campos existentes ...
  // BORRAR: attachments Json?
  attachments File[] @relation("TransactionAttachments")
}
```

Un File pertenece a una sola Transaction (one-to-many)

```prisma
model File {
  // ... campos existentes ...
  transaction   Transaction? @relation("TransactionAttachments", fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId String?

  // Relación inversa para avatar
  profileAvatar UserProfile? @relation("ProfileAvatar")
}
```

> **Nota**: Migración destructiva. Borrar la migración anterior y regenerar con `prisma migrate dev --name add-file-storage`.

### 2.3 Relación en User

Agregar en el modelo `User`:

```prisma
model User {
  // ... campos existentes ...
  files File[]
}
```

---

## Paso 3 — Configuración NestJS

### 3.1 Instalar dependencias

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @types/multer
```

> `@types/multer` como dependency (no dev) porque `Express.Multer.File` se usa en tipos runtime de controllers.
> Multer ya viene incluido con `@nestjs/platform-express`, no hay que instalarlo aparte.

### 3.2 Env validation — agregar a `env.validation.ts`

```typescript
// Storage (R2)
R2_ACCOUNT_ID: z.string().min(1),
R2_ACCESS_KEY_ID: z.string().min(1),
R2_SECRET_ACCESS_KEY: z.string().min(1),
R2_PUBLIC_BUCKET: z.string().min(1),
R2_PRIVATE_BUCKET: z.string().min(1),
R2_PUBLIC_URL: z.url(), // URL base del bucket público
```

### 3.3 Configuration — agregar sección `storage` en `configuration.ts`

```typescript
storage: {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  publicBucket: process.env.R2_PUBLIC_BUCKET,
  privateBucket: process.env.R2_PRIVATE_BUCKET,
  publicUrl: process.env.R2_PUBLIC_URL,
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
},
```

### 3.4 ConfigService — agregar getter tipado

```typescript
get storage() {
  return this.configService.get('storage');
}
```

---

## Paso 4 — StorageModule (Infraestructura)

### 4.1 Estructura de archivos

```
src/
└── storage/
    ├── storage.module.ts
    ├── interfaces/
    │   └── storage-provider.interface.ts
    ├── providers/
    │   └── r2-storage.provider.ts
    ├── services/
    │   └── file.service.ts
    ├── repositories/
    │   └── file.repository.ts
    ├── config/
    │   └── file-purpose.config.ts
    └── helpers/
        └── file-key.helper.ts
```

### 4.2 Interfaz abstracta del provider

```typescript
// storage/interfaces/storage-provider.interface.ts

export interface UploadParams {
  bucket: string;
  key: string;
  body: Buffer;
  mimeType: string;
  cacheControl?: string;
}

export interface StorageProvider {
  upload(params: UploadParams): Promise<void>;
  delete(bucket: string, key: string): Promise<void>;
  getPresignedUrl(
    bucket: string,
    key: string,
    expiresInSeconds: number,
  ): Promise<string>;
}
```

> Si en el futuro se cambia a S3/GCS, solo se implementa esta interfaz. Nada más cambia.

### 4.3 R2 Provider — implementación concreta

```typescript
// storage/providers/r2-storage.provider.ts

@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    const storageConfig = this.config.storage;
    this.client = new S3Client({
      region: 'auto',
      endpoint: storageConfig.endpoint,
      credentials: {
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
      },
    });
  }

  async upload(params: UploadParams): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.mimeType,
        CacheControl: params.cacheControl ?? 'max-age=31536000, immutable',
      }),
    );
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
  }

  async getPresignedUrl(
    bucket: string,
    key: string,
    expiresIn: number,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn },
    );
  }
}
```

### 4.4 File purpose config — el corazón de la extensibilidad

```typescript
// storage/config/file-purpose.config.ts

import { FilePurpose } from '@generated/prisma';

export interface FilePurposeRule {
  maxSizeBytes: number;
  allowedMimeTypes: string[]; // MIME types reales (validados por magic bytes)
  bucket: 'public' | 'private';
  pathPrefix: string; // carpeta dentro del bucket
  presignedUrlTtl?: number; // solo para private, en segundos
}

export const FILE_PURPOSE_CONFIG: Record<FilePurpose, FilePurposeRule> = {
  AVATAR: {
    maxSizeBytes: 2 * 1024 * 1024, // 2MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    bucket: 'public',
    pathPrefix: 'avatars',
  },
  TRANSACTION_RECEIPT: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ],
    bucket: 'private',
    pathPrefix: 'receipts',
    presignedUrlTtl: 900, // 15 minutos
  },
  // Agregar nuevos propósitos es solo agregar una entrada acá
  // + agregar el valor al enum FilePurpose en Prisma
};
```

> **Agregar un nuevo caso de uso en el futuro** = agregar valor al enum + una entrada en este objeto. Nada más.

### 4.5 Estrategia de validación — `ParseFilePipe` de NestJS

NestJS provee un sistema de validación de archivos built-in que ya resuelve nuestras necesidades de seguridad:

- **`FileTypeValidator`** → Valida el MIME type usando **magic bytes del contenido del archivo**, NO el MIME que envía el cliente. Esto ya lo hace por defecto.
- **`MaxFileSizeValidator`** → Valida que el tamaño no exceda el máximo en bytes.
- **`ParseFilePipe`** → Orquesta múltiples validators y lanza excepción si alguno falla.

#### ¿Qué son los magic bytes?

Cada formato de archivo tiene una firma única en sus primeros bytes (llamados "magic numbers"). Por ejemplo:

- JPEG siempre empieza con `FF D8 FF`
- PNG siempre empieza con `89 50 4E 47` (que en ASCII dice `.PNG`)
- PDF siempre empieza con `25 50 44 46` (que en ASCII es `%PDF`)

`FileTypeValidator` de NestJS lee estos bytes del buffer del archivo para determinar el tipo REAL. Si alguien renombra un `.exe` a `.jpg`, el validator lo detecta y lo rechaza porque los magic bytes no corresponden a JPEG.

#### Factory function que genera el `ParseFilePipe` por propósito

En lugar de crear pipes custom, creamos una **factory function** que lee `FILE_PURPOSE_CONFIG` y construye el `ParseFilePipe` de NestJS con los validators correctos:

```typescript
// storage/config/file-purpose.config.ts

import {
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FilePurpose } from '@generated/prisma';

// ... (FILE_PURPOSE_CONFIG como ya está definido arriba) ...

/**
 * Crea un ParseFilePipe configurado para un propósito específico.
 * Lee las reglas de FILE_PURPOSE_CONFIG y construye los validators.
 */
export function createFileValidators(purpose: FilePurpose): ParseFilePipe {
  const rule = FILE_PURPOSE_CONFIG[purpose];

  return new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: rule.maxSizeBytes }),
      new FileTypeValidator({
        fileType: new RegExp(
          rule.allowedMimeTypes.map((t) => t.replace('/', '\\/')).join('|'),
        ),
      }),
    ],
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  });
}
```

#### Uso en un controller (así de simple queda)

```typescript
// Ejemplo: avatar upload en un futuro ProfileController
@Post('avatar')
@UseInterceptors(FileInterceptor('file'))
uploadAvatar(
  @CurrentUser() user: JwtPayload,
  @UploadedFile(createFileValidators(FilePurpose.AVATAR))
  file: Express.Multer.File,
) {
  return this.fileService.upload(file, FilePurpose.AVATAR, user.sub);
}

// Ejemplo: receipt upload en un futuro TransactionController
@Post(':id/receipt')
@UseInterceptors(FileInterceptor('file'))
uploadReceipt(
  @CurrentUser() user: JwtPayload,
  @Param('id', ParseCuidPipe) transactionId: string,
  @UploadedFile(createFileValidators(FilePurpose.TRANSACTION_RECEIPT))
  file: Express.Multer.File,
) {
  return this.fileService.upload(file, FilePurpose.TRANSACTION_RECEIPT, user.sub);
}
```

> **La validación de seguridad (magic bytes + tamaño) la resuelve NestJS.** No necesitamos escribir validators custom. Solo configuramos las reglas por propósito en `FILE_PURPOSE_CONFIG` y la factory function hace el resto.

#### Determinación de extensión para el key en R2

La extensión del archivo almacenado se determina a partir del MIME type validado (que viene de magic bytes), usando un mapa simple:

```typescript
// storage/helpers/file-key.helper.ts

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
```

NUNCA se usa la extensión del nombre original del cliente.

### 4.6 FileService — orquestación

Cuando el archivo llega al `FileService.upload()`, ya pasó por `ParseFilePipe` (tamaño y magic bytes validados). El service solo orquesta:

Flujo de upload:

```
1. El archivo ya está validado (ParseFilePipe lo hizo antes de llegar al service)
2. Leer el mimeType del file.mimetype (ya validado por FileTypeValidator via magic bytes)
3. Resolver extensión desde MIME_TO_EXTENSION map
4. Generar key: `{pathPrefix}/{crypto.randomUUID()}.{ext}`
5. Resolver bucket name real desde config (public/private → env var)
6. Upload a R2 (StorageProvider.upload)
7. Si bucket público → construir publicUrl = `${R2_PUBLIC_URL}/${key}`
8. Crear registro en tabla File (FileRepository.create)
9. Si falla paso 8 → intentar borrar de R2 (best-effort, log si falla)
10. Retornar el File creado
```

Flujo de delete (soft):

```
1. Verificar ownership (userId del File === userId del JWT)
2. Marcar deletedAt = now() en la tabla File
3. NO borrar de R2 inmediatamente
```

### 4.7 Cron job de limpieza

```typescript
// Scheduled task (@nestjs/schedule, ya instalado)
// Cada X horas: buscar Files con deletedAt < now() - 24h
// Para cada uno: StorageProvider.delete() → luego hard delete del registro
// Si falla el delete de R2, loggear y reintentar en la siguiente ejecución
```

### 4.8 StorageModule

```typescript
@Global()
@Module({
  providers: [
    { provide: 'STORAGE_PROVIDER', useClass: R2StorageProvider },
    FileService,
    FileRepository,
  ],
  exports: [FileService],
})
export class StorageModule {}
```

Registrar `StorageModule` en `app.module.ts` junto a los otros módulos de infraestructura.

---

## Paso 5 — Respuesta Estandarizada de Archivos

### 5.1 Formato en las API responses

Cuando cualquier endpoint retorne data que incluya un archivo (avatar, receipt, etc.), el formato será **siempre** el mismo objeto `FileResponse`:

```typescript
// storage/dtos/file-response.dto.ts

export class FileResponse {
  id: string;
  url: string; // publicUrl para públicos, presignedUrl para privados
  mimeType: string;
  size: number;
  purpose: FilePurpose;
}
```

### 5.2 Resolución de URL

El `FileService` expone un método `resolveUrl(file: File): Promise<string>`:

- **Archivo público** → retorna `file.publicUrl` (URL directa, no expira)
- **Archivo privado** → genera presigned URL con el TTL de su purpose config

### 5.3 Ejemplos de cómo se ve en las responses

**GET /api/v1/users/:id/profile** (avatar es público):

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "phone": "+5491155557777",
    "avatar": {
      "id": "clx...",
      "url": "https://pub-xxx.r2.dev/avatars/550e8400.webp",
      "mimeType": "image/webp",
      "size": 45200,
      "purpose": "AVATAR"
    },
    "countryCode": "AR"
  }
}
```

**GET /api/v1/transactions/:id** (receipt es privado):

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "amount": "1500.00",
    "attachments": [
      {
        "id": "clx...",
        "url": "https://xxx.r2.cloudflarestorage.com/receipts/...?X-Amz-Signature=...",
        "mimeType": "image/jpeg",
        "size": 102400,
        "purpose": "TRANSACTION_RECEIPT"
      }
    ]
  }
}
```

> Mismo shape `FileResponse` en ambos casos. La diferencia es solo la URL (directa vs presigned). El consumer no necesita saber si es público o privado.

---

## Paso 6 — Multer Config

Configurar Multer a nivel global con `memoryStorage` (buffer en memoria) y un límite de seguridad general de 10MB como safety net. La validación real por propósito se hace en el pipe.

```typescript
// En StorageModule o donde se registre
MulterModule.register({
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // safety net global
});
```

---

## Orden de Implementación

| #   | Qué                                                                                      | Dependencia |
| --- | ---------------------------------------------------------------------------------------- | ----------- |
| 1   | Crear buckets en Cloudflare + obtener credentials                                        | —           |
| 2   | Agregar env vars a `.env` + `env.validation.ts` + `configuration.ts` + `ConfigService`   | 1           |
| 3   | Prisma schema: enum `FilePurpose`, model `File`, modificar `UserProfile` y `Transaction` | —           |
| 4   | Ejecutar `prisma migrate dev --name add-file-storage`                                    | 3           |
| 5   | Instalar `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@types/multer`          | —           |
| 6   | `StorageProvider` interface + `R2StorageProvider` implementación                         | 2, 5        |
| 7   | `file-purpose.config.ts` + factory `createFileValidators()`                              | 3           |
| 8   | `file-key.helper.ts` (UUID + MIME_TO_EXTENSION map)                                      | —           |
| 9   | `FileRepository`                                                                         | 4           |
| 10  | `FileService` (orquestación upload/delete/resolveUrl)                                    | 6, 8, 9     |
| 11  | `StorageModule` (registrar todo, exportar `FileService`) + Multer config                 | 6-10        |
| 12  | `FileResponse` DTO + Swagger decorators                                                  | —           |
| 13  | Cron job de limpieza de archivos soft-deleted                                            | 10, 11      |
| 14  | Tests unitarios del StorageModule (mock del provider)                                    | 11          |

> Después de estos 14 pasos, las bases están sentadas. Implementar avatar upload o receipt upload en un feature module se reduce a: usar `FileInterceptor` + `createFileValidators(purpose)` + llamar `FileService.upload()`.

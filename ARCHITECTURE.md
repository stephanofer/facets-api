# Facets API - Architecture Documentation

> Finance tracker SaaS API built with NestJS 11 + Prisma 7 + PostgreSQL

## Table of Contents

1. [Core Principles](#core-principles)
2. [Directory Structure](#directory-structure)
3. [Module Architecture](#module-architecture)
4. [API Design Standards](#api-design-standards)
5. [Response Standardization](#response-standardization)
6. [Error Handling](#error-handling)
7. [Authentication & Authorization](#authentication--authorization)
8. [Database Patterns](#database-patterns)
9. [Testing Strategy](#testing-strategy)
10. [Configuration Management](#configuration-management)
11. [Health Checks & Monitoring](#health-checks--monitoring)
12. [Performance & Scalability](#performance--scalability)
13. [Security Checklist](#security-checklist)

---

## Core Principles

### Design Philosophy

| Principle                  | Description                                         |
| -------------------------- | --------------------------------------------------- |
| **Simple First**           | Start simple, add complexity only when needed       |
| **Explicit over Implicit** | No barrel files, direct imports, clear dependencies |
| **Consistency**            | Same patterns everywhere, predictable codebase      |
| **Cost-Efficient**         | Optimize for PostgreSQL, minimize external services |
| **Scalable by Default**    | Multi-tenant ready, feature-flag friendly           |

### Non-Negotiables

- **No barrel files** (`index.ts` for re-exports)
- **Path aliases** (`@common/`, `@database/`, `@modules/`) instead of relative imports
- **pnpm** as package manager
- **Direct imports** from source files, never from index

---

## Directory Structure

```
src/
├── main.ts                     # Bootstrap + global pipes/filters/interceptors
├── app.module.ts               # Root module (imports only)
│
├── common/                     # Shared utilities (GLOBAL)
│   ├── constants/              # App-wide constants
│   │   └── app.constants.ts
│   ├── decorators/             # Custom decorators
│   │   ├── current-user.decorator.ts
│   │   ├── public.decorator.ts
│   │   └── api-paginated.decorator.ts
│   ├── dtos/                   # Shared DTOs
│   │   ├── pagination.dto.ts
│   │   └── id-param.dto.ts
│   ├── filters/                # Exception filters
│   │   └── all-exceptions.filter.ts
│   ├── guards/                 # Auth guards
│   │   ├── jwt-auth.guard.ts
│   ├── interceptors/           # Response transform, logging
│   │   ├── transform-response.interceptor.ts
│   │   ├── logging.interceptor.ts
│   │   └── timeout.interceptor.ts
│   ├── interfaces/             # Shared interfaces
│   │   └── api-response.interface.ts
│   ├── pipes/                  # Custom validation pipes
│   │   └── parse-cuid.pipe.ts
│   └── utils/                  # Pure utility functions
│       └── date.utils.ts
│
├── config/                     # Configuration module
│   ├── config.module.ts
│   ├── config.service.ts
│   ├── env.validation.ts       # Zod schema for env validation
│   └── configuration.ts        # Config factory
│
├── database/                   # Prisma module
│   ├── database.module.ts
│   ├── prisma.service.ts
│   └── prisma.extension.ts     # Prisma Client extensions (soft delete, etc.)
│
├── health/                     # Health checks
│   ├── health.module.ts
│   └── health.controller.ts
│
└── modules/                    # Feature modules
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── strategies/
    │   │   ├── jwt.strategy.ts
    │   │   └── jwt-refresh.strategy.ts
    │   ├── dtos/
    │   │   ├── login.dto.ts
    │   │   ├── register.dto.ts
    │   │   └── tokens.dto.ts
    │   └── auth.service.spec.ts
    │
    ├── users/
    │   ├── users.module.ts
    │   ├── users.controller.ts
    │   ├── users.service.ts
    │   ├── users.repository.ts      # Data access layer
    │   ├── dtos/
    │   │   ├── create-user.dto.ts
    │   │   └── update-user.dto.ts
    │   ├── users.service.spec.ts
    │   └── users.controller.spec.ts
    │
    ├── accounts/                    # Bank accounts, cards, cash
    ├── transactions/                # Expenses & Incomes
    ├── categories/                  # Transaction categories
    ├── debts/                       # Debt tracking
    ├── loans/                       # Loan management
    ├── goals/                       # Financial goals
    └── recurring/                   # Recurring payments

prisma/
├── schema.prisma               # Single schema file
├── migrations/                 # Auto-generated migrations
└── seed.ts                     # Database seeding

test/
├── fixtures/                   # Test data factories
│   └── user.fixture.ts
├── helpers/                    # Test utilities
│   └── test-app.helper.ts
└── *.e2e-spec.ts              # E2E tests
```

---

## Module Architecture

### Feature Module Template

Each feature module follows this structure:

```typescript
// modules/[feature]/[feature].module.ts
@Module({
  imports: [DatabaseModule], // Only import what you need
  controllers: [FeatureController],
  providers: [FeatureService, FeatureRepository],
  exports: [FeatureService], // Export SERVICE, not module
})
export class FeatureModule {}
```

### Layer Responsibilities

| Layer          | File Pattern      | Responsibility                      |
| -------------- | ----------------- | ----------------------------------- |
| **Controller** | `*.controller.ts` | HTTP handling, validation, response |
| **Service**    | `*.service.ts`    | Business logic, orchestration       |
| **Repository** | `*.repository.ts` | Data access, Prisma queries         |

### Module Dependencies

```
                    ┌─────────────┐
                    │  AppModule  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ ConfigModule  │  │DatabaseModule │  │ HealthModule  │
│   (Global)    │  │   (Global)    │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
        │                  │
        └────────┬─────────┘
                 │
        ┌────────┴────────┐
        │   AuthModule    │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│ Users  │  │Accounts│  │  ...   │
└────────┘  └────────┘  └────────┘
```

---

## API Design Standards

### URL Conventions

```
Base URL: /api/v1

Resources (nouns, plural, kebab-case):
  GET    /api/v1/users                 # List users
  GET    /api/v1/users/:id             # Get user
  POST   /api/v1/users                 # Create user
  PATCH  /api/v1/users/:id             # Partial update
  DELETE /api/v1/users/:id             # Delete user

Nested resources:
  GET    /api/v1/users/:userId/accounts
  GET    /api/v1/accounts/:accountId/transactions

Actions (verbs, when CRUD doesn't fit):
  POST   /api/v1/auth/login
  POST   /api/v1/auth/logout
  POST   /api/v1/auth/refresh
  POST   /api/v1/transactions/:id/duplicate

Filtering, sorting, pagination:
  GET    /api/v1/transactions?page=1&limit=20
  GET    /api/v1/transactions?sort=createdAt:desc
  GET    /api/v1/transactions?filter[type]=expense&filter[accountId]=abc123
```

### HTTP Methods

| Method | Usage            | Idempotent | Response |
| ------ | ---------------- | ---------- | -------- |
| GET    | Read resource(s) | Yes        | 200      |
| POST   | Create resource  | No         | 201      |
| PATCH  | Partial update   | Yes        | 200      |
| PUT    | Full replace     | Yes        | 200      |
| DELETE | Remove resource  | Yes        | 204      |

### Versioning Strategy

- URL versioning: `/api/v1/`, `/api/v2/`
- Major version changes only for breaking changes
- Maintain one previous version for 6 months

---

## Response Standardization

### Success Response Format

```typescript
// Single resource
{
  "success": true,
  "data": {
    "id": "clx1234567890",
    "email": "user@example.com",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}

// Collection with pagination
{
  "success": true,
  "data": [...],
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}

// Empty response (204 No Content)
// No body
```

### Response Interface

```typescript
// common/interfaces/api-response.interface.ts
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    pagination?: PaginationMeta;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### Transform Response Interceptor

```typescript
// common/interceptors/transform-response.interceptor.ts
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data?.data ?? data,
        meta: {
          timestamp: new Date().toISOString(),
          ...(data?.meta && { pagination: data.meta }),
        },
      })),
    );
  }
}
```

---

## Error Handling

### Error Response Format

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/v1/users",
    "requestId": "req_abc123"
  }
}
```

### Error Codes

| Code                  | HTTP Status | Description               |
| --------------------- | ----------- | ------------------------- |
| `VALIDATION_ERROR`    | 400         | Request validation failed |
| `INVALID_CREDENTIALS` | 401         | Wrong email/password      |
| `TOKEN_EXPIRED`       | 401         | JWT expired               |
| `UNAUTHORIZED`        | 401         | Not authenticated         |
| `FORBIDDEN`           | 403         | Not authorized            |
| `RESOURCE_NOT_FOUND`  | 404         | Entity not found          |
| `CONFLICT`            | 409         | Duplicate resource        |
| `RATE_LIMIT_EXCEEDED` | 429         | Too many requests         |
| `INTERNAL_ERROR`      | 500         | Server error              |

### Exception Filter

```typescript
// common/filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    const { status, code, message, details } = this.parseException(exception);

    const responseBody: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.id,
      },
    };

    // Log to Sentry for 5xx errors
    if (status >= 500) {
      Sentry.captureException(exception);
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, status);
  }
}
```

### Custom Exceptions

```typescript
// common/exceptions/business.exception.ts
export class BusinessException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>[],
  ) {
    super({ code, message, details }, status);
  }
}

// Usage
throw new BusinessException(
  'INSUFFICIENT_BALANCE',
  'Account balance is insufficient for this transaction',
  HttpStatus.UNPROCESSABLE_ENTITY,
);
```

---

### Guards

```typescript
// Public routes (no auth required)
@Public()
@Post('login')

// Authenticated routes (default)
@Get('me')

```

### Multi-Tenancy

All resources are scoped by `userId`. The `@CurrentUser()` decorator extracts the user from JWT:

```typescript
@Get('accounts')
findAll(@CurrentUser() user: JwtPayload) {
  return this.accountsService.findAllByUser(user.sub);
}
```

---

## Database Patterns

### Prisma Schema Conventions

```prisma

// Use CUID2 for IDs (shorter, URL-safe, secure)
model User {
  id        String   @id @default(cuid(2))
  email     String   @unique
  password  String
  name      String?

  // Timestamps on EVERY model
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Soft delete (optional, per model)
  deletedAt DateTime?

  // Relations
  accounts     Account[]
  transactions Transaction[]

  // Indexes
  @@index([email])
  @@map("users")  // Snake_case table names
}

model Account {
  id       String      @id @default(cuid(2))
  name     String
  type     AccountType
  balance  Decimal     @db.Decimal(19, 4)  // Money precision
  currency String      @default("USD") @db.VarChar(3)

  // Owner relationship
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@map("accounts")
}

enum AccountType {
  CASH
  DEBIT_CARD
  CREDIT_CARD
  SAVINGS
  INVESTMENT
}
```

### Repository Pattern

```typescript
// modules/users/users.repository.ts
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
```

### Pagination Helper

```typescript
// common/utils/pagination.utils.ts
export async function paginate<T>(
  prisma: PrismaClient,
  model: string,
  args: {
    where?: object;
    orderBy?: object;
    page: number;
    limit: number;
  },
): Promise<{ data: T[]; meta: PaginationMeta }> {
  const { where, orderBy, page, limit } = args;
  const skip = (page - 1) * limit;

  const [data, total] = await prisma.$transaction([
    prisma[model].findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prisma[model].count({ where }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}
```

---

## Testing Strategy

### Test Pyramid

```
            ┌───────────┐
            │   E2E     │  ~10%  (Critical user flows)
            │   Tests   │
            └─────┬─────┘
                  │
          ┌───────┴───────┐
          │  Integration  │  ~20%  (API endpoints)
          │    Tests      │
          └───────┬───────┘
                  │
      ┌───────────┴───────────┐
      │     Unit Tests        │  ~70%  (Services, utils)
      └───────────────────────┘
```

### File Naming

| Type | Location             | Naming                  |
| ---- | -------------------- | ----------------------- |
| Unit | `src/**/*.spec.ts`   | `users.service.spec.ts` |
| E2E  | `test/*.e2e-spec.ts` | `auth.e2e-spec.ts`      |

### Unit Test Example

```typescript
// modules/users/users.service.spec.ts
describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const mockRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(UsersRepository);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const user = { id: 'abc123', email: 'test@example.com' };
      repository.findById.mockResolvedValue(user);

      const result = await service.findById('abc123');

      expect(result).toEqual(user);
      expect(repository.findById).toHaveBeenCalledWith('abc123');
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('abc123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
```

### E2E Test Example

```typescript
// test/auth.e2e-spec.ts
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);

    // Apply same config as main.ts
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    await app.init();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.$executeRaw`TRUNCATE users CASCADE`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should create new user and return tokens', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecureP@ss123',
          name: 'Test User',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.accessToken).toBeDefined();
          expect(res.body.data.refreshToken).toBeDefined();
        });
    });

    it('should return 409 for duplicate email', async () => {
      // Create user first
      await prisma.user.create({
        data: { email: 'test@example.com', password: 'hashed' },
      });

      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecureP@ss123',
        })
        .expect(409);
    });
  });
});
```

### Test Database

```bash
# .env.test
DATABASE_URL="postgresql://user:pass@localhost:5432/facets_test"
```

---

## Configuration Management

### Environment Variables

```bash
# .env.example
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/facets"

# JWT
JWT_ACCESS_SECRET="your-access-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"

# App
NODE_ENV="development"
PORT=3000
API_PREFIX="api"
API_VERSION="v1"

# Sentry
SENTRY_DSN="https://xxx@sentry.io/xxx"

# Rate Limiting
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=100
```

### Zod Validation

```typescript
// config/env.validation.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
```

### Config Module

```typescript
// config/config.module.ts
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
```

---

## Health Checks & Monitoring

### Health Endpoint

```
GET /health          → Full health check
GET /health/live     → Liveness probe (always 200)
GET /health/ready    → Readiness probe (checks dependencies)
```

### Health Controller

```typescript
// health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
```

### Health Response

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" }
  }
}
```

### Monitoring Checklist

- [x] Health endpoints
- [x] Sentry for error tracking
- [x] Request ID in all responses
- [x] Structured logging (JSON in production)
- [ ] Metrics endpoint (Prometheus) - future
- [ ] Distributed tracing (OpenTelemetry) - future

---

## Performance & Scalability

### Optimization Strategies

| Strategy               | Implementation                                  | Impact                 |
| ---------------------- | ----------------------------------------------- | ---------------------- |
| **Connection Pooling** | Prisma default (pool_size in URL)               | Prevents DB exhaustion |
| **Query Optimization** | Use `select` instead of `include` when possible | Reduce data transfer   |
| **Compression**        | Gzip response compression                       | Reduce bandwidth       |
| **Pagination**         | Cursor-based for large datasets                 | Consistent performance |

### Database Indexes

Always index:

- Foreign keys (`userId`, `accountId`, etc.)
- Frequently filtered fields
- Sort fields

```prisma
model Transaction {
  // ...
  @@index([userId, createdAt(sort: Desc)])  // Common query pattern
  @@index([accountId])
}
```

### Rate Limiting

```typescript
// main.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,    // 1 minute window
      limit: 100,     // 100 requests per window
    }]),
  ],
})
```

---

## Security Checklist

### Must Have (Day 1)

- [x] **HTTPS only** (enforced at load balancer)
- [x] **Helmet** - Security headers
- [x] **CORS** - Configured for allowed origins
- [x] **Rate Limiting** - Prevent brute force
- [x] **Input Validation** - class-validator on all DTOs
- [x] **SQL Injection** - Prisma parameterized queries
- [x] **Password Hashing** - bcrypt with salt rounds 12
- [x] **JWT Security** - Short expiry, refresh rotation
- [x] **Sensitive Data** - Never log passwords, tokens

### Main.ts Security Setup

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true, // Auto-transform types
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.useGlobalInterceptors(
    new TransformResponseInterceptor(),
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
  );

  await app.listen(process.env.PORT || 3000);
}
```

---

### Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@common/*": ["src/common/*"],
      "@config/*": ["src/config/*"],
      "@database/*": ["src/database/*"],
      "@modules/*": ["src/modules/*"],
      "@health/*": ["src/health/*"]
    }
  }
}
```

---

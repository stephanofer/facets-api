# Facets API

Facets is a professional finance tracker SaaS application. It supports multi-tenant user accounts with features like transaction (e.g Expenses, Incomes) tracking, accounts (e.g debit card, cash), debts management, loans management, goals, recurring payments, and future new features. Available on iOS, Android and Web.

We are using Expo to create the app

All of this is designed to be scalable, to quickly add new features, to be able to add support for multiple countries and currencies.

We have a pricing system for our SaaS with a free tier and 2 additional plans

## Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action                                                                | Skill              |
| --------------------------------------------------------------------- | ------------------ |
| Work with NestJS modules, controllers, services, guards, interceptors | `nestjs-expert`    |
| Work with Prisma schema, migrations, queries, relations               | `prisma-expert`    |
| Audit security                                                        | `security-auditor` |

### Design Philosophy

| Principle                  | Description                                         |
| -------------------------- | --------------------------------------------------- |
| **Simple First**           | Start simple, add complexity only when needed       |
| **Explicit over Implicit** | No barrel files, direct imports, clear dependencies |
| **Consistency**            | Same patterns everywhere, predictable codebase      |
| **Cost-Efficient**         | Optimize for PostgreSQL, minimize external services |
| **Scalable by Default**    | Multi-tenant ready, feature-flag friendly           |

## Non-negotiables

- Never use barrel files (index.ts for re-exports)

- Always use path aliases (@common/, @database/, etc.) instead of relative imports

- Always import directly from the source file, not from an index

- Always use pnpm as the package manager

- Always new endpoint must be covered by unit and e2e tests and integration tests if it has complex logic

- Always new endpoints must be added to Swagger documentation with proper request/response schemas,etc,etc.

- Use `Promise.all` only for **independent operations**; if one operation depends on another result, execute them sequentially

## Tech Stack

| Component        | Location           | Technology                 |
| ---------------- | ------------------ | -------------------------- |
| API              | `src/`             | NestJS 11, Prisma ORM 7    |
| Database         | `prisma/`          | PostgreSQL                 |
| Unit Tests       | `src/**/*.spec.ts` | Jest                       |
| E2E Tests        | `test/`            | @nestjs/testing, Supertest |
| Error Monitoring | `Sentry`           | Sentry SDK                 |
| Documentation    | `Swagger`          | Swagger                    |
| Email Service    | `Mailtrap`         | Mailtrap SDK               |

## Directory Structure

```
src/
├── main.ts                     # Bootstrap + global pipes/filters/interceptors
├── instrument.ts               # Sentry/source-map instrumentation bootstrap
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
│   ├── exceptions/             # Shared business exceptions
│   │   └── business.exception.ts
│   ├── guards/                 # Auth guards
│   │   ├── jwt-auth.guard.ts
│   │   └── feature.guard.ts
│   ├── interceptors/           # Response transform, logging
│   │   ├── transform-response.interceptor.ts
│   │   ├── logging.interceptor.ts
│   │   ├── timeout.interceptor.ts
│   │   └── timing.interceptor.ts
│   ├── interfaces/             # Shared interfaces
│   │   └── api-response.interface.ts
│   ├── pipes/                  # Custom validation pipes
│   │   └── parse-cuid.pipe.ts
│   └── utils/                  # Pure utility functions
│       ├── date.utils.ts
│       └── pagination.utils.ts
│
├── config/                     # Configuration module
│   ├── config.module.ts
│   ├── config.service.ts
│   ├── env.validation.ts       # Zod schema for env validation
│   ├── env.validation.spec.ts
│   └── configuration.ts        # Config factory
│
├── database/                   # Prisma module
│   ├── database.module.ts
│   └── prisma.service.ts
│
├── health/                     # Health checks
│   ├── health.module.ts
│   ├── health.controller.ts
│   └── prisma-health.indicator.ts
│
├── ai/                         # AI orchestration and provider integrations
├── mail/                       # Transactional email module
├── storage/                    # File storage providers and services
│
└── modules/                    # Feature modules
    ├── accounts/
    ├── categories/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── refresh-tokens.repository.ts
    │   ├── strategies/
    │   │   ├── jwt.strategy.ts
    │   │   └── jwt-refresh.strategy.ts
    │   ├── dtos/
    │   │   ├── login.dto.ts
    │   │   ├── register.dto.ts
    │   │   ├── refresh-token.dto.ts
    │   │   ├── auth-response.dto.ts
    │   │   ├── upload-avatar.dto.ts
    │   │   └── verification.dto.ts
    │   └── auth.service.spec.ts
    │
    ├── otp/
    ├── receipt-extraction/
    ├── storage-debug/
    ├── subscriptions/
    ├── transactions/
    ├── users/
    │   ├── users.module.ts
    │   ├── users.service.ts
    │   ├── users.repository.ts      # Data access layer
    ├── voucher-analyzer/
    └── workspaces/

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

### Multi-Tenancy

All resources are scoped by `userId`. The `@CurrentUser()` decorator extracts the user from JWT:

```typescript
@Get('accounts')
findAll(@CurrentUser() user: JwtPayload) {
  return this.accountsService.findAllByUser(user.sub);
}
```

### Layer Responsibilities

| Layer          | File Pattern      | Responsibility                      |
| -------------- | ----------------- | ----------------------------------- |
| **Controller** | `*.controller.ts` | HTTP handling, validation, response |
| **Service**    | `*.service.ts`    | Business logic, orchestration       |
| **Repository** | `*.repository.ts` | Data access, Prisma queries         |

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

| Type | Location             | Naming                     |
| ---- | -------------------- | -------------------------- |
| Unit | `src/**/*.spec.ts`   | `accounts.service.spec.ts` |
| E2E  | `test/*.e2e-spec.ts` | `auth.e2e-spec.ts`         |

### Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@ai/*": ["src/ai/*"],
      "@common/*": ["src/common/*"],
      "@config/*": ["src/config/*"],
      "@database/*": ["src/database/*"],
      "@modules/*": ["src/modules/*"],
      "@health/*": ["src/health/*"],
      "@mail/*": ["src/mail/*"],
      "@storage/*": ["src/storage/*"]
    }
  }
}
```

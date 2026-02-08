# Facets API

Facets is a professional finance tracker SaaS application. It supports multi-tenant user accounts with features like transaction (e.g Expenses, Incomes) tracking, accounts (e.g debit card, cash), debts management, loans management, goals, recurring payments, and future new features. Available on iOS, Android and Web.

We are using Expo to create the apps

All of this is designed to be scalable, to quickly add new features, to be able to add support for multiple countries and currencies.

We have a pricing system for our SaaS with a free tier and 2 additional plans

## Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action                                                                | Skill           |

| --------------------------------------------------------------------- | --------------- |

| Work with NestJS modules, controllers, services, guards, interceptors | `nestjs-expert` |

| Work with Prisma schema, migrations, queries, relations               | `prisma-expert` |
| Audit Security | `security-audit` |

## Non-negotiables

- Never use barrel files (index.ts for re-exports)

- Always use path aliases (@common/, @database/, etc.) instead of relative imports

- Always import directly from the source file, not from an index

- Always use pnpm as the package manager

- Always new endpoint must be covered by unit and e2e tests and integration tests if it has complex logic

- Always new endpoints must be added to Swagger documentation with proper request/response schemas,etc,etc.

## Tech Stack

| Component  | Location           | Technology                 |

| ---------- | ------------------ | -------------------------- |

| API        | `src/`             | NestJS 11, Prisma ORM 7    |

| Database   | `prisma/`          | PostgreSQL                 |

| Unit Tests | `src/**/*.spec.ts` | Jest                       |

| E2E Tests  | `test/`            | @nestjs/testing, Supertest |

| Error Monitoring | Sentry | Sentry SDK |
| Documentation | Swagger | Swagger |
| Email Service | Mailtrap | Mailtrap SDK |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

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

## Lecciones Aprendidas

Errores comunes que encontramos durante el desarrollo y cómo evitarlos.

### 2. Actualizar mocks cuando cambia la implementación interna

**Problema**: Al refactorizar `register()` para usar `prisma.$transaction()` directamente (en vez de `usersService.creaate()` + `subscriptionsService.createSubscriptionForNewUser()`), los tests seguían mockeando los métodos viejos.

**Solución**: Cuando se cambia la implementación de un método, revisar qué dependencias/métodos se están invocando ahora y actualizar los mocks acorde. 

### 4. No cachear datos con IDs dinámicos de alta cardinalidad

**Problema**: Cachear queries como `findById(id)` en repositorios donde los IDs son UUID dinámicos genera cache keys infinitas sin beneficio real (baja tasa de hit).

**Solución**: Solo cachear datos de baja cardinalidad y alta frecuencia de lectura (como planes, configuraciones, features). Si un dato cambia con cada request, no vale la pena cachearlo.

### 6. Promise.all solo para operaciones INDEPENDIENTES

**Problema**: Paralelizar queries que dependen unas de otras causa race conditions o errores.

**Solución**: Solo usar `Promise.all` cuando las operaciones son 100% independientes entre sí. Si una necesita el resultado de otra, deben ser secuenciales. Ejemplo correcto:

```typescript
// ✅ Independientes: generar tokens no depende de obtener el plan
const [tokens, plan] = await Promise.all([
  this.generateTokens(user),
  this.getUserPlan(user.id),
]);
```

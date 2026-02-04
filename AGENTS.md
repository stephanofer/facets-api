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

## Non-negotiables

- Never use barrel files (index.ts for re-exports)

- Always use path aliases (@common/, @database/, etc.) instead of relative imports

- Always import directly from the source file, not from an index

- Always use pnpm as the package manager

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

├── instrument.ts           # Sentry initialization (must be imported first)

├── main.ts                 # Application bootstrap

├── app.module.ts           # Root module

├── common/                 # Shared utilities (global)

│   ├── decorators/         # Custom decorators

│   ├── dtos/               # Shared DTOs

│   ├── filters/            # Exception filters

│   ├── guards/             # Auth guards

│   ├── interceptors/       # Response transform, logging

│   └── pipes/              # Custom validation pipes

├── config/                 # Configuration module

├── database/               # Prisma module

├── health/                 # Health checks

├── mail/                   # Email module (Mailtrap)
│   ├── providers/          # Mail provider implementations
│   └── templates/          # Email template types and registry

└── modules/                # Feature modules

    ├── auth/               # Authentication

    ├── users/              # User management

    ├── accounts/           # Bank accounts, cards

    ├── transactions/       # Expenses & Incomes

    ├── categories/         # Transaction categories

    ├── debts/              # Debt tracking

    ├── loans/              # Loan management

    ├── goals/              # Financial goals

    └── recurring/          # Recurring payments



prisma/

├── schema.prisma           # Database schema

├── migrations/             # Migration history

└── seed.ts                 # Database seeding



test/

└── *.e2e-spec.ts          # E2E tests

```

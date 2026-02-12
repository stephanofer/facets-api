# Facets API - Database Schema Documentation

> Complete database schema reference for the Facets finance tracker SaaS.
> Built with Prisma ORM 7 + PostgreSQL.

## Table of Contents

1. [Overview](#overview)
2. [Schema Conventions](#schema-conventions)
3. [Entity Relationship Diagram](#entity-relationship-diagram)
4. [Core Authentication (Phases 1-2)](#core-authentication-phases-1-2)
5. [Subscription System (Phases 3-4)](#subscription-system-phases-3-4)
6. [User Profile & Preferences (Phase 5)](#user-profile--preferences-phase-5)
7. [Reference Data (Phase 5)](#reference-data-phase-5)
8. [Financial Accounts (Phase 6)](#financial-accounts-phase-6)
9. [Categories (Phase 7)](#categories-phase-7)
10. [Transactions (Phase 8)](#transactions-phase-8)
11. [Debts (Phase 9)](#debts-phase-9)
12. [Loans (Phase 10)](#loans-phase-10)
13. [Financial Goals (Phase 11)](#financial-goals-phase-11)
14. [Recurring Payments (Phase 12)](#recurring-payments-phase-12)
15. [Index Strategy](#index-strategy)
16. [Seed Data](#seed-data)
17. [Design Decisions Summary](#design-decisions-summary)

---

## Overview

The Facets database schema is organized into 12 phases, each representing a logical feature group. The schema supports:

- **Multi-tenant isolation**: Every resource is scoped by `userId`
- **Multi-currency**: All monetary entities have their own `currencyCode` FK
- **Soft deletion patterns**: `isArchived` (accounts), `isActive` (categories), `deletedAt` (users)
- **Financial precision**: `Decimal(19,4)` for all money fields
- **Denormalized performance fields**: `remainingAmount`, `currentAmount`, `paidInstallments`

### Table Count

| Group           | Tables | Description                                                                                                    |
| --------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Auth            | 3      | User, RefreshToken, OtpCode                                                                                    |
| Subscriptions   | 4      | Plan, Subscription, PlanFeature, PlanChangeLog, UsageRecord                                                    |
| Profile & Prefs | 3      | UserProfile, PreferenceDefinition, UserPreference                                                              |
| Reference Data  | 2      | Currency, Country                                                                                              |
| Feature Modules | 10     | Account, Category, Transaction, Debt, DebtPayment, Loan, LoanPayment, Goal, GoalContribution, RecurringPayment |
| **Total**       | **22** |                                                                                                                |

### Enum Count: 22

---

## Schema Conventions

| Convention    | Rule                                              | Example                                      |
| ------------- | ------------------------------------------------- | -------------------------------------------- |
| IDs           | CUID2 (`@default(cuid(2))`)                       | `clx1234567890abcdef`                        |
| Table names   | snake_case via `@@map()`                          | `@@map("recurring_payments")`                |
| Money fields  | `Decimal(19,4)`                                   | Handles up to 999 trillion, 4 decimal places |
| Currency FKs  | `VarChar(3)` ISO 4217                             | `currencyCode String @db.VarChar(3)`         |
| Timestamps    | `createdAt` + `updatedAt` on every model          | `@default(now())` / `@updatedAt`             |
| Soft delete   | Per-model pattern (not universal)                 | `deletedAt`, `isArchived`, `isActive`        |
| Cascade rules | Cascade from User, Restrict on Accounts with txns | `onDelete: Cascade` / implicit Restrict      |

---

## Entity Relationship Diagram

```
User (1)──────────(1) UserProfile
  │                       │
  │                       ├── Country (FK)
  │                       └── Currency (FK)
  │
  ├──(1)──────────(1) Subscription ──── Plan
  │                                      │
  │                                      └── PlanFeature[]
  ├──(*)── RefreshToken[]
  ├──(*)── OtpCode[]
  ├──(*)── UsageRecord[]
  ├──(*)── PlanChangeLog[]
  ├──(*)── UserPreference[] ──── PreferenceDefinition
  │
  ├──(*)── Account[] ──── Currency (FK)
  │           │
  │           ├── Transaction[] (source)
  │           ├── Transaction[] (transfer destination)
  │           ├── DebtPayment[]
  │           ├── LoanPayment[]
  │           ├── GoalContribution[]
  │           └── RecurringPayment[]
  │
  ├──(*)── Category[] (custom, userId set)
  │           │
  │           ├── Category[] (children, self-relation)
  │           └── Transaction[]
  │
  │        Category[] (system, userId=NULL)
  │
  ├──(*)── Transaction[] ──── Category (FK)
  │           │                Account (FK source)
  │           │                Account? (FK transfer dest)
  │           │                Currency (FK)
  │           └──────────────── RecurringPayment? (FK)
  │
  ├──(*)── Debt[] ──── Currency (FK)
  │           └── DebtPayment[] ──── Account? (FK)
  │                                  Currency (FK)
  │
  ├──(*)── Loan[] ──── Currency (FK)
  │           └── LoanPayment[] ──── Account? (FK)
  │                                   Currency (FK)
  │
  ├──(*)── Goal[] ──── Currency (FK)
  │           └── GoalContribution[] ──── Account? (FK)
  │                                        Currency (FK)
  │
  └──(*)── RecurringPayment[] ──── Account (FK)
              └── Transaction[] (generated)
```

---

## Core Authentication (Phases 1-2)

### User

| Column            | Type              | Description                                              |
| ----------------- | ----------------- | -------------------------------------------------------- |
| `id`              | `CUID2` (PK)      | Unique identifier                                        |
| `email`           | `String` (unique) | User's email                                             |
| `password`        | `String`          | bcrypt hashed password                                   |
| `firstName`       | `String`          | First name                                               |
| `lastName`        | `String`          | Last name                                                |
| `emailVerified`   | `Boolean`         | Whether email is verified                                |
| `emailVerifiedAt` | `DateTime?`       | When email was verified                                  |
| `status`          | `UserStatus`      | `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `DELETED` |
| `createdAt`       | `DateTime`        | Creation timestamp                                       |
| `updatedAt`       | `DateTime`        | Last update timestamp                                    |
| `deletedAt`       | `DateTime?`       | Soft delete timestamp                                    |

**Indexes**: `[email]`, `[status]`

### RefreshToken

| Column      | Type                 | Description                  |
| ----------- | -------------------- | ---------------------------- |
| `id`        | `CUID2` (PK)         |                              |
| `token`     | `String` (unique)    | SHA-256 hashed refresh token |
| `userId`    | `String` (FK → User) | Owner, cascade delete        |
| `userAgent` | `String?`            | Browser/device info          |
| `ipAddress` | `String?`            | Client IP                    |
| `expiresAt` | `DateTime`           | Token expiration             |
| `revokedAt` | `DateTime?`          | When manually revoked        |

**Indexes**: `[userId]`, `[token]`, `[expiresAt]`

### OtpCode

| Column        | Type                 | Description                            |
| ------------- | -------------------- | -------------------------------------- |
| `id`          | `CUID2` (PK)         |                                        |
| `code`        | `String`             | SHA-256 hashed 6-digit OTP             |
| `type`        | `OtpType`            | `EMAIL_VERIFICATION`, `PASSWORD_RESET` |
| `userId`      | `String` (FK → User) | Cascade delete                         |
| `attempts`    | `Int`                | Current attempt count (default 0)      |
| `maxAttempts` | `Int`                | Max allowed attempts (default 5)       |
| `expiresAt`   | `DateTime`           | OTP expiration                         |
| `usedAt`      | `DateTime?`          | When OTP was used                      |

**Indexes**: `[userId, type, usedAt, expiresAt]`, `[expiresAt]`

---

## Subscription System (Phases 3-4)

### Plan

| Column          | Type              | Description                    |
| --------------- | ----------------- | ------------------------------ |
| `id`            | `CUID2` (PK)      |                                |
| `code`          | `String` (unique) | `'free'`, `'pro'`, `'premium'` |
| `name`          | `String`          | Display name                   |
| `description`   | `String?`         | Plan description               |
| `priceMonthly`  | `Decimal(10,2)`   | Monthly price                  |
| `priceCurrency` | `VarChar(3)`      | Default `'USD'`                |
| `priceYearly`   | `Decimal(10,2)?`  | Annual price (discounted)      |
| `isActive`      | `Boolean`         | Whether plan is available      |
| `isDefault`     | `Boolean`         | Default plan for new users     |
| `sortOrder`     | `Int`             | Display order                  |

**Indexes**: `[code]`, `[isActive, sortOrder]`

### PlanFeature

| Column        | Type                 | Description                                                            |
| ------------- | -------------------- | ---------------------------------------------------------------------- |
| `id`          | `CUID2` (PK)         |                                                                        |
| `planId`      | `String` (FK → Plan) | Cascade delete                                                         |
| `featureCode` | `String`             | e.g. `'accounts'`, `'transactions_per_month'`                          |
| `limitType`   | `FeatureLimitType`   | `BOOLEAN`, `COUNT`, `UNLIMITED`                                        |
| `limitValue`  | `Int`                | Limit number (0/1 for boolean, -1 for unlimited)                       |
| `featureType` | `FeatureType`        | `RESOURCE` (count from table) or `CONSUMABLE` (count from UsageRecord) |
| `limitPeriod` | `LimitPeriod?`       | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`                                 |

**Unique**: `[planId, featureCode]`

### Subscription

| Column              | Type                         | Description                                              |
| ------------------- | ---------------------------- | -------------------------------------------------------- |
| `id`                | `CUID2` (PK)                 |                                                          |
| `userId`            | `String` (unique, FK → User) | One subscription per user                                |
| `planId`            | `String` (FK → Plan)         | Current plan                                             |
| `status`            | `SubscriptionStatus`         | `ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELLED`, `EXPIRED` |
| `scheduledPlanId`   | `String?` (FK → Plan)        | For pending downgrades                                   |
| `scheduledChangeAt` | `DateTime?`                  | When scheduled change takes effect                       |
| `cancelledAt`       | `DateTime?`                  | When user cancelled                                      |
| `graceOverages`     | `Json?`                      | Resources exceeding new plan limits                      |
| `gracePeriodEnd`    | `DateTime?`                  | Grace period deadline                                    |

### PlanChangeLog

Audit trail for all plan changes (upgrades, downgrades, cancellations).

| Column            | Type                 | Description                                                 |
| ----------------- | -------------------- | ----------------------------------------------------------- |
| `fromPlanId`      | `String` (FK → Plan) | Previous plan                                               |
| `toPlanId`        | `String` (FK → Plan) | New plan                                                    |
| `changeType`      | `PlanChangeType`     | `UPGRADE`, `DOWNGRADE_SCHEDULED`, `DOWNGRADE_APPLIED`, etc. |
| `prorationAmount` | `Decimal(10,2)?`     | Pro-rated amount                                            |

### UsageRecord

Tracks consumable feature usage per period (e.g., transactions per month).

| Column                      | Type                 | Description                     |
| --------------------------- | -------------------- | ------------------------------- |
| `userId`                    | `String` (FK → User) |                                 |
| `featureCode`               | `String`             | e.g. `'transactions_per_month'` |
| `periodType`                | `LimitPeriod`        | Period granularity              |
| `periodStart` / `periodEnd` | `DateTime`           | Period boundaries               |
| `count`                     | `Int`                | Usage count within period       |

**Unique**: `[userId, featureCode, periodStart]`

---

## User Profile & Preferences (Phase 5)

### UserProfile (1:1 with User)

Separated from User to keep auth queries fast (User table is hit on EVERY authenticated request).

| Column                  | Type                         | Description                       |
| ----------------------- | ---------------------------- | --------------------------------- |
| `userId`                | `String` (unique, FK → User) |                                   |
| `phone`                 | `VarChar(20)?`               | E.164 format                      |
| `avatarUrl`             | `VarChar(500)?`              | Profile picture URL               |
| `countryCode`           | `VarChar(2)?` (FK → Country) | User's country                    |
| `currencyCode`          | `VarChar(3)` (FK → Currency) | Default currency, default `'USD'` |
| `timezone`              | `VarChar(50)`                | IANA timezone, default `'UTC'`    |
| `locale`                | `VarChar(10)`                | BCP 47 locale, default `'en-US'`  |
| `onboardingCompletedAt` | `DateTime?`                  | When onboarding finished          |

### PreferenceDefinition

Registry of all configurable preferences. Acts as a "schema" for preferences.

| Column         | Type                 | Description                                                                       |
| -------------- | -------------------- | --------------------------------------------------------------------------------- |
| `category`     | `PreferenceCategory` | `DASHBOARD`, `APPEARANCE`, `NOTIFICATIONS`, `PRIVACY`, `REGIONAL`, `TRANSACTIONS` |
| `key`          | `VarChar(100)`       | e.g. `'theme'`, `'push_enabled'`                                                  |
| `dataType`     | `PreferenceDataType` | `BOOLEAN`, `STRING`, `NUMBER`, `JSON`, `STRING_ARRAY`                             |
| `defaultValue` | `Json`               | Default value                                                                     |
| `label`        | `VarChar(200)`       | Human-readable label                                                              |

**Unique**: `[category, key]`

### UserPreference

Per-user overrides. Only stores preferences that DIFFER from the default.

| Column         | Type                                 | Description         |
| -------------- | ------------------------------------ | ------------------- |
| `userId`       | `String` (FK → User)                 |                     |
| `preferenceId` | `String` (FK → PreferenceDefinition) |                     |
| `value`        | `Json`                               | User's custom value |

**Unique**: `[userId, preferenceId]`

---

## Reference Data (Phase 5)

### Currency (ISO 4217)

Single source of truth for currencies across the entire app. ~30 currencies seeded.

| Column         | Type              | Description                            |
| -------------- | ----------------- | -------------------------------------- |
| `code`         | `VarChar(3)` (PK) | ISO 4217: `USD`, `EUR`, `ARS`          |
| `name`         | `VarChar(100)`    | `'US Dollar'`, `'Euro'`                |
| `symbol`       | `VarChar(10)`     | `'$'`, `'€'`                           |
| `decimalScale` | `Int`             | Decimal places (2 for most, 0 for JPY) |
| `isActive`     | `Boolean`         | Soft-disable                           |

### Country (ISO 3166-1)

~35 countries seeded with default currency and locale.

| Column         | Type              | Description                       |
| -------------- | ----------------- | --------------------------------- |
| `code`         | `VarChar(2)` (PK) | ISO 3166-1 alpha-2: `US`, `AR`    |
| `name`         | `VarChar(100)`    | `'United States'`, `'Argentina'`  |
| `currencyCode` | `VarChar(3)`      | Default currency for this country |
| `phoneCode`    | `VarChar(10)`     | `'+1'`, `'+54'`                   |
| `locale`       | `VarChar(10)`     | BCP 47 locale tag                 |

---

## Financial Accounts (Phase 6)

### Account

Represents WHERE money lives (bank accounts, cash, credit cards, etc.).

| Column                | Type                         | Description                                                                             |
| --------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| `id`                  | `CUID2` (PK)                 |                                                                                         |
| `userId`              | `String` (FK → User)         | Cascade delete                                                                          |
| `name`                | `VarChar(100)`               | Account name                                                                            |
| `type`                | `AccountType`                | `CASH`, `DEBIT_CARD`, `CREDIT_CARD`, `SAVINGS`, `INVESTMENT`, `DIGITAL_WALLET`, `OTHER` |
| `balance`             | `Decimal(19,4)`              | Running balance (default 0)                                                             |
| `currencyCode`        | `VarChar(3)` (FK → Currency) | Account's currency                                                                      |
| `color`               | `VarChar(7)?`                | Hex color for UI                                                                        |
| `icon`                | `VarChar(50)?`               | Icon identifier                                                                         |
| `includeInTotal`      | `Boolean`                    | Include in dashboard total (default true)                                               |
| `isArchived`          | `Boolean`                    | Soft-archive (default false)                                                            |
| `creditLimit`         | `Decimal(19,4)?`             | Credit card only                                                                        |
| `statementClosingDay` | `Int?`                       | Day of month (1-31), credit card only                                                   |
| `paymentDueDay`       | `Int?`                       | Day of month (1-31), credit card only                                                   |
| `sortOrder`           | `Int`                        | User-defined display order                                                              |

**Indexes**: `[userId, isArchived]`, `[userId, type]`, `[userId, currencyCode]`

> **Note**: Accounts with transactions cannot be deleted (implicit Restrict). Use `isArchived = true` instead.

---

## Categories (Phase 7)

### Category

Two-level hierarchical categories supporting system categories (shared by all users) and user custom categories.

| Column      | Type                      | Description                           |
| ----------- | ------------------------- | ------------------------------------- |
| `id`        | `CUID2` (PK)              |                                       |
| `userId`    | `String?` (FK → User)     | `NULL` = system category              |
| `parentId`  | `String?` (FK → Category) | `NULL` = top-level, set = subcategory |
| `name`      | `VarChar(100)`            | Category name                         |
| `type`      | `TransactionType`         | `EXPENSE`, `INCOME`, `TRANSFER`       |
| `icon`      | `VarChar(50)?`            | Icon identifier                       |
| `color`     | `VarChar(7)?`             | Hex color                             |
| `isSystem`  | `Boolean`                 | System categories are read-only       |
| `isActive`  | `Boolean`                 | Soft-disable                          |
| `sortOrder` | `Int`                     | Display order                         |

**Unique**: `[userId, name, type, parentId]`
**Indexes**: `[userId, type, isActive]`, `[parentId]`, `[isSystem, type, isActive]`

#### Category Types

| Pattern | `userId`  | `isSystem` | Description                    |
| ------- | --------- | ---------- | ------------------------------ |
| System  | `NULL`    | `true`     | Shared by all users, read-only |
| Custom  | User's ID | `false`    | User-created, editable         |

#### Hierarchy Rules

- Maximum **2 levels** (parent → children)
- Children inherit the `type` from their parent
- System categories are seeded with comprehensive defaults (see [Seed Data](#seed-data))

---

## Transactions (Phase 8)

### Transaction

The CORE table. Every financial movement is a Transaction.

| Column                | Type                              | Description                                     |
| --------------------- | --------------------------------- | ----------------------------------------------- |
| `id`                  | `CUID2` (PK)                      |                                                 |
| `userId`              | `String` (FK → User)              | Cascade delete                                  |
| `type`                | `TransactionType`                 | `EXPENSE`, `INCOME`, `TRANSFER`                 |
| `amount`              | `Decimal(19,4)`                   | **ALWAYS POSITIVE**. Type determines direction. |
| `currencyCode`        | `VarChar(3)` (FK → Currency)      | Original transaction currency                   |
| `exchangeRate`        | `Decimal(19,10)?`                 | Rate if currency != account currency            |
| `accountId`           | `String` (FK → Account)           | Source account (required)                       |
| `transferToAccountId` | `String?` (FK → Account)          | Destination (TRANSFER type only)                |
| `categoryId`          | `String?` (FK → Category)         | SetNull on category delete                      |
| `description`         | `VarChar(500)?`                   | Short description                               |
| `notes`               | `String?`                         | Extended notes                                  |
| `date`                | `Date`                            | User-facing date (when it happened)             |
| `attachments`         | `Json?`                           | `string[]` of receipt/photo URLs                |
| `tags`                | `Json?`                           | `string[]` for flexible filtering               |
| `isReconciled`        | `Boolean`                         | For bank reconciliation (future)                |
| `isPending`           | `Boolean`                         | Pending charges (credit cards)                  |
| `source`              | `TransactionSource`               | `MANUAL`, `RECURRING`, `IMPORT`                 |
| `recurringPaymentId`  | `String?` (FK → RecurringPayment) | If generated from template                      |

**Indexes** (7 composite — most indexed table):

| Index                             | Use Case                                   |
| --------------------------------- | ------------------------------------------ |
| `[userId, date DESC]`             | Dashboard: recent transactions             |
| `[userId, accountId, date DESC]`  | Account detail view                        |
| `[userId, type, date DESC]`       | Filter by type + time                      |
| `[userId, categoryId, date DESC]` | Reports: spending by category              |
| `[accountId]`                     | FK lookups                                 |
| `[transferToAccountId]`           | FK lookups for transfers                   |
| `[recurringPaymentId]`            | Find transactions from a recurring payment |

#### Transfer Model

Transfers use a **single-row model**:

```
Transaction {
  type: TRANSFER,
  accountId: "checking_account",        // Source (money leaves)
  transferToAccountId: "savings_account", // Destination (money enters)
  amount: 500.00                          // Always positive
}
```

Why single-row? Atomic, no orphaned half-transfers, simpler than paired transactions.

---

## Debts (Phase 9)

### Debt

Informal money owed to/from people. NOT formal loans with interest.

| Column             | Type                         | Description                                  |
| ------------------ | ---------------------------- | -------------------------------------------- |
| `id`               | `CUID2` (PK)                 |                                              |
| `userId`           | `String` (FK → User)         |                                              |
| `counterpartyName` | `VarChar(200)`               | "Juan Perez", "Mi hermano"                   |
| `direction`        | `DebtDirection`              | `I_OWE` or `THEY_OWE`                        |
| `originalAmount`   | `Decimal(19,4)`              | Original debt amount                         |
| `remainingAmount`  | `Decimal(19,4)`              | **Denormalized**: original - sum(payments)   |
| `currencyCode`     | `VarChar(3)` (FK → Currency) |                                              |
| `dueDate`          | `Date?`                      | Optional deadline                            |
| `status`           | `DebtStatus`                 | `ACTIVE`, `SETTLED`, `FORGIVEN`, `CANCELLED` |

**Indexes**: `[userId, status]`, `[userId, direction, status]`, `[userId, dueDate]`

### DebtPayment

Partial payments toward a debt. Links to the account the money came from.

| Column      | Type                     | Description           |
| ----------- | ------------------------ | --------------------- |
| `debtId`    | `String` (FK → Debt)     | Cascade delete        |
| `amount`    | `Decimal(19,4)`          | Payment amount        |
| `accountId` | `String?` (FK → Account) | Source account        |
| `paidAt`    | `DateTime`               | When payment was made |

---

## Loans (Phase 10)

### Loan

Formal loans with interest rates and installment plans.

| Column              | Type                         | Description                                    |
| ------------------- | ---------------------------- | ---------------------------------------------- |
| `id`                | `CUID2` (PK)                 |                                                |
| `userId`            | `String` (FK → User)         |                                                |
| `lenderName`        | `VarChar(200)`               | "Banco Nacion", "Mi tio Carlos"                |
| `direction`         | `LoanDirection`              | `BORROWED` or `LENT`                           |
| `principalAmount`   | `Decimal(19,4)`              | Original loan amount                           |
| `remainingBalance`  | `Decimal(19,4)`              | Current outstanding balance                    |
| `currencyCode`      | `VarChar(3)` (FK → Currency) |                                                |
| `interestRate`      | `Decimal(7,4)`               | Annual rate (APR). `12.5000` = 12.5%           |
| `interestType`      | `InterestType`               | `FIXED` or `VARIABLE`                          |
| `totalInstallments` | `Int`                        | Total number of installments                   |
| `paidInstallments`  | `Int`                        | **Denormalized**: count of paid installments   |
| `monthlyPayment`    | `Decimal(19,4)`              | Expected amount per installment                |
| `startDate`         | `Date`                       | Loan start date                                |
| `endDate`           | `Date?`                      | Expected end date                              |
| `nextPaymentDate`   | `Date?`                      | When next payment is due                       |
| `status`            | `LoanStatus`                 | `ACTIVE`, `PAID_OFF`, `DEFAULTED`, `CANCELLED` |

**Indexes**: `[userId, status]`, `[userId, direction, status]`, `[userId, nextPaymentDate]`

### LoanPayment

Individual installment payments with principal/interest breakdown.

| Column              | Type                     | Description                                |
| ------------------- | ------------------------ | ------------------------------------------ |
| `loanId`            | `String` (FK → Loan)     | Cascade delete                             |
| `installmentNumber` | `Int`                    | Which installment (1, 2, 3...)             |
| `amount`            | `Decimal(19,4)`          | Total payment                              |
| `principalAmount`   | `Decimal(19,4)`          | Principal portion                          |
| `interestAmount`    | `Decimal(19,4)`          | Interest portion                           |
| `accountId`         | `String?` (FK → Account) | Source account                             |
| `dueDate`           | `Date`                   | When installment was due                   |
| `paidAt`            | `DateTime?`              | When actually paid                         |
| `status`            | `LoanPaymentStatus`      | `PENDING`, `DUE`, `PAID`, `LATE`, `MISSED` |

**Unique**: `[loanId, installmentNumber]`
**Indexes**: `[loanId, status]`, `[userId, dueDate]`, `[userId, paidAt DESC]`

---

## Financial Goals (Phase 11)

### Goal

Savings targets. NOT tied to a specific account.

| Column           | Type                         | Description                                        |
| ---------------- | ---------------------------- | -------------------------------------------------- |
| `id`             | `CUID2` (PK)                 |                                                    |
| `userId`         | `String` (FK → User)         |                                                    |
| `name`           | `VarChar(200)`               | "Emergency Fund", "Vacation 2027"                  |
| `targetAmount`   | `Decimal(19,4)`              | How much to save                                   |
| `currentAmount`  | `Decimal(19,4)`              | **Denormalized**: sum of contributions (default 0) |
| `currencyCode`   | `VarChar(3)` (FK → Currency) |                                                    |
| `color` / `icon` | `VarChar`                    | UI customization                                   |
| `targetDate`     | `Date?`                      | Optional deadline                                  |
| `completedAt`    | `DateTime?`                  | When goal was reached                              |
| `status`         | `GoalStatus`                 | `ACTIVE`, `COMPLETED`, `PAUSED`, `CANCELLED`       |

**Indexes**: `[userId, status]`, `[userId, targetDate]`

**Progress** is calculated at the application layer: `progress = (currentAmount / targetAmount) * 100`

### GoalContribution

Individual contributions (or withdrawals) toward a goal.

| Column      | Type                     | Description                                |
| ----------- | ------------------------ | ------------------------------------------ |
| `goalId`    | `String` (FK → Goal)     | Cascade delete                             |
| `amount`    | `Decimal(19,4)`          | **Can be negative** (withdrawal from goal) |
| `accountId` | `String?` (FK → Account) | Source account                             |
| `date`      | `DateTime`               | When contribution was made                 |

---

## Recurring Payments (Phase 12)

### RecurringPayment

Transaction templates with scheduling. Generates actual Transaction records.

| Column              | Type                    | Description                                                     |
| ------------------- | ----------------------- | --------------------------------------------------------------- |
| `id`                | `CUID2` (PK)            |                                                                 |
| `userId`            | `String` (FK → User)    |                                                                 |
| `name`              | `VarChar(200)`          | "Netflix", "Rent", "Salary"                                     |
| `type`              | `TransactionType`       | `EXPENSE` or `INCOME`                                           |
| `amount`            | `Decimal(19,4)`         | Template amount                                                 |
| `currencyCode`      | `VarChar(3)`            |                                                                 |
| `accountId`         | `String` (FK → Account) | Source account                                                  |
| `categoryId`        | `String?`               | Category for generated transactions                             |
| `frequency`         | `RecurringFrequency`    | `DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY` |
| `frequencyInterval` | `Int`                   | Every N [frequency] (default 1)                                 |
| `startDate`         | `Date`                  | When recurring starts                                           |
| `endDate`           | `Date?`                 | Optional: stop after this date                                  |
| `nextOccurrence`    | `Date?`                 | **Pre-computed** next fire date                                 |
| `lastGeneratedAt`   | `DateTime?`             | Prevents double-generation                                      |
| `occurrencesCount`  | `Int`                   | How many times fired                                            |
| `maxOccurrences`    | `Int?`                  | Optional: stop after N occurrences                              |
| `notifyBeforeDays`  | `Int`                   | Notify user N days before (default 0)                           |
| `status`            | `RecurringStatus`       | `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`                    |

**Indexes**: `[userId, status]`, `[nextOccurrence, status]` (CRON job), `[userId, type, status]`

#### Schedule Examples

| Description    | `frequency` | `frequencyInterval` |
| -------------- | ----------- | ------------------- |
| Every month    | `MONTHLY`   | 1                   |
| Every 2 weeks  | `WEEKLY`    | 2                   |
| Every quarter  | `QUARTERLY` | 1                   |
| Every 3 months | `MONTHLY`   | 3                   |
| Annually       | `YEARLY`    | 1                   |

---

## Index Strategy

### Principles

1. **Every table starts with `userId`** in composite indexes (multi-tenant isolation)
2. **Date fields sorted DESC** for "most recent first" queries
3. **Status fields** in indexes for filtering active/inactive records
4. **FK columns** always indexed for JOIN performance

### Most Critical Indexes (Transaction table)

The Transaction table has **7 composite indexes** — the most of any table — because it's the most queried entity:

```prisma
@@index([userId, date(sort: Desc)])              // Dashboard
@@index([userId, accountId, date(sort: Desc)])    // Account detail
@@index([userId, type, date(sort: Desc)])          // Type filter
@@index([userId, categoryId, date(sort: Desc)])    // Category reports
@@index([accountId])                               // FK lookup
@@index([transferToAccountId])                     // Transfer FK
@@index([recurringPaymentId])                      // Recurring source
```

### CRON Job Index

```prisma
// RecurringPayment: efficiently find payments due today
@@index([nextOccurrence, status])
```

---

## Seed Data

### What Gets Seeded

| Data                   | Count | Description                                                           |
| ---------------------- | ----- | --------------------------------------------------------------------- |
| Currencies             | 30    | ISO 4217, most common worldwide                                       |
| Countries              | 35    | ISO 3166-1, with default currency & locale                            |
| Preference Definitions | 21    | Dashboard, appearance, notifications, privacy, regional, transactions |
| Plans                  | 3     | Free, Pro ($4.99/mo), Premium ($9.99/mo)                              |
| Plan Features          | 36    | 12 features x 3 plans                                                 |
| System Categories      | ~63   | 23 parent + ~40 subcategories (13 expense, 7 income, 3 transfer)      |

### System Categories Summary

**Expenses** (13 parents, ~40 subcategories):
Food & Drinks, Transportation, Housing, Shopping, Entertainment, Health, Education, Subscriptions, Personal Care, Travel, Taxes & Fees, Pets, Other Expense

**Income** (7 parents, ~8 subcategories):
Salary, Freelance, Investments, Rental Income, Gifts Received, Refunds, Other Income

**Transfers** (3 parents, no subcategories):
Account Transfer, Investment Transfer, Savings Transfer

### Running Seeds

```bash
# Seed all reference data
pnpm prisma db seed

# Seeds are idempotent — safe to run multiple times
# Uses upsert for unique-constrained data
# Uses findFirst + create/update for categories (nullable compound unique)
```

---

## Design Decisions Summary

| Decision                   | Choice                                                 | Why                                                                         |
| -------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Money precision            | `Decimal(19,4)`                                        | Handles all currencies (including BHD with 3 decimals), up to 999 trillion  |
| Transaction amounts        | Always positive                                        | No double-negative confusion (`-50 EXPENSE`). Type determines direction     |
| Transfer model             | Single row                                             | Atomic, no orphaned half-transfers, simpler than paired transactions        |
| Category hierarchy         | Max 2 levels                                           | Matches YNAB/Mint/Money Manager. Simpler queries, better mobile UX          |
| System + custom categories | Same table                                             | Single FK from Transaction, no UNION queries                                |
| Denormalized fields        | `remainingAmount`, `currentAmount`, `paidInstallments` | Critical for sorting/filtering. Kept in sync by service layer               |
| Account deletion           | Soft-archive (`isArchived`)                            | Never delete accounts with transactions (breaks audit trail)                |
| Currency per entity        | FK to `currencies` table                               | Multi-currency support without schema changes                               |
| Recurring payments         | Template pattern                                       | Generates Transaction records, allows amount/account changes per occurrence |
| `nextOccurrence`           | Pre-computed                                           | CRON job efficiency — no date arithmetic on every check                     |
| User → UserProfile         | 1:1 separation                                         | Auth queries stay fast (User hit on every request, profile rarely needed)   |
| Preferences                | Definition + Override                                  | New preferences = DB INSERT, not code deploy. Storage efficient             |
| IDs                        | CUID2                                                  | Shorter than UUID, URL-safe, cryptographically secure, no ordering leaks    |
| Cascade rules              | Cascade from User, Restrict on Accounts                | User deletion cleans everything. Can't delete account with transactions     |

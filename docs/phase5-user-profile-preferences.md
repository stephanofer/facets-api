# Phase 5: User Profile, Preferences & Reference Data

> Database design for user profiles, extensible preferences, and reference tables (currencies/countries).

## Overview

Phase 5 adds 5 new models to support:

| Model                  | Purpose                               | Rows Expected |
| ---------------------- | ------------------------------------- | ------------- |
| `Currency`             | ISO 4217 currency reference           | ~30 (seeded)  |
| `Country`              | ISO 3166-1 country reference          | ~35 (seeded)  |
| `UserProfile`          | Extended user details (1:1 with User) | 1 per user    |
| `PreferenceDefinition` | Registry of available preferences     | ~21 (seeded)  |
| `UserPreference`       | Per-user preference overrides         | 0-N per user  |

## Architecture Decisions

### Why `UserProfile` is separated from `User`

The `User` table is hit on **every authenticated request** (JWT → `findById`). Adding profile columns (phone, avatar, country, timezone) would bring unnecessary data on every auth check. By separating:

- **Auth hot path stays fast** — `User` only has email, password, status
- **Profile loads only when needed** — profile/settings screens
- **Independent caching** — profile can be cached separately

### Why `Currency` and `Country` are tables (not enums)

- **~180 currencies, ~250 countries** — enums this large are unmanageable in PostgreSQL
- **Adding a new country = INSERT**, not a migration + deployment
- **Low cardinality + high read frequency = perfect cache candidates** (aligns with lesson learned #4)
- **`decimalScale`** on Currency allows correct formatting (JPY = 0 decimals, USD = 2, BHD = 3)

### Why Preferences use a Definition + Override pattern

Instead of a single JSON blob or EAV table:

```
┌──────────────────────────┐     ┌────────────────────────┐
│  PreferenceDefinition    │     │    UserPreference       │
│  (what CAN be set)       │────▶│  (what user HAS set)   │
│                          │     │                        │
│  category + key (unique) │     │  userId + prefId (unique)│
│  dataType                │     │  value (JSONB)         │
│  defaultValue (JSONB)    │     │                        │
└──────────────────────────┘     └────────────────────────┘
```

**Benefits:**

- New preference = `INSERT INTO preference_definitions`, no code change
- Frontend queries definitions to dynamically render settings screens
- Only stores overrides (storage efficient — most users keep defaults)
- Definitions are cacheable (rarely change)

## Entity Relationship Diagram

```
Currency (PK: code VARCHAR(3))
    │
    └──< UserProfile.currencyCode

Country (PK: code VARCHAR(2))
    │
    └──< UserProfile.countryCode

User
    │
    ├──── UserProfile (1:1, ON DELETE CASCADE)
    │         ├── phone, avatarUrl
    │         ├── countryCode → Country
    │         ├── currencyCode → Currency
    │         ├── timezone, locale
    │         └── onboardingCompletedAt
    │
    └──< UserPreference (1:N, ON DELETE CASCADE)
              │
              └── preferenceId → PreferenceDefinition
                                    ├── category (enum)
                                    ├── key
                                    ├── dataType (enum)
                                    └── defaultValue (JSONB)
```

## Indexes

| Table                    | Index                             | Reason                                 |
| ------------------------ | --------------------------------- | -------------------------------------- |
| `currencies`             | `isActive`                        | Filter active currencies for dropdowns |
| `countries`              | `isActive`                        | Filter active countries for dropdowns  |
| `countries`              | `currencyCode`                    | Lookup default currency by country     |
| `user_profiles`          | `userId` (unique)                 | 1:1 lookup                             |
| `user_profiles`          | `countryCode`                     | Analytics queries by country           |
| `user_profiles`          | `currencyCode`                    | Analytics queries by currency          |
| `preference_definitions` | `(category, key)` (unique)        | Prevent duplicate definitions          |
| `preference_definitions` | `(category, isActive)`            | Fetch active prefs by category         |
| `user_preferences`       | `(userId, preferenceId)` (unique) | One override per user per pref         |
| `user_preferences`       | `userId`                          | Fetch all overrides for a user         |

## Seeded Data

### Currencies (30 total)

Americas: `USD`, `CAD`, `MXN`, `ARS`, `BRL`, `CLP`, `COP`, `PEN`, `UYU`
Europe: `EUR`, `GBP`, `CHF`, `SEK`, `NOK`, `DKK`, `PLN`
Asia/Oceania: `JPY`, `CNY`, `KRW`, `INR`, `AUD`, `NZD`, `SGD`, `HKD`, `TWD`
Middle East/Africa: `AED`, `SAR`, `ILS`, `ZAR`, `TRY`

### Countries (35 total)

Each country includes its default currency, phone code, and BCP 47 locale.

### Preference Definitions (21 total)

| Category          | Key                         | Type    | Default        |
| ----------------- | --------------------------- | ------- | -------------- |
| **DASHBOARD**     | `show_total_balance`        | BOOLEAN | `true`         |
| **DASHBOARD**     | `show_recent_transactions`  | BOOLEAN | `true`         |
| **DASHBOARD**     | `show_spending_chart`       | BOOLEAN | `true`         |
| **DASHBOARD**     | `show_goals_progress`       | BOOLEAN | `true`         |
| **DASHBOARD**     | `show_upcoming_payments`    | BOOLEAN | `true`         |
| **DASHBOARD**     | `show_debts_summary`        | BOOLEAN | `false`        |
| **DASHBOARD**     | `recent_transactions_count` | NUMBER  | `5`            |
| **APPEARANCE**    | `theme`                     | STRING  | `"system"`     |
| **APPEARANCE**    | `compact_mode`              | BOOLEAN | `false`        |
| **NOTIFICATIONS** | `push_enabled`              | BOOLEAN | `true`         |
| **NOTIFICATIONS** | `email_weekly_summary`      | BOOLEAN | `false`        |
| **NOTIFICATIONS** | `notify_recurring_payments` | BOOLEAN | `true`         |
| **NOTIFICATIONS** | `notify_goal_milestones`    | BOOLEAN | `true`         |
| **NOTIFICATIONS** | `notify_budget_exceeded`    | BOOLEAN | `true`         |
| **PRIVACY**       | `analytics_opt_in`          | BOOLEAN | `true`         |
| **PRIVACY**       | `hide_amounts_on_preview`   | BOOLEAN | `false`        |
| **REGIONAL**      | `date_format`               | STRING  | `"DD/MM/YYYY"` |
| **REGIONAL**      | `number_format`             | STRING  | `"1,234.56"`   |
| **REGIONAL**      | `first_day_of_week`         | STRING  | `"monday"`     |
| **TRANSACTIONS**  | `default_transaction_type`  | STRING  | `"expense"`    |
| **TRANSACTIONS**  | `confirm_before_delete`     | BOOLEAN | `true`         |

## Usage Examples (Prisma Queries)

### Create profile during registration

```typescript
// Inside auth.service register() transaction
const profile = await tx.userProfile.create({
  data: {
    userId: user.id,
    currencyCode: dto.currencyCode ?? 'USD', // from registration form
    countryCode: dto.countryCode, // optional
    timezone: dto.timezone ?? 'UTC',
    locale: dto.locale ?? 'en-US',
  },
});
```

### Get user profile with resolved references

```typescript
const profile = await prisma.userProfile.findUnique({
  where: { userId },
  select: {
    phone: true,
    avatarUrl: true,
    timezone: true,
    locale: true,
    onboardingCompletedAt: true,
    currency: {
      select: { code: true, name: true, symbol: true, decimalScale: true },
    },
    country: { select: { code: true, name: true, phoneCode: true } },
  },
});
```

### Get all user preferences (merged with defaults)

```typescript
// 1. Get cached defaults (from PreferenceDefinition — cache this!)
const definitions = await prisma.preferenceDefinition.findMany({
  where: { isActive: true },
  orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
});

// 2. Get user overrides (only customized ones)
const overrides = await prisma.userPreference.findMany({
  where: { userId },
  select: { preferenceId: true, value: true },
});

// 3. Merge: override wins, default as fallback
const overrideMap = new Map(overrides.map((o) => [o.preferenceId, o.value]));
const merged = definitions.map((def) => ({
  category: def.category,
  key: def.key,
  dataType: def.dataType,
  value: overrideMap.get(def.id) ?? def.defaultValue,
  label: def.label,
}));
```

### Set a user preference

```typescript
// Upsert — create if not exists, update if it does
await prisma.userPreference.upsert({
  where: {
    userId_preferenceId: { userId, preferenceId: definitionId },
  },
  update: { value: newValue },
  create: {
    userId,
    preferenceId: definitionId,
    value: newValue,
  },
});
```

### Reset a preference to default

```typescript
// Simply delete the override — app falls back to PreferenceDefinition.defaultValue
await prisma.userPreference.delete({
  where: {
    userId_preferenceId: { userId, preferenceId: definitionId },
  },
});
```

### Get active currencies for dropdown

```typescript
// Cache this! Low cardinality, high read.
const currencies = await prisma.currency.findMany({
  where: { isActive: true },
  orderBy: { code: 'asc' },
});
```

### Get countries with their default currency

```typescript
// Cache this too!
const countries = await prisma.country.findMany({
  where: { isActive: true },
  orderBy: { name: 'asc' },
});
```

### Adding a new preference (no migration needed)

```sql
-- Just insert a new definition, all users get the default automatically
INSERT INTO preference_definitions (id, category, key, "dataType", "defaultValue", label, "sortOrder")
VALUES (gen_random_uuid(), 'DASHBOARD', 'show_loans_summary', 'BOOLEAN', 'true', 'Show loans summary', 7);
```

Or via Prisma seed/script:

```typescript
await prisma.preferenceDefinition.create({
  data: {
    category: 'DASHBOARD',
    key: 'show_loans_summary',
    dataType: 'BOOLEAN',
    defaultValue: true,
    label: 'Show loans summary',
    description: 'Display active loans on the dashboard',
    sortOrder: 7,
  },
});
```

## Caching Strategy

These tables are **perfect cache candidates** (low cardinality, rarely change):

| Data                        | TTL | Invalidation                |
| --------------------------- | --- | --------------------------- |
| `Currency` list             | 24h | On currency INSERT/UPDATE   |
| `Country` list              | 24h | On country INSERT/UPDATE    |
| `PreferenceDefinition` list | 1h  | On definition INSERT/UPDATE |

`UserPreference` and `UserProfile` should **NOT** be cached globally (high cardinality per user). If needed, cache per-user with short TTL.

## Migration

```
prisma/migrations/20260209024558_add_user_profile_preferences_reference_data/
```

Applied with `prisma migrate dev`. Fully backward-compatible — no existing tables modified (only new relation fields added to `User`).

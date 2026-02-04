# Authentication & Subscription Plans - Design Document

> **Status**: Draft - Pending Review  
> **Version**: 1.0  
> **Date**: February 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Scope](#scope)
3. [Database Schema Design](#database-schema-design)
4. [Authentication Flow](#authentication-flow)
5. [Email Verification (OTP)](#email-verification-otp)
6. [Password Recovery](#password-recovery)
7. [Subscription Plans System](#subscription-plans-system)
8. [Feature Access Control](#feature-access-control)
9. [API Endpoints](#api-endpoints)
11. [Security Considerations](#security-considerations)
12. [Error Codes](#error-codes)
13. [Plan Upgrade/Downgrade System](#plan-upgradedowngrade-system)
14. [Implementation Phases](#implementation-phases)
15. [Testing Strategy](#testing-strategy)

---

## Executive Summary

This document defines the complete architecture for:

1. **User Registration & Authentication** - Secure signup/login with JWT tokens
2. **Email Verification via OTP** - Industry-standard 6-digit code verification
3. **Password Recovery** - Secure "forgot password" flow with OTP
4. **Subscription Plans** - Scalable multi-tier pricing system (Free + 2 paid plans)
5. **Feature Access Control** - Granular control over feature access and usage limits per plan

### Key Design Decisions

| Decision             | Choice                   | Rationale                                        |
| -------------------- | ------------------------ | ------------------------------------------------ |
| OTP Length           | 6 digits                 | Industry standard (Google, Apple, banks)         |
| OTP Expiry           | 10 minutes               | Balance between security and UX                  |
| OTP Max Attempts     | 5                        | Prevent brute force (10^6 / 5 = very secure)     |
| Token Refresh        | Rotation                 | Enhanced security, single-use refresh tokens     |
| Access Token Expiry  | **1 hour**               | Better UX for mobile apps, reduced refresh calls |
| Refresh Token Expiry | **7 days**               | Balance security with convenience                |
| Plan Storage         | Database + Config        | Plans in DB, features in code for type safety    |
| Usage Tracking       | Resources vs Consumables | Different counting strategies (see below)        |
| Default Plan         | FREE on registration     | All new users start with Free plan limits        |

---

## Scope

### In Scope

- User registration with email/password
- User login with email/password
- Email verification via OTP (6-digit code)
- Password reset via OTP
- JWT access + refresh token management
- Logout (token invalidation)
- Subscription plans (Free, Pro, Premium)
- Feature limits per plan
- Usage tracking and enforcement
- Email service abstraction (ready for provider integration)

### Out of Scope (Future Phases)

- Social login (Google, Apple)
- Two-factor authentication (2FA)
- Payment processing (Stripe integration)
- Admin panel for plan management
- Push notifications

---

## Database Schema Design

### New Models

```prisma
// =====================================================
// USER MODEL
// =====================================================
model User {
  id            String    @id @default(cuid(2))
  email         String    @unique
  password      String    // bcrypt hashed
  name          String?

  // Email verification
  emailVerified Boolean   @default(false)
  emailVerifiedAt DateTime?

  // Account status
  status        UserStatus @default(PENDING_VERIFICATION)

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime? // Soft delete

  // Relations
  subscription  Subscription?  // 1:1 - FK is in Subscription
  refreshTokens RefreshToken[]
  otpCodes      OtpCode[]
  usageRecords  UsageRecord[]

  // Future relations (from ARCHITECTURE.md)
  // accounts      Account[]
  // transactions  Transaction[]
  // etc.

  @@index([email])
  @@index([status])
  @@map("users")
}

enum UserStatus {
  PENDING_VERIFICATION // Just registered, email not verified
  ACTIVE               // Email verified, can use the app
  SUSPENDED            // Temporarily disabled by admin
  DELETED              // Soft deleted
}

// =====================================================
// REFRESH TOKENS (for JWT rotation)
// =====================================================
model RefreshToken {
  id          String   @id @default(cuid(2))
  token       String   @unique // hashed token

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Device/session info (optional but recommended)
  userAgent   String?
  ipAddress   String?

  expiresAt   DateTime
  createdAt   DateTime @default(now())
  revokedAt   DateTime? // null = active, date = revoked

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

// =====================================================
// OTP CODES (Email verification & Password reset)
// =====================================================
model OtpCode {
  id        String      @id @default(cuid(2))
  code      String      // 6-digit code (stored as string to preserve leading zeros)
  type      OtpType

  userId    String
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  attempts  Int         @default(0) // Track failed attempts
  maxAttempts Int       @default(5)

  expiresAt DateTime
  usedAt    DateTime?   // null = not used, date = used
  createdAt DateTime    @default(now())

  // Composite index for the most common query pattern:
  // Find valid OTP for user by type that hasn't been used and hasn't expired
  @@index([userId, type, usedAt, expiresAt])

  // Index for cleanup jobs (delete expired OTPs)
  @@index([expiresAt])

  @@map("otp_codes")
}

enum OtpType {
  EMAIL_VERIFICATION
  PASSWORD_RESET
}

// =====================================================
// SUBSCRIPTION PLANS
// =====================================================
model Plan {
  id          String   @id @default(cuid(2))

  // Plan identification
  code        String   @unique // 'free', 'pro', 'premium'
  name        String   // 'Free', 'Pro', 'Premium'
  description String?

  // Pricing
  priceMonthly  Decimal  @db.Decimal(10, 2) // 0.00, 9.99, 19.99
  priceCurrency String   @default("USD") @db.VarChar(3)
  priceYearly   Decimal? @db.Decimal(10, 2) // Optional yearly pricing

  // Status
  isActive    Boolean  @default(true) // Can be deactivated without deleting
  isDefault   Boolean  @default(false) // Default plan for new users (Free)

  // Display order
  sortOrder   Int      @default(0)

  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  subscriptions Subscription[]
  planFeatures  PlanFeature[]

  @@index([code])
  @@index([isActive, sortOrder])
  @@map("plans")
}

// =====================================================
// USER SUBSCRIPTIONS
// =====================================================
model Subscription {
  id          String   @id @default(cuid(2))

  // User relationship - FK here, not in User (correct direction)
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  planId      String
  plan        Plan     @relation(fields: [planId], references: [id])

  // Subscription status
  status      SubscriptionStatus @default(ACTIVE)

  // Period
  currentPeriodStart DateTime @default(now())
  currentPeriodEnd   DateTime? // null for free plan (never expires)

  // Cancellation
  cancelledAt   DateTime?
  cancelReason  String?

  // Trial (optional)
  trialStart    DateTime?
  trialEnd      DateTime?

  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId])
  @@index([planId])
  @@index([status])
  @@map("subscriptions")
}

enum SubscriptionStatus {
  ACTIVE          // Currently active
  TRIALING        // In trial period
  PAST_DUE        // Payment failed (grace period)
  CANCELLED       // User cancelled
  EXPIRED         // Subscription ended
}

// =====================================================
// PLAN FEATURES (What each plan includes)
// =====================================================
model PlanFeature {
  id          String   @id @default(cuid(2))

  planId      String
  plan        Plan     @relation(fields: [planId], references: [id], onDelete: Cascade)

  featureCode String   // 'accounts', 'transactions_per_month', 'goals', etc.

  // Limit type
  limitType   FeatureLimitType @default(BOOLEAN)

  // For BOOLEAN: true = enabled, false = disabled (use limitValue as 1 or 0)
  // For COUNT: max count per period
  // For UNLIMITED: no limit (-1)
  limitValue  Int      @default(1)

  // Period for COUNT limits (only for CONSUMABLE features)
  limitPeriod LimitPeriod? // null for BOOLEAN/UNLIMITED/RESOURCE

  // NEW: Distinguishes how we count usage
  // RESOURCE: Count from actual table (accounts, goals) - if user deletes, they can create again
  // CONSUMABLE: Count from UsageRecord (transactions/month) - resets each period
  featureType FeatureType @default(RESOURCE)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([planId, featureCode])
  @@index([featureCode])
  @@map("plan_features")
}

enum FeatureLimitType {
  BOOLEAN    // Feature is enabled/disabled
  COUNT      // Feature has a count limit
  UNLIMITED  // No limit
}

enum FeatureType {
  RESOURCE    // Counted from actual table (accounts, goals) - deletable
  CONSUMABLE  // Counted from UsageRecord (transactions) - period-based
}

enum LimitPeriod {
  DAILY
  WEEKLY
  MONTHLY
  YEARLY
}

// =====================================================
// USAGE TRACKING
// =====================================================
model UsageRecord {
  id          String   @id @default(cuid(2))

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  featureCode String   // 'accounts', 'transactions', etc.

  // Period tracking
  periodType  LimitPeriod
  periodStart DateTime
  periodEnd   DateTime

  // Usage count
  count       Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, featureCode, periodStart])
  @@index([userId, featureCode])
  @@index([periodEnd])
  @@map("usage_records")
}
```

### Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────┐
│      User       │       │   RefreshToken   │
├─────────────────┤       ├──────────────────┤
│ id              │◄──────│ userId (FK)      │
│ email           │  1:N  │ token (hashed)   │
│ password        │       │ expiresAt        │
│ emailVerified   │       │ revokedAt        │
│ status          │       └──────────────────┘
└────────┬────────┘
         │                ┌──────────────────┐
         │                │     OtpCode      │
         │           1:N  ├──────────────────┤
         │◄───────────────│ userId (FK)      │
         │                │ code             │
         │                │ type             │
         │                │ attempts         │
         │                │ expiresAt        │
         │                └──────────────────┘
         │
         │                ┌──────────────────┐
         │           1:1  │  Subscription    │
         │◄───────────────│ userId (FK) ★    │  ★ FK is HERE (correct direction)
         │                ├──────────────────┤
         │                │ planId (FK)      │
         │                │ status           │
         │                │ periodStart/End  │
         │                └────────┬─────────┘
         │                         │
         │                         │ N:1
         │                         ▼
         │                ┌──────────────────┐
         │                │      Plan        │
         │                ├──────────────────┤
         │                │ code (unique)    │
         │                │ name             │
         │                │ priceMonthly     │
         │                │ isDefault        │
         │                └────────┬─────────┘
         │                         │
         │                         │ 1:N
         │                         ▼
         │                ┌──────────────────┐
         │                │   PlanFeature    │
         │                ├──────────────────┤
         │                │ featureCode      │
         │                │ limitType        │
         │                │ limitValue       │
         │                │ featureType ★    │  ★ RESOURCE vs CONSUMABLE
         │                │ limitPeriod      │
         │                └──────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐
│   UsageRecord    │  (Only for CONSUMABLE features)
├──────────────────┤
│ userId (FK)      │
│ featureCode      │
│ periodType       │
│ periodStart/End  │
│ count            │
└──────────────────┘
```

---

## Usage Tracking System (IMPORTANT)

### Two Types of Limits

There are **two fundamentally different** ways to track feature usage:

#### 1. RESOURCE Limits (Deletable)

**Examples**: accounts, goals, debts, loans, custom_categories, recurring_payments

**How it works**:

- Count is derived from the **actual database table**
- If user deletes a resource, they **can create another**
- No UsageRecord needed - we query the real table

```typescript
// To check if user can create an account:
const currentCount = await prisma.account.count({
  where: { userId, deletedAt: null },
});
const limit = planFeature.limitValue; // e.g., 2 for Free plan
const canCreate = currentCount < limit;
```

**User experience**:

```
Free plan: Max 2 accounts
- User creates Account A → has 1/2
- User creates Account B → has 2/2
- User tries to create Account C → DENIED "Upgrade to create more"
- User DELETES Account A → has 1/2
- User creates Account C → ALLOWED, has 2/2
```

#### 2. CONSUMABLE Limits (Period-based)

**Examples**: transactions_per_month, exports_per_month

**How it works**:

- Count is tracked in **UsageRecord** table
- Resets at the start of each period (monthly, daily, etc.)
- Deleting the resource does NOT restore the count

```typescript
// To check if user can create a transaction:
const usageRecord = await prisma.usageRecord.findUnique({
  where: {
    userId_featureCode_periodStart: {
      userId,
      featureCode: 'transactions_per_month',
      periodStart: startOfMonth,
    },
  },
});
const currentCount = usageRecord?.count ?? 0;
const limit = planFeature.limitValue; // e.g., 100 for Free plan
const canCreate = currentCount < limit;
```

**User experience**:

```
Free plan: Max 100 transactions/month
- User creates 100 transactions → 100/100 used
- User DELETES 50 transactions → still 100/100 used (no restore)
- User tries to create transaction → DENIED "Wait until next month"
- Next month starts → 0/100 used (reset)
```

### Feature Configuration

```typescript
// Updated seed data with featureType
const planFeatures = {
  free: [
    // RESOURCE: Count from real table, deletable
    {
      featureCode: 'accounts',
      limitType: 'COUNT',
      limitValue: 2,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'goals',
      limitType: 'COUNT',
      limitValue: 1,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'debts',
      limitType: 'COUNT',
      limitValue: 2,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'loans',
      limitType: 'COUNT',
      limitValue: 1,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'custom_categories',
      limitType: 'COUNT',
      limitValue: 5,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'recurring_payments',
      limitType: 'COUNT',
      limitValue: 3,
      featureType: 'RESOURCE',
    },

    // CONSUMABLE: Count from UsageRecord, period-based
    {
      featureCode: 'transactions_per_month',
      limitType: 'COUNT',
      limitValue: 100,
      featureType: 'CONSUMABLE',
      limitPeriod: 'MONTHLY',
    },

    // BOOLEAN: Simple on/off
    { featureCode: 'advanced_reports', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'export_data', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'multi_currency', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'budget_alerts', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'ai_insights', limitType: 'BOOLEAN', limitValue: 0 },
  ],
  // ... pro and premium similar
};
```

### Implementation in SubscriptionService

```typescript
async checkFeatureAccess(
  userId: string,
  featureCode: string,
): Promise<{ allowed: boolean; reason?: string; current?: number; limit?: number }> {
  const planFeature = await this.getPlanFeature(userId, featureCode);

  switch (planFeature.limitType) {
    case 'BOOLEAN':
      return { allowed: planFeature.limitValue === 1 };

    case 'UNLIMITED':
      return { allowed: true };

    case 'COUNT':
      // HERE'S THE KEY DIFFERENCE
      if (planFeature.featureType === 'RESOURCE') {
        return this.checkResourceLimit(userId, featureCode, planFeature);
      } else {
        return this.checkConsumableLimit(userId, featureCode, planFeature);
      }
  }
}

// RESOURCE: Query the actual table
private async checkResourceLimit(userId: string, featureCode: string, planFeature: PlanFeature) {
  // Map featureCode to table name
  const tableCountMap: Record<string, () => Promise<number>> = {
    'accounts': () => this.prisma.account.count({ where: { userId, deletedAt: null } }),
    'goals': () => this.prisma.goal.count({ where: { userId, deletedAt: null } }),
    'debts': () => this.prisma.debt.count({ where: { userId, deletedAt: null } }),
    // ... etc
  };

  const currentCount = await tableCountMap[featureCode]();
  const allowed = currentCount < planFeature.limitValue;

  return {
    allowed,
    current: currentCount,
    limit: planFeature.limitValue,
    reason: allowed ? undefined : `Maximum ${planFeature.limitValue} ${featureCode} allowed on your plan`,
  };
}

// CONSUMABLE: Query UsageRecord
private async checkConsumableLimit(userId: string, featureCode: string, planFeature: PlanFeature) {
  const period = this.getCurrentPeriod(planFeature.limitPeriod!);

  const usageRecord = await this.prisma.usageRecord.findUnique({
    where: {
      userId_featureCode_periodStart: {
        userId,
        featureCode,
        periodStart: period.start,
      },
    },
  });

  const currentCount = usageRecord?.count ?? 0;
  const allowed = currentCount < planFeature.limitValue;

  return {
    allowed,
    current: currentCount,
    limit: planFeature.limitValue,
    reason: allowed ? undefined : `Monthly limit of ${planFeature.limitValue} reached`,
  };
}
```

---

## Authentication Flow

### Registration Flow

```
┌──────────┐     ┌─────────┐     ┌────────────┐     ┌─────────┐
│  Client  │     │   API   │     │   Database │     │  Email  │
└────┬─────┘     └────┬────┘     └──────┬─────┘     └────┬────┘
     │                │                 │                │
     │ POST /auth/register              │                │
     │ {email, password, name?}         │                │
     ├───────────────►│                 │                │
     │                │                 │                │
     │                │ Check email exists               │
     │                ├────────────────►│                │
     │                │◄────────────────┤                │
     │                │                 │                │
     │                │ Hash password   │                │
     │                │ (bcrypt, 12 rounds)              │
     │                │                 │                │
     │                │ Create User     │                │
     │                │ (status=PENDING)│                │
     │                ├────────────────►│                │
     │                │                 │                │
     │                │ Assign Free Plan│                │
     │                ├────────────────►│                │
     │                │                 │                │
     │                │ Generate OTP    │                │
     │                ├────────────────►│                │
     │                │                 │                │
     │                │ Send verification email          │
     │                ├──────────────────────────────────►
     │                │                 │                │
     │ 201 Created    │                 │                │
     │ {message: "Check your email"}    │                │
     │◄───────────────┤                 │                │
     │                │                 │                │
```

### Login Flow

```
┌──────────┐     ┌─────────┐     ┌────────────┐
│  Client  │     │   API   │     │   Database │
└────┬─────┘     └────┬────┘     └──────┬─────┘
     │                │                 │
     │ POST /auth/login                 │
     │ {email, password}                │
     ├───────────────►│                 │
     │                │                 │
     │                │ Find user by email
     │                ├────────────────►│
     │                │◄────────────────┤
     │                │                 │
     │                │ Verify password │
     │                │ (bcrypt.compare)│
     │                │                 │
     │                │ Check status    │
     │                │ (must be ACTIVE)│
     │                │                 │
     │                │ Generate tokens │
     │                │ - Access (1h)   │
     │                │ - Refresh (7d)  │
     │                │                 │
     │                │ Store refresh   │
     │                ├────────────────►│
     │                │                 │
     │ 200 OK         │                 │
     │ {accessToken,  │                 │
     │  refreshToken, │                 │
     │  user}         │                 │
     │◄───────────────┤                 │
     │                │                 │
```

### Token Refresh Flow (with Rotation)

```
┌──────────┐     ┌─────────┐     ┌────────────┐
│  Client  │     │   API   │     │   Database │
└────┬─────┘     └────┬────┘     └──────┬─────┘
     │                │                 │
     │ POST /auth/refresh               │
     │ {refreshToken}                   │
     ├───────────────►│                 │
     │                │                 │
     │                │ Find token      │
     │                │ (by hash)       │
     │                ├────────────────►│
     │                │◄────────────────┤
     │                │                 │
     │                │ Validate:       │
     │                │ - Not expired   │
     │                │ - Not revoked   │
     │                │ - User active   │
     │                │                 │
     │                │ Revoke old token│
     │                ├────────────────►│
     │                │                 │
     │                │ Create new tokens
     │                │ (rotation)      │
     │                ├────────────────►│
     │                │                 │
     │ 200 OK         │                 │
     │ {accessToken,  │                 │
     │  refreshToken} │                 │
     │◄───────────────┤                 │
     │                │                 │
```

**Why Token Rotation?**

- If a refresh token is stolen, it can only be used once
- The legitimate user will detect the theft when their token fails
- Provides an audit trail of token usage

### Logout Flow

```
POST /auth/logout
Authorization: Bearer <accessToken>
Body: { refreshToken }

1. Validate access token
2. Revoke the specific refresh token
3. Return 204 No Content
```

**Logout All Devices:**

```
POST /auth/logout-all
Authorization: Bearer <accessToken>

1. Validate access token
2. Revoke ALL refresh tokens for user
3. Return 204 No Content
```

---

## Email Verification (OTP)

### OTP Generation Best Practices

```typescript
// OTP Configuration
const OTP_CONFIG = {
  length: 6, // 6 digits
  expiresIn: 10 * 60, // 10 minutes in seconds
  maxAttempts: 5, // Max verification attempts
  cooldown: 60, // Seconds before resend allowed
  rateLimit: {
    window: 3600, // 1 hour
    maxRequests: 5, // Max 5 OTPs per hour
  },
};
```

### OTP Generation

```typescript
// Use crypto for secure random generation
import { randomInt } from 'crypto';

function generateOtp(): string {
  // Generate 6-digit OTP (100000-999999)
  return randomInt(100000, 999999).toString();
}
```

### Verification Flow

```
┌──────────┐     ┌─────────┐     ┌────────────┐
│  Client  │     │   API   │     │   Database │
└────┬─────┘     └────┬────┘     └──────┬─────┘
     │                │                 │
     │ POST /auth/verify-email          │
     │ {email, code}                    │
     ├───────────────►│                 │
     │                │                 │
     │                │ Find OTP record │
     │                ├────────────────►│
     │                │◄────────────────┤
     │                │                 │
     │                │ Validate:       │
     │                │ - Code matches  │
     │                │ - Not expired   │
     │                │ - Not used      │
     │                │ - Under max attempts
     │                │                 │
     │                │ If invalid:     │
     │                │ increment attempts
     │                ├────────────────►│
     │                │                 │
     │                │ If valid:       │
     │                │ - Mark OTP used │
     │                │ - Update user   │
     │                │   status=ACTIVE │
     │                │   emailVerified=true
     │                ├────────────────►│
     │                │                 │
     │                │ Generate tokens │
     │                │ (auto-login)    │
     │                │                 │
     │ 200 OK         │                 │
     │ {accessToken,  │                 │
     │  refreshToken, │                 │
     │  user}         │                 │
     │◄───────────────┤                 │
     │                │                 │
```

### Resend OTP

```
POST /auth/resend-verification

1. Check cooldown (60s since last OTP)
2. Check rate limit (5 per hour)
3. Invalidate previous OTPs for this type
4. Generate new OTP
5. Send email
6. Return success
```

---

## Password Recovery

### Request Password Reset

```
┌──────────┐     ┌─────────┐     ┌────────────┐     ┌─────────┐
│  Client  │     │   API   │     │   Database │     │  Email  │
└────┬─────┘     └────┬────┘     └──────┬─────┘     └────┬────┘
     │                │                 │                │
     │ POST /auth/forgot-password       │                │
     │ {email}        │                 │                │
     ├───────────────►│                 │                │
     │                │                 │                │
     │                │ Find user       │                │
     │                ├────────────────►│                │
     │                │◄────────────────┤                │
     │                │                 │                │
     │                │ Generate OTP    │                │
     │                │ (type=PASSWORD_RESET)            │
     │                ├────────────────►│                │
     │                │                 │                │
     │                │ Send reset email│                │
     │                ├──────────────────────────────────►
     │                │                 │                │
     │ 200 OK         │                 │                │
     │ {message}      │                 │                │
     │◄───────────────┤                 │                │
```

**Security Note**: Always return success even if email doesn't exist (prevent email enumeration).

### Verify Reset Code

```
POST /auth/verify-reset-code
{email, code}

1. Validate OTP (same as email verification)
2. Return temporary reset token (short-lived, 5 min)
3. This token is required for the actual password reset
```

### Reset Password

```
POST /auth/reset-password
{email, code, newPassword}
OR
{resetToken, newPassword}

1. Validate reset token or OTP
2. Validate new password (strength requirements)
3. Hash new password
4. Update user password
5. Invalidate all refresh tokens (force re-login)
6. Mark OTP as used
7. Return success
```

### Password Requirements

```typescript
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false, // Optional but recommended
};
```

---

## Subscription Plans System

### Initial Plans Configuration

| Plan        | Code      | Monthly Price | Target Users                |
| ----------- | --------- | ------------- | --------------------------- |
| **Free**    | `free`    | $0.00         | New users, basic tracking   |
| **Pro**     | `pro`     | $4.99         | Power users, families       |
| **Premium** | `premium` | $9.99         | Business, advanced features |

### Feature Definitions

```typescript
// src/modules/subscriptions/constants/features.constant.ts

export const FEATURES = {
  // Account Management
  ACCOUNTS: 'accounts',

  // Transaction Tracking
  TRANSACTIONS_PER_MONTH: 'transactions_per_month',

  // Categories
  CUSTOM_CATEGORIES: 'custom_categories',

  // Goals
  GOALS: 'goals',

  // Debts & Loans
  DEBTS: 'debts',
  LOANS: 'loans',

  // Recurring Payments
  RECURRING_PAYMENTS: 'recurring_payments',

  // Reports & Analytics
  ADVANCED_REPORTS: 'advanced_reports',
  EXPORT_DATA: 'export_data',

  // Future Features
  MULTI_CURRENCY: 'multi_currency',
  BUDGET_ALERTS: 'budget_alerts',
  AI_INSIGHTS: 'ai_insights',
} as const;

export type FeatureCode = (typeof FEATURES)[keyof typeof FEATURES];
```

### Plan-Feature Matrix (Initial)

| Feature                | Free | Pro   | Premium         |
| ---------------------- | ---- | ----- | --------------- |
| **Accounts**           | 2    | 10    | Unlimited       |
| **Transactions/month** | 100  | 1,000 | Unlimited       |
| **Custom Categories**  | 5    | 20    | Unlimited       |
| **Goals**              | 1    | 5     | Unlimited       |
| **Debts**              | 2    | 10    | Unlimited       |
| **Loans**              | 1    | 5     | Unlimited       |
| **Recurring Payments** | 3    | 20    | Unlimited       |
| **Advanced Reports**   | No   | Yes   | Yes             |
| **Export Data**        | No   | CSV   | CSV, PDF, Excel |
| **Multi-Currency**     | No   | No    | Yes             |
| **Budget Alerts**      | No   | Yes   | Yes             |
| **AI Insights**        | No   | No    | Yes             |

### Seed Data

```typescript
// prisma/seed.ts (relevant portion)

const plans = [
  {
    code: 'free',
    name: 'Free',
    description: 'Perfect for getting started with personal finance tracking',
    priceMonthly: 0,
    isDefault: true, // ★ All new users get this plan
    sortOrder: 0,
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'For power users who want more control and features',
    priceMonthly: 4.99,
    isDefault: false,
    sortOrder: 1,
  },
  {
    code: 'premium',
    name: 'Premium',
    description: 'Everything unlimited plus advanced features',
    priceMonthly: 9.99,
    isDefault: false,
    sortOrder: 2,
  },
];

// ★ IMPORTANT: featureType determines HOW we count usage
const planFeatures = {
  free: [
    // RESOURCE features: Count from actual table, user can delete to free up space
    {
      featureCode: 'accounts',
      limitType: 'COUNT',
      limitValue: 2,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'custom_categories',
      limitType: 'COUNT',
      limitValue: 5,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'goals',
      limitType: 'COUNT',
      limitValue: 1,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'debts',
      limitType: 'COUNT',
      limitValue: 2,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'loans',
      limitType: 'COUNT',
      limitValue: 1,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'recurring_payments',
      limitType: 'COUNT',
      limitValue: 3,
      featureType: 'RESOURCE',
    },

    // CONSUMABLE features: Count from UsageRecord, resets each period
    {
      featureCode: 'transactions_per_month',
      limitType: 'COUNT',
      limitValue: 100,
      featureType: 'CONSUMABLE',
      limitPeriod: 'MONTHLY',
    },

    // BOOLEAN features: Simple on/off
    { featureCode: 'advanced_reports', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'export_data', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'multi_currency', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'budget_alerts', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'ai_insights', limitType: 'BOOLEAN', limitValue: 0 },
  ],
  pro: [
    // RESOURCE features
    {
      featureCode: 'accounts',
      limitType: 'COUNT',
      limitValue: 10,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'custom_categories',
      limitType: 'COUNT',
      limitValue: 20,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'goals',
      limitType: 'COUNT',
      limitValue: 5,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'debts',
      limitType: 'COUNT',
      limitValue: 10,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'loans',
      limitType: 'COUNT',
      limitValue: 5,
      featureType: 'RESOURCE',
    },
    {
      featureCode: 'recurring_payments',
      limitType: 'COUNT',
      limitValue: 20,
      featureType: 'RESOURCE',
    },

    // CONSUMABLE features
    {
      featureCode: 'transactions_per_month',
      limitType: 'COUNT',
      limitValue: 1000,
      featureType: 'CONSUMABLE',
      limitPeriod: 'MONTHLY',
    },

    // BOOLEAN features
    { featureCode: 'advanced_reports', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'export_data', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'multi_currency', limitType: 'BOOLEAN', limitValue: 0 },
    { featureCode: 'budget_alerts', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'ai_insights', limitType: 'BOOLEAN', limitValue: 0 },
  ],
  premium: [
    // UNLIMITED for all countable features
    { featureCode: 'accounts', limitType: 'UNLIMITED', limitValue: -1 },
    {
      featureCode: 'custom_categories',
      limitType: 'UNLIMITED',
      limitValue: -1,
    },
    { featureCode: 'goals', limitType: 'UNLIMITED', limitValue: -1 },
    { featureCode: 'debts', limitType: 'UNLIMITED', limitValue: -1 },
    { featureCode: 'loans', limitType: 'UNLIMITED', limitValue: -1 },
    {
      featureCode: 'recurring_payments',
      limitType: 'UNLIMITED',
      limitValue: -1,
    },
    {
      featureCode: 'transactions_per_month',
      limitType: 'UNLIMITED',
      limitValue: -1,
    },

    // All BOOLEAN features enabled
    { featureCode: 'advanced_reports', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'export_data', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'multi_currency', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'budget_alerts', limitType: 'BOOLEAN', limitValue: 1 },
    { featureCode: 'ai_insights', limitType: 'BOOLEAN', limitValue: 1 },
  ],
};
```

### Registration Flow with Free Plan

When a user registers, they automatically get the FREE plan:

```typescript
// In AuthService.register()
async register(dto: RegisterDto) {
  // 1. Create user
  const user = await this.usersRepository.create({
    email: dto.email,
    password: await hash(dto.password, 12),
    name: dto.name,
    status: 'PENDING_VERIFICATION',
  });

  // 2. Get default plan (FREE)
  const freePlan = await this.prisma.plan.findFirst({
    where: { isDefault: true },
  });

  // 3. Create subscription linking user to free plan
  await this.prisma.subscription.create({
    data: {
      userId: user.id,
      planId: freePlan.id,
      status: 'ACTIVE',
      // currentPeriodEnd is NULL for free plan (never expires)
    },
  });

  // 4. Generate and send OTP
  await this.otpService.createAndSend(user.id, 'EMAIL_VERIFICATION');

  return { message: 'Check your email to verify your account' };
}
```

---

## Feature Access Control

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Request Flow                              │
└─────────────────────────────────────────────────────────────────┘

  Request → JwtAuthGuard → FeatureGuard → Controller → Service
                              │
                              ▼
                    ┌─────────────────────┐
                    │  SubscriptionService │
                    │  - checkFeature()    │
                    │  - checkUsage()      │
                    │  - incrementUsage()  │
                    └──────────┬──────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │                                      │
            ▼                                      ▼
    ┌───────────────┐                    ┌─────────────────┐
    │  PlanFeature  │                    │   UsageRecord   │
    │   (limits)    │                    │   (current use) │
    └───────────────┘                    └─────────────────┘
```

### Feature Guard

```typescript
// src/common/guards/feature.guard.ts

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.get<string>(
      FEATURE_KEY,
      context.getHandler(),
    );

    if (!requiredFeature) {
      return true; // No feature requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const { allowed, reason } =
      await this.subscriptionService.checkFeatureAccess(
        user.sub,
        requiredFeature,
      );

    if (!allowed) {
      throw new ForbiddenException({
        code: 'FEATURE_LIMIT_EXCEEDED',
        message: reason,
        feature: requiredFeature,
      });
    }

    return true;
  }
}
```

### Feature Decorator

```typescript
// src/common/decorators/feature.decorator.ts

export const FEATURE_KEY = 'feature';

export const RequireFeature = (featureCode: FeatureCode) =>
  SetMetadata(FEATURE_KEY, featureCode);

// Usage in controller:
@Post()
@RequireFeature(FEATURES.ACCOUNTS)
createAccount(@Body() dto: CreateAccountDto) {
  // ...
}
```

### Subscription Service

```typescript
// src/modules/subscriptions/subscriptions.service.ts

@Injectable()
export class SubscriptionsService {
  /**
   * Check if user has access to a feature
   */
  async checkFeatureAccess(
    userId: string,
    featureCode: string,
  ): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
    // 1. Get user's current plan
    const subscription = await this.getUserSubscription(userId);
    const planFeature = await this.getPlanFeature(
      subscription.planId,
      featureCode,
    );

    if (!planFeature) {
      return { allowed: false, reason: 'Feature not available in your plan' };
    }

    // 2. Check based on limit type
    switch (planFeature.limitType) {
      case 'BOOLEAN':
        return {
          allowed: planFeature.limitValue === 1,
          reason:
            planFeature.limitValue === 0
              ? 'Upgrade your plan to access this feature'
              : undefined,
        };

      case 'UNLIMITED':
        return { allowed: true };

      case 'COUNT':
        return this.checkCountLimit(userId, featureCode, planFeature);
    }
  }

  /**
   * Check count-based limits
   */
  private async checkCountLimit(
    userId: string,
    featureCode: string,
    planFeature: PlanFeature,
  ): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
    const currentUsage = await this.getCurrentUsage(
      userId,
      featureCode,
      planFeature.limitPeriod,
    );
    const remaining = planFeature.limitValue - currentUsage;

    if (remaining <= 0) {
      return {
        allowed: false,
        reason: `You've reached your ${featureCode} limit. Upgrade to get more.`,
        remaining: 0,
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * Increment usage after successful operation
   */
  async incrementUsage(
    userId: string,
    featureCode: string,
    amount: number = 1,
  ): Promise<void> {
    const subscription = await this.getUserSubscription(userId);
    const planFeature = await this.getPlanFeature(
      subscription.planId,
      featureCode,
    );

    if (!planFeature || planFeature.limitType !== 'COUNT') {
      return; // No tracking needed for BOOLEAN or UNLIMITED
    }

    const period = this.getCurrentPeriod(planFeature.limitPeriod);

    await this.prisma.usageRecord.upsert({
      where: {
        userId_featureCode_periodStart: {
          userId,
          featureCode,
          periodStart: period.start,
        },
      },
      create: {
        userId,
        featureCode,
        periodType: planFeature.limitPeriod,
        periodStart: period.start,
        periodEnd: period.end,
        count: amount,
      },
      update: {
        count: { increment: amount },
      },
    });
  }

  /**
   * Decrement usage when resource is deleted
   */
  async decrementUsage(
    userId: string,
    featureCode: string,
    amount: number = 1,
  ): Promise<void> {
    // Similar to increment but with decrement
    // Ensures count never goes below 0
  }
}
```

### Usage in Feature Services

```typescript
// src/modules/accounts/accounts.service.ts

@Injectable()
export class AccountsService {
  constructor(
    private accountsRepository: AccountsRepository,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async create(userId: string, dto: CreateAccountDto): Promise<Account> {
    // Check limit BEFORE creating
    const { allowed, reason } =
      await this.subscriptionsService.checkFeatureAccess(
        userId,
        FEATURES.ACCOUNTS,
      );

    if (!allowed) {
      throw new ForbiddenException({
        code: 'FEATURE_LIMIT_EXCEEDED',
        message: reason,
      });
    }

    // Create the account
    const account = await this.accountsRepository.create({
      ...dto,
      userId,
    });

    // Track usage AFTER successful creation
    await this.subscriptionsService.incrementUsage(userId, FEATURES.ACCOUNTS);

    return account;
  }

  async delete(userId: string, accountId: string): Promise<void> {
    await this.accountsRepository.delete(accountId);

    // Decrement usage after successful deletion
    await this.subscriptionsService.decrementUsage(userId, FEATURES.ACCOUNTS);
  }
}
```

---

## API Endpoints

### Authentication Endpoints

| Method | Endpoint                           | Auth   | Description                   |
| ------ | ---------------------------------- | ------ | ----------------------------- |
| POST   | `/api/v1/auth/register`            | Public | Register new user             |
| POST   | `/api/v1/auth/login`               | Public | Login user                    |
| POST   | `/api/v1/auth/refresh`             | Public | Refresh tokens                |
| POST   | `/api/v1/auth/logout`              | JWT    | Logout (revoke refresh token) |
| POST   | `/api/v1/auth/logout-all`          | JWT    | Logout all devices            |
| POST   | `/api/v1/auth/verify-email`        | Public | Verify email with OTP         |
| POST   | `/api/v1/auth/resend-verification` | Public | Resend verification OTP       |
| POST   | `/api/v1/auth/forgot-password`     | Public | Request password reset        |
| POST   | `/api/v1/auth/verify-reset-code`   | Public | Verify reset OTP              |
| POST   | `/api/v1/auth/reset-password`      | Public | Reset password                |
| GET    | `/api/v1/auth/me`                  | JWT    | Get current user              |

### DTOs

```typescript
// Register
class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}

// Login
class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

// Verify Email
class VerifyEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}

// Forgot Password
class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

// Reset Password
class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

// Refresh Token
class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
```

### Response Examples

**Register Response (201):**

```json
{
  "success": true,
  "data": {
    "message": "Registration successful. Please check your email to verify your account.",
    "email": "user@example.com"
  },
  "meta": {
    "timestamp": "2026-02-03T10:30:00.000Z"
  }
}
```

**Login Response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g...",
    "expiresIn": 3600,
    "user": {
      "id": "cm1234567890",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": true,
      "plan": {
        "code": "free",
        "name": "Free"
      }
    }
  },
  "meta": {
    "timestamp": "2026-02-03T10:30:00.000Z"
  }
}
```

**Verification Error (400):**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_OTP",
    "message": "Invalid verification code",
    "details": {
      "attemptsRemaining": 3
    }
  },
  "meta": {
    "timestamp": "2026-02-03T10:30:00.000Z",
    "path": "/api/v1/auth/verify-email"
  }
}
```

### Plans Endpoints

| Method | Endpoint                        | Auth   | Description                        |
| ------ | ------------------------------- | ------ | ---------------------------------- |
| GET    | `/api/v1/plans`                 | Public | List all active plans              |
| GET    | `/api/v1/plans/:code`           | Public | Get plan details                   |
| GET    | `/api/v1/subscriptions/current` | JWT    | Get user's current subscription    |
| GET    | `/api/v1/subscriptions/usage`   | JWT    | Get usage stats for current period |

---

---

## Security Considerations

### Password Security

| Aspect           | Implementation                 |
| ---------------- | ------------------------------ |
| **Hashing**      | bcrypt with 12 salt rounds     |
| **Min Length**   | 8 characters                   |
| **Requirements** | Uppercase + lowercase + number |
| **Max Length**   | 128 characters (prevent DoS)   |
| **Comparison**   | Timing-safe comparison         |

### OTP Security

| Aspect           | Implementation                          |
| ---------------- | --------------------------------------- |
| **Generation**   | crypto.randomInt (CSPRNG)               |
| **Storage**      | Plain text OK (short-lived, single-use) |
| **Expiry**       | 10 minutes                              |
| **Max Attempts** | 5 (prevents brute force)                |
| **Rate Limit**   | 5 per hour per email                    |
| **Cooldown**     | 60 seconds between resends              |

### Token Security

| Aspect            | Implementation                      |
| ----------------- | ----------------------------------- |
| **Access Token**  | JWT, **1 hour** expiry              |
| **Refresh Token** | Random + hashed storage, **7 days** |
| **Rotation**      | Single-use refresh tokens           |
| **Revocation**    | Database tracking                   |
| **Signing**       | HS256 with 256-bit secret           |

### Rate Limiting

```typescript
// Specific endpoints with stricter limits
const RATE_LIMITS = {
  'auth/register': { ttl: 3600, limit: 5 }, // 5 per hour
  'auth/login': { ttl: 900, limit: 10 }, // 10 per 15 min
  'auth/forgot-password': { ttl: 3600, limit: 3 }, // 3 per hour
  'auth/verify-email': { ttl: 60, limit: 5 }, // 5 per minute
  'auth/resend-verification': { ttl: 3600, limit: 5 }, // 5 per hour
};
```

### Input Validation

- All DTOs use class-validator
- Whitelist mode: strip unknown properties
- Forbid non-whitelisted: throw on unknown
- Transform: auto-transform types

---

## Error Codes

### Authentication Errors

| Code                    | HTTP | Description                 |
| ----------------------- | ---- | --------------------------- |
| `INVALID_CREDENTIALS`   | 401  | Email or password incorrect |
| `EMAIL_NOT_VERIFIED`    | 403  | Email verification required |
| `ACCOUNT_SUSPENDED`     | 403  | Account suspended by admin  |
| `ACCOUNT_DELETED`       | 403  | Account has been deleted    |
| `EMAIL_ALREADY_EXISTS`  | 409  | Email already registered    |
| `TOKEN_EXPIRED`         | 401  | Access token expired        |
| `TOKEN_INVALID`         | 401  | Token malformed or invalid  |
| `REFRESH_TOKEN_EXPIRED` | 401  | Refresh token expired       |
| `REFRESH_TOKEN_REVOKED` | 401  | Refresh token was revoked   |

### OTP Errors

| Code               | HTTP | Description                    |
| ------------------ | ---- | ------------------------------ |
| `INVALID_OTP`      | 400  | Code doesn't match             |
| `OTP_EXPIRED`      | 400  | Code has expired               |
| `OTP_ALREADY_USED` | 400  | Code already used              |
| `OTP_MAX_ATTEMPTS` | 429  | Too many failed attempts       |
| `OTP_RATE_LIMITED` | 429  | Too many OTP requests          |
| `OTP_COOLDOWN`     | 429  | Wait before requesting new OTP |

### Subscription Errors

| Code                     | HTTP | Description              |
| ------------------------ | ---- | ------------------------ |
| `FEATURE_NOT_AVAILABLE`  | 403  | Feature not in plan      |
| `FEATURE_LIMIT_EXCEEDED` | 403  | Usage limit reached      |
| `SUBSCRIPTION_EXPIRED`   | 403  | Subscription has expired |
| `PLAN_NOT_FOUND`         | 404  | Plan doesn't exist       |

### Plan Change Errors

| Code                       | HTTP | Description                                 |
| -------------------------- | ---- | ------------------------------------------- |
| `NOT_AN_UPGRADE`           | 400  | Tried to use upgrade endpoint for downgrade |
| `NOT_A_DOWNGRADE`          | 400  | Tried to use downgrade endpoint for upgrade |
| `ALREADY_ON_PLAN`          | 400  | User already has this plan                  |
| `ALREADY_FREE`             | 400  | Cannot cancel/downgrade from free plan      |
| `NOT_CANCELLED`            | 400  | Cannot reactivate (no pending cancellation) |
| `RESOURCE_OVERAGE`         | 400  | Must reduce resources before downgrade      |
| `CHANGE_ALREADY_SCHEDULED` | 400  | Already has a pending plan change           |
| `GRACE_PERIOD_ACTIVE`      | 403  | Must resolve overages before new changes    |

---

## Implementation Phases

### Phase 1: Core Authentication (Week 1)

**Priority: Critical**

1. **Database Schema**
   - [ ] Create User model (minimal: email, password, status)
   - [ ] Create RefreshToken model
   - [ ] Run migration

2. **Auth Module**
   - [ ] JWT Strategy (access tokens)
   - [ ] JWT Refresh Strategy (refresh tokens)
   - [ ] Auth service (register, login, refresh, logout)
   - [ ] Auth controller

3. **Users Module**
   - [ ] Users repository
   - [ ] Users service

4. **Testing**
   - [ ] Unit tests for auth service
   - [ ] E2E tests for auth endpoints

### Phase 2: Email Verification (Week 1-2)

**Priority: Critical**

1. **Database Schema**
   - [ ] Create OtpCode model
   - [ ] Add emailVerified, emailVerifiedAt to User
   - [ ] Run migration

2. **Email Module**
   - [ ] Email service interface
   - [ ] Email service (stub implementation)
   - [ ] Email templates structure

3. **OTP Logic**
   - [ ] OTP generation
   - [ ] OTP verification
   - [ ] Rate limiting

4. **Auth Updates**
   - [ ] Add verify-email endpoint
   - [ ] Add resend-verification endpoint
   - [ ] Update register to send OTP
   - [ ] Update login to check verification

5. **Testing**
   - [ ] Unit tests for OTP service
   - [ ] E2E tests for verification flow

### Phase 3: Password Recovery (Week 2)

**Priority: High**

1. **Auth Updates**
   - [ ] Add forgot-password endpoint
   - [ ] Add verify-reset-code endpoint
   - [ ] Add reset-password endpoint
   - [ ] Invalidate sessions on password change

2. **Testing**
   - [ ] E2E tests for password recovery flow

### Phase 4: Subscription System (Week 2-3)

**Priority: High**

1. **Database Schema**
   - [ ] Create Plan model
   - [ ] Create Subscription model
   - [ ] Create PlanFeature model
   - [ ] Create UsageRecord model
   - [ ] Run migration

2. **Seed Data**
   - [ ] Seed Free, Pro, Premium plans
   - [ ] Seed plan features

3. **Subscriptions Module**
   - [ ] Plans repository
   - [ ] Subscriptions repository
   - [ ] Usage repository
   - [ ] Subscriptions service
   - [ ] Plans controller

4. **Integration**
   - [ ] Assign free plan on registration
   - [ ] Include plan info in user response

### Phase 5: Feature Access Control (Week 3)

**Priority: Medium**

1. **Guards & Decorators**
   - [ ] Feature guard
   - [ ] RequireFeature decorator

2. **Usage Tracking**
   - [ ] Implement incrementUsage
   - [ ] Implement decrementUsage
   - [ ] Implement getCurrentUsage
   - [ ] Period calculation helpers

3. **Integration Example**
   - [ ] Update Accounts module with feature checks
   - [ ] Add usage endpoint

4. **Testing**
   - [ ] Unit tests for subscription service
   - [ ] E2E tests for feature limits

### Phase 6: Plan Upgrade/Downgrade (Week 4)

**Priority: Medium**

1. **Database Schema**
   - [ ] Add scheduledPlanId, scheduledChangeAt to Subscription
   - [ ] Add graceOverages, gracePeriodEnd to Subscription
   - [ ] Create PlanChangeLog model
   - [ ] Run migration

2. **Subscription Service Updates**
   - [ ] Implement upgradePlan()
   - [ ] Implement downgradePlan()
   - [ ] Implement cancelSubscription()
   - [ ] Implement reactivateSubscription()
   - [ ] Implement cancelScheduledChange()
   - [ ] Implement previewPlanChange()
   - [ ] Implement checkResourceOverages()
   - [ ] Implement calculateProration()

3. **Cron Jobs**
   - [ ] Create SubscriptionsCronService
   - [ ] Implement applyScheduledPlanChanges() (hourly)
   - [ ] Implement handleExpiredGracePeriods() (daily)
4. **API Endpoints**
   - [ ] POST /subscriptions/upgrade
   - [ ] POST /subscriptions/downgrade
   - [ ] POST /subscriptions/cancel
   - [ ] POST /subscriptions/reactivate
   - [ ] DELETE /subscriptions/scheduled
   - [ ] GET /subscriptions/preview

5. **Email Templates**
   - [ ] SUBSCRIPTION_CANCELLED
   - [ ] PLAN_CHANGED
   - [ ] PLAN_CHANGED_WITH_GRACE
   - [ ] GRACE_PERIOD_WARNING
   - [ ] GRACE_PERIOD_EXPIRED

6. **Testing**
   - [ ] Unit tests for upgrade/downgrade logic
   - [ ] Unit tests for proration calculation
   - [ ] Unit tests for resource overage detection
   - [ ] E2E tests for plan change flows
   - [ ] E2E tests for scheduled change application

---

## Testing Strategy

### Unit Tests

```typescript
// auth.service.spec.ts
describe('AuthService', () => {
  describe('register', () => {
    it('should create user with hashed password');
    it('should assign free plan to new user');
    it('should generate verification OTP');
    it('should throw ConflictException for duplicate email');
  });

  describe('login', () => {
    it('should return tokens for valid credentials');
    it('should throw UnauthorizedException for invalid password');
    it('should throw ForbiddenException for unverified email');
    it('should throw ForbiddenException for suspended account');
  });

  describe('verifyEmail', () => {
    it('should activate user with valid OTP');
    it('should return tokens after verification');
    it('should increment attempts for invalid OTP');
    it('should throw after max attempts exceeded');
  });
});

// subscriptions.service.spec.ts
describe('SubscriptionsService', () => {
  describe('checkFeatureAccess', () => {
    it('should allow access for BOOLEAN features with value 1');
    it('should deny access for BOOLEAN features with value 0');
    it('should allow access for UNLIMITED features');
    it('should allow access when under COUNT limit');
    it('should deny access when COUNT limit exceeded');
  });

  describe('upgradePlan', () => {
    it('should apply upgrade immediately');
    it('should calculate proration correctly');
    it('should cancel any scheduled downgrade');
    it('should throw for non-upgrade (lower or same plan)');
    it('should log the plan change');
  });

  describe('downgradePlan', () => {
    it('should schedule downgrade for period end');
    it('should detect resource overages');
    it('should allow downgrade with overages (soft limit strategy)');
    it('should throw for non-downgrade (higher or same plan)');
    it('should throw if already has scheduled change');
  });

  describe('cancelSubscription', () => {
    it('should schedule cancellation for period end');
    it('should throw for free plan users');
    it('should send cancellation email');
  });

  describe('reactivateSubscription', () => {
    it('should remove scheduled cancellation');
    it('should throw if not cancelled');
  });

  describe('checkResourceOverages', () => {
    it('should return empty array when within limits');
    it('should detect accounts overage');
    it('should detect goals overage');
    it('should ignore CONSUMABLE features');
    it('should ignore UNLIMITED features');
  });

  describe('calculateProration', () => {
    it('should calculate correct proration for mid-month upgrade');
    it('should return 0 for upgrade from free plan');
    it('should handle edge case of last day of period');
  });
});
```

### E2E Tests

```typescript
// auth.e2e-spec.ts
describe('Auth (e2e)', () => {
  describe('POST /auth/register', () => {
    it('should register new user and return success message');
    it('should return 409 for duplicate email');
    it('should return 400 for invalid email format');
    it('should return 400 for weak password');
  });

  describe('POST /auth/login', () => {
    it('should return tokens for valid credentials');
    it('should return 401 for invalid credentials');
    it('should return 403 for unverified email');
  });

  describe('POST /auth/verify-email', () => {
    it('should verify email and return tokens');
    it('should return 400 for expired OTP');
    it('should return 429 after max attempts');
  });

  describe('POST /auth/refresh', () => {
    it('should return new tokens with valid refresh token');
    it('should return 401 for revoked refresh token');
    it('should invalidate old refresh token (rotation)');
  });
});

// subscriptions.e2e-spec.ts
describe('Subscriptions (e2e)', () => {
  describe('POST /subscriptions/upgrade', () => {
    it('should upgrade from Free to Pro immediately');
    it('should upgrade from Pro to Premium immediately');
    it('should return 400 when trying to "upgrade" to lower plan');
    it('should return 400 when already on target plan');
    it('should cancel scheduled downgrade when upgrading');
    it('should include proration amount in response');
  });

  describe('POST /subscriptions/downgrade', () => {
    it('should schedule downgrade from Premium to Pro');
    it('should schedule downgrade from Pro to Free');
    it('should return 400 when trying to "downgrade" to higher plan');
    it('should include overages in response when present');
    it('should return 400 if change already scheduled');
  });

  describe('POST /subscriptions/cancel', () => {
    it('should schedule cancellation for paid plan');
    it('should return 400 for free plan user');
    it('should include effective date in response');
  });

  describe('POST /subscriptions/reactivate', () => {
    it('should remove pending cancellation');
    it('should return 400 if not cancelled');
  });

  describe('DELETE /subscriptions/scheduled', () => {
    it('should cancel scheduled downgrade');
    it('should cancel scheduled cancellation');
    it('should return 400 if no scheduled change');
  });

  describe('GET /subscriptions/preview', () => {
    it('should preview upgrade with proration');
    it('should preview downgrade with overages');
    it('should show feature changes');
  });

  describe('Scheduled Changes (Cron)', () => {
    it('should apply scheduled downgrade at period end');
    it('should apply grace period when overages exist');
    it('should send appropriate emails on plan change');
  });
});
```

---


## Plan Upgrade/Downgrade System

### Overview

El manejo de cambios de plan es una de las partes más complejas de un sistema de suscripciones. Hay que considerar:

1. **Timing**: ¿Cuándo se aplica el cambio?
2. **Billing**: ¿Cómo se maneja el prorrateo?
3. **Features**: ¿Qué pasa con los datos que exceden los nuevos límites?
4. **Grace Period**: ¿Cuánto tiempo tiene el usuario para ajustarse?

### Tipos de Cambios de Plan

| Tipo             | Descripción                   | Ejemplo       | Timing del Cambio   |
| ---------------- | ----------------------------- | ------------- | ------------------- |
| **Upgrade**      | Plan inferior → Plan superior | Free → Pro    | **Inmediato**       |
| **Downgrade**    | Plan superior → Plan inferior | Premium → Pro | **Fin del período** |
| **Cancellation** | Plan pagado → Free            | Pro → Free    | **Fin del período** |

### Principio Fundamental: Immediate Upgrade, Deferred Downgrade

Este es el estándar de la industria (Stripe, Apple, Google Play):

- **Upgrades**: Se aplican INMEDIATAMENTE porque el usuario está pagando más
- **Downgrades**: Se aplican AL FINAL DEL PERÍODO porque el usuario ya pagó por el período actual

```
┌────────────────────────────────────────────────────────────────┐
│                    UPGRADE (Free → Pro)                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Usuario hace upgrade el día 15 del mes                        │
│                                                                │
│  ──────────────┬──────────────────────────────────────────►    │
│                │                                               │
│    Free Plan   │   Pro Plan (INMEDIATO)                        │
│                │                                               │
│                ▼                                               │
│          Día 15                                                │
│                                                                │
│  • Nuevos límites activos AHORA                                │
│  • Facturación prorrateada (cobro parcial)                     │
│  • Usuario puede usar features Pro inmediatamente              │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                   DOWNGRADE (Pro → Free)                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Usuario hace downgrade el día 15 del mes                      │
│                                                                │
│  ──────────────┬──────────────────────────────────────────►    │
│                │                        │                      │
│    Pro Plan    │   Pro Plan (continúa)  │  Free Plan           │
│                │                        │                      │
│                ▼                        ▼                      │
│          Día 15                    Fin del período             │
│    (solicitud)                      (cambio real)              │
│                                                                │
│  • Usuario mantiene Pro hasta fin del período                  │
│  • Subscription.scheduledPlanId = 'free'                       │
│  • Al terminar período → apply scheduled change                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Schema Additions

```prisma
model Subscription {
  id          String   @id @default(cuid(2))

  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  planId      String
  plan        Plan     @relation(fields: [planId], references: [id])

  status      SubscriptionStatus @default(ACTIVE)

  // Period
  currentPeriodStart DateTime @default(now())
  currentPeriodEnd   DateTime? // null for free plan

  // ★ NEW: Scheduled plan change (for downgrades)
  scheduledPlanId    String?   // Plan to switch to at period end
  scheduledPlan      Plan?     @relation("ScheduledPlan", fields: [scheduledPlanId], references: [id])
  scheduledChangeAt  DateTime? // When the change was scheduled

  // Cancellation
  cancelledAt   DateTime?
  cancelReason  String?

  // ... rest of fields
}

// Also add the inverse relation to Plan:
model Plan {
  // ... existing fields

  subscriptions        Subscription[]
  scheduledSubscriptions Subscription[] @relation("ScheduledPlan")
}
```

### API Endpoints for Plan Changes

| Method | Endpoint                          | Auth | Description                      |
| ------ | --------------------------------- | ---- | -------------------------------- |
| POST   | `/api/v1/subscriptions/upgrade`   | JWT  | Upgrade to a higher plan         |
| POST   | `/api/v1/subscriptions/downgrade` | JWT  | Schedule downgrade to lower plan |
| POST   | `/api/v1/subscriptions/cancel`    | JWT  | Cancel subscription (→ Free)     |
| DELETE | `/api/v1/subscriptions/scheduled` | JWT  | Cancel a scheduled change        |
| GET    | `/api/v1/subscriptions/preview`   | JWT  | Preview change (proration, etc.) |

### DTOs

```typescript
// Upgrade/Downgrade Request
class ChangePlanDto {
  @IsString()
  planCode: string; // 'pro', 'premium', 'free'
}

// Preview Response
interface PlanChangePreview {
  currentPlan: {
    code: string;
    name: string;
    priceMonthly: number;
  };
  newPlan: {
    code: string;
    name: string;
    priceMonthly: number;
  };
  changeType: 'upgrade' | 'downgrade' | 'cancel';
  effectiveDate: Date; // When change takes effect
  prorationAmount?: number; // Only for upgrades (positive = charge)
  featureChanges: {
    gained: string[]; // Features user gains
    lost: string[]; // Features user loses
    limitChanges: Array<{
      feature: string;
      current: number | 'unlimited';
      new: number | 'unlimited';
    }>;
  };
  resourceOverages?: Array<{
    // Only for downgrades
    feature: string;
    current: number;
    newLimit: number;
    excess: number;
  }>;
}
```

### Upgrade Flow

```typescript
// src/modules/subscriptions/subscriptions.service.ts

async upgradePlan(userId: string, newPlanCode: string): Promise<UpgradeResult> {
  const subscription = await this.getUserSubscription(userId);
  const currentPlan = subscription.plan;
  const newPlan = await this.plansRepository.findByCode(newPlanCode);

  // 1. Validate it's actually an upgrade
  if (newPlan.sortOrder <= currentPlan.sortOrder) {
    throw new BadRequestException({
      code: 'NOT_AN_UPGRADE',
      message: 'Use downgrade endpoint for moving to a lower plan',
    });
  }

  // 2. Cancel any scheduled downgrade
  if (subscription.scheduledPlanId) {
    await this.cancelScheduledChange(userId);
  }

  // 3. Calculate proration (if upgrading from paid plan)
  let prorationAmount = 0;
  if (currentPlan.priceMonthly > 0 && subscription.currentPeriodEnd) {
    prorationAmount = this.calculateProration(
      currentPlan.priceMonthly,
      newPlan.priceMonthly,
      subscription.currentPeriodEnd,
    );
  }

  // 4. Apply upgrade IMMEDIATELY
  const updated = await this.prisma.subscription.update({
    where: { userId },
    data: {
      planId: newPlan.id,
      // Keep current period end (they still owe for full period at new rate)
      updatedAt: new Date(),
    },
    include: { plan: true },
  });

  // 5. Log the change
  await this.logPlanChange({
    userId,
    fromPlanId: currentPlan.id,
    toPlanId: newPlan.id,
    changeType: 'UPGRADE',
    effectiveAt: new Date(),
    prorationAmount,
  });

  // 6. Reset usage records for consumables (fresh start on new plan)
  // Optional: Some systems keep usage, others reset
  // We recommend keeping usage to avoid gaming

  return {
    success: true,
    plan: updated.plan,
    effectiveNow: true,
    prorationAmount,
    message: `Successfully upgraded to ${newPlan.name}`,
  };
}

private calculateProration(
  currentPrice: number,
  newPrice: number,
  periodEnd: Date,
): number {
  const now = new Date();
  const totalDaysInPeriod = 30; // Simplified, use actual days
  const daysRemaining = Math.ceil(
    (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const dailyCurrentRate = currentPrice / totalDaysInPeriod;
  const dailyNewRate = newPrice / totalDaysInPeriod;

  // Credit for unused days at old rate, charge for remaining days at new rate
  const credit = dailyCurrentRate * daysRemaining;
  const charge = dailyNewRate * daysRemaining;

  return Number((charge - credit).toFixed(2)); // Amount to charge
}
```

### Downgrade Flow

```typescript
async downgradePlan(userId: string, newPlanCode: string): Promise<DowngradeResult> {
  const subscription = await this.getUserSubscription(userId);
  const currentPlan = subscription.plan;
  const newPlan = await this.plansRepository.findByCode(newPlanCode);

  // 1. Validate it's actually a downgrade
  if (newPlan.sortOrder >= currentPlan.sortOrder) {
    throw new BadRequestException({
      code: 'NOT_A_DOWNGRADE',
      message: 'Use upgrade endpoint for moving to a higher plan',
    });
  }

  // 2. Check for resource overages
  const overages = await this.checkResourceOverages(userId, newPlan.id);

  // 3. Schedule the downgrade (don't apply immediately)
  const effectiveDate = subscription.currentPeriodEnd || new Date();

  await this.prisma.subscription.update({
    where: { userId },
    data: {
      scheduledPlanId: newPlan.id,
      scheduledChangeAt: new Date(),
    },
  });

  // 4. Log the scheduled change
  await this.logPlanChange({
    userId,
    fromPlanId: currentPlan.id,
    toPlanId: newPlan.id,
    changeType: 'DOWNGRADE_SCHEDULED',
    scheduledFor: effectiveDate,
  });

  return {
    success: true,
    currentPlan,
    scheduledPlan: newPlan,
    effectiveDate,
    overages, // Warn user about resources they need to reduce
    message: `Your plan will change to ${newPlan.name} on ${effectiveDate.toLocaleDateString()}`,
  };
}

/**
 * Check if user has more resources than the new plan allows
 */
private async checkResourceOverages(
  userId: string,
  newPlanId: string,
): Promise<ResourceOverage[]> {
  const overages: ResourceOverage[] = [];
  const newPlanFeatures = await this.getPlanFeatures(newPlanId);

  for (const feature of newPlanFeatures) {
    if (feature.featureType !== 'RESOURCE' || feature.limitType === 'UNLIMITED') {
      continue;
    }

    const currentCount = await this.getResourceCount(userId, feature.featureCode);

    if (currentCount > feature.limitValue) {
      overages.push({
        feature: feature.featureCode,
        current: currentCount,
        newLimit: feature.limitValue,
        excess: currentCount - feature.limitValue,
      });
    }
  }

  return overages;
}
```

### Handling Resource Overages on Downgrade

Cuando un usuario hace downgrade y tiene más recursos de los que permite el nuevo plan, hay 3 estrategias:

#### Strategy 1: Soft Limit (Recommended)

**No bloquear nada, solo prevenir creación de nuevos recursos.**

```typescript
// User has 5 accounts, downgrades to Free (max 2)
// Result: User keeps 5 accounts but CANNOT create new ones

async checkFeatureAccess(userId: string, featureCode: string): Promise<AccessResult> {
  const planFeature = await this.getPlanFeature(userId, featureCode);
  const currentCount = await this.getResourceCount(userId, featureCode);

  // For RESOURCES: Only block NEW creation, not usage of existing
  if (planFeature.featureType === 'RESOURCE') {
    if (currentCount >= planFeature.limitValue) {
      return {
        allowed: false, // Cannot CREATE new
        reason: 'Limit reached. Delete existing items or upgrade your plan.',
        current: currentCount,
        limit: planFeature.limitValue,
        canUseExisting: true, // CAN still use existing resources
      };
    }
  }
  // ... rest of logic
}
```

**Ventajas**:

- No hay pérdida de datos
- Mejor UX
- Usuario puede elegir qué eliminar a su ritmo

**Desventajas**:

- Usuario "gana" features por downgrade

#### Strategy 2: Forced Selection Before Downgrade

**Requiere que el usuario reduzca recursos ANTES de confirmar el downgrade.**

```typescript
async downgradePlan(userId: string, newPlanCode: string): Promise<DowngradeResult> {
  const overages = await this.checkResourceOverages(userId, newPlanId);

  if (overages.length > 0) {
    throw new BadRequestException({
      code: 'RESOURCE_OVERAGE',
      message: 'Please reduce your resources before downgrading',
      overages,
      actions: overages.map(o => ({
        feature: o.feature,
        message: `Delete ${o.excess} ${o.feature} to continue`,
        currentCount: o.current,
        requiredMax: o.newLimit,
      })),
    });
  }

  // Continue with downgrade...
}
```

**Ventajas**:

- Límites siempre respetados
- Usuario tiene control sobre qué eliminar

**Desventajas**:

- Más fricción en el proceso
- Puede frustrar al usuario

#### Strategy 3: Grace Period (Hybrid - Also Recommended)

**Permitir el downgrade pero dar un período de gracia para ajustar.**

```typescript
// Add to Subscription model
model Subscription {
  // ... existing fields

  graceOverages     Json?     // { accounts: { current: 5, limit: 2, deadline: Date } }
  gracePeriodEnd    DateTime? // When grace period expires
}

async applyScheduledDowngrade(subscriptionId: string): Promise<void> {
  const subscription = await this.getSubscription(subscriptionId);
  const overages = await this.checkResourceOverages(
    subscription.userId,
    subscription.scheduledPlanId
  );

  if (overages.length > 0) {
    // Apply the plan change but set grace period
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: subscription.scheduledPlanId,
        scheduledPlanId: null,
        scheduledChangeAt: null,
        graceOverages: overages,
        gracePeriodEnd: addDays(new Date(), 7), // 7 days to comply
      },
    });

    // Send email warning about grace period
    await this.emailService.send({
      to: subscription.user.email,
      template: 'GRACE_PERIOD_WARNING',
      data: {
        gracePeriodEnd: addDays(new Date(), 7),
        overages,
      },
    });
  } else {
    // Clean downgrade, no overages
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: subscription.scheduledPlanId,
        scheduledPlanId: null,
        scheduledChangeAt: null,
      },
    });
  }
}

// Cron job to handle expired grace periods
@Cron('0 0 * * *') // Daily at midnight
async handleExpiredGracePeriods(): Promise<void> {
  const expired = await this.prisma.subscription.findMany({
    where: {
      gracePeriodEnd: { lt: new Date() },
      graceOverages: { not: null },
    },
  });

  for (const sub of expired) {
    // Option 1: Block user until they comply
    // Option 2: Soft-delete oldest excess resources
    // Option 3: Convert to read-only mode

    // We recommend Option 1: Block creation + send urgent email
    await this.emailService.send({
      to: sub.user.email,
      template: 'GRACE_PERIOD_EXPIRED',
      data: { /* ... */ },
    });
  }
}
```

### Recommended Strategy for Facets

Dado que Facets es una app de finanzas personales donde los datos son MUY sensibles, recomiendo:

| Tipo de Recurso       | Estrategia            | Razón                                |
| --------------------- | --------------------- | ------------------------------------ |
| **Accounts**          | Soft Limit            | Perder cuentas = perder historial    |
| **Goals**             | Grace Period (7 días) | Usuario puede elegir cuáles mantener |
| **Debts/Loans**       | Soft Limit            | Datos financieros críticos           |
| **Custom Categories** | Grace Period (7 días) | Usuario puede consolidar categorías  |
| **Transactions**      | N/A (CONSUMABLE)      | Reset mensual, no aplica             |

### Cancellation Flow

```typescript
async cancelSubscription(
  userId: string,
  reason?: string,
): Promise<CancellationResult> {
  const subscription = await this.getUserSubscription(userId);
  const currentPlan = subscription.plan;

  // Free plan cannot be cancelled
  if (currentPlan.code === 'free') {
    throw new BadRequestException({
      code: 'ALREADY_FREE',
      message: 'You are already on the free plan',
    });
  }

  const freePlan = await this.plansRepository.findDefault();
  const effectiveDate = subscription.currentPeriodEnd || new Date();

  // Schedule cancellation (downgrade to free at period end)
  await this.prisma.subscription.update({
    where: { userId },
    data: {
      scheduledPlanId: freePlan.id,
      scheduledChangeAt: new Date(),
      cancelledAt: new Date(),
      cancelReason: reason,
    },
  });

  // Send cancellation email
  await this.emailService.send({
    to: subscription.user.email,
    template: 'SUBSCRIPTION_CANCELLED',
    data: {
      planName: currentPlan.name,
      effectiveDate,
      reason,
    },
  });

  return {
    success: true,
    effectiveDate,
    message: `Your ${currentPlan.name} subscription will end on ${effectiveDate.toLocaleDateString()}. You'll be moved to the Free plan.`,
  };
}

async reactivateSubscription(userId: string): Promise<ReactivationResult> {
  const subscription = await this.getUserSubscription(userId);

  // Can only reactivate if there's a pending cancellation
  if (!subscription.scheduledPlanId || !subscription.cancelledAt) {
    throw new BadRequestException({
      code: 'NOT_CANCELLED',
      message: 'Your subscription is not cancelled',
    });
  }

  // Remove scheduled change
  await this.prisma.subscription.update({
    where: { userId },
    data: {
      scheduledPlanId: null,
      scheduledChangeAt: null,
      cancelledAt: null,
      cancelReason: null,
    },
  });

  return {
    success: true,
    plan: subscription.plan,
    message: 'Your subscription has been reactivated',
  };
}
```

### Cron Job: Apply Scheduled Changes

```typescript
// src/modules/subscriptions/subscriptions.cron.ts

@Injectable()
export class SubscriptionsCronService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private logger: Logger,
  ) {}

  /**
   * Run every hour to apply scheduled plan changes
   */
  @Cron('0 * * * *') // Every hour at minute 0
  async applyScheduledPlanChanges(): Promise<void> {
    const now = new Date();

    // Find subscriptions where:
    // 1. There's a scheduled plan change
    // 2. Current period has ended
    const subscriptionsToChange = await this.prisma.subscription.findMany({
      where: {
        scheduledPlanId: { not: null },
        currentPeriodEnd: { lte: now },
      },
      include: {
        user: true,
        plan: true,
        scheduledPlan: true,
      },
    });

    for (const subscription of subscriptionsToChange) {
      try {
        await this.applyPlanChange(subscription);

        this.logger.log(
          `Applied scheduled plan change for user ${subscription.userId}: ` +
            `${subscription.plan.code} → ${subscription.scheduledPlan.code}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to apply plan change for user ${subscription.userId}`,
          error,
        );
        // Don't throw - continue with other subscriptions
      }
    }
  }

  private async applyPlanChange(
    subscription: SubscriptionWithRelations,
  ): Promise<void> {
    const overages = await this.checkResourceOverages(
      subscription.userId,
      subscription.scheduledPlanId,
    );

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: subscription.scheduledPlanId,
        scheduledPlanId: null,
        scheduledChangeAt: null,
        cancelledAt: null, // Clear cancellation if was cancelled
        cancelReason: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd:
          subscription.scheduledPlan.code === 'free'
            ? null // Free plan doesn't expire
            : addMonths(new Date(), 1),
        // Set grace period if there are overages
        graceOverages: overages.length > 0 ? overages : null,
        gracePeriodEnd: overages.length > 0 ? addDays(new Date(), 7) : null,
      },
    });

    // Send appropriate email
    if (overages.length > 0) {
      await this.emailService.send({
        to: subscription.user.email,
        template: 'PLAN_CHANGED_WITH_GRACE',
        data: {
          oldPlan: subscription.plan.name,
          newPlan: subscription.scheduledPlan.name,
          overages,
          gracePeriodEnd: addDays(new Date(), 7),
        },
      });
    } else {
      await this.emailService.send({
        to: subscription.user.email,
        template: 'PLAN_CHANGED',
        data: {
          oldPlan: subscription.plan.name,
          newPlan: subscription.scheduledPlan.name,
        },
      });
    }
  }
}
```

### Plan Change History (Audit Log)

```prisma
model PlanChangeLog {
  id          String   @id @default(cuid(2))

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  fromPlanId  String
  fromPlan    Plan     @relation("FromPlan", fields: [fromPlanId], references: [id])

  toPlanId    String
  toPlan      Plan     @relation("ToPlan", fields: [toPlanId], references: [id])

  changeType  PlanChangeType

  // Timing
  requestedAt DateTime @default(now()) // When user requested the change
  effectiveAt DateTime?                 // When change was applied
  scheduledFor DateTime?                // For downgrades: when it will apply

  // Billing
  prorationAmount Decimal? @db.Decimal(10, 2)

  // Metadata
  reason      String?
  metadata    Json?

  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
  @@map("plan_change_logs")
}

enum PlanChangeType {
  UPGRADE              // Immediate upgrade
  DOWNGRADE_SCHEDULED  // Scheduled for period end
  DOWNGRADE_APPLIED    // When scheduled downgrade is applied
  CANCELLATION         // User cancelled (scheduled)
  CANCELLATION_APPLIED // When cancellation is applied
  REACTIVATION         // User reactivated before period end
}
```

### Frontend Integration Notes

El frontend debe manejar estos casos:

```typescript
// Types for frontend
interface SubscriptionState {
  currentPlan: Plan;
  status: SubscriptionStatus;

  // Scheduled change (if any)
  scheduledChange?: {
    newPlan: Plan;
    effectiveDate: Date;
    canCancel: boolean;
  };

  // Grace period (if any)
  gracePeriod?: {
    endDate: Date;
    overages: ResourceOverage[];
  };

  // Usage stats
  usage: {
    [featureCode: string]: {
      current: number;
      limit: number | 'unlimited';
      type: 'resource' | 'consumable';
      periodEnd?: Date; // For consumables
    };
  };
}

// UI States to handle:
// 1. Normal subscription
// 2. Pending downgrade (show banner: "Your plan will change to X on Y")
// 3. Grace period (show warning: "Please reduce your X to Y before Z")
// 4. Cancelled but still active (show: "Your plan ends on X. Reactivate?")
```

### Response Examples

**Upgrade Success:**

```json
{
  "success": true,
  "data": {
    "plan": {
      "code": "pro",
      "name": "Pro"
    },
    "effectiveNow": true,
    "prorationAmount": 3.5,
    "message": "Successfully upgraded to Pro"
  }
}
```

**Downgrade Scheduled:**

```json
{
  "success": true,
  "data": {
    "currentPlan": { "code": "pro", "name": "Pro" },
    "scheduledPlan": { "code": "free", "name": "Free" },
    "effectiveDate": "2026-03-01T00:00:00.000Z",
    "overages": [
      {
        "feature": "accounts",
        "current": 5,
        "newLimit": 2,
        "excess": 3
      }
    ],
    "message": "Your plan will change to Free on March 1, 2026. You have 3 accounts over the Free plan limit."
  }
}
```

**Downgrade Blocked (Strategy 2):**

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_OVERAGE",
    "message": "Please reduce your resources before downgrading",
    "overages": [
      {
        "feature": "accounts",
        "current": 5,
        "requiredMax": 2,
        "excess": 3,
        "action": "Delete 3 accounts to continue"
      }
    ]
  }
}
```

---

### Still Need Review

1. **OTP Storage**: Plain text OK? (Recommendation: Yes, 10 min expiry + single-use is secure enough)

2. **Email Enumeration**: Should registration reveal if email exists?
   - **Recommendation**: Yes, for better UX. Most modern apps do this.

3. **Login After Registration**: Should we auto-login after email verification?
   - **Recommendation**: Yes, reduces friction

4. **Refresh Token Limit**: Max active sessions per user?
   - **Recommendation**: 5 devices initially

5. **Plan Pricing**: Are the proposed prices correct?
   - Free: $0, Pro: $4.99, Premium: $9.99

6. **Usage Reset**: When should monthly counters reset?
   - **Recommendation**: First of each month (simpler) vs. subscription anniversary

7. **Resource Overage Strategy**: What to do when user downgrades and has more resources than allowed?
   - **Option 1: Soft Limit** (Recommended for financial data) - Block creation only, keep existing
   - **Option 2: Forced Selection** - Require user to delete excess before downgrade
   - **Option 3: Grace Period** - Allow downgrade, give 7 days to comply
   - **Recommendation**: Soft Limit for accounts/debts/loans (critical data), Grace Period for goals/categories

8. **Proration Strategy**: How to handle billing when upgrading mid-cycle?
   - **Recommendation**: Credit for unused days at old rate, charge for remaining days at new rate

9. **Downgrade Timing**: Apply at exact period end or next billing cycle start?
   - **Recommendation**: Period end (standard industry practice)

---

## Directory Structure (Final)

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── jwt-refresh.strategy.ts
│   │   ├── dtos/
│   │   │   ├── register.dto.ts
│   │   │   ├── login.dto.ts
│   │   │   ├── verify-email.dto.ts
│   │   │   ├── forgot-password.dto.ts
│   │   │   ├── reset-password.dto.ts
│   │   │   └── refresh-token.dto.ts
│   │   ├── interfaces/
│   │   │   └── jwt-payload.interface.ts
│   │   └── auth.service.spec.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   ├── dtos/
│   │   │   └── update-user.dto.ts
│   │   └── users.service.spec.ts
│   │
│   ├── email/
│   │   ├── email.module.ts
│   │   ├── email.service.ts
│   │   ├── interfaces/
│   │   │   └── email.interface.ts
│   │   └── templates/           # Future: HTML templates
│   │
│   ├── otp/
│   │   ├── otp.module.ts
│   │   ├── otp.service.ts
│   │   ├── otp.repository.ts
│   │   └── otp.service.spec.ts
│   │
│   ├── subscriptions/
│   │   ├── subscriptions.module.ts
│   │   ├── subscriptions.controller.ts
│   │   ├── subscriptions.service.ts
│   │   ├── plans.controller.ts
│   │   ├── repositories/
│   │   │   ├── plans.repository.ts
│   │   │   ├── subscriptions.repository.ts
│   │   │   └── usage.repository.ts
│   │   ├── constants/
│   │   │   └── features.constant.ts
│   │   ├── dtos/
│   │   │   └── usage-response.dto.ts
│   │   └── subscriptions.service.spec.ts
│   │
│   └── ... (other feature modules)
│
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── feature.guard.ts          # NEW
│   ├── decorators/
│   │   ├── public.decorator.ts
│   │   ├── current-user.decorator.ts
│   │   └── feature.decorator.ts      # NEW
│   └── ...
```



---

**Next Steps**: Once approved, we proceed with Phase 1 (Core Authentication).

# Accounts & Categories API

Guide for frontend developers. All endpoints require `Authorization: Bearer <token>` header.

All responses are wrapped in:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "timestamp": "2025-01-15T..." }
}
```

Errors follow:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

---

## Accounts

Financial accounts (bank accounts, cards, cash, etc.).

### Account Types

`CASH` | `DEBIT_CARD` | `CREDIT_CARD` | `SAVINGS` | `INVESTMENT` | `DIGITAL_WALLET` | `OTHER`

### Create Account

```
POST /api/accounts
```

```json
{
  "name": "My Debit Card",
  "type": "DEBIT_CARD",
  "balance": 1500.5,
  "currencyCode": "USD",
  "color": "#3498DB",
  "icon": "credit-card"
}
```

For **credit cards**, include extra fields:

```json
{
  "name": "Visa Gold",
  "type": "CREDIT_CARD",
  "balance": -250,
  "currencyCode": "USD",
  "creditLimit": 5000,
  "statementClosingDay": 15,
  "paymentDueDay": 5
}
```

**Response** `201`:

```json
{
  "success": true,
  "data": {
    "id": "cm5abc123...",
    "name": "My Debit Card",
    "type": "DEBIT_CARD",
    "balance": "1500.5",
    "currencyCode": "USD",
    "color": "#3498DB",
    "icon": "credit-card",
    "includeInTotal": true,
    "isArchived": false,
    "sortOrder": 0,
    "createdAt": "2025-01-15T...",
    "updatedAt": "2025-01-15T..."
  }
}
```

> **Note:** `balance` and `creditLimit` are returned as **strings** (Decimal precision).

**Errors:**

- `403` — `FEATURE_LIMIT_EXCEEDED` (plan limit reached)
- `400` — `INVALID_CREDIT_CARD_FIELDS` (missing creditLimit for CREDIT_CARD, or credit fields on non-CREDIT_CARD)
- `409` — `ACCOUNT_DUPLICATE_NAME`

### List Accounts

```
GET /api/accounts
GET /api/accounts?type=CREDIT_CARD
GET /api/accounts?includeArchived=true
GET /api/accounts?currencyCode=USD
```

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "accounts": [ ... ],
    "total": 2
  }
}
```

> Archived accounts are **hidden by default**. Pass `includeArchived=true` to see them.

### Get Account

```
GET /api/accounts/:id
```

**Errors:** `404` — `ACCOUNT_NOT_FOUND` | `400` — invalid CUID format

### Balance Summary

```
GET /api/accounts/summary
```

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "balances": [
      {
        "currencyCode": "USD",
        "totalBalance": "1250.5",
        "accountCount": 2
      }
    ],
    "totalAccounts": 2
  }
}
```

> Only includes active (non-archived) accounts with `includeInTotal: true`.

### Update Account

```
PUT /api/accounts/:id
```

```json
{
  "name": "Updated Name",
  "color": "#E74C3C",
  "includeInTotal": false
}
```

All fields are optional. `type` and `currencyCode` **cannot** be changed after creation.

**Errors:** `409` — `ACCOUNT_DUPLICATE_NAME` | `404` — `ACCOUNT_NOT_FOUND`

### Archive / Unarchive

```
PATCH /api/accounts/:id/archive
PATCH /api/accounts/:id/unarchive
```

Archive hides the account from the UI while preserving transaction history. Archived accounts **don't count** towards plan limits.

**Unarchive errors:** `403` — `FEATURE_LIMIT_EXCEEDED` (if restoring would exceed your plan limit)

### Delete Account

```
DELETE /api/accounts/:id
```

Returns `204` (no content). Only works if the account has **no transactions**. If it has transactions, archive it instead.

**Errors:** `409` — `ACCOUNT_HAS_TRANSACTIONS`

---

## Categories

Transaction categories with 2-level hierarchy (parent → child). Includes system categories (shared, read-only) and custom categories (per user).

### Category Types

`EXPENSE` | `INCOME` | `TRANSFER`

### List Categories

```
GET /api/categories
GET /api/categories?type=EXPENSE
GET /api/categories?flat=true
GET /api/categories?includeInactive=true
```

**Default (tree)** `200`:

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "cm5...",
        "name": "Food & Dining",
        "type": "EXPENSE",
        "isSystem": true,
        "isActive": true,
        "icon": "utensils",
        "color": "#FF6B6B",
        "children": [
          {
            "id": "cm5...",
            "name": "Restaurants",
            "type": "EXPENSE",
            "parentId": "cm5...",
            "isSystem": true,
            "children": []
          }
        ]
      }
    ],
    "total": 42
  }
}
```

**Flat mode** (`?flat=true`): returns all categories as a flat list with empty `children: []`.

> Inactive categories are **hidden by default**. Pass `includeInactive=true` to see them.

### Create Custom Category

```
POST /api/categories
```

**Parent category:**

```json
{
  "name": "Custom Expense",
  "type": "EXPENSE",
  "icon": "star",
  "color": "#FF6B6B"
}
```

**Subcategory** (under a system or custom parent):

```json
{
  "name": "Home Office Supplies",
  "type": "EXPENSE",
  "parentId": "cm5parent..."
}
```

**Rules:**

- Max 2 levels deep (parent → child). No grandchildren.
- `type` must match parent's type (no INCOME child under EXPENSE parent).
- Name must be unique per user + type + parent level.

**Errors:**

- `403` — `FEATURE_LIMIT_EXCEEDED`
- `409` — `CATEGORY_DUPLICATE_NAME`
- `400` — `CATEGORY_PARENT_TYPE_MISMATCH` | `CATEGORY_MAX_DEPTH`

### Get Category

```
GET /api/categories/:id
```

Returns the category with its `children` array.

### Update Custom Category

```
PUT /api/categories/:id
```

```json
{
  "name": "Updated Name",
  "color": "#9B59B6",
  "icon": "pencil"
}
```

> System categories **cannot** be modified (`403` — `CATEGORY_IS_SYSTEM`).

### Deactivate / Reactivate

```
PATCH /api/categories/:id/deactivate
PATCH /api/categories/:id/reactivate
```

Deactivate hides the category from selection lists while preserving existing transaction references.

> System categories **cannot** be deactivated/reactivated.

### Delete Custom Category

```
DELETE /api/categories/:id
```

Returns `204`. Only works if the category has **no transactions**. Otherwise, deactivate it.

> System categories **cannot** be deleted (`403` — `CATEGORY_IS_SYSTEM`).

**Errors:** `409` — `CATEGORY_HAS_TRANSACTIONS`

---

## Common Error Codes

| Code                            | HTTP | Meaning                                          |
| ------------------------------- | ---- | ------------------------------------------------ |
| `FEATURE_LIMIT_EXCEEDED`        | 403  | Plan limit reached — upgrade to create more      |
| `ACCOUNT_NOT_FOUND`             | 404  | Account doesn't exist or belongs to another user |
| `ACCOUNT_DUPLICATE_NAME`        | 409  | Account name already taken                       |
| `ACCOUNT_HAS_TRANSACTIONS`      | 409  | Can't delete — archive instead                   |
| `INVALID_CREDIT_CARD_FIELDS`    | 400  | Credit card field validation failed              |
| `CATEGORY_NOT_FOUND`            | 404  | Category doesn't exist or not accessible         |
| `CATEGORY_IS_SYSTEM`            | 403  | Can't modify/delete system categories            |
| `CATEGORY_DUPLICATE_NAME`       | 409  | Category name already taken                      |
| `CATEGORY_MAX_DEPTH`            | 400  | Can't nest deeper than 2 levels                  |
| `CATEGORY_PARENT_TYPE_MISMATCH` | 400  | Parent and child type must match                 |
| `CATEGORY_HAS_TRANSACTIONS`     | 409  | Can't delete — deactivate instead                |
| `VALIDATION_ERROR`              | 400  | Invalid input data                               |

## Plan Limits (Free Tier)

| Resource          | Free    | Pro  | Premium   |
| ----------------- | ------- | ---- | --------- |
| Accounts          | 2       | more | unlimited |
| Custom Categories | limited | more | unlimited |

> When a limit is reached, creation returns `403` with `FEATURE_LIMIT_EXCEEDED`. Show the user an upgrade prompt.

## Multi-tenancy

All data is isolated per user. Users can only see and manage their own accounts and custom categories. System categories are shared and visible to all users (read-only).

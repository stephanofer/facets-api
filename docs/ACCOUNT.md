## Accounts (`/accounts/*`)

- `GET /accounts`: `ADMIN` / `MEMBER` / `GUEST` pueden leer.

```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "cm8acc1234567890abcd1234",
        "name": "Main Checking",
        "type": "DEBIT_CARD",
        "balance": "1520.4500",
        "currencyCode": "USD",
        "color": "#1D4ED8",
        "icon": "wallet",
        "includeInTotal": true,
        "isArchived": false,
        "sortOrder": 0,
        "createdByUserId": "cm8usr1234567890abcd1234",
        "updatedByUserId": "cm8usr1234567890abcd1234",
        "createdAt": "2026-03-12T18:45:00.000Z",
        "updatedAt": "2026-03-12T18:45:00.000Z"
      }
    ],
    "total": 1
  },
  "meta": {
    "timestamp": "2026-03-12T18:46:00.000Z"
  }
}
```

- `POST /accounts`, `PUT /accounts/:id`, `PATCH /accounts/:id/archive`, `PATCH /accounts/:id/unarchive`, `DELETE /accounts/:id`: solo `ADMIN` / `MEMBER`.
- `GET /accounts/:id` y `GET /accounts/summary`: lectura permitida tambien para `GUEST`.

```json
{
  "success": true,
  "data": {
    "id": "cm8acc1234567890abcd1234",
    "name": "Main Checking",
    "type": "DEBIT_CARD",
    "balance": "1520.4500",
    "currencyCode": "USD",
    "includeInTotal": true,
    "isArchived": false,
    "sortOrder": 0,
    "createdAt": "2026-03-12T18:45:00.000Z",
    "updatedAt": "2026-03-12T18:45:00.000Z"
  },
  "meta": {
    "timestamp": "2026-03-12T18:47:00.000Z"
  }
}
```






- Errores relevantes:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient workspace role for this route"
  },
  "meta": {
    "timestamp": "2026-03-12T18:48:00.000Z",
    "path": "/api/v1/accounts",
    "requestId": "req_accounts_role"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "FEATURE_LIMIT_EXCEEDED",
    "message": "You have reached your account limit (2/2). Please upgrade your plan."
  },
  "meta": {
    "timestamp": "2026-03-12T18:49:00.000Z",
    "path": "/api/v1/accounts",
    "requestId": "req_accounts_limit"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_NOT_FOUND",
    "message": "Account not found"
  },
  "meta": {
    "timestamp": "2026-03-12T18:50:00.000Z",
    "path": "/api/v1/accounts/cm8otherworkspace",
    "requestId": "req_accounts_404"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_HAS_TRANSACTIONS",
    "message": "Cannot delete an account with transactions. Archive it instead."
  },
  "meta": {
    "timestamp": "2026-03-12T18:51:00.000Z",
    "path": "/api/v1/accounts/cm8acc1234567890abcd1234",
    "requestId": "req_accounts_conflict"
  }
}
```

## Categories (`/categories/*`)

- `GET /categories` y `GET /categories/:id`: `ADMIN` / `MEMBER` / `GUEST` pueden leer system + custom categories del workspace.

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "cm8cat_parent_food",
        "name": "Food & Drinks",
        "type": "EXPENSE",
        "icon": "utensils",
        "color": "#FF6B6B",
        "isSystem": true,
        "isActive": true,
        "sortOrder": 0,
        "createdAt": "2026-03-01T00:00:00.000Z",
        "updatedAt": "2026-03-01T00:00:00.000Z",
        "children": [
          {
            "id": "cm8cat_child_restaurants",
            "name": "Restaurants",
            "type": "EXPENSE",
            "parentId": "cm8cat_parent_food",
            "icon": "chef-hat",
            "color": "#F97316",
            "isSystem": true,
            "isActive": true,
            "sortOrder": 1,
            "createdAt": "2026-03-01T00:00:00.000Z",
            "updatedAt": "2026-03-01T00:00:00.000Z"
          }
        ]
      }
    ],
    "total": 2
  },
  "meta": {
    "timestamp": "2026-03-12T18:55:00.000Z"
  }
}
```

- `POST /categories`, `PUT /categories/:id`, `PATCH /categories/:id/deactivate`, `PATCH /categories/:id/reactivate`, `DELETE /categories/:id`: solo `ADMIN` / `MEMBER`.

```json
{
  "success": true,
  "data": {
    "id": "cm8cat_custom_salary",
    "name": "Freelance",
    "type": "INCOME",
    "icon": "briefcase",
    "color": "#10B981",
    "isSystem": false,
    "isActive": true,
    "sortOrder": 0,
    "createdAt": "2026-03-12T18:56:00.000Z",
    "updatedAt": "2026-03-12T18:56:00.000Z"
  },
  "meta": {
    "timestamp": "2026-03-12T18:56:00.000Z"
  }
}
```

- Errores relevantes:

```json
{
  "success": false,
  "error": {
    "code": "FEATURE_LIMIT_EXCEEDED",
    "message": "You have reached your custom category limit (10/10). Please upgrade your plan."
  },
  "meta": {
    "timestamp": "2026-03-12T18:57:00.000Z",
    "path": "/api/v1/categories",
    "requestId": "req_categories_limit"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "CATEGORY_IS_SYSTEM",
    "message": "System categories cannot be modified"
  },
  "meta": {
    "timestamp": "2026-03-12T18:58:00.000Z",
    "path": "/api/v1/categories/cm8cat_parent_food",
    "requestId": "req_categories_system"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "CATEGORY_PARENT_TYPE_MISMATCH",
    "message": "Parent category type 'EXPENSE' does not match child type 'INCOME'"
  },
  "meta": {
    "timestamp": "2026-03-12T18:59:00.000Z",
    "path": "/api/v1/categories",
    "requestId": "req_categories_parent"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "CATEGORY_NOT_FOUND",
    "message": "Category not found"
  },
  "meta": {
    "timestamp": "2026-03-12T19:00:00.000Z",
    "path": "/api/v1/categories/cm8otherworkspace",
    "requestId": "req_categories_404"
  }
}
```
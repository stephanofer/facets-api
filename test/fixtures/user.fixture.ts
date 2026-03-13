// Identity-scoped fixture factory for auth registration/login payloads.
// Tenant context is bootstrapped separately as workspace + membership.

export interface CreateUserFixture {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

export function createUserFixture(overrides: CreateUserFixture = {}) {
  return {
    email: overrides.email ?? `test-${Date.now()}@example.com`,
    password: overrides.password ?? 'SecureP@ss123',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
  };
}

// User fixture factory
// Will be implemented when User model is created

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

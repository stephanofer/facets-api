// User fixture factory
// Will be implemented when User model is created

export interface CreateUserFixture {
  email?: string;
  password?: string;
  name?: string;
}

export function createUserFixture(overrides: CreateUserFixture = {}) {
  return {
    email: overrides.email ?? `test-${Date.now()}@example.com`,
    password: overrides.password ?? 'SecureP@ss123',
    name: overrides.name ?? 'Test User',
  };
}

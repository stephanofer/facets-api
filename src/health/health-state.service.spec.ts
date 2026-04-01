import { HealthStateService } from '@health/health-state.service';

describe('HealthStateService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-31T22:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports app state before bootstrap completes', () => {
    const service = new HealthStateService();

    expect(service.getAppState()).toEqual({
      bootstrapCompleted: false,
      shuttingDown: false,
      startedAt: '2026-03-31T22:00:00.000Z',
      uptimeMs: 0,
    });
  });

  it('reports bootstrapped state and uptime after startup completes', () => {
    const service = new HealthStateService();

    jest.setSystemTime(new Date('2026-03-31T22:00:01.250Z'));
    service.onApplicationBootstrap();
    jest.setSystemTime(new Date('2026-03-31T22:00:05.000Z'));

    expect(service.getAppState()).toEqual({
      bootstrapCompleted: true,
      shuttingDown: false,
      startedAt: '2026-03-31T22:00:00.000Z',
      bootstrappedAt: '2026-03-31T22:00:01.250Z',
      uptimeMs: 5000,
    });
  });

  it('prioritizes shutdown status once termination starts', () => {
    const service = new HealthStateService();

    service.onApplicationBootstrap();
    service.beforeApplicationShutdown();

    expect(service.getAppState()).toMatchObject({
      bootstrapCompleted: true,
      shuttingDown: true,
    });
  });
});

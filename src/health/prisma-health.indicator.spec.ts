import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from '@health/prisma-health.indicator';
import { PrismaService } from '@database/prisma.service';

describe('PrismaHealthIndicator', () => {
  let prisma: { $queryRawUnsafe: jest.Mock };
  let healthIndicatorService: { check: jest.Mock };
  let up: jest.Mock;
  let down: jest.Mock;
  let indicator: PrismaHealthIndicator;

  beforeEach(() => {
    up = jest.fn((details) => ({ database: { status: 'up', ...details } }));
    down = jest.fn((details) => ({ database: { status: 'down', ...details } }));

    prisma = {
      $queryRawUnsafe: jest.fn(),
    };

    healthIndicatorService = {
      check: jest.fn(() => ({ up, down })),
    };

    indicator = new PrismaHealthIndicator(
      prisma as unknown as PrismaService,
      healthIndicatorService as unknown as HealthIndicatorService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports database as up when the ping query succeeds', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(118);

    const result = await indicator.pingCheck('database', { timeoutMs: 500 });

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    expect(healthIndicatorService.check).toHaveBeenCalledWith('database');
    expect(up).toHaveBeenCalledWith({ timeoutMs: 500, latencyMs: 18 });
    expect(result).toEqual({
      database: {
        status: 'up',
        timeoutMs: 500,
        latencyMs: 18,
      },
    });

    dateNowSpy.mockRestore();
  });

  it('reports database as down when the ping times out', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-31T22:00:00.000Z'));
    prisma.$queryRawUnsafe.mockImplementation(
      () =>
        new Promise(() => undefined) as ReturnType<
          PrismaService['$queryRawUnsafe']
        >,
    );

    const pingPromise = indicator.pingCheck('database', { timeoutMs: 250 });

    await jest.advanceTimersByTimeAsync(250);

    await expect(pingPromise).resolves.toEqual({
      database: {
        status: 'down',
        timeoutMs: 250,
        latencyMs: 250,
        message: 'timeout of 250ms exceeded',
      },
    });

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    expect(down).toHaveBeenCalledWith({
      timeoutMs: 250,
      latencyMs: 250,
      message: 'timeout of 250ms exceeded',
    });
  });
});

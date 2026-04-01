import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HealthController } from '@health/health.controller';
import { PrismaHealthIndicator } from '@health/prisma-health.indicator';
import { HealthStateService } from '@health/health-state.service';

describe('HealthController', () => {
  let prismaHealth: { pingCheck: jest.Mock };
  let healthState: { getAppState: jest.Mock };
  let controller: HealthController;

  const createResponse = () => {
    const response = {
      status: jest.fn().mockReturnThis(),
    };

    return response as unknown as Response;
  };

  beforeEach(() => {
    prismaHealth = {
      pingCheck: jest.fn(),
    };

    healthState = {
      getAppState: jest.fn(),
    };

    controller = new HealthController(
      prismaHealth as unknown as PrismaHealthIndicator,
      healthState as unknown as HealthStateService,
    );
  });

  it('returns minimal ok payload when app is bootstrapped and database is up', async () => {
    const response = createResponse();

    healthState.getAppState.mockReturnValue({
      bootstrapCompleted: true,
      shuttingDown: false,
      startedAt: '2026-03-31T22:00:00.000Z',
      uptimeMs: 100,
    });
    prismaHealth.pingCheck.mockResolvedValue({
      database: { status: 'up', timeoutMs: 1000, latencyMs: 12 },
    });

    await expect(controller.status(response)).resolves.toEqual({
      status: 'ok',
    });

    expect(prismaHealth.pingCheck).toHaveBeenCalledWith('database', {
      timeoutMs: 1000,
    });
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('returns minimal error payload when app is not ready for traffic', async () => {
    const response = createResponse();

    healthState.getAppState.mockReturnValue({
      bootstrapCompleted: false,
      shuttingDown: false,
      startedAt: '2026-03-31T22:00:00.000Z',
      uptimeMs: 100,
    });
    prismaHealth.pingCheck.mockResolvedValue({
      database: { status: 'up', timeoutMs: 1000, latencyMs: 12 },
    });

    await expect(controller.status(response)).resolves.toEqual({
      status: 'error',
    });
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  });

  it('returns minimal error payload when database is down', async () => {
    const response = createResponse();

    healthState.getAppState.mockReturnValue({
      bootstrapCompleted: true,
      shuttingDown: false,
      startedAt: '2026-03-31T22:00:00.000Z',
      uptimeMs: 100,
    });
    prismaHealth.pingCheck.mockResolvedValue({
      database: {
        status: 'down',
        timeoutMs: 1000,
        latencyMs: 1000,
        message: 'timeout of 1000ms exceeded',
      },
    });

    await expect(controller.status(response)).resolves.toEqual({
      status: 'error',
    });
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  });
});

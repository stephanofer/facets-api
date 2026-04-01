import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { PrismaService } from '@database/prisma.service';

const DEFAULT_TIMEOUT_MS = 1000;

export interface PrismaHealthCheckOptions {
  timeoutMs?: number;
}

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck<Key extends string>(
    key: Key,
    options: PrismaHealthCheckOptions = {},
  ): Promise<HealthIndicatorResult<Key>> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const check = this.healthIndicatorService.check(key);
    const startedAt = Date.now();

    try {
      await this.runQueryWithTimeout(timeoutMs);

      return check.up({
        timeoutMs,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      return check.down({
        timeoutMs,
        latencyMs: Date.now() - startedAt,
        message:
          error instanceof Error
            ? error.message
            : 'Database health check failed',
      });
    }
  }

  private async runQueryWithTimeout(timeoutMs: number): Promise<void> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.prisma.$queryRawUnsafe('SELECT 1'),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`timeout of ${timeoutMs}ms exceeded`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

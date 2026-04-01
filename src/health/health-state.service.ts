import {
  BeforeApplicationShutdown,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';

@Injectable()
export class HealthStateService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly processStartedAt = new Date();
  private bootstrapCompleted = false;
  private shuttingDown = false;
  private bootstrappedAt?: Date;

  onApplicationBootstrap(): void {
    this.bootstrapCompleted = true;
    this.bootstrappedAt = new Date();
  }

  beforeApplicationShutdown(): void {
    this.shuttingDown = true;
  }

  getAppState() {
    return {
      bootstrapCompleted: this.bootstrapCompleted,
      shuttingDown: this.shuttingDown,
      startedAt: this.processStartedAt.toISOString(),
      ...(this.bootstrappedAt && {
        bootstrappedAt: this.bootstrappedAt.toISOString(),
      }),
      uptimeMs: Date.now() - this.processStartedAt.getTime(),
    };
  }
}

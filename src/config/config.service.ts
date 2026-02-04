import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Configuration } from './configuration';

@Injectable()
export class ConfigService {
  constructor(
    private readonly configService: NestConfigService<Configuration, true>,
  ) {}

  get nodeEnv(): string {
    return this.configService.get('nodeEnv', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get port(): number {
    return this.configService.get('port', { infer: true });
  }

  get api(): Configuration['api'] {
    return this.configService.get('api', { infer: true });
  }

  get database(): Configuration['database'] {
    return this.configService.get('database', { infer: true });
  }

  get jwt(): Configuration['jwt'] {
    return this.configService.get('jwt', { infer: true });
  }

  get sentry(): Configuration['sentry'] {
    return this.configService.get('sentry', { infer: true });
  }

  get cors(): Configuration['cors'] {
    return this.configService.get('cors', { infer: true });
  }

  get rateLimit(): Configuration['rateLimit'] {
    return this.configService.get('rateLimit', { infer: true });
  }
}

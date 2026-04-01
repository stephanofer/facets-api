import { ApiProperty } from '@nestjs/swagger';

class HealthAppStateDto {
  @ApiProperty({ example: true })
  bootstrapCompleted!: boolean;

  @ApiProperty({ example: false })
  shuttingDown!: boolean;

  @ApiProperty({ example: '2026-03-31T22:00:00.000Z' })
  startedAt!: string;

  @ApiProperty({ example: '2026-03-31T22:00:01.250Z', required: false })
  bootstrappedAt?: string;

  @ApiProperty({ example: 10234 })
  uptimeMs!: number;
}

class HealthDependencyDto {
  @ApiProperty({ enum: ['up', 'down', 'not_configured'], example: 'up' })
  status!: 'up' | 'down' | 'not_configured';

  @ApiProperty({ example: true })
  critical!: boolean;

  @ApiProperty({ example: 1000, required: false })
  timeoutMs?: number;

  @ApiProperty({ example: 14, required: false })
  latencyMs?: number;

  @ApiProperty({ example: 'timeout of 1000ms exceeded', required: false })
  message?: string;
}

class HealthDependenciesDto {
  @ApiProperty({ type: HealthDependencyDto })
  database!: HealthDependencyDto;

  @ApiProperty({ type: HealthDependencyDto })
  redis!: HealthDependencyDto;
}

export class HealthDetailsResponseDto {
  @ApiProperty({ enum: ['ok', 'error', 'shutting_down'], example: 'ok' })
  status!: 'ok' | 'error' | 'shutting_down';

  @ApiProperty({ example: '2026-03-31T22:00:05.000Z' })
  timestamp!: string;

  @ApiProperty({ type: HealthAppStateDto })
  app!: HealthAppStateDto;

  @ApiProperty({ type: HealthDependenciesDto })
  dependencies!: HealthDependenciesDto;
}

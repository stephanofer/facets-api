import {
  Controller,
  Get,
  Header,
  HttpStatus,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaHealthIndicator } from '@health/prisma-health.indicator';
import { Public } from '@common/decorators/public.decorator';
import {
  RawResponse,
  SkipResponseEnvelope,
} from '@common/decorators/raw-response.decorator';
import { SuperAdminOnly } from '@common/decorators/platform-role.decorator';
import { HealthStateService } from '@health/health-state.service';
import { HealthDetailsResponseDto } from '@health/dtos/health-details-response.dto';
import { HealthStatusResponseDto } from '@health/dtos/health-probe-response.dto';

const HEALTH_CHECK_TIMEOUT_MS = 1000;

@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly healthState: HealthStateService,
  ) {}

  @Public()
  @RawResponse()
  @ApiTags('Health')
  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiOperation({
    summary: 'Public health probe',
    description:
      'Minimal public health probe. It verifies bootstrap completion, shutdown state, and PostgreSQL availability via Prisma without exposing dependency details.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application is healthy',
    type: HealthStatusResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Application is not healthy',
    type: HealthStatusResponseDto,
  })
  async status(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthStatusResponseDto> {
    const appState = this.healthState.getAppState();
    const result = await this.prismaHealth.pingCheck('database', {
      timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
    });
    const databaseStatus = result.database.status;
    const isHealthy =
      appState.bootstrapCompleted &&
      !appState.shuttingDown &&
      databaseStatus === 'up';

    response.status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: isHealthy ? 'ok' : 'error',
    };
  }

  @ApiTags('Health')
  @ApiBearerAuth()
  @SuperAdminOnly()
  @SkipResponseEnvelope()
  @Get('details')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiOperation({
    summary: 'Get detailed operator health report',
    description:
      'Return a detailed health view for operators, including critical database status and placeholders for optional future dependencies such as Redis.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detailed health report',
    type: HealthDetailsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'One or more critical dependencies are unavailable',
    type: HealthDetailsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Super admin role required',
  })
  async details(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthDetailsResponseDto> {
    const appState = this.healthState.getAppState();
    const databaseResult = await this.prismaHealth.pingCheck('database', {
      timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
    });
    const database = databaseResult.database;
    const redis = {
      status: 'not_configured' as const,
      critical: false,
      message: 'Redis health check not configured yet',
    };

    const overallStatus = appState.shuttingDown
      ? 'shutting_down'
      : database.status === 'up' && appState.bootstrapCompleted
        ? 'ok'
        : 'error';

    response.status(
      overallStatus === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      app: appState,
      dependencies: {
        database: {
          status: database.status,
          critical: true,
          timeoutMs:
            typeof database.timeoutMs === 'number'
              ? database.timeoutMs
              : undefined,
          latencyMs:
            typeof database.latencyMs === 'number'
              ? database.latencyMs
              : undefined,
          message:
            typeof database.message === 'string' ? database.message : undefined,
        },
        redis,
      },
    };
  }
}

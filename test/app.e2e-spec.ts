import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  PlatformRole,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
} from '@/generated/prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { PrismaService } from '@database/prisma.service';
import { PrismaHealthIndicator } from '@health/prisma-health.indicator';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { createTestApp } from './helpers/test-app.helper';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  const prismaServiceMock = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $on: jest.fn(),
  };

  const superAdminPrincipal: AuthenticatedPrincipal = {
    sub: 'user_health_super_admin',
    email: 'health-super-admin@test.com',
    workspaceId: 'workspace_health',
    actorUserId: 'user_health_super_admin',
    membershipId: 'membership_health',
    workspaceRole: WorkspaceRole.ADMIN,
    platformRole: PlatformRole.SUPER_ADMIN,
    user: {
      id: 'user_health_super_admin',
      email: 'health-super-admin@test.com',
      firstName: 'Health',
      lastName: 'Admin',
      password: 'hashed',
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date('2026-03-31T22:00:00.000Z'),
      platformRole: PlatformRole.SUPER_ADMIN,
      createdAt: new Date('2026-03-31T22:00:00.000Z'),
      updatedAt: new Date('2026-03-31T22:00:00.000Z'),
      deletedAt: null,
    },
    workspace: {
      id: 'workspace_health',
      name: 'Health Workspace',
      type: 'PERSONAL',
      status: WorkspaceStatus.ACTIVE,
      financialDataUpdatedAt: new Date('2026-03-31T22:00:00.000Z'),
      createdAt: new Date('2026-03-31T22:00:00.000Z'),
      updatedAt: new Date('2026-03-31T22:00:00.000Z'),
    },
    membership: {
      id: 'membership_health',
      workspaceId: 'workspace_health',
      userId: 'user_health_super_admin',
      role: WorkspaceRole.ADMIN,
      status: WorkspaceMembershipStatus.ACTIVE,
      invitedAt: null,
      joinedAt: new Date('2026-03-31T22:00:00.000Z'),
      invitedByUserId: null,
      createdAt: new Date('2026-03-31T22:00:00.000Z'),
      updatedAt: new Date('2026-03-31T22:00:00.000Z'),
    },
  };

  beforeAll(async () => {
    app = await createTestApp({
      skipReferenceSeedData: true,
      overrideProviders: [
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: PrismaHealthIndicator,
          useValue: {
            pingCheck: jest.fn().mockResolvedValue({
              database: {
                status: 'up',
                timeoutMs: 1000,
                latencyMs: 14,
              },
            }),
          },
        },
      ],
    });
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /health', () => {
    it('should return raw ok status outside API prefix', async () => {
      await request(app.getHttpServer()).get('/api/health').expect(404);

      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect('Cache-Control', 'no-cache, no-store, must-revalidate')
        .expect((res) => {
          expect(res.body).toEqual({ status: 'ok' });
        });
    });

    it('should not expose removed legacy probe endpoints', async () => {
      await request(app.getHttpServer()).get('/health/live').expect(404);
      await request(app.getHttpServer()).get('/health/ready').expect(404);
      await request(app.getHttpServer()).get('/health/startup').expect(404);
    });

    it('should return minimal error payload when database is unavailable', () => {
      return (async () => {
        const degradedApp = await createTestApp({
          skipReferenceSeedData: true,
          overrideProviders: [
            {
              provide: PrismaService,
              useValue: prismaServiceMock,
            },
            {
              provide: PrismaHealthIndicator,
              useValue: {
                pingCheck: jest.fn().mockResolvedValue({
                  database: {
                    status: 'down',
                    timeoutMs: 1000,
                    latencyMs: 1000,
                    message: 'timeout of 1000ms exceeded',
                  },
                }),
              },
            },
          ],
        });

        try {
          await request(degradedApp.getHttpServer())
            .get('/health')
            .expect(503)
            .expect((res) => {
              expect(res.body).toEqual({ status: 'error' });
            });
        } finally {
          await degradedApp.close();
        }
      })();
    });
  });

  describe('GET /health/details', () => {
    it('should remain protected', () => {
      return request(app.getHttpServer())
        .get('/health/details')
        .expect(401)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBeDefined();
        });
    });

    it('should return a detailed report for super admins', () => {
      return (async () => {
        const operatorApp = await createTestApp({
          skipReferenceSeedData: true,
          overrideProviders: [
            {
              provide: PrismaService,
              useValue: prismaServiceMock,
            },
            {
              provide: PrismaHealthIndicator,
              useValue: {
                pingCheck: jest.fn().mockResolvedValue({
                  database: {
                    status: 'up',
                    timeoutMs: 1000,
                    latencyMs: 14,
                  },
                }),
              },
            },
            {
              provide: JwtAuthGuard,
              useValue: {
                canActivate: (context: {
                  switchToHttp: () => {
                    getRequest: () => Record<string, unknown>;
                  };
                }) => {
                  context.switchToHttp().getRequest().user =
                    superAdminPrincipal;
                  return true;
                },
              },
            },
          ],
        });

        try {
          await request(operatorApp.getHttpServer())
            .get('/health/details')
            .set('Authorization', 'Bearer test-super-admin-token')
            .expect(200)
            .expect('Cache-Control', 'no-cache, no-store, must-revalidate')
            .expect((res) => {
              expect(res.body.status).toBe('ok');
              expect(res.body.timestamp).toEqual(expect.any(String));
              expect(res.body.app).toMatchObject({
                bootstrapCompleted: true,
                shuttingDown: false,
                startedAt: expect.any(String),
                uptimeMs: expect.any(Number),
              });
              expect(res.body.dependencies.database).toMatchObject({
                status: 'up',
                critical: true,
                timeoutMs: 1000,
              });
              expect(res.body.dependencies.redis).toEqual({
                status: 'not_configured',
                critical: false,
                message: 'Redis health check not configured yet',
              });
            });
        } finally {
          await operatorApp.close();
        }
      })();
    });
  });

  describe('Removed billing routes', () => {
    it('should not expose legacy billing endpoints', async () => {
      await request(app.getHttpServer()).get('/api/plans').expect(404);
      await request(app.getHttpServer())
        .get('/api/subscriptions/current')
        .expect(404);
    });
  });
});

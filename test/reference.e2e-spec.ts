import { INestApplication } from '@nestjs/common';
import { ApiResponse } from '@common/interfaces/api-response.interface';
import { PrismaService } from '@database/prisma.service';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  cleanupTestUser,
  createTestApp,
  createTestUser,
} from './helpers/test-app.helper';
import { ReferenceCountryResponseDto } from '@/modules/reference/dtos/reference-country-response.dto';
import { ReferenceCurrencyResponseDto } from '@/modules/reference/dtos/reference-currency-response.dto';

function getSuccessBody<T>(response: request.Response): ApiResponse<T> {
  return response.body as ApiResponse<T>;
}

describe('Reference (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const user = await createTestUser(app);
    userId = user.userId;
    accessToken = user.accessToken;

    await prisma.currency.upsert({
      where: { code: 'ZZZ' },
      update: {
        name: 'Inactive Currency',
        symbol: '¤',
        decimalScale: 2,
        isActive: false,
      },
      create: {
        code: 'ZZZ',
        name: 'Inactive Currency',
        symbol: '¤',
        decimalScale: 2,
        isActive: false,
      },
    });

    await prisma.country.upsert({
      where: { code: 'ZZ' },
      update: {
        name: 'Inactive Country',
        defaultCurrencyCode: 'USD',
        callingCode: '+999',
        defaultLocale: 'en-ZZ',
        isActive: false,
      },
      create: {
        code: 'ZZ',
        name: 'Inactive Country',
        defaultCurrencyCode: 'USD',
        callingCode: '+999',
        defaultLocale: 'en-ZZ',
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.country.deleteMany({ where: { code: 'ZZ' } });
    await prisma.currency.deleteMany({ where: { code: 'ZZZ' } });
    await cleanupTestUser(app, userId);
    await app.close();
  });

  it('returns active countries only', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reference/countries')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const responseBody =
      getSuccessBody<ReferenceCountryResponseDto[]>(response);

    expect(responseBody.success).toBe(true);
    expect(responseBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AR',
          name: 'Argentina',
          callingCode: '+54',
          defaultCurrencyCode: 'ARS',
          defaultLocale: 'es-AR',
        }),
      ]),
    );
    expect(responseBody.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ZZ' })]),
    );
  });

  it('returns active currencies only', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reference/currencies')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const responseBody =
      getSuccessBody<ReferenceCurrencyResponseDto[]>(response);

    expect(responseBody.success).toBe(true);
    expect(responseBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'USD',
          name: 'US Dollar',
          symbol: '$',
          decimalScale: 2,
        }),
      ]),
    );
    expect(responseBody.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ZZZ' })]),
    );
  });
});

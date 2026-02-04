import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '@common/interceptors/transform-response.interceptor';
import { PrismaService } from '@database/prisma.service';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  const httpAdapterHost = app.get(HttpAdapterHost);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  await app.init();

  return app;
}

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Add table cleaning logic as models are added
  // Example: await prisma.$executeRaw`TRUNCATE users CASCADE`;
}

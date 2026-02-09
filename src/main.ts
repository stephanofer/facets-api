// IMPORTANT: Sentry must be imported first to ensure proper instrumentation
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ConfigService } from '@config/config.service';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '@common/interceptors/transform-response.interceptor';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from '@common/interceptors/timeout.interceptor';
import { writeFileSync } from 'node:fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const httpAdapterHost = app.get(HttpAdapterHost);

  // Security
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: configService.cors.allowedOrigins,
    credentials: true,
  });

  // Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: configService.api.version,
  });

  // Global prefix
  app.setGlobalPrefix(configService.api.prefix);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  // Global interceptors
  app.useGlobalInterceptors(
    new TransformResponseInterceptor(),
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
  );

  // Swagger documentation (only in development)
  if (configService.isDevelopment) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Facets API')
      .setDescription('Professional Finance Tracker SaaS API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);

    writeFileSync('./openapi.json', JSON.stringify(document, null, 2));
    console.log('📄 OpenAPI exported: ./openapi.json');
  }

  const port = configService.port;
  await app.listen(port);

  console.log(`🚀 Facets API is running on: http://localhost:${port}`);
  console.log(
    `📚 API Prefix: /${configService.api.prefix}/v${configService.api.version}`,
  );

  if (configService.isDevelopment) {
    console.log(`📖 Swagger docs: http://localhost:${port}/docs`);
  }
}

bootstrap();

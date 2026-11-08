import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { correlationMiddleware } from './common/http/correlation.middleware';
import { ProblemFilter } from './common/http/problem.filter';

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
    abortOnError: false,
  });
  app.useLogger(app.get(Logger));
  app.disable('x-powered-by');
  app.use(correlationMiddleware);
  app.use(helmet());
  app.use(json({ limit: '16kb', strict: true }));
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/{*path}', method: RequestMethod.ALL },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(app.get(ProblemFilter));
  app.enableShutdownHooks();
  const swagger = new DocumentBuilder()
    .setTitle('Payments Ledger Service')
    .setVersion('1.0')
    .setDescription(
      'Amounts are integer strings in minor units. Demo service; deploy behind authentication.',
    )
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  return app;
}

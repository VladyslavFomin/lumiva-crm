import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://lumiva.agency',
      'https://crm.lumiva.agency',
      'https://pl1.lumiva.agency',
      'http://localhost:5173',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Api-Token',
      'X-Requested-With',
      'X-WP-Nonce',
    ],
    exposedHeaders: [
      // если когда-нибудь захочешь пагинацию/лимиты через хедеры
      'X-Total-Count',
      'X-Request-Id',
    ],
    credentials: false,
    maxAge: 86400, // 24h кеш preflight
  });

  // Все бэкенд-ручки будут начинаться с /v1
  app.setGlobalPrefix('v1');

  // Валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
      // полезно для class-transformer (если где-то появятся DTO с вложенностями)
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);

  console.log(`✅ Lumiva CRM API is running on port ${port} with /v1 prefix`);
}

bootstrap();
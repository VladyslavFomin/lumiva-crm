// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Явный CORS: разрешаем только наши фронты
  app.enableCors({
    origin: [
      'https://lumiva.agency',
      'https://crm.lumiva.agency',
      'https://pl1.lumiva.agency',
      'http://localhost:5173', // на всякий случай для дев-режима
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: '*',
    credentials: false,
  });

  // Все бэкенд-ручки будут начинаться с /v1
  app.setGlobalPrefix('v1');

  // Валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);

  console.log(`✅ Lumiva CRM API is running on port ${port} with /v1 prefix`);
}

bootstrap();
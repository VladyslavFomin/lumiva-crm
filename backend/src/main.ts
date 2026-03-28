import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { existsSync, mkdirSync, statSync } from 'fs';
import { basename, dirname, join } from 'path';

import { getUploadsRoot } from './common/uploads-root.util';

/**
 * Файлы могли быть записаны до нормализации UPLOADS_ROOT в /app/tenants/...,
 * а не в /app/uploads/tenants/... — отдаём с «родительского» каталога, если основной путь пуст.
 */
function serveLegacyUploadsIfPresent(uploadsRoot: string) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const urlPath = (req.originalUrl || req.url || '').split('?')[0] || '';
    const marker = '/uploads/';
    const i = urlPath.indexOf(marker);
    if (i === -1) return next();
    const rel = urlPath.slice(i + marker.length).replace(/^\/+/, '');
    if (!rel || rel.includes('..')) return next();
    const primary = join(uploadsRoot, rel);
    try {
      if (existsSync(primary) && statSync(primary).isFile()) {
        return next();
      }
    } catch {
      /* static попробует */
    }
    const grNorm = uploadsRoot.replace(/[/\\]+$/, '');
    if (basename(grNorm) !== 'uploads') return next();
    const legacyPath = join(dirname(grNorm), rel);
    try {
      if (existsSync(legacyPath) && statSync(legacyPath).isFile()) {
        return res.sendFile(legacyPath, (err) => (err ? next(err) : undefined));
      }
    } catch {
      /* next */
    }
    next();
  };
}

async function bootstrap() {
  const uploadsRoot = getUploadsRoot();
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }

  /**
   * Статику нужно повесить на Express до NestFactory.create, иначе роутер Nest
   * перехватывает GET /v1/uploads/... и отдаёт JSON 404.
   */
  const expressApp = express();
  expressApp.set('trust proxy', 1);
  expressApp.use('/v1/uploads', serveLegacyUploadsIfPresent(uploadsRoot));
  expressApp.use('/v1/uploads', express.static(uploadsRoot));

  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);

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
      // POST /marketing/integrations/:id/sync — дублирует rowsSaved для клиентов без парсинга JSON
      'X-Marketing-Sync-Rows',
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

  // Увеличиваем таймауты для длительных операций (SMTP тесты, отправка email)
  app.use((req, res, next) => {
    // Увеличиваем таймаут для теста SMTP и отправки email
    if (req.path.includes('/test-smtp') || req.path.includes('/email/send')) {
      req.setTimeout(25000); // 25 секунд
      res.setTimeout(25000);
    }
    next();
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);

  console.log(`✅ Lumiva CRM API is running on port ${port} with /v1 prefix`);
}

bootstrap();
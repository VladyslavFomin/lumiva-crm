import './instrument'; // Sentry — must be first
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { existsSync, mkdirSync, statSync } from 'fs';
import { basename, dirname, join } from 'path';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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

function validateEnv() {
  const required = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  if (process.env.NODE_ENV === 'production' && process.env.EMBED_RELAXED_ORIGIN === '1') {
    throw new Error(
      'EMBED_RELAXED_ORIGIN=1 must NOT be set in production — it bypasses all embed-form origin validation.',
    );
  }
}

async function bootstrap() {
  validateEnv();
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
  /**
   * Embed forms CORS — intentionally reflects any Origin so forms work when embedded
   * on arbitrary third-party domains (that's the product requirement).
   * Security is enforced at the APPLICATION layer via isOriginAllowedForPublicEmbed(),
   * which validates the request origin against the tenant's registered site domain.
   * `credentials: false` (no cookie/auth forwarding) is enforced explicitly below.
   */
  expressApp.use(
    '/v1/public/embed',
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const o = (req.headers.origin as string) || '';
      if (o) {
        res.setHeader('Access-Control-Allow-Origin', o);
        res.setHeader('Vary', 'Origin');
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, X-Embed-Preview-Token, X-Requested-With',
      );
      // Explicitly block cookie/credential forwarding from third-party origins
      res.setHeader('Access-Control-Allow-Credentials', 'false');
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
      next();
    },
  );
  expressApp.use('/v1/uploads', serveLegacyUploadsIfPresent(uploadsRoot));
  expressApp.use('/v1/uploads', express.static(uploadsRoot));

  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [
        'https://lumiva.agency',
        'https://crm.lumiva.agency',
        'https://pl1.lumiva.agency',
        'http://localhost:5173',
      ];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Api-Token',
      'X-Requested-With',
      'X-WP-Nonce',
      'X-Lumiva-Secret',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Request-Id', 'X-Marketing-Sync-Rows'],
    credentials: false,
    maxAge: 86400,
  });

  // Все бэкенд-ручки будут начинаться с /v1
  app.setGlobalPrefix('v1');

  // Валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      forbidUnknownValues: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Увеличиваем таймауты для длительных операций (SMTP тесты, отправка email)
  app.use((req, res, next) => {
    const p = req.path || '';
    // Импорт в таблицу рабочей области: GA4 / Meta / превью — долгие (внешние API + тысячи upsert).
    // Без этого nginx/балансировщик часто отдаёт 504, пока Node ещё обрабатывает запрос.
    if (
      p.includes('/integrations/marketing/') &&
      (p.includes('workspace-sync') || p.includes('workspace-preview'))
    ) {
      const ms = 900000; // 15 мин — согласуйте proxy_read_timeout на nginx с этим значением
      req.setTimeout(ms);
      res.setTimeout(ms);
    } else if (
      p.includes('/integrations/') &&
      (p.includes('/sync') || p.includes('woo-workspace-preview') || p.includes('meta-ads-workspace-preview'))
    ) {
      const ms = 900000;
      req.setTimeout(ms);
      res.setTimeout(ms);
    } else if (
      p.includes('/test-smtp') ||
      p.includes('/email/send') ||
      p.includes('/ai/')
    ) {
      req.setTimeout(p.includes('/ai/') ? 180000 : 25000);
      res.setTimeout(p.includes('/ai/') ? 180000 : 25000);
    }
    next();
  });

  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Lumiva CRM API')
      .setDescription('REST API документация Lumiva CRM')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
      .addApiKey({ type: 'apiKey', name: 'X-Api-Token', in: 'header' }, 'api-token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('v1/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    console.log(`📚 Swagger docs: http://localhost:${process.env.PORT || 3000}/v1/docs`);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);

  console.log(`✅ Lumiva CRM API is running on port ${port} with /v1 prefix`);
}

bootstrap();
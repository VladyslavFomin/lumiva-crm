import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    ignoreErrors: [
      'UnauthorizedException',
      'ForbiddenException',
      'NotFoundException',
      'BadRequestException',
    ],
  });
}

import type { Request } from 'express';

/** Учитывает X-Forwarded-For за reverse-proxy. */
export function getClientIp(req: Request): string | null {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') {
    const first = xf.split(',')[0]?.trim();
    return first || null;
  }
  if (Array.isArray(xf) && xf[0]) return xf[0];
  const raw = req.socket?.remoteAddress;
  return raw || null;
}

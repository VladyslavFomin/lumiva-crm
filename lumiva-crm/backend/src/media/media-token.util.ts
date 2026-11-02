// src/media/media-token.util.ts
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Подписанные URL для файлов медиатеки. Файлы лежат вне express.static, поэтому <img>/<video>
 * (без заголовка Authorization) получают короткоживущую подпись, а скачивание — тикет.
 */
function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return `media:${s}`;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url').slice(0, 32);
}

function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function signPayload(payload: Record<string, unknown>): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyPayload<T extends { e?: number }>(token: string): T | null {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !safeEq(sign(body), sig)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
    if (typeof p.e === 'number' && p.e < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}

/** Превью/просмотр одного файла: `thumb` — миниатюра, иначе оригинал inline. */
export function previewSig(fileId: string, variant: 'thumb' | 'view', exp: number): string {
  return sign(`${variant}:${fileId}:${exp}`);
}

export function verifyPreviewSig(fileId: string, variant: 'thumb' | 'view', exp: number, sig: string): boolean {
  if (!exp || exp < Date.now() / 1000) return false;
  return safeEq(previewSig(fileId, variant, exp), String(sig || ''));
}

export interface DownloadTicket {
  t: string; // tenantId
  l: string | null; // linkId (null — скачивание из CRM, без аналитики)
  v: string | null; // visitorId
  f: string[]; // fileIds
  d: string[]; // folderIds (целиком, с подпапками)
  n: string; // имя архива/файла
  e: number;
}

export interface AccessToken {
  l: string;
  h: string; // хвост хеша пароля — смена пароля отзывает выданные токены
  e: number;
}

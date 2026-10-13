import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Шифрование ключей площадок (Apify, HolidayCheck, refresh-токен Google) в БД: AES-256-GCM.
 * Ключ — SECRETS_ENCRYPTION_KEY, иначе производный от JWT_SECRET (смена JWT_SECRET потребует
 * заново ввести ключи — это осознанно, ключи в коде/открытом виде не храним).
 */
function key(): Buffer {
  const base = process.env.SECRETS_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  if (!base) throw new Error('No encryption key configured (SECRETS_ENCRYPTION_KEY / JWT_SECRET)');
  return createHash('sha256').update(`hotel-reputation:${base}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(blob: string | null | undefined): string | null {
  if (!blob) return null;
  const [v, iv, tag, data] = blob.split(':');
  if (v !== 'v1' || !iv || !tag || !data) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Для UI: «ключ задан, оканчивается на …a1b2», сам ключ наружу не отдаём. */
export function maskSecret(blob: string | null | undefined): string | null {
  const p = decryptSecret(blob);
  if (!p) return null;
  return p.length <= 4 ? '••••' : `••••${p.slice(-4)}`;
}

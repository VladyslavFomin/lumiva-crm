import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';

/** Pure helpers for TOTP-based 2FA — no DI, importable from both AuthService (login-time verify)
 * and AccountService (setup/verify/disable) without coupling those modules together. */

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(secret: string, accountLabel: string): string {
  return authenticator.keyuri(accountLabel, 'Lumiva CRM', secret);
}

export async function buildOtpAuthQrDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl, { margin: 1, width: 240 });
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const clean = String(code || '').trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  try {
    return authenticator.check(clean, secret);
  } catch {
    return false;
  }
}

/** 10 backup codes, human-typeable (uppercase alphanumeric, grouped as XXXX-XXXX). */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}${raw.slice(8, 10)}`);
  }
  return codes;
}

export function normalizeBackupCode(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

import * as crypto from 'crypto';

export type EmailOAuthStatePayload = {
  tenantId: string;
  userId: string;
  redirect: string;
  provider: 'gmail' | 'outlook';
};

function oauthSecret(): string {
  return process.env.JWT_SECRET!;
}

export function encodeEmailOAuthState(payload: EmailOAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', oauthSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function decodeEmailOAuthState(
  state: string,
): EmailOAuthStatePayload | null {
  try {
    const dot = state.indexOf('.');
    if (dot <= 0) return null;
    const body = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const expected = crypto
      .createHmac('sha256', oauthSecret())
      .update(body)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data?.tenantId || !data?.userId) return null;
    if (data.provider !== 'gmail' && data.provider !== 'outlook') return null;
    if (typeof data.redirect !== 'string') return null;
    return {
      tenantId: String(data.tenantId),
      userId: String(data.userId),
      redirect: String(data.redirect),
      provider: data.provider,
    };
  } catch {
    return null;
  }
}

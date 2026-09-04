import * as crypto from 'crypto';

const TTL_SEC = 900;

export type ThirdPartyOAuthState = {
  typ: string;
  exp: number;
  tenantId: string;
  userId: string;
  redirect: string;
};

function secret(): string {
  return process.env.JWT_SECRET!;
}

/** Подписанный (HMAC-SHA256) state для OAuth-старта стороннего каталога (Slack/HubSpot/Mailchimp/Jira/…). */
export function encodeThirdPartyOAuthState(
  typ: string,
  inner: Omit<ThirdPartyOAuthState, 'typ' | 'exp'>,
): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const body: ThirdPartyOAuthState = { typ, exp, ...inner };
  const payload = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function decodeThirdPartyOAuthState(
  expectedTyp: string,
  state: string,
): ThirdPartyOAuthState | null {
  try {
    const dot = state.indexOf('.');
    if (dot <= 0) return null;
    const payloadB64 = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const expected = crypto.createHmac('sha256', secret()).update(payloadB64).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as ThirdPartyOAuthState;
    if (data?.typ !== expectedTyp) return null;
    if (!data?.tenantId || typeof data.redirect !== 'string') return null;
    if (typeof data.exp !== 'number' || !Number.isFinite(data.exp)) return null;
    if (data.exp < Math.floor(Date.now() / 1000) - 60) return null;
    return data;
  } catch {
    return null;
  }
}

export function sanitizeThirdPartyRedirectPath(raw: string | undefined): string {
  const fallback = '/integrations-hub?tab=connections';
  const s = (raw ?? '').trim();
  if (!s) return fallback;
  if (!s.startsWith('/') || s.startsWith('//') || s.includes('://')) return fallback;
  if (s.length > 400) return fallback;
  return s;
}

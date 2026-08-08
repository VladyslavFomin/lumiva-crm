// src/portal/portal-token.util.ts
import * as jwt from 'jsonwebtoken';

const MAGIC_LINK_TYP = 'portal-magic-link';
const SESSION_TYP = 'portal-session';

export function signPortalMagicLinkToken(
  contactId: string,
  tenantId: string,
  secret: string,
  expiresInSec = 900,
): string {
  return jwt.sign({ typ: MAGIC_LINK_TYP, sub: contactId, tenantId }, secret, { expiresIn: expiresInSec });
}

export function verifyPortalMagicLinkToken(
  token: string,
  secret: string,
): { valid: true; contactId: string; tenantId: string } | { valid: false; reason: string } {
  try {
    const p = jwt.verify(token, secret) as jwt.JwtPayload;
    if (p.typ !== MAGIC_LINK_TYP || !p.sub || !p.tenantId) {
      return { valid: false, reason: 'Invalid payload' };
    }
    return { valid: true, contactId: String(p.sub), tenantId: String(p.tenantId) };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : 'invalid' };
  }
}

export function signPortalSessionToken(
  contactId: string,
  tenantId: string,
  secret: string,
  expiresInSec = 7 * 24 * 60 * 60,
): string {
  return jwt.sign({ typ: SESSION_TYP, sub: contactId, tenantId }, secret, { expiresIn: expiresInSec });
}

export function verifyPortalSessionToken(
  token: string,
  secret: string,
): { valid: true; contactId: string; tenantId: string } | { valid: false; reason: string } {
  try {
    const p = jwt.verify(token, secret) as jwt.JwtPayload;
    if (p.typ !== SESSION_TYP || !p.sub || !p.tenantId) {
      return { valid: false, reason: 'Invalid payload' };
    }
    return { valid: true, contactId: String(p.sub), tenantId: String(p.tenantId) };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : 'invalid' };
  }
}

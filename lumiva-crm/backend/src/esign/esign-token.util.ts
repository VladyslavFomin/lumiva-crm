// src/esign/esign-token.util.ts
import * as jwt from 'jsonwebtoken';

const TYP = 'esign-request';

export function signEsignToken(documentId: string, secret: string, expiresInSec = 30 * 24 * 60 * 60): string {
  return jwt.sign({ typ: TYP, sub: documentId }, secret, { expiresIn: expiresInSec });
}

export function verifyEsignToken(
  token: string,
  secret: string,
): { valid: true; documentId: string } | { valid: false; reason: string } {
  try {
    const p = jwt.verify(token, secret) as jwt.JwtPayload;
    if (p.typ !== TYP || !p.sub) return { valid: false, reason: 'Invalid payload' };
    return { valid: true, documentId: String(p.sub) };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : 'invalid' };
  }
}

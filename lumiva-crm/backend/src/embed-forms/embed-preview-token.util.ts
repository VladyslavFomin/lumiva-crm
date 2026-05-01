import * as jwt from 'jsonwebtoken';

const PREVIEW_TYP = 'embed-form-preview';

export function signEmbedPreviewToken(
  publicId: string,
  userId: string,
  secret: string,
  expiresInSec = 900,
): string {
  return jwt.sign(
    {
      typ: PREVIEW_TYP,
      publicId,
      sub: userId,
    },
    secret,
    { expiresIn: expiresInSec },
  );
}

export function verifyEmbedPreviewToken(
  token: string,
  secret: string,
):
  | { valid: true; publicId: string; userId: string }
  | { valid: false; reason: string } {
  try {
    const p = jwt.verify(token, secret) as jwt.JwtPayload;
    if (p.typ !== PREVIEW_TYP || !p.publicId || !p.sub) {
      return { valid: false, reason: 'Invalid payload' };
    }
    return {
      valid: true,
      publicId: String(p.publicId),
      userId: String(p.sub),
    };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : 'invalid' };
  }
}

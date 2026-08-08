// src/common/twilio-signature.util.ts
import { createHmac, timingSafeEqual } from 'crypto';

/** Twilio's request-validation algorithm (https://www.twilio.com/docs/usage/security#validating-requests):
 * HMAC-SHA1 of `url + sorted "key"+"value" pairs`, keyed by the account's Auth Token, base64-encoded.
 * Shared by every Twilio webhook in this codebase (SMS, telephony) instead of each reimplementing it. */
export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  if (!authToken || !signature) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];
  const expected = createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

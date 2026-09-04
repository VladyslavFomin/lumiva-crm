// src/common/cidr.util.ts

/** Parses 'a.b.c.d' into a 32-bit unsigned integer. Returns null for anything else (incl. IPv6). */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    n = (n << 8) | octet;
  }
  return n >>> 0;
}

/**
 * Matches an IPv4 address against a single entry that is either a bare IP ('203.0.113.4') or a
 * CIDR range ('203.0.113.0/24'). No IPv6 support — office-IP allowlisting is IPv4-only for now.
 */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return false;

  const [network, prefixRaw] = cidr.trim().split('/');
  const networkInt = ipv4ToInt(network);
  if (networkInt === null) return false;

  if (prefixRaw === undefined) return ipInt === networkInt;

  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  if (prefix === 0) return true;

  const mask = prefix === 32 ? 0xffffffff : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

export function ipMatchesAnyCidr(ip: string, cidrs: string[]): boolean {
  return cidrs.some((c) => ipMatchesCidr(ip, c));
}

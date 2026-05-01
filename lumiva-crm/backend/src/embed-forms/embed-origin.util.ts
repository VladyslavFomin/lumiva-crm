function tryParseUrl(raw: string | undefined): URL | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  try {
    if (!s.includes('://')) return new URL(`https://${s}`);
    return new URL(s);
  } catch {
    return null;
  }
}

const normHost = (h: string) => h.toLowerCase().replace(/^www\./, '');

function requestHostname(
  origin: string | undefined,
  referer: string | undefined,
): string | null {
  const o = tryParseUrl(origin) || tryParseUrl(referer);
  if (!o) return null;
  return o.hostname;
}

/**
 * Собранные из env хосты веб-CRM, с которых отдаётся публичная страница /embed/:publicId.
 * POST /public/embed/.../submit идёт с header Origin = этот хост (сам iframe/страница на CRM),
 * а site.domain в БД — маркетинговый домен клиента; прямое сравнение с Origin часто неверно.
 */
function collectCrmWebHostsForPublicEmbed(): string[] {
  const out = new Set<string>();
  const add = (raw: string | undefined) => {
    if (!raw?.trim()) return;
    const u = tryParseUrl(raw.trim().includes('://') ? raw.trim() : `https://${raw.trim()}`);
    if (u) out.add(normHost(u.hostname));
  };
  add(process.env.FRONTEND_URL);
  const extra = process.env.EMBED_PUBLIC_HOSTS;
  if (extra) {
    for (const p of extra.split(/[,;]/)) {
      const t = p.trim();
      if (t) add(t);
    }
  }
  return [...out].filter(Boolean);
}

function isCrmWebAppHostForEmbed(
  origin: string | undefined,
  referer: string | undefined,
): boolean {
  const h = requestHostname(origin, referer);
  if (!h) return false;
  const allowed = collectCrmWebHostsForPublicEmbed();
  if (!allowed.length) return false;
  return allowed.includes(normHost(h));
}

/**
 * Проверяет, что origin/referer соответствует зарегистрированному домену сайта.
 * Домен в sites.domain может быть с протоколом или без, с www или без.
 */
export function isOriginAllowedForSite(
  siteDomainRaw: string,
  origin: string | undefined,
  referer: string | undefined,
): boolean {
  const o = tryParseUrl(origin) || tryParseUrl(referer);
  if (!o) return false;

  const siteHost = String(siteDomainRaw || '')
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split('?')[0]
    .split(':')[0]
    .toLowerCase()
    .trim();

  if (!siteHost) return false;

  const host = o.hostname.toLowerCase();
  const norm = (x: string) => x.replace(/^www\./, '');

  if (host === siteHost) return true;
  if (norm(host) === norm(siteHost)) return true;

  return false;
}

/**
 * Публичные submit/upload с /embed/:id: допускаем либо домен сайта (если хост в запросе совпал),
 * либо хост(ы) веб-CRM (страница встраивания).
 */
export function isOriginAllowedForPublicEmbed(
  siteDomainRaw: string,
  origin: string | undefined,
  referer: string | undefined,
): boolean {
  if (isOriginAllowedForSite(siteDomainRaw, origin, referer)) return true;
  if (isCrmWebAppHostForEmbed(origin, referer)) return true;
  return false;
}

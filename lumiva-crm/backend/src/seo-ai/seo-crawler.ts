import axios from 'axios';
import * as cheerio from 'cheerio';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * On-page аудит для ИИ-SEO-ассистента: сервер сам ходит по адресам, которые вводит клиент,
 * поэтому каждый хоп (включая редиректы) проверяется на внутренние/приватные адреса (SSRF).
 */

const USER_AGENT =
  'Mozilla/5.0 (compatible; LumivaSeoBot/1.0; +https://lumiva.agency) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export type SeoIssueSeverity = 'high' | 'medium' | 'low';
export interface SeoIssue {
  code: string;
  severity: SeoIssueSeverity;
}

export interface SeoPageAudit {
  url: string;
  finalUrl: string | null;
  source: 'home' | 'custom' | 'gsc' | 'sitemap';
  status: number | null;
  ms: number | null;
  bytes: number | null;
  error: string | null;
  title: string | null;
  description: string | null;
  h1: string[];
  h2Count: number;
  canonical: string | null;
  robots: string | null;
  lang: string | null;
  viewport: boolean;
  ogTitle: boolean;
  ogImage: boolean;
  jsonLdTypes: string[];
  hreflangCount: number;
  wordCount: number;
  images: number;
  imagesNoAlt: number;
  internalLinks: number;
  externalLinks: number;
  /** Начало видимого текста — ИИ оценивает по нему тематику и качество контента. */
  excerpt: string;
  issues: SeoIssue[];
}

export interface SeoSiteAudit {
  origin: string;
  https: boolean;
  robotsTxt: { found: boolean; disallowAll: boolean; sitemaps: string[] };
  sitemap: { found: boolean; url: string | null; urlCount: number };
  issues: SeoIssue[];
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('unsupported_protocol');
  if (u.username || u.password) throw new Error('credentials_in_url');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('private_host');
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('private_host');
  return u;
}

/** GET с ручными редиректами (каждый хоп проверяется), таймаутом и лимитом размера. */
export async function safeFetch(
  rawUrl: string,
  opts: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<{ status: number; finalUrl: string; body: string; ms: number; bytes: number; contentType: string }> {
  let url = rawUrl;
  const started = Date.now();
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicUrl(url);
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      maxRedirects: 0,
      timeout: opts.timeoutMs ?? 15_000,
      maxContentLength: opts.maxBytes ?? 3_000_000,
      validateStatus: () => true,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    });
    const loc = res.headers?.location;
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(String(loc), url).toString();
      continue;
    }
    const buf = Buffer.from(res.data || []);
    return {
      status: res.status,
      finalUrl: url,
      body: buf.toString('utf8'),
      ms: Date.now() - started,
      bytes: buf.length,
      contentType: String(res.headers?.['content-type'] || ''),
    };
  }
  throw new Error('too_many_redirects');
}

/** «alivip.site» → «https://alivip.site/» */
export function normalizeSiteUrl(value: string | null | undefined): string | null {
  const v = (value || '').trim().replace(/^sc-domain:/, '');
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function auditPage(url: string, source: SeoPageAudit['source']): Promise<SeoPageAudit> {
  const base: SeoPageAudit = {
    url,
    finalUrl: null,
    source,
    status: null,
    ms: null,
    bytes: null,
    error: null,
    title: null,
    description: null,
    h1: [],
    h2Count: 0,
    canonical: null,
    robots: null,
    lang: null,
    viewport: false,
    ogTitle: false,
    ogImage: false,
    jsonLdTypes: [],
    hreflangCount: 0,
    wordCount: 0,
    images: 0,
    imagesNoAlt: 0,
    internalLinks: 0,
    externalLinks: 0,
    excerpt: '',
    issues: [],
  };
  let res: Awaited<ReturnType<typeof safeFetch>>;
  try {
    res = await safeFetch(url);
  } catch (e: any) {
    base.error = String(e?.code || e?.message || e).slice(0, 120);
    base.issues.push({ code: 'unreachable', severity: 'high' });
    return base;
  }
  base.finalUrl = res.finalUrl;
  base.status = res.status;
  base.ms = res.ms;
  base.bytes = res.bytes;
  if (res.status >= 400) {
    base.issues.push({ code: 'http_error', severity: 'high' });
    return base;
  }
  if (!/html/i.test(res.contentType) && !/<html/i.test(res.body.slice(0, 2000))) {
    base.issues.push({ code: 'not_html', severity: 'medium' });
    return base;
  }

  const $ = cheerio.load(res.body);
  const host = new URL(res.finalUrl).hostname.replace(/^www\./, '');
  base.title = $('head title').first().text().trim() || null;
  base.description = $('meta[name="description" i]').attr('content')?.trim() || null;
  base.h1 = $('h1')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean)
    .slice(0, 5);
  const h1Count = $('h1').length;
  base.h2Count = $('h2').length;
  const canonicalHref = $('link[rel="canonical" i]').attr('href')?.trim();
  base.canonical = canonicalHref ? new URL(canonicalHref, res.finalUrl).toString() : null;
  base.robots = $('meta[name="robots" i]').attr('content')?.trim() || null;
  base.lang = $('html').attr('lang')?.trim() || null;
  base.viewport = $('meta[name="viewport" i]').length > 0;
  base.ogTitle = $('meta[property="og:title"]').length > 0;
  base.ogImage = $('meta[property="og:image"]').length > 0;
  base.hreflangCount = $('link[rel="alternate" i][hreflang]').length;
  const types = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const walk = (n: any) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n['@type']) [].concat(n['@type']).forEach((t) => types.add(String(t)));
        if (n['@graph']) walk(n['@graph']);
      };
      walk(JSON.parse($(el).text()));
    } catch {
      /* битый JSON-LD — просто пропускаем */
    }
  });
  base.jsonLdTypes = [...types].slice(0, 12);
  $('img').each((_, el) => {
    base.images++;
    if (!($(el).attr('alt') || '').trim()) base.imagesNoAlt++;
  });
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    try {
      const h = new URL(href, res.finalUrl).hostname.replace(/^www\./, '');
      if (h === host) base.internalLinks++;
      else base.externalLinks++;
    } catch {
      /* кривой href */
    }
  });
  $('script, style, noscript, svg, template').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  base.wordCount = text ? text.split(' ').length : 0;
  base.excerpt = text.slice(0, 500);

  const add = (code: string, severity: SeoIssueSeverity) => base.issues.push({ code, severity });
  const titleLen = base.title?.length || 0;
  const descLen = base.description?.length || 0;
  if (!base.title) add('no_title', 'high');
  else if (titleLen < 25) add('title_short', 'medium');
  else if (titleLen > 65) add('title_long', 'low');
  if (!base.description) add('no_description', 'medium');
  else if (descLen < 70) add('description_short', 'low');
  else if (descLen > 170) add('description_long', 'low');
  if (h1Count === 0) add('no_h1', 'medium');
  else if (h1Count > 1) add('multiple_h1', 'low');
  if (base.robots && /noindex/i.test(base.robots)) add('noindex', 'high');
  if (!base.canonical) add('no_canonical', 'low');
  else if (stripSlash(base.canonical) !== stripSlash(res.finalUrl)) add('canonical_other', 'medium');
  if (!base.viewport) add('no_viewport', 'high');
  if (!base.lang) add('no_lang', 'low');
  if (base.wordCount < 250) add('thin_content', 'medium');
  if (base.imagesNoAlt > 0) add('images_no_alt', base.imagesNoAlt > 5 ? 'medium' : 'low');
  if (!base.ogTitle || !base.ogImage) add('no_open_graph', 'low');
  if (!base.jsonLdTypes.length) add('no_schema', 'low');
  if (res.ms > 3000) add('slow_response', 'medium');
  return base;
}

function stripSlash(u: string): string {
  return u.replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
}

/** robots.txt + sitemap.xml: наличие, «закрыт ли сайт целиком», и адреса из карты сайта. */
export async function auditSite(siteUrl: string): Promise<{ site: SeoSiteAudit; sitemapUrls: string[] }> {
  const origin = new URL(siteUrl).origin;
  const site: SeoSiteAudit = {
    origin,
    https: origin.startsWith('https:'),
    robotsTxt: { found: false, disallowAll: false, sitemaps: [] },
    sitemap: { found: false, url: null, urlCount: 0 },
    issues: [],
  };
  try {
    const r = await safeFetch(`${origin}/robots.txt`, { maxBytes: 500_000, timeoutMs: 10_000 });
    if (r.status === 200 && !/<html/i.test(r.body.slice(0, 500))) {
      site.robotsTxt.found = true;
      site.robotsTxt.sitemaps = [...r.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 5);
      // «User-agent: *» + «Disallow: /» — сайт закрыт от индексации целиком
      let starGroup = false;
      for (const line of r.body.split(/\r?\n/)) {
        const l = line.replace(/#.*$/, '').trim();
        if (/^user-agent:/i.test(l)) starGroup = /^user-agent:\s*\*\s*$/i.test(l);
        else if (starGroup && /^disallow:\s*\/\s*$/i.test(l)) site.robotsTxt.disallowAll = true;
      }
    }
  } catch {
    /* нет robots.txt */
  }

  const sitemapUrls: string[] = [];
  const candidates = [...site.robotsTxt.sitemaps, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  for (const sm of candidates) {
    try {
      const r = await safeFetch(sm, { maxBytes: 5_000_000, timeoutMs: 12_000 });
      if (r.status !== 200 || !/<(urlset|sitemapindex)/i.test(r.body)) continue;
      site.sitemap.found = true;
      site.sitemap.url = r.finalUrl;
      let locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
      // индекс карт — открываем первую вложенную карту, чтобы получить реальные страницы
      if (/<sitemapindex/i.test(r.body) && locs[0]) {
        try {
          const inner = await safeFetch(locs[0], { maxBytes: 5_000_000, timeoutMs: 12_000 });
          locs = [...inner.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
        } catch {
          locs = [];
        }
      }
      site.sitemap.urlCount = locs.length;
      sitemapUrls.push(...locs.slice(0, 50));
      break;
    } catch {
      /* следующий кандидат */
    }
  }

  if (!site.https) site.issues.push({ code: 'no_https', severity: 'high' });
  if (!site.robotsTxt.found) site.issues.push({ code: 'no_robots', severity: 'low' });
  if (site.robotsTxt.disallowAll) site.issues.push({ code: 'robots_disallow_all', severity: 'high' });
  if (!site.sitemap.found) site.issues.push({ code: 'no_sitemap', severity: 'medium' });
  return { site, sitemapUrls };
}

/** Одинаковые title/description на разных страницах — каннибализация и слабый сниппет. */
export function markDuplicates(pages: SeoPageAudit[]): void {
  const mark = (field: 'title' | 'description', code: string) => {
    const seen = new Map<string, SeoPageAudit[]>();
    for (const p of pages) {
      const v = p[field]?.trim().toLowerCase();
      if (!v) continue;
      seen.set(v, [...(seen.get(v) || []), p]);
    }
    for (const group of seen.values()) {
      if (group.length > 1) group.forEach((p) => p.issues.push({ code, severity: 'medium' }));
    }
  };
  mark('title', 'duplicate_title');
  mark('description', 'duplicate_description');
}

const WEIGHT: Record<SeoIssueSeverity, number> = { high: 12, medium: 5, low: 2 };

/** Техническая оценка 0–100 по найденным проблемам (детерминированная, не от ИИ). */
export function technicalScore(site: SeoSiteAudit, pages: SeoPageAudit[]): number {
  const sitePenalty = site.issues.reduce((s, i) => s + WEIGHT[i.severity], 0);
  const perPage = pages.length
    ? pages.reduce((s, p) => s + Math.min(60, p.issues.reduce((a, i) => a + WEIGHT[i.severity], 0)), 0) / pages.length
    : 30;
  return Math.max(0, Math.min(100, Math.round(100 - sitePenalty - perPage)));
}

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export type ScrapedEmailStatus = 'found' | 'not_found';

export interface ScrapedEmailResult {
  email: string | null;
  status: ScrapedEmailStatus;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const PREFERRED_LOCAL_PARTS = ['info', 'contact', 'office', 'sales', 'hello', 'mail'];

const NOISE_DOMAINS = new Set([
  'sentry.io',
  'wixpress.com',
  'example.com',
  'w3.org',
  'schema.org',
  'googleapis.com',
  'gstatic.com',
  'google.com',
  'cloudflare.com',
  'godaddy.com',
  'wordpress.com',
  // Common template/placeholder domains left in unfinished site boilerplate.
  'domain.com',
  'yourdomain.com',
  'yoursite.com',
  'website.com',
  'email.com',
  'test.com',
  'sample.com',
  'site.com',
  'company.com',
  'yourcompany.com',
]);

// Placeholder local-parts that show up in template boilerplate regardless of domain
// (e.g. "user@mybrand.com" left over from a theme demo).
const NOISE_LOCAL_PARTS = new Set(['user', 'someone', 'yourname', 'youremail', 'name', 'test']);

// EN/TR/RU keywords, since target businesses may not have English contact pages.
const CONTACT_LINK_PATTERN = /contact|contacts|iletişim|iletisim|kontakt|о\s*нас|обратная\s*связь/i;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

@Injectable()
export class WebsiteEmailScraperService {
  private readonly logger = new Logger(WebsiteEmailScraperService.name);

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const { data } = await axios.get<string>(url, {
        timeout: 8000,
        maxContentLength: 2_000_000,
        maxRedirects: 5,
        responseType: 'text',
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      return typeof data === 'string' ? data : null;
    } catch (err) {
      this.logger.debug(`Failed to fetch ${url}: ${(err as Error).message}`);
      return null;
    }
  }

  private rankEmails(emails: string[]): string[] {
    const unique = Array.from(new Set(emails.map((e) => e.toLowerCase())));
    unique.sort((a, b) => {
      const aPref = PREFERRED_LOCAL_PARTS.some((p) => a.startsWith(`${p}@`)) ? 0 : 1;
      const bPref = PREFERRED_LOCAL_PARTS.some((p) => b.startsWith(`${p}@`)) ? 0 : 1;
      return aPref - bPref;
    });
    return unique;
  }

  private isNoiseEmail(addr: string): boolean {
    const [localPart, domain] = addr.toLowerCase().split('@');
    if (!domain) return true;
    const isNoiseDomain = [...NOISE_DOMAINS].some(
      (noise) => domain === noise || domain.endsWith(`.${noise}`),
    );
    if (isNoiseDomain) return true;
    if (NOISE_LOCAL_PARTS.has(localPart)) return true;
    // Long hex-looking local-parts are almost always tracking/error-monitoring beacon
    // addresses (e.g. Sentry DSNs embedded in a site's JS), never a real contact address.
    if (/^[0-9a-f]{24,}$/.test(localPart)) return true;
    return false;
  }

  private extractEmails(html: string, siteDomain: string): string[] {
    const $ = cheerio.load(html);

    const mailtoEmails: string[] = [];
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const addr = decodeURIComponent(href.replace(/^mailto:/i, '').split('?')[0]).trim();
      if (addr && !this.isNoiseEmail(addr)) mailtoEmails.push(addr);
    });
    if (mailtoEmails.length > 0) {
      return this.rankEmails(mailtoEmails);
    }

    const text = $.root().text();
    const matches: string[] = text.match(EMAIL_REGEX) || [];
    const nonNoise = matches.filter((addr) => !this.isNoiseEmail(addr));
    const sameDomain = nonNoise.filter((addr) => {
      const domain = addr.split('@')[1]?.toLowerCase() || '';
      return domain.includes(siteDomain) || siteDomain.includes(domain);
    });

    return this.rankEmails(sameDomain.length > 0 ? sameDomain : nonNoise);
  }

  private findContactPageUrl(html: string, baseUrl: string): string | null {
    const $ = cheerio.load(html);
    let found: string | null = null;
    $('a[href]').each((_, el) => {
      if (found) return;
      const text = $(el).text() || '';
      const href = $(el).attr('href') || '';
      if (CONTACT_LINK_PATTERN.test(text) || CONTACT_LINK_PATTERN.test(href)) {
        try {
          const resolved = new URL(href, baseUrl);
          if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
            found = resolved.toString();
          }
        } catch {
          // ignore malformed hrefs (mailto:, tel:, javascript:, etc.)
        }
      }
    });
    return found;
  }

  /** Homepage first, then at most one likely contact page. Never fabricates an address. */
  async findBusinessEmail(website: string | null): Promise<ScrapedEmailResult> {
    if (!website) return { email: null, status: 'not_found' };

    let baseUrl: URL;
    try {
      baseUrl = new URL(website);
    } catch {
      return { email: null, status: 'not_found' };
    }
    const siteDomain = baseUrl.hostname.replace(/^www\./, '').toLowerCase();

    const homeHtml = await this.fetchHtml(baseUrl.toString());
    if (!homeHtml) return { email: null, status: 'not_found' };

    const homeEmails = this.extractEmails(homeHtml, siteDomain);
    if (homeEmails.length > 0) return { email: homeEmails[0], status: 'found' };

    const contactUrl = this.findContactPageUrl(homeHtml, baseUrl.toString());
    if (contactUrl) {
      const contactHtml = await this.fetchHtml(contactUrl);
      if (contactHtml) {
        const contactEmails = this.extractEmails(contactHtml, siteDomain);
        if (contactEmails.length > 0) return { email: contactEmails[0], status: 'found' };
      }
    }

    return { email: null, status: 'not_found' };
  }
}

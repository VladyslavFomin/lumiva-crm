import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

export type GeoPoint = { lat: number; lon: number; name: string; countryCode: string | null };

/**
 * Геокодинг названий городов/адресов для блока «Карта» (режим «точки»).
 * Источник — OpenStreetMap Nominatim: по их правилам не больше 1 запроса в секунду, свой
 * User-Agent и обязательный кэш — поэтому результаты (включая «не найдено») кладём в
 * geo_geocode_cache и ходим наружу строго по очереди. Строка кэша ~200 байт; раз в сутки чистим:
 * «не найдено» старше 30 дней (могли исправить опечатку) и всё, к чему не обращались 180 дней.
 */
@Injectable()
export class GeocodeService implements OnModuleInit {
  private readonly log = new Logger(GeocodeService.name);
  private queue: Promise<unknown> = Promise.resolve();
  private lastCallAt = 0;
  private static readonly MAX_NEW_PER_CALL = 12;

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "geo_geocode_cache" (
          "cache_key" varchar(400) PRIMARY KEY,
          "query" varchar(300) NOT NULL,
          "country_hint" varchar(2),
          "found" boolean NOT NULL,
          "lat" double precision,
          "lon" double precision,
          "name" varchar(300),
          "country_code" varchar(2),
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "last_used_at" timestamptz NOT NULL DEFAULT now()
        )
      `);
      await this.dataSource.query(
        `ALTER TABLE "geo_geocode_cache" ADD COLUMN IF NOT EXISTS "last_used_at" timestamptz NOT NULL DEFAULT now()`,
      );
    } catch (e) {
      this.log.error(`geo_geocode_cache init failed: ${(e as Error).message}`);
    }
  }

  private key(query: string, country: string | null) {
    return `${(country || '*').toLowerCase()}|${query.trim().toLowerCase().replace(/\s+/g, ' ')}`.slice(0, 400);
  }

  /** Результат по каждому запросу: точка, null (не найдено) или pending (не успели — спросить ещё раз). */
  async geocodeMany(
    queriesRaw: unknown,
    countryRaw?: unknown,
  ): Promise<{ results: Record<string, GeoPoint | null>; pending: string[] }> {
    const country =
      typeof countryRaw === 'string' && /^[A-Za-z]{2}$/.test(countryRaw) ? countryRaw.toUpperCase() : null;
    const queries = Array.from(
      new Set(
        (Array.isArray(queriesRaw) ? queriesRaw : [])
          .map((q) => String(q ?? '').trim())
          .filter((q) => q.length > 0 && q.length <= 200),
      ),
    ).slice(0, 200);
    const results: Record<string, GeoPoint | null> = {};
    if (!queries.length) return { results, pending: [] };

    const keys = queries.map((q) => this.key(q, country));
    const rows: Array<{ cache_key: string; found: boolean; lat: number; lon: number; name: string; country_code: string | null }> =
      await this.dataSource.query(`SELECT * FROM "geo_geocode_cache" WHERE "cache_key" = ANY($1)`, [keys]);
    const byKey = new Map(rows.map((r) => [r.cache_key, r]));
    if (rows.length) {
      // Отметка «используется» — не чаще раза в сутки на строку, чтобы не писать в БД на каждый просмотр.
      void this.dataSource
        .query(
          `UPDATE "geo_geocode_cache" SET "last_used_at" = now()
           WHERE "cache_key" = ANY($1) AND "last_used_at" < now() - interval '1 day'`,
          [rows.map((r) => r.cache_key)],
        )
        .catch(() => undefined);
    }

    const missing: string[] = [];
    queries.forEach((q, i) => {
      const row = byKey.get(keys[i]);
      if (!row) {
        missing.push(q);
        return;
      }
      results[q] = row.found
        ? { lat: Number(row.lat), lon: Number(row.lon), name: row.name, countryCode: row.country_code }
        : null;
    });

    const now = missing.slice(0, GeocodeService.MAX_NEW_PER_CALL);
    for (const q of now) {
      try {
        results[q] = await this.enqueue(() => this.lookup(q, country));
      } catch (e) {
        this.log.warn(`geocode failed for "${q}": ${(e as Error).message}`);
      }
    }
    const pending = missing.filter((q) => !(q in results));
    return { results, pending };
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupCache() {
    try {
      const res = await this.dataSource.query(
        `DELETE FROM "geo_geocode_cache"
         WHERE (NOT "found" AND "created_at" < now() - interval '30 days')
            OR "last_used_at" < now() - interval '180 days'`,
      );
      const removed = Array.isArray(res) ? res[1] : 0;
      if (removed) this.log.log(`geo cache cleanup: removed ${removed}`);
    } catch (e) {
      this.log.warn(`geo cache cleanup failed: ${(e as Error).message}`);
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.lastCallAt + 1100 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCallAt = Date.now();
      return fn();
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async lookup(query: string, country: string | null): Promise<GeoPoint | null> {
    const params = new URLSearchParams({ format: 'jsonv2', limit: '1', q: query, 'accept-language': 'en' });
    if (country) params.set('countrycodes', country.toLowerCase());
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'LumivaCRM/1.0 (https://crm.lumiva.agency)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const list = (await res.json()) as Array<{ lat: string; lon: string; name?: string; display_name?: string; address?: any }>;
    const hit = list[0];
    const point: GeoPoint | null = hit
      ? {
          lat: Number(hit.lat),
          lon: Number(hit.lon),
          name: String(hit.name || hit.display_name || query).slice(0, 300),
          countryCode: country,
        }
      : null;
    await this.dataSource.query(
      `INSERT INTO "geo_geocode_cache" ("cache_key","query","country_hint","found","lat","lon","name","country_code")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("cache_key") DO NOTHING`,
      [
        this.key(query, country),
        query.slice(0, 300),
        country,
        Boolean(point),
        point?.lat ?? null,
        point?.lon ?? null,
        point?.name ?? null,
        point?.countryCode ?? null,
      ],
    );
    return point;
  }
}

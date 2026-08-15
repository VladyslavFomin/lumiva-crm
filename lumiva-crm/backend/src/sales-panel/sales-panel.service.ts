import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesProspect } from './sales-prospect.entity';
import { GooglePlacesService, type GooglePlaceSearchResult } from './google-places.service';
import { WebsiteEmailScraperService } from './website-email-scraper.service';
import { ListProspectsDto } from './dto/list-prospects.dto';

const DETAILS_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// Details + website scraping run per-business; without concurrency 20 results can take
// well over a minute sequentially and blow past the frontend's request timeout.
const SEARCH_CONCURRENCY = 5;

@Injectable()
export class SalesPanelService {
  private readonly logger = new Logger(SalesPanelService.name);

  constructor(
    @InjectRepository(SalesProspect)
    private readonly prospectRepo: Repository<SalesProspect>,
    private readonly places: GooglePlacesService,
    private readonly emailScraper: WebsiteEmailScraperService,
  ) {}

  async search(params: {
    city: string;
    businessType: string;
    pageToken?: string;
    refresh?: boolean;
  }) {
    const { city, businessType, pageToken, refresh } = params;
    const { results, nextPageToken } = await this.places.textSearch(
      city,
      businessType,
      pageToken,
    );

    let quotaExceeded = false;
    const prospects = await this.mapWithConcurrency(results, SEARCH_CONCURRENCY, async (result) => {
      const { prospect, quotaHit } = await this.upsertFromSearchResult(
        result,
        city,
        businessType,
        !!refresh,
      );
      if (quotaHit) quotaExceeded = true;
      return prospect;
    });

    const usage = await this.places.getTodayUsageSnapshot();

    return { prospects, nextPageToken, quotaExceeded, usage };
  }

  /** Runs `fn` over `items` with at most `limit` in flight at once. */
  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const current = next++;
        results[current] = await fn(items[current]);
      }
    });
    await Promise.all(workers);
    return results;
  }

  private async upsertFromSearchResult(
    result: GooglePlaceSearchResult,
    city: string,
    businessType: string,
    refresh: boolean,
  ): Promise<{ prospect: SalesProspect; quotaHit: boolean }> {
    let prospect = await this.prospectRepo.findOne({ where: { placeId: result.placeId } });
    let quotaHit = false;

    const isStale =
      refresh &&
      !!prospect?.detailsFetchedAt &&
      Date.now() - prospect.detailsFetchedAt.getTime() > DETAILS_STALE_MS;
    const needsDetails = !prospect || !prospect.detailsFetchedAt || isStale;

    if (needsDetails) {
      if (await this.places.isDailyDetailsCapReached()) {
        quotaHit = true;
      } else {
        try {
          const details = await this.places.fetchDetails(result.placeId);

          let email = prospect?.email ?? null;
          let emailStatus = prospect?.emailStatus ?? 'unknown';
          let emailScrapedAt = prospect?.emailScrapedAt ?? null;

          const websiteChanged = !prospect || prospect.website !== details.website;
          if (details.website && (websiteChanged || emailStatus === 'unknown')) {
            const scraped = await this.emailScraper.findBusinessEmail(details.website);
            email = scraped.email;
            emailStatus = scraped.status;
            emailScrapedAt = new Date();
          }

          if (!prospect) {
            prospect = this.prospectRepo.create({ placeId: result.placeId });
          }
          prospect.name = details.name || result.name;
          prospect.formattedAddress = details.formattedAddress ?? result.formattedAddress;
          prospect.searchCity = city;
          prospect.searchBusinessType = businessType;
          prospect.phone = details.phone;
          prospect.website = details.website;
          prospect.email = email;
          prospect.emailStatus = emailStatus;
          prospect.emailScrapedAt = emailScrapedAt;
          prospect.lat = details.lat ?? result.lat;
          prospect.lng = details.lng ?? result.lng;
          prospect.rating = details.rating != null ? String(details.rating) : null;
          prospect.userRatingsTotal = details.userRatingsTotal ?? result.userRatingsTotal;
          prospect.googleMapsUrl = details.googleMapsUrl;
          prospect.rawPlaceDetails = details.raw;
          prospect.detailsFetchedAt = new Date();

          prospect = await this.prospectRepo.save(prospect);
        } catch (err) {
          this.logger.warn(
            `Failed to fetch details for ${result.placeId}: ${(err as Error).message}`,
          );
        }
      }
    }

    if (!prospect) {
      // Details weren't fetched (quota cap or a transient error) — still persist the
      // bare Text Search result so the business shows up; details can be filled in later.
      prospect = this.prospectRepo.create({
        placeId: result.placeId,
        name: result.name,
        formattedAddress: result.formattedAddress,
        searchCity: city,
        searchBusinessType: businessType,
        lat: result.lat,
        lng: result.lng,
        rating: result.rating != null ? String(result.rating) : null,
        userRatingsTotal: result.userRatingsTotal,
      });
      prospect = await this.prospectRepo.save(prospect);
    } else if (prospect.searchCity !== city || prospect.searchBusinessType !== businessType) {
      prospect.searchCity = city;
      prospect.searchBusinessType = businessType;
      prospect = await this.prospectRepo.save(prospect);
    }

    return { prospect, quotaHit };
  }

  async list(query: ListProspectsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const qb = this.prospectRepo.createQueryBuilder('p');
    if (query.status) qb.andWhere('p."outreachStatus" = :status', { status: query.status });
    if (query.city) qb.andWhere('p."searchCity" ILIKE :city', { city: `%${query.city}%` });
    if (query.businessType) {
      qb.andWhere('p."searchBusinessType" ILIKE :bt', { bt: `%${query.businessType}%` });
    }
    if (query.search) {
      qb.andWhere(
        '(p.name ILIKE :s OR p."formattedAddress" ILIKE :s OR p.email ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    if (query.hasWebsite !== undefined) {
      qb.andWhere(query.hasWebsite === 'true' ? 'p.website IS NOT NULL' : 'p.website IS NULL');
    }
    if (query.hasEmail !== undefined) {
      qb.andWhere(query.hasEmail === 'true' ? 'p.email IS NOT NULL' : 'p.email IS NULL');
    }
    if (query.hasPhone !== undefined) {
      qb.andWhere(query.hasPhone === 'true' ? 'p.phone IS NOT NULL' : 'p.phone IS NULL');
    }
    qb.orderBy('p."updatedAt"', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findOne(id: string): Promise<SalesProspect | null> {
    return this.prospectRepo.findOne({ where: { id } });
  }

  async markContacted(id: string): Promise<SalesProspect | null> {
    const prospect = await this.prospectRepo.findOne({ where: { id } });
    if (!prospect) return null;
    if (prospect.outreachStatus === 'not_contacted') {
      prospect.outreachStatus = 'sent';
    }
    prospect.lastContactedAt = new Date();
    return this.prospectRepo.save(prospect);
  }

  /** Reviewed and rejected as unsuitable — no email involved, just excludes it from future work. */
  async markSkipped(id: string): Promise<SalesProspect | null> {
    const prospect = await this.prospectRepo.findOne({ where: { id } });
    if (!prospect) return null;
    prospect.outreachStatus = 'skipped';
    return this.prospectRepo.save(prospect);
  }

  /** Undo — puts a skipped business back into the working pool. */
  async unmarkSkipped(id: string): Promise<SalesProspect | null> {
    const prospect = await this.prospectRepo.findOne({ where: { id } });
    if (!prospect) return null;
    if (prospect.outreachStatus === 'skipped') {
      prospect.outreachStatus = 'not_contacted';
    }
    return this.prospectRepo.save(prospect);
  }
}

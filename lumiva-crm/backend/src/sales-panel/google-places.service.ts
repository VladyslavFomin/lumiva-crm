import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { SalesApiUsage } from './sales-api-usage.entity';

export interface GooglePlaceSearchResult {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  userRatingsTotal: number | null;
}

export interface GooglePlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  userRatingsTotal: number | null;
  raw: Record<string, unknown>;
}

const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
// Explicit field mask keeps each Details call in Google's cheapest applicable pricing
// tier (no photos/reviews/atmosphere fields).
const DETAILS_FIELDS =
  'name,formatted_phone_number,international_phone_number,website,formatted_address,url,geometry,rating,user_ratings_total';

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);

  constructor(
    @InjectRepository(SalesApiUsage)
    private readonly usageRepo: Repository<SalesApiUsage>,
  ) {}

  private get apiKey(): string {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) {
      throw new Error(
        'GOOGLE_PLACES_API_KEY is not configured — add it to backend/.env to use business search.',
      );
    }
    return key;
  }

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async getTodayUsage(): Promise<SalesApiUsage> {
    const usageDate = this.todayKey();
    let row = await this.usageRepo.findOne({ where: { usageDate } });
    if (!row) {
      row = this.usageRepo.create({
        usageDate,
        placesTextSearchCalls: 0,
        placesDetailsCalls: 0,
      });
      row = await this.usageRepo.save(row);
    }
    return row;
  }

  async getTodayUsageSnapshot(): Promise<{
    placesTextSearchCalls: number;
    placesDetailsCalls: number;
    dailyDetailsCap: number;
  }> {
    const usage = await this.getTodayUsage();
    return {
      placesTextSearchCalls: usage.placesTextSearchCalls,
      placesDetailsCalls: usage.placesDetailsCalls,
      dailyDetailsCap: Number(process.env.GOOGLE_PLACES_DAILY_DETAILS_CAP || 300),
    };
  }

  async isDailyDetailsCapReached(): Promise<boolean> {
    const cap = Number(process.env.GOOGLE_PLACES_DAILY_DETAILS_CAP || 300);
    const usage = await this.getTodayUsage();
    return usage.placesDetailsCalls >= cap;
  }

  async textSearch(
    city: string,
    businessType: string,
    pageToken?: string,
  ): Promise<{ results: GooglePlaceSearchResult[]; nextPageToken: string | null }> {
    const params: Record<string, string> = pageToken
      ? { pagetoken: pageToken, key: this.apiKey }
      : { query: `${businessType} in ${city}`, key: this.apiKey };

    const { data } = await axios.get(TEXT_SEARCH_URL, { params, timeout: 10000 });

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(
        `Google Places Text Search error: ${data.status} ${data.error_message || ''}`.trim(),
      );
    }

    const usage = await this.getTodayUsage();
    usage.placesTextSearchCalls += 1;
    await this.usageRepo.save(usage);

    const rawResults: Array<Record<string, any>> = data.results || [];
    const results: GooglePlaceSearchResult[] = rawResults.map((r) => ({
      placeId: r.place_id,
      name: r.name,
      formattedAddress: r.formatted_address ?? null,
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
      rating: r.rating ?? null,
      userRatingsTotal: r.user_ratings_total ?? null,
    }));

    return { results, nextPageToken: data.next_page_token ?? null };
  }

  async fetchDetails(placeId: string): Promise<GooglePlaceDetails> {
    const params = { place_id: placeId, fields: DETAILS_FIELDS, key: this.apiKey };
    const { data } = await axios.get(DETAILS_URL, { params, timeout: 10000 });

    if (data.status !== 'OK') {
      throw new Error(
        `Google Places Details error: ${data.status} ${data.error_message || ''}`.trim(),
      );
    }

    const usage = await this.getTodayUsage();
    usage.placesDetailsCalls += 1;
    await this.usageRepo.save(usage);

    const r: Record<string, any> = data.result || {};
    return {
      placeId,
      name: r.name,
      formattedAddress: r.formatted_address ?? null,
      phone: r.formatted_phone_number ?? r.international_phone_number ?? null,
      website: r.website ?? null,
      googleMapsUrl: r.url ?? null,
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
      rating: r.rating ?? null,
      userRatingsTotal: r.user_ratings_total ?? null,
      raw: r,
    };
  }
}

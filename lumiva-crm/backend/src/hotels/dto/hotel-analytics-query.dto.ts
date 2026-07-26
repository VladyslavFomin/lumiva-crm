// src/hotels/dto/hotel-analytics-query.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class HotelAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  hotelIds?: string; // comma-separated, or 'all'/omitted for every hotel

  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string; // YYYY-MM-DD, arrival-date (checkIn) range start

  @IsOptional()
  @IsString()
  dateTo?: string; // YYYY-MM-DD, arrival-date (checkIn) range end

  @IsOptional()
  @IsString()
  marketId?: string; // matches HotelReservation.market (free-text)

  @IsOptional()
  @IsString()
  agencyId?: string;
}

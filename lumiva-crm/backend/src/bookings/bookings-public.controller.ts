import { Body, Controller, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { BookingsProjectsService } from './bookings-projects.service';
import { BookingsAvailabilityService } from './bookings-availability.service';
import { ReservationsService } from './reservations.service';

/**
 * Intake для внешнего коннектора (виджет сайта и т.п.) — тот же ApiTokenGuard, что и
 * ProductsPublicController. Сам виджет/конструктор формы — вне скоупа (см. дизайн-бриф).
 */
@Controller('public/bookings')
@UseGuards(ApiTokenGuard)
export class BookingsPublicController {
  constructor(
    private readonly projects: BookingsProjectsService,
    private readonly availability: BookingsAvailabilityService,
    private readonly reservations: ReservationsService,
  ) {}

  @Post('ingest')
  async ingest(
    @Req() req: Request & { tenantId: string },
    @Body()
    dto: {
      locationId: string;
      serviceId?: string;
      staffUserId?: string;
      startAt: string;
      endAt: string;
      participants?: number;
      customer: { name?: string; phone?: string; email?: string };
      customFields?: Record<string, any>;
    },
  ) {
    const tenantId = req.tenantId;
    if (!dto.locationId || !dto.startAt || !dto.endAt) {
      throw new BadRequestException('locationId, startAt and endAt are required');
    }
    await this.projects.getOrCreateDefaultProject(tenantId);
    return this.reservations.create(
      tenantId,
      {
        locationId: dto.locationId,
        serviceId: dto.serviceId,
        staffUserId: dto.staffUserId,
        startAt: dto.startAt,
        endAt: dto.endAt,
        participants: dto.participants,
        customerName: dto.customer?.name,
        customerPhone: dto.customer?.phone,
        customerEmail: dto.customer?.email,
        source: 'website',
        customFields: dto.customFields,
      },
      null,
    );
  }
}

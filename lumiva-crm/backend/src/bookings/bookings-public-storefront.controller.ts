import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';
import { BookingsCatalogService } from './bookings-catalog.service';
import { ReservationsService } from './reservations.service';

interface CreateStorefrontBookingDto {
  serviceId: string;
  locationId: string;
  startAt: string;
  endAt: string;
  participants?: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
}

/**
 * Публичная (без авторизации) заявка на бронь для тестовой витрины на pl1 — см. текущий план
 * "Test storefront". В отличие от `bookings-public.controller.ts` (`/public/bookings/ingest`,
 * под ApiTokenGuard — для интеграций/виджетов), здесь тенант резолвится по `Tenant.clientKey`
 * (тот же публичный идентификатор, что и в products-public-catalog), и токен не нужен вовсе.
 */
@Controller('public/booking')
export class BookingsPublicStorefrontController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly catalog: BookingsCatalogService,
    private readonly reservations: ReservationsService,
  ) {}

  private async resolveTenantId(clientKey: string): Promise<string> {
    const tenant = await this.tenants.findByClientKey(clientKey);
    if (!tenant) throw new NotFoundException('Не найдено');
    return tenant.id;
  }

  @Get(':clientKey/services')
  async listServices(@Param('clientKey') clientKey: string) {
    const tenantId = await this.resolveTenantId(clientKey);
    const services = await this.catalog.listServices(tenantId);
    return services.filter((s) => s.active);
  }

  @Get(':clientKey/locations')
  async listLocations(@Param('clientKey') clientKey: string) {
    const tenantId = await this.resolveTenantId(clientKey);
    return this.catalog.listLocations(tenantId);
  }

  @Post(':clientKey/requests')
  async createRequest(@Param('clientKey') clientKey: string, @Body() dto: CreateStorefrontBookingDto) {
    if (!dto?.locationId || !dto?.startAt || !dto?.endAt) {
      throw new BadRequestException('locationId, startAt и endAt обязательны');
    }
    if (!dto.customerName?.trim()) throw new BadRequestException('Укажите имя');
    const tenantId = await this.resolveTenantId(clientKey);
    return this.reservations.create(
      tenantId,
      {
        locationId: dto.locationId,
        serviceId: dto.serviceId,
        startAt: dto.startAt,
        endAt: dto.endAt,
        participants: dto.participants,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
        source: 'website',
      },
      null,
    );
  }
}

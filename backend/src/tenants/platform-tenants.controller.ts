// backend/src/tenants/platform-tenants.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  NotFoundException,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Tenant } from './tenant.entity';

@Controller('platform/tenants')
export class PlatformTenantsController {
  constructor(private readonly tenants: TenantsService) {}

  /**
   * Унифицированный маппер → то, что ждёт pl1 (TenantSummary)
   */
  private mapTenant(t: Tenant) {
    return {
      id: t.id,
      clientKey: t.clientKey,
      name: t.name,
      status: t.status,
      plan: t.plan,
      apiEnabled: t.apiEnabled,
      activeUntil: t.activeUntil,
      ownerName: t.ownerName,
      ownerEmail: t.ownerEmail,
      notes: t.notes,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  /**
   * Список всех тенантов для pl1
   */
  @Get()
  async listAll() {
    const list = await this.tenants.findAll();
    return list.map((t) => this.mapTenant(t));
  }

  /**
   * Получить одного тенанта (для отладки / будущего UI)
   */
  @Get(':id')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const tenant = await this.tenants.findOne(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return this.mapTenant(tenant);
  }

  /**
   * Создание тенанта из pl1 (owner будет приглашён по email)
   */
  @Post()
  async create(
    @Body()
    body: {
      name: string;
      clientKey?: string;
      status?: string;
      plan?: string;
      ownerEmail: string;
      ownerFullName?: string;
      apiEnabled?: boolean;
      activeUntil?: string | null;
      ownerName?: string | null;
      notes?: string | null;
    },
  ) {
    const tenant = await this.tenants.platformCreateTenant({
      name: body.name,
      clientKey: body.clientKey,
      status: body.status,
      plan: body.plan,
      ownerEmail: body.ownerEmail,
      ownerFullName: body.ownerFullName,
      apiEnabled: body.apiEnabled,
      activeUntil: body.activeUntil,
      ownerName: body.ownerName,
      notes: body.notes,
    });

    return this.mapTenant(tenant);
  }

  /**
   * Обновление тенанта
   */
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body()
    body: {
      name?: string;
      clientKey?: string;
      status?: string;
      plan?: string;
      apiEnabled?: boolean;
      activeUntil?: string | null;
      ownerName?: string | null;
      ownerEmail?: string | null;
      notes?: string | null;
    },
  ) {
    const tenant = await this.tenants.platformUpdateTenant(id, body);
    return this.mapTenant(tenant);
  }

  /**
   * Включить тенанта
   */
  @Patch(':id/enable')
  async enable(@Param('id', new ParseUUIDPipe()) id: string) {
    const tenant = await this.tenants.platformUpdateTenant(id, {
      status: 'active',
    });
    return this.mapTenant(tenant);
  }

  /**
   * Выключить тенанта
   */
  @Patch(':id/disable')
  async disable(@Param('id', new ParseUUIDPipe()) id: string) {
    const tenant = await this.tenants.platformUpdateTenant(id, {
      status: 'blocked',
    });
    return this.mapTenant(tenant);
  }

  /**
   * Включить/выключить API
   */
  @Patch(':id/api/:mode')
  async toggleApi(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('mode') mode: 'on' | 'off',
  ) {
    const tenant = await this.tenants.platformUpdateTenant(id, {
      apiEnabled: mode === 'on',
    });
    return this.mapTenant(tenant);
  }

  /**
   * Удалить тенанта
   */
  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenants.platformDeleteTenant(id);
  }
}
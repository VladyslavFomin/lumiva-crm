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
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Tenant } from './tenant.entity';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { normalizeTenantPlan } from './plan-entitlements';

@Controller('platform/tenants')
@UseGuards(PlatformAdminGuard)
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
      plan: normalizeTenantPlan(t.plan),
      apiEnabled: t.apiEnabled,
      paymentProvider: t.paymentProvider,
      activeUntil: t.activeUntil,
      ownerName: t.ownerName,
      ownerEmail: t.ownerEmail,
      notes: t.notes,
      customDomain: t.customDomain,
      customDomainStatus: t.customDomainStatus,
      customDomainError: t.customDomainError,
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
   * Общий список логов (последние 200, опционально по tenantId)
   */
  @Get('logs')
  async listLogs(
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    const limNum = limit ? Math.min(Number(limit) || 200, 500) : 200;
    const logs = await this.tenants.getAllLogs({
      tenantId: tenantId || undefined,
      limit: limNum,
    });
    return logs;
  }

  /**
   * Все API/сайты по всем тенантам (для поддержки). Токены маскируются.
   */
  @Get('sites')
  async listSites(@Query('tenantId') tenantId?: string) {
    const [sites, integrations] = await Promise.all([
      this.tenants.findAllSitesWithTenant({
        tenantId: tenantId || undefined,
      }),
      this.tenants.findIntegrations({ tenantId: tenantId || undefined }),
    ]);

    // считаем количество сайтов на тенант
    const counts = new Map<string, number>();
    sites.forEach((s) =>
      counts.set(s.tenantId, (counts.get(s.tenantId) || 0) + 1),
    );

    // группируем интеграции по тенанту
    const integrationsByTenant = new Map<string, any[]>();
    integrations.forEach((i) => {
      const arr = integrationsByTenant.get(i.tenantId) || [];
      arr.push({
        id: i.id,
        name: i.name,
        kind: i.kind,
        lastSyncStatus: i.lastSyncStatus,
        lastSyncAt: i.lastSyncAt,
        isEnabled: i.isEnabled,
        description: i.description,
      });
      integrationsByTenant.set(i.tenantId, arr);
    });

    // убираем дубликаты по домену на одного тенанта (берём самый свежий)
    const unique = new Map<string, (typeof sites)[number]>();
    sites.forEach((s) => {
      const key = `${s.tenantId}|${s.domain.toLowerCase()}`;
      const prev = unique.get(key);
      if (!prev) {
        unique.set(key, s);
      } else {
        const prevTs = new Date(prev.updatedAt).getTime();
        const curTs = new Date(s.updatedAt).getTime();
        if (curTs > prevTs) unique.set(key, s);
      }
    });

    const maskToken = (token: string | null | undefined) => {
      if (!token) return '';
      const last = token.slice(-4);
      const masked = '*'.repeat(Math.max(0, token.length - 4));
      return `${masked}${last}`;
    };

    return Array.from(unique.values()).map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      tenantClientKey: s.tenant?.clientKey,
      tenantName: s.tenant?.name,
      domain: s.domain,
      name: s.name,
      status: s.status,
      apiTokenMasked: maskToken(s.apiToken),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      sitesPerTenant: counts.get(s.tenantId) || 1,
      integrations: integrationsByTenant.get(s.tenantId) || [],
    }));
  }

  /**
   * Принудительно очистить просроченные токены сброса пароля (для поддержки).
   */
  @Post('password-reset/prune')
  async pruneResetTokens() {
    return this.tenants.pruneResetTokens();
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
   * Компоненты тенанта (для админ-панели)
   */
  @Get(':id/components')
  async getComponents(@Param('id', new ParseUUIDPipe()) id: string) {
    console.log(`[PlatformTenantsController] GET components for tenant: ${id}`);
    const components = await this.tenants.getTenantComponents(id);
    console.log(`[PlatformTenantsController] Returning ${components.length} components`);
    return components;
  }

  /**
   * Включить/выключить компонент для тенанта
   */
  @Patch(':id/components/:componentKey')
  async toggleComponent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('componentKey') componentKey: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.tenants.toggleTenantComponent(id, componentKey, body.enabled);
  }

  /**
   * История событий по тенанту (для поддержки/отладки)
   */
  @Get(':id/logs')
  async getLogs(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tenants.getTenantLogs(id, 100);
  }

  /**
   * Сгенерировать ссылку на сброс пароля для владельца тенанта (через токен).
   */
  @Post(':id/password-reset')
  async passwordResetLinkPost(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tenants.issueOwnerPasswordResetLink(id);
  }

  // дублируем GET для совместимости, если где-то ограничены на POST
  @Get(':id/password-reset')
  async passwordResetLinkGet(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tenants.issueOwnerPasswordResetLink(id);
  }

  /**
   * Отправить письмо на сброс пароля (по ownerEmail или кастомному адресу).
   */
  @Post(':id/password-reset/send')
  async sendPasswordReset(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { to?: string },
  ) {
    return this.tenants.sendOwnerPasswordResetEmail(id, body?.to);
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
      paymentProvider?: 'stripe' | 'yookassa' | 'iyzico' | null;
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
   * Записать/снять запрошенный клиентом кастомный домен (переводит в pending). Настраивается
   * только отсюда — по запросу клиента, никакого self-service.
   */
  @Patch(':id/domain')
  async setDomain(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { customDomain: string | null },
  ) {
    const tenant = await this.tenants.setTenantCustomDomain(
      id,
      body.customDomain ?? null,
    );
    return this.mapTenant(tenant);
  }

  /**
   * Отметить домен активным — вызывается вручную (или provision-tenant-domain.sh) после того,
   * как сертификат и nginx-vhost реально выпущены.
   */
  @Post(':id/domain/mark-active')
  async markDomainActive(@Param('id', new ParseUUIDPipe()) id: string) {
    const tenant = await this.tenants.markCustomDomainActive(id);
    return this.mapTenant(tenant);
  }

  /**
   * Отметить провижининг домена неудавшимся, с причиной для отображения в pl1.
   */
  @Post(':id/domain/mark-failed')
  async markDomainFailed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { error: string },
  ) {
    const tenant = await this.tenants.markCustomDomainFailed(
      id,
      body.error || 'Неизвестная ошибка',
    );
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

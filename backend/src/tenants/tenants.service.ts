// backend/src/tenants/tenants.service.ts
import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { Tenant } from './tenant.entity';
import { StaffUsersService } from '../staff/staff-users.service';
import type { StaffRole } from '../staff/staff-user.entity';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { MailService } from '../mail/mail.service';
import { ApiToken } from '../api-tokens/api-token.entity';
import { User } from '../users/user.entity';
import { Site } from '../sites/site.entity';
import { Lead } from '../leads/lead.entity';
import { StaffUser } from '../staff/staff-user.entity';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly repo: Repository<Tenant>,
    private readonly staffUsers: StaffUsersService,
    private readonly mail: MailService,
  ) {}

  /**
   * Список всех тенантов (для pl1 и т.п.)
   */
  async findAll() {
    return this.repo.find({
      order: { createdAt: 'DESC' as any },
    });
  }

  async findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * ========= Настройки компании (для /app/settings) =========
   */

  async getCompanySettings(tenantId: string) {
    const tenant = await this.repo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      clientKey: tenant.clientKey,
      logoUrl: tenant.logoUrl,
      uiLanguage: tenant.uiLanguage,
      status: tenant.status,
      plan: tenant.plan,
      apiEnabled: tenant.apiEnabled,
      activeUntil: tenant.activeUntil,
      ownerName: tenant.ownerName,
      ownerEmail: tenant.ownerEmail,
      notes: tenant.notes,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async updateCompanySettings(
    tenantId: string,
    patch: UpdateTenantSettingsDto,
  ) {
    const tenant = await this.repo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (typeof patch.name === 'string' && patch.name.trim()) {
      tenant.name = patch.name.trim();
    }

    if (patch.logoUrl !== undefined) {
      tenant.logoUrl = patch.logoUrl || null;
    }

    if (patch.uiLanguage !== undefined) {
      tenant.uiLanguage = patch.uiLanguage || null;
    }

    if (patch.plan !== undefined) {
      tenant.plan = patch.plan;
    }

    if (patch.activeUntil !== undefined) {
      tenant.activeUntil = patch.activeUntil
        ? new Date(patch.activeUntil)
        : null;
    }

    if (patch.ownerName !== undefined) {
      tenant.ownerName = patch.ownerName ? patch.ownerName.trim() : null;
    }

    if (patch.ownerEmail !== undefined) {
      tenant.ownerEmail = patch.ownerEmail ? patch.ownerEmail.trim() : null;
    }

    if (patch.apiEnabled !== undefined) {
      tenant.apiEnabled = patch.apiEnabled;
    }

    if (patch.notes !== undefined) {
      tenant.notes = patch.notes || null;
    }

    await this.repo.save(tenant);

    return {
      id: tenant.id,
      name: tenant.name,
      clientKey: tenant.clientKey,
      logoUrl: tenant.logoUrl,
      uiLanguage: tenant.uiLanguage,
      status: tenant.status,
      plan: tenant.plan,
      apiEnabled: tenant.apiEnabled,
      activeUntil: tenant.activeUntil,
      ownerName: tenant.ownerName,
      ownerEmail: tenant.ownerEmail,
      notes: tenant.notes,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  /**
   * ========= Базовое создание tenant (+ владелец) =========
   */

  async createTenant(dto: {
    name: string;
    ownerEmail: string;
    ownerFullName?: string;
    avatarUrl?: string | null;
    clientKey?: string;
    logoUrl?: string | null;
    uiLanguage?: string | null;
  }) {
    const rawKey =
      dto.clientKey?.trim() ||
      dto.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    const clientKey = rawKey || `client-${randomUUID().slice(0, 8)}`;

    const tenant = this.repo.create({
      clientKey,
      name: dto.name.trim(),
      status: 'active',
      plan: 'basic',
      logoUrl: dto.logoUrl ?? null,
      uiLanguage: dto.uiLanguage ?? 'ru',
    });

    await this.repo.save(tenant);

    const ownerTenantUser = await this.createTenantLocalUser(
      tenant.id,
      dto.ownerEmail,
      dto.ownerFullName ?? dto.ownerEmail,
      dto.avatarUrl ?? null,
    );

    await this.staffUsers.createForTenant(tenant.id, {
      email: dto.ownerEmail,
      fullName: dto.ownerFullName ?? dto.ownerEmail,
      department: 'Management',
      role: 'owner' as StaffRole,
      avatarUrl: dto.avatarUrl ?? null,
      externalId: ownerTenantUser.id,
    });

    return tenant;
  }

  /**
   * Временная «фейковая» реализация tenant_users —
   * потом заменишь на реальную таблицу.
   */
  private async createTenantLocalUser(
    tenantId: string,
    email: string,
    fullName: string,
    avatarUrl: string | null,
  ) {
    return {
      id: randomUUID(),
      tenantId,
      email,
      fullName,
      avatarUrl,
    };
  }

  /**
   * ===== Админ-операции для pl1.lumiva.agency =====
   */

  /**
   * Создание тенанта из pl1.
   */
  async platformCreateTenant(dto: {
    name: string;
    ownerEmail: string;
    ownerFullName?: string;
    clientKey?: string;
    status?: string;
    plan?: string;
    apiEnabled?: boolean;
    activeUntil?: string | null;
    ownerName?: string | null;
    notes?: string | null;
  }) {
    // 1) базовое создание + owner/staff-user
    const created = await this.createTenant({
      name: dto.name,
      ownerEmail: dto.ownerEmail,
      ownerFullName: dto.ownerFullName ?? dto.ownerName ?? dto.ownerEmail,
      clientKey: dto.clientKey,
      avatarUrl: null,
      logoUrl: null,
      uiLanguage: 'ru',
    });

    // 2) админские поля
    if (dto.status) created.status = dto.status as any;
    if (dto.plan) created.plan = dto.plan as any;
    if (typeof dto.apiEnabled === 'boolean') {
      created.apiEnabled = dto.apiEnabled;
    }
    if (dto.activeUntil !== undefined) {
      created.activeUntil = dto.activeUntil
        ? new Date(dto.activeUntil)
        : null;
    }
    if (dto.ownerName !== undefined) {
      created.ownerName = dto.ownerName;
    }
    if (dto.ownerEmail !== undefined) {
      created.ownerEmail = dto.ownerEmail;
    }
    if (dto.notes !== undefined) {
      created.notes = dto.notes;
    }

    await this.repo.save(created);

    // 3) Отправляем инвайт владельцу
    try {
      // ВАЖНО: используем PASSWORD_RESET_URL,
      // у тебя он уже есть в .env:
      // PASSWORD_RESET_URL=https://crm.lumiva.agency/set-password
      const baseUrl =
        process.env.PASSWORD_RESET_URL ||
        'https://crm.lumiva.agency/set-password';

      const fullName =
        dto.ownerFullName ?? dto.ownerName ?? dto.ownerEmail;

      // Фронтовый URL: /set-password?email=...&clientKey=...
      const inviteLink = `${baseUrl}?email=${encodeURIComponent(
        dto.ownerEmail,
      )}&clientKey=${encodeURIComponent(created.clientKey)}`;

      this.logger.log(
        `Sending owner invite to ${dto.ownerEmail} for tenant=${created.clientKey}, link=${inviteLink}`,
      );

      await this.mail.sendOwnerInviteEmail({
        to: dto.ownerEmail,
        fullName,
        tenantName: created.name,
        link: inviteLink,
      });

      this.logger.log(
        `Owner invite sent to ${dto.ownerEmail} for tenant=${created.clientKey}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send owner invite to ${dto.ownerEmail}`,
        (err as any).stack || String(err),
      );
      // Ошибку наружу не кидаем — создание тенанта не должно падать из-за SMTP
    }

    return created;
  }

  /**
   * Обновление тенанта из pl1.
   */
  async platformUpdateTenant(
    id: string,
    patch: {
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
    const tenant = await this.repo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (patch.name !== undefined && patch.name.trim()) {
      tenant.name = patch.name.trim();
    }
    if (patch.clientKey !== undefined && patch.clientKey.trim()) {
      tenant.clientKey = patch.clientKey.trim();
    }
    if (patch.status !== undefined) {
      tenant.status = patch.status as any;
    }
    if (patch.plan !== undefined) {
      tenant.plan = patch.plan as any;
    }
    if (typeof patch.apiEnabled === 'boolean') {
      tenant.apiEnabled = patch.apiEnabled;
    }
    if (patch.activeUntil !== undefined) {
      tenant.activeUntil = patch.activeUntil
        ? new Date(patch.activeUntil)
        : null;
    }
    if (patch.ownerName !== undefined) {
      tenant.ownerName = patch.ownerName;
    }
    if (patch.ownerEmail !== undefined) {
      tenant.ownerEmail = patch.ownerEmail;
    }
    if (patch.notes !== undefined) {
      tenant.notes = patch.notes;
    }

    await this.repo.save(tenant);
    return tenant;
  }

  /**
   * Удаление тенанта
   */
    /**
   * Удаление тенанта вместе со всеми связанными данными
   * (staff_users, users, sites, leads, api_tokens).
   */
  async platformDeleteTenant(id: string) {
    const tenant = await this.repo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    this.logger.log(`Deleting tenant ${id} (${tenant.clientKey}) with cascade…`);

    await this.repo.manager.transaction(async (em) => {
      // staff_users
      await em
        .createQueryBuilder()
        .delete()
        .from(StaffUser)
        .where('tenantId = :id', { id })
        .execute();

      // api_tokens
      await em
        .createQueryBuilder()
        .delete()
        .from(ApiToken)
        .where('tenantId = :id', { id })
        .execute();

      // leads
      await em
        .createQueryBuilder()
        .delete()
        .from(Lead)
        .where('tenantId = :id', { id })
        .execute();

      // sites
      await em
        .createQueryBuilder()
        .delete()
        .from(Site)
        .where('tenantId = :id', { id })
        .execute();

      // users
      await em
        .createQueryBuilder()
        .delete()
        .from(User)
        .where('tenantId = :id', { id })
        .execute();

      // сам tenant
      await em
        .createQueryBuilder()
        .delete()
        .from(Tenant)
        .where('id = :id', { id })
        .execute();
    });

    this.logger.log(`Tenant ${id} deleted successfully`);

    return { ok: true };
  }
}
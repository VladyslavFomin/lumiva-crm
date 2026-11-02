import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffUser } from '../staff/staff-user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';

export type OwnerLang = 'ru' | 'en' | 'tr';

export type TenantOwnerContact = {
  tenant: Tenant;
  lang: OwnerLang;
  /** Базовый URL CRM тенанта (свой домен, если подключён). */
  appUrl: string;
  /** Пользователи-владельцы для уведомлений в CRM. */
  ownerUserIds: string[];
};

/**
 * Кому сообщать о проблемах с подключениями: владелец тенанта (ownerEmail — письмом,
 * staff с ролью owner — уведомлением в CRM). Общий для напоминаний о токенах и о сбоях синхронизации.
 */
@Injectable()
export class IntegrationOwnerNotifier {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(StaffUser) private readonly staff: Repository<StaffUser>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async resolve(tenantId: string): Promise<TenantOwnerContact | null> {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) return null;
    const l = (tenant.uiLanguage || 'ru').slice(0, 2);
    const lang: OwnerLang = l === 'en' || l === 'tr' ? l : 'ru';
    const host = tenant.customDomainStatus === 'active' && tenant.customDomain ? tenant.customDomain : 'crm.lumiva.agency';

    const owners = await this.staff.find({ where: { tenantId, role: 'owner' } });
    const emails = new Set(owners.map((o) => o.email?.trim().toLowerCase()).filter((e): e is string => !!e));
    let ownerUserIds: string[] = [];
    if (emails.size) {
      const users = await this.users.find({ where: { tenantId } });
      ownerUserIds = users.filter((u) => emails.has(u.email?.trim().toLowerCase())).map((u) => u.id);
    }
    return { tenant, lang, appUrl: `https://${host}/app`, ownerUserIds };
  }
}

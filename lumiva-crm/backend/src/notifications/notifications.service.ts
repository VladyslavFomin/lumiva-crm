import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InAppNotification } from './in-app-notification.entity';
import { StaffUser } from '../staff/staff-user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(InAppNotification)
    private readonly repo: Repository<InAppNotification>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  async create(
    tenantId: string,
    userIds: string[],
    title: string | null,
    body: string,
    meta?: any,
  ): Promise<InAppNotification[]> {
    const uniqueUserIds = [...new Set(userIds.map((id) => String(id || '').trim()).filter(Boolean))];
    if (!uniqueUserIds.length) return [];
    const records = uniqueUserIds.map((userId) =>
      this.repo.create({ tenantId, userId, title, body, meta: meta || null, isRead: false }),
    );
    return this.repo.save(records);
  }

  async findForUser(
    tenantId: string,
    userId: string,
    limit = 50,
    onlyUnread = false,
    userEmail?: string,
  ): Promise<{ items: InAppNotification[]; unread: number }> {
    const userIds = await this.resolveUserIdAliases(tenantId, userId, userEmail);
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere('n.userId IN (:...userIds)', { userIds })
      .orderBy('n.createdAt', 'DESC')
      .limit(limit);

    if (onlyUnread) qb.andWhere('n.isRead = false');

    const [items, unread] = await Promise.all([
      qb.getMany(),
      this.repo.count({ where: { tenantId, userId: In(userIds), isRead: false } }),
    ]);

    return { items, unread };
  }

  async markRead(
    tenantId: string,
    userId: string,
    id: string,
    userEmail?: string,
  ): Promise<void> {
    const userIds = await this.resolveUserIdAliases(tenantId, userId, userEmail);
    await this.repo.update({ id, tenantId, userId: In(userIds) }, { isRead: true });
  }

  async markAllRead(
    tenantId: string,
    userId: string,
    userEmail?: string,
  ): Promise<void> {
    const userIds = await this.resolveUserIdAliases(tenantId, userId, userEmail);
    await this.repo.update(
      { tenantId, userId: In(userIds), isRead: false },
      { isRead: true },
    );
  }

  private async resolveUserIdAliases(
    tenantId: string,
    userId: string,
    userEmail?: string,
  ): Promise<string[]> {
    const ids = new Set([userId]);
    const email = userEmail?.trim().toLowerCase();
    const conditions = ['staff.externalId = :userId'];
    const params: Record<string, string> = { tenantId, userId };

    if (email) {
      conditions.push('LOWER(staff.email) = :email');
      params.email = email;
    }

    const staffRows = await this.staffRepo
      .createQueryBuilder('staff')
      .select(['staff.id'])
      .where('staff.tenantId = :tenantId', { tenantId })
      .andWhere(`(${conditions.join(' OR ')})`, params)
      .getMany();

    staffRows.forEach((staff) => ids.add(staff.id));
    return [...ids];
  }
}

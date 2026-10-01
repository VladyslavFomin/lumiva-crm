import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './lead.entity';
import { LeadsService } from './leads.service';

/** Сколько дней лид лежит в корзине до автоматического удаления (см. /leads/trash). Архив не чистится. */
export const LEADS_TRASH_TTL_DAYS = 30;

@Injectable()
export class LeadsTrashPurgeService {
  private readonly logger = new Logger(LeadsTrashPurgeService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepo: Repository<Lead>,
    private readonly leadsService: LeadsService,
  ) {}

  @Cron('17 3 * * *')
  async purgeExpiredTrash() {
    // Только лиды с валидным meta.deletedAt — без даты не знаем, когда истекает срок.
    const expired: Array<{ id: string; tenant_id: string }> = await this.leadsRepo.query(
      `SELECT id, tenant_id FROM leads
        WHERE deleted_at IS NULL
          AND (COALESCE(meta::jsonb, '{}'::jsonb) @> '{"deleted":true}'::jsonb
               OR COALESCE(meta::jsonb, '{}'::jsonb) @> '{"deleted":"true"}'::jsonb)
          AND meta::jsonb->>'deletedAt' ~ '^\\d{4}-\\d{2}-\\d{2}'
          AND (meta::jsonb->>'deletedAt')::timestamptz < now() - ($1 || ' days')::interval`,
      [String(LEADS_TRASH_TTL_DAYS)],
    );
    if (!expired.length) return;

    let removed = 0;
    for (const row of expired) {
      try {
        await this.leadsService.removeForTenant(row.tenant_id, row.id);
        removed++;
      } catch (e) {
        // Лиды с привязанными продажами/проектами удалить нельзя — остаются в корзине.
        this.logger.warn(`Trash purge skipped lead ${row.id}: ${(e as Error).message}`);
      }
    }
    this.logger.log(`Trash purge: removed ${removed}/${expired.length} leads older than ${LEADS_TRASH_TTL_DAYS} days`);
  }
}

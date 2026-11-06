import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ADAPTERS, type MediaItem, type Network } from './content-adapters';
import { ContentService, pgRows } from './content.service';

/** Паузы между попытками публикации (мин): 5 → 15 → 60, дальше — «ошибка». */
const RETRY_MIN = [5, 15, 60];

/**
 * Единая очередь публикаций: раз в минуту берёт варианты «пост × канал» со статусом scheduled и
 * наступившим временем и отдаёт адаптеру сети. Раз в час собирает метрики опубликованного за 30 дней.
 */
@Injectable()
export class ContentPublisherService {
  private readonly log = new Logger(ContentPublisherService.name);
  private running = false;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly content: ContentService,
  ) {}

  private async q(sql: string, params: unknown[] = []): Promise<any[]> {
    return pgRows(await this.db.query(sql, params));
  }

  @Cron('* * * * *')
  async tick(): Promise<number> {
    if (this.running || process.env.CONTENT_PUBLISHER_OFF === '1') return 0;
    this.running = true;
    try {
      // атомарно «забираем» варианты: два процесса не опубликуют один пост дважды
      const due: any[] = await this.q(
        `UPDATE content_variants v SET status = 'publishing', updated_at = now()
          WHERE v.id IN (
            SELECT v2.id FROM content_variants v2 JOIN content_channels c ON c.id = v2.channel_id
             WHERE v2.status = 'scheduled' AND v2.publish_at <= now() AND (v2.next_attempt_at IS NULL OR v2.next_attempt_at <= now()) AND c.enabled
             ORDER BY v2.publish_at LIMIT 20 FOR UPDATE SKIP LOCKED)
          RETURNING v.*`,
      );
      for (const v of due) {
        try {
          await this.publishOne(v);
        } catch (e) {
          // неожиданная ошибка не должна оставить вариант навсегда в «публикуется»
          const err = String((e as Error)?.message || e).slice(0, 1000);
          this.log.error(`publish variant ${v.id} crashed: ${err}`, (e as Error)?.stack);
          await this.q(`UPDATE content_variants SET status = 'failed', error = $2, attempts = attempts + 1, updated_at = now() WHERE id = $1 AND status = 'publishing'`, [v.id, err]).catch(() => undefined);
          await this.content.refreshPostStatus(v.post_id).catch(() => undefined);
        }
      }
      // зависшие после рестарта процесса: повтор мог бы задвоить пост, поэтому — «ошибка», решает человек
      const stuck: any[] = await this.q(
        `UPDATE content_variants SET status = 'failed', error = 'interrupted while publishing — check the channel before retrying', updated_at = now()
          WHERE status = 'publishing' AND updated_at < now() - interval '15 minutes' RETURNING post_id`,
      );
      for (const r of stuck) await this.content.refreshPostStatus(r.post_id).catch(() => undefined);
      return due.length;
    } finally {
      this.running = false;
    }
  }

  async publishOne(v: any) {
    const [post] = await this.q(`SELECT * FROM content_posts WHERE id = $1`, [v.post_id]);
    const [channel] = await this.q(`SELECT * FROM content_channels WHERE id = $1`, [v.channel_id]);
    if (!post || !channel) return;
    // опоздание больше суток (канал был выключен) — задним числом не публикуем
    if (new Date(v.publish_at).getTime() < Date.now() - 86_400_000) {
      await this.q(`UPDATE content_variants SET status = 'skipped', error = 'missed by more than 24h', updated_at = now() WHERE id = $1`, [v.id]);
      await this.content.refreshPostStatus(post.id);
      return;
    }
    // лимит постов в день на канал
    const limit = Number(channel.rules?.dailyLimit || 0);
    if (limit > 0) {
      const [n] = await this.q(`SELECT count(*)::int n FROM content_variants WHERE channel_id = $1 AND status = 'published' AND published_at > now() - interval '24 hours'`, [channel.id]);
      if (n.n >= limit) {
        await this.q(`UPDATE content_variants SET status = 'scheduled', next_attempt_at = now() + interval '1 hour' WHERE id = $1`, [v.id]);
        return;
      }
    }
    const adapter = ADAPTERS[channel.network as Network];
    const signature = channel.rules?.signature ? `\n\n${channel.rules.signature}` : '';
    const hashtags = channel.rules?.hashtags ? `\n\n${channel.rules.hashtags}` : '';
    const input = {
      text: `${(v.text || post.text || '').trim()}${signature}${hashtags}`.trim(),
      media: ((post.media || []) as MediaItem[]).filter((m) => m.approved !== false),
      format: post.format,
    };
    const invalid = adapter.validate(input);
    try {
      if (invalid) throw new Error(invalid);
      const creds = await this.content.credentialsFor(channel);
      const r = await adapter.publish(input, creds);
      await this.q(
        `UPDATE content_variants SET status = 'published', external_id = $2, url = $3, error = NULL, published_at = now(), attempts = attempts + 1, updated_at = now() WHERE id = $1`,
        [v.id, r.externalId || null, r.url],
      );
      if (channel.status !== 'ok') await this.q(`UPDATE content_channels SET status = 'ok', last_error = NULL WHERE id = $1`, [channel.id]);
    } catch (e) {
      const err = String((e as Error).message || e).slice(0, 1000);
      const attempts = Number(v.attempts || 0) + 1;
      // ошибка проверки поста или доступа не исправится повтором — сразу «ошибка»
      const permanent = !!invalid || /expired|переподключ|reconnect|permission|not authorized|unauthorized|forbidden|bot was kicked|chat not found|not enough rights|OAuthException|#10|#200|удалён/i.test(err);
      if (!permanent && attempts <= RETRY_MIN.length) {
        await this.q(`UPDATE content_variants SET status = 'scheduled', attempts = $2, error = $3, next_attempt_at = now() + ($4 || ' minutes')::interval, updated_at = now() WHERE id = $1`, [v.id, attempts, err, String(RETRY_MIN[attempts - 1])]);
      } else {
        await this.q(`UPDATE content_variants SET status = 'failed', attempts = $2, error = $3, updated_at = now() WHERE id = $1`, [v.id, attempts, err]);
        if (/expired|переподключ|reconnect|permission|not authorized|unauthorized|forbidden|bot was kicked|chat not found|not enough rights|OAuthException/i.test(err)) {
          await this.q(`UPDATE content_channels SET status = 'error', last_error = $2 WHERE id = $1`, [channel.id, err.slice(0, 500)]);
          this.content.invalidateCreds(channel.id);
        }
      }
      this.log.warn(`publish variant ${v.id} (${channel.network}) failed: ${err}`);
    }
    await this.content.refreshPostStatus(post.id);
  }

  @Cron('17 * * * *')
  async syncMetrics(): Promise<number> {
    if (process.env.CONTENT_PUBLISHER_OFF === '1') return 0;
    const rows: any[] = await this.q(
      `SELECT c.*, v.id vid, v.external_id ext FROM content_variants v JOIN content_channels c ON c.id = v.channel_id
        WHERE v.status = 'published' AND v.external_id IS NOT NULL AND v.published_at > now() - interval '30 days'
          AND (v.metrics_at IS NULL OR v.metrics_at < now() - interval '3 hours') ORDER BY v.metrics_at NULLS FIRST LIMIT 100`,
    );
    let n = 0;
    for (const r of rows) {
      const adapter = ADAPTERS[r.network as Network];
      if (!adapter.metrics) continue;
      try {
        const creds = await this.content.credentialsFor(r);
        const m = await adapter.metrics(r.ext, creds);
        await this.q(`UPDATE content_variants SET metrics = COALESCE($2::jsonb, metrics), metrics_at = now() WHERE id = $1`, [r.vid, m ? JSON.stringify(m) : null]);
        n++;
      } catch (e) {
        await this.q(`UPDATE content_variants SET metrics_at = now() WHERE id = $1`, [r.vid]);
        this.log.warn(`metrics ${r.vid}: ${(e as Error).message}`);
      }
    }
    return n;
  }
}

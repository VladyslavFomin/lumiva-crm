import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InstagramAccount } from '../instagram-crm/instagram-account.entity';
import { TelegramBot } from '../telegram-crm/telegram-bot.entity';
import { IntegrationOwnerNotifier, OwnerLang } from './integration-owner-notifier.service';
import { MarketingIntegration } from './marketing-integration.entity';

/** Маркетинговые источники синхронизируются раз в сутки — дольше 2 суток без синка = данные устарели. */
const STALE_MS = 48 * 3600e3;
const SOON_MS = 7 * 864e5;

export type IntegrationHealthStatus = 'ok' | 'error' | 'stale' | 'never' | 'expiring' | 'expired';

export type IntegrationHealthItem = {
  source: 'marketing' | 'connection' | 'telegram' | 'instagram';
  id: string;
  name: string;
  /** provider для marketing, catalogId/kind для connection, 'telegram' для бота */
  provider: string;
  status: IntegrationHealthStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Начало текущей серии ошибок (если известно) */
  since: string | null;
  /** Окончание доступа (Meta) */
  tokenExpiresAt: string | null;
  /** Куда вести пользователя для исправления (путь внутри /app) */
  link: string;
};

const PROBLEM: IntegrationHealthStatus[] = ['error', 'stale', 'expired', 'expiring'];

const COPY: Record<OwnerLang, { title: (n: number, name: string) => string; body: (names: string) => string }> = {
  ru: {
    title: (n, name) => (n === 1 ? `Подключение «${name}» не работает` : `Не работают подключения: ${n}`),
    body: (names) => `Последняя синхронизация завершилась ошибкой, данные не обновляются: ${names}. Откройте «Интеграции», чтобы переподключить.`,
  },
  en: {
    title: (n, name) => (n === 1 ? `Connection “${name}” is not working` : `${n} connections are not working`),
    body: (names) => `The last sync ended with an error, data is not updating: ${names}. Open Integrations to reconnect.`,
  },
  tr: {
    title: (n, name) => (n === 1 ? `“${name}” bağlantısı çalışmıyor` : `${n} bağlantı çalışmıyor`),
    body: (names) => `Son senkronizasyon hatayla bitti, veriler güncellenmiyor: ${names}. Yeniden bağlamak için Entegrasyonlar’ı açın.`,
  },
};

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

function catalogIdOf(c: IntegrationConnection): string | null {
  if (!c.configJson) return null;
  try {
    const id = (JSON.parse(c.configJson) as { catalogId?: unknown })?.catalogId;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}

/**
 * Состояние всех подключений тенанта в одном месте (баннер и бейджи в «Интеграциях»)
 * + раз в час: владельцу письмо и уведомление о новых сбоях — один раз на серию ошибок,
 * повторно только после того, как подключение снова заработало и опять сломалось.
 */
@Injectable()
export class IntegrationHealthService {
  private readonly log = new Logger(IntegrationHealthService.name);

  constructor(
    @InjectRepository(MarketingIntegration) private readonly marketing: Repository<MarketingIntegration>,
    @InjectRepository(IntegrationConnection) private readonly connections: Repository<IntegrationConnection>,
    @InjectRepository(TelegramBot) private readonly bots: Repository<TelegramBot>,
    @InjectRepository(InstagramAccount) private readonly igAccounts: Repository<InstagramAccount>,
    private readonly ownerNotifier: IntegrationOwnerNotifier,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  marketingStatus(row: MarketingIntegration, now = Date.now()): { status: IntegrationHealthStatus; tokenExpiresAt: string | null } {
    const exp = typeof row.settings?.tokenExpiresAt === 'string' ? Date.parse(row.settings.tokenExpiresAt) : NaN;
    const tokenExpiresAt = Number.isFinite(exp) ? new Date(exp).toISOString() : null;
    if (Number.isFinite(exp) && exp <= now) return { status: 'expired', tokenExpiresAt };
    if (row.lastSyncStatus === 'error') return { status: 'error', tokenExpiresAt };
    if (!row.lastSyncAt) return { status: 'never', tokenExpiresAt };
    if (now - new Date(row.lastSyncAt).getTime() > STALE_MS) return { status: 'stale', tokenExpiresAt };
    if (Number.isFinite(exp) && exp - now <= SOON_MS) return { status: 'expiring', tokenExpiresAt };
    return { status: 'ok', tokenExpiresAt };
  }

  async getTenantHealth(tenantId: string): Promise<{ items: IntegrationHealthItem[]; problems: number }> {
    const now = Date.now();
    const items: IntegrationHealthItem[] = [];

    const mRows = await this.marketing.find({ where: { tenantId, isActive: true }, order: { createdAt: 'ASC' } });
    for (const r of mRows) {
      const { status, tokenExpiresAt } = this.marketingStatus(r, now);
      items.push({
        source: 'marketing',
        id: r.id,
        name: r.name,
        provider: r.provider,
        status,
        lastSyncAt: iso(r.lastSyncAt),
        lastError: r.lastError,
        since: iso(r.failingSince),
        tokenExpiresAt,
        link: '/integrations-hub?tab=marketing',
      });
    }

    const cRows = await this.connections.find({ where: { tenantId, isEnabled: true, isDeleted: false }, order: { createdAt: 'ASC' } });
    for (const c of cRows) {
      const status: IntegrationHealthStatus =
        c.lastSyncStatus === 'error' ? 'error' : c.lastSyncStatus === 'ok' ? 'ok' : 'never';
      items.push({
        source: 'connection',
        id: c.id,
        name: c.name,
        provider: catalogIdOf(c) || c.kind,
        status,
        lastSyncAt: iso(c.lastSyncAt),
        lastError: c.lastError,
        since: null,
        tokenExpiresAt: null,
        link: '/integrations-hub',
      });
    }

    const bots = await this.bots.find({ where: { tenantId, status: In(['active', 'error']) } });
    for (const b of bots) {
      items.push({
        source: 'telegram',
        id: b.id,
        name: b.botUsername ? `@${b.botUsername}` : b.botName || 'Telegram',
        provider: 'telegram',
        status: b.status === 'error' ? 'error' : 'ok',
        lastSyncAt: iso(b.lastSyncAt),
        lastError: b.status === 'error' ? b.lastError : null,
        since: null,
        tokenExpiresAt: null,
        link: '/telegram',
      });
    }

    const igs = await this.igAccounts.find({ where: { tenantId, status: In(['active', 'error']) }, order: { createdAt: 'ASC' } });
    for (const a of igs) {
      items.push({
        source: 'instagram',
        id: a.id,
        name: a.igUsername ? `Instagram @${a.igUsername}` : 'Instagram',
        provider: 'instagram',
        status: a.status === 'error' ? 'error' : 'ok',
        lastSyncAt: iso(a.lastEventAt),
        lastError: a.status === 'error' ? a.lastError : null,
        since: null,
        tokenExpiresAt: null,
        link: '/instagram',
      });
    }

    return { items, problems: items.filter((i) => PROBLEM.includes(i.status)).length };
  }

  /** Раз в час: новые сбои → владельцу. Истёкший токен Meta не дублируем — о нём пишет IntegrationTokenExpiryScheduler. */
  @Cron('40 * * * *')
  async notifyNewFailures(): Promise<void> {
    const now = Date.now();
    // подключение снова в порядке → следующая поломка снова даст уведомление
    await this.connections.update({ lastSyncStatus: Not('error'), healthNotifiedAt: Not(IsNull()) }, { healthNotifiedAt: null });

    const byTenant = new Map<string, { name: string; error: string | null; mark: () => Promise<unknown> }[]>();
    const push = (tenantId: string, v: { name: string; error: string | null; mark: () => Promise<unknown> }) => {
      const list = byTenant.get(tenantId) ?? [];
      list.push(v);
      byTenant.set(tenantId, list);
    };

    const mFailed = await this.marketing.find({ where: { isActive: true, lastSyncStatus: 'error', healthNotifiedAt: IsNull() } });
    for (const r of mFailed) {
      if (this.marketingStatus(r, now).status === 'expired') continue;
      push(r.tenantId, {
        name: r.name,
        error: r.lastError,
        mark: () => this.marketing.update({ id: r.id }, { healthNotifiedAt: new Date() }),
      });
    }

    const cFailed = await this.connections.find({
      where: { isEnabled: true, isDeleted: false, lastSyncStatus: 'error', healthNotifiedAt: IsNull() },
    });
    for (const c of cFailed) {
      push(c.tenantId, {
        name: c.name,
        error: c.lastError,
        mark: () => this.connections.update({ id: c.id }, { healthNotifiedAt: new Date() }),
      });
    }

    await this.igAccounts.update({ status: Not('error'), healthNotifiedAt: Not(IsNull()) }, { healthNotifiedAt: null });
    const igFailed = await this.igAccounts.find({ where: { status: 'error', healthNotifiedAt: IsNull() } });
    for (const a of igFailed) {
      push(a.tenantId, {
        name: a.igUsername ? `Instagram @${a.igUsername}` : 'Instagram',
        error: a.lastError,
        mark: () => this.igAccounts.update({ id: a.id }, { healthNotifiedAt: new Date() }),
      });
    }

    for (const [tenantId, list] of byTenant) {
      try {
        const owner = await this.ownerNotifier.resolve(tenantId);
        if (owner) {
          const { tenant, lang } = owner;
          if (tenant.ownerEmail) {
            await this.mail
              .sendIntegrationFailureEmail({
                to: tenant.ownerEmail,
                uiLanguage: tenant.uiLanguage,
                items: list.map(({ name, error }) => ({ name, error })),
                url: `${owner.appUrl}/integrations-hub`,
              })
              .catch((e) => this.log.error(`Integration failure email failed for ${tenantId}: ${(e as Error)?.message}`));
          }
          if (owner.ownerUserIds.length) {
            const c = COPY[lang];
            await this.notifications.create(
              tenantId,
              owner.ownerUserIds,
              c.title(list.length, list[0].name),
              c.body(list.map((i) => `«${i.name}»`).join(', ')),
              { type: 'integration.sync_failed', link: '/integrations-hub' },
            );
          }
        }
        // помечаем даже без владельца — иначе каждый час одно и то же
        for (const i of list) await i.mark();
        this.log.log(`Integration failure notice: tenant ${tenantId}, ${list.length} item(s)`);
      } catch (e) {
        this.log.error(`Integration failure notice failed for ${tenantId}`, (e as Error)?.stack || String(e));
      }
    }
  }
}

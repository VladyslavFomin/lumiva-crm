import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { IntegrationOwnerNotifier, OwnerLang } from './integration-owner-notifier.service';
import { MarketingGa4Host } from './marketing-ga4-host.entity';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingService } from './marketing.service';

type Alert = Awaited<ReturnType<MarketingService['getGa4HostBreakdown']>>['alerts'][number];

const COPY: Record<OwnerLang, { title: (n: number) => string; line: (a: Alert, property: string) => string }> = {
  ru: {
    title: (n) => (n === 1 ? 'Выручка с сайта не поступает' : `Выручка с сайтов не поступает: ${n}`),
    line: (a, p) =>
      a.type === 'revenue_stopped'
        ? `${p} · ${a.host}: последняя покупка ${a.lastRevenueDate}, с тех пор ${a.sessionsSince} визитов без выручки`
        : a.type === 'purchases_without_value'
          ? `${p} · ${a.host}: покупки приходят без суммы (${a.purchases} за 14 дней)`
          : `${p}: за 90 дней ни одной покупки при ${a.sessions} визитах`,
  },
  en: {
    title: (n) => (n === 1 ? 'Site revenue is not coming in' : `Site revenue is not coming in: ${n}`),
    line: (a, p) =>
      a.type === 'revenue_stopped'
        ? `${p} · ${a.host}: last purchase on ${a.lastRevenueDate}, ${a.sessionsSince} visits without revenue since`
        : a.type === 'purchases_without_value'
          ? `${p} · ${a.host}: purchases arrive without value (${a.purchases} in 14 days)`
          : `${p}: no purchases in 90 days with ${a.sessions} visits`,
  },
  tr: {
    title: (n) => (n === 1 ? 'Site geliri gelmiyor' : `Site geliri gelmiyor: ${n}`),
    line: (a, p) =>
      a.type === 'revenue_stopped'
        ? `${p} · ${a.host}: son satın alma ${a.lastRevenueDate}, o zamandan beri gelirsiz ${a.sessionsSince} ziyaret`
        : a.type === 'purchases_without_value'
          ? `${p} · ${a.host}: satın almalar tutarsız geliyor (14 günde ${a.purchases})`
          : `${p}: ${a.sessions} ziyarete rağmen 90 günde hiç satın alma yok`,
  },
};

const keyOf = (a: Alert) => `${a.type}|${a.dataSource}|${a.host ?? ''}`;

/**
 * Каждое утро после ночной синхронизации: новые сигналы GA4 «выручка пропала / без суммы / покупок нет»
 * → уведомление владельцу в CRM. Уже отправленные ключи хранятся в settings.ga4RevenueAlertKeys
 * GA4-интеграции; когда сигнал уходит, ключ удаляется — повторная поломка снова даст уведомление.
 */
@Injectable()
export class Ga4RevenueAlertsScheduler {
  private readonly log = new Logger(Ga4RevenueAlertsScheduler.name);

  constructor(
    private readonly marketing: MarketingService,
    private readonly ownerNotifier: IntegrationOwnerNotifier,
    private readonly notifications: NotificationsService,
    @InjectRepository(MarketingGa4Host) private readonly hosts: Repository<MarketingGa4Host>,
    @InjectRepository(MarketingIntegration) private readonly integrations: Repository<MarketingIntegration>,
  ) {}

  @Cron('30 4 * * *')
  async notifyNewRevenueAlerts(): Promise<void> {
    const tenants = (await this.hosts.createQueryBuilder('h').select('DISTINCT h.tenantId', 'tenantId').getRawMany()) as { tenantId: string }[];
    for (const { tenantId } of tenants) {
      try {
        await this.processTenant(tenantId);
      } catch (e) {
        this.log.error(`GA4 revenue alerts failed for ${tenantId}`, (e as Error)?.stack || String(e));
      }
    }
  }

  private async processTenant(tenantId: string): Promise<void> {
    const { alerts, dataSourceLabels } = await this.marketing.getGa4HostBreakdown(tenantId);
    const ga4 = (await this.integrations.find({ where: { tenantId, isActive: true } })).filter((r) => /^\d+$/.test(String(r.primaryId || '')) && String(r.provider).includes('analytics'));
    const fresh: Alert[] = [];
    for (const row of ga4) {
      const ds = `ga4_${row.primaryId}`;
      const current = alerts.filter((a) => a.dataSource === ds);
      const settings = (row.settings && typeof row.settings === 'object' ? row.settings : {}) as Record<string, unknown>;
      const sent = new Set(Array.isArray(settings.ga4RevenueAlertKeys) ? (settings.ga4RevenueAlertKeys as string[]) : []);
      const next = current.map(keyOf);
      fresh.push(...current.filter((a) => !sent.has(keyOf(a))));
      if (next.length !== sent.size || next.some((k) => !sent.has(k))) {
        await this.integrations.update({ id: row.id }, { settings: { ...settings, ga4RevenueAlertKeys: next } as any });
      }
    }
    if (!fresh.length) return;
    const owner = await this.ownerNotifier.resolve(tenantId);
    if (!owner?.ownerUserIds.length) return;
    const c = COPY[owner.lang];
    await this.notifications.create(
      tenantId,
      owner.ownerUserIds,
      c.title(fresh.length),
      fresh.map((a) => c.line(a, dataSourceLabels[a.dataSource] || a.dataSource)).join('; '),
      { type: 'marketing.ga4_revenue_alert', link: '/marketing/traffic' },
    );
    this.log.log(`GA4 revenue alerts: tenant ${tenantId}, ${fresh.length} new`);
  }
}

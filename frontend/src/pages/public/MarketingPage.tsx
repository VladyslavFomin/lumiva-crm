import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

type ChannelRow = {
  name: string;
  share: number;
  cpl: string;
  roas: string;
};

export default function MarketingPage() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2) as 'ru' | 'en' | 'tr';

  const text =
    lang === 'en'
      ? {
          title: 'Marketing analytics and SEO tracking',
          subtitle:
            'We build a single analytics layer around each company: channels, SEO visibility, paid traffic quality, attribution and pipeline impact.',
          heroTitle: 'Marketing decisions based on numbers, not assumptions',
          heroBody:
            'Lumiva combines ad platforms, web analytics, SEO metrics and CRM outcomes in one model. Teams see where budget creates qualified demand and which campaigns should be scaled.',
          heroTags: ['SEO + Paid + CRM in one model', 'Channel-level attribution', 'Operational alerts and monitoring'],
          cta: 'Request marketing analytics demo',
          kpiTitle: 'Core marketing KPI snapshot',
          seoTitle: 'SEO and content performance',
          seoClusters: [
            { name: 'Commercial pages', visibility: 78, traffic: '+41%' },
            { name: 'Blog and guides', visibility: 64, traffic: '+29%' },
            { name: 'Local intent pages', visibility: 71, traffic: '+36%' },
          ],
          funnelTitle: 'Demand funnel monitored by marketing + sales',
          funnelStages: [
            { stage: 'Sessions', value: '124K', delta: '+18%' },
            { stage: 'Leads', value: '9.4K', delta: '+22%' },
            { stage: 'SQL', value: '2.6K', delta: '+17%' },
            { stage: 'Won deals', value: '612', delta: '+15%' },
          ],
          channelsTitle: 'Channel efficiency and budget quality',
          channels: [
            { name: 'Google Search', share: 82, cpl: '€14.2', roas: '4.8x' },
            { name: 'Meta Ads', share: 69, cpl: '€11.8', roas: '3.9x' },
            { name: 'SEO Organic', share: 76, cpl: '€6.1', roas: '8.2x' },
            { name: 'YouTube', share: 51, cpl: '€17.4', roas: '2.7x' },
          ] as ChannelRow[],
          compareTitle: 'Lumiva marketing analytics vs fragmented reporting',
          compareMetric: 'Metric',
          compareLumiva: 'Lumiva model',
          compareTypical: 'Typical setup',
          compareRows: [
            { metric: 'Attribution depth', lumiva: 'Touchpoints linked to pipeline and revenue', typical: 'Clicks and sessions only' },
            { metric: 'SEO + paid alignment', lumiva: 'One dashboard with shared KPI targets', typical: 'Separate reports by team' },
            { metric: 'Monitoring speed', lumiva: 'Daily anomalies and automatic alerts', typical: 'Manual checks once per week' },
          ],
          faqTitle: 'FAQ',
          faq: [
            { q: 'Do you work only with ad channels?', a: 'No. We include SEO, content, social, referral and direct traffic in one performance model.' },
            { q: 'Can we track campaign impact on deals, not only leads?', a: 'Yes. We connect marketing sources with deal stages and revenue events inside CRM.' },
            { q: 'How does monitoring work?', a: 'The system tracks key thresholds (CPL, conversion, ROAS, visibility) and flags deviations for quick response.' },
          ],
        }
      : lang === 'tr'
        ? {
            title: 'Pazarlama analitiği ve SEO takibi',
            subtitle:
              'Her şirket için tek bir analitik katman kuruyoruz: kanal performansı, SEO görünürlüğü, ücretli trafik kalitesi, atıf ve satış hunisine etki.',
            heroTitle: 'Pazarlama kararları varsayımlarla değil verilerle alınır',
            heroBody:
              'Lumiva; reklam platformlarını, web analitiğini, SEO metriklerini ve CRM sonuçlarını tek modelde birleştirir. Ekipler bütçenin hangi noktada kaliteli talep ürettiğini net görür.',
            heroTags: ['SEO + ücretli trafik + CRM tek model', 'Kanal bazlı atıf', 'Operasyonel izleme ve uyarılar'],
            cta: 'Pazarlama analitiği demosu iste',
            kpiTitle: 'Temel pazarlama KPI görünümü',
            seoTitle: 'SEO ve içerik performansı',
            seoClusters: [
              { name: 'Ticari sayfalar', visibility: 78, traffic: '+41%' },
              { name: 'Blog ve rehberler', visibility: 64, traffic: '+29%' },
              { name: 'Yerel niyet sayfaları', visibility: 71, traffic: '+36%' },
            ],
            funnelTitle: 'Pazarlama + satış tarafından izlenen talep hunisi',
            funnelStages: [
              { stage: 'Oturum', value: '124K', delta: '+18%' },
              { stage: 'Lead', value: '9.4K', delta: '+22%' },
              { stage: 'SQL', value: '2.6K', delta: '+17%' },
              { stage: 'Kazanılan satış', value: '612', delta: '+15%' },
            ],
            channelsTitle: 'Kanal verimliliği ve bütçe kalitesi',
            channels: [
              { name: 'Google Search', share: 82, cpl: '€14.2', roas: '4.8x' },
              { name: 'Meta Ads', share: 69, cpl: '€11.8', roas: '3.9x' },
              { name: 'SEO Organic', share: 76, cpl: '€6.1', roas: '8.2x' },
              { name: 'YouTube', share: 51, cpl: '€17.4', roas: '2.7x' },
            ] as ChannelRow[],
            compareTitle: 'Lumiva pazarlama analitiği ve parçalı raporlama',
            compareMetric: 'Metrik',
            compareLumiva: 'Lumiva modeli',
            compareTypical: 'Tipik kurulum',
            compareRows: [
              { metric: 'Atıf derinliği', lumiva: 'Temaslar satış hunisi ve gelirle bağlı', typical: 'Sadece tıklama ve oturum' },
              { metric: 'SEO + ücretli kanal hizası', lumiva: 'Ortak KPI hedefli tek panel', typical: 'Ekip bazlı ayrı raporlar' },
              { metric: 'İzleme hızı', lumiva: 'Günlük anomali ve otomatik uyarı', typical: 'Haftalık manuel kontrol' },
            ],
            faqTitle: 'SSS',
            faq: [
              { q: 'Sadece reklam kanallarıyla mı çalışıyorsunuz?', a: 'Hayır. SEO, içerik, sosyal, referral ve direct trafiği tek performans modelinde birleştiriyoruz.' },
              { q: 'Kampanyaların etkisini sadece lead değil satışta da izleyebilir miyiz?', a: 'Evet. Kaynakları CRM içindeki aşamalar ve gelir olaylarıyla eşliyoruz.' },
              { q: 'İzleme nasıl çalışıyor?', a: 'CPL, dönüşüm, ROAS ve görünürlük eşikleri sürekli izlenir; sapmalar otomatik işaretlenir.' },
            ],
          }
        : {
            title: 'Маркетинг и SEO-аналитика',
            subtitle:
              'Строим единую аналитическую модель вокруг компании: реклама, SEO, контент, атрибуция, вклад каналов в SQL, сделки и выручку.',
            heroTitle: 'Маркетинг-решения на основе цифр, а не гипотез',
            heroBody:
              'Lumiva объединяет рекламные кабинеты, веб-аналитику, SEO-метрики и CRM-результаты в одном дашборде. Команда видит, какие каналы дают качественный спрос и где масштабировать бюджет.',
            heroTags: ['SEO + реклама + CRM в одной модели', 'Сквозная атрибуция по каналам', 'Мониторинг и алерты по метрикам'],
            cta: 'Запросить демо маркетинг-аналитики',
            kpiTitle: 'Ключевые KPI маркетинга',
            seoTitle: 'SEO и контент-производительность',
            seoClusters: [
              { name: 'Коммерческие страницы', visibility: 78, traffic: '+41%' },
              { name: 'Блог и экспертный контент', visibility: 64, traffic: '+29%' },
              { name: 'Локальные страницы спроса', visibility: 71, traffic: '+36%' },
            ],
            funnelTitle: 'Воронка спроса под контролем маркетинга и продаж',
            funnelStages: [
              { stage: 'Сессии', value: '124K', delta: '+18%' },
              { stage: 'Лиды', value: '9.4K', delta: '+22%' },
              { stage: 'SQL', value: '2.6K', delta: '+17%' },
              { stage: 'Выигранные сделки', value: '612', delta: '+15%' },
            ],
            channelsTitle: 'Эффективность каналов и качество бюджета',
            channels: [
              { name: 'Google Search', share: 82, cpl: '€14.2', roas: '4.8x' },
              { name: 'Meta Ads', share: 69, cpl: '€11.8', roas: '3.9x' },
              { name: 'SEO Organic', share: 76, cpl: '€6.1', roas: '8.2x' },
              { name: 'YouTube', share: 51, cpl: '€17.4', roas: '2.7x' },
            ] as ChannelRow[],
            compareTitle: 'Аналитика Lumiva vs разрозненная отчетность',
            compareMetric: 'Метрика',
            compareLumiva: 'Модель Lumiva',
            compareTypical: 'Типичный подход',
            compareRows: [
              { metric: 'Глубина атрибуции', lumiva: 'Связь касаний с SQL, сделками и выручкой', typical: 'Только клики и сессии' },
              { metric: 'Синхрон SEO и рекламы', lumiva: 'Единая панель с общими KPI', typical: 'Отдельные отчеты по отделам' },
              { metric: 'Скорость мониторинга', lumiva: 'Ежедневные аномалии и авто-алерты', typical: 'Ручная проверка раз в неделю' },
            ],
            faqTitle: 'FAQ',
            faq: [
              { q: 'Вы анализируете только платный трафик?', a: 'Нет. В модель входят SEO, контент, соцсети, referral и direct-каналы.' },
              { q: 'Можно видеть влияние маркетинга не только на лиды, но и на сделки?', a: 'Да. Мы связываем источники с этапами воронки и выручкой внутри CRM.' },
              { q: 'Как работает отслеживание отклонений?', a: 'Система контролирует пороги CPL, конверсии, ROAS и SEO-видимости, сигнализируя о просадках.' },
            ],
          };

  return (
    <PublicPageLayout pageKey="marketing" title={text.title} subtitle={text.subtitle}>
      <div className="space-y-4">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-[#222222] sm:text-3xl">{text.heroTitle}</h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-200 sm:text-base">{text.heroBody}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {text.heroTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { value: '4.6x', label: 'Average blended ROAS' },
              { value: '31%', label: 'Organic share uplift' },
              { value: '19%', label: 'CPL reduction' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-white/80 bg-white p-4">
                <div className="text-2xl font-bold text-slate-900">{kpi.value}</div>
                <div className="mt-1 text-xs text-slate-600">{kpi.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <button
              type="button"
              className="rounded-full border border-white/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-900"
            >
              {text.cta}
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">{text.seoTitle}</h3>
            <div className="mt-3 space-y-3">
              {text.seoClusters.map((cluster) => (
                <div key={cluster.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700">{cluster.name}</div>
                    <div className="text-xs font-semibold text-emerald-700">{cluster.traffic}</div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${cluster.visibility}%` }} />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Visibility index {cluster.visibility}%</div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">{text.funnelTitle}</h3>
            <div className="mt-3 space-y-2">
              {text.funnelStages.map((row) => (
                <div key={row.stage} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs font-semibold text-slate-700">{row.stage}</div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">{row.value}</div>
                    <div className="text-[11px] text-emerald-700">{row.delta}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.channelsTitle}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {text.channels.map((channel) => (
              <div key={channel.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-700">{channel.name}</div>
                  <div className="text-xs font-semibold text-slate-900">{channel.roas}</div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${channel.share}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-slate-500">Quality share {channel.share}% · CPL {channel.cpl}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.kpiTitle}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Attribution coverage', value: '97%' },
              { label: 'Tracked campaigns', value: '186' },
              { label: 'SEO non-brand growth', value: '+28%' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">{kpi.label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{kpi.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.compareTitle}</h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {text.compareMetric}
                  </th>
                  <th className="border border-slate-200 bg-indigo-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-indigo-700">
                    {text.compareLumiva}
                  </th>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {text.compareTypical}
                  </th>
                </tr>
              </thead>
              <tbody>
                {text.compareRows.map((row) => (
                  <tr key={row.metric}>
                    <td className="border border-slate-200 px-3 py-2 text-slate-700">{row.metric}</td>
                    <td className="border border-slate-200 bg-indigo-50/60 px-3 py-2 text-slate-800">{row.lumiva}</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-600">{row.typical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.faqTitle}</h3>
          <div className="mt-3 space-y-3">
            {text.faq.map((item) => (
              <article key={item.q} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-900">{item.q}</h4>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.a}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PublicPageLayout>
  );
}

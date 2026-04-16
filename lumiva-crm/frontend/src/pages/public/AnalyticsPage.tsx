import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

type ChannelStat = {
  name: string;
  cr: number;
  cpl: string;
  revenue: string;
};

export default function AnalyticsPage() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2) as 'ru' | 'en' | 'tr';

  const text =
    lang === 'en'
      ? {
          title: 'Advertising and social analytics',
          subtitle:
            'A practical analytics page with sample channel data, conversion trends and KPI blocks for quick decision making.',
          heroTitle: 'See where leads, deals and revenue really come from',
          heroBody:
            'This page demonstrates how social and paid traffic can be visualized in one operational dashboard: channel quality, conversion trend, average check and growth dynamics.',
          heroTags: ['Cross-channel visibility', 'Operational KPI blocks', 'Decision-ready data'],
          cta: 'Request demo analytics setup',
          kpiTitle: 'Key metrics (sample)',
          chartTitle: 'Campaign dynamics, last 12 weeks',
          chartDelta: '+34.2%',
          chartDeltaLabel: 'to previous period',
          channelsTitle: 'Channel conversion snapshot',
          compareTitle: 'Lumiva analytics vs typical CRM reporting',
          compareMetric: 'Metric',
          compareLumiva: 'Lumiva analytics',
          compareTypical: 'Typical CRM reports',
          faqTitle: 'FAQ',
          faq: [
            { q: 'Are these real client numbers?', a: 'No, this page uses realistic demo values for presentation purposes.' },
            { q: 'Can we use our own data sources?', a: 'Yes. GA4, Meta Ads, Google Ads, Telegram and custom sources can be connected.' },
            { q: 'How often is data refreshed?', a: 'Usually near real-time for operational dashboards and scheduled snapshots for management reports.' },
          ],
          channels: [
            { name: 'Google Ads', cr: 62, cpl: '€18.4', revenue: '€81K' },
            { name: 'Meta', cr: 74, cpl: '€14.7', revenue: '€93K' },
            { name: 'Telegram', cr: 55, cpl: '€11.9', revenue: '€57K' },
            { name: 'Organic', cr: 69, cpl: '€9.1', revenue: '€64K' },
            { name: 'Direct', cr: 49, cpl: '€7.2', revenue: '€38K' },
          ] as ChannelStat[],
          compareRows: [
            { metric: 'Channel-level transparency', lumiva: 'End-to-end source to revenue', typical: 'Partial source attribution' },
            { metric: 'Decision speed', lumiva: 'Operational dashboard with KPI blocks', typical: 'Delayed static reports' },
            { metric: 'Sales + marketing alignment', lumiva: 'One shared performance model', typical: 'Separate departmental views' },
          ],
        }
      : lang === 'tr'
        ? {
            title: 'Reklam ve sosyal medya analitiği',
            subtitle:
              'Kanal verileri, dönüşüm trendleri ve KPI bloklarıyla hızlı karar desteği sunan örnek analitik sayfası.',
            heroTitle: 'Lead, satış ve gelirin hangi kanallardan geldiğini net görün',
            heroBody:
              'Bu sayfa; sosyal ve performans trafiğinin tek panelde nasıl izlenebileceğini gösterir: kanal kalitesi, dönüşüm trendi, ortalama sepet ve büyüme dinamiği.',
            heroTags: ['Kanal bazlı görünürlük', 'Operasyonel KPI blokları', 'Karar için hazır veri'],
            cta: 'Demo analitik kurulumu iste',
            kpiTitle: 'Temel metrikler (örnek)',
            chartTitle: 'Kampanya dinamiği, son 12 hafta',
            chartDelta: '+34,2%',
            chartDeltaLabel: 'önceki döneme göre',
            channelsTitle: 'Kanal dönüşüm görünümü',
            compareTitle: 'Lumiva analitiği ve tipik CRM raporları',
            compareMetric: 'Metrik',
            compareLumiva: 'Lumiva analitiği',
            compareTypical: 'Tipik CRM raporu',
            faqTitle: 'SSS',
            faq: [
              { q: 'Bu veriler gerçek müşteri verisi mi?', a: 'Hayır, bu sayfadaki değerler sunum amaçlı gerçekçi örnek veridir.' },
              { q: 'Kendi veri kaynaklarımızı bağlayabilir miyiz?', a: 'Evet. GA4, Meta Ads, Google Ads, Telegram ve özel kaynaklar bağlanabilir.' },
              { q: 'Veriler ne sıklıkla güncellenir?', a: 'Operasyon paneli için yakın gerçek zamanlı, yönetim raporları için planlı snapshot modeli uygulanır.' },
            ],
            channels: [
              { name: 'Google Ads', cr: 62, cpl: '€18.4', revenue: '€81K' },
              { name: 'Meta', cr: 74, cpl: '€14.7', revenue: '€93K' },
              { name: 'Telegram', cr: 55, cpl: '€11.9', revenue: '€57K' },
              { name: 'Organic', cr: 69, cpl: '€9.1', revenue: '€64K' },
              { name: 'Direct', cr: 49, cpl: '€7.2', revenue: '€38K' },
            ] as ChannelStat[],
            compareRows: [
              { metric: 'Kanal bazlı görünürlük', lumiva: 'Kaynaktan gelire uçtan uca görünüm', typical: 'Parçalı atıf modeli' },
              { metric: 'Karar alma hızı', lumiva: 'KPI bloklu operasyon paneli', typical: 'Gecikmeli statik raporlar' },
              { metric: 'Satış + pazarlama hizalaması', lumiva: 'Tek performans modeli', typical: 'Departman bazlı parçalı görünüm' },
            ],
          }
        : {
            title: 'Аналитика рекламы и соцсетей',
            subtitle:
              'Демо-страница с примерами графиков, метрик и сравнений по каналам для быстрых управленческих решений.',
            heroTitle: 'Показываем, какие каналы реально дают лиды, сделки и выручку',
            heroBody:
              'Здесь демонстрируется формат единого аналитического полотна: динамика кампаний, качество каналов, конверсия, средний чек и точки роста по соцсетям и рекламе.',
            heroTags: ['Сквозная видимость каналов', 'Операционные KPI-блоки', 'Данные для быстрых решений'],
            cta: 'Запросить демо-настройку аналитики',
            kpiTitle: 'Ключевые метрики (пример)',
            chartTitle: 'Динамика кампаний, последние 12 недель',
            chartDelta: '+34,2%',
            chartDeltaLabel: 'к прошлому периоду',
            channelsTitle: 'Срез конверсии по каналам',
            compareTitle: 'Аналитика Lumiva vs типичные CRM-отчеты',
            compareMetric: 'Метрика',
            compareLumiva: 'Аналитика Lumiva',
            compareTypical: 'Типичный CRM отчет',
            faqTitle: 'FAQ',
            faq: [
              { q: 'Это реальные данные клиентов?', a: 'Нет, на странице используются реалистичные демонстрационные примеры.' },
              { q: 'Можно подключить наши источники?', a: 'Да. Подключаются GA4, Meta Ads, Google Ads, Telegram и кастомные источники.' },
              { q: 'Как часто обновляются данные?', a: 'Для операционного слоя — почти в реальном времени, для управленческих срезов — по расписанию.' },
            ],
            channels: [
              { name: 'Google Ads', cr: 62, cpl: '€18.4', revenue: '€81K' },
              { name: 'Meta', cr: 74, cpl: '€14.7', revenue: '€93K' },
              { name: 'Telegram', cr: 55, cpl: '€11.9', revenue: '€57K' },
              { name: 'Organic', cr: 69, cpl: '€9.1', revenue: '€64K' },
              { name: 'Direct', cr: 49, cpl: '€7.2', revenue: '€38K' },
            ] as ChannelStat[],
            compareRows: [
              { metric: 'Прозрачность по каналам', lumiva: 'Сквозная модель от источника до выручки', typical: 'Частичная атрибуция' },
              { metric: 'Скорость решений', lumiva: 'Операционная панель с KPI', typical: 'Запаздывающие статичные отчеты' },
              { metric: 'Синхрон продаж и маркетинга', lumiva: 'Единая performance-модель', typical: 'Разрозненные витрины по отделам' },
            ],
          };

  const linePoints = [20, 34, 41, 37, 33, 44, 52];
  const max = Math.max(...linePoints);
  const path = linePoints
    .map((v, i) => {
      const x = 20 + i * 40;
      const y = 120 - (v / max) * 80;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <PublicPageLayout pageKey="analytics" title={text.title} subtitle={text.subtitle}>
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
              { value: text.chartDelta, label: text.chartDeltaLabel },
              { value: '€680', label: 'Avg check' },
              { value: '72%', label: 'SLA closed on time' },
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{text.chartTitle}</h3>
              <div className="text-right text-xs">
                <div className="font-semibold text-slate-900">{text.chartDelta}</div>
                <div className="text-slate-500">{text.chartDeltaLabel}</div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <svg viewBox="0 0 300 130" className="h-44 w-full">
                <path d={path} fill="none" stroke="#111827" strokeWidth="2.8" strokeLinecap="round" />
                {linePoints.map((v, i) => {
                  const x = 20 + i * 40;
                  const y = 120 - (v / max) * 80;
                  return <circle key={`${x}-${y}`} cx={x} cy={y} r={3.5} fill="#111827" />;
                })}
              </svg>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">CTR 3.4%</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">CPL €18.4</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">CR 6.8%</div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">{text.channelsTitle}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {text.channels.map((c) => (
                <div key={c.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700">{c.name}</div>
                    <div className="text-xs text-slate-600">{c.cr}%</div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${c.cr}%` }} />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">CPL {c.cpl} · {c.revenue}</div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.kpiTitle}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Lead to meeting', value: '41.3%' },
              { label: 'Meeting to deal', value: '23.7%' },
              { label: 'Revenue from social', value: '€142K' },
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

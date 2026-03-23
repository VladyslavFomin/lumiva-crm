import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

type TeamSegment = {
  name: string;
  conversion: number;
  velocity: string;
  value: string;
};

export default function SalesSolutionsPage() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2) as 'ru' | 'en' | 'tr';

  const text =
    lang === 'en'
      ? {
          title: 'Sales analytics and pipeline control',
          subtitle:
            'A unified sales layer to monitor lead quality, stage velocity, win-rate, forecast confidence and manager workload in real time.',
          heroTitle: 'Build predictable sales growth with transparent pipeline analytics',
          heroBody:
            'Lumiva connects marketing sources, lead qualification and deal stages into one decision dashboard. Teams see bottlenecks early, improve conversion discipline and increase revenue predictability.',
          heroTags: ['Pipeline velocity tracking', 'Stage-level conversion control', 'Forecast and risk monitoring'],
          cta: 'Request sales analytics demo',
          kpiTitle: 'Sales KPI snapshot',
          velocityTitle: 'Pipeline velocity by stage',
          velocityRows: [
            { stage: 'MQL -> SQL', days: '1.8 days', delta: '-22%' },
            { stage: 'SQL -> Demo', days: '2.6 days', delta: '-17%' },
            { stage: 'Demo -> Proposal', days: '3.2 days', delta: '-14%' },
            { stage: 'Proposal -> Won', days: '5.1 days', delta: '-11%' },
          ],
          teamTitle: 'Team execution quality',
          teamSegments: [
            { name: 'Inbound SDR', conversion: 68, velocity: '42 min', value: '€96K' },
            { name: 'Account Executive', conversion: 54, velocity: '3.4 h', value: '€218K' },
            { name: 'Enterprise Desk', conversion: 39, velocity: '5.8 h', value: '€402K' },
            { name: 'Partner Channel', conversion: 47, velocity: '2.9 h', value: '€171K' },
          ] as TeamSegment[],
          compareTitle: 'Lumiva sales model vs classic CRM tracking',
          compareMetric: 'Metric',
          compareLumiva: 'Lumiva sales analytics',
          compareTypical: 'Classic CRM view',
          compareRows: [
            { metric: 'Pipeline transparency', lumiva: 'Stage bottlenecks and SLA deviations in one view', typical: 'Static stage totals only' },
            { metric: 'Forecast quality', lumiva: 'Probability model by stage and source', typical: 'Manual manager estimates' },
            { metric: 'Sales coaching signals', lumiva: 'Call, response and conversion behavior trends', typical: 'No operational coaching layer' },
          ],
          faqTitle: 'FAQ',
          faq: [
            { q: 'Can we track conversion by manager and source together?', a: 'Yes. Every stage can be segmented by owner, channel, region and deal type.' },
            { q: 'Is there support for revenue forecasting?', a: 'Yes. Forecast combines historical conversion, current stage mix and confidence coefficients.' },
            { q: 'Can this be used for weekly sales reviews?', a: 'Exactly. The page is designed for operational weekly reviews and executive planning.' },
          ],
        }
      : lang === 'tr'
        ? {
            title: 'Satış analitiği ve pipeline kontrolü',
            subtitle:
              'Lead kalitesi, aşama hızı, win-rate, forecast güveni ve ekip yükünü gerçek zamanlı izleyen birleşik satış analitik katmanı.',
            heroTitle: 'Şeffaf pipeline analitiği ile öngörülebilir satış büyümesi kurun',
            heroBody:
              'Lumiva; pazarlama kaynaklarını, lead kalifikasyonunu ve satış aşamalarını tek karar panelinde birleştirir. Ekipler darboğazları erken görür, dönüşüm disiplinini artırır ve gelir öngörüsünü güçlendirir.',
            heroTags: ['Aşama hızının takibi', 'Aşama bazlı dönüşüm kontrolü', 'Forecast ve risk izleme'],
            cta: 'Satış analitiği demosu iste',
            kpiTitle: 'Satış KPI özeti',
            velocityTitle: 'Aşamalara göre pipeline hızı',
            velocityRows: [
              { stage: 'MQL -> SQL', days: '1.8 gün', delta: '-22%' },
              { stage: 'SQL -> Demo', days: '2.6 gün', delta: '-17%' },
              { stage: 'Demo -> Teklif', days: '3.2 gün', delta: '-14%' },
              { stage: 'Teklif -> Kazanım', days: '5.1 gün', delta: '-11%' },
            ],
            teamTitle: 'Ekip uygulama kalitesi',
            teamSegments: [
              { name: 'Inbound SDR', conversion: 68, velocity: '42 dk', value: '€96K' },
              { name: 'Account Executive', conversion: 54, velocity: '3.4 s', value: '€218K' },
              { name: 'Enterprise Desk', conversion: 39, velocity: '5.8 s', value: '€402K' },
              { name: 'Partner Channel', conversion: 47, velocity: '2.9 s', value: '€171K' },
            ] as TeamSegment[],
            compareTitle: 'Lumiva satış modeli ve klasik CRM takibi',
            compareMetric: 'Metrik',
            compareLumiva: 'Lumiva satış analitiği',
            compareTypical: 'Klasik CRM görünümü',
            compareRows: [
              { metric: 'Pipeline şeffaflığı', lumiva: 'Darboğazlar ve SLA sapmaları tek görünümde', typical: 'Sadece statik aşama toplamları' },
              { metric: 'Forecast kalitesi', lumiva: 'Aşama ve kaynağa göre olasılık modeli', typical: 'Yönetici bazlı manuel tahmin' },
              { metric: 'Koçluk sinyalleri', lumiva: 'Arama, yanıt ve dönüşüm davranış trendleri', typical: 'Operasyonel koçluk katmanı yok' },
            ],
            faqTitle: 'SSS',
            faq: [
              { q: 'Dönüşümü yönetici ve kaynak bazında birlikte izleyebilir miyiz?', a: 'Evet. Her aşama sahip, kanal, bölge ve satış tipi bazında segmentlenebilir.' },
              { q: 'Gelir forecast desteği var mı?', a: 'Evet. Forecast; geçmiş dönüşüm, mevcut aşama dağılımı ve güven katsayılarını birlikte kullanır.' },
              { q: 'Haftalık satış toplantılarında kullanılabilir mi?', a: 'Evet, sayfa özellikle operasyonel haftalık review ve yönetim planlaması için kurgulanmıştır.' },
            ],
          }
        : {
            title: 'Продажи: аналитика и контроль воронки',
            subtitle:
              'Единая sales-аналитика для контроля качества лидов, скорости этапов, win-rate, прогноза выручки и загрузки менеджеров в реальном времени.',
            heroTitle: 'Предсказуемый рост продаж через прозрачную аналитику воронки',
            heroBody:
              'Lumiva связывает источники маркетинга, квалификацию лидов и стадии сделок в единой панели решений. Команда заранее видит узкие места, управляет конверсией и повышает точность прогноза.',
            heroTags: ['Контроль скорости по этапам', 'Конверсия на каждом шаге воронки', 'Прогноз и риски в одной панели'],
            cta: 'Запросить демо аналитики продаж',
            kpiTitle: 'Ключевые KPI продаж',
            velocityTitle: 'Скорость прохождения этапов',
            velocityRows: [
              { stage: 'MQL -> SQL', days: '1.8 дня', delta: '-22%' },
              { stage: 'SQL -> Demo', days: '2.6 дня', delta: '-17%' },
              { stage: 'Demo -> Proposal', days: '3.2 дня', delta: '-14%' },
              { stage: 'Proposal -> Won', days: '5.1 дня', delta: '-11%' },
            ],
            teamTitle: 'Качество исполнения по команде',
            teamSegments: [
              { name: 'Inbound SDR', conversion: 68, velocity: '42 мин', value: '€96K' },
              { name: 'Account Executive', conversion: 54, velocity: '3.4 ч', value: '€218K' },
              { name: 'Enterprise Desk', conversion: 39, velocity: '5.8 ч', value: '€402K' },
              { name: 'Partner Channel', conversion: 47, velocity: '2.9 ч', value: '€171K' },
            ] as TeamSegment[],
            compareTitle: 'Sales-модель Lumiva vs классический CRM-контроль',
            compareMetric: 'Метрика',
            compareLumiva: 'Аналитика Lumiva',
            compareTypical: 'Классический подход',
            compareRows: [
              { metric: 'Прозрачность воронки', lumiva: 'Узкие места и SLA-отклонения в одном экране', typical: 'Только статичные суммы по стадиям' },
              { metric: 'Качество прогноза', lumiva: 'Вероятностная модель по этапам и источникам', typical: 'Ручные оценки менеджеров' },
              { metric: 'Сигналы для coaching', lumiva: 'Тренды по касаниям, ответам и конверсии', typical: 'Нет операционного слоя coaching' },
            ],
            faqTitle: 'FAQ',
            faq: [
              { q: 'Можно смотреть конверсию одновременно по менеджеру и источнику?', a: 'Да. Каждый этап сегментируется по владельцу, каналу, региону и типу сделки.' },
              { q: 'Есть прогнозирование выручки?', a: 'Да. Прогноз строится на исторической конверсии, текущем составе воронки и коэффициентах уверенности.' },
              { q: 'Подходит для еженедельных sales-review?', a: 'Да, страница ориентирована на еженедельный операционный review и стратегические встречи руководства.' },
            ],
          };

  return (
    <PublicPageLayout pageKey="sales" title={text.title} subtitle={text.subtitle}>
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
              { value: '+27%', label: 'Won deals QoQ' },
              { value: '91%', label: 'Pipeline hygiene score' },
              { value: '-19%', label: 'Cycle time reduction' },
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
            <h3 className="text-sm font-semibold text-slate-900">{text.velocityTitle}</h3>
            <div className="mt-3 space-y-2">
              {text.velocityRows.map((row) => (
                <div key={row.stage} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs font-semibold text-slate-700">{row.stage}</div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">{row.days}</div>
                    <div className="text-[11px] text-emerald-700">{row.delta}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">{text.teamTitle}</h3>
            <div className="mt-3 space-y-3">
              {text.teamSegments.map((segment) => (
                <div key={segment.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700">{segment.name}</div>
                    <div className="text-xs font-semibold text-slate-900">{segment.value}</div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${segment.conversion}%` }} />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Stage conversion {segment.conversion}% · First response {segment.velocity}</div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.kpiTitle}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Lead to SQL', value: '38.4%' },
              { label: 'SQL to Won', value: '23.2%' },
              { label: 'Forecast confidence', value: '84%' },
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

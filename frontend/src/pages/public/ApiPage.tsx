import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function ApiPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2) as 'ru' | 'en' | 'tr';
  const text =
    lang === 'en'
      ? {
          heroTitle: 'API that scales with your revenue model',
          heroBody:
            'Lumiva API is designed for operational growth: launch integrations quickly, adapt process logic without platform rebuilds, and keep analytics consistent while channels and teams expand.',
          heroTags: ['Fast launch', 'Flexible process changes', 'Scale-ready architecture'],
          topStats: [
            { value: 'x2.1', label: 'Faster channel scaling' },
            { value: '99.2%', label: 'Cross-system data consistency' },
            { value: '-43%', label: 'Lead response cycle' },
          ],
          pillars: [
            {
              title: 'Rapid go-live model',
              text: 'Integrations are launched in short business-focused sprints: source mapping, test payloads and controlled release.',
            },
            {
              title: 'Flexible adaptation',
              text: 'When your sales process evolves, mapping and event logic are adjusted without expensive reimplementation.',
            },
            {
              title: 'Secure production layer',
              text: 'Isolated tenant model, controlled access and verified callbacks support stable enterprise-grade operation.',
            },
          ],
          kpiTitle: 'Performance dashboard after stabilization',
          kpiCards: [
            { label: 'Lead response time', value: '-43%', note: 'average handling cycle' },
            { label: 'Manual operations', value: '-38%', note: 'after process automation' },
            { label: 'Data consistency', value: '99.2%', note: 'cross-system match rate' },
            { label: 'Time to scale new channel', value: 'x2.1 faster', note: 'compared to typical CRM setup' },
          ],
          speedTitle: 'Operational capabilities comparison',
          speedMetrics: [
            { label: 'Integration launch speed', lumiva: 88, typical: 52 },
            { label: 'Process change flexibility', lumiva: 91, typical: 47 },
            { label: 'Operational observability', lumiva: 86, typical: 49 },
            { label: 'Scale readiness', lumiva: 90, typical: 55 },
          ],
          trendTitle: 'Integration maturity over first 6 weeks',
          trendHint: 'Share of stable and fully observable integration flow (%)',
          trendLegendLumiva: 'Lumiva API',
          trendLegendTypical: 'Typical CRM',
          ppHint: '`pp` = percentage points difference between Lumiva and typical CRM approach.',
          trendData: [
            { period: 'Week 1 - Pilot start', lumiva: 38, typical: 18 },
            { period: 'Week 2 - First automation', lumiva: 55, typical: 29 },
            { period: 'Week 3 - Team adoption', lumiva: 71, typical: 38 },
            { period: 'Week 4 - Cross-channel sync', lumiva: 82, typical: 46 },
            { period: 'Week 5 - SLA stabilization', lumiva: 89, typical: 52 },
            { period: 'Week 6 - Scale-ready mode', lumiva: 93, typical: 57 },
          ],
          journeyTitle: 'Implementation journey',
          stepLabel: 'Phase',
          journeySteps: [
            'Audit of sources, statuses and responsibility model',
            'Mapping fields and event logic for key workflows',
            'Test data stream and controlled pilot launch',
            'Production rollout with monitoring and support',
          ],
          compareTitle: 'Lumiva vs typical CRM approach',
          compareMetricLabel: 'Metric',
          compareLumivaLabel: 'Lumiva API',
          compareTypicalLabel: 'Typical CRM',
          compareRows: [
            {
              metric: 'Time to first working integration',
              lumiva: 'Short iterative launch',
              typical: 'Long technical setup cycle',
            },
            {
              metric: 'Cost of process changes',
              lumiva: 'Low: update rules and mappings',
              typical: 'High: frequent custom rework',
            },
            {
              metric: 'Visibility for managers',
              lumiva: 'Full funnel-level observability',
              typical: 'Partial view with data gaps',
            },
            {
              metric: 'Scale without refactor',
              lumiva: 'Supports multi-channel growth',
              typical: 'Requires architecture rebuild',
            },
          ],
          faqTitle: 'Client FAQ',
          faqItems: [
            {
              q: 'Do we need a large internal dev team?',
              a: 'No. We can provide a practical integration path with clear milestones, payload examples, and rollout support.',
            },
            {
              q: 'Can we connect only one channel first?',
              a: 'Yes. Many projects start from one critical channel and then expand step-by-step to other sources.',
            },
            {
              q: 'How do you handle data security?',
              a: 'We use isolated tenant access model, verified callbacks, and controlled permissions for integration operations.',
            },
            {
              q: 'What if our sales process changes next quarter?',
              a: 'API logic is configurable. We adjust mapping and event chains without breaking your whole CRM setup.',
            },
          ],
        }
      : lang === 'tr'
        ? {
            heroTitle: 'Gelir modelinizle birlikte büyüyen API',
            heroBody:
              'Lumiva API, entegrasyonları hızlı yayına almak, süreçleri kesinti olmadan güncellemek ve kanal büyümesini mimariyi bozmadan yönetmek için tasarlanmıştır. Lead toplama, yönlendirme, durum kontrolü, faturalama olayları ve analitik sürekliliği tek modelde ilerler.',
            heroTags: ['Hızlı canlıya geçiş', 'Esnek süreç uyumu', 'Ölçeklenebilir mimari'],
            topStats: [
              { value: 'x2.1', label: 'Daha hızlı kanal ölçekleme' },
              { value: '99.2%', label: 'Sistemler arası veri tutarlılığı' },
              { value: '-43%', label: 'Lead yanıt döngüsü' },
            ],
            pillars: [
              {
                title: 'Hızlı devreye alma modeli',
                text: 'Entegrasyonlar kısa sprintlerle yayına alınır: kaynak eşleştirme, test payload ve kontrollü geçiş.',
              },
              {
                title: 'Esnek uyarlama',
                text: 'Süreç değiştikçe entegrasyon kuralları yeniden yazım ihtiyacı olmadan güncellenebilir.',
              },
              {
                title: 'Güvenli üretim katmanı',
                text: 'Tenant izolasyonu, kontrollü erişim ve doğrulanan callback akışı ile kurumsal güvence sağlanır.',
              },
            ],
            kpiTitle: 'Stabilizasyon sonrası performans paneli',
            kpiCards: [
              { label: 'Lead yanıt süresi', value: '-43%', note: 'ortalama işlem döngüsü' },
              { label: 'Manuel işlem yükü', value: '-38%', note: 'otomasyon sonrası' },
              { label: 'Veri tutarlılığı', value: '99.2%', note: 'sistemler arası eşleşme oranı' },
              { label: 'Yeni kanal ölçekleme süresi', value: 'x2.1 hızlı', note: 'tipik CRM yaklaşımına göre' },
            ],
            speedTitle: 'Operasyonel kabiliyet karşılaştırması',
            speedMetrics: [
              { label: 'Entegrasyon devreye alma hızı', lumiva: 88, typical: 52 },
              { label: 'Süreç değişikliğine uyum', lumiva: 91, typical: 47 },
              { label: 'Operasyon görünürlüğü', lumiva: 86, typical: 49 },
              { label: 'Ölçeklenebilirlik hazırlığı', lumiva: 90, typical: 55 },
            ],
            trendTitle: 'İlk 6 haftada entegrasyon olgunluğu',
            trendHint: 'Stabil ve tam izlenen entegrasyon akışının payı (%)',
            trendLegendLumiva: 'Lumiva API',
            trendLegendTypical: 'Tipik CRM',
            ppHint: '`pp` = Lumiva ile tipik CRM yaklaşımı arasındaki yüzde puan farkı.',
            trendData: [
              { period: 'Hafta 1 - Pilot başlangıç', lumiva: 38, typical: 18 },
              { period: 'Hafta 2 - İlk otomasyon', lumiva: 55, typical: 29 },
              { period: 'Hafta 3 - Ekip adaptasyonu', lumiva: 71, typical: 38 },
              { period: 'Hafta 4 - Kanal senkronu', lumiva: 82, typical: 46 },
              { period: 'Hafta 5 - SLA stabilizasyonu', lumiva: 89, typical: 52 },
              { period: 'Hafta 6 - Ölçek hazır mod', lumiva: 93, typical: 57 },
            ],
            journeyTitle: 'Kurulum yolculuğu',
            stepLabel: 'Faz',
            journeySteps: [
              'Kaynaklar, durumlar ve sorumluluk modelinin analizi',
              'Alan eşleştirme ve olay kurgusunun netleştirilmesi',
              'Test veri akışı ve kontrollü pilot yayın',
              'Canlı geçiş, izleme ve destek',
            ],
            compareTitle: 'Lumiva ve tipik CRM yaklaşımı',
            compareMetricLabel: 'Metrik',
            compareLumivaLabel: 'Lumiva API',
            compareTypicalLabel: 'Tipik CRM',
            compareRows: [
              {
                metric: 'İlk çalışan entegrasyona ulaşma süresi',
                lumiva: 'Kısa iteratif kurulum',
                typical: 'Uzun teknik hazırlık döngüsü',
              },
              {
                metric: 'Süreç değişikliği maliyeti',
                lumiva: 'Düşük: kural ve mapping güncellemesi',
                typical: 'Yüksek: sık custom geliştirme',
              },
              {
                metric: 'Yönetim görünürlüğü',
                lumiva: 'Huni bazlı net görünürlük',
                typical: 'Parçalı veri ve eksik görünüm',
              },
              {
                metric: 'Refactor olmadan ölçek',
                lumiva: 'Çok kanallı büyümeyi destekler',
                typical: 'Mimariyi tekrar kurma ihtiyacı',
              },
            ],
            faqTitle: 'Müşteri soruları',
            faqItems: [
              {
                q: 'Büyük bir yazılım ekibi gerekli mi?',
                a: 'Hayır. Net kilometre taşları, test payloadları ve yayın desteği ile süreç yönetilebilir ilerler.',
              },
              {
                q: 'Önce tek kanal ile başlayabilir miyiz?',
                a: 'Evet. Çoğu müşteri önce kritik bir kanal ile başlar, ardından diğer kaynaklara genişler.',
              },
              {
                q: 'Veri güvenliği nasıl sağlanıyor?',
                a: 'Tenant izolasyonu, doğrulanan callback yapısı ve kontrollü erişim modeli ile güvenlik sağlanır.',
              },
              {
                q: 'Satış sürecimiz değişirse ne olur?',
                a: 'API akışı esnektir. Mapping ve event zinciri tüm yapıyı bozmadan güncellenebilir.',
              },
            ],
          }
        : {
            heroTitle: 'API, который масштабируется вместе с вашим бизнесом',
            heroBody:
              'API Lumiva помогает быстро запускать интеграции, менять бизнес-процессы без остановки работы и масштабировать каналы без пересборки CRM. Мы ориентируемся на практику: прием лидов, маршрутизацию, контроль этапов, биллинг-события и цельную аналитику.',
            heroTags: ['Быстрый запуск', 'Гибкая адаптация процессов', 'Масштаб без пересборки'],
            topStats: [
              { value: 'x2.1', label: 'Быстрее масштабирование каналов' },
              { value: '99.2%', label: 'Согласованность данных между системами' },
              { value: '-43%', label: 'Цикл реакции на лид' },
            ],
            pillars: [
              {
                title: 'Модель быстрого запуска',
                text: 'Интеграции запускаются короткими этапами: картирование источников, тест payload и аккуратный релиз.',
              },
              {
                title: 'Гибкая настройка под процесс',
                text: 'Когда ваш процесс меняется, API-логику можно адаптировать без полного переезда и дорогих доработок.',
              },
              {
                title: 'Безопасный production-контур',
                text: 'Изолированная tenant-модель, контроль доступа и верификация callback-событий обеспечивают стабильность.',
              },
            ],
            kpiTitle: 'Панель бизнес-метрик после стабилизации',
            kpiCards: [
              { label: 'Скорость реакции на лид', value: '-43%', note: 'средний цикл обработки' },
              { label: 'Ручные операции', value: '-38%', note: 'после автоматизации процессов' },
              { label: 'Согласованность данных', value: '99.2%', note: 'совпадение между системами' },
              { label: 'Срок масштабирования нового канала', value: 'x2.1 быстрее', note: 'по сравнению с типовой CRM' },
            ],
            speedTitle: 'Сравнение операционных возможностей',
            speedMetrics: [
              { label: 'Скорость запуска интеграций', lumiva: 88, typical: 52 },
              { label: 'Гибкость при изменении процесса', lumiva: 91, typical: 47 },
              { label: 'Наблюдаемость операций', lumiva: 86, typical: 49 },
              { label: 'Готовность к масштабированию', lumiva: 90, typical: 55 },
            ],
            trendTitle: 'Зрелость интеграций в первые 6 недель',
            trendHint: 'Доля стабильного и полностью наблюдаемого интеграционного потока (%)',
            trendLegendLumiva: 'Lumiva API',
            trendLegendTypical: 'Типичная CRM',
            ppHint: '`pp` = разница в процентных пунктах между Lumiva и типичным подходом CRM.',
            trendData: [
              { period: 'Неделя 1 - Старт пилота', lumiva: 38, typical: 18 },
              { period: 'Неделя 2 - Первая автоматизация', lumiva: 55, typical: 29 },
              { period: 'Неделя 3 - Адаптация команды', lumiva: 71, typical: 38 },
              { period: 'Неделя 4 - Сквозная синхронизация', lumiva: 82, typical: 46 },
              { period: 'Неделя 5 - Стабилизация SLA', lumiva: 89, typical: 52 },
              { period: 'Неделя 6 - Режим масштабирования', lumiva: 93, typical: 57 },
            ],
            journeyTitle: 'Путь внедрения',
            stepLabel: 'Этап',
            journeySteps: [
              'Аудит источников, статусов и модели ответственности',
              'Согласование полей и событийной логики для ключевых воронок',
              'Тестовый поток данных и пилотный запуск',
              'Промышленный релиз с мониторингом и поддержкой',
            ],
            compareTitle: 'Lumiva и типичный подход CRM',
            compareMetricLabel: 'Метрика',
            compareLumivaLabel: 'Lumiva API',
            compareTypicalLabel: 'Типичная CRM',
            compareRows: [
              {
                metric: 'Срок до первой рабочей интеграции',
                lumiva: 'Короткий итеративный запуск',
                typical: 'Долгий технический цикл',
              },
              {
                metric: 'Стоимость изменений процесса',
                lumiva: 'Низкая: корректировка правил и mapping',
                typical: 'Высокая: частые custom-доработки',
              },
              {
                metric: 'Прозрачность для руководителя',
                lumiva: 'Сквозная наблюдаемость по воронке',
                typical: 'Фрагментированные данные и пробелы',
              },
              {
                metric: 'Масштаб без пересборки',
                lumiva: 'Поддерживает рост каналов и команд',
                typical: 'Нужна архитектурная переделка',
              },
            ],
            faqTitle: 'Частые вопросы клиентов',
            faqItems: [
              {
                q: 'Нужна ли сильная внутренняя команда разработки?',
                a: 'Не обязательно. Мы выстраиваем понятный путь внедрения с этапами, тестами и сопровождением запуска.',
              },
              {
                q: 'Можно начать с одного канала, а потом расширяться?',
                a: 'Да. Обычно стартуем с критичного канала и постепенно подключаем остальные источники.',
              },
              {
                q: 'Как обеспечивается безопасность данных?',
                a: 'Используется изолированная tenant-модель, проверка callback-событий и контролируемый доступ к операциям.',
              },
              {
                q: 'Что если изменится наша воронка продаж?',
                a: 'API-модель адаптируется: корректируем mapping и цепочки событий без разрушения всей конфигурации CRM.',
              },
            ],
          };

  return (
    <PublicPageLayout
      pageKey="api"
      title={t('publicPages.api.title')}
      subtitle={t('publicPages.api.subtitle')}
    >
      <div className="space-y-4">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:p-8">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-semibold tracking-tight text-[#222222] sm:text-3xl">{text.heroTitle}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-200 sm:text-base">{text.heroBody}</p>
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
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {text.topStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/80 bg-white p-4">
                  <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                  <div className="mt-1 text-xs text-slate-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {text.pillars.map((card) => (
              <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{card.text}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">{text.kpiTitle}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {text.kpiCards.map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {kpi.label}
                    </div>
                    <div className="mt-2 text-xl font-bold text-indigo-700">{kpi.value}</div>
                    <div className="mt-1 text-xs text-slate-600">{kpi.note}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">{text.speedTitle}</h3>
              <div className="mt-3 space-y-3">
                {text.speedMetrics.map((m) => (
                  <div key={m.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700">{m.label}</div>
                    <div className="mt-2 text-[11px] text-slate-500">Lumiva</div>
                    <div className="mt-1 h-2 rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${m.lumiva}%` }} />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">Typical CRM</div>
                    <div className="mt-1 h-2 rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-slate-500" style={{ width: `${m.typical}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">{text.trendTitle}</h3>
            <p className="mt-1 text-xs text-slate-500">{text.trendHint}</p>
            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[640px] space-y-3">
                {text.trendData.map((point) => (
                  <div key={point.period} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        {point.period}
                      </div>
                      <div className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                        +{point.lumiva - point.typical} pp
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-600" />
                            {text.trendLegendLumiva}
                          </span>
                          <span className="font-semibold">{point.lumiva}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${point.lumiva}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500" />
                            {text.trendLegendTypical}
                          </span>
                          <span className="font-semibold">{point.typical}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-slate-500" style={{ width: `${point.typical}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-[11px] text-slate-500">{text.ppHint}</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">{text.journeyTitle}</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {text.journeySteps.map((step, idx) => (
                <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {text.stepLabel} {idx + 1}
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{step}</div>
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
                      {text.compareMetricLabel}
                    </th>
                    <th className="border border-slate-200 bg-indigo-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-indigo-700">
                      {text.compareLumivaLabel}
                    </th>
                    <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {text.compareTypicalLabel}
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
              {text.faqItems.map((item) => (
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

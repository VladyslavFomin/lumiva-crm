import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function ScenariosPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2) as 'ru' | 'en' | 'tr';
  const scenarios = t('publicPages.scenarios.items', { returnObjects: true }) as Array<{
    title: string;
    text: string;
  }>;
  const text =
    lang === 'en'
      ? {
          heroTitle: 'Operational scenarios that convert into revenue',
          heroBody:
            'Lumiva scenarios turn CRM from a static database into an active execution system. You can orchestrate inbound routing, SLA control, reactivation and channel analytics inside one coherent workflow model.',
          heroTags: ['Scenario orchestration', 'SLA discipline', 'Predictable conversions'],
          topStats: [
            { value: '+27%', label: 'Faster lead-to-deal progression' },
            { value: '-34%', label: 'Missed follow-ups after automation' },
            { value: '92%', label: 'Scenario completion consistency' },
          ],
          modelTitle: 'Scenario design in one operational model',
          modelBody:
            'Scenario logic is built around real funnel stages, SLA rules and conversion checkpoints. You can combine inbound routing, reactivation sequences and task automation in one controlled chain.',
          metricsTitle: 'Scenario execution metrics',
          metrics: [
            { label: 'Lead routing accuracy', lumiva: 93, typical: 67 },
            { label: 'SLA adherence', lumiva: 89, typical: 58 },
            { label: 'Reactivation effectiveness', lumiva: 81, typical: 46 },
            { label: 'Channel attribution clarity', lumiva: 90, typical: 54 },
          ],
          lifecycleTitle: 'Scenario lifecycle by phase',
          lifecycleLabel: 'Phase',
          lifecycle: [
            'Signal capture and qualification rules',
            'Automated assignment and first response',
            'SLA monitoring and escalation paths',
            'Reactivation and conversion optimization',
          ],
          compareTitle: 'Lumiva scenario model vs typical CRM workflows',
          compareMetricLabel: 'Metric',
          compareLumivaLabel: 'Lumiva model',
          compareTypicalLabel: 'Typical CRM flow',
          compareRows: [
            {
              metric: 'Scenario launch speed',
              lumiva: 'Template + rule driven setup',
              typical: 'Manual and fragmented setup',
            },
            {
              metric: 'Process consistency',
              lumiva: 'Controlled by stage logic and roles',
              typical: 'Depends on individual discipline',
            },
            {
              metric: 'Visibility of bottlenecks',
              lumiva: 'Real-time stage and SLA observability',
              typical: 'Delayed reporting and blind zones',
            },
            {
              metric: 'Optimization cycle',
              lumiva: 'Fast iteration via measurable checkpoints',
              typical: 'Slow cycle with weak feedback loops',
            },
          ],
          faqTitle: 'Client FAQ',
          faqItems: [
            {
              q: 'Can scenarios run for different departments at once?',
              a: 'Yes. You can define dedicated rules per team while keeping one shared control and reporting framework.',
            },
            {
              q: 'How do we avoid over-automation?',
              a: 'Each scenario includes checkpoints, role responsibility, and escalation logic so automation stays manageable.',
            },
            {
              q: 'Can we optimize scenarios after launch?',
              a: 'Absolutely. We use measurable KPIs per stage, making refinements fast and evidence-based.',
            },
          ],
          safeTitle: 'Safe automation principle',
          safeItems: [
            'Status transitions are validated by role and stage rules',
            'Critical actions are logged for accountability',
            'Retries and fallback rules prevent data loss',
            'Analytics remains consistent across all channels',
          ],
        }
      : lang === 'tr'
        ? {
            heroTitle: 'Gelire dönüşen operasyon senaryoları',
            heroBody:
              'Lumiva senaryoları CRM’i pasif veri deposundan aktif bir operasyon motoruna dönüştürür. Gelen lead yönlendirme, SLA kontrolü, reaktivasyon ve kanal analitiği tek modelde yönetilir.',
            heroTags: ['Senaryo orkestrasyonu', 'SLA disiplini', 'Öngörülebilir dönüşüm'],
            topStats: [
              { value: '+27%', label: 'Lead’den satışa geçiş hızı' },
              { value: '-34%', label: 'Otomasyon sonrası kaçan takipler' },
              { value: '92%', label: 'Senaryo tamamlama tutarlılığı' },
            ],
            modelTitle: 'Tek operasyon modelinde senaryo tasarımı',
            modelBody:
              'Senaryolar gerçek huni adımları, SLA kuralları ve dönüşüm kontrol noktalarına göre kurgulanır. Gelen lead yönlendirme, reaktivasyon ve görev otomasyonlarını tek zincirde birleştirebilirsiniz.',
            metricsTitle: 'Senaryo yürütme metrikleri',
            metrics: [
              { label: 'Lead yönlendirme doğruluğu', lumiva: 93, typical: 67 },
              { label: 'SLA uyumluluğu', lumiva: 89, typical: 58 },
              { label: 'Reaktivasyon verimi', lumiva: 81, typical: 46 },
              { label: 'Kanal atıf netliği', lumiva: 90, typical: 54 },
            ],
            lifecycleTitle: 'Fazlara göre senaryo yaşam döngüsü',
            lifecycleLabel: 'Faz',
            lifecycle: [
              'Sinyal toplama ve önceliklendirme kuralları',
              'Otomatik atama ve ilk temas',
              'SLA izleme ve eskalasyon yolu',
              'Reaktivasyon ve dönüşüm optimizasyonu',
            ],
            compareTitle: 'Lumiva senaryo modeli ve tipik CRM akışları',
            compareMetricLabel: 'Metrik',
            compareLumivaLabel: 'Lumiva modeli',
            compareTypicalLabel: 'Tipik CRM akışı',
            compareRows: [
              {
                metric: 'Senaryo devreye alma hızı',
                lumiva: 'Template + kural bazlı kurulum',
                typical: 'Manuel ve parçalı kurulum',
              },
              {
                metric: 'Süreç tutarlılığı',
                lumiva: 'Aşama mantığı ve rol kontrolü',
                typical: 'Kişisel disipline bağlı',
              },
              {
                metric: 'Darboğaz görünürlüğü',
                lumiva: 'Gerçek zamanlı SLA ve aşama görünürlüğü',
                typical: 'Gecikmeli rapor ve kör alanlar',
              },
              {
                metric: 'Optimizasyon döngüsü',
                lumiva: 'Ölçülebilir kontrol noktalarıyla hızlı',
                typical: 'Zayıf geri bildirimle yavaş',
              },
            ],
            faqTitle: 'Müşteri soruları',
            faqItems: [
              {
                q: 'Farklı departmanlar için aynı anda senaryo çalıştırabilir miyiz?',
                a: 'Evet. Her ekip için ayrı kurallar tanımlanırken ortak kontrol ve raporlama modeli korunur.',
              },
              {
                q: 'Aşırı otomasyon riskini nasıl yönetiyoruz?',
                a: 'Her senaryoda kontrol noktaları, rol sorumluluğu ve eskalasyon yapısı bulunur.',
              },
              {
                q: 'Canlıdan sonra senaryoları optimize edebilir miyiz?',
                a: 'Evet. Aşama bazlı KPI ile hızlı ve veriye dayalı iyileştirme yapılır.',
              },
            ],
            safeTitle: 'Güvenli otomasyon prensibi',
            safeItems: [
              'Durum geçişleri rol ve aşama kurallarıyla doğrulanır',
              'Kritik işlemler denetim kaydında tutulur',
              'Retry ve fallback kuralları veri kaybını engeller',
              'Analitik tüm kanallarda tutarlı kalır',
            ],
          }
        : {
            heroTitle: 'Сценарии, которые конвертируются в выручку',
            heroBody:
              'Сценарии Lumiva превращают CRM из пассивной базы в активную операционную систему. Входящий роутинг, SLA-контроль, реактивация и аналитика каналов работают в единой логике.',
            heroTags: ['Сценарная оркестрация', 'SLA-дисциплина', 'Предсказуемая конверсия'],
            topStats: [
              { value: '+27%', label: 'Ускорение перехода лидов в сделки' },
              { value: '-34%', label: 'Пропущенные follow-up после автоматизации' },
              { value: '92%', label: 'Согласованность выполнения сценариев' },
            ],
            modelTitle: 'Проектирование сценариев в единой модели операций',
            modelBody:
              'Сценарии строятся вокруг реальных этапов воронки, SLA-правил и контрольных точек конверсии. Можно объединять входящий роутинг, реактивацию и автоматизацию задач в одну управляемую цепочку.',
            metricsTitle: 'Метрики исполнения сценариев',
            metrics: [
              { label: 'Точность маршрутизации лидов', lumiva: 93, typical: 67 },
              { label: 'Соблюдение SLA', lumiva: 89, typical: 58 },
              { label: 'Эффективность реактивации', lumiva: 81, typical: 46 },
              { label: 'Прозрачность атрибуции каналов', lumiva: 90, typical: 54 },
            ],
            lifecycleTitle: 'Жизненный цикл сценария по этапам',
            lifecycleLabel: 'Этап',
            lifecycle: [
              'Сбор сигналов и правила квалификации',
              'Автоматическое назначение и первый контакт',
              'Мониторинг SLA и эскалации',
              'Реактивация и оптимизация конверсии',
            ],
            compareTitle: 'Модель сценариев Lumiva vs типичные CRM-процессы',
            compareMetricLabel: 'Метрика',
            compareLumivaLabel: 'Модель Lumiva',
            compareTypicalLabel: 'Типичный CRM-поток',
            compareRows: [
              {
                metric: 'Скорость запуска сценария',
                lumiva: 'Template + правила этапов',
                typical: 'Ручная и фрагментированная настройка',
              },
              {
                metric: 'Согласованность процесса',
                lumiva: 'Контроль ролями и логикой этапов',
                typical: 'Зависимость от дисциплины сотрудников',
              },
              {
                metric: 'Видимость узких мест',
                lumiva: 'Наблюдаемость в реальном времени',
                typical: 'Запаздывающие отчеты и слепые зоны',
              },
              {
                metric: 'Цикл оптимизации',
                lumiva: 'Быстрые итерации по KPI',
                typical: 'Медленный цикл с размытым фидбеком',
              },
            ],
            faqTitle: 'Частые вопросы клиентов',
            faqItems: [
              {
                q: 'Можно ли одновременно запустить сценарии для разных отделов?',
                a: 'Да. Для отделов задаются отдельные правила, но контроль и отчетность остаются в общей модели.',
              },
              {
                q: 'Как избежать “перегиба” с автоматизацией?',
                a: 'Через контрольные точки, ролевую ответственность и эскалации на ключевых этапах.',
              },
              {
                q: 'Можно ли улучшать сценарии после запуска?',
                a: 'Да, мы опираемся на метрики этапов и регулярно вносим точечные улучшения.',
              },
            ],
            safeTitle: 'Принцип безопасной автоматизации',
            safeItems: [
              'Переходы статусов валидируются по ролям и правилам этапов',
              'Критичные действия фиксируются в audit-журнале',
              'Retry и fallback-логика предотвращают потери данных',
              'Аналитика остается консистентной по всем каналам',
            ],
          };
  return (
    <PublicPageLayout
      pageKey="scenarios"
      title={t('publicPages.scenarios.title')}
      subtitle={t('publicPages.scenarios.subtitle')}
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

        <section className="grid gap-4 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <article
              key={scenario.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition-all hover:border-slate-400 hover:shadow-[0_20px_45px_rgba(15,23,42,0.1)]"
            >
              <h3 className="text-base font-semibold text-slate-900">{scenario.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{scenario.text}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.modelTitle}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{text.modelBody}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.metricsTitle}</h3>
          <div className="mt-3 space-y-3">
            {text.metrics.map((m) => (
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
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.lifecycleTitle}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {text.lifecycle.map((step, idx) => (
              <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {text.lifecycleLabel} {idx + 1}
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.safeTitle}</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {text.safeItems.map((item) => (
              <li key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PublicPageLayout>
  );
}

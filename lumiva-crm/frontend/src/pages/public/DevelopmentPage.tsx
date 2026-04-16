import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function DevelopmentPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2) as 'ru' | 'en' | 'tr';
  const cards = t('publicPages.development.cards', { returnObjects: true }) as Array<{
    title: string;
    text: string;
  }>;
  const text =
    lang === 'en'
      ? {
          heroTitle: 'CRM development that adapts to your process',
          heroBody:
            'We design and implement CRM architecture around your real business flow. The model is built for fast launch, transparent governance, and long-term scalability without repeated platform rebuilds.',
          heroTags: ['Process-first architecture', 'Predictable delivery', 'Scale-ready model'],
          topStats: [
            { value: 'x1.9', label: 'Faster rollout versus typical implementation' },
            { value: '96%', label: 'Feature adoption in active teams' },
            { value: '-31%', label: 'Time spent on manual coordination' },
          ],
          deliveryTitle: 'How implementation is delivered',
          deliveryBody:
            'We run implementation by short milestones: process map, prototype validation, integration wave, and production launch with team onboarding. Every stage is measurable and aligned with business KPI.',
          metricsTitle: 'Delivery and operational metrics',
          metrics: [
            { label: 'Implementation visibility', lumiva: 93, typical: 61 },
            { label: 'Speed of process updates', lumiva: 89, typical: 56 },
            { label: 'Cross-team execution consistency', lumiva: 91, typical: 58 },
            { label: 'Readiness for growth', lumiva: 94, typical: 63 },
          ],
          compareTitle: 'Lumiva development model vs typical CRM rollout',
          phaseLabel: 'Phase',
          compareMetricLabel: 'Metric',
          compareLumivaLabel: 'Lumiva model',
          compareTypicalLabel: 'Typical approach',
          compareRows: [
            {
              metric: 'Time to business-ready environment',
              lumiva: 'Incremental release by priorities',
              typical: 'Large single-phase deployment',
            },
            {
              metric: 'Changes after go-live',
              lumiva: 'Configurable and controllable',
              typical: 'Often requires custom rebuild',
            },
            {
              metric: 'Leadership visibility',
              lumiva: 'KPI-linked process observability',
              typical: 'Fragmented reports and manual checks',
            },
            {
              metric: 'Scale to new teams',
              lumiva: 'Standardized and repeatable',
              typical: 'High operational overhead',
            },
          ],
          faqTitle: 'Client FAQ',
          faqItems: [
            {
              q: 'Will implementation disrupt daily operations?',
              a: 'No. We use phased rollout so teams continue working while key flows are introduced and validated.',
            },
            {
              q: 'Can we prioritize one department first?',
              a: 'Yes. Many projects begin with sales, then expand to marketing and project operations in controlled stages.',
            },
            {
              q: 'How do we ensure quality after launch?',
              a: 'With KPI checkpoints, role-based controls, and post-launch monitoring that catches gaps early.',
            },
          ],
          qualityTitle: 'Speed, quality and governance',
          qualityItems: [
            'Single source of truth for leads, deals, projects and billing',
            'SLA controls with alerts for overdue stages and tasks',
            'Role-based data access with auditable operations',
            'Scalable architecture for additional modules and teams',
          ],
        }
      : lang === 'tr'
        ? {
            heroTitle: 'Süreçlerinize uyum sağlayan CRM geliştirme modeli',
            heroBody:
              'CRM mimarisini gerçek iş akışınıza göre tasarlayıp devreye alıyoruz. Model; hızlı başlangıç, yönetilebilir operasyon ve tekrar kurulum gerektirmeyen ölçeklenme için hazırlanır.',
            heroTags: ['Süreç odaklı mimari', 'Öngörülebilir teslimat', 'Ölçeklenebilir model'],
            topStats: [
              { value: 'x1.9', label: 'Tipik kurulumlara göre daha hızlı yayına alma' },
              { value: '96%', label: 'Aktif ekiplerde özellik benimseme oranı' },
              { value: '-31%', label: 'Manuel koordinasyon süresi' },
            ],
            deliveryTitle: 'Uygulama nasıl teslim edilir',
            deliveryBody:
              'Kurulumu kısa fazlarla yürütüyoruz: süreç haritası, prototip doğrulama, entegrasyon dalgası ve ekip adaptasyonu ile canlı geçiş. Her faz ölçülebilir KPI hedeflerine bağlanır.',
            metricsTitle: 'Teslimat ve operasyon metrikleri',
            metrics: [
              { label: 'Kurulum görünürlüğü', lumiva: 93, typical: 61 },
              { label: 'Süreç güncelleme hızı', lumiva: 89, typical: 56 },
              { label: 'Ekipler arası uygulama tutarlılığı', lumiva: 91, typical: 58 },
              { label: 'Büyümeye hazırlık', lumiva: 94, typical: 63 },
            ],
            compareTitle: 'Lumiva modeli ve tipik CRM kurulum karşılaştırması',
            phaseLabel: 'Faz',
            compareMetricLabel: 'Metrik',
            compareLumivaLabel: 'Lumiva modeli',
            compareTypicalLabel: 'Tipik yaklaşım',
            compareRows: [
              {
                metric: 'İş kullanımına hazır ortama geçiş süresi',
                lumiva: 'Öncelik bazlı kademeli yayın',
                typical: 'Tek seferde büyük kurulum',
              },
              {
                metric: 'Canlı sonrası değişiklik yönetimi',
                lumiva: 'Yapılandırılabilir ve kontrollü',
                typical: 'Sıkça custom yeniden geliştirme',
              },
              {
                metric: 'Yönetim görünürlüğü',
                lumiva: 'KPI bağlı süreç izlenebilirliği',
                typical: 'Parçalı rapor ve manuel kontrol',
              },
              {
                metric: 'Yeni ekip/ülke ölçekleme',
                lumiva: 'Standartlaştırılmış ve tekrar edilebilir',
                typical: 'Yüksek operasyon yükü',
              },
            ],
            faqTitle: 'Müşteri soruları',
            faqItems: [
              {
                q: 'Kurulum günlük operasyonu kesintiye uğratır mı?',
                a: 'Hayır. Kademeli geçiş modeliyle ekipler çalışmaya devam ederken ana akışlar devreye alınır.',
              },
              {
                q: 'Önce tek departmanla başlayabilir miyiz?',
                a: 'Evet. Genelde satışla başlar, ardından pazarlama ve proje ekipleri kontrollü şekilde eklenir.',
              },
              {
                q: 'Canlı sonrası kalite nasıl korunuyor?',
                a: 'KPI kontrol noktaları, rol bazlı yetki modeli ve izleme katmanı ile kalite sürdürülebilir olur.',
              },
            ],
            qualityTitle: 'Hız, kalite ve yönetilebilirlik',
            qualityItems: [
              'Lead, fırsat, proje ve faturalamada tek veri modeli',
              'Geciken adımlar ve görevler için SLA uyarıları',
              'Rol bazlı erişim ve denetlenebilir operasyon akışı',
              'Yeni modül ve ekipler için ölçeklenebilir mimari',
            ],
          }
        : {
          heroTitle: 'CRM-разработка, адаптированная под ваш процесс',
          heroBody:
            'Мы проектируем и внедряем CRM-архитектуру под реальный рабочий цикл вашей команды. Подход рассчитан на быстрый запуск, прозрачное управление и масштабирование без постоянной переделки системы.',
          heroTags: ['Процессная архитектура', 'Предсказуемый rollout', 'Масштабируемая модель'],
          topStats: [
            { value: 'x1.9', label: 'Быстрее запуск по сравнению с типичным внедрением' },
            { value: '96%', label: 'Уровень принятия функций активными командами' },
            { value: '-31%', label: 'Снижение ручной координации' },
          ],
            deliveryTitle: 'Как проходит внедрение',
            deliveryBody:
              'Мы ведем проект короткими этапами: карта процессов, валидация прототипа, волна интеграций и запуск в прод с адаптацией команды. Каждый этап привязан к измеримым KPI бизнеса.',
          metricsTitle: 'Метрики внедрения и операционной устойчивости',
          metrics: [
            { label: 'Прозрачность внедрения', lumiva: 93, typical: 61 },
            { label: 'Скорость обновления процессов', lumiva: 89, typical: 56 },
            { label: 'Согласованность выполнения между отделами', lumiva: 91, typical: 58 },
            { label: 'Готовность к росту', lumiva: 94, typical: 63 },
          ],
          compareTitle: 'Модель Lumiva vs типичный подход CRM-внедрения',
          phaseLabel: 'Этап',
          compareMetricLabel: 'Метрика',
          compareLumivaLabel: 'Модель Lumiva',
          compareTypicalLabel: 'Типичный подход',
          compareRows: [
            {
              metric: 'Срок до рабочей бизнес-среды',
              lumiva: 'Поэтапный запуск по приоритетам',
              typical: 'Крупный одноэтапный rollout',
            },
            {
              metric: 'Изменения после запуска',
              lumiva: 'Гибко настраиваются и контролируются',
              typical: 'Часто требуют новой разработки',
            },
            {
              metric: 'Видимость для руководства',
              lumiva: 'KPI-связанная наблюдаемость процессов',
              typical: 'Фрагментированные отчеты и ручной контроль',
            },
            {
              metric: 'Масштаб на новые команды',
              lumiva: 'Стандартизируемо и повторяемо',
              typical: 'Высокая операционная нагрузка',
            },
          ],
          faqTitle: 'Частые вопросы клиентов',
          faqItems: [
            {
              q: 'Внедрение остановит текущую работу команды?',
              a: 'Нет. Мы внедряем поэтапно: команда продолжает работать, пока ключевые потоки последовательно запускаются.',
            },
            {
              q: 'Можно начать с одного отдела?',
              a: 'Да. Обычно стартуем с продаж, затем подключаем маркетинг и проектный контур.',
            },
            {
              q: 'Как держать качество после go-live?',
              a: 'Через KPI-контроль, ролевую модель и наблюдаемость процессов в постзапуске.',
            },
          ],
            qualityTitle: 'Скорость, качество и управляемость',
            qualityItems: [
              'Единая модель данных для лидов, сделок, проектов и биллинга',
              'SLA-контроль и уведомления по просроченным этапам и задачам',
              'Ролевая модель доступа и аудит ключевых действий',
              'Масштабируемая архитектура под новые модули и команды',
            ],
          };
  const timeline = t('publicPages.development.timeline', { returnObjects: true }) as string[];

  return (
    <PublicPageLayout
      pageKey="development"
      title={t('publicPages.development.title')}
      subtitle={t('publicPages.development.subtitle')}
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
          {cards.map((item) => (
            <article
              key={item.title}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-[0_24px_50px_rgba(15,23,42,0.12)]"
            >
              <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.text}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.deliveryTitle}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{text.deliveryBody}</p>
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
          <h3 className="text-sm font-semibold text-slate-900">{t('publicPages.development.timelineTitle')}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {timeline.map((step, idx) => (
              <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {text.phaseLabel} {idx + 1}
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
          <h3 className="text-sm font-semibold text-slate-900">{text.qualityTitle}</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {text.qualityItems.map((item) => (
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

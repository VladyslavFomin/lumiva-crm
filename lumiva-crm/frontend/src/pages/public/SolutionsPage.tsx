import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function SolutionsPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2) as 'ru' | 'en' | 'tr';
  const items = t('publicPages.solutions.items', { returnObjects: true }) as Array<{
    title: string;
    text: string;
  }>;
  const text =
    lang === 'en'
      ? {
          heroTitle: 'Solution blueprints for different growth models',
          heroBody:
            'Lumiva solutions are configured by your business reality: sales cycle length, team structure, channel mix and operating priorities. The goal is to keep execution clear today and scalable tomorrow.',
          heroTags: ['Industry-fit modules', 'Role-based control', 'Scalable by design'],
          topStats: [
            { value: 'x1.8', label: 'Faster cross-team alignment' },
            { value: '94%', label: 'Process transparency for leadership' },
            { value: '+22%', label: 'Retention visibility after rollout' },
          ],
          introTitle: 'Solution architecture by revenue model',
          introBody:
            'We configure module composition by your business model: inbound-heavy, account-based sales, project delivery, or hybrid operations. This keeps CRM clean and fast for everyday execution.',
          metricsTitle: 'Solution effectiveness metrics',
          metrics: [
            { label: 'Fit to business process', lumiva: 92, typical: 63 },
            { label: 'Cross-functional visibility', lumiva: 90, typical: 57 },
            { label: 'Speed of operational scaling', lumiva: 88, typical: 54 },
            { label: 'Stability under growth', lumiva: 93, typical: 60 },
          ],
          frameworkTitle: 'Solution framework by business focus',
          frameworkLayerLabel: 'Business focus',
          frameworkStackLabel: 'Module stack',
          frameworkValueLabel: 'Expected effect',
          frameworkRows: [
            { layer: 'B2B complex sales', stack: 'Pipeline, SLA, account controls', value: 'Predictable stage progression and deal governance' },
            { layer: 'Marketing-led growth', stack: 'UTM analytics, attribution, lead quality', value: 'Clear source-to-revenue visibility' },
            { layer: 'Project/service delivery', stack: 'Tasks, milestones, client coordination', value: 'Execution discipline and margin protection' },
            { layer: 'Hybrid model', stack: 'Unified sales + project + billing loop', value: 'One operational model across departments' },
          ],
          compareTitle: 'Lumiva solutions vs typical CRM packaging',
          compareMetricLabel: 'Metric',
          compareLumivaLabel: 'Lumiva approach',
          compareTypicalLabel: 'Typical CRM package',
          compareRows: [
            {
              metric: 'Adaptation to real process',
              lumiva: 'Built around actual workflows',
              typical: 'Generic module bundle',
            },
            {
              metric: 'Leadership-level visibility',
              lumiva: 'Unified KPI and accountability map',
              typical: 'Separated data and manual reporting',
            },
            {
              metric: 'Scaling to new units',
              lumiva: 'Replicable and standardized',
              typical: 'Requires major reconfiguration',
            },
            {
              metric: 'Operational continuity',
              lumiva: 'Controlled rollout and iteration',
              typical: 'High disruption during changes',
            },
          ],
          faqTitle: 'Client FAQ',
          faqItems: [
            {
              q: 'Can we start with a narrow scope and scale later?',
              a: 'Yes. We define a phased map: priority module first, then structured expansion by business impact.',
            },
            {
              q: 'Will one solution fit all our teams?',
              a: 'We use one core model with role-specific views and controls, so teams work differently but remain aligned.',
            },
            {
              q: 'How do you measure solution success?',
              a: 'By operational KPIs: cycle speed, SLA adherence, conversion quality, and retention visibility.',
            },
          ],
          outcomesTitle: 'What business teams get',
          outcomes: [
            'Single operating environment for sales, marketing and project teams',
            'Clear visibility from first touch to payment and retention',
            'Secure tenant boundaries with role-specific access',
            'Scalable setup for new products, regions and workflows',
          ],
        }
      : lang === 'tr'
        ? {
            heroTitle: 'Farklı büyüme modelleri için çözüm mimarileri',
            heroBody:
              'Lumiva çözümleri iş gerçekliğinize göre yapılandırılır: satış döngüsü, ekip yapısı, kanal dağılımı ve operasyon öncelikleri. Amaç bugün net çalışma, yarın kontrollü ölçeklenmedir.',
            heroTags: ['Sektöre uygun modüller', 'Rol bazlı kontrol', 'Ölçek odaklı tasarım'],
            topStats: [
              { value: 'x1.8', label: 'Ekipler arası daha hızlı hizalama' },
              { value: '94%', label: 'Yönetim için süreç görünürlüğü' },
              { value: '+22%', label: 'Yayından sonra retention görünürlüğü' },
            ],
            introTitle: 'Gelir modeline göre çözüm mimarisi',
            introBody:
              'Modül yapısını iş modelinize göre kurguluyoruz: inbound odaklı, account-based satış, proje teslim modeli veya hibrit operasyon. Böylece CRM günlük kullanımda sade ve hızlı kalır.',
            metricsTitle: 'Çözüm etkinliği metrikleri',
            metrics: [
              { label: 'İş sürecine uyum', lumiva: 92, typical: 63 },
              { label: 'Fonksiyonlar arası görünürlük', lumiva: 90, typical: 57 },
              { label: 'Operasyon ölçekleme hızı', lumiva: 88, typical: 54 },
              { label: 'Büyümede stabilite', lumiva: 93, typical: 60 },
            ],
            frameworkTitle: 'İş odağına göre çözüm çerçevesi',
            frameworkLayerLabel: 'İş odağı',
            frameworkStackLabel: 'Modül seti',
            frameworkValueLabel: 'Beklenen etki',
            frameworkRows: [
              { layer: 'B2B karmaşık satış', stack: 'Pipeline, SLA, hesap kontrolü', value: 'Öngörülebilir aşama ilerleyişi ve satış yönetimi' },
              { layer: 'Pazarlama odaklı büyüme', stack: 'UTM analitiği, atıf, lead kalitesi', value: 'Kaynaktan gelire net görünürlük' },
              { layer: 'Proje/hizmet teslimi', stack: 'Görev, milestone, müşteri koordinasyonu', value: 'Uygulama disiplini ve marj koruması' },
              { layer: 'Hibrit model', stack: 'Birleşik satış + proje + tahsilat döngüsü', value: 'Departmanlar arası tek operasyon modeli' },
            ],
            compareTitle: 'Lumiva çözümleri ve tipik CRM paketleri',
            compareMetricLabel: 'Metrik',
            compareLumivaLabel: 'Lumiva yaklaşımı',
            compareTypicalLabel: 'Tipik CRM paketi',
            compareRows: [
              {
                metric: 'Gerçek sürece uyum',
                lumiva: 'Operasyon akışına göre tasarlanır',
                typical: 'Genel amaçlı modül paketi',
              },
              {
                metric: 'Yönetim görünürlüğü',
                lumiva: 'Birleşik KPI ve sorumluluk haritası',
                typical: 'Parçalı veri ve manuel raporlama',
              },
              {
                metric: 'Yeni birime ölçekleme',
                lumiva: 'Tekrarlanabilir ve standart',
                typical: 'Kapsamlı yeniden yapılandırma gerekir',
              },
              {
                metric: 'Operasyon sürekliliği',
                lumiva: 'Kontrollü geçiş ve iterasyon',
                typical: 'Değişimde yüksek kırılma riski',
              },
            ],
            faqTitle: 'Müşteri soruları',
            faqItems: [
              {
                q: 'Dar kapsamla başlayıp sonra büyütebilir miyiz?',
                a: 'Evet. Öncelikli modülle başlar, etkisine göre kademeli genişleme planı uygularız.',
              },
              {
                q: 'Tek çözüm tüm ekiplere uyar mı?',
                a: 'Ortak çekirdek model üzerinde ekiplere özel görünüm ve kontrol katmanı uygulanır.',
              },
              {
                q: 'Başarıyı nasıl ölçüyorsunuz?',
                a: 'Süreç KPI’larıyla: hız, SLA uyumu, dönüşüm kalitesi ve retention görünürlüğü.',
              },
            ],
            outcomesTitle: 'Ekiplerin elde ettiği sonuçlar',
            outcomes: [
              'Satış, pazarlama ve proje ekipleri için tek operasyon ortamı',
              'İlk temastan ödemeye ve elde tutmaya kadar net görünürlük',
              'Tenant izolasyonu ve rol bazlı güvenli erişim',
              'Yeni ürün, bölge ve süreçler için ölçeklenebilir kurulum',
            ],
          }
        : {
            heroTitle: 'Решения под разные модели роста бизнеса',
            heroBody:
              'Решения Lumiva собираются под вашу реальность: длительность цикла продаж, структуру команды, каналы и операционные приоритеты. Цель — понятное выполнение сегодня и масштабируемость завтра.',
            heroTags: ['Отраслевые модули', 'Ролевой контроль', 'Масштабируемая архитектура'],
            topStats: [
              { value: 'x1.8', label: 'Быстрее согласование между отделами' },
              { value: '94%', label: 'Прозрачность процессов для руководства' },
              { value: '+22%', label: 'Видимость retention после запуска' },
            ],
            introTitle: 'Архитектура решений под модель выручки',
            introBody:
              'Мы настраиваем состав модулей под вашу бизнес-модель: inbound-продажи, account-based подход, проектный контур или гибрид. За счет этого CRM остается чистой и быстрой в ежедневной работе.',
            metricsTitle: 'Метрики эффективности решения',
            metrics: [
              { label: 'Соответствие реальному процессу', lumiva: 92, typical: 63 },
              { label: 'Сквозная видимость между функциями', lumiva: 90, typical: 57 },
              { label: 'Скорость масштабирования операций', lumiva: 88, typical: 54 },
              { label: 'Стабильность при росте', lumiva: 93, typical: 60 },
            ],
            frameworkTitle: 'Фреймворк решений по бизнес-фокусу',
            frameworkLayerLabel: 'Бизнес-фокус',
            frameworkStackLabel: 'Стек модулей',
            frameworkValueLabel: 'Ожидаемый эффект',
            frameworkRows: [
              { layer: 'B2B со сложными сделками', stack: 'Pipeline, SLA, контроль аккаунтов', value: 'Предсказуемый прогресс этапов и управляемость сделок' },
              { layer: 'Маркетинг-ориентированный рост', stack: 'UTM аналитика, атрибуция, качество лидов', value: 'Прозрачность от источника до выручки' },
              { layer: 'Проектный/сервисный контур', stack: 'Задачи, этапы, клиентская координация', value: 'Дисциплина исполнения и защита маржи' },
              { layer: 'Гибридная модель', stack: 'Единый цикл продажи + проекты + биллинг', value: 'Одна операционная модель для всех отделов' },
            ],
            compareTitle: 'Решения Lumiva vs типичные CRM-пакеты',
            compareMetricLabel: 'Метрика',
            compareLumivaLabel: 'Подход Lumiva',
            compareTypicalLabel: 'Типичный CRM-пакет',
            compareRows: [
              {
                metric: 'Адаптация к реальному процессу',
                lumiva: 'Собирается под фактические workflows',
                typical: 'Универсальный набор модулей',
              },
              {
                metric: 'Видимость для руководителя',
                lumiva: 'Единая KPI-карта и ответственность',
                typical: 'Разрозненные данные и ручные отчеты',
              },
              {
                metric: 'Масштабирование на новые юниты',
                lumiva: 'Стандартизировано и повторяемо',
                typical: 'Требует глубокой перенастройки',
              },
              {
                metric: 'Операционная непрерывность',
                lumiva: 'Контролируемый rollout и итерации',
                typical: 'Высокий риск сбоев при изменениях',
              },
            ],
            faqTitle: 'Частые вопросы клиентов',
            faqItems: [
              {
                q: 'Можно начать с ограниченного объема и масштабироваться?',
                a: 'Да. Стартуем с приоритетного модуля и расширяемся поэтапно по бизнес-эффекту.',
              },
              {
                q: 'Одно решение подходит всем отделам?',
                a: 'Используем единое ядро с ролевыми интерфейсами, чтобы отделы работали по-разному, но в одной модели.',
              },
              {
                q: 'По каким метрикам оцениваете успех?',
                a: 'По операционным KPI: скорость цикла, SLA, качество конверсии и прозрачность retention.',
              },
            ],
            outcomesTitle: 'Что получает бизнес-команда',
            outcomes: [
              'Единая операционная среда для продаж, маркетинга и проектных команд',
              'Прозрачность от первого касания до оплаты и удержания',
              'Изолированный tenant-контур и ролевой доступ к данным',
              'Масштабируемая конфигурация для новых продуктов и регионов',
            ],
          };
  return (
    <PublicPageLayout
      pageKey="solutions"
      title={t('publicPages.solutions.title')}
      subtitle={t('publicPages.solutions.subtitle')}
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
          {items.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-400 hover:shadow-[0_20px_45px_rgba(15,23,42,0.1)]"
            >
              <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.text}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{text.introTitle}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{text.introBody}</p>
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
          <h3 className="text-sm font-semibold text-slate-900">{text.frameworkTitle}</h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {text.frameworkLayerLabel}
                  </th>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {text.frameworkStackLabel}
                  </th>
                  <th className="border border-slate-200 bg-indigo-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-indigo-700">
                    {text.frameworkValueLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {text.frameworkRows.map((row) => (
                  <tr key={row.layer}>
                    <td className="border border-slate-200 px-3 py-2 text-slate-700">{row.layer}</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-600">{row.stack}</td>
                    <td className="border border-slate-200 bg-indigo-50/60 px-3 py-2 text-slate-800">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <h3 className="text-sm font-semibold text-slate-900">{text.outcomesTitle}</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {text.outcomes.map((item) => (
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

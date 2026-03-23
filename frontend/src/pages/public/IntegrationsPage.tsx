import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function IntegrationsPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2) as 'ru' | 'en' | 'tr';
  const text =
    lang === 'en'
      ? {
          title: 'Integrations and data exchange',
          subtitle:
            'Connect CRM with telephony, ad platforms, forms, messengers and internal systems through stable sync patterns.',
          heroTitle: 'Integrations that stay reliable while your business grows',
          heroBody:
            'Lumiva integration model keeps data, statuses and ownership aligned across channels. You can launch one critical flow fast, then expand to a full multi-channel setup without rebuilding your operating model.',
          heroTags: ['Bi-directional sync', 'Fast rollout', 'Scale-ready governance'],
          topStats: [
            { value: 'x2.0', label: 'Faster onboarding of new channels' },
            { value: '98.9%', label: 'Sync consistency across systems' },
            { value: '-35%', label: 'Manual reconciliation workload' },
          ],
          blocks: [
            {
              title: 'Bi-directional sync',
              body: 'We map source fields, status transitions and ownership rules so external systems and CRM stay consistent.',
            },
            {
              title: 'Fast onboarding',
              body: 'Standard adapters and webhook pipelines help launch core integrations quickly without risky rewrites.',
            },
            {
              title: 'Secure transport',
              body: 'Access tokens, signed callbacks and validation layers protect your integration perimeter.',
            },
            {
              title: 'Monitoring and support',
              body: 'Sync logs, retry queues and alert points make incidents visible before they impact revenue.',
            },
          ],
          metricsTitle: 'Integration health and performance',
          metrics: [
            { label: 'Successful sync runs', lumiva: 95, typical: 76 },
            { label: 'Visibility of integration incidents', lumiva: 90, typical: 58 },
            { label: 'Change implementation speed', lumiva: 88, typical: 54 },
            { label: 'Cross-team operational consistency', lumiva: 92, typical: 61 },
          ],
          matrixTitle: 'Integration matrix by business layer',
          matrixLayerLabel: 'Layer',
          matrixSystemsLabel: 'Connected systems',
          matrixValueLabel: 'Business value',
          matrixRows: [
            { layer: 'Lead intake', examples: 'Forms, LP, messengers', value: 'Fast capture and routing without data loss' },
            { layer: 'Sales operations', examples: 'Telephony, pipeline events', value: 'Aligned statuses and SLA control' },
            { layer: 'Revenue events', examples: 'Billing, payments', value: 'Consistent transition from deal to payment' },
            { layer: 'Management analytics', examples: 'BI, reporting stacks', value: 'End-to-end visibility for leadership' },
          ],
          faqTitle: 'Client FAQ',
          faqItems: [
            {
              q: 'Can we start with one integration and scale later?',
              a: 'Yes. The model is incremental: launch one critical flow first, validate, then add channels with minimal disruption.',
            },
            {
              q: 'What happens when process logic changes?',
              a: 'Mappings and event rules are adapted without full migration, which keeps delivery speed predictable.',
            },
            {
              q: 'How do you reduce integration risk?',
              a: 'Controlled rollout, retry strategy, and observable sync logs lower production risk significantly.',
            },
          ],
        }
      : lang === 'tr'
        ? {
            title: 'Entegrasyonlar ve veri alışverişi',
            subtitle:
              'CRM sisteminizi telefon, reklam platformları, formlar, mesajlaşma kanalları ve dahili servislerle güvenli senkronizasyon yapısında bağlayın.',
            heroTitle: 'İş büyürken stabil kalan entegrasyon modeli',
            heroBody:
              'Lumiva entegrasyon yaklaşımı; veri, durum ve sorumluluk akışını kanallar arasında tutarlı tutar. Önce kritik bir akışı hızla yayına alır, ardından modeli bozmadan çok kanallı yapıya geçersiniz.',
            heroTags: ['Çift yönlü senkron', 'Hızlı devreye alma', 'Ölçek odaklı yönetişim'],
            topStats: [
              { value: 'x2.0', label: 'Yeni kanal devreye alma hızı' },
              { value: '98.9%', label: 'Sistemler arası senkron tutarlılığı' },
              { value: '-35%', label: 'Manuel mutabakat iş yükü' },
            ],
            blocks: [
              {
                title: 'Çift yönlü senkronizasyon',
                body: 'Kaynak alanları, durum geçişleri ve sorumluluk kuralları tanımlanarak CRM ile dış sistemler tutarlı tutulur.',
              },
              {
                title: 'Hızlı devreye alma',
                body: 'Hazır adaptörler ve webhook akışları kritik entegrasyonları yeniden yazım riski olmadan hızlıca yayına alır.',
              },
              {
                title: 'Güvenli veri taşınması',
                body: 'Access token, imzalı callback ve doğrulama katmanları entegrasyon çevresini korur.',
              },
              {
                title: 'İzleme ve destek',
                body: 'Senkron logları, retry kuyrukları ve uyarılar sorunları gelir etkilenmeden görünür kılar.',
              },
            ],
            metricsTitle: 'Entegrasyon sağlık ve performans metrikleri',
            metrics: [
              { label: 'Başarılı senkron çalışma oranı', lumiva: 95, typical: 76 },
              { label: 'Entegrasyon hatası görünürlüğü', lumiva: 90, typical: 58 },
              { label: 'Değişiklik uygulama hızı', lumiva: 88, typical: 54 },
              { label: 'Ekipler arası operasyon tutarlılığı', lumiva: 92, typical: 61 },
            ],
            matrixTitle: 'İş katmanına göre entegrasyon matrisi',
            matrixLayerLabel: 'Katman',
            matrixSystemsLabel: 'Bağlı sistemler',
            matrixValueLabel: 'İş değeri',
            matrixRows: [
              { layer: 'Lead toplama', examples: 'Formlar, LP, mesajlaşma', value: 'Veri kaybı olmadan hızlı yakalama ve yönlendirme' },
              { layer: 'Satış operasyonu', examples: 'Telefon, pipeline olayları', value: 'Durum hizalama ve SLA kontrolü' },
              { layer: 'Gelir olayları', examples: 'Faturalama, ödeme', value: 'Fırsattan tahsilata tutarlı geçiş' },
              { layer: 'Yönetim analitiği', examples: 'BI, raporlama stacki', value: 'Liderlik için uçtan uca görünürlük' },
            ],
            faqTitle: 'Müşteri soruları',
            faqItems: [
              {
                q: 'Tek entegrasyonla başlayıp sonra büyütebilir miyiz?',
                a: 'Evet. Model kademeli çalışır: önce kritik akış, sonra doğrulama, ardından düşük riskle kanal genişletme.',
              },
              {
                q: 'Süreç değişirse entegrasyon bozulur mu?',
                a: 'Hayır. Mapping ve event kuralları güncellenir, tam migrasyon gerektirmez.',
              },
              {
                q: 'Entegrasyon riskini nasıl düşürüyorsunuz?',
                a: 'Kontrollü rollout, retry stratejisi ve izlenebilir senkron logları ile üretim riski düşürülür.',
              },
            ],
          }
        : {
            title: 'Интеграции и обмен данными',
            subtitle:
              'Подключайте CRM к телефонии, рекламным платформам, формам, мессенджерам и внутренним системам через стабильные контуры синхронизации.',
            heroTitle: 'Интеграции, которые остаются стабильными при росте бизнеса',
            heroBody:
              'Модель интеграций Lumiva синхронизирует данные, статусы и зоны ответственности между каналами. Можно быстро запустить критичный поток, а затем расшириться до многоканального контура без ломки процессов.',
            heroTags: ['Двусторонняя синхронизация', 'Быстрый запуск', 'Масштабируемая модель'],
            topStats: [
              { value: 'x2.0', label: 'Быстрее подключение новых каналов' },
              { value: '98.9%', label: 'Согласованность синхронизаций между системами' },
              { value: '-35%', label: 'Снижение ручной сверки данных' },
            ],
            blocks: [
              {
                title: 'Двусторонняя синхронизация',
                body: 'Настраиваем соответствие полей, переходы статусов и ответственность, чтобы внешние системы и CRM не расходились.',
              },
              {
                title: 'Быстрый запуск',
                body: 'Типовые адаптеры и webhook-пайплайны позволяют быстро запускать ключевые интеграции без рискованных переписываний.',
              },
              {
                title: 'Защищенный контур',
                body: 'Access token, подпись callback-запросов и обязательная валидация защищают контур обмена данными.',
              },
              {
                title: 'Мониторинг и поддержка',
                body: 'Логи синхронизаций, retry-очереди и точки алертов помогают ловить инциденты до влияния на выручку.',
              },
            ],
            metricsTitle: 'Метрики здоровья и эффективности интеграций',
            metrics: [
              { label: 'Успешные синхронизации', lumiva: 95, typical: 76 },
              { label: 'Наблюдаемость интеграционных инцидентов', lumiva: 90, typical: 58 },
              { label: 'Скорость внедрения изменений', lumiva: 88, typical: 54 },
              { label: 'Согласованность между командами', lumiva: 92, typical: 61 },
            ],
            matrixTitle: 'Матрица интеграций по бизнес-уровням',
            matrixLayerLabel: 'Уровень',
            matrixSystemsLabel: 'Подключенные системы',
            matrixValueLabel: 'Бизнес-ценность',
            matrixRows: [
              { layer: 'Прием лидов', examples: 'Формы, LP, мессенджеры', value: 'Быстрый захват и маршрутизация без потерь' },
              { layer: 'Операции продаж', examples: 'Телефония, pipeline-события', value: 'Согласованные статусы и SLA-контроль' },
              { layer: 'Выручка и оплата', examples: 'Биллинг, платежи', value: 'Цельный путь от сделки до оплаты' },
              { layer: 'Управленческая аналитика', examples: 'BI, отчетные системы', value: 'Сквозная прозрачность для руководителя' },
            ],
            faqTitle: 'Частые вопросы клиентов',
            faqItems: [
              {
                q: 'Можно стартовать с одного подключения и расшириться позже?',
                a: 'Да. Подход итеративный: сначала критичный поток, затем проверка и расширение на новые каналы.',
              },
              {
                q: 'Что если логика процесса меняется?',
                a: 'Мы обновляем mapping и правила событий, без полной миграции платформы.',
              },
              {
                q: 'Как вы снижаете риски при интеграции?',
                a: 'Используем контролируемый rollout, retry-логику и прозрачные логи синхронизаций.',
              },
            ],
          };

  return (
    <PublicPageLayout pageKey="integrations" title={text.title} subtitle={text.subtitle}>
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {text.blocks.map((block) => (
            <article key={block.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">{block.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{block.body}</p>
            </article>
          ))}
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
          <h3 className="text-sm font-semibold text-slate-900">{text.matrixTitle}</h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {text.matrixLayerLabel}
                  </th>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {text.matrixSystemsLabel}
                  </th>
                  <th className="border border-slate-200 bg-indigo-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-indigo-700">
                    {text.matrixValueLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {text.matrixRows.map((row) => (
                  <tr key={row.layer}>
                    <td className="border border-slate-200 px-3 py-2 text-slate-700">{row.layer}</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-600">{row.examples}</td>
                    <td className="border border-slate-200 bg-indigo-50/60 px-3 py-2 text-slate-800">{row.value}</td>
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

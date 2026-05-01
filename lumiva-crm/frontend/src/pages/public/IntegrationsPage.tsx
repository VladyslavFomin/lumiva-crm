import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

type Lang = 'ru' | 'en' | 'tr';

/* ── Icons ── */
type IP = { className?: string };
const IC = {
  Arrow:  ({ className = 'w-4 h-4' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>,
  Check:  ({ className = 'w-3 h-3' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>,
  Plug:   ({ className = 'w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/></svg>,
  Sync:   ({ className = 'w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>,
  Shield: ({ className = 'w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Eye:    ({ className = 'w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Zap:    ({ className = 'w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
};

/* ── Copy ── */
const T = {
  ru: {
    kicker: 'ИНТЕГРАЦИИ · 80+ КОННЕКТОРОВ',
    title1: 'Ваши данные — там,',
    title2: 'где нужно бизнесу.',
    sub: 'Подключайте CRM к рекламным платформам, мессенджерам, телефонии, ERP и кастомным системам через двустороннюю синхронизацию.',
    stat1v: '80+', stat1l: 'готовых коннекторов',
    stat2v: '98.9%', stat2l: 'согласованность синхронизаций',
    stat3v: '×2', stat3l: 'быстрее запуск нового канала',
    stat4v: '−35%', stat4l: 'ручной сверки данных',
    catLabel: 'Категория',
    catAll: 'Все',
    cats: ['Реклама', 'CRM / ERP', 'Мессенджеры', 'Телефония', 'Аналитика', 'No-code'],
    integrationsLabel: 'Интеграции',
    ctaKicker: 'НЕ НАШЛИ НУЖНЫЙ КОННЕКТОР?',
    ctaTitle: 'Свяжитесь с нами — подключим за 5 рабочих дней.',
    ctaBtn: 'Запросить интеграцию',
    ctaDemo: 'Посмотреть демо',
    howTitle: 'Как устроена интеграция',
    howSteps: [
      { n: '01', t: 'Двусторонняя синхронизация', d: 'Настраиваем соответствие полей, переходы статусов и ответственность — внешние системы и CRM остаются консистентны.' },
      { n: '02', t: 'Быстрый запуск', d: 'Типовые адаптеры и webhook-пайплайны позволяют подключить критичный поток без рискованных переписываний.' },
      { n: '03', t: 'Защищённый контур', d: 'Access token, подпись callback-запросов и валидация защищают всю цепочку обмена данными.' },
      { n: '04', t: 'Мониторинг 24/7', d: 'Логи синхронизаций, retry-очереди и point-алерты помогают поймать инцидент до влияния на выручку.' },
    ],
    faqTitle: 'Частые вопросы',
    faq: [
      { q: 'Можно стартовать с одного подключения?', a: 'Да. Подход итеративный: сначала критичный поток, проверка, затем расширение на новые каналы без поломки процессов.' },
      { q: 'Что будет при изменении логики процесса?', a: 'Обновляем mapping и правила событий — полной миграции платформы не требуется.' },
      { q: 'Как вы снижаете риски при интеграции?', a: 'Контролируемый rollout, retry-логика и прозрачные логи синхронизаций снижают продакшен-риски в разы.' },
    ],
  },
  en: {
    kicker: 'INTEGRATIONS · 80+ CONNECTORS',
    title1: 'Your data — exactly',
    title2: 'where business needs it.',
    sub: 'Connect CRM to ad platforms, messengers, telephony, ERP and custom systems via bi-directional sync.',
    stat1v: '80+', stat1l: 'ready connectors',
    stat2v: '98.9%', stat2l: 'sync consistency',
    stat3v: '×2', stat3l: 'faster channel onboarding',
    stat4v: '−35%', stat4l: 'manual reconciliation',
    catLabel: 'Category',
    catAll: 'All',
    cats: ['Advertising', 'CRM / ERP', 'Messengers', 'Telephony', 'Analytics', 'No-code'],
    integrationsLabel: 'Integrations',
    ctaKicker: 'MISSING A CONNECTOR?',
    ctaTitle: 'Reach out — we ship custom integrations in 5 business days.',
    ctaBtn: 'Request integration',
    ctaDemo: 'Watch demo',
    howTitle: 'How integrations work',
    howSteps: [
      { n: '01', t: 'Bi-directional sync', d: 'We map source fields, status transitions and ownership rules so CRM and external systems stay consistent.' },
      { n: '02', t: 'Fast rollout', d: 'Standard adapters and webhook pipelines let you launch a critical flow quickly without risky rewrites.' },
      { n: '03', t: 'Secure transport', d: 'Access tokens, signed callbacks and validation layers protect your entire integration perimeter.' },
      { n: '04', t: '24/7 monitoring', d: 'Sync logs, retry queues and alert points surface incidents before they affect revenue.' },
    ],
    faqTitle: 'FAQ',
    faq: [
      { q: 'Can we start with one integration and scale later?', a: 'Yes. The model is incremental: launch one critical flow first, validate, then expand channels without disruption.' },
      { q: 'What if process logic changes?', a: 'We update mappings and event rules — no full platform migration required.' },
      { q: 'How do you reduce integration risk?', a: 'Controlled rollout, retry strategy and observable sync logs cut production risk significantly.' },
    ],
  },
  tr: {
    kicker: 'ENTEGRASYONLAR · 80+ KONEKTÖR',
    title1: 'Verileriniz — iş süreçlerinizin',
    title2: 'tam ihtiyaç duyduğu yerde.',
    sub: 'CRM\'i reklam platformları, mesajlaşma kanalları, telefoni, ERP ve özel sistemlere çift yönlü senkron ile bağlayın.',
    stat1v: '80+', stat1l: 'hazır konektör',
    stat2v: '98.9%', stat2l: 'senkron tutarlılığı',
    stat3v: '×2', stat3l: 'daha hızlı kanal devreye alma',
    stat4v: '−35%', stat4l: 'manuel mutabakat azalması',
    catLabel: 'Kategori',
    catAll: 'Tümü',
    cats: ['Reklam', 'CRM / ERP', 'Mesajlaşma', 'Telefoni', 'Analitik', 'No-code'],
    integrationsLabel: 'Entegrasyonlar',
    ctaKicker: 'ARADĞINIZ KONEKTÖRÜ BULAMADIZ MI?',
    ctaTitle: '5 iş günü içinde özel entegrasyon geliştiriyoruz.',
    ctaBtn: 'Entegrasyon talep et',
    ctaDemo: 'Demo izle',
    howTitle: 'Entegrasyon nasıl çalışır',
    howSteps: [
      { n: '01', t: 'Çift yönlü senkronizasyon', d: 'Kaynak alanları, durum geçişleri ve sorumlulukları eşleştirerek CRM ve dış sistemleri tutarlı tutuyoruz.' },
      { n: '02', t: 'Hızlı devreye alma', d: 'Hazır adaptörler ve webhook akışları, kritik entegrasyonları yeniden yazım riski olmadan başlatır.' },
      { n: '03', t: 'Güvenli aktarım', d: 'Access token, imzalı callback ve doğrulama katmanları entegrasyon çevresini korur.' },
      { n: '04', t: '7/24 izleme', d: 'Senkron logları, retry kuyrukları ve uyarı noktaları, gelir etkilenmeden sorunları gün yüzüne çıkarır.' },
    ],
    faqTitle: 'Sık sorulan sorular',
    faq: [
      { q: 'Tek entegrasyonla başlayıp sonra genişleyebilir miyiz?', a: 'Evet. Model kademeli çalışır: önce kritik akış, sonra doğrulama ve kanal genişletme.' },
      { q: 'Süreç mantığı değişirse ne olur?', a: 'Mapping ve olay kurallarını güncelliyoruz — tam platform migrasyonuna gerek kalmıyor.' },
      { q: 'Entegrasyon riskini nasıl azaltıyorsunuz?', a: 'Kontrollü rollout, retry stratejisi ve izlenebilir senkron logları ile üretim riski önemli ölçüde düşer.' },
    ],
  },
};

/* ── Integration catalog ── */
const INTEGRATIONS: { name: string; cat: string; logo: string }[] = [
  // Advertising
  { name: 'Yandex Direct', cat: 'Реклама', logo: 'YD' },
  { name: 'Google Ads',    cat: 'Реклама', logo: 'GA' },
  { name: 'Meta Ads',      cat: 'Реклама', logo: 'FB' },
  { name: 'VK Ads',        cat: 'Реклама', logo: 'VK' },
  { name: 'TikTok Ads',    cat: 'Реклама', logo: 'TT' },
  { name: 'myTarget',      cat: 'Реклама', logo: 'MT' },
  // CRM / ERP
  { name: 'AmoCRM',        cat: 'CRM / ERP', logo: 'AM' },
  { name: 'Bitrix24',      cat: 'CRM / ERP', logo: 'B2' },
  { name: 'HubSpot',       cat: 'CRM / ERP', logo: 'HS' },
  { name: 'Salesforce',    cat: 'CRM / ERP', logo: 'SF' },
  { name: '1C',            cat: 'CRM / ERP', logo: '1C' },
  { name: 'Zoho CRM',      cat: 'CRM / ERP', logo: 'ZH' },
  // Messengers
  { name: 'WhatsApp',      cat: 'Мессенджеры', logo: 'WA' },
  { name: 'Telegram',      cat: 'Мессенджеры', logo: 'TG' },
  { name: 'Viber',         cat: 'Мессенджеры', logo: 'VB' },
  { name: 'VK Messages',   cat: 'Мессенджеры', logo: 'VK' },
  { name: 'Instagram DM',  cat: 'Мессенджеры', logo: 'IG' },
  { name: 'SMS',           cat: 'Мессенджеры', logo: 'SM' },
  // Telephony
  { name: 'Sipuni',        cat: 'Телефония', logo: 'SP' },
  { name: 'Zadarma',       cat: 'Телефония', logo: 'ZD' },
  { name: 'Mango Office',  cat: 'Телефония', logo: 'MO' },
  { name: 'UIS',           cat: 'Телефония', logo: 'UI' },
  // Analytics
  { name: 'Google Analytics 4', cat: 'Аналитика', logo: 'G4' },
  { name: 'Яндекс Метрика', cat: 'Аналитика', logo: 'YM' },
  { name: 'Roistat',       cat: 'Аналитика', logo: 'RS' },
  { name: 'Calltouch',     cat: 'Аналитика', logo: 'CT' },
  // No-code
  { name: 'Zapier',        cat: 'No-code', logo: 'ZP' },
  { name: 'Make',          cat: 'No-code', logo: 'MK' },
  { name: 'n8n',           cat: 'No-code', logo: 'N8' },
  { name: 'Albato',        cat: 'No-code', logo: 'AL' },
];

const CAT_EN: Record<string, string> = {
  'Реклама': 'Advertising',
  'CRM / ERP': 'CRM / ERP',
  'Мессенджеры': 'Messengers',
  'Телефония': 'Telephony',
  'Аналитика': 'Analytics',
  'No-code': 'No-code',
};
const CAT_TR: Record<string, string> = {
  'Реклама': 'Reklam',
  'CRM / ERP': 'CRM / ERP',
  'Мессенджеры': 'Mesajlaşma',
  'Телефония': 'Telefoni',
  'Аналитика': 'Analitik',
  'No-code': 'No-code',
};

function getCatName(cat: string, lang: Lang): string {
  if (lang === 'en') return CAT_EN[cat] ?? cat;
  if (lang === 'tr') return CAT_TR[cat] ?? cat;
  return cat;
}

/* ── Connection visual mockup ── */
const ConnectionVisual: React.FC = () => {
  const nodes = [
    { x: 50, y: 20, label: 'Yandex', icon: 'YD', color: '#ffcc00' },
    { x: 88, y: 42, label: 'Meta', icon: 'FB', color: '#1877f2' },
    { x: 88, y: 70, label: 'CRM', icon: 'AM', color: '#e6413e' },
    { x: 50, y: 88, label: 'WhatsApp', icon: 'WA', color: '#25d366' },
    { x: 12, y: 70, label: 'Zapier', icon: 'ZP', color: '#ff4a00' },
    { x: 12, y: 42, label: 'GA4', icon: 'G4', color: '#f9ab00' },
  ];
  const center = { x: 50, y: 54 };

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)] overflow-hidden">
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', marginBottom: 12 }}>
        INTEGRATION HUB · LUMIVA CRM
      </div>
      <div className="relative" style={{ paddingBottom: '80%' }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" fill="none">
          {/* Animated pulse rings on center */}
          {[16, 22, 28].map((r, i) => (
            <motion.circle
              key={r} cx="50" cy="54" r={r}
              stroke="#e2e8f0" strokeWidth="0.5" fill="none"
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: [0.6, 0.2, 0.6], scale: [1, 1.04, 1] }}
              transition={{ duration: 3, delay: i * 0.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
          {/* Connector lines */}
          {nodes.map((n, i) => (
            <motion.line
              key={i}
              x1={center.x} y1={center.y} x2={n.x} y2={n.y}
              stroke="#cbd5e1" strokeWidth="0.6" strokeDasharray="2 2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
            />
          ))}
          {/* Animated data pulses */}
          {nodes.map((n, i) => (
            <motion.circle
              key={`pulse-${i}`}
              r={1.2} fill="#222"
              initial={{ cx: n.x, cy: n.y, opacity: 0 }}
              animate={{ cx: [n.x, center.x], cy: [n.y, center.y], opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, delay: i * 0.35 + 0.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
          {/* Center node */}
          <circle cx="50" cy="54" r="10" fill="#111" />
          <text x="50" y="57.5" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="7" fill="white" fontWeight="500">LV</text>
          {/* Outer nodes */}
          {nodes.map((n, i) => (
            <motion.g key={`node-${i}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 + 0.2 }}>
              <circle cx={n.x} cy={n.y} r="7" fill="white" stroke="#e2e8f0" strokeWidth="0.8" />
              <text x={n.x} y={n.y + 2.5} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="5.5" fill="#444" fontWeight="500">{n.icon}</text>
            </motion.g>
          ))}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {nodes.map(n => (
          <div key={n.label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="w-4 h-4 rounded bg-[#1e293b] flex items-center justify-center" style={{ fontSize: 7, color: 'white', fontFamily: 'JetBrains Mono, monospace' }}>{n.icon}</div>
            <span style={{ fontSize: 10, color: '#666' }}>{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── FAQ accordion ── */
const FaqItem: React.FC<{ q: string; a: string; index: number }> = ({ q, a, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className="border-b border-slate-200 last:border-0"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left gap-4"
      >
        <span className="text-sm font-medium text-slate-900">{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 text-xs"
        >+</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm text-slate-600 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function IntegrationsPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];

  const allCats = tx.cats;
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const filtered = activeCat
    ? INTEGRATIONS.filter(i => getCatName(i.cat, lang) === activeCat || i.cat === activeCat)
    : INTEGRATIONS;

  const howIcons = [IC.Sync, IC.Zap, IC.Shield, IC.Eye];

  return (
    <div style={{ background: '#fff', color: '#222', fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <PublicHeader activeKey="integrations" />

      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1280 }}>

        {/* ── Hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ padding: '72px 0 64px', position: 'relative' }}
        >
          {/* Floating orbs */}
          <motion.div
            animate={{ y: [0, -18, 0], x: [0, 10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', top: 40, right: '10%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,100,100,0.06) 0%, transparent 70%)', pointerEvents: 'none' }}
          />
          <motion.div
            animate={{ y: [0, 14, 0], x: [0, -8, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            style={{ position: 'absolute', top: 100, right: '25%', width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,0,0,0.04) 0%, transparent 70%)', pointerEvents: 'none' }}
          />

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#222', display: 'inline-block' }} />
            {tx.kicker}
          </div>
          <h1 style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(40px, 5vw, 72px)', lineHeight: 1, letterSpacing: '-0.04em', fontWeight: 500, marginTop: 28, maxWidth: 860, color: '#222' }}>
            {tx.title1}<br />
            <em style={{ color: '#888', fontStyle: 'normal', fontWeight: 400 }}>{tx.title2}</em>
          </h1>
          <p style={{ fontSize: 17, color: '#555', maxWidth: 560, marginTop: 20, lineHeight: 1.55 }}>{tx.sub}</p>

          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-t border-b border-[#e7e7e7] mt-14">
            {[
              { v: tx.stat1v, l: tx.stat1l },
              { v: tx.stat2v, l: tx.stat2l },
              { v: tx.stat3v, l: tx.stat3l },
              { v: tx.stat4v, l: tx.stat4l },
            ].map((s, i) => (
              <motion.div
                key={s.v}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                className={[
                  'py-6 px-4 md:py-8 md:px-7 border-[#e7e7e7]',
                  i % 2 === 0 ? 'border-r' : '',
                  i === 1 ? 'md:border-r' : '',
                  i < 2 ? 'border-b md:border-b-0' : '',
                ].filter(Boolean).join(' ')}
              >
                <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 12.5, color: '#555', marginTop: 10 }}>{s.l}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Integration grid ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ paddingBottom: 80 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
            <button
              onClick={() => setActiveCat(null)}
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '6px 14px', borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s',
                background: activeCat === null ? '#222' : '#fff',
                color: activeCat === null ? '#fff' : '#888',
                border: activeCat === null ? '1px solid #222' : '1px solid #e7e7e7',
              }}
            >
              {tx.catAll}
            </button>
            {allCats.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCat(activeCat === cat ? null : cat)}
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '6px 14px', borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s',
                  background: activeCat === cat ? '#222' : '#fff',
                  color: activeCat === cat ? '#fff' : '#888',
                  border: activeCat === cat ? '1px solid #222' : '1px solid #e7e7e7',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.05fr] items-start" style={{ gap: 48 }}>
            <div>
              <motion.div
                layout
                className="grid gap-2"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))' }}
              >
                <AnimatePresence>
                  {filtered.map((intg, i) => (
                    <motion.div
                      key={intg.name}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      whileHover={{ y: -2, boxShadow: '0 6px 20px rgba(0,0,0,0.1)' }}
                      className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col items-center gap-2 cursor-default"
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, color: '#444' }}>
                        {intg.logo}
                      </div>
                      <div style={{ fontSize: 10, color: '#666', textAlign: 'center', lineHeight: 1.3, fontWeight: 500 }}>{intg.name}</div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#aaa', marginTop: 20, letterSpacing: '0.08em' }}>
                + {80 - INTEGRATIONS.length} {lang === 'ru' ? 'других коннекторов' : lang === 'tr' ? 'diğer konektör' : 'more connectors'}
              </div>
            </div>

            <div className="sticky top-24">
              <ConnectionVisual />
            </div>
          </div>
        </motion.section>

        {/* ── How it works ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ borderTop: '1px solid #e7e7e7', paddingTop: 80, paddingBottom: 80 }}
        >
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: 40 }}>
            {tx.howTitle}
          </div>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {tx.howSteps.map((step, i) => {
              const Icon = howIcons[i];
              return (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#aaa', letterSpacing: '0.08em' }}>{step.n}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 500, letterSpacing: '-0.01em', color: '#222', marginBottom: 8 }}>{step.t}</div>
                    <div style={{ fontSize: 13.5, color: '#666', lineHeight: 1.6 }}>{step.d}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ── FAQ ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ borderTop: '1px solid #e7e7e7', paddingTop: 80, paddingBottom: 80 }}
        >
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[380px_1fr]" style={{ gap: 56 }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: 16 }}>
                {tx.faqTitle}
              </div>
              <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, color: '#222' }}>
                {lang === 'ru' ? 'Ответы на\nчастые вопросы' : lang === 'tr' ? 'Sık sorulan\nsorulara yanıtlar' : 'Answers to\ncommon questions'}
              </div>
            </div>
            <div className="border border-slate-200 rounded-2xl bg-white px-6 py-2">
              {tx.faq.map((item, i) => (
                <FaqItem key={item.q} q={item.q} a={item.a} index={i} />
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── CTA ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 80, borderRadius: 12, border: '1px solid #e7e7e7', padding: '56px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to right, #f0f0f0 1px, transparent 1px)', backgroundSize: '48px 100%', opacity: 0.4, pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#222', display: 'inline-block' }} />
              {tx.ctaKicker}
            </div>
            <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(22px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.15, maxWidth: 480, color: '#222' }}>
              {tx.ctaTitle}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
            <Link
              to="/contact"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: '#222', color: '#fff', border: '1px solid #222', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
            >
              {tx.ctaBtn} <IC.Arrow />
            </Link>
            <Link
              to="/contact"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: '#fff', color: '#222', border: '1px solid #e7e7e7', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'border-color 0.15s' }}
            >
              {tx.ctaDemo}
            </Link>
          </div>
        </motion.section>

      </div>

      <PublicFooter />
    </div>
  );
}

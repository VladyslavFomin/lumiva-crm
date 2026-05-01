import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

type Lang = 'ru' | 'en' | 'tr';

const T = {
  ru: {
    kicker: 'МАРКЕТИНГ И SEO-АНАЛИТИКА',
    title1: 'Маркетинг-решения на основе',
    title2: 'цифр, а не гипотез.',
    sub: 'Lumiva объединяет рекламные кабинеты, веб-аналитику, SEO-метрики и CRM в единую операционную модель.',
    stat1v: '4.6x', stat1l: 'blended ROAS',
    stat2v: '+31%', stat2l: 'органическая доля',
    stat3v: '−19%', stat3l: 'снижение CPL',
    stat4v: '97%', stat4l: 'охват атрибуции',
    seoTitle: 'SEO и контент-производительность',
    funnelTitle: 'Воронка под контролем маркетинга',
    channelsTitle: 'Эффективность каналов',
    compareTitle: 'Lumiva vs разрозненная отчётность',
    ctaKicker: 'НУЖНА ЕДИНАЯ МАРКЕТИНГ-АНАЛИТИКА?',
    ctaTitle: 'Покажем вашу модель атрибуции за 30 минут.',
    ctaBtn: 'Запросить демо',
    faqTitle: 'FAQ',
    seoClusters: [
      { name: 'Коммерческие страницы', visibility: 78, traffic: '+41%' },
      { name: 'Блог и экспертный контент', visibility: 64, traffic: '+29%' },
      { name: 'Локальные страницы спроса', visibility: 71, traffic: '+36%' },
    ],
    funnelStages: [
      { stage: 'Сессии', value: '124K', delta: '+18%' },
      { stage: 'Лиды', value: '9.4K', delta: '+22%' },
      { stage: 'SQL', value: '2.6K', delta: '+17%' },
      { stage: 'Выигранные сделки', value: '612', delta: '+15%' },
    ],
    channels: [
      { name: 'Google Search', share: 82, cpl: '€14.2', roas: '4.8x' },
      { name: 'Meta Ads', share: 69, cpl: '€11.8', roas: '3.9x' },
      { name: 'SEO Organic', share: 76, cpl: '€6.1', roas: '8.2x' },
      { name: 'YouTube', share: 51, cpl: '€17.4', roas: '2.7x' },
    ],
    compareRows: [
      { metric: 'Глубина атрибуции', lumiva: 'Связь касаний с SQL, сделками и выручкой', typical: 'Только клики и сессии' },
      { metric: 'Синхрон SEO и рекламы', lumiva: 'Единая панель с общими KPI', typical: 'Отдельные отчеты по отделам' },
      { metric: 'Скорость мониторинга', lumiva: 'Ежедневные аномалии и авто-алерты', typical: 'Ручная проверка раз в неделю' },
    ],
    faq: [
      { q: 'Вы анализируете только платный трафик?', a: 'Нет. В модель входят SEO, контент, соцсети, referral и direct-каналы.' },
      { q: 'Можно видеть влияние на сделки, а не только лиды?', a: 'Да. Мы связываем источники с этапами воронки и выручкой внутри CRM.' },
      { q: 'Как работает отслеживание отклонений?', a: 'Система контролирует CPL, конверсию, ROAS и SEO-видимость, сигнализируя о просадках.' },
    ],
  },
  en: {
    kicker: 'MARKETING & SEO ANALYTICS',
    title1: 'Marketing decisions based on',
    title2: 'numbers, not assumptions.',
    sub: 'Lumiva connects ad platforms, web analytics, SEO metrics and CRM into one operational performance model.',
    stat1v: '4.6x', stat1l: 'blended ROAS',
    stat2v: '+31%', stat2l: 'organic share uplift',
    stat3v: '−19%', stat3l: 'CPL reduction',
    stat4v: '97%', stat4l: 'attribution coverage',
    seoTitle: 'SEO and content performance',
    funnelTitle: 'Demand funnel monitored by marketing',
    channelsTitle: 'Channel efficiency and budget quality',
    compareTitle: 'Lumiva vs fragmented reporting',
    ctaKicker: 'NEED UNIFIED MARKETING ANALYTICS?',
    ctaTitle: 'We will show your attribution model in 30 minutes.',
    ctaBtn: 'Request demo',
    faqTitle: 'FAQ',
    seoClusters: [
      { name: 'Commercial pages', visibility: 78, traffic: '+41%' },
      { name: 'Blog and guides', visibility: 64, traffic: '+29%' },
      { name: 'Local intent pages', visibility: 71, traffic: '+36%' },
    ],
    funnelStages: [
      { stage: 'Sessions', value: '124K', delta: '+18%' },
      { stage: 'Leads', value: '9.4K', delta: '+22%' },
      { stage: 'SQL', value: '2.6K', delta: '+17%' },
      { stage: 'Won deals', value: '612', delta: '+15%' },
    ],
    channels: [
      { name: 'Google Search', share: 82, cpl: '€14.2', roas: '4.8x' },
      { name: 'Meta Ads', share: 69, cpl: '€11.8', roas: '3.9x' },
      { name: 'SEO Organic', share: 76, cpl: '€6.1', roas: '8.2x' },
      { name: 'YouTube', share: 51, cpl: '€17.4', roas: '2.7x' },
    ],
    compareRows: [
      { metric: 'Attribution depth', lumiva: 'Touchpoints linked to pipeline and revenue', typical: 'Clicks and sessions only' },
      { metric: 'SEO + paid alignment', lumiva: 'One dashboard with shared KPI targets', typical: 'Separate reports by team' },
      { metric: 'Monitoring speed', lumiva: 'Daily anomalies and automatic alerts', typical: 'Manual checks once per week' },
    ],
    faq: [
      { q: 'Do you work only with ad channels?', a: 'No. We include SEO, content, social, referral and direct traffic in one performance model.' },
      { q: 'Can we track campaign impact on deals, not only leads?', a: 'Yes. We connect marketing sources with deal stages and revenue events inside CRM.' },
      { q: 'How does monitoring work?', a: 'The system tracks CPL, conversion, ROAS and visibility thresholds and flags deviations for quick response.' },
    ],
  },
  tr: {
    kicker: 'PAZARLAMA VE SEO ANALİTİĞİ',
    title1: 'Pazarlama kararları varsayımlarla',
    title2: 'değil verilerle alınır.',
    sub: 'Lumiva, reklam platformlarını, web analitiğini, SEO metriklerini ve CRM\'i tek operasyonel modelde birleştirir.',
    stat1v: '4.6x', stat1l: 'blended ROAS',
    stat2v: '+31%', stat2l: 'organik pay artışı',
    stat3v: '−19%', stat3l: 'CPL düşüşü',
    stat4v: '97%', stat4l: 'atıf kapsamı',
    seoTitle: 'SEO ve içerik performansı',
    funnelTitle: 'Pazarlama tarafından izlenen talep hunisi',
    channelsTitle: 'Kanal verimliliği ve bütçe kalitesi',
    compareTitle: 'Lumiva ve parçalı raporlama karşılaştırması',
    ctaKicker: 'BİRLEŞİK PAZARLAMA ANALİTİĞİNE İHTİYACINIZ VAR MI?',
    ctaTitle: '30 dakikada atıf modelinizi gösteriyoruz.',
    ctaBtn: 'Demo talep et',
    faqTitle: 'SSS',
    seoClusters: [
      { name: 'Ticari sayfalar', visibility: 78, traffic: '+41%' },
      { name: 'Blog ve rehberler', visibility: 64, traffic: '+29%' },
      { name: 'Yerel niyet sayfaları', visibility: 71, traffic: '+36%' },
    ],
    funnelStages: [
      { stage: 'Oturumlar', value: '124K', delta: '+18%' },
      { stage: 'Leadler', value: '9.4K', delta: '+22%' },
      { stage: 'SQL', value: '2.6K', delta: '+17%' },
      { stage: 'Kazanılan satışlar', value: '612', delta: '+15%' },
    ],
    channels: [
      { name: 'Google Search', share: 82, cpl: '€14.2', roas: '4.8x' },
      { name: 'Meta Ads', share: 69, cpl: '€11.8', roas: '3.9x' },
      { name: 'SEO Organic', share: 76, cpl: '€6.1', roas: '8.2x' },
      { name: 'YouTube', share: 51, cpl: '€17.4', roas: '2.7x' },
    ],
    compareRows: [
      { metric: 'Atıf derinliği', lumiva: 'Temaslar satış hunisi ve gelirle bağlı', typical: 'Sadece tıklama ve oturum' },
      { metric: 'SEO + ücretli kanal hizası', lumiva: 'Ortak KPI hedefli tek panel', typical: 'Ekip bazlı ayrı raporlar' },
      { metric: 'İzleme hızı', lumiva: 'Günlük anomali ve otomatik uyarı', typical: 'Haftalık manuel kontrol' },
    ],
    faq: [
      { q: 'Sadece reklam kanallarıyla mı çalışıyorsunuz?', a: 'Hayır. SEO, içerik, sosyal medya, referral ve direct trafiği tek modelde birleştiriyoruz.' },
      { q: 'Kampanyaların etkisini sadece lead değil satışta da takip edebilir miyiz?', a: 'Evet. Kaynakları CRM içindeki satış aşamaları ve gelir olaylarıyla eşliyoruz.' },
      { q: 'Sapma izleme nasıl çalışır?', a: 'CPL, dönüşüm, ROAS ve görünürlük eşikleri sürekli izlenir; sapmalar otomatik olarak işaretlenir.' },
    ],
  },
};

const FaqItem: React.FC<{ q: string; a: string; index: number }> = ({ q, a, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.07, duration: 0.4 }} className="border-b border-slate-200 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-4 text-left gap-4">
        <span className="text-sm font-medium text-slate-900">{q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 text-xs">+</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <p className="pb-4 text-sm text-slate-600 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function MarketingPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];

  return (
    <div style={{ background: '#fff', color: '#222', fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <PublicHeader activeKey="marketing" />

      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1280 }}>

        {/* ── Hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ padding: '72px 0 0', position: 'relative' }}
        >
          <motion.div
            animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', top: 30, right: '12%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(80,80,80,0.05) 0%, transparent 70%)', pointerEvents: 'none' }}
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

        {/* ── SEO + Funnel ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-12 pb-12">
          {/* SEO clusters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginBottom: 16 }}>
              {tx.seoTitle}
            </div>
            <div className="flex flex-col gap-4">
              {tx.seoClusters.map((cluster, i) => (
                <div key={cluster.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: '#222' }}>{cluster.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#555', background: '#f1f5f9', padding: '2px 8px', borderRadius: 999 }}>{cluster.traffic}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[#1e293b]"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${cluster.visibility}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                    />
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#aaa', marginTop: 3 }}>
                    Visibility {cluster.visibility}%
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Funnel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginBottom: 16 }}>
              {tx.funnelTitle}
            </div>
            <div className="flex flex-col gap-3">
              {tx.funnelStages.map((row, i) => (
                <motion.div
                  key={row.stage}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-4 py-3"
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>{row.stage}</span>
                  <div className="text-right">
                    <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 18, fontWeight: 500, color: '#222', lineHeight: 1 }}>{row.value}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#555', marginTop: 2 }}>{row.delta}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Channels ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ borderTop: '1px solid #e7e7e7', paddingTop: 64, paddingBottom: 64 }}
        >
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: 32 }}>
            {tx.channelsTitle}
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {tx.channels.map((ch, i) => (
              <motion.div
                key={ch.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: '#222', marginBottom: 12 }}>{ch.name}</div>
                <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: '#222', lineHeight: 1 }}>{ch.roas}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#aaa', marginTop: 4 }}>ROAS</div>
                <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[#1e293b]"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${ch.share}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: i * 0.1 + 0.2 }}
                  />
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#aaa', marginTop: 4 }}>
                  Quality {ch.share}% · CPL {ch.cpl}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Compare ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ borderTop: '1px solid #e7e7e7', paddingTop: 64, paddingBottom: 64 }}
        >
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: 24 }}>
            {tx.compareTitle}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50">
              <div className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">
                {lang === 'ru' ? 'Метрика' : lang === 'tr' ? 'Metrik' : 'Metric'}
              </div>
              <div className="px-4 py-3 text-[10px] font-semibold text-slate-900 uppercase tracking-[0.1em] bg-slate-100">Lumiva</div>
              <div className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em]">
                {lang === 'ru' ? 'Типично' : lang === 'tr' ? 'Tipik' : 'Typical'}
              </div>
            </div>
            {tx.compareRows.map((row, i) => (
              <motion.div
                key={row.metric}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="grid grid-cols-3 border-b border-slate-100 last:border-0"
              >
                <div className="px-4 py-3 text-xs font-medium text-slate-700">{row.metric}</div>
                <div className="px-4 py-3 text-xs text-slate-800 bg-slate-50">{row.lumiva}</div>
                <div className="px-4 py-3 text-xs text-slate-500">{row.typical}</div>
              </motion.div>
            ))}
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
          <div style={{ position: 'relative' }}>
            <Link to="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: '#222', color: '#fff', border: '1px solid #222', textDecoration: 'none' }}>
              {tx.ctaBtn}
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
            </Link>
          </div>
        </motion.section>

      </div>

      <PublicFooter />
    </div>
  );
}

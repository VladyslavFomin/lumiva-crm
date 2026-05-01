import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

type Lang = 'ru' | 'en' | 'tr';

const T = {
  ru: {
    kicker: 'АНАЛИТИКА РЕКЛАМЫ И СОЦСЕТЕЙ',
    title1: 'Видите, откуда на самом деле',
    title2: 'приходят лиды и выручка.',
    sub: 'Lumiva объединяет рекламные кабинеты, веб-аналитику и CRM-результаты в единую операционную панель.',
    stat1v: '+34%', stat1l: 'к прошлому периоду',
    stat2v: '€680', stat2l: 'средний чек',
    stat3v: '72%', stat3l: 'закрыты в SLA',
    stat4v: '5', stat4l: 'каналов атрибуции',
    channelsTitle: 'Конверсия по каналам',
    funnelTitle: 'Воронка: последние 30 дней',
    compareTitle: 'Lumiva vs типичные CRM-отчёты',
    compareRows: [
      { metric: 'Прозрачность каналов', lumiva: 'Сквозная модель от источника до выручки', typical: 'Частичная атрибуция' },
      { metric: 'Скорость решений', lumiva: 'Операционная панель с live KPI', typical: 'Запаздывающие статичные отчёты' },
      { metric: 'Синхрон продаж + маркетинга', lumiva: 'Единая performance-модель', typical: 'Разрозненные витрины по отделам' },
    ],
    ctaKicker: 'ГОТОВЫ УВИДЕТЬ СВОИ ДАННЫЕ?',
    ctaTitle: 'Демо с вашими реальными источниками за 30 минут.',
    ctaBtn: 'Запросить демо',
    faqTitle: 'FAQ',
    faq: [
      { q: 'Это реальные данные клиентов?', a: 'Нет, на странице используются реалистичные демонстрационные примеры для наглядности.' },
      { q: 'Можно подключить наши источники данных?', a: 'Да. Подключаются GA4, Meta Ads, Google Ads, Telegram и кастомные источники через API.' },
      { q: 'Как часто обновляются данные?', a: 'Для операционного слоя — почти в реальном времени, для управленческих срезов — по расписанию.' },
    ],
    channels: [
      { name: 'Google Ads', cr: 62, cpl: '€18.4', revenue: '€81K' },
      { name: 'Meta Ads', cr: 74, cpl: '€14.7', revenue: '€93K' },
      { name: 'Telegram', cr: 55, cpl: '€11.9', revenue: '€57K' },
      { name: 'Organic', cr: 69, cpl: '€9.1', revenue: '€64K' },
      { name: 'Direct', cr: 49, cpl: '€7.2', revenue: '€38K' },
    ],
    funnel: [
      { stage: 'Сессии', value: '124K', pct: 100 },
      { stage: 'Лиды', value: '9.4K', pct: 75 },
      { stage: 'SQL', value: '2.6K', pct: 50 },
      { stage: 'Выиграно', value: '612', pct: 28 },
    ],
  },
  en: {
    kicker: 'ADVERTISING & SOCIAL ANALYTICS',
    title1: 'See exactly where leads',
    title2: 'and revenue come from.',
    sub: 'Lumiva connects ad platforms, web analytics and CRM outcomes into one operational dashboard.',
    stat1v: '+34%', stat1l: 'vs previous period',
    stat2v: '€680', stat2l: 'average check',
    stat3v: '72%', stat3l: 'closed in SLA',
    stat4v: '5', stat4l: 'attribution channels',
    channelsTitle: 'Channel conversion snapshot',
    funnelTitle: 'Funnel: last 30 days',
    compareTitle: 'Lumiva analytics vs typical CRM reports',
    compareRows: [
      { metric: 'Channel transparency', lumiva: 'End-to-end source to revenue model', typical: 'Partial attribution only' },
      { metric: 'Decision speed', lumiva: 'Live operational dashboard with KPI blocks', typical: 'Delayed static reports' },
      { metric: 'Sales + marketing alignment', lumiva: 'One shared performance model', typical: 'Separate departmental views' },
    ],
    ctaKicker: 'READY TO SEE YOUR DATA?',
    ctaTitle: 'Live demo with your real data sources in 30 minutes.',
    ctaBtn: 'Request demo',
    faqTitle: 'FAQ',
    faq: [
      { q: 'Are these real client numbers?', a: 'No, this page uses realistic demo values for presentation purposes only.' },
      { q: 'Can we use our own data sources?', a: 'Yes. GA4, Meta Ads, Google Ads, Telegram and custom sources can be connected via API.' },
      { q: 'How often is data refreshed?', a: 'Near real-time for operational dashboards; scheduled snapshots for management reports.' },
    ],
    channels: [
      { name: 'Google Ads', cr: 62, cpl: '€18.4', revenue: '€81K' },
      { name: 'Meta Ads', cr: 74, cpl: '€14.7', revenue: '€93K' },
      { name: 'Telegram', cr: 55, cpl: '€11.9', revenue: '€57K' },
      { name: 'Organic', cr: 69, cpl: '€9.1', revenue: '€64K' },
      { name: 'Direct', cr: 49, cpl: '€7.2', revenue: '€38K' },
    ],
    funnel: [
      { stage: 'Sessions', value: '124K', pct: 100 },
      { stage: 'Leads', value: '9.4K', pct: 75 },
      { stage: 'SQL', value: '2.6K', pct: 50 },
      { stage: 'Won', value: '612', pct: 28 },
    ],
  },
  tr: {
    kicker: 'REKLAM VE SOSYAL MEDYA ANALİTİĞİ',
    title1: 'Lead ve gelirin gerçekte',
    title2: 'nereden geldiğini görün.',
    sub: 'Lumiva, reklam platformlarını, web analitiğini ve CRM sonuçlarını tek bir operasyonel panelde birleştirir.',
    stat1v: '+34%', stat1l: 'önceki döneme kıyasla',
    stat2v: '€680', stat2l: 'ortalama sipariş değeri',
    stat3v: '72%', stat3l: 'SLA içinde kapatıldı',
    stat4v: '5', stat4l: 'atıf kanalı',
    channelsTitle: 'Kanal bazlı dönüşüm',
    funnelTitle: 'Huni: son 30 gün',
    compareTitle: 'Lumiva analitiği vs klasik CRM raporları',
    compareRows: [
      { metric: 'Kanal şeffaflığı', lumiva: 'Kaynaktan gelire uçtan uca model', typical: 'Kısmi atıf' },
      { metric: 'Karar hızı', lumiva: 'Canlı operasyonel panel ile KPI blokları', typical: 'Gecikmeli statik raporlar' },
      { metric: 'Satış + pazarlama uyumu', lumiva: 'Ortak performans modeli', typical: 'Departman bazlı ayrı görünümler' },
    ],
    ctaKicker: 'KENDİ VERİLERİNİZİ GÖRMEK İSTER MİSİNİZ?',
    ctaTitle: '30 dakikada gerçek veri kaynaklarınızla canlı demo.',
    ctaBtn: 'Demo talep et',
    faqTitle: 'Sık sorulan sorular',
    faq: [
      { q: 'Bunlar gerçek müşteri verileri mi?', a: 'Hayır, bu sayfa yalnızca sunum amaçlı gerçekçi demo değerleri kullanmaktadır.' },
      { q: 'Kendi veri kaynaklarımızı bağlayabilir miyiz?', a: 'Evet. GA4, Meta Ads, Google Ads, Telegram ve özel kaynaklar API ile bağlanabilir.' },
      { q: 'Veriler ne sıklıkla güncellenir?', a: 'Operasyonel paneller için neredeyse gerçek zamanlı; yönetim raporları için planlı anlık görüntüler.' },
    ],
    channels: [
      { name: 'Google Ads', cr: 62, cpl: '€18.4', revenue: '€81K' },
      { name: 'Meta Ads', cr: 74, cpl: '€14.7', revenue: '€93K' },
      { name: 'Telegram', cr: 55, cpl: '€11.9', revenue: '€57K' },
      { name: 'Organic', cr: 69, cpl: '€9.1', revenue: '€64K' },
      { name: 'Direct', cr: 49, cpl: '€7.2', revenue: '€38K' },
    ],
    funnel: [
      { stage: 'Oturumlar', value: '124K', pct: 100 },
      { stage: 'Leadler', value: '9.4K', pct: 75 },
      { stage: 'SQL', value: '2.6K', pct: 50 },
      { stage: 'Kazanıldı', value: '612', pct: 28 },
    ],
  },
};

const linePoints = [20, 34, 41, 37, 33, 44, 52, 48, 61, 58, 66, 72];
const maxLP = Math.max(...linePoints);
const linePath = linePoints.map((v, i) => {
  const x = 10 + i * 25;
  const y = 90 - (v / maxLP) * 72;
  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
}).join(' ');
const areaPath = linePoints.map((v, i) => {
  const x = 10 + i * 25;
  const y = 90 - (v / maxLP) * 72;
  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
}).join(' ') + ` L ${10 + 11 * 25} 90 L 10 90 Z`;

/* ── FAQ item ── */
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

export default function AnalyticsPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];

  return (
    <div style={{ background: '#fff', color: '#222', fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <PublicHeader activeKey="analytics" />

      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1280 }}>

        {/* ── Hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ padding: '72px 0 0', position: 'relative' }}
        >
          {/* Floating orbs */}
          <motion.div
            animate={{ y: [0, -22, 0], x: [0, 12, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', top: 20, right: '8%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(80,80,80,0.05) 0%, transparent 70%)', pointerEvents: 'none' }}
          />
          <motion.div
            animate={{ y: [0, 16, 0], x: [0, -10, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            style={{ position: 'absolute', top: 140, right: '30%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 70%)', pointerEvents: 'none' }}
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

          {/* Stats */}
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

        {/* ── Chart + Channels ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-12 pb-20">

          {/* Animated line chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase' }}>
                {lang === 'ru' ? 'Динамика кампаний · 12 нед' : lang === 'tr' ? 'Kampanya dinamiği · 12 hafta' : 'Campaign dynamics · 12 weeks'}
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 18, fontWeight: 500, color: '#222' }}>+34.2%</span>
                <span style={{ fontSize: 10, color: '#888' }}>{tx.stat1l}</span>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <svg viewBox="0 0 290 100" className="w-full h-auto">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#222" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#222" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Area fill */}
                <motion.path
                  d={areaPath}
                  fill="url(#areaGrad)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
                {/* Line */}
                <motion.path
                  d={linePath}
                  fill="none" stroke="#222" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                />
                {/* Dots */}
                {linePoints.map((v, i) => {
                  const x = 10 + i * 25;
                  const y = 90 - (v / maxLP) * 72;
                  return (
                    <motion.circle
                      key={i} cx={x} cy={y} r={2.5} fill="#222"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.08, duration: 0.3 }}
                    />
                  );
                })}
              </svg>
            </div>
            <div className="flex justify-between mt-3" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#aaa' }}>
              <span>W1</span><span>W4</span><span>W8</span><span>W12</span>
            </div>
          </motion.div>

          {/* Channels */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginBottom: 16 }}>
              {tx.channelsTitle}
            </div>
            <div className="flex flex-col gap-3">
              {tx.channels.map((ch, i) => (
                <div key={ch.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: '#222' }}>{ch.name}</span>
                    <div className="flex items-center gap-3" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#888' }}>
                      <span>{ch.cpl}</span>
                      <span style={{ color: '#222', fontWeight: 500 }}>{ch.revenue}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[#1e293b]"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${ch.cr}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                    />
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#aaa', marginTop: 3 }}>CR {ch.cr}%</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Funnel ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ borderTop: '1px solid #e7e7e7', paddingTop: 80, paddingBottom: 80 }}
        >
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2" style={{ gap: 56, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: 20 }}>
                {tx.funnelTitle}
              </div>
              <div className="flex flex-col gap-3">
                {tx.funnel.map((f, i) => (
                  <motion.div
                    key={f.stage}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className="flex items-center gap-4"
                  >
                    <div style={{ width: 48, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#aaa' }}>0{i + 1}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>{f.stage}</span>
                        <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 17, fontWeight: 500, color: '#222' }}>{f.value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: `rgba(34,34,34,${0.2 + (f.pct / 100) * 0.8})` }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${f.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: i * 0.12, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Compare table */}
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: 20 }}>
                {tx.compareTitle}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50">
                  <div className="px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">
                    {lang === 'ru' ? 'Метрика' : lang === 'tr' ? 'Metrik' : 'Metric'}
                  </div>
                  <div className="px-4 py-2.5 text-[10px] font-semibold text-slate-900 uppercase tracking-[0.1em] bg-slate-100">Lumiva</div>
                  <div className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em]">
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
            </div>
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
            <Link
              to="/contact"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: '#222', color: '#fff', border: '1px solid #222', textDecoration: 'none' }}
            >
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

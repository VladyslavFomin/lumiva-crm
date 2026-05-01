import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

type Lang = 'ru' | 'en' | 'tr';

const T = {
  ru: {
    kicker: 'АНАЛИТИКА ПРОДАЖ И КОНТРОЛЬ ВОРОНКИ',
    title1: 'Предсказуемый рост продаж через',
    title2: 'прозрачную аналитику воронки.',
    sub: 'Lumiva связывает источники маркетинга, квалификацию лидов и стадии сделок в единой панели решений.',
    stat1v: '+27%', stat1l: 'выигранных сделок QoQ',
    stat2v: '91%', stat2l: 'pipeline hygiene score',
    stat3v: '−19%', stat3l: 'сокращение цикла',
    stat4v: '84%', stat4l: 'точность прогноза',
    velocityTitle: 'Скорость прохождения этапов',
    teamTitle: 'Качество исполнения по команде',
    compareTitle: 'Lumiva vs классический CRM-контроль',
    ctaKicker: 'НУЖНА АНАЛИТИКА ПРОДАЖ?',
    ctaTitle: 'Покажем прогноз воронки с вашими данными за 30 минут.',
    ctaBtn: 'Запросить демо',
    faqTitle: 'FAQ',
    velocityRows: [
      { stage: 'MQL → SQL', days: '1.8 дня', delta: '−22%' },
      { stage: 'SQL → Demo', days: '2.6 дня', delta: '−17%' },
      { stage: 'Demo → Proposal', days: '3.2 дня', delta: '−14%' },
      { stage: 'Proposal → Won', days: '5.1 дня', delta: '−11%' },
    ],
    teamSegments: [
      { name: 'Inbound SDR', conversion: 68, velocity: '42 мин', value: '€96K' },
      { name: 'Account Executive', conversion: 54, velocity: '3.4 ч', value: '€218K' },
      { name: 'Enterprise Desk', conversion: 39, velocity: '5.8 ч', value: '€402K' },
      { name: 'Partner Channel', conversion: 47, velocity: '2.9 ч', value: '€171K' },
    ],
    compareRows: [
      { metric: 'Прозрачность воронки', lumiva: 'Узкие места и SLA-отклонения в одном экране', typical: 'Только статичные суммы по стадиям' },
      { metric: 'Качество прогноза', lumiva: 'Вероятностная модель по этапам и источникам', typical: 'Ручные оценки менеджеров' },
      { metric: 'Сигналы для coaching', lumiva: 'Тренды по касаниям, ответам и конверсии', typical: 'Нет операционного слоя coaching' },
    ],
    faq: [
      { q: 'Можно смотреть конверсию по менеджеру и источнику одновременно?', a: 'Да. Каждый этап сегментируется по владельцу, каналу, региону и типу сделки.' },
      { q: 'Есть прогнозирование выручки?', a: 'Да. Прогноз строится на исторической конверсии, текущем составе воронки и коэффициентах уверенности.' },
      { q: 'Подходит для еженедельных sales-review?', a: 'Да, страница ориентирована на операционный weekly review и стратегические встречи руководства.' },
    ],
  },
  en: {
    kicker: 'SALES ANALYTICS & PIPELINE CONTROL',
    title1: 'Build predictable sales growth with',
    title2: 'transparent pipeline analytics.',
    sub: 'Lumiva connects marketing sources, lead qualification and deal stages into one decision dashboard.',
    stat1v: '+27%', stat1l: 'won deals QoQ',
    stat2v: '91%', stat2l: 'pipeline hygiene score',
    stat3v: '−19%', stat3l: 'cycle time reduction',
    stat4v: '84%', stat4l: 'forecast confidence',
    velocityTitle: 'Pipeline velocity by stage',
    teamTitle: 'Team execution quality',
    compareTitle: 'Lumiva sales model vs classic CRM tracking',
    ctaKicker: 'NEED SALES ANALYTICS?',
    ctaTitle: 'Show your pipeline forecast with real data in 30 minutes.',
    ctaBtn: 'Request demo',
    faqTitle: 'FAQ',
    velocityRows: [
      { stage: 'MQL → SQL', days: '1.8 days', delta: '−22%' },
      { stage: 'SQL → Demo', days: '2.6 days', delta: '−17%' },
      { stage: 'Demo → Proposal', days: '3.2 days', delta: '−14%' },
      { stage: 'Proposal → Won', days: '5.1 days', delta: '−11%' },
    ],
    teamSegments: [
      { name: 'Inbound SDR', conversion: 68, velocity: '42 min', value: '€96K' },
      { name: 'Account Executive', conversion: 54, velocity: '3.4 h', value: '€218K' },
      { name: 'Enterprise Desk', conversion: 39, velocity: '5.8 h', value: '€402K' },
      { name: 'Partner Channel', conversion: 47, velocity: '2.9 h', value: '€171K' },
    ],
    compareRows: [
      { metric: 'Pipeline transparency', lumiva: 'Stage bottlenecks and SLA deviations in one view', typical: 'Static stage totals only' },
      { metric: 'Forecast quality', lumiva: 'Probability model by stage and source', typical: 'Manual manager estimates' },
      { metric: 'Sales coaching signals', lumiva: 'Call, response and conversion behavior trends', typical: 'No operational coaching layer' },
    ],
    faq: [
      { q: 'Can we track conversion by manager and source together?', a: 'Yes. Every stage can be segmented by owner, channel, region and deal type.' },
      { q: 'Is there support for revenue forecasting?', a: 'Yes. Forecast combines historical conversion, current stage mix and confidence coefficients.' },
      { q: 'Can this be used for weekly sales reviews?', a: 'Exactly. The page is designed for operational weekly reviews and executive planning.' },
    ],
  },
  tr: {
    kicker: 'SATIŞ ANALİTİĞİ VE PIPELINE KONTROLÜ',
    title1: 'Şeffaf pipeline analitiği ile',
    title2: 'öngörülebilir satış büyümesi.',
    sub: 'Lumiva; pazarlama kaynaklarını, lead kalifikasyonunu ve satış aşamalarını tek karar panelinde birleştirir.',
    stat1v: '+27%', stat1l: 'kazanılan satış QoQ',
    stat2v: '91%', stat2l: 'pipeline hijyen puanı',
    stat3v: '−19%', stat3l: 'döngü süresi düşüşü',
    stat4v: '84%', stat4l: 'forecast güveni',
    velocityTitle: 'Aşamalara göre pipeline hızı',
    teamTitle: 'Ekip uygulama kalitesi',
    compareTitle: 'Lumiva satış modeli vs klasik CRM takibi',
    ctaKicker: 'SATIŞ ANALİTİĞİNE İHTİYACINIZ VAR MI?',
    ctaTitle: '30 dakikada gerçek verilerle pipeline tahminini gösteriyoruz.',
    ctaBtn: 'Demo talep et',
    faqTitle: 'SSS',
    velocityRows: [
      { stage: 'MQL → SQL', days: '1.8 gün', delta: '−22%' },
      { stage: 'SQL → Demo', days: '2.6 gün', delta: '−17%' },
      { stage: 'Demo → Teklif', days: '3.2 gün', delta: '−14%' },
      { stage: 'Teklif → Kazanım', days: '5.1 gün', delta: '−11%' },
    ],
    teamSegments: [
      { name: 'Inbound SDR', conversion: 68, velocity: '42 dk', value: '€96K' },
      { name: 'Account Executive', conversion: 54, velocity: '3.4 s', value: '€218K' },
      { name: 'Enterprise Desk', conversion: 39, velocity: '5.8 s', value: '€402K' },
      { name: 'Partner Channel', conversion: 47, velocity: '2.9 s', value: '€171K' },
    ],
    compareRows: [
      { metric: 'Pipeline şeffaflığı', lumiva: 'Darboğazlar ve SLA sapmaları tek görünümde', typical: 'Sadece statik aşama toplamları' },
      { metric: 'Forecast kalitesi', lumiva: 'Aşama ve kaynağa göre olasılık modeli', typical: 'Yönetici bazlı manuel tahmin' },
      { metric: 'Koçluk sinyalleri', lumiva: 'Arama, yanıt ve dönüşüm davranış trendleri', typical: 'Operasyonel koçluk katmanı yok' },
    ],
    faq: [
      { q: 'Dönüşümü yönetici ve kaynak bazında birlikte izleyebilir miyiz?', a: 'Evet. Her aşama sahip, kanal, bölge ve satış tipi bazında segmentlenebilir.' },
      { q: 'Gelir forecast desteği var mı?', a: 'Evet. Forecast; geçmiş dönüşüm, mevcut aşama dağılımı ve güven katsayılarını birlikte kullanır.' },
      { q: 'Haftalık satış toplantılarında kullanılabilir mi?', a: 'Evet, sayfa operasyonel haftalık review ve yönetim planlaması için tasarlanmıştır.' },
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

/* ── Pipeline velocity visual ── */
const VelocityBar: React.FC<{ stage: string; days: string; delta: string; index: number; maxWidth: number }> = ({ stage, days, delta, index, maxWidth }) => {
  const width = Math.max(20, maxWidth - index * 15);
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="flex items-center gap-4"
    >
      <div style={{ width: 120, fontSize: 12, fontWeight: 500, color: '#555', flexShrink: 0 }}>{stage}</div>
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#1e293b]"
            initial={{ width: 0 }}
            whileInView={{ width: `${width}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: index * 0.1 + 0.2, ease: 'easeOut' }}
          />
        </div>
        <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 500, color: '#222', width: 60, textAlign: 'right', flexShrink: 0 }}>{days}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#555', width: 38, flexShrink: 0 }}>{delta}</div>
      </div>
    </motion.div>
  );
};

export default function SalesSolutionsPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];

  return (
    <div style={{ background: '#fff', color: '#222', fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <PublicHeader activeKey="sales" />

      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1280 }}>

        {/* ── Hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ padding: '72px 0 0', position: 'relative' }}
        >
          <motion.div
            animate={{ y: [0, -18, 0], x: [0, 8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', top: 20, right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(60,60,60,0.05) 0%, transparent 70%)', pointerEvents: 'none' }}
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

        {/* ── Velocity ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ paddingTop: 64, paddingBottom: 64, borderTop: '1px solid #e7e7e7', marginTop: 0 }}
        >
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2" style={{ gap: 64, alignItems: 'start' }}>
            {/* Velocity bars */}
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: 32 }}>
                {tx.velocityTitle}
              </div>
              <div className="flex flex-col gap-5">
                {tx.velocityRows.map((row, i) => (
                  <VelocityBar
                    key={row.stage}
                    stage={row.stage}
                    days={row.days}
                    delta={row.delta}
                    index={i}
                    maxWidth={90 - i * 10}
                  />
                ))}
              </div>
            </div>

            {/* Team segments */}
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: 32 }}>
                {tx.teamTitle}
              </div>
              <div className="flex flex-col gap-4">
                {tx.teamSegments.map((seg, i) => (
                  <motion.div
                    key={seg.name}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>{seg.name}</span>
                      <div className="flex items-center gap-3">
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#888' }}>{seg.velocity}</span>
                        <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 500, color: '#222' }}>{seg.value}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-[#1e293b]"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${seg.conversion}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: i * 0.1 + 0.2 }}
                      />
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#aaa', marginTop: 4 }}>
                      {lang === 'ru' ? 'Конверсия' : lang === 'tr' ? 'Dönüşüm' : 'Conversion'} {seg.conversion}%
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
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
                {lang === 'ru' ? 'Классический подход' : lang === 'tr' ? 'Klasik yaklaşım' : 'Classic approach'}
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

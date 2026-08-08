import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stagger: any = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const VALUE_ICONS = [
  <svg key="0" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
  </svg>,
  <svg key="1" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>,
  <svg key="2" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>,
  <svg key="3" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>,
];

function AnimatedNumber({ value }: { value: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      className="text-3xl font-bold text-slate-900"
    >
      {value}
    </motion.div>
  );
}

export default function AboutPage() {
  const { t } = useTranslation();

  const values = t('publicPages.about.values', { returnObjects: true }) as Array<{ title: string; desc: string }>;
  const milestones = t('publicPages.about.milestones', { returnObjects: true }) as Array<{ year: string; text: string }>;
  const techStack = t('publicPages.about.techStack', { returnObjects: true }) as Array<{ label: string; stack: string }>;
  const stats = [
    { value: '500+', label: t('publicPages.about.statsClients') },
    { value: '20+', label: t('publicPages.about.statsIntegrations') },
    { value: '99.9%', label: t('publicPages.about.statsUptime') },
    { value: t('publicPages.about.statsYearsValue'), label: t('publicPages.about.statsYears') },
  ];

  return (
    <PublicPageLayout
      pageKey="about"
      title={t('publicPages.about.title')}
      subtitle={t('publicPages.about.subtitle')}
    >
      {/* Stats */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16"
      >
        {stats.map((s) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.10)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
          >
            <AnimatedNumber value={s.value} />
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Mission */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-16"
      >
        <div className="relative overflow-hidden rounded-3xl bg-black text-white p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.22em] opacity-50 mb-3 font-semibold">{t('publicPages.about.missionKicker')}</div>
            <blockquote className="text-xl sm:text-2xl font-semibold leading-relaxed max-w-3xl">
              «{t('publicPages.about.missionQuote')}»
            </blockquote>
            <div className="mt-6 text-sm opacity-50">{t('publicPages.about.missionAttribution')}</div>
          </div>
        </div>
      </motion.section>

      {/* Values */}
      <section className="mb-16">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400 mb-2 font-semibold">{t('publicPages.about.valuesKicker')}</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-8">{t('publicPages.about.valuesTitle')}</h2>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {values.map((v, i) => (
            <motion.div
              key={v.title}
              variants={fadeUp}
              whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.10)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-600 group-hover:bg-black group-hover:text-white group-hover:border-black transition-all duration-200">
                {VALUE_ICONS[i]}
              </div>
              <div className="text-sm font-semibold text-slate-800 mb-2">{v.title}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{v.desc}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Timeline */}
      <section className="mb-16">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400 mb-2 font-semibold">{t('publicPages.about.historyKicker')}</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-8">{t('publicPages.about.historyTitle')}</h2>
        <div className="relative">
          <div className="absolute left-[1.75rem] top-0 bottom-0 w-px bg-slate-200 hidden sm:block" />
          <div className="flex flex-col gap-5">
            {milestones.map((m, i) => (
              <motion.div
                key={m.year}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4, ease: 'easeOut' }}
                className="flex items-start gap-4"
              >
                <div className="shrink-0 w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center text-xs font-bold z-10">
                  {m.year}
                </div>
                <motion.div
                  whileHover={{ x: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="rounded-2xl border border-slate-200 bg-white p-4 flex-1 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
                >
                  <p className="text-sm text-slate-700">{m.text}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        className="mb-16"
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400 mb-2 font-semibold">{t('publicPages.about.techKicker')}</div>
          <h2 className="text-xl font-bold text-slate-900 mb-6">{t('publicPages.about.techTitle')}</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {techStack.map((tech) => (
              <div key={tech.label} className="group">
                <div className="text-xs font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-black inline-block" />
                  {tech.label}
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">{tech.stack}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Contact CTA */}
      <section className="text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{t('publicPages.about.ctaTitle')}</h2>
        <p className="text-sm text-slate-500 mb-6">{t('publicPages.about.ctaSubtitle')}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
          >
            {t('publicPages.about.ctaBtnDemo')}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <Link
            to="/features"
            className="inline-flex items-center px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 transition-colors"
          >
            {t('publicPages.about.ctaBtnFeatures')}
          </Link>
        </div>
      </section>
    </PublicPageLayout>
  );
}

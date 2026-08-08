import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

interface CompareItem {
  title: string;
  desc: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stagger: any = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } },
};

export default function ComparePage() {
  const { t } = useTranslation();
  const items = t('publicPages.compare.items', { returnObjects: true }) as CompareItem[];

  return (
    <PublicPageLayout
      pageKey="compare"
      title={t('publicPages.compare.title')}
      subtitle={t('publicPages.compare.subtitle')}
    >
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {items.map((item) => (
          <motion.div
            key={item.title}
            variants={fadeUp}
            whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.10)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm shrink-0 mb-3">✓</div>
            <div className="text-sm font-semibold text-slate-900 mb-2">{item.title}</div>
            <div className="text-xs text-slate-500 leading-relaxed">{item.desc}</div>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-6 flex flex-wrap gap-4">
        <Link to="/pricing" className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 transition-colors">
          {t('publicPages.compare.pricingLink')}
        </Link>
        <Link to="/security" className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 transition-colors">
          {t('publicPages.compare.securityLink')}
        </Link>
      </div>

      {/* CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card"
      >
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400 mb-2">{t('publicPages.compare.ctaKicker')}</div>
        <h3 className="text-xl font-semibold text-slate-900 mb-6">{t('publicPages.compare.ctaTitle')}</h3>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/?mode=signup" className="px-5 py-2.5 rounded-xl bg-black text-white text-xs font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:bg-black-hover transition-all">
            {t('publicPages.compare.ctaBtn1')}
          </Link>
          <Link to="/contact" className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 hover:border-slate-300 transition-all">
            {t('publicPages.compare.ctaBtn2')}
          </Link>
        </div>
      </motion.section>
    </PublicPageLayout>
  );
}

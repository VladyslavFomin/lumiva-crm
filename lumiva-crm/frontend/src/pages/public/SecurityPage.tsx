import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

interface SecurityItem {
  title: string;
  desc: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function SectionBlock({
  kicker,
  title,
  items,
}: {
  kicker: string;
  title: string;
  items: SecurityItem[];
}) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={fadeUp}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">{kicker}</div>
      <h2 className="text-lg font-bold text-slate-900 mb-4">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.title} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-800 mb-1.5">{item.title}</div>
            <div className="text-xs text-slate-500 leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

export default function SecurityPage() {
  const { t } = useTranslation();

  const s1Items = t('publicPages.security.s1Items', { returnObjects: true }) as SecurityItem[];
  const s2Items = t('publicPages.security.s2Items', { returnObjects: true }) as SecurityItem[];
  const s3Items = t('publicPages.security.s3Items', { returnObjects: true }) as SecurityItem[];
  const s5Items = t('publicPages.security.s5Items', { returnObjects: true }) as SecurityItem[];

  return (
    <PublicPageLayout
      pageKey="security"
      title={t('publicPages.security.title')}
      subtitle={t('publicPages.security.subtitle')}
    >
      <div className="flex flex-col gap-4">
        <SectionBlock kicker={t('publicPages.security.s1Kicker')} title={t('publicPages.security.s1Title')} items={s1Items} />
        <SectionBlock kicker={t('publicPages.security.s2Kicker')} title={t('publicPages.security.s2Title')} items={s2Items} />
        <SectionBlock kicker={t('publicPages.security.s3Kicker')} title={t('publicPages.security.s3Title')} items={s3Items} />

        {/* Change logs — plain text, not an item grid (single honest paragraph) */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">{t('publicPages.security.s4Kicker')}</div>
          <h2 className="text-lg font-bold text-slate-900 mb-3">{t('publicPages.security.s4Title')}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{t('publicPages.security.s4Text')}</p>
        </motion.section>

        <SectionBlock kicker={t('publicPages.security.s5Kicker')} title={t('publicPages.security.s5Title')} items={s5Items} />
        <div className="-mt-2 px-1">
          <Link to="/privacy" className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 transition-colors">
            {t('publicPages.security.s5PrivacyLink')}
          </Link>
        </div>

        {/* Report a vulnerability */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          className="rounded-2xl bg-black text-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h2 className="text-base font-semibold mb-1.5">{t('publicPages.security.s6Title')}</h2>
            <p className="text-xs text-white/70 leading-relaxed max-w-xl">{t('publicPages.security.s6Text')}</p>
          </div>
          <a
            href="mailto:hello@lumiva.agency"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors"
          >
            {t('publicPages.security.s6EmailLabel')}
          </a>
        </motion.section>
      </div>
    </PublicPageLayout>
  );
}

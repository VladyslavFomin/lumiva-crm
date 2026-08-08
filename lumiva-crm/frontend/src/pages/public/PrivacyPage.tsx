import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

interface PrivacySection {
  id: string;
  title: string;
  content: string;
}

export default function PrivacyPage() {
  const { t } = useTranslation();
  const SECTIONS = t('publicPages.privacy.sections', { returnObjects: true }) as PrivacySection[];
  const [activeId, setActiveId] = useState<string>('general');

  return (
    <PublicPageLayout
      pageKey="privacy"
      title={t('publicPages.privacy.title')}
      subtitle={t('publicPages.privacy.subtitle')}
    >
      {/* Last updated badge */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {t('publicPages.privacy.lastUpdatedBadge')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
          {t('publicPages.privacy.gdprBadge')}
        </span>
        <Link
          to="/contact"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          privacy@lumiva.agency
        </Link>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-8 items-start">
        {/* Sticky TOC */}
        <nav className="hidden lg:block sticky top-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-3 px-2">{t('publicPages.privacy.toc')}</div>
          <div className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveId(s.id);
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`text-left rounded-xl px-3 py-2 text-xs transition-all ${
                  activeId === s.id
                    ? 'bg-black text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex flex-col gap-4">
          {SECTIONS.map((s, i) => (
            <motion.div
              key={s.id}
              id={s.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
              onViewportEnter={() => setActiveId(s.id)}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] scroll-mt-28"
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-bold text-slate-500">
                  {i + 1}
                </span>
                <h2 className="text-base font-bold text-slate-900 leading-snug">{s.title}</h2>
              </div>
              <div className="text-sm text-slate-600 leading-relaxed space-y-3 pl-10">
                {s.content.split('\n\n').map((block, bi) => {
                  if (block.startsWith('**') && block.endsWith('**') && !block.slice(2).includes('**')) {
                    return <p key={bi} className="font-semibold text-slate-800">{block.replace(/\*\*/g, '')}</p>;
                  }
                  const lines = block.split('\n');
                  const hasBullets = lines.some((l) => l.startsWith('- '));
                  if (hasBullets) {
                    return (
                      <ul key={bi} className="space-y-1.5">
                        {lines.map((line, li) =>
                          line.startsWith('- ') ? (
                            <li key={li} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                              <span>{line.slice(2)}</span>
                            </li>
                          ) : line ? (
                            <p key={li} className={line.startsWith('*') ? 'font-medium text-slate-700' : ''}
                              dangerouslySetInnerHTML={{ __html: line.replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') }}
                            />
                          ) : null
                        )}
                      </ul>
                    );
                  }
                  return (
                    <p key={bi}
                      dangerouslySetInnerHTML={{ __html: block.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>') }}
                    />
                  );
                })}
              </div>
            </motion.div>
          ))}

          {/* Footer note */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">{t('publicPages.privacy.footerTitle')}</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t('publicPages.privacy.footerText')}{' '}
                  <a href="mailto:privacy@lumiva.agency" className="text-slate-800 underline underline-offset-2 hover:text-black">
                    privacy@lumiva.agency
                  </a>{' '}
                  {t('publicPages.privacy.footerOr')}{' '}
                  <Link to="/contact" className="text-slate-800 underline underline-offset-2 hover:text-black">
                    {t('publicPages.privacy.footerForm')}
                  </Link>.
                  {' '}{t('publicPages.privacy.footerResponse')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}

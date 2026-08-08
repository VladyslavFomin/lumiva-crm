import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

interface FaqItem {
  q: string;
  a: string;
}

interface FaqCategory {
  category: string;
  items: FaqItem[];
}

const AccordionItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-slate-900">{q}</span>
        <span className={`shrink-0 w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 transition-transform ${open ? 'rotate-45' : ''}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm text-slate-500 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function FaqPage() {
  const { t } = useTranslation();
  const FAQS = t('publicPages.faq.categories', { returnObjects: true }) as FaqCategory[];
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const filtered = activeCategory ? FAQS.filter((g) => g.category === activeCategory) : FAQS;

  const usefulLinks = [
    { label: t('publicPages.faq.linkFeatures'), to: '/features' },
    { label: t('publicPages.faq.linkPricing'), to: '/pricing' },
    { label: t('publicPages.faq.linkIntegrations'), to: '/integrations' },
    { label: t('publicPages.faq.linkApi'), to: '/api-integration' },
    { label: t('publicPages.faq.linkChangelog'), to: '/changelog' },
  ];

  return (
    <PublicPageLayout
      pageKey="faq"
      title={t('publicPages.faq.title')}
      subtitle={t('publicPages.faq.subtitle')}
    >
      {/* Category filter */}
      <div className="mt-8 mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            activeCategory === null
              ? 'bg-black text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)]'
              : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          {t('publicPages.faq.allCategory')}
        </button>
        {FAQS.map((g) => (
          <button
            key={g.category}
            onClick={() => setActiveCategory(activeCategory === g.category ? null : g.category)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeCategory === g.category
                ? 'bg-black text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)]'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            {g.category}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {filtered.map((group) => (
            <div key={group.category} className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-4">{group.category}</div>
              {group.items.map((item) => (
                <AccordionItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">{t('publicPages.faq.notFoundTitle')}</h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {t('publicPages.faq.notFoundText')}
            </p>
            <Link to="/contact" className="block w-full text-center py-2.5 rounded-xl bg-black text-white text-xs font-semibold hover:bg-black-hover transition-all">
              {t('publicPages.faq.contactBtn')}
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">{t('publicPages.faq.usefulLinks')}</h4>
            <div className="flex flex-col gap-2">
              {usefulLinks.map((l) => (
                <Link key={l.label} to={l.to} className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
                  <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}

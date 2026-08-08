import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

interface TermsSection {
  title: string;
  content: string;
}

export default function TermsPage() {
  const { t } = useTranslation();
  const SECTIONS = t('publicPages.terms.sections', { returnObjects: true }) as TermsSection[];

  return (
    <PublicPageLayout
      pageKey="terms"
      title={t('publicPages.terms.title')}
      subtitle={t('publicPages.terms.subtitle')}
    >
      <div className="mt-10 grid lg:grid-cols-4 gap-8 items-start">

        {/* Table of contents */}
        <div className="lg:col-span-1 hidden lg:block">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 sticky top-24">
            <div className="text-xs font-semibold text-slate-900 mb-3">{t('publicPages.terms.toc')}</div>
            <div className="flex flex-col gap-1">
              {SECTIONS.map((s) => (
                <a
                  key={s.title}
                  href={`#section-${s.title.slice(0, 2).trim()}`}
                  className="text-[11px] text-slate-500 hover:text-slate-900 py-0.5 transition-colors leading-relaxed"
                >
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 sm:p-8">
            <div className="flex flex-col gap-8">
              {SECTIONS.map((section) => (
                <div
                  key={section.title}
                  id={`section-${section.title.slice(0, 2).trim()}`}
                >
                  <h2 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-200">
                    {section.title}
                  </h2>
                  <div className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 pt-6 border-t border-slate-200">
              <p className="text-xs text-slate-400">
                {t('publicPages.terms.lastUpdated')}{' '}
                <a href="mailto:hello@lumiva.agency" className="text-lumiva-accent underline">
                  hello@lumiva.agency
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}

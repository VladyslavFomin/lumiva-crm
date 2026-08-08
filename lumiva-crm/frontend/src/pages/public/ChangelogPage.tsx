import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

type ChangeType = 'new' | 'improved' | 'fixed' | 'security';

interface ChangeItem {
  type: ChangeType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  highlight?: string;
  changes: ChangeItem[];
}

export default function ChangelogPage() {
  const { t } = useTranslation();
  const RELEASES = t('publicPages.changelog.releases', { returnObjects: true }) as Release[];
  const TYPE_CONFIG: Record<ChangeType, { label: string; color: string }> = {
    new:      { label: t('publicPages.changelog.tagNew'),      color: 'bg-emerald-100 text-emerald-700' },
    improved: { label: t('publicPages.changelog.tagImproved'), color: 'bg-blue-100 text-blue-700' },
    fixed:    { label: t('publicPages.changelog.tagFixed'),    color: 'bg-amber-100 text-amber-700' },
    security: { label: t('publicPages.changelog.tagSecurity'), color: 'bg-red-100 text-red-700' },
  };

  return (
    <PublicPageLayout
      pageKey="changelog"
      title={t('publicPages.changelog.title')}
      subtitle={t('publicPages.changelog.subtitle')}
    >
      <div className="mt-8 flex flex-wrap gap-2 mb-8">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <span key={key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        ))}
        <span className="ml-auto text-xs text-slate-400 self-center">{RELEASES.length} {t('publicPages.changelog.releasesCount')}</span>
      </div>

      <div className="relative">
        <div className="absolute left-[1.875rem] top-0 bottom-0 w-px bg-border-default hidden sm:block" />
        <div className="flex flex-col gap-8">
          {RELEASES.map((release, ri) => (
            <motion.div
              key={release.version}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: ri * 0.05, duration: 0.35 }}
              className="flex gap-6 items-start"
            >
              {/* Version badge */}
              <div className="shrink-0 w-[3.75rem] flex flex-col items-center gap-1 z-10">
                <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center text-[10px] font-bold shadow-[0_4px_14px_rgba(0,0,0,0.25)]">
                  v{release.version.split('.').slice(0, 2).join('.')}
                </div>
              </div>

              {/* Release card */}
              <div className="flex-1 card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-slate-900">v{release.version}</span>
                      {ri === 0 && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black text-white">{t('publicPages.changelog.latest')}</span>
                      )}
                    </div>
                    {release.highlight && (
                      <div className="text-sm font-medium text-slate-900">{release.highlight}</div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">{release.date}</div>
                </div>

                <div className="flex flex-col gap-2">
                  {release.changes.map((change, ci) => {
                    const cfg = TYPE_CONFIG[change.type];
                    return (
                      <div key={ci} className="flex items-start gap-2.5 text-xs">
                        <span className={`shrink-0 mt-0.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-slate-500 leading-relaxed">{change.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Subscribe CTA */}
      <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400 mb-2">{t('publicPages.changelog.subscribeTitle')}</div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">{t('publicPages.changelog.followTitle')}</h3>
        <p className="text-sm text-slate-500 mb-6">{t('publicPages.changelog.subscribeSubtitle')}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a href="https://t.me/lumiva_crm" className="px-5 py-2.5 rounded-xl bg-black text-white text-xs font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:bg-black-hover transition-all">
            {t('publicPages.changelog.telegramBtn')}
          </a>
          <Link to="/contact" className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 hover:border-slate-300 transition-all">
            {t('publicPages.changelog.suggestBtn')}
          </Link>
        </div>
      </div>
    </PublicPageLayout>
  );
}

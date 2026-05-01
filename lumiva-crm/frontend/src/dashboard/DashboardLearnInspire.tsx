import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type Props = {
  slugs: string[];
  /** When true renders compact tip-link sidebar style */
  inSidebar?: boolean;
};

const STATIC_LINKS = [
  {
    key: 'quickstart',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    ),
    href: '/blog',
    i18nKey: 'quickstart',
    fallback: 'Быстрый старт за 5 минут',
  },
  {
    key: 'help',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4" /><path d="M12 17v.01" />
      </svg>
    ),
    href: '/faq',
    i18nKey: 'helpCenter',
    fallback: 'Центр помощи',
  },
  {
    key: 'whats-new',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" />
      </svg>
    ),
    href: '/changelog',
    i18nKey: 'whatsNew',
    fallback: 'Что нового в Lumiva',
  },
  {
    key: 'demo',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" />
      </svg>
    ),
    href: '/contact',
    i18nKey: 'requestDemo',
    fallback: 'Запросить демо команды',
  },
];

export const DashboardLearnInspire: React.FC<Props> = ({ slugs, inSidebar }) => {
  const { t } = useTranslation();
  const list = slugs.length ? slugs : ['crm-adoption', 'analytics-dashboards', 'automation-triggers'];

  if (inSidebar) {
    return (
      <div className="flex flex-col gap-px">
        {STATIC_LINKS.map((item) => (
          <Link
            key={item.key}
            to={item.href}
            className="flex items-center gap-2.5 px-1 py-[7px] rounded-md text-[12.5px] text-slate-800 hover:bg-slate-50 transition-colors group"
          >
            <span className="text-slate-400 flex-shrink-0">{item.icon}</span>
            <span className="flex-1 leading-snug">
              {t(`crm.dashboard.learn.links.${item.i18nKey}`, { defaultValue: item.fallback })}
            </span>
            <svg
              className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        ))}
        <div className="pt-2 mt-1 border-t border-slate-100">
          <Link
            to="/blog"
            className="text-[11px] font-medium text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline transition-colors"
          >
            {t('crm.dashboard.learn.openBlog')}
          </Link>
        </div>
      </div>
    );
  }

  // Full widget style (for main grid)
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500 leading-relaxed">
        {t('crm.dashboard.learn.subtitle')}
      </p>
      <ul className="space-y-2">
        {list.map((slug) => (
          <li key={slug}>
            <Link
              to={`/blog#post-${slug}`}
              className="group flex flex-col rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 px-3 py-2.5 transition hover:border-sky-300/80 hover:shadow-sm"
            >
              <span className="text-[12px] font-semibold text-slate-900 group-hover:text-sky-800">
                {t(`crm.dashboard.learn.posts.${slug}.title`, { defaultValue: slug })}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                {t(`crm.dashboard.learn.posts.${slug}.excerpt`, { defaultValue: '' })}
              </span>
              <span className="text-[10px] font-medium text-sky-700 mt-1">
                {t('crm.dashboard.learn.readMore')} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/blog"
        className="inline-flex text-[11px] font-medium text-slate-700 hover:text-slate-900 underline-offset-2 hover:underline"
      >
        {t('crm.dashboard.learn.openBlog')}
      </Link>
    </div>
  );
};

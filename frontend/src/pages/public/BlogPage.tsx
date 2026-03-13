import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function BlogPage() {
  const { t } = useTranslation();
  const posts = t('publicPages.blog.posts', { returnObjects: true }) as Array<{
    title: string;
    text: string;
  }>;
  return (
    <PublicPageLayout
      pageKey="blog"
      title={t('publicPages.blog.title')}
      subtitle={t('publicPages.blog.subtitle')}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {posts.map((post) => (
          <article
            key={post.title}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-[0_22px_45px_rgba(15,23,42,0.1)]"
          >
            <h3 className="text-sm font-semibold text-slate-900">{post.title}</h3>
            <p className="mt-2 text-xs text-slate-600">{post.text}</p>
            <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>Read</span>
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
        В блоге мы публикуем материалы по CRM-архитектуре, аналитике каналов, управлению воронкой и внедрению
        автоматизаций. Контент ориентирован на практические кейсы и решения, которые можно применять сразу в работе.
      </div>
    </PublicPageLayout>
  );
}

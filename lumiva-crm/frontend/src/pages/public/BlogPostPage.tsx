import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { PublicPageLayout } from './PublicPageLayout';
import { BLOG_POSTS, type BlogPost } from './blogPosts.data';

type Lang = 'ru' | 'en' | 'tr';

const T = {
  ru: {
    notFoundTitle: 'Статья не найдена',
    notFoundSubtitle: 'Похоже, эта статья была перемещена или удалена.',
    backToBlog: 'Ко всем статьям',
    minRead: 'мин. чтения',
    moreArticles: 'Другие статьи',
  },
  en: {
    notFoundTitle: 'Article not found',
    notFoundSubtitle: 'This article may have been moved or removed.',
    backToBlog: 'Back to all articles',
    minRead: 'min read',
    moreArticles: 'More articles',
  },
  tr: {
    notFoundTitle: 'Makale bulunamadı',
    notFoundSubtitle: 'Bu makale taşınmış veya kaldırılmış olabilir.',
    backToBlog: 'Tüm makalelere dön',
    minRead: 'dk okuma',
    moreArticles: 'Diğer makaleler',
  },
};

const CATEGORIES: Record<string, { ru: string; en: string; tr: string }> = {
  sales: { ru: 'Продажи', en: 'Sales', tr: 'Satış' },
  analytics: { ru: 'Аналитика', en: 'Analytics', tr: 'Analitik' },
  automation: { ru: 'Автоматизация', en: 'Automation', tr: 'Otomasyon' },
  implementation: { ru: 'Внедрение', en: 'Implementation', tr: 'Uygulama' },
  integrations: { ru: 'Интеграции', en: 'Integrations', tr: 'Entegrasyonlar' },
};

function formatDate(iso: string, lang: Lang) {
  const d = new Date(iso);
  if (lang === 'ru') return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  if (lang === 'tr') return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getTitle(p: BlogPost, lang: Lang) {
  return lang === 'en' ? p.titleEn : lang === 'tr' ? p.titleTr : p.titleRu;
}
function getExcerpt(p: BlogPost, lang: Lang) {
  return lang === 'en' ? p.excerptEn : lang === 'tr' ? p.excerptTr : p.excerptRu;
}
function getBody(p: BlogPost, lang: Lang) {
  return lang === 'en' ? p.bodyEn : lang === 'tr' ? p.bodyTr : p.bodyRu;
}

export default function BlogPostPage() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2) as Lang;
  const t = T[lang] ?? T.ru;
  const { slug } = useParams<{ slug: string }>();

  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return (
      <PublicPageLayout pageKey="blog" title={t.notFoundTitle} subtitle={t.notFoundSubtitle}>
        <div className="flex justify-center py-10">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
          >
            {t.backToBlog}
          </Link>
        </div>
      </PublicPageLayout>
    );
  }

  const body = getBody(post, lang);
  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug && p.category === post.category).slice(0, 3);
  const relatedFallback = related.length > 0 ? related : BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <PublicPageLayout pageKey="blog" title={getTitle(post, lang)} subtitle={getExcerpt(post, lang)}>
      <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-medium text-slate-500 uppercase tracking-[0.14em]">
              {CATEGORIES[post.category]?.[lang] ?? post.category}
            </span>
            <span className="text-[10px] text-slate-400">{formatDate(post.date, lang)}</span>
            <span className="text-[10px] text-slate-400">·</span>
            <span className="text-[10px] text-slate-400">{post.readTime} {t.minRead}</span>
          </div>

          <div className="prose prose-slate max-w-none">
            {body.map((paragraph, i) => (
              <p key={i} className="text-sm sm:text-[15px] text-slate-600 leading-relaxed mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <span className="text-[10px] text-slate-400 uppercase tracking-[0.14em]">{post.tag}</span>
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              {t.backToBlog}
            </Link>
          </div>
        </motion.article>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-28">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">{t.moreArticles}</h4>
            <div className="flex flex-col gap-3">
              {relatedFallback.map((p) => (
                <Link key={p.slug} to={`/blog/${p.slug}`} className="flex items-start gap-2.5 group">
                  <span className="text-xs text-slate-600 leading-snug group-hover:text-slate-900 transition-colors">
                    {getTitle(p, lang)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}

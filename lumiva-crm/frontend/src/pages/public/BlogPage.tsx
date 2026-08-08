import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';
import { BLOG_POSTS, type BlogPost } from './blogPosts.data';

type Lang = 'ru' | 'en' | 'tr';

const T = {
  ru: {
    title: 'Блог Lumiva CRM',
    subtitle: 'Практические материалы по CRM, аналитике, автоматизациям и росту бизнеса.',
    allCategories: 'Все',
    readMore: 'Читать',
    minRead: 'мин. чтения',
    featured: 'Избранное',
    subscribe: 'Подписаться на обновления',
    subscribeDesc: 'Новые статьи о CRM, продажах и автоматизации — раз в неделю.',
    emailPlaceholder: 'Ваш email',
    subscribeBtn: 'Подписаться',
    popularPosts: 'Популярные материалы',
    categories: 'Категории',
  },
  en: {
    title: 'Lumiva CRM Blog',
    subtitle: 'Practical guides on CRM, analytics, automations, and business growth.',
    allCategories: 'All',
    readMore: 'Read',
    minRead: 'min read',
    featured: 'Featured',
    subscribe: 'Subscribe to updates',
    subscribeDesc: 'Weekly articles on CRM, sales, and automation delivered to your inbox.',
    emailPlaceholder: 'Your email',
    subscribeBtn: 'Subscribe',
    popularPosts: 'Popular posts',
    categories: 'Categories',
  },
  tr: {
    title: 'Lumiva CRM Blog',
    subtitle: 'CRM, analitik, otomasyon ve iş büyümesi üzerine pratik rehberler.',
    allCategories: 'Tümü',
    readMore: 'Oku',
    minRead: 'dk okuma',
    featured: 'Öne Çıkan',
    subscribe: 'Güncellemelere abone ol',
    subscribeDesc: 'CRM, satış ve otomasyon hakkında haftalık makaleler.',
    emailPlaceholder: 'E-posta adresiniz',
    subscribeBtn: 'Abone ol',
    popularPosts: 'Popüler yazılar',
    categories: 'Kategoriler',
  },
};

const POSTS: BlogPost[] = BLOG_POSTS;

const CATEGORIES = [
  { key: 'sales', ru: 'Продажи', en: 'Sales', tr: 'Satış' },
  { key: 'analytics', ru: 'Аналитика', en: 'Analytics', tr: 'Analitik' },
  { key: 'automation', ru: 'Автоматизация', en: 'Automation', tr: 'Otomasyon' },
  { key: 'implementation', ru: 'Внедрение', en: 'Implementation', tr: 'Uygulama' },
  { key: 'integrations', ru: 'Интеграции', en: 'Integrations', tr: 'Entegrasyonlar' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stagger: any = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } },
};

function formatDate(iso: string, lang: Lang) {
  const d = new Date(iso);
  if (lang === 'ru') return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  if (lang === 'tr') return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getPostTitle(p: BlogPost, lang: Lang) {
  return lang === 'en' ? p.titleEn : lang === 'tr' ? p.titleTr : p.titleRu;
}
function getPostExcerpt(p: BlogPost, lang: Lang) {
  return lang === 'en' ? p.excerptEn : lang === 'tr' ? p.excerptTr : p.excerptRu;
}

export default function BlogPage() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2) as Lang;
  const t = T[lang] ?? T.ru;

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const featured = POSTS.find((p) => p.featured);
  const filtered = POSTS.filter(
    (p) => !p.featured && (activeCategory === null || p.category === activeCategory),
  );

  return (
    <PublicPageLayout pageKey="blog" title={t.title} subtitle={t.subtitle}>
      {/* Featured post */}
      {featured && (
        <motion.div
          id={featured ? `post-${featured.slug}` : undefined}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)] transition-shadow group"
        >
          <div className="grid lg:grid-cols-[1fr_360px]">
            <div className="p-8 sm:p-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black text-white text-[10px] font-semibold uppercase tracking-[0.16em]">
                  {t.featured}
                </span>
                <span className="text-[10px] text-slate-400">{formatDate(featured.date, lang)}</span>
                <span className="text-[10px] text-slate-400">·</span>
                <span className="text-[10px] text-slate-400">{featured.readTime} {t.minRead}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug mb-3 group-hover:text-black transition-colors">
                {getPostTitle(featured, lang)}
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6 max-w-prose">
                {getPostExcerpt(featured, lang)}
              </p>
              <Link
                to={`/blog/${featured.slug}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                {t.readMore}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            <div className="hidden lg:flex items-center justify-center bg-slate-50 border-l border-slate-100 p-8">
              <div className="space-y-3 w-full">
                {[65, 40, 80, 55].map((w, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: 'easeOut' }}
                    style={{ transformOrigin: 'left', width: `${w}%` }}
                    className="h-2.5 rounded-full bg-slate-200"
                  />
                ))}
                <div className="pt-4 flex gap-2">
                  {['SLA', 'Funnel', 'KPI'].map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-medium text-slate-500">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
        <div>
          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeCategory === null
                  ? 'bg-black text-white shadow-[0_4px_14px_rgba(0,0,0,0.2)]'
                  : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {t.allCategories}
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeCategory === cat.key
                    ? 'bg-black text-white shadow-[0_4px_14px_rgba(0,0,0,0.2)]'
                    : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {lang === 'en' ? cat.en : lang === 'tr' ? cat.tr : cat.ru}
              </button>
            ))}
          </div>

          {/* Posts grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory ?? 'all'}
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="grid sm:grid-cols-2 gap-4"
            >
              {filtered.map((post) => (
                <motion.article
                  id={`post-${post.slug}`}
                  key={post.slug}
                  variants={fadeUp}
                  whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.10)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col scroll-mt-24"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-medium text-slate-500 uppercase tracking-[0.14em]">
                      {CATEGORIES.find((c) => c.key === post.category)?.[lang] ?? post.category}
                    </span>
                    <span className="text-[10px] text-slate-400">{post.readTime} {t.minRead}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 leading-snug mb-2 group-hover:text-black transition-colors flex-1">
                    {getPostTitle(post, lang)}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    {getPostExcerpt(post, lang)}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">{formatDate(post.date, lang)}</span>
                    <Link
                      to={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      {t.readMore}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-28">
          {/* Newsletter */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">{t.subscribe}</h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">{t.subscribeDesc}</p>
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder={t.emailPlaceholder}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400 transition-colors"
              />
              <button className="w-full py-2.5 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors">
                {t.subscribeBtn}
              </button>
            </div>
          </div>

          {/* Categories list */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">{t.categories}</h4>
            <div className="flex flex-col gap-1">
              {CATEGORIES.map((cat) => {
                const count = POSTS.filter((p) => p.category === cat.key).length;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                      activeCategory === cat.key
                        ? 'bg-black text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{lang === 'en' ? cat.en : lang === 'tr' ? cat.tr : cat.ru}</span>
                    <span className={`text-[10px] ${activeCategory === cat.key ? 'opacity-60' : 'text-slate-400'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Popular */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">{t.popularPosts}</h4>
            <div className="flex flex-col gap-3">
              {POSTS.slice(0, 3).map((post, i) => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="flex items-start gap-2.5 group"
                >
                  <span className="shrink-0 text-[10px] font-bold text-slate-300 mt-0.5 w-4">0{i + 1}</span>
                  <span className="text-xs text-slate-600 leading-snug group-hover:text-slate-900 transition-colors">
                    {getPostTitle(post, lang)}
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

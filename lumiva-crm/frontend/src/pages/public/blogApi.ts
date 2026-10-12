/**
 * Блог crm.lumiva.agency читает статьи из CMS сайта агентства (pl2.lumiva.agency, lumiva-agency-backend).
 * Статья попадает сюда, если в pl2 у неё отмечен сайт «Блог CRM» (sites содержит 'crm').
 * Переводы en/tr приходят с бэкенда (?lang=), статьи без нужного языка бэкенд не отдаёт.
 */
export const BLOG_API = 'https://pl2.lumiva.agency/api/blog';

export type BlogBlock =
  | { type: 'paragraph'; data: { text: string } }
  | { type: 'heading'; data: { level: 2 | 3; text: string } }
  | { type: 'image'; data: { url: string; caption?: string; alt?: string } }
  | { type: 'figure'; data: { figNum?: string; title: string; subtitle?: string; caption?: string; note?: string; bars: { label: string; value: number; color?: string }[] } }
  | { type: 'callout'; data: { label?: string; text: string } }
  | { type: 'quote'; data: { text: string; author?: string } }
  | { type: 'divider'; data: Record<string, never> }
  | { type: 'table'; data: { headers: string[]; rows: string[][] } };

export type BlogPostT = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  blocks: BlogBlock[] | null;
  coverUrl: string | null;
  author: string | null;
  tags: string[] | null;
  category: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  viewCount: number;
};

export type BlogLang = 'ru' | 'en' | 'tr';

export async function fetchBlogPosts(lang: BlogLang, signal?: AbortSignal): Promise<BlogPostT[]> {
  const r = await fetch(`${BLOG_API}?site=crm&status=published&limit=100&lang=${lang}`, { signal });
  if (!r.ok) throw new Error('blog ' + r.status);
  const d = await r.json();
  return Array.isArray(d.items) ? d.items : [];
}

export async function fetchBlogPost(slug: string, lang: BlogLang, signal?: AbortSignal): Promise<BlogPostT | null> {
  const r = await fetch(`${BLOG_API}/${encodeURIComponent(slug)}?site=crm&lang=${lang}`, { signal });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('blog ' + r.status);
  const p: BlogPostT & { status?: string } = await r.json();
  return p.status && p.status !== 'published' ? null : p;
}

/** Блоки статьи; у старых записей без блоков — абзацы из content. */
export function postBlocks(p: BlogPostT): BlogBlock[] {
  if (Array.isArray(p.blocks) && p.blocks.length) return p.blocks;
  return (p.content || '')
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ type: 'paragraph' as const, data: { text } }));
}

function blockText(b: BlogBlock): string {
  switch (b.type) {
    case 'paragraph':
    case 'heading':
    case 'callout':
    case 'quote':
      return b.data.text || '';
    case 'table':
      return [...(b.data.headers || []), ...(b.data.rows || []).flat()].join(' ');
    case 'figure':
      return [b.data.title, b.data.caption].filter(Boolean).join(' ');
    default:
      return '';
  }
}

/** Минуты чтения: ~200 слов в минуту, минимум 1. */
export function readMinutes(p: BlogPostT): number {
  const words = postBlocks(p)
    .map(blockText)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export const postDate = (p: BlogPostT) => p.publishedAt || p.createdAt;

export function fmtDate(iso: string, lang: BlogLang): string {
  const loc = lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU';
  return new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Рубрики: CRM-блога + рубрики сайта агентства (если статья опубликована на обоих сайтах). */
export const CAT_LABELS: Record<BlogLang, Record<string, string>> = {
  ru: {
    sales: 'Продажи', analytics: 'Аналитика', automation: 'Автоматизация', implementation: 'Внедрение', integrations: 'Интеграции',
    brand: 'Бренд', performance: 'Performance', strategy: 'Стратегия', web: 'Web & UX', content: 'Контент', smm: 'SMM', culture: 'Команда',
  },
  en: {
    sales: 'Sales', analytics: 'Analytics', automation: 'Automation', implementation: 'Implementation', integrations: 'Integrations',
    brand: 'Brand', performance: 'Performance', strategy: 'Strategy', web: 'Web & UX', content: 'Content', smm: 'SMM', culture: 'Team',
  },
  tr: {
    sales: 'Satış', analytics: 'Analitik', automation: 'Otomasyon', implementation: 'Uygulama', integrations: 'Entegrasyonlar',
    brand: 'Marka', performance: 'Performans', strategy: 'Strateji', web: 'Web & UX', content: 'İçerik', smm: 'SMM', culture: 'Ekip',
  },
};
export const catLabel = (k: string | null, lang: BlogLang) => (k ? CAT_LABELS[lang][k] || k : '');

/** Персонаж ИИ-сотрудника на сгенерированной обложке (если у статьи нет своей картинки). */
const CAT_ROLE: Record<string, string> = {
  sales: 'sales_manager',
  analytics: 'marketing_analyst',
  automation: 'lead_manager',
  implementation: 'project_manager',
  integrations: 'email_assistant',
  performance: 'marketing_manager',
  smm: 'smm_manager',
  content: 'smm_manager',
  strategy: 'crm_analyst',
};
export const catRole = (k: string | null) => (k && CAT_ROLE[k]) || 'crm_analyst';

export type BlogUi = {
  kick: (n: number) => string;
  h1a: string;
  h1b: string;
  sub: string;
  featured: string;
  read: string;
  min: string;
  all: string;
  emptyCat: string;
  cats: string;
  popular: string;
  tgT: string;
  tgD: string;
  tgBtn: string;
  tryT: string;
  tryD: string;
  tryBtn: string;
  loading: string;
  error: string;
  retry: string;
  none: string;
  back: string;
  share: string;
  copy: string;
  copied: string;
  progress: string;
  left: (m: number) => string;
  next: string;
  also: string;
  notFound: string;
  toBlog: string;
  toc: string;
};

export const BLOG_UI: Record<BlogLang, BlogUi> = {
  ru: {
    kick: (n) => `Блог · ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'материал' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'материала' : 'материалов'}`,
    h1a: 'Блог Lumiva CRM',
    h1b: 'о росте бизнеса.',
    sub: 'Практические материалы по CRM, продажам, аналитике и автоматизации.',
    featured: 'Новое',
    read: 'Читать',
    min: 'мин. чтения',
    all: 'Все',
    emptyCat: 'В этой рубрике пока нет других статей.',
    cats: 'Рубрики',
    popular: 'Популярные материалы',
    tgT: 'Новости Lumiva в Telegram',
    tgD: 'Новые статьи и обновления CRM — в нашем канале.',
    tgBtn: 'Открыть Telegram',
    tryT: 'Попробуйте Lumiva CRM',
    tryD: '14 дней со всеми модулями, без карты.',
    tryBtn: 'Начать бесплатно',
    loading: 'Загружаем статьи…',
    error: 'Не удалось загрузить статьи.',
    retry: 'Повторить',
    none: 'Статей пока нет — скоро здесь появятся материалы.',
    back: 'Все статьи',
    share: 'Поделиться',
    copy: 'Скопировать ссылку',
    copied: 'Скопировано',
    progress: 'Прочитано',
    left: (m) => `≈ ${m} мин. осталось`,
    next: 'Следующая статья',
    also: 'Читайте также',
    notFound: 'Статья не найдена',
    toBlog: 'Вернуться в блог',
    toc: 'Содержание',
  },
  en: {
    kick: (n) => `Blog · ${n} ${n === 1 ? 'article' : 'articles'}`,
    h1a: 'The Lumiva CRM blog',
    h1b: 'on business growth.',
    sub: 'Practical articles on CRM, sales, analytics and automation.',
    featured: 'New',
    read: 'Read',
    min: 'min read',
    all: 'All',
    emptyCat: 'No other articles in this category yet.',
    cats: 'Categories',
    popular: 'Popular articles',
    tgT: 'Lumiva news on Telegram',
    tgD: 'New articles and CRM updates in our channel.',
    tgBtn: 'Open Telegram',
    tryT: 'Try Lumiva CRM',
    tryD: '14 days with every module, no card required.',
    tryBtn: 'Start for free',
    loading: 'Loading articles…',
    error: 'Couldn’t load the articles.',
    retry: 'Retry',
    none: 'No articles yet — they’re coming soon.',
    back: 'All articles',
    share: 'Share',
    copy: 'Copy link',
    copied: 'Copied',
    progress: 'Read',
    left: (m) => `≈ ${m} min left`,
    next: 'Next article',
    also: 'Read also',
    notFound: 'Article not found',
    toBlog: 'Back to the blog',
    toc: 'Contents',
  },
  tr: {
    kick: (n) => `Blog · ${n} yazı`,
    h1a: 'Lumiva CRM blogu',
    h1b: 'işletme büyümesi üzerine.',
    sub: 'CRM, satış, analitik ve otomasyon üzerine pratik yazılar.',
    featured: 'Yeni',
    read: 'Oku',
    min: 'dk okuma',
    all: 'Tümü',
    emptyCat: 'Bu kategoride henüz başka yazı yok.',
    cats: 'Kategoriler',
    popular: 'Popüler yazılar',
    tgT: 'Telegram’da Lumiva haberleri',
    tgD: 'Yeni yazılar ve CRM güncellemeleri kanalımızda.',
    tgBtn: 'Telegram’ı aç',
    tryT: 'Lumiva CRM’i deneyin',
    tryD: 'Tüm modüllerle 14 gün, kart gerekmez.',
    tryBtn: 'Ücretsiz başla',
    loading: 'Yazılar yükleniyor…',
    error: 'Yazılar yüklenemedi.',
    retry: 'Tekrar dene',
    none: 'Henüz yazı yok — yakında burada olacak.',
    back: 'Tüm yazılar',
    share: 'Paylaş',
    copy: 'Bağlantıyı kopyala',
    copied: 'Kopyalandı',
    progress: 'Okundu',
    left: (m) => `≈ ${m} dk kaldı`,
    next: 'Sonraki yazı',
    also: 'Ayrıca okuyun',
    notFound: 'Yazı bulunamadı',
    toBlog: 'Bloga dön',
    toc: 'İçindekiler',
  },
};

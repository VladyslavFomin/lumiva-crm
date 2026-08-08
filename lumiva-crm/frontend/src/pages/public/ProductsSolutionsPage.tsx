import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

type Lang = 'ru' | 'en' | 'tr';

const FEATURE_ICONS = ['grid', 'settings', 'layers', 'grid2', 'clock', 'link'] as const;
type FeatureIcon = (typeof FEATURE_ICONS)[number];

const FeatureIconGlyph: React.FC<{ name: FeatureIcon }> = ({ name }) => {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'grid':
    case 'grid2':
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></svg>;
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 01-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 010-4h.09a1.7 1.7 0 001.55-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001-1.55V3a2 2 0 014 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.55 1H21a2 2 0 010 4h-.09a1.7 1.7 0 00-1.55 1z" /></svg>;
    case 'layers':
      return <svg {...common}><path d="M12 3l8 4-8 4-8-4 8-4z" /><path d="M4 12l8 4 8-4" /><path d="M4 16l8 4 8-4" /></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case 'link':
      return <svg {...common}><path d="M9 15l6-6" /><path d="M8 17l-2.5 2.5a3.5 3.5 0 01-5-5L3 12" /><path d="M16 7l2.5-2.5a3.5 3.5 0 015 5L21 12" /></svg>;
  }
};

const ArrowRight: React.FC = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
);

function seedRand(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
}
const QrMini: React.FC<{ value: string }> = ({ value }) => {
  const cells = useMemo(() => { const rand = seedRand(value); return Array.from({ length: 121 }, () => rand() > 0.55); }, [value]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gridTemplateRows: 'repeat(11, 1fr)', width: 64, height: 64, flexShrink: 0 }}>
      {cells.map((on, i) => <span key={i} style={{ background: on ? '#222' : 'transparent' }} />)}
    </div>
  );
};
const BarcodeMini: React.FC<{ value: string }> = ({ value }) => {
  const bars = useMemo(() => { const rand = seedRand(value); return Array.from({ length: 38 }, () => Math.round(rand() * 2) + 1); }, [value]);
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: 36, flex: 1 }}>
      {bars.map((w, i) => <span key={i} style={{ display: 'block', width: w, marginRight: i % 3 === 0 ? 2 : 1, background: i % 5 === 4 ? 'transparent' : '#222' }} />)}
    </div>
  );
};

const FIELD_TYPE_STYLE: Record<string, { fg: string; border: string; bg: string }> = {
  text: { fg: '#214b8a', border: '#cfdef5', bg: '#f0f6fc' },
  number: { fg: '#175c3d', border: '#c5e3d2', bg: '#eaf4ee' },
  select: { fg: '#7a4a09', border: '#f0d9a8', bg: '#fbf2dc' },
  date: { fg: '#5a3a86', border: '#dcd0f0', bg: '#f3eefc' },
  checkbox: { fg: '#9a1f31', border: '#f0c8cf', bg: '#fbecef' },
  media: { fg: '#3a3a3a', border: '#e7e7e7', bg: '#f7f7f6' },
};

const T = {
  ru: {
    kicker: 'РЕШЕНИЕ · УЧЁТ ТОВАРОВ',
    title1: 'Каталог, который растёт',
    title2: 'вместе с ассортиментом.',
    sub: 'Категории с вложенностью, гибкие атрибуты под любую отрасль, штрихкоды и QR из коробки. От первой сотни SKU до каталога на 50 000 позиций — структура не разваливается.',
    ctaPrimary: 'Попробовать бесплатно',
    ctaSecondary: 'Смотреть демо',
    heroLabel: 'ТОВАР · TS-BLK-001',
    heroTitle: 'Футболка базовая, чёрная',
    heroTag: 'Активен',
    heroRows: [
      { nm: 'Материал', meta: 'Смесовая ткань, 180 г/м²' },
      { nm: 'Цвет / Размер', meta: 'Чёрный · S, M, L', badge: '5 вариантов' },
      { nm: 'Категория', meta: 'Одежда → Мужская' },
    ],
    s1Kicker: '01 · ЗАДАЧА',
    s1Title: 'Каталог в Excel живёт до первой сотни товаров.',
    s1Summary: 'Дальше — дубли артикулов, атрибуты в комментариях, штрихкоды рисуют вручную в графредакторе. Новый сотрудник неделю разбирается, что где лежит и как называется.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Категории с вложенностью', d: 'Дерево категорий любой глубины: «Одежда → Мужская → Верхняя одежда». Цветовые метки для быстрой навигации.' },
      { n: '02', ic: 'settings' as FeatureIcon, t: 'Гибкие атрибуты', d: 'Конструктор полей: текст, число, список, дата, чекбокс, медиа. Материал, размерная сетка, штрихкод — под вашу отрасль.' },
      { n: '03', ic: 'layers' as FeatureIcon, t: 'Варианты товара', d: 'Размер × цвет × комплектация — с собственным SKU, ценой и остатком у каждого варианта.' },
      { n: '04', ic: 'grid2' as FeatureIcon, t: 'Штрихкоды и QR', d: 'Генерация EAN-13 и QR для каждого товара и варианта. Печать этикеток пачкой прямо из карточки.' },
      { n: '05', ic: 'clock' as FeatureIcon, t: 'История изменений', d: 'Кто и когда менял цену, атрибуты или остаток — полный аудит по каждому товару.' },
      { n: '06', ic: 'link' as FeatureIcon, t: 'Импорт и синхронизация', d: 'Массовый импорт из Excel/1С, синхронизация с сайтом и маркетплейсами без ручного дублирования.' },
    ],
    analyticsKicker: 'Аналитика товаров',
    analyticsQuote: 'Каждое поле, которое вы завели в конструкторе — материал, цвет, поставщик, сезон — автоматически становится срезом в аналитике: продажи по материалу, оборачиваемость по цвету, маржа по поставщику. Не нужно отдельно настраивать отчёты.',
    analyticsBadge: 'ДОСТУПНО В ТАРИФАХ PRO И BUSINESS',
    analyticsTitle: 'Аналитика по атрибутам',
    analyticsSub: 'Без выгрузок и сводных таблиц вручную',
    s2Kicker: '02 · КОНСТРУКТОР ПОЛЕЙ',
    s2Title: 'Поля, которые нужны именно вашей отрасли.',
    s2Summary: 'Три группы атрибутов на карточке товара — по умолчанию, без единой строчки кода. Каждое поле можно сделать обязательным, привязать к фильтрам каталога и вывести в превью карточки в реальном времени.',
    fieldGroups: [
      {
        title: 'Основные атрибуты', count: '5 полей', fields: [
          { type: 'select', name: 'Материал', key: 'material', opts: 'Хлопок, Полиэстер, Шерсть, Кожа, Смесовая ткань', req: true },
          { type: 'select', name: 'Цвет', key: 'color', opts: 'Чёрный, Белый, Серый, Синий, Красный', req: true },
          { type: 'select', name: 'Размерная сетка', key: 'size_grid', opts: 'RU, EU, US, UK' },
          { type: 'number', name: 'Вес, г', key: 'weight_g' },
          { type: 'text', name: 'Страна производства', key: 'made_in' },
        ],
      },
      {
        title: 'Логистика и склад', count: '4 поля', fields: [
          { type: 'text', name: 'Штрихкод (EAN/UPC)', key: 'barcode' },
          { type: 'number', name: 'Мин. остаток для алерта', key: 'min_stock', req: true },
          { type: 'number', name: 'Срок поставки, дни', key: 'lead_time_days' },
          { type: 'date', name: 'Дата поступления', key: 'received_at' },
        ],
      },
      {
        title: 'Витрина и маркетинг', count: '3 поля', fields: [
          { type: 'checkbox', name: 'Новинка', key: 'is_new' },
          { type: 'checkbox', name: 'Хит продаж', key: 'is_bestseller' },
          { type: 'media', name: 'Галерея', key: 'gallery' },
        ],
      },
    ],
    typeLabel: { text: 'ТЕКСТ', number: 'ЧИСЛО', select: 'СПИСОК', date: 'ДАТА', checkbox: 'ЧЕКБОКС', media: 'МЕДИА' },
    requiredLabel: 'обязательное',
    s3Kicker: '03 · ДЕРЕВО КАТЕГОРИЙ',
    s3Title: 'Структура каталога любой глубины.',
    s3Summary: 'Категории вкладываются друг в друга без ограничений, у каждой — цветовая метка, slug и счётчик товаров. 235 SKU распределены по 5 веткам ниже.',
    categories: [
      { n: 'Одежда', slug: '/clothing', cnt: '86 товаров', color: '#3b6cb6' },
      { n: 'Мужская', slug: '/clothing/clothing-men', cnt: '34', color: '#3b6cb6', sub: true },
      { n: 'Женская', slug: '/clothing/clothing-women', cnt: '41', color: '#3b6cb6', sub: true },
      { n: 'Детская', slug: '/clothing/clothing-kids', cnt: '11', color: '#3b6cb6', sub: true },
      { n: 'Аксессуары', slug: '/accessories', cnt: '52 товара', color: '#c08319' },
      { n: 'Обувь', slug: '/shoes', cnt: '38 товаров', color: '#1f8a5e' },
      { n: 'Товары для дома', slug: '/home', cnt: '24 товара', color: '#5a45a8' },
      { n: 'Без категории', slug: '/uncategorized', cnt: '14 товаров', color: '#888' },
    ],
    s4Kicker: '04 · КАК ЭТО РАБОТАЕТ',
    s4Title: 'От категории до этикетки на полке.',
    steps: [
      { t: 'Структура каталога', d: 'Создаёте дерево категорий и группы атрибутов один раз — дальше все новые товары наследуют схему.' },
      { t: 'Заполнение карточки', d: 'Название, цена, фото, атрибуты и варианты — в едином редакторе с превью карточки в реальном времени.' },
      { t: 'Штрихкоды и QR', d: 'Система генерирует уникальный код для товара и каждого варианта. Печатаете этикетки пачкой на любой принтер.' },
      { t: 'Синхронизация', d: 'Остатки и цены синхронизируются со складом, сайтом и маркетплейсами — изменения применяются везде одновременно.' },
    ],
    metrics: [
      { v: '50 000+', l: 'SKU в одном каталоге без потери скорости' },
      { v: '12', l: 'типов полей для любых атрибутов' },
      { v: '3 сек', l: 'на генерацию и печать этикетки со штрихкодом' },
      { v: '0', l: 'дублей артикулов благодаря авто-проверке' },
    ],
    quote: '«Мы вели каталог из 4 000 товаров в трёх Excel-файлах, которые расходились раз в неделю. Перенесли всё в Lumiva за два дня — теперь категории, атрибуты и штрихкоды живут в одном месте, а новый сотрудник склада разбирается за час.»',
    quoteName: 'Дмитрий Воронов',
    quoteRole: 'Операционный директор · Parallax Retail',
    ctaKicker: 'Готовы навести порядок в каталоге?',
    ctaTitle: '14 дней бесплатно. Импорт каталога из Excel и 1С — бесплатно.',
    ctaBtn1: 'Создать аккаунт',
    ctaBtn2: 'Связаться с командой',
  },
  en: {
    kicker: 'SOLUTION · PRODUCT CATALOG',
    title1: 'A catalog that grows',
    title2: 'together with your assortment.',
    sub: 'Nested categories, flexible attributes for any industry, barcodes and QR codes out of the box. From the first hundred SKUs to a 50,000-item catalog — the structure never falls apart.',
    ctaPrimary: 'Try for free',
    ctaSecondary: 'Watch demo',
    heroLabel: 'PRODUCT · TS-BLK-001',
    heroTitle: 'Basic tee, black',
    heroTag: 'Active',
    heroRows: [
      { nm: 'Material', meta: 'Blended fabric, 180 g/m²' },
      { nm: 'Color / Size', meta: 'Black · S, M, L', badge: '5 variants' },
      { nm: 'Category', meta: 'Apparel → Men' },
    ],
    s1Kicker: '01 · THE PROBLEM',
    s1Title: 'An Excel catalog survives until the first hundred products.',
    s1Summary: 'After that — duplicate SKUs, attributes buried in comments, barcodes hand-drawn in an image editor. A new hire spends a week figuring out what\'s where and what it\'s called.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'Nested categories', d: 'A category tree of any depth: "Apparel → Men → Outerwear". Color tags for fast navigation.' },
      { n: '02', ic: 'settings' as FeatureIcon, t: 'Flexible attributes', d: 'A field builder: text, number, select, date, checkbox, media. Material, size chart, barcode — tailored to your industry.' },
      { n: '03', ic: 'layers' as FeatureIcon, t: 'Product variants', d: 'Size × color × bundle — each with its own SKU, price and stock level.' },
      { n: '04', ic: 'grid2' as FeatureIcon, t: 'Barcodes and QR codes', d: 'EAN-13 and QR generation for every product and variant. Batch-print labels straight from the card.' },
      { n: '05', ic: 'clock' as FeatureIcon, t: 'Change history', d: 'Who changed a price, attribute or stock level, and when — a full audit trail for every product.' },
      { n: '06', ic: 'link' as FeatureIcon, t: 'Import and sync', d: 'Bulk import from Excel/accounting systems, sync with your storefront and marketplaces with zero manual duplication.' },
    ],
    analyticsKicker: 'Product analytics',
    analyticsQuote: 'Every field you add in the builder — material, color, supplier, season — automatically becomes a slice in analytics: sales by material, turnover by color, margin by supplier. No separate report setup needed.',
    analyticsBadge: 'AVAILABLE ON PRO AND BUSINESS PLANS',
    analyticsTitle: 'Attribute-level analytics',
    analyticsSub: 'No manual exports or pivot tables',
    s2Kicker: '02 · FIELD BUILDER',
    s2Title: 'Fields tailored to your exact industry.',
    s2Summary: 'Three attribute groups on the product card by default, with zero code. Any field can be made required, tied to catalog filters and shown in a live card preview.',
    fieldGroups: [
      {
        title: 'Core attributes', count: '5 fields', fields: [
          { type: 'select', name: 'Material', key: 'material', opts: 'Cotton, Polyester, Wool, Leather, Blended', req: true },
          { type: 'select', name: 'Color', key: 'color', opts: 'Black, White, Grey, Blue, Red', req: true },
          { type: 'select', name: 'Size chart', key: 'size_grid', opts: 'RU, EU, US, UK' },
          { type: 'number', name: 'Weight, g', key: 'weight_g' },
          { type: 'text', name: 'Country of origin', key: 'made_in' },
        ],
      },
      {
        title: 'Logistics and warehouse', count: '4 fields', fields: [
          { type: 'text', name: 'Barcode (EAN/UPC)', key: 'barcode' },
          { type: 'number', name: 'Minimum stock for alert', key: 'min_stock', req: true },
          { type: 'number', name: 'Lead time, days', key: 'lead_time_days' },
          { type: 'date', name: 'Date received', key: 'received_at' },
        ],
      },
      {
        title: 'Storefront and marketing', count: '3 fields', fields: [
          { type: 'checkbox', name: 'New arrival', key: 'is_new' },
          { type: 'checkbox', name: 'Bestseller', key: 'is_bestseller' },
          { type: 'media', name: 'Gallery', key: 'gallery' },
        ],
      },
    ],
    typeLabel: { text: 'TEXT', number: 'NUMBER', select: 'SELECT', date: 'DATE', checkbox: 'CHECKBOX', media: 'MEDIA' },
    requiredLabel: 'required',
    s3Kicker: '03 · CATEGORY TREE',
    s3Title: 'A catalog structure of any depth.',
    s3Summary: 'Categories nest inside each other with no limit; each has a color tag, a slug and a product count. 235 SKUs are spread across the 5 branches below.',
    categories: [
      { n: 'Apparel', slug: '/clothing', cnt: '86 items', color: '#3b6cb6' },
      { n: 'Men', slug: '/clothing/clothing-men', cnt: '34', color: '#3b6cb6', sub: true },
      { n: 'Women', slug: '/clothing/clothing-women', cnt: '41', color: '#3b6cb6', sub: true },
      { n: 'Kids', slug: '/clothing/clothing-kids', cnt: '11', color: '#3b6cb6', sub: true },
      { n: 'Accessories', slug: '/accessories', cnt: '52 items', color: '#c08319' },
      { n: 'Footwear', slug: '/shoes', cnt: '38 items', color: '#1f8a5e' },
      { n: 'Home goods', slug: '/home', cnt: '24 items', color: '#5a45a8' },
      { n: 'Uncategorized', slug: '/uncategorized', cnt: '14 items', color: '#888' },
    ],
    s4Kicker: '04 · HOW IT WORKS',
    s4Title: 'From category to shelf label.',
    steps: [
      { t: 'Catalog structure', d: 'You build the category tree and attribute groups once — every new product inherits the schema after that.' },
      { t: 'Filling in the card', d: 'Name, price, photos, attributes and variants — in one editor with a live card preview.' },
      { t: 'Barcodes and QR codes', d: 'The system generates a unique code for the product and every variant. Batch-print labels on any printer.' },
      { t: 'Synchronization', d: 'Stock and prices sync across the warehouse, storefront and marketplaces — changes apply everywhere at once.' },
    ],
    metrics: [
      { v: '50,000+', l: 'SKUs in one catalog with no speed loss' },
      { v: '12', l: 'field types for any attribute' },
      { v: '3 sec', l: 'to generate and print a barcode label' },
      { v: '0', l: 'duplicate SKUs thanks to auto-checking' },
    ],
    quote: '"We ran a 4,000-item catalog across three Excel files that drifted apart every week. We moved everything into Lumiva in two days — now categories, attributes and barcodes live in one place, and a new warehouse hire is up to speed within an hour."',
    quoteName: 'Dmitry Voronov',
    quoteRole: 'COO · Parallax Retail',
    ctaKicker: 'Ready to get your catalog in order?',
    ctaTitle: '14 days free. We import your catalog from Excel or your accounting system at no cost.',
    ctaBtn1: 'Create account',
    ctaBtn2: 'Talk to the team',
  },
  tr: {
    kicker: 'ÇÖZÜM · ÜRÜN KATALOĞU',
    title1: 'Ürün yelpazenizle birlikte',
    title2: 'büyüyen bir katalog.',
    sub: 'İç içe kategoriler, her sektöre uygun esnek öznitelikler, kutudan çıkar çıkmaz barkod ve QR. İlk yüz SKU\'dan 50.000 kalemlik bir kataloğa kadar — yapı asla dağılmaz.',
    ctaPrimary: 'Ücretsiz deneyin',
    ctaSecondary: 'Demo izleyin',
    heroLabel: 'ÜRÜN · TS-BLK-001',
    heroTitle: 'Basic tişört, siyah',
    heroTag: 'Aktif',
    heroRows: [
      { nm: 'Malzeme', meta: 'Karışım kumaş, 180 g/m²' },
      { nm: 'Renk / Beden', meta: 'Siyah · S, M, L', badge: '5 varyant' },
      { nm: 'Kategori', meta: 'Giyim → Erkek' },
    ],
    s1Kicker: '01 · SORUN',
    s1Title: 'Excel kataloğu ilk yüz üründe tıkanır.',
    s1Summary: 'Sonrasında — tekrarlanan SKU\'lar, yorumlara gömülü öznitelikler, bir görsel editöründe elle çizilen barkodlar. Yeni bir çalışan neyin nerede olduğunu anlamak için bir hafta harcar.',
    features: [
      { n: '01', ic: 'grid' as FeatureIcon, t: 'İç içe kategoriler', d: 'Her derinlikte kategori ağacı: "Giyim → Erkek → Dış giyim". Hızlı gezinme için renk etiketleri.' },
      { n: '02', ic: 'settings' as FeatureIcon, t: 'Esnek öznitelikler', d: 'Alan oluşturucu: metin, sayı, liste, tarih, onay kutusu, medya. Malzeme, beden tablosu, barkod — sektörünüze göre.' },
      { n: '03', ic: 'layers' as FeatureIcon, t: 'Ürün varyantları', d: 'Beden × renk × paket — her birinin kendi SKU\'su, fiyatı ve stoğuyla.' },
      { n: '04', ic: 'grid2' as FeatureIcon, t: 'Barkod ve QR', d: 'Her ürün ve varyant için EAN-13 ve QR üretimi. Etiketleri karttan toplu yazdırın.' },
      { n: '05', ic: 'clock' as FeatureIcon, t: 'Değişiklik geçmişi', d: 'Fiyatı, özniteliği veya stoğu kim ve ne zaman değiştirdi — her ürün için tam denetim izi.' },
      { n: '06', ic: 'link' as FeatureIcon, t: 'İçe aktarma ve senkronizasyon', d: 'Excel/muhasebe sisteminden toplu içe aktarma, siteyle ve pazaryerleriyle manuel tekrar olmadan senkronizasyon.' },
    ],
    analyticsKicker: 'Ürün analitiği',
    analyticsQuote: 'Oluşturucuda eklediğiniz her alan — malzeme, renk, tedarikçi, sezon — otomatik olarak analitikte bir kırılım haline gelir: malzemeye göre satış, renge göre devir hızı, tedarikçiye göre marj. Ayrı rapor kurulumuna gerek yok.',
    analyticsBadge: 'PRO VE BUSINESS PLANLARINDA MEVCUT',
    analyticsTitle: 'Öznitelik bazlı analitik',
    analyticsSub: 'Manuel dışa aktarma veya pivot tablo yok',
    s2Kicker: '02 · ALAN OLUŞTURUCU',
    s2Title: 'Tam olarak sektörünüze uygun alanlar.',
    s2Summary: 'Ürün kartında varsayılan olarak üç öznitelik grubu, tek satır kod yazmadan. Her alan zorunlu yapılabilir, katalog filtrelerine bağlanabilir ve canlı kart önizlemesinde gösterilebilir.',
    fieldGroups: [
      {
        title: 'Temel öznitelikler', count: '5 alan', fields: [
          { type: 'select', name: 'Malzeme', key: 'material', opts: 'Pamuk, Polyester, Yün, Deri, Karışım', req: true },
          { type: 'select', name: 'Renk', key: 'color', opts: 'Siyah, Beyaz, Gri, Mavi, Kırmızı', req: true },
          { type: 'select', name: 'Beden tablosu', key: 'size_grid', opts: 'RU, EU, US, UK' },
          { type: 'number', name: 'Ağırlık, g', key: 'weight_g' },
          { type: 'text', name: 'Üretim ülkesi', key: 'made_in' },
        ],
      },
      {
        title: 'Lojistik ve depo', count: '4 alan', fields: [
          { type: 'text', name: 'Barkod (EAN/UPC)', key: 'barcode' },
          { type: 'number', name: 'Uyarı için min. stok', key: 'min_stock', req: true },
          { type: 'number', name: 'Tedarik süresi, gün', key: 'lead_time_days' },
          { type: 'date', name: 'Alım tarihi', key: 'received_at' },
        ],
      },
      {
        title: 'Vitrin ve pazarlama', count: '3 alan', fields: [
          { type: 'checkbox', name: 'Yeni ürün', key: 'is_new' },
          { type: 'checkbox', name: 'Çok satan', key: 'is_bestseller' },
          { type: 'media', name: 'Galeri', key: 'gallery' },
        ],
      },
    ],
    typeLabel: { text: 'METİN', number: 'SAYI', select: 'LİSTE', date: 'TARİH', checkbox: 'ONAY KUTUSU', media: 'MEDYA' },
    requiredLabel: 'zorunlu',
    s3Kicker: '03 · KATEGORİ AĞACI',
    s3Title: 'Her derinlikte katalog yapısı.',
    s3Summary: 'Kategoriler sınırsız şekilde iç içe geçer; her birinin bir renk etiketi, slug\'ı ve ürün sayacı vardır. Aşağıdaki 5 dalda 235 SKU dağıtılmıştır.',
    categories: [
      { n: 'Giyim', slug: '/clothing', cnt: '86 ürün', color: '#3b6cb6' },
      { n: 'Erkek', slug: '/clothing/clothing-men', cnt: '34', color: '#3b6cb6', sub: true },
      { n: 'Kadın', slug: '/clothing/clothing-women', cnt: '41', color: '#3b6cb6', sub: true },
      { n: 'Çocuk', slug: '/clothing/clothing-kids', cnt: '11', color: '#3b6cb6', sub: true },
      { n: 'Aksesuar', slug: '/accessories', cnt: '52 ürün', color: '#c08319' },
      { n: 'Ayakkabı', slug: '/shoes', cnt: '38 ürün', color: '#1f8a5e' },
      { n: 'Ev ürünleri', slug: '/home', cnt: '24 ürün', color: '#5a45a8' },
      { n: 'Kategorisiz', slug: '/uncategorized', cnt: '14 ürün', color: '#888' },
    ],
    s4Kicker: '04 · NASIL ÇALIŞIR',
    s4Title: 'Kategoriden raf etiketine.',
    steps: [
      { t: 'Katalog yapısı', d: 'Kategori ağacını ve öznitelik gruplarını bir kez oluşturursunuz — her yeni ürün şemayı devralır.' },
      { t: 'Kart doldurma', d: 'Ad, fiyat, fotoğraflar, öznitelikler ve varyantlar — canlı kart önizlemeli tek bir editörde.' },
      { t: 'Barkod ve QR', d: 'Sistem ürün ve her varyant için benzersiz bir kod üretir. Etiketleri herhangi bir yazıcıda toplu basın.' },
      { t: 'Senkronizasyon', d: 'Stok ve fiyatlar depo, site ve pazaryerleriyle senkronize olur — değişiklikler her yerde aynı anda uygulanır.' },
    ],
    metrics: [
      { v: '50.000+', l: 'hız kaybı olmadan tek katalogda SKU' },
      { v: '12', l: 'her öznitelik için alan türü' },
      { v: '3 sn', l: 'barkod etiketi üretme ve yazdırma süresi' },
      { v: '0', l: 'otomatik kontrol sayesinde tekrarlanan SKU' },
    ],
    quote: '"4.000 ürünlük kataloğumuzu her hafta birbirinden sapan üç Excel dosyasında tutuyorduk. Her şeyi iki günde Lumiva\'ya taşıdık — artık kategoriler, öznitelikler ve barkodlar tek bir yerde, yeni bir depo çalışanı bir saatte işi kavrıyor."',
    quoteName: 'Dmitry Voronov',
    quoteRole: 'Operasyon Direktörü · Parallax Retail',
    ctaKicker: 'Kataloğunuzu düzene sokmaya hazır mısınız?',
    ctaTitle: '14 gün ücretsiz. Excel veya muhasebe sisteminizden katalog aktarımı bizden.',
    ctaBtn1: 'Hesap oluştur',
    ctaBtn2: 'Ekiple iletişime geçin',
  },
};

const INK = '#222';
const FG2 = '#555';
const FG3 = '#888';
const FG4 = '#aaa';
const LINE = '#e7e7e7';
const LINE2 = 'rgba(34,34,34,0.1)';
const LINE3 = '#f0f0f0';
const BG_MUTED = '#f7f7f6';
const BG_SOFT = '#fafafa';
const FF = "'Inter Tight', sans-serif";
const FM = "'JetBrains Mono', monospace";

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FM, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: INK, display: 'inline-block' }} />
    {children}
  </div>
);

export default function ProductsSolutionsPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];

  return (
    <div style={{ background: '#fff', color: INK, fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <PublicHeader activeKey="products" />

      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1280 }}>

        {/* ── Hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2"
          style={{ paddingTop: 72, paddingBottom: 40, gap: 48, alignItems: 'center' }}
        >
          <div>
            <Kicker>{tx.kicker}</Kicker>
            <h1 style={{ fontFamily: FF, fontSize: 'clamp(38px, 4.6vw, 62px)', lineHeight: 1.03, letterSpacing: '-0.04em', fontWeight: 500, marginTop: 24, maxWidth: 620, color: INK }}>
              {tx.title1}<br />
              <em style={{ color: FG3, fontStyle: 'normal', fontWeight: 400 }}>{tx.title2}</em>
            </h1>
            <p style={{ fontSize: 17, color: FG2, maxWidth: 520, marginTop: 20, lineHeight: 1.6 }}>{tx.sub}</p>
            <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 28 }}>
              <Link to="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: INK, color: '#fff', border: `1px solid ${INK}`, textDecoration: 'none' }}>
                {tx.ctaPrimary}<ArrowRight />
              </Link>
              <Link to="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: '#fff', color: INK, border: `1px solid ${LINE}`, textDecoration: 'none' }}>
                {tx.ctaSecondary}
              </Link>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 18, boxShadow: '0 20px 50px rgba(15,23,42,0.08)' }}>
              <div className="flex items-start justify-between" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: FM, fontSize: 10, color: FG3 }}>{tx.heroLabel}</div>
                  <div style={{ fontFamily: FF, fontSize: 15, fontWeight: 600, marginTop: 4 }}>{tx.heroTitle}</div>
                </div>
                <span style={{ fontFamily: FM, fontSize: 10, padding: '3px 9px', border: `1px solid ${LINE}`, borderRadius: 999, color: FG2 }}>{tx.heroTag}</span>
              </div>
              {tx.heroRows.map((r, i) => (
                <div key={r.nm} className="flex items-center gap-2.5" style={{ padding: '9px 0', borderBottom: i < tx.heroRows.length - 1 ? `1px solid ${BG_MUTED}` : 'none', fontSize: 12.5 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: BG_SOFT, border: `1px solid ${LINE}`, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: INK, fontWeight: 500 }}>{r.nm}</div>
                    <div style={{ color: FG3, fontSize: 11, marginTop: 2 }}>{r.meta}</div>
                  </div>
                  {r.badge && <span style={{ marginLeft: 'auto', fontFamily: FM, fontSize: 10, padding: '2px 8px', borderRadius: 6, background: BG_SOFT, color: FG2 }}>{r.badge}</span>}
                </div>
              ))}
              <div className="flex items-center" style={{ gap: 14, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BG_MUTED}` }}>
                <QrMini value="TS-BLK-001" />
                <BarcodeMini value="TS-BLK-001" />
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* ── 01 Problem / feature grid ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <Kicker>{tx.s1Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s1Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s1Summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ marginTop: 36, border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
            {tx.features.map((f, i) => (
              <motion.div key={f.n} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.35 }}
                style={{ padding: 24, borderRight: (i % 3 !== 2) ? `1px solid ${LINE}` : 'none', borderBottom: i < 3 ? `1px solid ${LINE}` : 'none' }}>
                <div style={{ fontFamily: FM, fontSize: 11, color: FG3, letterSpacing: '0.08em' }}>{f.n}</div>
                <div style={{ color: FG2, marginTop: 12 }}><FeatureIconGlyph name={f.ic} /></div>
                <div style={{ fontFamily: FF, fontSize: 15.5, fontWeight: 500, marginTop: 12, color: INK }}>{f.t}</div>
                <div style={{ fontSize: 12.5, color: FG2, marginTop: 8, lineHeight: 1.55 }}>{f.d}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Analytics teaser ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-[1fr_260px]" style={{ gap: 40, borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <div>
            <div style={{ marginBottom: 24 }}><Kicker>{tx.analyticsKicker}</Kicker></div>
            <p style={{ fontFamily: FF, fontSize: 'clamp(18px, 2vw, 24px)', fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.5, color: INK }}>{tx.analyticsQuote}</p>
          </div>
          <div>
            <div style={{ fontFamily: FM, fontSize: 10, color: FG3, letterSpacing: '0.06em' }}>{tx.analyticsBadge}</div>
            <div style={{ color: INK, fontWeight: 500, fontSize: 14, marginTop: 6 }}>{tx.analyticsTitle}</div>
            <div style={{ fontSize: 12.5, color: FG2, marginTop: 4 }}>{tx.analyticsSub}</div>
          </div>
        </motion.section>

        {/* ── 02 Field builder ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <Kicker>{tx.s2Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s2Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s2Summary}</p>

          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tx.fieldGroups.map((group) => (
              <div key={group.title} style={{ border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
                <div className="flex items-center justify-between" style={{ padding: '13px 18px', background: BG_MUTED, borderBottom: `1px solid ${LINE}`, fontFamily: FF, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  <span>{group.title}</span>
                  <span style={{ fontFamily: FM, fontSize: 10.5, color: FG3, fontWeight: 400 }}>{group.count}</span>
                </div>
                {group.fields.map((field, i) => {
                  const style = FIELD_TYPE_STYLE[field.type];
                  return (
                    <div key={field.key} className="flex items-center gap-2.5" style={{ padding: '11px 18px', borderBottom: i < group.fields.length - 1 ? `1px solid ${BG_MUTED}` : 'none', fontSize: 12.5, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: FM, fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 5, border: `1px solid ${style.border}`, color: style.fg, background: style.bg, flexShrink: 0, width: 78, textAlign: 'center' }}>
                        {tx.typeLabel[field.type as keyof typeof tx.typeLabel]}
                      </span>
                      <span style={{ fontWeight: 500, color: INK }}>{field.name}</span>
                      <span style={{ fontFamily: FM, fontSize: 10.5, color: FG3 }}>{field.key}</span>
                      {'opts' in field && field.opts && <span style={{ color: FG3, fontSize: 11 }}>{field.opts}</span>}
                      {field.req && (
                        <span style={{ marginLeft: 'auto', fontFamily: FM, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#7a4a09', background: '#fbf2dc', border: '1px solid #f0d9a8', padding: '2px 6px', borderRadius: 5 }}>
                          {tx.requiredLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── 03 Category tree ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <Kicker>{tx.s3Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s3Title}</h2>
          <p style={{ fontSize: 14.5, color: FG2, marginTop: 12, maxWidth: 640, lineHeight: 1.6 }}>{tx.s3Summary}</p>

          <div style={{ marginTop: 32, border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
            {tx.categories.map((cat, i) => (
              <div key={cat.slug} className="flex items-center gap-2.5" style={{ padding: '11px 18px', paddingLeft: cat.sub ? 44 : 18, borderBottom: i < tx.categories.length - 1 ? `1px solid ${BG_MUTED}` : 'none', fontSize: 12.5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: cat.color, opacity: cat.sub ? 0.6 : 1, flexShrink: 0 }} />
                <span style={{ fontWeight: 500, color: INK }}>{cat.n}</span>
                <span style={{ fontFamily: FM, fontSize: 10.5, color: FG4, marginLeft: 8 }}>{cat.slug}</span>
                <span style={{ marginLeft: 'auto', fontFamily: FM, fontSize: 11, color: FG3 }}>{cat.cnt}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── 04 Workflow ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 56, paddingBottom: 56 }}>
          <Kicker>{tx.s4Kicker}</Kicker>
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 14, maxWidth: 640, color: INK }}>{tx.s4Title}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ marginTop: 32, border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
            {tx.steps.map((s, i) => (
              <motion.div key={s.t} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.35 }}
                style={{ padding: '28px 22px', borderRight: i < tx.steps.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                <div style={{ fontFamily: FM, fontSize: 11, color: FG3, letterSpacing: '0.1em' }}>{lang === 'ru' ? `ШАГ ${i + 1}` : lang === 'tr' ? `ADIM ${i + 1}` : `STEP ${i + 1}`}</div>
                <h4 style={{ fontFamily: FF, fontSize: 16, fontWeight: 500, marginTop: 14, letterSpacing: '-0.01em', color: INK }}>{s.t}</h4>
                <p style={{ fontSize: 12.5, color: FG2, marginTop: 8, lineHeight: 1.55 }}>{s.d}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Metrics ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, marginBottom: 64 }}>
          {tx.metrics.map((m, i) => (
            <div key={m.l} className={['py-8 px-5', i % 2 === 0 ? 'border-r' : '', i < 2 ? 'border-b md:border-b-0' : '', i === 1 ? 'md:border-r' : ''].filter(Boolean).join(' ')} style={{ borderColor: LINE }}>
              <div style={{ fontFamily: FF, fontSize: 'clamp(26px, 3.2vw, 38px)', fontWeight: 500, letterSpacing: '-0.03em', color: INK }}>{m.v}</div>
              <div style={{ fontSize: 12.5, color: FG2, marginTop: 8 }}>{m.l}</div>
            </div>
          ))}
        </motion.section>

        {/* ── Quote ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="grid grid-cols-1 lg:grid-cols-[1fr_260px]" style={{ gap: 40, paddingBottom: 64, borderBottom: `1px solid ${LINE}`, marginBottom: 64 }}>
          <div>
            <div style={{ marginBottom: 24 }}><Kicker>{lang === 'ru' ? 'Клиенты' : lang === 'tr' ? 'Müşteriler' : 'Customers'}</Kicker></div>
            <p style={{ fontFamily: FF, fontSize: 'clamp(20px, 2.4vw, 28px)', fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.4, color: INK }}>{tx.quote}</p>
          </div>
          <div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: BG_MUTED, border: `1px solid ${LINE}`, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF, fontWeight: 500 }}>
              {tx.quoteName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </div>
            <div style={{ color: INK, fontWeight: 500, fontSize: 14 }}>{tx.quoteName}</div>
            <div style={{ fontFamily: FM, fontSize: 11, color: FG3, marginTop: 4 }}>{tx.quoteRole}</div>
          </div>
        </motion.section>

        {/* ── CTA ── */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          style={{ marginBottom: 80, borderRadius: 12, border: `1px solid ${LINE}`, padding: '56px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(to right, ${LINE3} 1px, transparent 1px)`, backgroundSize: '48px 100%', opacity: 0.4, pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ marginBottom: 12 }}><Kicker>{tx.ctaKicker}</Kicker></div>
            <div style={{ fontFamily: FF, fontSize: 'clamp(22px, 2.8vw, 34px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.15, maxWidth: 480, color: INK }}>{tx.ctaTitle}</div>
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
            <Link to="/pricing" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: INK, color: '#fff', border: `1px solid ${INK}`, textDecoration: 'none' }}>
              {tx.ctaBtn1}<ArrowRight />
            </Link>
            <Link to="/contact" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', fontSize: 13.5, fontWeight: 500, borderRadius: 999, background: '#fff', color: INK, border: `1px solid ${LINE2}`, textDecoration: 'none' }}>
              {tx.ctaBtn2}
            </Link>
          </div>
        </motion.section>

      </div>

      <PublicFooter />
    </div>
  );
}

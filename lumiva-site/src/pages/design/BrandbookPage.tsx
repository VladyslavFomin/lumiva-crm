import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

type LangKey = 'en' | 'ru' | 'tr'

type BrandbookContent = {
  crumb: string
  heroTitlePre: string
  heroTitleEm: string
  heroSub: string
  actionPrimary: string
  actionSecondary: string
  stats: Array<{ num: string; lbl: string }>
  structureTag: string
  structureTitlePre: string
  structureTitleEm: string
  structureSub: string
  chapters: Array<{ n: string; title: string; items: string[] }>
  formatsTag: string
  formatsTitlePre: string
  formatsTitleEm: string
  formatsSub: string
  formats: Array<{ fmt: string; icon: string; title: string; desc: string }>
  processTag: string
  processTitlePre: string
  processTitleEm: string
  processSub: string
  process: Array<{ n: string; ha: string; he: string; d: string }>
  pricingTag: string
  pricingTitlePre: string
  pricingTitleEm: string
  pricingSub: string
  pricing: Array<{ badge: string; name: string; sub: string; price: string; features: string[]; cta: string; featured?: boolean }>
  ctaTitlePre: string
  ctaTitleEm: string
  ctaSub: string
  ctaSlotsLabel: string
  ctaSlotsValue: string
  ctaStartLabel: string
  ctaStartValue: string
  ctaNdaLabel: string
  ctaNdaValue: string
}

export default function BrandbookPage() {
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const langKey: LangKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const priceFrom = langKey === 'ru' ? 'от' : langKey === 'tr' ? 'baslangic' : 'from'
  const seoByLang: Record<LangKey, { title: string; description: string }> = {
    en: {
      title: 'Brandbook and visual brand guidelines',
      description: 'Brandbook in PDF, Figma and print formats. Complete visual system documentation for internal teams and external partners.',
    },
    ru: {
      title: 'Брендбук — документация визуальной системы бренда',
      description: 'Брендбук в форматах PDF, Figma и print. Полная документация визуальной системы для внутренней команды и подрядчиков.',
    },
    tr: {
      title: 'Brandbook ve gorsel marka rehberi',
      description: 'PDF, Figma ve baski formatlarinda brandbook. Ic ekipler ve dis partnerler icin tam gorsel sistem dokumantasyonu.',
    },
  }
  const contentByLang: Record<LangKey, BrandbookContent> = {
    en: {
      crumb: 'Brandbook',
      heroTitlePre: 'The constitution',
      heroTitleEm: 'of your brand.',
      heroSub: 'A brandbook is the core document of your identity. It answers every practical question for designers, partners and new team members.',
      actionPrimary: 'Request a Quote',
      actionSecondary: 'Formats',
      stats: [
        { num: '63', lbl: 'brandbooks delivered' },
        { num: '120+', lbl: 'average pages' },
        { num: '3', lbl: 'formats: PDF, Figma, print' },
        { num: '∞', lbl: 'revision rounds until approval' },
      ],
      structureTag: 'Structure',
      structureTitlePre: 'Six',
      structureTitleEm: 'sections',
      structureSub: 'Every project is unique, but these six blocks are the foundation of every brandbook we produce.',
      chapters: [
        { n: '01', title: 'About the Brand', items: ['Mission and values', 'History and context', 'Positioning', 'Target audience'] },
        { n: '02', title: 'Brand Voice', items: ['Tone of voice', 'Brand vocabulary', 'Copy examples', 'What to avoid'] },
        { n: '03', title: 'Visual System', items: ['Logo system', 'Clear space rules', 'Logo variations', 'Incorrect usage'] },
        { n: '04', title: 'Color & Typography', items: ['Primary palette', 'Secondary colors', 'Type pairing', 'Text hierarchy'] },
        { n: '05', title: 'Graphic Language', items: ['Patterns and textures', 'Iconography', 'Photo style', 'Illustration'] },
        { n: '06', title: 'Applications', items: ['Business documentation', 'Digital formats', 'Outdoor media', 'Merch and gifts'] },
      ],
      formatsTag: 'Formats',
      formatsTitlePre: 'Three formats -',
      formatsTitleEm: 'one brandbook.',
      formatsSub: 'Each format solves a specific task. We deliver all three within one project.',
      formats: [
        { fmt: 'PDF', icon: '📄', title: 'Masterbook PDF', desc: 'A complete 80-150+ page version for print, archive and partner presentations with interactive bookmarks.' },
        { fmt: 'FIGMA', icon: '🎨', title: 'Figma Library', desc: 'A design library with components, colors and typography that your team can plug in immediately.' },
        { fmt: 'PRINT', icon: '📚', title: 'Printed Edition', desc: 'Hardcover, premium paper, built for meeting rooms, partner kits and executive presentations.' },
      ],
      processTag: 'How we work',
      processTitlePre: 'A brandbook is the',
      processTitleEm: 'result',
      processSub: 'It appears at the end, but the real work happens before that. Strong strategy and identity come first.',
      process: [
        { n: '01', ha: 'Strategy & ', he: 'Research', d: 'Positioning, audience and competitors become the foundation of the whole document. 1-2 weeks.' },
        { n: '02', ha: 'Identity & ', he: 'Visual language', d: 'Logo system, color, typography and patterns. Every element gets practical usage rules. 3-5 weeks.' },
        { n: '03', ha: 'Layout & ', he: 'Examples', d: 'Every rule is shown with clear do/dont examples so the document is used, not stored away. 1-2 weeks.' },
        { n: '04', ha: 'Finalization & ', he: 'Handoff', d: 'PDF, Figma library and team onboarding session. Printed version available when needed.' },
      ],
      pricingTag: 'Pricing',
      pricingTitlePre: 'Transparent',
      pricingTitleEm: 'pricing.',
      pricingSub: 'Prices are in EUR. We lock scope and budget before the project starts.',
      pricing: [
        {
          badge: 'BASIC',
          name: 'Essential',
          sub: 'Digital brandbook',
          price: `${priceFrom} 2 500€`,
          features: ['60-80 pages', 'PDF + Figma kit', '4 sections', 'Ready brand assets as input', 'Timeline: 3-4 weeks'],
          cta: 'Discuss',
        },
        {
          badge: 'POPULAR',
          name: 'Full Brandbook',
          sub: 'Complete brand document',
          price: `${priceFrom} 6 000€`,
          features: ['100-160 pages', 'PDF + Figma + print', 'All 6 sections', 'Motion guidelines', 'Team onboarding', 'Timeline: 5-8 weeks'],
          cta: 'Request a Quote',
          featured: true,
        },
        {
          badge: 'FLAGSHIP',
          name: 'Brand System',
          sub: 'Identity + brandbook turnkey',
          price: `${priceFrom} 14 000€`,
          features: ['Brand strategy + identity', 'Full brandbook', 'Figma library', 'Templates and brand assets', 'Printed edition'],
          cta: 'Discuss',
        },
      ],
      ctaTitlePre: 'Need a brandbook for',
      ctaTitleEm: 'your brand?',
      ctaSub: 'Share your current materials and we will estimate scope and next steps in 45 minutes.',
      ctaSlotsLabel: 'Q3 slots',
      ctaSlotsValue: '3 of 12',
      ctaStartLabel: 'Start',
      ctaStartValue: 'July 2026',
      ctaNdaLabel: 'NDA',
      ctaNdaValue: 'on request',
    },
    ru: {
      crumb: 'Брендбук',
      heroTitlePre: 'Конституция',
      heroTitleEm: 'вашего бренда.',
      heroSub: 'Брендбук — главный документ бренда. Он отвечает на любой вопрос дизайнера, подрядчика или нового сотрудника: как выглядит, звучит и ощущается ваш бренд.',
      actionPrimary: 'Запросить смету',
      actionSecondary: 'Форматы',
      stats: [
        { num: '63', lbl: 'brandbook выпущено' },
        { num: '120+', lbl: 'страниц в среднем' },
        { num: '3', lbl: 'формата: PDF, Figma, print' },
        { num: '∞', lbl: 'итерации до утверждения' },
      ],
      structureTag: 'Структура',
      structureTitlePre: 'Шесть',
      structureTitleEm: 'разделов,',
      structureSub: 'Структура адаптируется под проект, но эти шесть блоков — основа каждого brandbook, который мы делаем.',
      chapters: [
        { n: '01', title: 'О бренде', items: ['Миссия и ценности', 'История и контекст', 'Позиционирование', 'Целевая аудитория'] },
        { n: '02', title: 'Голос бренда', items: ['Тон коммуникации', 'Словарь бренда', 'Примеры текстов', 'Чего избегать'] },
        { n: '03', title: 'Визуальная система', items: ['Логосистема', 'Охранные зоны', 'Версии логотипа', 'Запрещённые приёмы'] },
        { n: '04', title: 'Цвет & типографика', items: ['Основная палитра', 'Дополнительные цвета', 'Шрифтовая пара', 'Иерархия текста'] },
        { n: '05', title: 'Графический язык', items: ['Паттерны & текстуры', 'Иконографика', 'Фотостиль', 'Иллюстрация'] },
        { n: '06', title: 'Носители', items: ['Деловая документация', 'Цифровые форматы', 'Наружная реклама', 'Мерч & подарки'] },
      ],
      formatsTag: 'Форматы',
      formatsTitlePre: 'Три формата —',
      formatsTitleEm: 'один brandbook.',
      formatsSub: 'Каждый формат решает свою задачу. Мы делаем все три в рамках одного проекта.',
      formats: [
        { fmt: 'PDF', icon: '📄', title: 'Masterbook PDF', desc: 'Полная версия с 80-150+ страницами. Для печати, архива и презентаций партнерам. Интерактивные закладки.' },
        { fmt: 'FIGMA', icon: '🎨', title: 'Figma Library', desc: 'Дизайн-библиотека с компонентами, цветами и типографикой. Дизайнеры подключают и используют мгновенно.' },
        { fmt: 'PRINT', icon: '📚', title: 'Печатная версия', desc: 'Твердая обложка, качественная бумага. Для переговорных, подарков партнерам и корпоративной идентики.' },
      ],
      processTag: 'Как мы делаем',
      processTitlePre: 'Brandbook —',
      processTitleEm: 'итог',
      processSub: 'Он создается в конце, но вся работа — до него. Без стратегии и идентики не бывает хорошего brandbook.',
      process: [
        { n: '01', ha: 'Стратегия & ', he: 'исследование', d: 'Позиционирование, аудитория, конкуренты. Это превращается в раздел «О бренде» и задает тон всему документу. 1-2 недели.' },
        { n: '02', ha: 'Идентика & ', he: 'визуальный язык', d: 'Логосистема, цвет, типографика, паттерны. Каждый элемент — отдельный раздел с правилами применения. 3-5 недель.' },
        { n: '03', ha: 'Верстка & ', he: 'примеры', d: 'Каждое правило сопровождается наглядными примерами — правильно/неправильно. Читается, а не просто хранится. 1-2 недели.' },
        { n: '04', ha: 'Финализация & ', he: 'передача', d: 'PDF, Figma-библиотека, инструктаж команды. При необходимости — печатная версия.' },
      ],
      pricingTag: 'Тарифы',
      pricingTitlePre: 'Прозрачное',
      pricingTitleEm: 'ценообразование.',
      pricingSub: 'Цены в евро. Brandbook как самостоятельный продукт или часть полного проекта — фиксируем стоимость до старта.',
      pricing: [
        {
          badge: 'БАЗОВЫЙ',
          name: 'Essential',
          sub: 'Digital brandbook',
          price: `${priceFrom} 2 500€`,
          features: ['60-80 страниц', 'PDF + Figma Kit', '4 раздела', 'Готовый бренд на входе', 'Срок: 3-4 недели'],
          cta: 'Обсудить',
        },
        {
          badge: 'ПОПУЛЯРНЫЙ',
          name: 'Full Brandbook',
          sub: 'Полный документ бренда',
          price: `${priceFrom} 6 000€`,
          features: ['100-160 страниц', 'PDF + Figma + печать', 'Все 6 разделов', 'Motion guidelines', 'Инструктаж команды', 'Срок: 5-8 недель'],
          cta: 'Запросить смету',
          featured: true,
        },
        {
          badge: 'FLAGSHIP',
          name: 'Brand System',
          sub: 'Идентика + brandbook под ключ',
          price: `${priceFrom} 14 000€`,
          features: ['Бренд-стратегия + идентика', 'Полный brandbook', 'Figma-библиотека', 'Носители и шаблоны', 'Печатная версия'],
          cta: 'Обсудить',
        },
      ],
      ctaTitlePre: 'Нужен brandbook для',
      ctaTitleEm: 'вашего бренда?',
      ctaSub: 'Покажите нам текущие материалы — оценим объем и предложим план работ за 45 минут.',
      ctaSlotsLabel: 'Слотов на Q3',
      ctaSlotsValue: '3 из 12',
      ctaStartLabel: 'Старт',
      ctaStartValue: 'июль 2026',
      ctaNdaLabel: 'NDA',
      ctaNdaValue: 'по запросу',
    },
    tr: {
      crumb: 'Brandbook',
      heroTitlePre: 'Markanizin',
      heroTitleEm: 'anayasasi.',
      heroSub: 'Brandbook, marka kimliginizin ana dokumanidir. Tasarimcilarin, partnerlerin ve yeni ekip uyelerinin tum pratik sorularini yanitlar.',
      actionPrimary: 'Teklif Isteyin',
      actionSecondary: 'Formatlar',
      stats: [
        { num: '63', lbl: 'teslim edilen brandbook' },
        { num: '120+', lbl: 'ortalama sayfa' },
        { num: '3', lbl: 'format: PDF, Figma, baski' },
        { num: '∞', lbl: 'onaylanana kadar revizyon' },
      ],
      structureTag: 'Yapi',
      structureTitlePre: 'Brandbook',
      structureTitleEm: 'icin 6 bolum',
      structureSub: 'Her proje farklidir ancak bu alti blok hazirladigimiz her brandbook icin temel yapidir.',
      chapters: [
        { n: '01', title: 'Marka Hakkinda', items: ['Misyon ve degerler', 'Hikaye ve baglam', 'Konumlandirma', 'Hedef kitle'] },
        { n: '02', title: 'Marka Dili', items: ['Iletisim tonu', 'Marka sozlugu', 'Metin ornekleri', 'Kacinilacaklar'] },
        { n: '03', title: 'Gorsel Sistem', items: ['Logo sistemi', 'Koruma alani', 'Logo varyasyonlari', 'Yanlis kullanimlar'] },
        { n: '04', title: 'Renk & Tipografi', items: ['Ana palet', 'Ikincil renkler', 'Yazi ciftleri', 'Metin hiyerarsisi'] },
        { n: '05', title: 'Grafik Dil', items: ['Pattern ve dokular', 'Ikonografi', 'Foto stil', 'Ilustrasyon'] },
        { n: '06', title: 'Uygulamalar', items: ['Kurumsal dokumanlar', 'Dijital formatlar', 'Acik hava mecralari', 'Merch ve hediyeler'] },
      ],
      formatsTag: 'Formatlar',
      formatsTitlePre: 'Uc format -',
      formatsTitleEm: 'tek brandbook.',
      formatsSub: 'Her format farkli bir ihtiyaci cozer. Tek proje kapsaminda ucunu de teslim ederiz.',
      formats: [
        { fmt: 'PDF', icon: '📄', title: 'Masterbook PDF', desc: '80-150+ sayfali tam surum. Baski, arsiv ve partner sunumlari icin interaktif icerik.' },
        { fmt: 'FIGMA', icon: '🎨', title: 'Figma Library', desc: 'Bilesenler, renkler ve tipografi iceren tasarim kutuphanesi. Ekip hemen kullanmaya baslar.' },
        { fmt: 'PRINT', icon: '📚', title: 'Baski Surumu', desc: 'Sert kapak, yuksek kalite kagit. Toplanti odalari, partner setleri ve yonetim sunumlari icin.' },
      ],
      processTag: 'Nasil yapiyoruz',
      processTitlePre: 'Brandbook, sistemli calismanin',
      processTitleEm: 'sonucudur.',
      processSub: 'Dokuman en sonda ortaya cikar; asil is once yapilir. Guclu strateji ve kimlik temelidir.',
      process: [
        { n: '01', ha: 'Strateji & ', he: 'Arastirma', d: 'Konumlandirma, hedef kitle ve rakip analizi dokumanin temelini olusturur. 1-2 hafta.' },
        { n: '02', ha: 'Kimlik & ', he: 'Gorsel dil', d: 'Logo sistemi, renk, tipografi ve patternler. Her unsur icin acik kullanim kurallari hazirlanir. 3-5 hafta.' },
        { n: '03', ha: 'Yerlesim & ', he: 'Ornekler', d: 'Her kural dogru/yanlis orneklerle aciklanir; dokuman saklanmaz, aktif kullanilir. 1-2 hafta.' },
        { n: '04', ha: 'Finalizasyon & ', he: 'Teslim', d: 'PDF, Figma kutuphanesi ve ekip aktarim oturumu. Gerektiginde baski surumu eklenir.' },
      ],
      pricingTag: 'Fiyatlandirma',
      pricingTitlePre: 'Seffaf',
      pricingTitleEm: 'fiyatlandirma.',
      pricingSub: 'Fiyatlar EUR bazindadir. Kapsam ve butceyi proje baslamadan netlestiririz.',
      pricing: [
        {
          badge: 'BASLANGIC',
          name: 'Essential',
          sub: 'Dijital brandbook',
          price: `${priceFrom} 2 500€`,
          features: ['60-80 sayfa', 'PDF + Figma kit', '4 bolum', 'Hazir marka varliklari', 'Sure: 3-4 hafta'],
          cta: 'Goruselim',
        },
        {
          badge: 'POPULER',
          name: 'Full Brandbook',
          sub: 'Tam marka dokumani',
          price: `${priceFrom} 6 000€`,
          features: ['100-160 sayfa', 'PDF + Figma + baski', 'Tum 6 bolum', 'Motion guidelines', 'Ekip onboarding', 'Sure: 5-8 hafta'],
          cta: 'Teklif Isteyin',
          featured: true,
        },
        {
          badge: 'FLAGSHIP',
          name: 'Brand System',
          sub: 'Kimlik + brandbook turnkey',
          price: `${priceFrom} 14 000€`,
          features: ['Marka stratejisi + kimlik', 'Tam brandbook', 'Figma kutuphanesi', 'Sablonlar ve marka varliklari', 'Baski surumu'],
          cta: 'Goruselim',
        },
      ],
      ctaTitlePre: 'Markaniz icin bir brandbook',
      ctaTitleEm: 'mu gerekiyor?',
      ctaSub: 'Mevcut materyalleri paylasin, 45 dakikada kapsam ve sonraki adimlari netlestirelim.',
      ctaSlotsLabel: 'Q3 kontenjani',
      ctaSlotsValue: '12 uzerinden 3',
      ctaStartLabel: 'Baslangic',
      ctaStartValue: 'Temmuz 2026',
      ctaNdaLabel: 'NDA',
      ctaNdaValue: 'talep uzerine',
    },
  }
  const seo = seoByLang[langKey]
  const content = contentByLang[langKey]

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal')
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.06 }
    )
    els.forEach(el => observer.observe(el))
    window.scrollTo(0, 0)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <PageSEO
        title={seo.title}
        description={seo.description}
        path={p('/services/design/brandbook')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Brandbook Development', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'Branding' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/design')}>{t('crumbs.design')}</Link><span className="sep">/</span>
            <span>{content.crumb}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/BR · Brandbook</div>
              <h1 className="page-title">{content.heroTitlePre} <em>{content.heroTitleEm}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{content.heroSub}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{content.actionPrimary}<span className="arrow">↗</span></a>
                <a href="#formats" className="btn btn-ghost">{content.actionSecondary}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                {content.stats.map(s => (
                  <div key={s.lbl} className="s">
                    <div className="num">{s.num}</div>
                    <div className="lbl">{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* OPEN BOOK CHAPTERS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{content.structureTag}</div>
            <div>
              <h2 className="sec-title">{content.structureTitlePre} <em>{content.structureTitleEm}</em></h2>
              <p className="sec-sub">{content.structureSub}</p>
            </div>
          </div>

          <div className="r1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 0, borderTop: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}>
            {content.chapters.map((ch, i) => (
              <div key={i} className="reveal" style={{
                borderRight: '1px solid var(--line)',
                borderBottom: '1px solid var(--line)',
                padding: '40px 44px',
                display: 'grid',
                gridTemplateColumns: '48px 1fr',
                gap: '0 28px',
                transition: 'background 0.3s var(--ease)',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--paper-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
              >
                <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 48, lineHeight: 1, color: 'var(--paper-3)', letterSpacing: '-0.03em', userSelect: 'none' }}>
                  {ch.n}
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 22, margin: '0 0 16px', letterSpacing: '-0.01em' }}>
                    {ch.title}
                  </h3>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ch.items.map(item => (
                      <li key={item} style={{ fontSize: 14, color: '#555', display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', minWidth: 28 }}>
                          {ch.n}.{String(ch.items.indexOf(item) + 1).padStart(2, '0')}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORMATS */}
      <section id="formats" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
        <div className="wrap" style={{ padding: '100px var(--pad-x)' }}>
          <div className="sec-head" style={{ marginBottom: 56 }}>
            <div className="sec-tag" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span className="num" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'var(--paper)' }}>02</span>
              {content.formatsTag}
            </div>
            <div>
              <h2 className="sec-title">{content.formatsTitlePre} <em>{content.formatsTitleEm}</em></h2>
              <p className="sec-sub" style={{ color: 'rgba(255,255,255,0.55)' }}>{content.formatsSub}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
            {content.formats.map((f, i) => (
              <div key={i} className="reveal" style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '48px 40px',
                borderRadius: i === 0 ? '12px 0 0 12px' : i === 2 ? '0 12px 12px 0' : 0,
              }}>
                <div style={{ fontSize: 32, marginBottom: 20 }}>{f.icon}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
                  {f.fmt}
                </div>
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 26, margin: '0 0 16px', letterSpacing: '-0.01em' }}>
                  {f.title}
                </h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'rgba(255,255,255,0.6)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT MAKES A GOOD BRANDBOOK */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{content.processTag}</div>
            <div>
              <h2 className="sec-title">{content.processTitlePre} <em>{content.processTitleEm}</em></h2>
              <p className="sec-sub">{content.processSub}</p>
            </div>
          </div>
          <div className="pmini">
            {content.process.map((r, i) => (
              <div key={i} className="pmini-row reveal">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{r.ha}<em>{r.he}</em></div>
                <div className="pmini-d">{r.d}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{content.pricingTag}</div>
            <div>
              <h2 className="sec-title">{content.pricingTitlePre} <em>{content.pricingTitleEm}</em></h2>
              <p className="sec-sub">{content.pricingSub}</p>
            </div>
          </div>
          <div className="pricing">
            {content.pricing.map(tier => (
              <div key={tier.name} className={`tier reveal${tier.featured ? ' featured' : ''}`}>
                <div className="tier-badge">{tier.badge}</div>
                <div className="tier-name">{tier.name}</div>
                <div className="tier-sub">{tier.sub}</div>
                <div className="tier-price">{tier.price}</div>
                <ul className="tier-incl">
                  {tier.features.map(l => <li key={l}>{l}</li>)}
                </ul>
                <a href={h('#contact')} className={tier.featured ? 'btn' : 'btn btn-ghost'}>
                  {tier.cta}<span className="arrow">↗</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{content.ctaTitlePre} <em>{content.ctaTitleEm}</em></h2>
              <p>{content.ctaSub}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{content.actionPrimary}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">vlad@lumiva.agency<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{content.ctaSlotsLabel}</div><div className="val">{content.ctaSlotsValue}</div></div>
              <div className="row"><div className="lbl">{content.ctaStartLabel}</div><div className="val">{content.ctaStartValue}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{content.ctaNdaLabel}</div><div className="val">{content.ctaNdaValue}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

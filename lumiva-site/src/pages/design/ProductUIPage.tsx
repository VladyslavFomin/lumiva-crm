import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

type LangKey = 'en' | 'ru' | 'tr'

type ProductUiContent = {
  crumb: string
  heroTitlePre: string
  heroTitleEm: string
  heroSub: string
  actionPrimary: string
  actionSecondary: string
  systemStripTitle: string
  systemStripStack: string
  stats: Array<{ num: string; lbl: string }>
  components: Array<{ label: string; preview: string }>
  includedTag: string
  includedTitlePre: string
  includedTitleEm: string
  includedSub: string
  features: Array<{ n: string; title: string; side: string; desc: string; right: string; dark: boolean }>
  processTag: string
  processTitlePre: string
  processTitleEm: string
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
  ctaRespLabel: string
  ctaRespValue: string
}

export default function ProductUIPage() {
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const langKey: LangKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const priceFrom = langKey === 'ru' ? 'от' : langKey === 'tr' ? 'baslangic' : 'from'
  const monthShort = langKey === 'ru' ? 'мес' : langKey === 'tr' ? 'ay' : 'mo'
  const seoByLang: Record<LangKey, { title: string; description: string }> = {
    en: {
      title: 'Product UI/UX and design systems',
      description: 'UX research, interface design and Figma design systems. Product design from audit to developer handoff.',
    },
    ru: {
      title: 'Продуктовый UI/UX и дизайн-системы',
      description: 'UX-исследование, проектирование интерфейсов, дизайн-системы в Figma. Продуктовый дизайн от аудита до хэндофа разработчикам.',
    },
    tr: {
      title: 'Urun UI/UX ve tasarim sistemleri',
      description: 'UX arastirmasi, arayuz tasarimi ve Figma tasarim sistemleri. Denetimden gelistirici teslimine kadar urun tasarimi.',
    },
  }
  const contentByLang: Record<LangKey, ProductUiContent> = {
    en: {
      crumb: 'Product UI',
      heroTitlePre: 'Interfaces that',
      heroTitleEm: 'do not need extra explanation.',
      heroSub: 'Design systems, SaaS interfaces, dashboards and portals. We design logic first, then shape it into clear interaction patterns.',
      actionPrimary: 'Request a Quote',
      actionSecondary: 'Design System',
      systemStripTitle: 'DESIGN SYSTEM COMPONENTS',
      systemStripStack: 'Figma -> React / Vue / Flutter',
      stats: [
        { num: '40+', lbl: 'products in production' },
        { num: 'x2.8', lbl: 'average conversion growth' },
        { num: '-60%', lbl: 'onboarding time' },
        { num: '4.8★', lbl: 'average app store rating' },
      ],
      components: [
        { label: 'Buttons', preview: '◉ Primary  ○ Ghost  — Link' },
        { label: 'Forms', preview: '[ Input field      ▾ ]\n[ Textarea              ]' },
        { label: 'Cards', preview: '┌─────────────┐\n│  Title       │\n│  Description │\n└─────────────┘' },
        { label: 'Navigation', preview: 'Home  Product  Docs  ···' },
        { label: 'Data tables', preview: 'Col A  |  Col B  |  Col C\n ───────────────────────\n val   |  val   |  val' },
        { label: 'Charts', preview: '▁▂▃▅▇▆▄▃▂  ━━━  ●──●' },
      ],
      includedTag: 'What is included',
      includedTitlePre: 'UX research, design,',
      includedTitleEm: 'system.',
      includedSub: 'From user interviews to production-ready Figma libraries your developers can use from day one.',
      features: [
        {
          n: 'UI/01',
          title: 'UX research & prototype',
          side: 'Understand real users',
          desc: 'User interviews, competitor review and scenario mapping. We validate the prototype before visual design starts.',
          right: 'Validated prototypes reduce expensive redesigns after implementation.',
          dark: false,
        },
        {
          n: 'UI/02',
          title: 'Design system & UI kit',
          side: 'Build design infrastructure',
          desc: 'Components, tokens, states and dark mode. Figma library aligned with development workflows.',
          right: 'A mature system speeds up each next feature cycle.',
          dark: true,
        },
        {
          n: 'UI/03',
          title: 'Screens and user flows',
          side: 'Design full scenarios',
          desc: 'Onboarding, dashboards, data tables, settings and mobile adaptations. Every screen is part of one coherent flow.',
          right: 'We design empty states, loading and errors, not only happy paths.',
          dark: false,
        },
        {
          n: 'UI/04',
          title: 'Accessibility & usability test',
          side: 'Validate with users',
          desc: 'WCAG 2.1 AA checks: contrast, keyboard navigation, screen reader support. Moderated tests before release.',
          right: 'Issues found in usability testing are much cheaper to fix than production defects.',
          dark: true,
        },
      ],
      processTag: 'Process',
      processTitlePre: 'From research to',
      processTitleEm: 'Figma kit.',
      process: [
        { n: '01', ha: 'Research & ', he: 'strategy', d: 'User interviews, JTBD and competitor analysis. Output: validated user scenario map. 1-2 weeks.' },
        { n: '02', ha: 'UX & ', he: 'information architecture', d: 'Wireframes, user flows and Figma prototypes tested with users before final UI. 1-3 weeks.' },
        { n: '03', ha: 'UI & ', he: 'design system', d: 'Full screen set, responsive states and tokenized Figma library. 3-8 weeks.' },
        { n: '04', ha: 'Handoff & ', he: 'support', d: 'Developer handoff, Storybook alignment and ongoing implementation support.' },
      ],
      pricingTag: 'Pricing',
      pricingTitlePre: 'Transparent',
      pricingTitleEm: 'pricing.',
      pricingSub: 'Prices are in EUR. UX audit, MVP design or full design system — scope and budget are fixed before kickoff.',
      pricing: [
        {
          badge: 'START',
          name: 'UX Audit',
          sub: 'Audit + recommendations',
          price: `${priceFrom} 2 000€`,
          features: ['Heuristic analysis', 'Test with 5 users', 'Prioritized report', 'Improvement roadmap', 'Timeline: 1-2 weeks'],
          cta: 'Discuss',
        },
        {
          badge: 'POPULAR',
          name: 'Product Design',
          sub: 'Turnkey product design',
          price: `${priceFrom} 12 000€`,
          features: ['UX research', 'All screens and states', 'Design system + Figma kit', 'Mobile adaptation', 'Usability test', '3 months design support'],
          cta: 'Request a Quote',
          featured: true,
        },
        {
          badge: 'LONG-TERM',
          name: 'Design Partner',
          sub: 'Dedicated product designer',
          price: `${priceFrom} 3 500€/${monthShort}`,
          features: ['Senior product designer', 'Roadmap iterations', 'Sprint design reviews', 'A/B hypotheses', 'Monthly UX review'],
          cta: 'Discuss',
        },
      ],
      ctaTitlePre: 'Have a product that can be',
      ctaTitleEm: 'improved?',
      ctaSub: 'In 45 minutes we will identify key growth points and define the best starting scope.',
      ctaSlotsLabel: 'Q3 slots',
      ctaSlotsValue: '3 of 12',
      ctaStartLabel: 'Start',
      ctaStartValue: 'July 2026',
      ctaRespLabel: 'Response time',
      ctaRespValue: '<= 1 business day',
    },
    ru: {
      crumb: 'Продуктовый UI',
      heroTitlePre: 'Интерфейсы, которые',
      heroTitleEm: 'не объясняют себя дважды.',
      heroSub: 'Дизайн-системы, экраны SaaS и мобильных приложений, дашборды и порталы. Проектируем логику, а потом делаем из нее интерфейс.',
      actionPrimary: 'Запросить смету',
      actionSecondary: 'Дизайн-система',
      systemStripTitle: 'КОМПОНЕНТЫ ДИЗАЙН-СИСТЕМЫ',
      systemStripStack: 'Figma -> React / Vue / Flutter',
      stats: [
        { num: '40+', lbl: 'продуктов в продакшене' },
        { num: 'x2.8', lbl: 'средний рост conversion rate' },
        { num: '-60%', lbl: 'времени на онбординг' },
        { num: '4.8★', lbl: 'средний рейтинг в сторах' },
      ],
      components: [
        { label: 'Buttons', preview: '◉ Primary  ○ Ghost  — Link' },
        { label: 'Forms', preview: '[ Input field      ▾ ]\n[ Textarea              ]' },
        { label: 'Cards', preview: '┌─────────────┐\n│  Title       │\n│  Description │\n└─────────────┘' },
        { label: 'Navigation', preview: 'Home  Product  Docs  ···' },
        { label: 'Data tables', preview: 'Col A  |  Col B  |  Col C\n ───────────────────────\n val   |  val   |  val' },
        { label: 'Charts', preview: '▁▂▃▅▇▆▄▃▂  ━━━  ●──●' },
      ],
      includedTag: 'Что входит',
      includedTitlePre: 'UX-исследование, дизайн,',
      includedTitleEm: 'система.',
      includedSub: 'От пользовательских интервью до готовой Figma-библиотеки, которую ваши разработчики используют с первого дня.',
      features: [
        {
          n: 'UI/01',
          title: 'UX-исследование & прототип',
          side: 'Понимаем пользователей',
          desc: 'Интервью с реальными пользователями, анализ конкурентов, карта пользовательских сценариев. Прототип согласовываем до начала дизайна.',
          right: 'Прототип, одобренный пользователями, переделывают в 3 раза реже готового дизайна.',
          dark: false,
        },
        {
          n: 'UI/02',
          title: 'Дизайн-система & UI Kit',
          side: 'Строим инфраструктуру',
          desc: 'Компоненты, токены, состояния, dark mode. Figma-библиотека, подключенная к коду через Storybook или напрямую.',
          right: 'Экономит 40% времени разработки на каждой следующей фиче.',
          dark: true,
        },
        {
          n: 'UI/03',
          title: 'Экраны и пользовательские потоки',
          side: 'Проектируем каждый сценарий',
          desc: 'Онбординг, дашборды, таблицы данных, настройки, мобильные адаптации. Каждый экран — часть потока, а не изолированная картинка.',
          right: 'Пустые состояния, ошибки, загрузка — проектируем все, а не только happy path.',
          dark: false,
        },
        {
          n: 'UI/04',
          title: 'Accessibility & usability тест',
          side: 'Проверяем на людях',
          desc: 'WCAG 2.1 AA: контрастность, навигация с клавиатуры, screen reader. Модерируемое тестирование с 5-8 пользователями до релиза.',
          right: 'Проблемы, обнаруженные на тесте, исправить в 100 раз дешевле, чем в продакшене.',
          dark: true,
        },
      ],
      processTag: 'Процесс',
      processTitlePre: 'От исследования до',
      processTitleEm: 'Figma-кита.',
      process: [
        { n: '01', ha: 'Research & ', he: 'стратегия', d: 'User interviews, Jobs To Be Done, конкурентный анализ. Результат — карта пользовательских сценариев. 1-2 нед.' },
        { n: '02', ha: 'UX & ', he: 'информационная архитектура', d: 'Wireframes, user flows, прототипы в Figma. Тест с пользователями до финального дизайна. 1-3 нед.' },
        { n: '03', ha: 'UI & ', he: 'дизайн-система', d: 'Все экраны, состояния, адаптивность. Figma-библиотека с токенами и компонентами. 3-8 нед.' },
        { n: '04', ha: 'Передача & ', he: 'support', d: 'Handoff разработчикам, Storybook, ответы на вопросы в процессе разработки.' },
      ],
      pricingTag: 'Тарифы',
      pricingTitlePre: 'Прозрачное',
      pricingTitleEm: 'ценообразование.',
      pricingSub: 'Цены в евро. UX-аудит, MVP-дизайн или полная дизайн-система — фиксируем до старта.',
      pricing: [
        {
          badge: 'СТАРТ',
          name: 'UX Audit',
          sub: 'Аудит + рекомендации',
          price: `${priceFrom} 2 000€`,
          features: ['Эвристический анализ', 'Тест с 5 пользователями', 'Отчет с приоритетами', 'Roadmap улучшений', 'Срок: 1-2 недели'],
          cta: 'Обсудить',
        },
        {
          badge: 'ПОПУЛЯРНЫЙ',
          name: 'Product Design',
          sub: 'Дизайн продукта под ключ',
          price: `${priceFrom} 12 000€`,
          features: ['UX-исследование', 'Все экраны и состояния', 'Дизайн-система + Figma Kit', 'Мобильная адаптация', 'Usability тест', '3 месяца design support'],
          cta: 'Запросить смету',
          featured: true,
        },
        {
          badge: 'ДОЛГОСРОК',
          name: 'Design Partner',
          sub: 'Выделенный продуктовый дизайнер',
          price: `${priceFrom} 3 500€/${monthShort}`,
          features: ['Senior product designer', 'Итерации по дорожной карте', 'Design review спринтов', 'A/B гипотезы', 'Ежемесячный UX-ревью'],
          cta: 'Обсудить',
        },
      ],
      ctaTitlePre: 'Есть продукт, который можно',
      ctaTitleEm: 'улучшить?',
      ctaSub: 'За 45 минут найдем главные точки роста и предложим, с чего начать.',
      ctaSlotsLabel: 'Слотов на Q3',
      ctaSlotsValue: '3 из 12',
      ctaStartLabel: 'Старт',
      ctaStartValue: 'июль 2026',
      ctaRespLabel: 'Срок ответа',
      ctaRespValue: '<= 1 рабочий день',
    },
    tr: {
      crumb: 'Urun UI',
      heroTitlePre: 'Tekrar tekrar aciklama gerektirmeyen',
      heroTitleEm: 'arayuzler.',
      heroSub: 'SaaS ekranlari, mobil arayuzler, paneller ve portal akislari icin sistemli urun tasarimi. Once mantigi kurar, sonra arayuzu netlestiririz.',
      actionPrimary: 'Teklif Isteyin',
      actionSecondary: 'Tasarim Sistemi',
      systemStripTitle: 'TASARIM SISTEMI BILESENLERI',
      systemStripStack: 'Figma -> React / Vue / Flutter',
      stats: [
        { num: '40+', lbl: 'productiondaki urun' },
        { num: 'x2.8', lbl: 'ortalama donusum artisi' },
        { num: '-60%', lbl: 'onboarding suresi' },
        { num: '4.8★', lbl: 'ortalama store puani' },
      ],
      components: [
        { label: 'Buttons', preview: '◉ Primary  ○ Ghost  — Link' },
        { label: 'Forms', preview: '[ Input field      ▾ ]\n[ Textarea              ]' },
        { label: 'Cards', preview: '┌─────────────┐\n│  Title       │\n│  Description │\n└─────────────┘' },
        { label: 'Navigation', preview: 'Home  Product  Docs  ···' },
        { label: 'Data tables', preview: 'Col A  |  Col B  |  Col C\n ───────────────────────\n val   |  val   |  val' },
        { label: 'Charts', preview: '▁▂▃▅▇▆▄▃▂  ━━━  ●──●' },
      ],
      includedTag: 'Neler Dahil',
      includedTitlePre: 'UX arastirma, tasarim,',
      includedTitleEm: 'sistem.',
      includedSub: 'Kullanici gorusmelerinden gelistiriciye hazir Figma kutuphanesine kadar tum sureci uctan uca yonetiriz.',
      features: [
        {
          n: 'UI/01',
          title: 'UX arastirma & prototip',
          side: 'Kullaniciyi anlamak',
          desc: 'Gercek kullanici gorusmeleri, rakip analizi ve senaryo haritasi. Gorsel tasarimdan once prototipi test ederiz.',
          right: 'Dogrulanmis prototipler, sonraki yeniden tasarim maliyetini ciddi olcude azaltir.',
          dark: false,
        },
        {
          n: 'UI/02',
          title: 'Tasarim sistemi & UI kit',
          side: 'Altyapiyi kurmak',
          desc: 'Bilesenler, tokenlar, durumlar ve dark mode. Figma kutuphanesi gelistirme akisina dogrudan uyarlanir.',
          right: 'Saglam bir sistem her yeni ozelligi daha hizli cikarmayi saglar.',
          dark: true,
        },
        {
          n: 'UI/03',
          title: 'Ekranlar ve kullanici akisleri',
          side: 'Tum senaryolari tasarlamak',
          desc: 'Onboarding, dashboard, veri tablolari, ayarlar ve mobil adaptasyonlar. Her ekran butun akisin parcasi olur.',
          right: 'Sadece happy path degil; bos durum, hata ve yukleme ekranlarini da tasarlariz.',
          dark: false,
        },
        {
          n: 'UI/04',
          title: 'Accessibility & usability testi',
          side: 'Kullanicilarla dogrulama',
          desc: 'WCAG 2.1 AA kontrolleri: kontrast, klavye navigasyonu, screen reader uyumu. Yayindan once moderasyonlu test.',
          right: 'Usability testte bulunan sorunlarin duzeltilmesi production sonrasina gore cok daha ucuzdur.',
          dark: true,
        },
      ],
      processTag: 'Surec',
      processTitlePre: 'Arastirmadan',
      processTitleEm: 'Figma kitine.',
      process: [
        { n: '01', ha: 'Research & ', he: 'strateji', d: 'Kullanici gorusmeleri, JTBD ve rakip analizi. Cikti: onayli kullanici senaryo haritasi. 1-2 hafta.' },
        { n: '02', ha: 'UX & ', he: 'bilgi mimarisi', d: 'Wireframe, kullanici akislari ve Figma prototipleri. Son UI oncesi kullanici testi. 1-3 hafta.' },
        { n: '03', ha: 'UI & ', he: 'tasarim sistemi', d: 'Tum ekran seti, responsive durumlar ve token bazli Figma kutuphanesi. 3-8 hafta.' },
        { n: '04', ha: 'Teslim & ', he: 'support', d: 'Gelistirici handoff, Storybook hizalamasi ve uygulama surecinde surekli destek.' },
      ],
      pricingTag: 'Fiyatlandirma',
      pricingTitlePre: 'Seffaf',
      pricingTitleEm: 'fiyatlandirma.',
      pricingSub: 'Fiyatlar EUR bazindadir. UX audit, MVP tasarimi veya tam sistem icin kapsam ve butceyi baslamadan netlestiririz.',
      pricing: [
        {
          badge: 'BASLANGIC',
          name: 'UX Audit',
          sub: 'Denetim + oneriler',
          price: `${priceFrom} 2 000€`,
          features: ['Heuristic analiz', '5 kullanici ile test', 'Oncelikli rapor', 'Iyilestirme yol haritasi', 'Sure: 1-2 hafta'],
          cta: 'Goruselim',
        },
        {
          badge: 'POPULER',
          name: 'Product Design',
          sub: 'Uctan uca urun tasarimi',
          price: `${priceFrom} 12 000€`,
          features: ['UX arastirmasi', 'Tum ekranlar ve durumlar', 'Tasarim sistemi + Figma kit', 'Mobil adaptasyon', 'Usability testi', '3 ay design support'],
          cta: 'Teklif Isteyin',
          featured: true,
        },
        {
          badge: 'UZUN VADE',
          name: 'Design Partner',
          sub: 'Ozel urun tasarimcisi',
          price: `${priceFrom} 3 500€/${monthShort}`,
          features: ['Senior product designer', 'Yol haritasi iterasyonlari', 'Sprint design review', 'A/B hipotezleri', 'Aylik UX incelemesi'],
          cta: 'Goruselim',
        },
      ],
      ctaTitlePre: 'Gelisebilecek bir urununuz',
      ctaTitleEm: 'mu var?',
      ctaSub: '45 dakikada buyume firsatlarini belirleyip en dogru baslangic kapsamini netlestirelim.',
      ctaSlotsLabel: 'Q3 kontenjani',
      ctaSlotsValue: '12 uzerinden 3',
      ctaStartLabel: 'Baslangic',
      ctaStartValue: 'Temmuz 2026',
      ctaRespLabel: 'Yanit suresi',
      ctaRespValue: '<= 1 is gunu',
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
        path={p('/services/design/product-ui')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'Product UI/UX Design', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'UI/UX Design' }}
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
              <div className="page-eyebrow">D/02 · Product UI/UX</div>
              <h1 className="page-title">{content.heroTitlePre} <em>{content.heroTitleEm}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{content.heroSub}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{content.actionPrimary}<span className="arrow">↗</span></a>
                <a href="#system" className="btn btn-ghost">{content.actionSecondary}<span className="arrow">↗</span></a>
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

      {/* COMPONENT PREVIEW STRIP */}
      <section style={{ background: 'var(--ink)', color: 'var(--paper)', borderTop: '1px solid #000' }}>
        <div className="wrap" style={{ padding: '64px var(--pad-x)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
              {content.systemStripTitle}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>
              {content.systemStripStack}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {content.components.map((c, i) => (
              <div key={i} className="reveal" style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '24px 28px',
              }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>
                  {c.label.toUpperCase()}
                </div>
                <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {c.preview}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT WE DO */}
      <section id="system">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{content.includedTag}</div>
            <div>
              <h2 className="sec-title">{content.includedTitlePre} <em>{content.includedTitleEm}</em></h2>
              <p className="sec-sub">{content.includedSub}</p>
            </div>
            <a href={h('#contact')} className="show-all">{content.actionPrimary} <span className="arr">↗</span></a>
          </div>

          {/* Alternating feature rows */}
          {content.features.map((item, i) => (
            <div key={i} className="reveal sub-deliv" style={{
              background: item.dark ? 'var(--paper-2)' : 'transparent',
            }}>
              <div className="sub-deliv-l" style={{ borderColor: 'var(--line)' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 16 }}>{item.n}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{item.side}</div>
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 'clamp(22px, 2vw, 32px)', letterSpacing: '-0.015em', margin: '0 0 20px', lineHeight: 1.1 }}>
                  {item.title}
                </h3>
                <p style={{ margin: 0, color: '#444', fontSize: 15.5, lineHeight: 1.65 }}>{item.desc}</p>
              </div>
              <div className="sub-deliv-r" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontStyle: 'italic',
                  fontSize: 'clamp(18px, 1.8vw, 26px)',
                  color: 'var(--muted)',
                  lineHeight: 1.4,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}>
                  «{item.right}»
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PROCESS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{content.processTag}</div>
            <div><h2 className="sec-title">{content.processTitlePre} <em>{content.processTitleEm}</em></h2></div>
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
            <div className="sec-tag"><span className="num">03</span>{content.pricingTag}</div>
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
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{content.ctaRespLabel}</div><div className="val">{content.ctaRespValue}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

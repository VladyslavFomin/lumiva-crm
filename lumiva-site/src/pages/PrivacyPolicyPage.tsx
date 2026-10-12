import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import { useLangPath } from '../hooks/useLangPath'

const updatedAt = '13 мая 2026 года'

const processingPurposes = [
  {
    title: 'Обработка заявок и коммуникация',
    data: 'имя, компания, e-mail, телефон, содержание сообщения, бюджет, источник обращения, технические метки страницы и формы',
    basis: 'согласие субъекта персональных данных, исполнение договора или действия до заключения договора',
    term: 'до завершения коммуникации, исполнения договора и сроков обязательного хранения деловой переписки',
  },
  {
    title: 'Подписка на материалы и рассылки',
    data: 'e-mail, дата подписки, источник подписки, статус доставки и отписки',
    basis: 'согласие субъекта персональных данных',
    term: 'до отписки, отзыва согласия или прекращения рассылки',
  },
  {
    title: 'Аналитика сайта и улучшение сервиса',
    data: 'IP-адрес, user agent, сведения о браузере и устройстве, страницы просмотра, referrer, UTM-метки, cookie-идентификаторы Google Analytics 4 и Яндекс.Метрики, обезличенные события, сведения о кликах и взаимодействии со страницами',
    basis: 'согласие на использование cookie и обработку технических данных, а также законный интерес Оператора в поддержке безопасности и развитии сайта',
    term: 'в пределах сроков хранения соответствующих cookie, логов и аналитических отчетов',
  },
  {
    title: 'Безопасность и администрирование сайта',
    data: 'IP-адрес, дата и время запроса, URL, код ответа сервера, технические диагностические сведения',
    basis: 'законный интерес Оператора, исполнение обязанностей по обеспечению безопасности информационных систем',
    term: 'обычно до 12 месяцев, если больший срок не требуется для расследования инцидента или исполнения закона',
  },
]

const rights = [
  'получать сведения об обработке своих персональных данных',
  'требовать уточнения, блокирования или уничтожения неполных, устаревших, неточных, незаконно полученных или избыточных данных',
  'отзывать согласие на обработку персональных данных',
  'возражать против обработки данных для маркетинговых коммуникаций',
  'обжаловать действия или бездействие Оператора в уполномоченный орган по защите прав субъектов персональных данных или в суд',
]

const cookieTypes = [
  {
    title: 'Необходимые',
    text: 'помогают корректно показывать сайт, сохранять выбор пользователя и защищать формы от некорректной работы.',
  },
  {
    title: 'Аналитические',
    text: 'показывают, какие страницы и сценарии используются чаще, где возникают ошибки и как улучшить интерфейс.',
  },
  {
    title: 'Маркетинговые',
    text: 'могут использоваться для оценки эффективности рекламы, UTM-меток и повторной коммуникации с заинтересованными посетителями.',
  },
]

export default function PrivacyPolicyPage() {
  const { t, i18n } = useTranslation()
  const { p } = useLangPath()
  const lang = i18n.language || 'en'
  const langKey = lang.startsWith('ru') ? 'ru' : lang.startsWith('tr') ? 'tr' : 'en'
  const isRu = langKey === 'ru'

  const seoDescriptions: Record<string, string> = {
    en: 'Lumiva Agency privacy policy: personal data processing purposes, cookie usage, storage terms, user rights and operator contacts.',
    ru: 'Политика Lumiva Agency в отношении обработки персональных данных: цели, состав данных, cookie, сроки хранения, права пользователей и контакты оператора.',
    tr: 'Lumiva Agency gizlilik politikasi: kisisel veri isleme amaclari, cerez kullanimi, saklama sureleri, kullanici haklari ve iletisim bilgileri.',
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('privacy.title'),
    description: seoDescriptions[lang] || seoDescriptions.en,
    url: `https://lumiva.agency${p('/privacy-policy')}/`,
    dateModified: '2026-05-13',
    publisher: {
      '@type': 'Organization',
      name: 'Lumiva Agency',
      url: 'https://lumiva.agency/',
      email: 'vlad@lumiva.agency',
    },
  }

  if (!isRu) {
    const briefByLang: Record<'en' | 'tr', {
      heroTitle: string
      heroSub: string
      intro: string
      sections: string[]
      rightsTitle: string
      rightsItems: string[]
      contactTitle: string
      contactBody: string
    }> = {
      en: {
        heroTitle: 'Privacy Policy',
        heroSub: 'How Lumiva Agency processes personal data, uses cookies and protects user rights.',
        intro: 'This page describes what data we process, why we process it, and how you can exercise your privacy rights.',
        sections: [
          'General provisions and legal basis',
          'Operator information and contact details',
          'Data categories and processing purposes',
          'Cookies, analytics and consent',
          'Data transfer, storage and retention',
          'User rights and request handling',
          'Security and organizational measures',
          'Policy updates and communication channels',
        ],
        rightsTitle: 'Your rights',
        rightsItems: [
          'Request information about your personal data processing',
          'Ask to correct, block or delete inaccurate data',
          'Withdraw consent where processing is consent-based',
          'Object to marketing-related processing',
        ],
        contactTitle: 'Privacy contact',
        contactBody: 'For any privacy request, email vlad@lumiva.agency or call +90 538 365 96 78.',
      },
      tr: {
        heroTitle: 'Gizlilik Politikasi',
        heroSub: 'Lumiva Agency kişisel verileri nasil isler, cerezleri nasil kullanir ve kullanici haklarini nasil korur.',
        intro: 'Bu sayfa hangi verileri hangi amaclarla isledigimizi ve gizlilik haklarinizi nasil kullanabileceginizi aciklar.',
        sections: [
          'Genel hukuki esaslar',
          'Operator bilgileri ve iletisim',
          'Islenen veri kategorileri ve amaclar',
          'Cerezler, analitik ve onay sureci',
          'Veri aktarimi, saklama ve sureler',
          'Kullanici haklari ve basvuru sureci',
          'Guvenlik ve organizasyonel onlemler',
          'Politika guncellemeleri ve iletisim kanallari',
        ],
        rightsTitle: 'Haklariniz',
        rightsItems: [
          'Kişisel verilerinizin islenmesine iliskin bilgi talep etme',
          'Yanlis verilerin duzeltilmesini veya silinmesini isteme',
          'Onaya dayali islemlerde onayi geri cekme',
          'Pazarlama odakli islemelere itiraz etme',
        ],
        contactTitle: 'Gizlilik iletisimi',
        contactBody: 'Gizlilik talepleri icin vlad@lumiva.agency adresine yazabilir veya +90 538 365 96 78 numarasini arayabilirsiniz.',
      },
    }
    const brief = briefByLang[langKey]
    return (
      <>
        <PageSEO
          title={t('privacy.title')}
          description={seoDescriptions[langKey] || seoDescriptions.en}
          path={p('/privacy-policy')}
          jsonLd={jsonLd}
        />
        <header className="page-hero policy-hero">
          <div className="wrap">
            <div className="crumbs">
              <Link to={p('/')}>{t('crumbs.home')}</Link>
              <span className="sep">/</span>
              <span>{t('privacy.title')}</span>
            </div>
            <div className="page-hero-grid">
              <div>
                <div className="page-eyebrow">Legal · Privacy · Cookies</div>
                <h1 className="page-title">{brief.heroTitle}</h1>
              </div>
              <aside className="page-hero-side policy-summary">
                <p>{brief.heroSub}</p>
              </aside>
            </div>
          </div>
        </header>

        <main className="policy-page">
          <section className="policy-section">
            <div className="wrap policy-layout policy-layout--solo">
              <div className="policy-content">
                <article className="policy-block">
                  <h2>{brief.intro}</h2>
                  <ul className="policy-list">
                    {brief.sections.map(item => <li key={item}>{item}</li>)}
                  </ul>
                </article>

                <article className="policy-block">
                  <h2>{brief.rightsTitle}</h2>
                  <ul className="policy-list">
                    {brief.rightsItems.map(item => <li key={item}>{item}</li>)}
                  </ul>
                </article>

                <article className="policy-block">
                  <h2>{brief.contactTitle}</h2>
                  <p>{brief.contactBody}</p>
                </article>
              </div>
            </div>
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <PageSEO
        title={t('privacy.title')}
        description={seoDescriptions[lang] || seoDescriptions.en}
        path={p('/privacy-policy')}
        jsonLd={jsonLd}
      />

      <header className="page-hero policy-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link>
            <span className="sep">/</span>
            <span>{t('privacy.title')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">Legal · Privacy · Cookies</div>
              <h1 className="page-title">Политика обработки <em>персональных данных</em></h1>
            </div>
            <aside className="page-hero-side policy-summary" aria-label="Краткая информация о документе">
              <p>Документ описывает, какие данные обрабатывает Lumiva Agency на сайте, зачем они нужны, как используются cookie и как пользователь может реализовать свои права.</p>
              <div className="policy-facts">
                <div>
                  <span>Оператор</span>
                  <strong>Lumiva Agency</strong>
                </div>
                <div>
                  <span>Сайт</span>
                  <strong>lumiva.agency</strong>
                </div>
                <div>
                  <span>Обновлено</span>
                  <strong>{updatedAt}</strong>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </header>

      <main className="policy-page">
        <section className="policy-section">
          <div className="wrap policy-layout">
            <aside className="policy-nav" aria-label="Разделы политики">
              <a href="#general">1. Общие положения</a>
              <a href="#operator">2. Оператор</a>
              <a href="#data">3. Данные и цели</a>
              <a href="#cookies">4. Cookies</a>
              <a href="#transfer">5. Передача и хранение</a>
              <a href="#rights">6. Права пользователя</a>
              <a href="#security">7. Защита данных</a>
              <a href="#contacts">8. Контакты</a>
            </aside>

            <div className="policy-content">
              <article id="general" className="policy-block">
                <span className="policy-num">01</span>
                <h2>{t('privacy.sec01')}</h2>
                <p>
                  Настоящая Политика обработки персональных данных определяет порядок обработки и защиты персональных данных пользователей сайта <a href="https://lumiva.agency">https://lumiva.agency</a>, а также посетителей, клиентов и потенциальных клиентов Lumiva Agency.
                </p>
                <p>
                  Политика разработана с учетом Федерального закона РФ от 27.07.2006 N 152-ФЗ «О персональных данных», применимых норм законодательства о рекламе, связи, информации и защите информации, а также принципов добросовестной, конкретной и ограниченной целями обработки данных.
                </p>
                <p>
                  Используя сайт, отправляя форму, подписываясь на материалы или нажимая кнопку согласия в cookie-уведомлении, пользователь подтверждает, что ознакомился с настоящей Политикой. Если пользователь не согласен с ее условиями, он должен прекратить использование сайта и не направлять персональные данные через формы.
                </p>
              </article>

              <article id="operator" className="policy-block">
                <span className="policy-num">02</span>
                <h2>{t('privacy.sec02')}</h2>
                <div className="policy-table" role="table" aria-label="Сведения об операторе">
                  <div className="policy-row" role="row">
                    <div role="cell">Наименование</div>
                    <div role="cell">Lumiva Agency</div>
                  </div>
                  <div className="policy-row" role="row">
                    <div role="cell">Сайт</div>
                    <div role="cell"><a href="https://lumiva.agency">https://lumiva.agency</a></div>
                  </div>
                  <div className="policy-row" role="row">
                    <div role="cell">E-mail для запросов</div>
                    <div role="cell"><a href="mailto:vlad@lumiva.agency">vlad@lumiva.agency</a></div>
                  </div>
                  <div className="policy-row" role="row">
                    <div role="cell">Телефон</div>
                    <div role="cell"><a href="tel:+905383659678">+90 538 365 96 78</a></div>
                  </div>
                  <div className="policy-row" role="row">
                    <div role="cell">Адрес для корреспонденции</div>
                    <div role="cell">Antalya, Турция</div>
                  </div>
                </div>
                <p>
                  Оператор самостоятельно определяет цели обработки, состав персональных данных, действия с персональными данными и применяемые меры защиты в пределах работы сайта, коммуникации с пользователями, оказания услуг и развития продуктов Lumiva.
                </p>
              </article>

              <article id="data" className="policy-block">
                <span className="policy-num">03</span>
                <h2>{t('privacy.sec03')}</h2>
                <p>
                  Оператор не запрашивает специальные категории персональных данных, сведения о политических взглядах, религиозных убеждениях, состоянии здоровья, биометрические данные и данные несовершеннолетних. Пользователь не должен передавать такие сведения через формы сайта.
                </p>
                <div className="policy-purpose-list">
                  {processingPurposes.map((item, index) => (
                    <div className="policy-purpose" key={item.title}>
                      <div className="policy-purpose-head">
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <h3>{item.title}</h3>
                      </div>
                      <dl>
                        <dt>Категории данных</dt>
                        <dd>{item.data}</dd>
                        <dt>Правовое основание</dt>
                        <dd>{item.basis}</dd>
                        <dt>Срок хранения</dt>
                        <dd>{item.term}</dd>
                      </dl>
                    </div>
                  ))}
                </div>
                <p>
                  Обработка включает сбор, запись, систематизацию, накопление, хранение, уточнение, использование, передачу в пределах поручений и договоров, обезличивание, блокирование, удаление и уничтожение данных. Обработка может выполняться как автоматизированно, так и без использования средств автоматизации.
                </p>
              </article>

              <article id="cookies" className="policy-block">
                <span className="policy-num">04</span>
                <h2>{t('privacy.sec04')}</h2>
                <p>
                  Cookie-файлы и локальное хранилище браузера помогают сайту запоминать технические настройки, понимать качество работы страниц, связывать заявку с источником перехода и улучшать сервис. Cookie могут содержать уникальный идентификатор браузера, дату и время визита, сведения о действиях на сайте и технические параметры устройства.
                </p>
                <div className="policy-cookie-grid">
                  {cookieTypes.map(item => (
                    <div className="policy-cookie-type" key={item.title}>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
                <p>
                  Пользователь может ограничить или удалить cookie в настройках браузера. При отключении cookie отдельные элементы сайта могут работать некорректно: например, сайт может повторно показывать уведомление о cookie или терять часть технических настроек.
                </p>
                <p>
                  На момент публикации настоящей Политики сайт использует собственное хранилище для фиксации согласия с cookie-уведомлением, Google Analytics 4 через Google tag с идентификатором G-PY7330Q8X2 и Яндекс.Метрику со счетчиком 109183320. Эти сервисы помогают оценивать посещаемость, источники переходов, поведение на страницах, клики, техническое качество интерфейса и эффективность рекламы. В Яндекс.Метрике могут использоваться технологии Webvisor, clickmap, trackLinks и accurateTrackBounce, а сведения электронной коммерции могут передаваться через dataLayer при наличии таких событий на сайте. При подключении дополнительных систем веб-аналитики, рекламных пикселей, CRM, форм обратной связи, почтовых сервисов или антиспам-защиты их cookie и технические идентификаторы будут использоваться в пределах целей, указанных в настоящей Политике.
                </p>
              </article>

              <article id="transfer" className="policy-block">
                <span className="policy-num">05</span>
                <h2>{t('privacy.sec05')}</h2>
                <p>
                  Персональные данные могут передаваться сотрудникам и подрядчикам Оператора, хостинг-провайдерам, поставщикам CRM, почтовых, аналитических, рекламных, платежных, коммуникационных и антиспам-сервисов, если это необходимо для обработки заявки, оказания услуг, администрирования сайта, рассылок, аналитики или исполнения требований закона.
                </p>
                <p>
                  Лица, которым поручается обработка персональных данных, обязуются соблюдать конфиденциальность, использовать данные только по поручению Оператора и применять разумные организационные и технические меры защиты.
                </p>
                <p>
                  Если обработка данных пользователей из Российской Федерации требует хранения с использованием баз данных на территории Российской Федерации, Оператор обеспечивает такую локализацию в случаях и пределах, установленных применимым законодательством.
                </p>
                <p>
                  Трансграничная передача данных может осуществляться, поскольку команда, инфраструктура или подрядчики Lumiva могут находиться за пределами Российской Федерации. Такая передача выполняется только при наличии правового основания и при условии принятия мер по защите данных.
                </p>
              </article>

              <article id="rights" className="policy-block">
                <span className="policy-num">06</span>
                <h2>{t('privacy.sec06')}</h2>
                <p>Пользователь вправе:</p>
                <ul className="policy-list">
                  {rights.map(item => <li key={item}>{item}</li>)}
                </ul>
                <p>
                  Для реализации прав пользователь может направить запрос на <a href="mailto:vlad@lumiva.agency">vlad@lumiva.agency</a>. В запросе желательно указать имя, контакт для ответа, суть обращения и сведения, позволяющие идентифицировать обращение на сайте. Оператор вправе запросить дополнительную информацию, если без нее невозможно подтвердить связь заявителя с соответствующими данными.
                </p>
                <p>
                  При отзыве согласия Оператор прекращает обработку данных и уничтожает их в срок, установленный применимым законодательством, если данные больше не нужны для исполнения договора, защиты прав, бухгалтерского учета, соблюдения закона или иных законных оснований обработки.
                </p>
              </article>

              <article id="security" className="policy-block">
                <span className="policy-num">07</span>
                <h2>{t('privacy.sec07')}</h2>
                <p>
                  Оператор принимает необходимые правовые, организационные и технические меры для защиты персональных данных от неправомерного или случайного доступа, уничтожения, изменения, блокирования, копирования, предоставления, распространения и иных неправомерных действий.
                </p>
                <p>
                  В числе таких мер: ограничение доступа к данным по ролям, использование защищенных каналов связи, контроль доступа к системам, резервное копирование, журналирование событий, договорные обязательства о конфиденциальности с подрядчиками и регулярный пересмотр перечня используемых сервисов.
                </p>
              </article>

              <article id="contacts" className="policy-block">
                <span className="policy-num">08</span>
                <h2>{t('privacy.sec08')}</h2>
                <p>
                  Оператор может обновлять настоящую Политику при изменении сайта, сервисов, способов обработки данных, состава подрядчиков или законодательства. Актуальная редакция всегда размещается по адресу <a href="https://lumiva.agency/privacy-policy">https://lumiva.agency/privacy-policy</a>.
                </p>
                <div className="policy-contact-panel">
                  <div>
                    <span>По вопросам персональных данных</span>
                    <a href="mailto:vlad@lumiva.agency">vlad@lumiva.agency</a>
                  </div>
                  <div>
                    <span>Телефон</span>
                    <a href="tel:+905383659678">+90 538 365 96 78</a>
                  </div>
                </div>
                <p className="policy-note">
                  Настоящий документ является публичной политикой сайта и не заменяет индивидуальные договоры, соглашения, согласия и уведомления, которые могут оформляться при заказе услуг Lumiva Agency.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

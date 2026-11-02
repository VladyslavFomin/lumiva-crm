/* SEO-статьи основных страниц услуг (en / ru / tr). Без выдуманных цифр — только подход и состав работ. */
import type { SeoSet } from '../../components/lh/SeoArticle'

export const SEO_MAIN: SeoSet = {
  services: {
    en: {
      kick: 'Full-service agency',
      title: 'A full-service digital marketing agency in Antalya, working across Turkey and Europe',
      lead: 'Lumiva brings strategy, brand, websites, advertising, content, SEO, analytics and CRM under one contract. Instead of coordinating five vendors, you get one team that owns the result — from the first brief to the numbers in your dashboard.',
      facts: [['Languages we work in', 'EN · RU · TR'], ['Based in', 'Antalya, Turkey'], ['Engagement formats', 'Project · Retainer · Sprint']],
      parts: [
        { h: 'Why one team instead of several contractors', p: ['Most marketing problems appear at the joins: the agency running ads never sees the CRM, the web studio does not know which pages convert, the SMM team works without a content plan tied to sales. Every handover loses context, and nobody is accountable for revenue.', 'When strategy, creative, development and media sit in one team, decisions are made with the whole funnel in view. A change to an ad message is reflected on the landing page the same week; a drop in lead quality is visible in the CRM and discussed at the next sync.'] },
        { h: 'What a typical engagement looks like', p: ['We start with diagnostics: a short audit of your market, competitors, current channels and analytics. From there we agree on a roadmap with clear priorities and measurable milestones, then move in two-week sprints with a demo at the end of each one.'], ul: ['Discovery call and brief', 'Audit of channels, site and tracking', 'Strategy and roadmap you own', 'Sprints with regular demos', 'Monthly reporting and strategy review', 'Iterations based on real data'] },
        { h: 'Services you can combine', p: ['You can take a single service — for example an SEO audit or a new landing page — or a full stack. The most common combinations are brand + website + performance for launches, SEO + content + analytics for long-term organic growth, and performance + CRM for businesses that already have demand but lose leads between channels.'] },
        { h: 'Who we work with', p: ['We work with hotels and hospitality brands, e-commerce, B2B services, real estate and product companies — both local businesses in Antalya and international brands entering the Turkish market. Because the team works in English, Russian and Turkish, multilingual campaigns and sites are part of the normal workflow rather than an add-on.'] },
        { h: 'How we measure success', p: ['Every project has agreed KPIs before work starts: leads, cost per acquisition, ROAS, organic traffic, conversion rate or revenue — whatever matters for your business model. We set up tracking first, so results can be checked independently rather than taken on trust.'] },
      ],
    },
    ru: {
      kick: 'Агентство полного цикла',
      title: 'Digital-агентство полного цикла в Анталье: работаем по Турции и Европе',
      lead: 'Lumiva объединяет стратегию, бренд, сайты, рекламу, контент, SEO, аналитику и CRM в одном договоре. Вместо пяти подрядчиков — одна команда, которая отвечает за результат от первого брифа до цифр в дашборде.',
      facts: [['Языки работы', 'EN · RU · TR'], ['Офис', 'Анталья, Турция'], ['Форматы', 'Проект · Ретейнер · Спринт']],
      parts: [
        { h: 'Почему одна команда лучше нескольких подрядчиков', p: ['Большинство проблем маркетинга возникает на стыках: агентство, которое ведёт рекламу, не видит CRM, веб-студия не знает, какие страницы конвертируют, а SMM работает без контент-плана, связанного с продажами. На каждой передаче теряется контекст, и никто не отвечает за выручку.', 'Когда стратегия, креатив, разработка и медиа в одной команде, решения принимаются с учётом всей воронки. Изменение рекламного сообщения на той же неделе появляется на лендинге, а падение качества лидов видно в CRM и обсуждается на ближайшем созвоне.'] },
        { h: 'Как устроена работа', p: ['Начинаем с диагностики: короткий аудит рынка, конкурентов, текущих каналов и аналитики. Затем согласуем дорожную карту с приоритетами и измеримыми этапами и работаем двухнедельными спринтами с демонстрацией результата в конце каждого.'], ul: ['Вводный созвон и бриф', 'Аудит каналов, сайта и трекинга', 'Стратегия и дорожная карта', 'Спринты с регулярными демо', 'Ежемесячная отчётность и разбор стратегии', 'Итерации на основе реальных данных'] },
        { h: 'Услуги, которые можно комбинировать', p: ['Можно взять одну услугу — например, SEO-аудит или новый лендинг — или весь стек. Чаще всего комбинируют бренд + сайт + performance для запуска, SEO + контент + аналитику для долгого органического роста, performance + CRM для бизнеса, у которого спрос уже есть, но лиды теряются между каналами.'] },
        { h: 'С кем мы работаем', p: ['Отели и гостиничные бренды, e-commerce, B2B-сервисы, недвижимость и продуктовые компании — как локальный бизнес Антальи, так и международные бренды, выходящие на рынок Турции. Команда работает на русском, английском и турецком, поэтому мультиязычные кампании и сайты — обычная часть процесса, а не опция.'] },
        { h: 'Как мы измеряем успех', p: ['До старта работ согласуем KPI: лиды, стоимость привлечения, ROAS, органический трафик, конверсию или выручку — то, что важно для вашей модели. Сначала настраиваем аналитику, чтобы результат можно было проверить самостоятельно, а не принимать на веру.'] },
      ],
    },
    tr: {
      kick: 'Tam hizmet ajansı',
      title: "Antalya merkezli, Türkiye ve Avrupa'da çalışan tam hizmet dijital pazarlama ajansı",
      lead: 'Lumiva; strateji, marka, web sitesi, reklam, içerik, SEO, analitik ve CRM hizmetlerini tek sözleşmede birleştirir. Beş farklı tedarikçiyi koordine etmek yerine, ilk brief’ten panodaki rakamlara kadar sonuçtan sorumlu tek bir ekiple çalışırsınız.',
      facts: [['Çalışma dilleri', 'EN · RU · TR'], ['Merkez', 'Antalya, Türkiye'], ['Çalışma modelleri', 'Proje · Retainer · Sprint']],
      parts: [
        { h: 'Neden birkaç tedarikçi yerine tek ekip', p: ['Pazarlama sorunlarının çoğu birleşme noktalarında ortaya çıkar: reklamı yöneten ajans CRM’i görmez, web stüdyosu hangi sayfaların dönüştürdüğünü bilmez, sosyal medya ekibi satışla bağlantılı bir içerik planı olmadan çalışır. Her devirde bağlam kaybolur ve gelirden kimse sorumlu olmaz.', 'Strateji, kreatif, yazılım ve medya aynı ekipte olduğunda kararlar tüm huni göz önünde bulundurularak alınır. Reklam mesajındaki bir değişiklik aynı hafta açılış sayfasına yansır; lead kalitesindeki düşüş CRM’de görünür ve bir sonraki toplantıda ele alınır.'] },
        { h: 'Tipik bir iş birliği nasıl ilerler', p: ['Teşhisle başlarız: pazarınızın, rakiplerinizin, mevcut kanallarınızın ve analitiğinizin kısa bir denetimi. Ardından net öncelikler ve ölçülebilir aşamalar içeren bir yol haritası üzerinde anlaşır, her birinin sonunda demo yapılan iki haftalık sprintlerle ilerleriz.'], ul: ['Tanışma görüşmesi ve brief', 'Kanal, site ve takip denetimi', 'Size ait strateji ve yol haritası', 'Düzenli demolu sprintler', 'Aylık raporlama ve strateji değerlendirmesi', 'Gerçek verilere dayalı iterasyonlar'] },
        { h: 'Birleştirebileceğiniz hizmetler', p: ['Tek bir hizmet — örneğin SEO denetimi veya yeni bir açılış sayfası — ya da tüm paketi alabilirsiniz. En yaygın kombinasyonlar: lansmanlar için marka + web sitesi + performans, uzun vadeli organik büyüme için SEO + içerik + analitik ve talebi olan ama kanallar arasında lead kaybeden işletmeler için performans + CRM.'] },
        { h: 'Kimlerle çalışıyoruz', p: ['Oteller ve konaklama markaları, e-ticaret, B2B hizmetleri, gayrimenkul ve ürün şirketleriyle çalışıyoruz — hem Antalya’daki yerel işletmelerle hem de Türkiye pazarına giren uluslararası markalarla. Ekip İngilizce, Rusça ve Türkçe çalıştığı için çok dilli kampanyalar ve siteler ek bir hizmet değil, iş akışının doğal bir parçasıdır.'] },
        { h: 'Başarıyı nasıl ölçüyoruz', p: ['Her projenin KPI’ları iş başlamadan önce belirlenir: lead sayısı, edinme maliyeti, ROAS, organik trafik, dönüşüm oranı veya gelir — iş modeliniz için ne önemliyse. Önce takibi kurarız; böylece sonuçlar güvene dayalı değil, bağımsız olarak doğrulanabilir.'] },
      ],
    },
  },

  strategy: {
    en: {
      kick: 'Marketing strategy',
      title: 'Marketing strategy and research: a plan your team can actually execute',
      lead: 'A strategy is useful only if it changes what you do on Monday. We turn research on customers, competitors and channels into positioning, a channel mix and a roadmap with owners, budgets and measurable milestones.',
      parts: [
        { h: 'Research we start with', p: ['Before talking about channels we look at demand. Who buys, why they choose you, what they compare you with, and what stops them. We combine customer interviews, analytics and CRM data, search demand and a review of competitors’ messaging and offers.'], ul: ['Customer interviews and JTBD', 'Competitor and offer analysis', 'Search demand and market size', 'Analytics and CRM data review', 'Customer journey map (CJM)', 'Pricing and positioning check'] },
        { h: 'Positioning and value proposition', p: ['From research we build a positioning map: where the market is crowded, where there is white space, and which promise you can credibly own. The output is a short value proposition, key messages for each audience segment and proof points that support them.'] },
        { h: 'Channel mix and budget split', p: ['Not every business needs every channel. We estimate the role of each channel — search, social, SEO, partnerships, CRM — in your funnel, define the budget split and the order of launch, and agree which metrics will tell us whether a channel works.'] },
        { h: 'Roadmap and how we hand it over', p: ['The final deliverable is a roadmap rather than a presentation: tasks by quarter, owners, budgets, dependencies and KPIs. It can be executed by your team, by us, or together — and we review it monthly as real data comes in.'] },
      ],
    },
    ru: {
      kick: 'Маркетинговая стратегия',
      title: 'Маркетинговая стратегия и исследования: план, который команда реально выполнит',
      lead: 'Стратегия полезна, только если она меняет то, что вы делаете в понедельник. Мы превращаем исследование клиентов, конкурентов и каналов в позиционирование, набор каналов и дорожную карту с ответственными, бюджетами и измеримыми этапами.',
      parts: [
        { h: 'С каких исследований начинаем', p: ['Прежде чем говорить о каналах, смотрим на спрос: кто покупает, почему выбирает вас, с кем сравнивает и что его останавливает. Совмещаем интервью с клиентами, данные аналитики и CRM, поисковый спрос и разбор сообщений и офферов конкурентов.'], ul: ['Интервью с клиентами и JTBD', 'Анализ конкурентов и офферов', 'Поисковый спрос и объём рынка', 'Разбор данных аналитики и CRM', 'Карта пути клиента (CJM)', 'Проверка цены и позиционирования'] },
        { h: 'Позиционирование и ценностное предложение', p: ['По итогам исследования строим карту позиционирования: где рынок переполнен, где есть свободная ниша и какое обещание вы можете убедительно занять. Результат — короткое ценностное предложение, ключевые сообщения для каждого сегмента и доказательства, которые их подкрепляют.'] },
        { h: 'Набор каналов и распределение бюджета', p: ['Не каждому бизнесу нужны все каналы. Оцениваем роль каждого — поиск, соцсети, SEO, партнёрства, CRM — в вашей воронке, распределяем бюджет и порядок запуска и договариваемся, по каким метрикам поймём, работает ли канал.'] },
        { h: 'Дорожная карта и передача', p: ['Итог — не презентация, а дорожная карта: задачи по кварталам, ответственные, бюджеты, зависимости и KPI. Её может выполнять ваша команда, мы или мы вместе — и раз в месяц мы пересматриваем её по реальным данным.'] },
      ],
    },
    tr: {
      kick: 'Pazarlama stratejisi',
      title: 'Pazarlama stratejisi ve araştırma: ekibinizin gerçekten uygulayabileceği bir plan',
      lead: 'Strateji ancak pazartesi günü yaptığınız işi değiştiriyorsa faydalıdır. Müşteri, rakip ve kanal araştırmasını konumlandırmaya, kanal karmasına ve sorumluları, bütçeleri ve ölçülebilir aşamaları olan bir yol haritasına dönüştürüyoruz.',
      parts: [
        { h: 'Hangi araştırmalarla başlıyoruz', p: ['Kanallardan bahsetmeden önce talebe bakarız: kim satın alıyor, neden sizi seçiyor, sizi kiminle karşılaştırıyor ve onu ne durduruyor. Müşteri görüşmelerini, analitik ve CRM verilerini, arama talebini ve rakiplerin mesaj ve tekliflerinin incelemesini birleştiririz.'], ul: ['Müşteri görüşmeleri ve JTBD', 'Rakip ve teklif analizi', 'Arama talebi ve pazar büyüklüğü', 'Analitik ve CRM verisi incelemesi', 'Müşteri yolculuğu haritası (CJM)', 'Fiyat ve konumlandırma kontrolü'] },
        { h: 'Konumlandırma ve değer önerisi', p: ['Araştırmadan bir konumlandırma haritası çıkarırız: pazarın nerede kalabalık olduğu, nerede boşluk bulunduğu ve hangi vaadi inandırıcı şekilde sahiplenebileceğiniz. Sonuç; kısa bir değer önerisi, her segment için temel mesajlar ve bunları destekleyen kanıtlardır.'] },
        { h: 'Kanal karması ve bütçe dağılımı', p: ['Her işletmenin her kanala ihtiyacı yoktur. Her kanalın — arama, sosyal medya, SEO, ortaklıklar, CRM — hunideki rolünü değerlendirir, bütçe dağılımını ve başlatma sırasını belirler, bir kanalın işe yarayıp yaramadığını hangi metriklerle anlayacağımızı netleştiririz.'] },
        { h: 'Yol haritası ve teslim', p: ['Nihai çıktı bir sunum değil, yol haritasıdır: çeyreklere göre görevler, sorumlular, bütçeler, bağımlılıklar ve KPI’lar. Ekibiniz, biz veya birlikte uygulayabiliriz — ve gerçek veriler geldikçe her ay gözden geçiririz.'] },
      ],
    },
  },

  design: {
    en: {
      kick: 'Brand & design',
      title: 'Branding and design that is recognised at first glance — and sells',
      lead: 'Design is a business tool: it makes a company recognisable, explains the offer faster and makes every campaign cheaper to produce. We build identities and design systems that work equally well on a billboard, in Stories and inside a product.',
      parts: [
        { h: 'From strategy to identity', p: ['Every identity starts with positioning — what the brand stands for and who it speaks to. Only then do we move to naming, logo, colour, typography and graphic language. This keeps the visual system tied to the business goal instead of personal taste.'] },
        { h: 'What a brand system includes', ul: ['Logo and its variations', 'Colour palette and typography', 'Graphic elements and imagery style', 'Tone of voice basics', 'Templates for social and ads', 'Brandbook and usage rules'], p: ['We deliver source files and templates your team can use without a designer for routine tasks — social posts, presentations, ad banners.'] },
        { h: 'Digital-first design', p: ['Most brand touchpoints today are screens. We test the identity on websites, apps, social formats and small sizes from the first concepts, and build UI kits so that the website and product stay consistent with the brand.'] },
        { h: 'Rebranding without losing recognition', p: ['For existing businesses we audit what customers already associate with the brand and keep what works. A rebrand can be gradual — refreshing the system step by step — so you do not lose the recognition you have already paid for.'] },
      ],
    },
    ru: {
      kick: 'Бренд и дизайн',
      title: 'Брендинг и дизайн, которые узнают с первого взгляда — и которые продают',
      lead: 'Дизайн — это инструмент бизнеса: он делает компанию узнаваемой, быстрее объясняет предложение и удешевляет производство каждой кампании. Мы создаём айдентику и дизайн-системы, которые одинаково работают на билборде, в Stories и внутри продукта.',
      parts: [
        { h: 'От стратегии к айдентике', p: ['Любая айдентика начинается с позиционирования — за что выступает бренд и с кем он говорит. Только после этого переходим к неймингу, логотипу, цвету, типографике и графическому языку. Так визуальная система остаётся привязанной к бизнес-цели, а не к личному вкусу.'] },
        { h: 'Что входит в бренд-систему', ul: ['Логотип и его вариации', 'Палитра и типографика', 'Графические элементы и стиль изображений', 'Основы tone of voice', 'Шаблоны для соцсетей и рекламы', 'Брендбук и правила использования'], p: ['Передаём исходники и шаблоны, с которыми ваша команда справится без дизайнера в рутинных задачах — посты, презентации, баннеры.'] },
        { h: 'Дизайн для цифровой среды', p: ['Большинство контактов с брендом сегодня происходит на экранах. С первых концептов проверяем айдентику на сайтах, в приложениях, соцсетях и на маленьких размерах и собираем UI-кит, чтобы сайт и продукт оставались в одном стиле с брендом.'] },
        { h: 'Ребрендинг без потери узнаваемости', p: ['Для действующего бизнеса сначала выясняем, с чем клиенты уже связывают бренд, и сохраняем то, что работает. Ребрендинг может быть постепенным — систему обновляют шаг за шагом, — чтобы не потерять узнаваемость, за которую уже заплачено.'] },
      ],
    },
    tr: {
      kick: 'Marka ve tasarım',
      title: 'İlk bakışta tanınan — ve satış getiren — marka ve tasarım',
      lead: 'Tasarım bir iş aracıdır: şirketi tanınır kılar, teklifi daha hızlı anlatır ve her kampanyanın üretim maliyetini düşürür. Bir reklam panosunda, Stories’te ve ürünün içinde aynı şekilde çalışan kimlikler ve tasarım sistemleri kuruyoruz.',
      parts: [
        { h: 'Stratejiden kurumsal kimliğe', p: ['Her kimlik konumlandırmayla başlar — markanın neyi temsil ettiği ve kime hitap ettiği. Ancak bundan sonra isimlendirme, logo, renk, tipografi ve grafik dile geçeriz. Böylece görsel sistem kişisel zevke değil, iş hedefine bağlı kalır.'] },
        { h: 'Marka sistemi neleri içerir', ul: ['Logo ve varyasyonları', 'Renk paleti ve tipografi', 'Grafik öğeler ve görsel stili', 'Marka dili temelleri', 'Sosyal medya ve reklam şablonları', 'Marka kitabı ve kullanım kuralları'], p: ['Ekibinizin rutin işlerde — gönderiler, sunumlar, banner’lar — tasarımcı olmadan kullanabileceği kaynak dosyaları ve şablonları teslim ediyoruz.'] },
        { h: 'Dijital öncelikli tasarım', p: ['Bugün marka temas noktalarının çoğu ekranlardır. Kimliği ilk konseptlerden itibaren web sitelerinde, uygulamalarda, sosyal formatlarda ve küçük boyutlarda test eder, web sitesi ve ürünün markayla tutarlı kalması için UI kitleri oluştururuz.'] },
        { h: 'Tanınırlığı kaybetmeden yeniden markalaşma', p: ['Mevcut işletmeler için önce müşterilerin markayla neyi ilişkilendirdiğini inceler ve işe yarayanı koruruz. Yeniden markalaşma kademeli olabilir — sistem adım adım yenilenir — böylece zaten bedelini ödediğiniz tanınırlığı kaybetmezsiniz.'] },
      ],
    },
  },

  development: {
    en: {
      kick: 'Web & product development',
      title: 'Website and digital product development: fast, SEO-ready and built to convert',
      lead: 'A website is a sales channel, not a business card. We design and build corporate sites, landing pages, e-commerce, SaaS and configurators with performance, SEO and analytics built in from day one — and keep improving them after launch.',
      parts: [
        { h: 'How we approach a project', p: ['Each project begins with the goal of the site and the path a visitor takes to a lead or purchase. We prototype the structure, test the key screens, and only then move to visual design and development. This avoids expensive redesigns after launch.'] },
        { h: 'Technology', p: ['We choose the stack for the task: React and Next.js for fast, scalable sites and products, headless CMS for teams that publish often, Webflow or WordPress where an editor-friendly setup matters more, and native or cross-platform frameworks for mobile apps.'], ul: ['React · Next.js · TypeScript', 'Headless CMS and WordPress', 'E-commerce and payment gateways', 'CRM and API integrations', 'Mobile apps', 'DevOps, hosting and monitoring'] },
        { h: 'Performance and SEO from the start', p: ['Core Web Vitals, clean semantics, structured data, multilingual hreflang and server-side rendering are part of the build, not a later audit. Analytics events and CRM integration are configured before launch so that every form submission and purchase is tracked.'] },
        { h: 'After launch', p: ['A launch is the start of the work. We run A/B tests on key pages, monitor speed and errors, and iterate based on analytics. Support can be ongoing under a retainer or on request.'] },
      ],
    },
    ru: {
      kick: 'Разработка сайтов и продуктов',
      title: 'Разработка сайтов и цифровых продуктов: быстро, с SEO и под конверсию',
      lead: 'Сайт — это канал продаж, а не визитка. Мы проектируем и разрабатываем корпоративные сайты, лендинги, интернет-магазины, SaaS и конфигураторы со скоростью, SEO и аналитикой с первого дня — и продолжаем улучшать их после запуска.',
      parts: [
        { h: 'Как мы подходим к проекту', p: ['Каждый проект начинается с цели сайта и пути посетителя к заявке или покупке. Прототипируем структуру, тестируем ключевые экраны и только потом переходим к визуалу и разработке. Это избавляет от дорогих переделок после запуска.'] },
        { h: 'Технологии', p: ['Стек подбираем под задачу: React и Next.js для быстрых масштабируемых сайтов и продуктов, headless CMS для команд, которые часто публикуют, Webflow или WordPress, где важнее удобство редактора, нативные или кроссплатформенные фреймворки для мобильных приложений.'], ul: ['React · Next.js · TypeScript', 'Headless CMS и WordPress', 'Интернет-магазины и платёжные шлюзы', 'Интеграции с CRM и API', 'Мобильные приложения', 'DevOps, хостинг и мониторинг'] },
        { h: 'Скорость и SEO с самого начала', p: ['Core Web Vitals, чистая семантика, микроразметка, мультиязычный hreflang и серверный рендеринг — часть разработки, а не будущего аудита. События аналитики и интеграция с CRM настраиваются до запуска, чтобы каждая заявка и покупка отслеживались.'] },
        { h: 'После запуска', p: ['Запуск — это начало работы. Проводим A/B-тесты ключевых страниц, следим за скоростью и ошибками и дорабатываем сайт по данным аналитики. Поддержка возможна по ретейнеру или по запросу.'] },
      ],
    },
    tr: {
      kick: 'Web ve ürün geliştirme',
      title: 'Web sitesi ve dijital ürün geliştirme: hızlı, SEO’ya hazır ve dönüşüm odaklı',
      lead: 'Web sitesi bir kartvizit değil, satış kanalıdır. Kurumsal siteler, açılış sayfaları, e-ticaret, SaaS ve yapılandırıcıları ilk günden performans, SEO ve analitik ile tasarlayıp geliştiriyor, lansmandan sonra da iyileştirmeye devam ediyoruz.',
      parts: [
        { h: 'Projeye nasıl yaklaşıyoruz', p: ['Her proje sitenin hedefi ve ziyaretçinin lead’e veya satın almaya giden yoluyla başlar. Yapıyı prototipler, ana ekranları test eder, ancak bundan sonra görsel tasarıma ve geliştirmeye geçeriz. Bu, lansman sonrası pahalı yeniden tasarımları önler.'] },
        { h: 'Teknoloji', p: ['Teknoloji yığınını işe göre seçeriz: hızlı ve ölçeklenebilir siteler ve ürünler için React ve Next.js, sık yayın yapan ekipler için headless CMS, editör kolaylığının daha önemli olduğu yerlerde Webflow veya WordPress, mobil uygulamalar için native veya çapraz platform çerçeveler.'], ul: ['React · Next.js · TypeScript', 'Headless CMS ve WordPress', 'E-ticaret ve ödeme altyapıları', 'CRM ve API entegrasyonları', 'Mobil uygulamalar', 'DevOps, barındırma ve izleme'] },
        { h: 'Baştan itibaren performans ve SEO', p: ['Core Web Vitals, temiz semantik, yapılandırılmış veri, çok dilli hreflang ve sunucu tarafı oluşturma, sonraki bir denetimin değil, geliştirmenin parçasıdır. Analitik olayları ve CRM entegrasyonu lansmandan önce kurulur; böylece her form gönderimi ve satın alma takip edilir.'] },
        { h: 'Lansmandan sonra', p: ['Lansman işin başlangıcıdır. Ana sayfalarda A/B testleri yapar, hız ve hataları izler, analitiğe göre iyileştiririz. Destek retainer ile sürekli veya talep üzerine olabilir.'] },
      ],
    },
  },

  performance: {
    en: {
      kick: 'Performance marketing',
      title: 'Performance marketing: paid traffic that pays back',
      lead: 'Running ads is easy; making them profitable is not. We build performance campaigns around unit economics — what a lead or a sale may cost — and connect ad platforms with analytics and CRM so budget goes to what actually brings revenue.',
      parts: [
        { h: 'Channels we work with', p: ['We plan the media mix around where your customers search and scroll, not around one favourite platform.'], ul: ['Google Ads: Search, PMax, YouTube', 'Meta Ads: Facebook and Instagram', 'Yandex Direct', 'Programmatic and display', 'Remarketing and lookalike audiences', 'CRM-based audiences'] },
        { h: 'From click to revenue', p: ['A campaign optimised for clicks can look great and lose money. We set up conversion tracking, offline conversions from the CRM and value-based bidding where possible, so the platforms learn from leads that turn into sales rather than from any form submission.'] },
        { h: 'Creative and landing pages', p: ['Ad performance depends as much on the message and the landing page as on targeting. Our designers and developers work in the same team, so new creatives and landing variants are produced and tested in the same sprint.'] },
        { h: 'Reporting you can trust', p: ['You get a dashboard with spend, leads, cost per acquisition and ROAS by channel and campaign, plus a monthly review of what we changed, why, and what we plan next. Accounts are created in your name, so you keep full access and history.'] },
      ],
    },
    ru: {
      kick: 'Performance-маркетинг',
      title: 'Performance-маркетинг: платный трафик, который окупается',
      lead: 'Запустить рекламу легко, сделать её прибыльной — нет. Мы строим кампании от юнит-экономики — сколько может стоить лид или продажа — и связываем рекламные кабинеты с аналитикой и CRM, чтобы бюджет шёл туда, где реально появляется выручка.',
      parts: [
        { h: 'Каналы', p: ['Медиамикс планируем исходя из того, где ваши клиенты ищут и листают ленту, а не из любимой платформы.'], ul: ['Google Ads: поиск, PMax, YouTube', 'Meta Ads: Facebook и Instagram', 'Яндекс Директ', 'Programmatic и медийная реклама', 'Ремаркетинг и look-alike', 'Аудитории из CRM'] },
        { h: 'От клика к выручке', p: ['Кампания, оптимизированная на клики, может выглядеть отлично и терять деньги. Настраиваем отслеживание конверсий, офлайн-конверсии из CRM и ставки по ценности там, где это возможно, чтобы площадки обучались на лидах, которые становятся продажами, а не на любых заявках.'] },
        { h: 'Креативы и посадочные страницы', p: ['Эффективность рекламы зависит от сообщения и посадочной не меньше, чем от таргетинга. Дизайнеры и разработчики в одной команде с медиабайерами, поэтому новые креативы и варианты лендингов создаются и тестируются в одном спринте.'] },
        { h: 'Отчётность, которой можно доверять', p: ['Вы получаете дашборд с расходом, лидами, стоимостью привлечения и ROAS по каналам и кампаниям и ежемесячный разбор: что изменили, почему и что планируем дальше. Кабинеты создаются на ваше имя — полный доступ и история остаются у вас.'] },
      ],
    },
    tr: {
      kick: 'Performans pazarlaması',
      title: 'Performans pazarlaması: kendini geri ödeyen ücretli trafik',
      lead: 'Reklam yayınlamak kolaydır; kârlı hale getirmek değil. Kampanyaları birim ekonomisine göre — bir lead’in veya satışın ne kadara mal olabileceğine göre — kurar, reklam platformlarını analitik ve CRM ile bağlarız; böylece bütçe gerçekten gelir getiren yere gider.',
      parts: [
        { h: 'Çalıştığımız kanallar', p: ['Medya karmasını tek bir favori platforma göre değil, müşterilerinizin arama yaptığı ve gezindiği yerlere göre planlarız.'], ul: ['Google Ads: Arama, PMax, YouTube', 'Meta Ads: Facebook ve Instagram', 'Yandex Direct', 'Programatik ve görüntülü reklam', 'Yeniden pazarlama ve benzer kitleler', 'CRM tabanlı kitleler'] },
        { h: 'Tıklamadan gelire', p: ['Tıklamaya göre optimize edilmiş bir kampanya harika görünüp para kaybedebilir. Dönüşüm takibini, CRM’den çevrimdışı dönüşümleri ve mümkün olan yerlerde değere dayalı teklif vermeyi kurarız; böylece platformlar herhangi bir form gönderiminden değil, satışa dönüşen lead’lerden öğrenir.'] },
        { h: 'Kreatif ve açılış sayfaları', p: ['Reklam performansı hedeflemeden olduğu kadar mesaja ve açılış sayfasına da bağlıdır. Tasarımcılarımız ve geliştiricilerimiz aynı ekipte çalışır; yeni kreatifler ve sayfa varyantları aynı sprintte üretilip test edilir.'] },
        { h: 'Güvenebileceğiniz raporlama', p: ['Kanal ve kampanya bazında harcama, lead, edinme maliyeti ve ROAS gösteren bir pano ile neyi neden değiştirdiğimizi ve sırada ne olduğunu anlatan aylık bir değerlendirme alırsınız. Hesaplar sizin adınıza açılır; tam erişim ve geçmiş sizde kalır.'] },
      ],
    },
  },

  content: {
    en: {
      kick: 'Content production',
      title: 'Content production: photo, video and motion made in-house',
      lead: 'Content is what people actually see of your brand. We plan, shoot and edit photo, video and motion content in-house — from concept and script to post-production and formats for every platform.',
      parts: [
        { h: 'What we produce', ul: ['Brand and product videos', 'Reels, Shorts and TikTok formats', 'Product and lifestyle photography', 'Motion design and animation', '3D visuals', 'Ad creatives for A/B tests'], p: ['Every shoot is planned so one production day yields material for several channels and weeks of publishing.'] },
        { h: 'Concept first', p: ['A good video starts with a clear idea and a script tied to a business task: explaining a product, building trust, or driving a booking. We agree the concept, storyboard and shot list before the shoot, so there are no surprises in the edit.'] },
        { h: 'Content that works with ads and SEO', p: ['Because content, performance and SEO teams work together, creatives are produced with testing in mind: several hooks, formats and lengths. Video and images are optimised for the web — compressed, captioned and marked up — so they help search visibility instead of slowing the site down.'] },
      ],
    },
    ru: {
      kick: 'Производство контента',
      title: 'Производство контента: фото, видео и моушн своими силами',
      lead: 'Контент — это то, что люди действительно видят от вашего бренда. Мы планируем, снимаем и монтируем фото, видео и моушн сами — от концепции и сценария до постпродакшна и форматов для каждой площадки.',
      parts: [
        { h: 'Что мы производим', ul: ['Имиджевые и продуктовые ролики', 'Reels, Shorts и TikTok-форматы', 'Предметная и lifestyle-съёмка', 'Моушн-дизайн и анимация', '3D-визуализация', 'Рекламные креативы для A/B-тестов'], p: ['Каждую съёмку планируем так, чтобы один съёмочный день давал материал для нескольких каналов и недель публикаций.'] },
        { h: 'Сначала концепция', p: ['Хорошее видео начинается с понятной идеи и сценария, привязанного к бизнес-задаче: объяснить продукт, вызвать доверие или привести к бронированию. Концепцию, раскадровку и список кадров согласуем до съёмки — без сюрпризов на монтаже.'] },
        { h: 'Контент, который работает с рекламой и SEO', p: ['Контент, performance и SEO работают в одной команде, поэтому креативы сразу делаются под тесты: несколько хуков, форматов и хронометражей. Видео и изображения оптимизируем для сайта — сжатие, субтитры, разметка, — чтобы они помогали поисковой видимости, а не замедляли страницы.'] },
      ],
    },
    tr: {
      kick: 'İçerik üretimi',
      title: 'İçerik üretimi: şirket içinde fotoğraf, video ve motion',
      lead: 'İçerik, insanların markanızdan gerçekten gördüğü şeydir. Fotoğraf, video ve motion içeriklerini konsept ve senaryodan post prodüksiyona ve her platformun formatına kadar kendi ekibimizle planlıyor, çekiyor ve kurguluyoruz.',
      parts: [
        { h: 'Neler üretiyoruz', ul: ['Marka ve ürün videoları', 'Reels, Shorts ve TikTok formatları', 'Ürün ve yaşam tarzı fotoğrafçılığı', 'Motion tasarım ve animasyon', '3D görseller', 'A/B testleri için reklam kreatifleri'], p: ['Her çekimi, tek bir prodüksiyon gününün birkaç kanal ve haftalarca yayın için malzeme sağlayacağı şekilde planlarız.'] },
        { h: 'Önce konsept', p: ['İyi bir video, bir iş hedefine bağlı net bir fikir ve senaryoyla başlar: ürünü anlatmak, güven oluşturmak veya rezervasyona yönlendirmek. Konsepti, storyboard’u ve çekim listesini çekimden önce netleştiririz; kurguda sürpriz olmaz.'] },
        { h: 'Reklam ve SEO ile çalışan içerik', p: ['İçerik, performans ve SEO ekipleri birlikte çalıştığı için kreatifler test düşünülerek üretilir: birkaç kanca, format ve süre. Video ve görseller web için optimize edilir — sıkıştırma, altyazı, işaretleme — böylece siteyi yavaşlatmak yerine arama görünürlüğüne katkı sağlar.'] },
      ],
    },
  },

  smm: {
    en: {
      kick: 'SMM & communities',
      title: 'Social media marketing that turns followers into customers',
      lead: 'Reach is only useful if it leads somewhere. We build social media around a content strategy tied to sales: clear rubrics, consistent visuals, community management and paid promotion — on Instagram, Telegram, YouTube and TikTok.',
      parts: [
        { h: 'What is included', ul: ['Content strategy and rubrics', 'Monthly content plan', 'Design, copy and video for posts', 'Community management and replies', 'Paid promotion of posts', 'Influencer and partner campaigns'] },
        { h: 'Strategy before posting', p: ['We define the role of each platform for your audience: discovery, trust, retention or direct sales. The content plan mixes educational, social-proof and offer posts in proportions that match that role, and every rubric has a measurable goal.'] },
        { h: 'From engagement to leads', p: ['Social channels are connected to the rest of the funnel: links with UTM tags, messenger lead forms and CRM integration show which posts and campaigns bring enquiries, not just likes. Monthly reports cover reach, engagement, followers and — most importantly — leads and sales from social.'] },
      ],
    },
    ru: {
      kick: 'SMM и сообщества',
      title: 'SMM, который превращает подписчиков в клиентов',
      lead: 'Охват полезен, только если он куда-то ведёт. Мы строим соцсети вокруг контент-стратегии, связанной с продажами: понятные рубрики, единый визуал, работа с сообществом и продвижение — в Instagram, Telegram, YouTube и TikTok.',
      parts: [
        { h: 'Что входит', ul: ['Контент-стратегия и рубрикатор', 'Контент-план на месяц', 'Дизайн, тексты и видео для постов', 'Модерация и ответы подписчикам', 'Продвижение публикаций', 'Работа с блогерами и партнёрами'] },
        { h: 'Сначала стратегия, потом посты', p: ['Определяем роль каждой площадки для вашей аудитории: знакомство, доверие, удержание или прямые продажи. Контент-план сочетает обучающие посты, социальные доказательства и офферы в пропорциях, которые соответствуют этой роли, а у каждой рубрики есть измеримая цель.'] },
        { h: 'От вовлечения к заявкам', p: ['Соцсети связаны с остальной воронкой: ссылки с UTM-метками, формы заявок в мессенджерах и интеграция с CRM показывают, какие посты и кампании приводят обращения, а не только лайки. В ежемесячном отчёте — охват, вовлечённость, подписчики и главное — заявки и продажи из соцсетей.'] },
      ],
    },
    tr: {
      kick: 'SMM ve topluluklar',
      title: 'Takipçileri müşteriye dönüştüren sosyal medya pazarlaması',
      lead: 'Erişim ancak bir yere götürüyorsa işe yarar. Sosyal medyayı satışla bağlantılı bir içerik stratejisi etrafında kuruyoruz: net içerik başlıkları, tutarlı görseller, topluluk yönetimi ve ücretli tanıtım — Instagram, Telegram, YouTube ve TikTok’ta.',
      parts: [
        { h: 'Neler dahil', ul: ['İçerik stratejisi ve başlıklar', 'Aylık içerik planı', 'Gönderiler için tasarım, metin ve video', 'Topluluk yönetimi ve yanıtlar', 'Gönderilerin ücretli tanıtımı', 'Influencer ve iş ortağı kampanyaları'] },
        { h: 'Paylaşımdan önce strateji', p: ['Her platformun kitleniz için rolünü belirleriz: keşif, güven, sadakat veya doğrudan satış. İçerik planı eğitici, sosyal kanıt ve teklif gönderilerini bu role uygun oranlarda birleştirir ve her başlığın ölçülebilir bir hedefi vardır.'] },
        { h: 'Etkileşimden lead’e', p: ['Sosyal kanallar huninin geri kalanına bağlıdır: UTM etiketli bağlantılar, mesajlaşma lead formları ve CRM entegrasyonu hangi gönderi ve kampanyaların sadece beğeni değil, talep getirdiğini gösterir. Aylık raporlar erişimi, etkileşimi, takipçileri ve en önemlisi sosyal medyadan gelen lead ve satışları kapsar.'] },
      ],
    },
  },

  seo: {
    en: {
      kick: 'SEO & organic growth',
      title: 'SEO services: organic traffic that grows without paying per click',
      lead: 'SEO is the channel that keeps working after the budget is spent. We combine technical SEO, a well-structured semantic core, content and authority building into one programme — and measure it in leads and revenue, not just positions.',
      facts: [['Search engines', 'Google · Yandex'], ['Markets', 'Turkey · Europe · CIS'], ['Languages', 'EN · RU · TR']],
      parts: [
        { h: 'Technical SEO', p: ['Rankings start with a site search engines can crawl, render and understand. We audit indexation, site structure, Core Web Vitals, mobile usability, structured data, redirects and duplicate content, then fix issues in order of impact — often together with our developers.'] },
        { h: 'Semantic core and site structure', p: ['We collect and cluster search queries by intent: informational, commercial and local. Each cluster gets a target page, which shapes the site structure, internal linking and content plan. For multilingual sites we research each language separately rather than translating keywords.'], ul: ['Keyword research and clustering', 'Search intent mapping', 'Landing and category pages', 'Internal linking', 'Hreflang for EN / RU / TR', 'Local SEO and Google Business Profile'] },
        { h: 'Content and authority', p: ['Pages rank when they answer the query better than competitors. We write and optimise service pages, category pages and articles, and build links through outreach, partnerships and digital PR — focusing on relevant, real websites.'] },
        { h: 'Reporting and timelines', p: ['Technical fixes usually show impact first; competitive commercial queries take longer. You get regular reports on visibility, organic traffic, conversions from search and the work completed. We do not promise specific positions — no honest agency can — but we do commit to a transparent plan and measurable progress.'] },
      ],
    },
    ru: {
      kick: 'SEO и органический рост',
      title: 'SEO-продвижение: органический трафик без оплаты за клик',
      lead: 'SEO — канал, который продолжает работать после того, как бюджет потрачен. Мы объединяем техническое SEO, продуманное семантическое ядро, контент и наращивание авторитета в одну программу — и измеряем её в заявках и выручке, а не только в позициях.',
      facts: [['Поисковые системы', 'Google · Яндекс'], ['Рынки', 'Турция · Европа · СНГ'], ['Языки', 'EN · RU · TR']],
      parts: [
        { h: 'Техническое SEO', p: ['Позиции начинаются с сайта, который поисковики могут обойти, отрисовать и понять. Проверяем индексацию, структуру, Core Web Vitals, мобильную версию, микроразметку, редиректы и дубли и исправляем проблемы по степени влияния — часто вместе с нашими разработчиками.'] },
        { h: 'Семантическое ядро и структура сайта', p: ['Собираем и кластеризуем запросы по интенту: информационные, коммерческие и локальные. Для каждого кластера — целевая страница; это определяет структуру сайта, перелинковку и контент-план. Для мультиязычных сайтов исследуем каждый язык отдельно, а не переводим ключевые слова.'], ul: ['Сбор и кластеризация запросов', 'Карта поисковых интентов', 'Посадочные и категорийные страницы', 'Внутренняя перелинковка', 'Hreflang для EN / RU / TR', 'Локальное SEO и Google Business Profile'] },
        { h: 'Контент и авторитет', p: ['Страница растёт, когда отвечает на запрос лучше конкурентов. Пишем и оптимизируем страницы услуг, категорий и статьи, наращиваем ссылки через аутрич, партнёрства и digital PR — только на релевантных живых сайтах.'] },
        { h: 'Отчётность и сроки', p: ['Первыми обычно срабатывают технические исправления; конкурентные коммерческие запросы требуют больше времени. Вы регулярно получаете отчёт о видимости, органическом трафике, конверсиях из поиска и выполненных работах. Мы не обещаем конкретных позиций — честно этого не может сделать никто, — но гарантируем прозрачный план и измеримый прогресс.'] },
      ],
    },
    tr: {
      kick: 'SEO ve organik büyüme',
      title: 'SEO hizmetleri: tıklama başına ödeme yapmadan büyüyen organik trafik',
      lead: 'SEO, bütçe harcandıktan sonra da çalışmaya devam eden kanaldır. Teknik SEO’yu, iyi yapılandırılmış bir anahtar kelime çekirdeğini, içeriği ve otorite oluşturmayı tek bir programda birleştiriyor ve bunu yalnızca sıralamalarla değil, lead ve gelirle ölçüyoruz.',
      facts: [['Arama motorları', 'Google · Yandex'], ['Pazarlar', 'Türkiye · Avrupa · BDT'], ['Diller', 'EN · RU · TR']],
      parts: [
        { h: 'Teknik SEO', p: ['Sıralamalar, arama motorlarının tarayabildiği, işleyebildiği ve anlayabildiği bir siteyle başlar. Dizine eklenmeyi, site yapısını, Core Web Vitals’ı, mobil kullanılabilirliği, yapılandırılmış veriyi, yönlendirmeleri ve yinelenen içeriği denetler, sorunları etki sırasına göre — çoğu zaman geliştiricilerimizle birlikte — düzeltiriz.'] },
        { h: 'Anahtar kelime çekirdeği ve site yapısı', p: ['Arama sorgularını amaca göre toplar ve kümeleriz: bilgi amaçlı, ticari ve yerel. Her küme bir hedef sayfa alır; bu da site yapısını, iç bağlantıları ve içerik planını şekillendirir. Çok dilli sitelerde anahtar kelimeleri çevirmek yerine her dili ayrı araştırırız.'], ul: ['Anahtar kelime araştırması ve kümeleme', 'Arama amacı haritası', 'Açılış ve kategori sayfaları', 'İç bağlantı yapısı', 'EN / RU / TR için hreflang', 'Yerel SEO ve Google İşletme Profili'] },
        { h: 'İçerik ve otorite', p: ['Sayfalar, sorguyu rakiplerden daha iyi yanıtladığında yükselir. Hizmet ve kategori sayfalarını ve makaleleri yazar ve optimize eder; erişim, ortaklıklar ve dijital PR ile — yalnızca ilgili, gerçek sitelerde — bağlantı kazanırız.'] },
        { h: 'Raporlama ve süreler', p: ['Genellikle önce teknik düzeltmeler etki gösterir; rekabetçi ticari sorgular daha uzun sürer. Görünürlük, organik trafik, aramadan gelen dönüşümler ve tamamlanan işler hakkında düzenli rapor alırsınız. Belirli sıralamalar vaat etmiyoruz — dürüst hiçbir ajans edemez — ama şeffaf bir plan ve ölçülebilir ilerleme taahhüt ediyoruz.'] },
      ],
    },
  },

  analytics: {
    en: {
      kick: 'Marketing analytics',
      title: 'Marketing analytics: know which channel brings revenue',
      lead: 'Without analytics, marketing budgets are spent on opinions. We set up tracking from the first click to the paid invoice, build dashboards that answer business questions and help your team make decisions from data rather than from the loudest voice in the room.',
      parts: [
        { h: 'Tracking setup', p: ['We audit what is tracked today, design an event plan and implement it across the website, ad platforms and CRM. That includes GA4, Yandex Metrica, Google Tag Manager, conversion APIs and UTM conventions, with consent handled correctly.'], ul: ['Tracking audit and event plan', 'GA4 and Yandex Metrica', 'Google Tag Manager', 'Server-side and conversion APIs', 'UTM conventions', 'CRM and offline conversions'] },
        { h: 'End-to-end analytics', p: ['The key step is connecting marketing data with sales. When leads and deals from the CRM are linked to their source campaign, you can see cost per sale and ROAS by channel — and stop paying for traffic that never buys.'] },
        { h: 'Dashboards and reports', p: ['We build dashboards in Looker Studio or inside Lumiva CRM for the questions you actually ask: how much did a lead cost this month, which campaign brings the best customers, where the funnel drops. Each report has an owner and a review rhythm, so it is used, not just built.'] },
      ],
    },
    ru: {
      kick: 'Маркетинговая аналитика',
      title: 'Маркетинговая аналитика: видно, какой канал приносит выручку',
      lead: 'Без аналитики маркетинговый бюджет тратится на мнения. Мы настраиваем отслеживание от первого клика до оплаченного счёта, строим дашборды, которые отвечают на вопросы бизнеса, и помогаем команде принимать решения по данным, а не по самому громкому голосу.',
      parts: [
        { h: 'Настройка отслеживания', p: ['Проверяем, что отслеживается сейчас, проектируем план событий и внедряем его на сайте, в рекламных кабинетах и CRM: GA4, Яндекс Метрика, Google Tag Manager, Conversion API и правила UTM-разметки с корректной обработкой согласия на cookies.'], ul: ['Аудит трекинга и план событий', 'GA4 и Яндекс Метрика', 'Google Tag Manager', 'Server-side и Conversion API', 'Правила UTM-разметки', 'CRM и офлайн-конверсии'] },
        { h: 'Сквозная аналитика', p: ['Ключевой шаг — связать маркетинговые данные с продажами. Когда лиды и сделки из CRM привязаны к рекламной кампании-источнику, видна стоимость продажи и ROAS по каналам — и можно перестать платить за трафик, который никогда не покупает.'] },
        { h: 'Дашборды и отчёты', p: ['Строим дашборды в Looker Studio или внутри Lumiva CRM под вопросы, которые вы действительно задаёте: сколько стоил лид в этом месяце, какая кампания приводит лучших клиентов, где проседает воронка. У каждого отчёта есть ответственный и ритм просмотра — чтобы им пользовались, а не просто построили.'] },
      ],
    },
    tr: {
      kick: 'Pazarlama analitiği',
      title: 'Pazarlama analitiği: hangi kanalın gelir getirdiğini bilin',
      lead: 'Analitik olmadan pazarlama bütçeleri fikirlere harcanır. İlk tıklamadan ödenen faturaya kadar takibi kuruyor, iş sorularını yanıtlayan panolar oluşturuyor ve ekibinizin kararları odadaki en yüksek sese göre değil, verilere göre almasına yardımcı oluyoruz.',
      parts: [
        { h: 'Takip kurulumu', p: ['Bugün neyin takip edildiğini denetler, bir olay planı tasarlar ve bunu web sitesi, reklam platformları ve CRM genelinde uygularız: GA4, Yandex Metrica, Google Tag Manager, dönüşüm API’leri ve çerez onayının doğru yönetildiği UTM kuralları.'], ul: ['Takip denetimi ve olay planı', 'GA4 ve Yandex Metrica', 'Google Tag Manager', 'Sunucu tarafı ve dönüşüm API’leri', 'UTM kuralları', 'CRM ve çevrimdışı dönüşümler'] },
        { h: 'Uçtan uca analitik', p: ['Kilit adım, pazarlama verilerini satışla bağlamaktır. CRM’deki lead ve satışlar kaynak kampanyaya bağlandığında kanal bazında satış başına maliyeti ve ROAS’ı görebilir, hiç satın almayan trafik için ödeme yapmayı bırakabilirsiniz.'] },
        { h: 'Panolar ve raporlar', p: ['Gerçekten sorduğunuz sorular için Looker Studio’da veya Lumiva CRM içinde panolar kurarız: bu ay bir lead’in maliyeti ne kadardı, hangi kampanya en iyi müşterileri getiriyor, huni nerede düşüyor. Her raporun bir sorumlusu ve inceleme ritmi vardır; böylece sadece kurulmaz, kullanılır.'] },
      ],
    },
  },
}

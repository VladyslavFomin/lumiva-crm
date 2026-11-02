/* SEO-статьи подстраниц разработки (en / ru / tr). */
import type { SeoSet } from '../../components/lh/SeoArticle'

export const SEO_DEV: SeoSet = {
  'corporate-sites': {
    en: { kick: 'Corporate websites', title: 'Corporate website development that supports sales and reputation', lead: 'A corporate site has to do two jobs: build trust and bring enquiries. We design and build multilingual corporate websites with a CMS your team can manage, SEO-ready structure and CRM integration.', parts: [
      { h: 'What is included', ul: ['Research and site structure', 'UX prototypes and design', 'Development and CMS', 'Multilingual versions (EN / RU / TR)', 'Forms, analytics and CRM integration', 'Launch, hosting and support'] },
      { h: 'Built for search from day one', p: ['Clean URLs, fast loading, structured data and hreflang are part of the build, so the site can rank for your services and locations without a separate rescue project later.'] },
      { h: 'Easy to manage', p: ['Content editors can update pages, news and vacancies themselves. We train your team and stay available for changes and improvements after launch.'] },
    ] },
    ru: { kick: 'Корпоративные сайты', title: 'Разработка корпоративного сайта, который помогает продажам и репутации', lead: 'У корпоративного сайта две задачи: вызывать доверие и приводить обращения. Мы проектируем и разрабатываем мультиязычные корпоративные сайты с удобной CMS, SEO-структурой и интеграцией с CRM.', parts: [
      { h: 'Что входит', ul: ['Исследование и структура сайта', 'UX-прототипы и дизайн', 'Разработка и CMS', 'Языковые версии (EN / RU / TR)', 'Формы, аналитика и интеграция с CRM', 'Запуск, хостинг и поддержка'] },
      { h: 'Готов к поиску с первого дня', p: ['Чистые URL, быстрая загрузка, микроразметка и hreflang — часть разработки, поэтому сайт может ранжироваться по вашим услугам и городам без отдельного проекта по «спасению» потом.'] },
      { h: 'Удобно управлять', p: ['Редакторы сами обновляют страницы, новости и вакансии. Мы обучаем команду и остаёмся на связи для правок и доработок после запуска.'] },
    ] },
    tr: { kick: 'Kurumsal web siteleri', title: 'Satışı ve itibarı destekleyen kurumsal web sitesi geliştirme', lead: 'Kurumsal bir sitenin iki görevi vardır: güven oluşturmak ve talep getirmek. Ekibinizin yönetebileceği bir CMS, SEO’ya hazır yapı ve CRM entegrasyonu ile çok dilli kurumsal web siteleri tasarlayıp geliştiriyoruz.', parts: [
      { h: 'Neler dahil', ul: ['Araştırma ve site yapısı', 'UX prototipleri ve tasarım', 'Geliştirme ve CMS', 'Çok dilli sürümler (EN / RU / TR)', 'Formlar, analitik ve CRM entegrasyonu', 'Lansman, barındırma ve destek'] },
      { h: 'İlk günden aramaya hazır', p: ['Temiz URL’ler, hızlı yükleme, yapılandırılmış veri ve hreflang geliştirmenin parçasıdır; böylece site, sonradan ayrı bir kurtarma projesine gerek kalmadan hizmetleriniz ve lokasyonlarınız için sıralanabilir.'] },
      { h: 'Kolay yönetim', p: ['İçerik editörleri sayfaları, haberleri ve iş ilanlarını kendileri güncelleyebilir. Ekibinizi eğitir, lansmandan sonra değişiklikler ve iyileştirmeler için ulaşılabilir kalırız.'] },
    ] },
  },
  ecommerce: {
    en: { kick: 'E-commerce', title: 'Online store development connected to your warehouse, payments and CRM', lead: 'An online store is only as good as its operations. We build e-commerce sites that connect catalogue, stock, payments, delivery and CRM, so orders flow without manual work.', parts: [
      { h: 'What we build', ul: ['Catalogue, filters and search', 'Product pages that convert', 'Cart and checkout', 'Payments: iyzico, PayTR, Stripe and others', 'Delivery and stock integrations', 'Orders and customers in Lumiva CRM'] },
      { h: 'Performance and SEO', p: ['Category and product pages are generated with SEO in mind: unique titles, structured data, fast images and clean filters that do not create duplicate pages.'] },
      { h: 'Growth after launch', p: ['We connect analytics and product feeds for Google and Meta, set up abandoned-cart flows and test checkout improvements based on data.'] },
    ] },
    ru: { kick: 'Интернет-магазины', title: 'Разработка интернет-магазина, связанного со складом, оплатой и CRM', lead: 'Интернет-магазин хорош настолько, насколько хороши его процессы. Мы делаем магазины, где каталог, остатки, оплата, доставка и CRM связаны между собой и заказы проходят без ручной работы.', parts: [
      { h: 'Что мы делаем', ul: ['Каталог, фильтры и поиск', 'Карточки товаров, которые продают', 'Корзина и оформление заказа', 'Оплата: iyzico, PayTR, Stripe и другие', 'Интеграции доставки и остатков', 'Заказы и клиенты в Lumiva CRM'] },
      { h: 'Скорость и SEO', p: ['Страницы категорий и товаров генерируются с учётом SEO: уникальные заголовки, микроразметка, быстрые изображения и фильтры, которые не плодят дубли.'] },
      { h: 'Рост после запуска', p: ['Подключаем аналитику и товарные фиды для Google и Meta, настраиваем цепочки по брошенным корзинам и тестируем улучшения оформления заказа по данным.'] },
    ] },
    tr: { kick: 'E-ticaret', title: 'Depo, ödeme ve CRM ile bağlantılı online mağaza geliştirme', lead: 'Bir online mağaza, operasyonları kadar iyidir. Katalog, stok, ödeme, teslimat ve CRM’i birbirine bağlayan e-ticaret siteleri kuruyoruz; böylece siparişler manuel iş olmadan akar.', parts: [
      { h: 'Neler geliştiriyoruz', ul: ['Katalog, filtreler ve arama', 'Dönüştüren ürün sayfaları', 'Sepet ve ödeme adımları', 'Ödemeler: iyzico, PayTR, Stripe ve diğerleri', 'Teslimat ve stok entegrasyonları', 'Lumiva CRM’de siparişler ve müşteriler'] },
      { h: 'Performans ve SEO', p: ['Kategori ve ürün sayfaları SEO düşünülerek oluşturulur: benzersiz başlıklar, yapılandırılmış veri, hızlı görseller ve yinelenen sayfa üretmeyen temiz filtreler.'] },
      { h: 'Lansman sonrası büyüme', p: ['Google ve Meta için analitik ve ürün feedlerini bağlar, terk edilen sepet akışlarını kurar ve ödeme adımı iyileştirmelerini verilere göre test ederiz.'] },
    ] },
  },
  saas: {
    en: { kick: 'SaaS development', title: 'SaaS product development: from MVP to a scalable platform', lead: 'A SaaS product needs more than screens: authentication, roles, billing, dashboards and an architecture that survives growth. We build MVPs quickly and evolve them into stable platforms.', parts: [
      { h: 'Foundations from the first sprint', ul: ['Architecture and data model', 'Auth, roles and permissions', 'Subscriptions and billing', 'Admin panel and dashboards', 'APIs and integrations', 'Monitoring and backups'] },
      { h: 'MVP without dead ends', p: ['We scope the smallest version that proves value to real users, but build it on foundations that do not need to be rewritten when the product grows.'] },
      { h: 'Product team on demand', p: ['Product design, development and analytics work together, so each release is planned, measured and improved — not just shipped.'] },
    ] },
    ru: { kick: 'Разработка SaaS', title: 'Разработка SaaS-продукта: от MVP до масштабируемой платформы', lead: 'SaaS-продукту нужно больше, чем экраны: авторизация, роли, биллинг, дашборды и архитектура, которая выдержит рост. Мы быстро делаем MVP и развиваем его в стабильную платформу.', parts: [
      { h: 'Основа с первого спринта', ul: ['Архитектура и модель данных', 'Авторизация, роли и права', 'Подписки и биллинг', 'Админ-панель и дашборды', 'API и интеграции', 'Мониторинг и бэкапы'] },
      { h: 'MVP без тупиков', p: ['Определяем минимальную версию, которая докажет ценность реальным пользователям, но строим её на основе, которую не придётся переписывать при росте продукта.'] },
      { h: 'Продуктовая команда по запросу', p: ['Продуктовый дизайн, разработка и аналитика работают вместе, поэтому каждый релиз планируется, измеряется и улучшается, а не просто выкатывается.'] },
    ] },
    tr: { kick: 'SaaS geliştirme', title: 'SaaS ürün geliştirme: MVP’den ölçeklenebilir platforma', lead: 'Bir SaaS ürününün ekranlardan fazlasına ihtiyacı vardır: kimlik doğrulama, roller, faturalandırma, panolar ve büyümeye dayanan bir mimari. MVP’leri hızla geliştirir ve kararlı platformlara dönüştürürüz.', parts: [
      { h: 'İlk sprintten temeller', ul: ['Mimari ve veri modeli', 'Kimlik doğrulama, roller ve izinler', 'Abonelikler ve faturalandırma', 'Yönetim paneli ve panolar', 'API’ler ve entegrasyonlar', 'İzleme ve yedekleme'] },
      { h: 'Çıkmaza girmeyen MVP', p: ['Gerçek kullanıcılara değeri kanıtlayan en küçük sürümü belirleriz, ancak ürün büyüdüğünde yeniden yazılması gerekmeyen temeller üzerine kurarız.'] },
      { h: 'İhtiyaç anında ürün ekibi', p: ['Ürün tasarımı, geliştirme ve analitik birlikte çalışır; her sürüm sadece yayınlanmaz, planlanır, ölçülür ve iyileştirilir.'] },
    ] },
  },
  integrations: {
    en: { kick: 'Integrations & API', title: 'System integrations and API development: make your tools work together', lead: 'Data typed twice is data that goes wrong. We connect CRM, ERP, telephony, payment systems, marketplaces and websites through reliable APIs, webhooks and data pipelines.', parts: [
      { h: 'Typical integrations', ul: ['Website and forms → CRM', 'Payments and invoices', 'Telephony and messengers', 'Warehouse and ERP', 'Marketplaces and feeds', 'Analytics and BI'] },
      { h: 'Reliability', p: ['Integrations are built with queues, retries, logging and alerts, so a failure in one system does not silently lose orders or leads.'] },
      { h: 'Lumiva CRM as a hub', p: ['Many clients use our own Lumiva CRM as the central point where leads, sales and messages from all channels meet. We can also integrate with the systems you already use.'] },
    ] },
    ru: { kick: 'Интеграции и API', title: 'Интеграции систем и разработка API: чтобы инструменты работали вместе', lead: 'Данные, которые вводят дважды, — данные с ошибками. Мы связываем CRM, ERP, телефонию, платёжные системы, маркетплейсы и сайты через надёжные API, вебхуки и конвейеры данных.', parts: [
      { h: 'Типовые интеграции', ul: ['Сайт и формы → CRM', 'Оплаты и счета', 'Телефония и мессенджеры', 'Склад и ERP', 'Маркетплейсы и фиды', 'Аналитика и BI'] },
      { h: 'Надёжность', p: ['Интеграции строим с очередями, повторными попытками, логированием и оповещениями — сбой в одной системе не приведёт к тихой потере заказов или лидов.'] },
      { h: 'Lumiva CRM как центр', p: ['Многие клиенты используют нашу Lumiva CRM как центральную точку, где сходятся лиды, продажи и сообщения из всех каналов. Также интегрируемся с системами, которыми вы уже пользуетесь.'] },
    ] },
    tr: { kick: 'Entegrasyonlar ve API', title: 'Sistem entegrasyonları ve API geliştirme: araçlarınızı birlikte çalıştırın', lead: 'İki kez girilen veri, hatalı veridir. CRM, ERP, telefon sistemleri, ödeme sistemleri, pazaryerleri ve web sitelerini güvenilir API’ler, webhook’lar ve veri hatları üzerinden bağlıyoruz.', parts: [
      { h: 'Tipik entegrasyonlar', ul: ['Web sitesi ve formlar → CRM', 'Ödemeler ve faturalar', 'Telefon ve mesajlaşma', 'Depo ve ERP', 'Pazaryerleri ve feedler', 'Analitik ve BI'] },
      { h: 'Güvenilirlik', p: ['Entegrasyonlar kuyruklar, yeniden denemeler, kayıt tutma ve uyarılarla kurulur; böylece bir sistemdeki arıza siparişlerin veya lead’lerin sessizce kaybolmasına yol açmaz.'] },
      { h: 'Merkez olarak Lumiva CRM', p: ['Birçok müşterimiz kendi geliştirdiğimiz Lumiva CRM’i tüm kanallardan gelen lead, satış ve mesajların buluştuğu merkez olarak kullanıyor. Halihazırda kullandığınız sistemlerle de entegre olabiliriz.'] },
    ] },
  },
  landings: {
    en: { kick: 'Landing pages', title: 'Landing page development for campaigns and product launches', lead: 'A landing page has one job: turn a visitor into a lead. We design and build fast landing pages with a clear offer, strong structure, A/B testing and analytics ready before the first ad goes live.', parts: [
      { h: 'Structure that converts', p: ['We build the page around the visitor’s questions: what is offered, why it is better, what it costs, why to trust you and what to do next. Every block has a role in that sequence.'] },
      { h: 'What is included', ul: ['Offer and copywriting', 'Design and responsive layout', 'Fast loading and Core Web Vitals', 'Forms with CRM integration', 'Analytics events and UTM tracking', 'A/B testing setup'] },
      { h: 'Linked to your ads', p: ['Because landing pages and campaigns are made by one team, ad messages and page content stay aligned — one of the simplest ways to raise conversion and lower cost per lead.'] },
    ] },
    ru: { kick: 'Лендинги', title: 'Разработка лендингов для рекламных кампаний и запусков', lead: 'У лендинга одна задача — превратить посетителя в заявку. Мы проектируем и делаем быстрые лендинги с понятным оффером, сильной структурой, A/B-тестами и аналитикой, готовой до запуска первой рекламы.', parts: [
      { h: 'Структура, которая конвертирует', p: ['Строим страницу вокруг вопросов посетителя: что предлагают, чем это лучше, сколько стоит, почему вам можно доверять и что делать дальше. У каждого блока — своя роль в этой последовательности.'] },
      { h: 'Что входит', ul: ['Оффер и тексты', 'Дизайн и адаптивная вёрстка', 'Быстрая загрузка и Core Web Vitals', 'Формы с интеграцией в CRM', 'События аналитики и UTM', 'Настройка A/B-тестов'] },
      { h: 'Связка с рекламой', p: ['Лендинги и кампании делает одна команда, поэтому рекламные сообщения и содержание страницы совпадают — это один из самых простых способов повысить конверсию и снизить стоимость лида.'] },
    ] },
    tr: { kick: 'Açılış sayfaları', title: 'Kampanyalar ve ürün lansmanları için açılış sayfası geliştirme', lead: 'Bir açılış sayfasının tek bir görevi vardır: ziyaretçiyi lead’e dönüştürmek. Net bir teklif, güçlü bir yapı, A/B testi ve ilk reklam yayına girmeden hazır analitik ile hızlı açılış sayfaları tasarlayıp geliştiriyoruz.', parts: [
      { h: 'Dönüştüren yapı', p: ['Sayfayı ziyaretçinin soruları etrafında kurarız: ne sunuluyor, neden daha iyi, ne kadar, size neden güvenilmeli ve sonra ne yapılmalı. Her bloğun bu sıralamada bir rolü vardır.'] },
      { h: 'Neler dahil', ul: ['Teklif ve metin yazarlığı', 'Tasarım ve duyarlı düzen', 'Hızlı yükleme ve Core Web Vitals', 'CRM entegrasyonlu formlar', 'Analitik olayları ve UTM takibi', 'A/B testi kurulumu'] },
      { h: 'Reklamlarınızla bağlantılı', p: ['Açılış sayfaları ve kampanyalar aynı ekip tarafından hazırlandığı için reklam mesajları ve sayfa içeriği uyumlu kalır — dönüşümü artırmanın ve lead maliyetini düşürmenin en basit yollarından biri.'] },
    ] },
  },
  configurators: {
    en: { kick: 'Configurators', title: 'Product configurators, calculators and quizzes that generate qualified leads', lead: 'When customers can assemble and price a solution themselves, they arrive at sales already decided. We build 3D configurators, B2B calculators and multi-step quizzes connected to your CRM.', parts: [
      { h: 'Formats', ul: ['3D product configurators', 'Price and ROI calculators', 'Multi-step quizzes', 'Room and product visualisers', 'Quote builders for B2B', 'Booking and package builders'] },
      { h: 'Leads with context', p: ['Every completed configuration is sent to the CRM with all parameters, so the sales team sees exactly what the customer wants and can respond with a precise offer.'] },
      { h: 'Fast and measurable', p: ['Configurators are optimised for mobile and slow connections, and every step is tracked, so you can see where users drop off and improve the flow.'] },
    ] },
    ru: { kick: 'Конфигураторы', title: 'Конфигураторы, калькуляторы и квизы, которые приводят квалифицированные заявки', lead: 'Когда клиент сам собирает и рассчитывает решение, к менеджеру он приходит уже с решением. Мы делаем 3D-конфигураторы, B2B-калькуляторы и многошаговые квизы с интеграцией в CRM.', parts: [
      { h: 'Форматы', ul: ['3D-конфигураторы продукта', 'Калькуляторы стоимости и ROI', 'Многошаговые квизы', 'Визуализаторы интерьера и товара', 'Сборщики КП для B2B', 'Конструкторы бронирований и пакетов'] },
      { h: 'Заявки с контекстом', p: ['Каждая собранная конфигурация попадает в CRM со всеми параметрами — менеджер сразу видит, что именно нужно клиенту, и отвечает точным предложением.'] },
      { h: 'Быстро и измеримо', p: ['Конфигураторы оптимизированы для мобильных и медленного интернета, каждый шаг отслеживается — видно, где пользователи уходят, и можно улучшать сценарий.'] },
    ] },
    tr: { kick: 'Yapılandırıcılar', title: 'Nitelikli lead getiren ürün yapılandırıcıları, hesaplayıcılar ve testler', lead: 'Müşteriler çözümü kendileri oluşturup fiyatlandırabildiğinde, satışa karar vermiş olarak gelirler. CRM’inize bağlı 3D yapılandırıcılar, B2B hesaplayıcılar ve çok adımlı testler geliştiriyoruz.', parts: [
      { h: 'Formatlar', ul: ['3D ürün yapılandırıcıları', 'Fiyat ve ROI hesaplayıcıları', 'Çok adımlı testler', 'Mekân ve ürün görselleştiricileri', 'B2B teklif oluşturucuları', 'Rezervasyon ve paket oluşturucuları'] },
      { h: 'Bağlamıyla gelen lead’ler', p: ['Tamamlanan her yapılandırma tüm parametreleriyle CRM’e gönderilir; satış ekibi müşterinin tam olarak ne istediğini görür ve net bir teklifle yanıt verebilir.'] },
      { h: 'Hızlı ve ölçülebilir', p: ['Yapılandırıcılar mobil ve yavaş bağlantılar için optimize edilir ve her adım takip edilir; böylece kullanıcıların nerede ayrıldığını görüp akışı iyileştirebilirsiniz.'] },
    ] },
  },
  mobile: {
    en: { kick: 'Mobile apps', title: 'Mobile app development for iOS and Android', lead: 'People keep apps that are fast, useful and simple. We design and develop iOS, Android and PWA apps — native or cross-platform depending on the task and budget — from prototype to App Store and Google Play.', parts: [
      { h: 'What we deliver', ul: ['Product discovery and prototype', 'UX/UI design', 'Native (Swift / Kotlin) or React Native', 'Backend and admin panel', 'Push notifications and analytics', 'Store publication and updates'] },
      { h: 'Choosing the approach', p: ['Cross-platform development is often faster and cheaper for business apps; native makes sense for heavy graphics or deep device integration. We recommend an approach after discussing your goals, not before.'] },
      { h: 'After release', p: ['We track crashes, performance and user behaviour, and plan regular updates so the app keeps up with new OS versions and user feedback.'] },
    ] },
    ru: { kick: 'Мобильные приложения', title: 'Разработка мобильных приложений для iOS и Android', lead: 'Пользователи оставляют быстрые, полезные и простые приложения. Мы проектируем и разрабатываем приложения для iOS, Android и PWA — нативно или кроссплатформенно в зависимости от задачи и бюджета — от прототипа до App Store и Google Play.', parts: [
      { h: 'Что мы делаем', ul: ['Исследование и прототип', 'UX/UI-дизайн', 'Нативно (Swift / Kotlin) или React Native', 'Бэкенд и админ-панель', 'Push-уведомления и аналитика', 'Публикация в сторах и обновления'] },
      { h: 'Выбор подхода', p: ['Кроссплатформенная разработка часто быстрее и дешевле для бизнес-приложений; нативная оправдана при сложной графике или глубокой работе с устройством. Подход рекомендуем после обсуждения целей, а не до.'] },
      { h: 'После релиза', p: ['Следим за сбоями, скоростью и поведением пользователей и планируем регулярные обновления, чтобы приложение не отставало от новых версий ОС и отзывов пользователей.'] },
    ] },
    tr: { kick: 'Mobil uygulamalar', title: 'iOS ve Android için mobil uygulama geliştirme', lead: 'İnsanlar hızlı, faydalı ve basit uygulamaları saklar. İşe ve bütçeye göre native veya çapraz platform olarak iOS, Android ve PWA uygulamalarını prototipten App Store ve Google Play’e kadar tasarlayıp geliştiriyoruz.', parts: [
      { h: 'Neler teslim ediyoruz', ul: ['Ürün keşfi ve prototip', 'UX/UI tasarımı', 'Native (Swift / Kotlin) veya React Native', 'Backend ve yönetim paneli', 'Anlık bildirimler ve analitik', 'Mağaza yayını ve güncellemeler'] },
      { h: 'Yaklaşımı seçmek', p: ['İş uygulamaları için çapraz platform geliştirme genellikle daha hızlı ve uygundur; yoğun grafik veya derin cihaz entegrasyonu için native mantıklıdır. Yaklaşımı hedeflerinizi konuştuktan sonra öneririz, önce değil.'] },
      { h: 'Yayından sonra', p: ['Çökmeleri, performansı ve kullanıcı davranışını izler, uygulamanın yeni işletim sistemi sürümlerine ve kullanıcı geri bildirimlerine ayak uydurması için düzenli güncellemeler planlarız.'] },
    ] },
  },
  devops: {
    en: { kick: 'DevOps & cloud', title: 'DevOps and cloud infrastructure: stable releases and predictable uptime', lead: 'Infrastructure should be boring — in the best sense. We set up CI/CD, monitoring, backups and incident response so releases are routine and problems are found before customers notice.', parts: [
      { h: 'What we set up', ul: ['CI/CD pipelines', 'Cloud and server infrastructure', 'Containers and orchestration', 'Monitoring, logs and alerts', 'Backups and restore tests', 'Security updates and access control'] },
      { h: 'Backups you can restore', p: ['A backup that has never been restored is a hope, not a plan. We schedule backups, store copies off-site and test restores regularly.'] },
      { h: 'Support', p: ['We can maintain the infrastructure under a retainer with agreed response times, or set it up and hand it over to your team with documentation.'] },
    ] },
    ru: { kick: 'DevOps и облако', title: 'DevOps и облачная инфраструктура: стабильные релизы и предсказуемая работа', lead: 'Инфраструктура должна быть скучной — в лучшем смысле. Настраиваем CI/CD, мониторинг, резервное копирование и реагирование на инциденты, чтобы релизы были рутиной, а проблемы находились раньше, чем их заметят клиенты.', parts: [
      { h: 'Что мы настраиваем', ul: ['CI/CD-конвейеры', 'Облачная и серверная инфраструктура', 'Контейнеры и оркестрация', 'Мониторинг, логи и оповещения', 'Бэкапы и проверка восстановления', 'Обновления безопасности и доступы'] },
      { h: 'Бэкапы, из которых можно восстановиться', p: ['Бэкап, из которого ни разу не восстанавливались, — надежда, а не план. Настраиваем расписание копий, храним их вне основного сервера и регулярно проверяем восстановление.'] },
      { h: 'Поддержка', p: ['Можем сопровождать инфраструктуру по ретейнеру с согласованным временем реакции или настроить её и передать вашей команде с документацией.'] },
    ] },
    tr: { kick: 'DevOps ve bulut', title: 'DevOps ve bulut altyapısı: kararlı sürümler ve öngörülebilir çalışma süresi', lead: 'Altyapı sıkıcı olmalıdır — en iyi anlamda. CI/CD, izleme, yedekleme ve olay müdahalesini kurarız; böylece sürümler rutin hale gelir ve sorunlar müşteriler fark etmeden bulunur.', parts: [
      { h: 'Neler kuruyoruz', ul: ['CI/CD hatları', 'Bulut ve sunucu altyapısı', 'Konteynerler ve orkestrasyon', 'İzleme, loglar ve uyarılar', 'Yedekler ve geri yükleme testleri', 'Güvenlik güncellemeleri ve erişim kontrolü'] },
      { h: 'Geri yüklenebilen yedekler', p: ['Hiç geri yüklenmemiş bir yedek plan değil, umuttur. Yedekleri planlar, kopyaları ana sunucu dışında saklar ve geri yüklemeyi düzenli olarak test ederiz.'] },
      { h: 'Destek', p: ['Altyapıyı kararlaştırılmış yanıt süreleriyle retainer kapsamında yönetebilir veya kurup belgeleriyle birlikte ekibinize devredebiliriz.'] },
    ] },
  },
}

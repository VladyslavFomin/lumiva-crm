/**
 * Готовые сценарии отделов: автоматизации, которые создаются вместе с отделом из шаблона, чтобы он
 * работал «из коробки» (решение владельца 2026-10-07). Это обычные автоматизации CRM с действием
 * ai_office_task — их видно и можно менять в «Автоматизациях»; помечены meta.aiOffice.
 * Переменные в текстах: [[lead.name]] → {{lead.name}} (интерполяция автоматизаций).
 */
type L = { ru: string; en: string; tr: string };

export type OfficePlaybook = {
  key: string;
  trigger: string;
  name: L;
  title: L;
  details: L;
  priority: 1 | 2 | 3;
  /** meta автоматизации: staleDays для *.stale, schedule для scheduled */
  meta?: (tz: string) => Record<string, unknown>;
};

const weekly = (day: number, time: string) => (tz: string) => ({ schedule: { scheduleFrequency: 'weekly', scheduleDayOfWeek: day, scheduleTime: time, scheduleTimezone: tz } });
const daily = (time: string) => (tz: string) => ({ schedule: { scheduleFrequency: 'daily', scheduleTime: time, scheduleTimezone: tz } });

const REPLY_DETAILS: L = {
  ru: 'Клиент написал. Прочитай переписку и ответь в том же канале: коротко, по делу, на языке клиента. Если вопрос про цены/условия — только по данным из «Мозга» и CRM. Если нужен человек (скидка, жалоба, нестандартное) — позови менеджера. Отметь в заметке, что ответил.',
  en: 'A client wrote. Read the thread and reply in the same channel: short, to the point, in the client\'s language. Prices/terms only from the Brain and CRM data. If a human is needed (discount, complaint, unusual request) — call the manager. Leave a note about the reply.',
  tr: 'Müşteri yazdı. Yazışmayı oku ve aynı kanaldan yanıt ver: kısa, öz, müşterinin dilinde. Fiyat/koşullar yalnızca Beyin ve CRM verilerinden. İnsan gerekiyorsa (indirim, şikâyet, standart dışı istek) yöneticiyi çağır. Yanıtı nota yaz.',
};

export const OFFICE_PLAYBOOKS: Record<string, OfficePlaybook[]> = {
  sales: [
    {
      key: 'sales_new_lead',
      trigger: 'lead.created',
      priority: 1,
      name: { ru: 'Ответ новому лиду за 5 минут', en: 'Reply to a new lead within 5 minutes', tr: 'Yeni lead’e 5 dakikada yanıt' },
      title: { ru: 'Ответить новому лиду [[lead.name]]', en: 'Reply to new lead [[lead.name]]', tr: 'Yeni lead’e yanıt ver: [[lead.name]]' },
      details: {
        ru: 'Новый лид. Сразу: изучи карточку и источник, ответь клиенту в его канале (почта/Telegram/WhatsApp) коротким приветствием и 1–2 вопросами квалификации из скрипта в «Мозге». Назначь ответственного менеджера, оставь заметку с выводом. Если клиент готов — предложи встречу.',
        en: 'New lead. Right away: study the record and source, reply in the client\'s channel (email/Telegram/WhatsApp) with a short greeting and 1–2 qualification questions from the Brain script. Assign a manager, leave a note with your conclusion. If the client is ready — offer a meeting.',
        tr: 'Yeni lead. Hemen: kaydı ve kaynağı incele, müşterinin kanalından (e-posta/Telegram/WhatsApp) kısa bir selam ve Beyin’deki senaryodan 1–2 nitelendirme sorusuyla yanıt ver. Yönetici ata, sonucunu nota yaz. Müşteri hazırsa toplantı öner.',
      },
    },
    { key: 'sales_reply_email', trigger: 'email.received', priority: 1, name: { ru: 'Ответ на письма клиентов', en: 'Reply to client emails', tr: 'Müşteri e-postalarına yanıt' }, title: { ru: 'Ответить на письмо клиента', en: 'Reply to a client email', tr: 'Müşteri e-postasına yanıt ver' }, details: REPLY_DETAILS },
    { key: 'sales_reply_tg', trigger: 'telegram.message_received', priority: 1, name: { ru: 'Ответ в Telegram', en: 'Reply in Telegram', tr: 'Telegram’da yanıt' }, title: { ru: 'Ответить клиенту в Telegram', en: 'Reply to a client in Telegram', tr: 'Telegram’da müşteriye yanıt ver' }, details: REPLY_DETAILS },
    { key: 'sales_reply_wa', trigger: 'whatsapp.message_received', priority: 1, name: { ru: 'Ответ в WhatsApp', en: 'Reply in WhatsApp', tr: 'WhatsApp’ta yanıt' }, title: { ru: 'Ответить клиенту в WhatsApp', en: 'Reply to a client in WhatsApp', tr: 'WhatsApp’ta müşteriye yanıt ver' }, details: REPLY_DETAILS },
  ],
  marketing: [
    {
      key: 'marketing_weekly',
      trigger: 'scheduled',
      priority: 2,
      meta: weekly(1, '09:00'),
      name: { ru: 'Еженедельный отчёт по каналам', en: 'Weekly channel report', tr: 'Haftalık kanal raporu' },
      title: { ru: 'Отчёт по каналам за неделю', en: 'Weekly channel report', tr: 'Haftalık kanal raporu' },
      details: {
        ru: 'Собери итоги недели по каналам: лиды по источникам, конверсия в сделки, расходы и цена лида, где есть данные. Сравни с прошлой неделей. Дай 3 конкретных рекомендации, куда перенести бюджет. Запиши отчёт в «Мозг».',
        en: 'Summarise the week by channel: leads by source, conversion to deals, spend and cost per lead where data exists. Compare with the previous week. Give 3 concrete recommendations on moving budget. Save the report to the Brain.',
        tr: 'Haftayı kanallara göre özetle: kaynağa göre lead’ler, anlaşmaya dönüşüm, veri varsa harcama ve lead maliyeti. Geçen haftayla karşılaştır. Bütçeyi nereye kaydıracağına dair 3 somut öneri ver. Raporu Beyin’e kaydet.',
      },
    },
  ],
  content: [
    {
      key: 'content_weekly_plan',
      trigger: 'scheduled',
      priority: 2,
      meta: weekly(1, '10:00'),
      name: { ru: 'Контент-план на неделю', en: 'Weekly content plan', tr: 'Haftalık içerik planı' },
      title: { ru: 'Контент-план на неделю', en: 'Content plan for the week', tr: 'Haftalık içerik planı' },
      details: {
        ru: 'Составь контент-план на неделю: 5 публикаций с темой, рубрикой, готовым текстом и призывом к действию — по инструкции для контента из «Мозга». Учитывай частые вопросы клиентов из CRM. Если у отдела есть действие content_plan (включён автопостинг) — оформи план через него с датой и временем каждого поста; иначе запиши план в «Мозг».',
        en: 'Make a content plan for the week: 5 posts with topic, rubric, ready copy and call to action — following the content instructions in the Brain. Use frequent client questions from the CRM. If you have the content_plan action (autoposting on) — submit the plan with it, with the date and time of each post; otherwise save the plan to the Brain.',
        tr: 'Haftalık içerik planı hazırla: konu, rubrik, hazır metin ve harekete geçirici mesajla 5 gönderi — Beyin’deki içerik talimatına göre. CRM’deki sık müşteri sorularını kullan. content_plan eylemin varsa (otomatik paylaşım açık) planı her gönderinin tarih ve saatiyle onunla gönder; yoksa planı Beyin’e kaydet.',
      },
    },
  ],
  ops: [
    {
      key: 'ops_daily',
      trigger: 'scheduled',
      priority: 2,
      meta: daily('18:00'),
      name: { ru: 'Итоги дня и просрочки', en: 'Daily summary and overdue items', tr: 'Günlük özet ve gecikmeler' },
      title: { ru: 'Итоги дня: просрочки и узкие места', en: 'Daily summary: overdue items and bottlenecks', tr: 'Gün özeti: gecikmeler ve darboğazlar' },
      details: {
        ru: 'Проверь просроченные задачи и проекты, лиды без ответственного, зависшие сделки. Кратко: что горит, кто отвечает, что сделать завтра. Запиши сводку в «Мозг».',
        en: 'Check overdue tasks and projects, leads without an owner, stuck deals. Briefly: what is urgent, who owns it, what to do tomorrow. Save the summary to the Brain.',
        tr: 'Geciken görev ve projeleri, sorumlusuz lead’leri, takılan anlaşmaları kontrol et. Kısaca: acil olan, sorumlusu, yarın yapılacak. Özeti Beyin’e kaydet.',
      },
    },
    {
      key: 'ops_failures',
      trigger: 'ai_office.task_failed',
      priority: 2,
      name: { ru: 'Разбор сбоев ИИ-отделов', en: 'Investigate AI department failures', tr: 'YZ departmanı hatalarını incele' },
      title: { ru: 'Разобрать сбой отдела «[[departmentName]]»', en: 'Investigate failure in “[[departmentName]]”', tr: '“[[departmentName]]” hatasını incele' },
      details: {
        ru: 'Задача «[[title]]» не выполнена: [[error]]. Найди причину (нет доступа, данных, неверная настройка) и предложи, как исправить.',
        en: 'Task “[[title]]” failed: [[error]]. Find the cause (no access, missing data, wrong setting) and suggest a fix.',
        tr: '“[[title]]” görevi başarısız: [[error]]. Nedenini bul (erişim, veri, yanlış ayar) ve çözüm öner.',
      },
    },
  ],
  finance: [
    {
      key: 'finance_unpaid',
      trigger: 'sale.stale',
      priority: 1,
      meta: () => ({ staleDays: 7 }),
      name: { ru: 'Контроль неоплаченных сделок', en: 'Unpaid deals control', tr: 'Ödenmemiş anlaşma kontrolü' },
      title: { ru: 'Проверить неоплаченную сделку', en: 'Check an unpaid deal', tr: 'Ödenmemiş anlaşmayı kontrol et' },
      details: {
        ru: 'Сделка неделю без оплаты. Проверь статус и историю. Подготовь клиенту вежливое напоминание об оплате (через согласование) или поставь менеджеру задачу связаться.',
        en: 'The deal has been unpaid for a week. Check its status and history. Prepare a polite payment reminder to the client (through approval) or create a task for the manager to get in touch.',
        tr: 'Anlaşma bir haftadır ödenmedi. Durumu ve geçmişi kontrol et. Müşteriye kibar bir ödeme hatırlatması hazırla (onaylı) veya yöneticiye iletişim görevi aç.',
      },
    },
    {
      key: 'finance_weekly',
      trigger: 'scheduled',
      priority: 2,
      meta: weekly(1, '09:30'),
      name: { ru: 'Финансовая сводка недели', en: 'Weekly finance summary', tr: 'Haftalık finans özeti' },
      title: { ru: 'Финансовая сводка за неделю', en: 'Finance summary for the week', tr: 'Haftalık finans özeti' },
      details: {
        ru: 'Итоги недели: оплаченные и ожидающие сделки, просрочки, крупнейшие клиенты. Суммы — по валютам отдельно, без пересчёта. Запиши сводку в «Мозг».',
        en: 'Week summary: paid and pending deals, overdue ones, top clients. Amounts per currency, no conversion. Save the summary to the Brain.',
        tr: 'Hafta özeti: ödenen ve bekleyen anlaşmalar, gecikenler, en büyük müşteriler. Tutarlar para birimine göre ayrı, çevirmeden. Özeti Beyin’e kaydet.',
      },
    },
  ],
  stock: [
    {
      key: 'stock_low',
      trigger: 'product.stock_low',
      priority: 1,
      name: { ru: 'Дозаказ при низком остатке', en: 'Reorder on low stock', tr: 'Düşük stokta yeniden sipariş' },
      title: { ru: 'Позиция на исходе: [[product.name]]', en: 'Running low: [[product.name]]', tr: 'Azalıyor: [[product.name]]' },
      details: {
        ru: 'Остаток товара «[[product.name]]» упал до [[newQuantity]] (порог [[threshold]]). Оцени продажи и поставь задачу на дозаказ с количеством.',
        en: 'Stock of “[[product.name]]” dropped to [[newQuantity]] (threshold [[threshold]]). Estimate sales and create a reorder task with a quantity.',
        tr: '“[[product.name]]” stoğu [[newQuantity]] seviyesine düştü (eşik [[threshold]]). Satışları değerlendir ve miktarla yeniden sipariş görevi aç.',
      },
    },
  ],
  reception: [
    {
      key: 'reception_new_booking',
      trigger: 'booking.reservation_created',
      priority: 1,
      name: { ru: 'Новая бронь — подтверждение гостю', en: 'New booking — confirmation to the guest', tr: 'Yeni rezervasyon — misafire onay' },
      title: { ru: 'Новая бронь: [[client_name]]', en: 'New booking: [[client_name]]', tr: 'Yeni rezervasyon: [[client_name]]' },
      details: {
        ru: 'Создана бронь (данные RECEPTION). Отправь гостю send_booking_message с template "confirm" (данные брони система подставит сама). Если бронь требует подтверждения и правила «Мозга» это разрешают — сначала booking_update confirm.',
        en: 'A booking was created (RECEPTION data). Send the guest send_booking_message with template "confirm" (the system fills in the booking data). If the booking needs confirmation and the Brain rules allow it — booking_update confirm first.',
        tr: 'Rezervasyon oluşturuldu (RECEPTION verileri). Misafire template "confirm" ile send_booking_message gönder (rezervasyon verilerini sistem doldurur). Rezervasyon onay gerektiriyorsa ve Beyin kuralları izin veriyorsa — önce booking_update confirm.',
      },
    },
    {
      key: 'reception_new_hotel',
      trigger: 'hotel.reservation_created',
      priority: 1,
      name: { ru: 'Новая бронь отеля — письмо гостю', en: 'New hotel booking — email to the guest', tr: 'Yeni otel rezervasyonu — misafire e-posta' },
      title: { ru: 'Новая бронь отеля: [[guest_name]]', en: 'New hotel booking: [[guest_name]]', tr: 'Yeni otel rezervasyonu: [[guest_name]]' },
      details: {
        ru: 'Создана бронь в отеле (данные RECEPTION). Отправь гостю send_booking_message с template "confirm" (даты, номер и адрес система подставит сама).',
        en: 'A hotel booking was created (RECEPTION data). Send the guest send_booking_message with template "confirm" (the system fills in dates, room and address).',
        tr: 'Otel rezervasyonu oluşturuldu (RECEPTION verileri). Misafire template "confirm" ile send_booking_message gönder (tarihleri, odayı ve adresi sistem doldurur).',
      },
    },
  ],
  support: [
    {
      key: 'support_new_ticket',
      trigger: 'helpdesk.ticket_created',
      priority: 1,
      name: { ru: 'Ответ на новую заявку', en: 'Reply to a new ticket', tr: 'Yeni talebe yanıt' },
      title: { ru: 'Новая заявка: [[ticket.subject]]', en: 'New ticket: [[ticket.subject]]', tr: 'Yeni talep: [[ticket.subject]]' },
      details: {
        ru: 'Новая заявка от [[requester.name]]: «[[message.text]]». Прочитай заявку (данные HELPDESK) и ответь helpdesk_reply по базе знаний из «Мозга»: коротко, по шагам, на языке клиента. Поставь приоритет и категорию (helpdesk_update). Если ответа в «Мозге» нет, это жалоба, возврат или нестандартный случай — назначь человека с приоритетом high и коротко напиши клиенту, что заявку взял специалист.',
        en: 'New ticket from [[requester.name]]: “[[message.text]]”. Read the ticket (HELPDESK data) and reply with helpdesk_reply from the Brain knowledge base: short, step by step, in the client\'s language. Set priority and category (helpdesk_update). If the answer is not in the Brain, or it is a complaint, refund or unusual case — assign a human with priority high and tell the client briefly that a specialist took the ticket.',
        tr: '[[requester.name]] kişisinden yeni talep: “[[message.text]]”. Talebi oku (HELPDESK verileri) ve Beyin’deki bilgi tabanına göre helpdesk_reply ile yanıtla: kısa, adım adım, müşterinin dilinde. Öncelik ve kategori belirle (helpdesk_update). Yanıt Beyin’de yoksa, şikâyet, iade veya standart dışı bir durumsa — high öncelikle bir insan ata ve müşteriye kısaca talebi bir uzmanın aldığını yaz.',
      },
    },
    {
      key: 'support_client_reply',
      trigger: 'helpdesk.message_received',
      priority: 1,
      name: { ru: 'Ответ клиенту в заявке', en: 'Reply to the client in a ticket', tr: 'Talepte müşteriye yanıt' },
      title: { ru: 'Клиент ответил в заявке: [[ticket.subject]]', en: 'Client replied in ticket: [[ticket.subject]]', tr: 'Müşteri talepte yanıtladı: [[ticket.subject]]' },
      details: {
        ru: 'Клиент ответил в заявке: «[[message.text]]». Прочитай всю переписку и продолжи: ответь по базе знаний, а если вопрос решён — закрой заявку (status resolved). Если заявку ведёт человек (назначен ответственный) — не отвечай вместо него, оставь короткую подсказку в отчёте.',
        en: 'The client replied in the ticket: “[[message.text]]”. Read the whole conversation and continue: answer from the knowledge base, and if the issue is solved — resolve the ticket (status resolved). If a human owns the ticket (assignee set) — do not reply instead of them, leave a short hint in your report.',
        tr: 'Müşteri talepte yanıtladı: “[[message.text]]”. Tüm yazışmayı oku ve devam et: bilgi tabanına göre yanıtla, sorun çözüldüyse talebi kapat (status resolved). Talebi bir insan yürütüyorsa (sorumlu atanmışsa) onun yerine yanıtlama, raporda kısa bir ipucu bırak.',
      },
    },
  ],
  dev: [
    {
      key: 'dev_weekly_triage',
      trigger: 'scheduled',
      priority: 2,
      meta: weekly(1, '10:00'),
      name: { ru: 'Разбор задач и issue на неделю', en: 'Weekly issue triage', tr: 'Haftalık issue ayıklama' },
      title: { ru: 'Разбор открытых задач и issue', en: 'Triage open tasks and issues', tr: 'Açık görev ve issue’ları ayıkla' },
      details: {
        ru: 'Пройди открытые issue в GitHub и задачи отдела: приоритеты, дубли, что блокирует. Предложи план на неделю и запиши его в «Мозг».',
        en: 'Go through open GitHub issues and department tasks: priorities, duplicates, blockers. Propose a plan for the week and save it to the Brain.',
        tr: 'Açık GitHub issue’larını ve departman görevlerini gözden geçir: öncelikler, tekrarlar, engeller. Haftalık plan öner ve Beyin’e kaydet.',
      },
    },
  ],
};

export const toAutomationVars = (s: string) => s.replace(/\[\[([^\]]+)\]\]/g, '{{$1}}');

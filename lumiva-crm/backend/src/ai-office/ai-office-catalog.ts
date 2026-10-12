/**
 * ИИ-офис: справочники, общие для бэкенда и фронтенда.
 *
 * Матрица прав отдела (8 категорий × 5 уровней) — жёсткий потолок для всех агентов отдела.
 * Каждый ключ категории обязан иметь реальный эффект: read_* открывают блоки снапшота
 * (AiEmployeesService.operationalSnapshot), остальные — типы действий из ACTION_PERMISSION.
 * Если у категории нет действий уровня draft/write, этот уровень не предлагается в редакторе
 * (см. levelsFor) — никаких декоративных переключателей.
 */

export type OfficeLevel = 'off' | 'read' | 'draft' | 'appr' | 'auto';
export const OFFICE_LEVELS: OfficeLevel[] = ['off', 'read', 'draft', 'appr', 'auto'];

export type OfficePermCategory = 'crm' | 'finance' | 'tasks' | 'msg' | 'ads' | 'content' | 'stock' | 'code';

type CategoryDef = {
  key: OfficePermCategory;
  /** Ключи прав, открываемые на уровне read и выше. */
  read: string[];
  /** Действия, которые создают только черновики (ничего не уходит наружу) — уровень draft. */
  draft: string[];
  /** Действия, которые реально меняют данные или уходят клиенту — уровни appr/auto. */
  write: string[];
};

export const OFFICE_PERM_CATEGORIES: CategoryDef[] = [
  {
    key: 'crm',
    read: ['read_leads', 'read_contacts', 'read_companies', 'read_notes'],
    draft: ['create_note'],
    write: ['create_note', 'update_lead_status', 'assign_lead', 'helpdesk_update'],
  },
  {
    key: 'finance',
    read: ['read_sales', 'read_products'],
    draft: [],
    write: ['sale_confirm_payment'],
  },
  {
    key: 'tasks',
    read: ['read_tasks', 'read_projects', 'jira_read'],
    draft: [],
    write: ['create_task', 'update_task', 'create_project', 'create_meeting', 'create_workspace_table', 'manage_workspace_data', 'jira_create_issue', 'slack_post'],
  },
  {
    key: 'msg',
    read: ['read_messages', 'read_helpdesk'],
    draft: ['draft_email', 'draft_whatsapp'],
    write: ['draft_email', 'draft_whatsapp', 'send_email', 'send_telegram', 'send_whatsapp', 'send_bulk_email', 'helpdesk_reply', 'send_booking_message'],
  },
  {
    key: 'ads',
    read: ['read_marketing', 'read_reports'],
    draft: ['create_report'],
    write: ['create_report', 'ads_manage'],
  },
  {
    key: 'content',
    read: ['notion_read', 'canva_read'],
    draft: ['notion_create_page', 'canva_create_design'],
    write: ['notion_create_page', 'notion_append', 'canva_create_design', 'publish_telegram_post', 'content_plan'],
  },
  {
    key: 'stock',
    read: ['read_products', 'read_bookings'],
    draft: [],
    write: ['stock_purchase_order', 'booking_update'],
  },
  {
    key: 'code',
    read: ['github_read'],
    draft: ['github_create_issue'],
    write: ['github_create_issue', 'github_comment'],
  },
];

/** Всегда доступно агенту отдела: позвать человека и попросить недостающее — это подстраховка. */
export const OFFICE_ALWAYS_ON = ['escalate_to_human', 'read_reports'];

/** Действия, которые уходят клиенту, — правило «Не отправлять ничего клиенту без согласования». */
export const OFFICE_CLIENT_SEND_ACTIONS = ['send_email', 'send_telegram', 'send_whatsapp', 'send_bulk_email', 'helpdesk_reply', 'send_booking_message'];

/** Действия, отправляющие данные во внешние сервисы (правило «персональные данные только в CRM»). */
export const OFFICE_EXTERNAL_ACTIONS = ['notion_create_page', 'notion_append', 'canva_create_design', 'github_create_issue', 'github_comment', 'github_review', 'jira_create_issue', 'slack_post'];

export function categoryOf(permKey: string): OfficePermCategory[] {
  return OFFICE_PERM_CATEGORIES.filter(
    (c) => c.read.includes(permKey) || c.draft.includes(permKey) || c.write.includes(permKey),
  ).map((c) => c.key);
}

/** Уровни, которые реально что-то значат для категории. */
export function levelsFor(cat: OfficePermCategory): OfficeLevel[] {
  const def = OFFICE_PERM_CATEGORIES.find((c) => c.key === cat);
  if (!def) return ['off'];
  const out: OfficeLevel[] = ['off', 'read'];
  if (def.draft.length) out.push('draft');
  if (def.write.length) out.push('appr', 'auto');
  return out;
}

export type OfficePermMatrix = Partial<Record<OfficePermCategory, OfficeLevel>>;

/** Приводит уровень к ближайшему допустимому снизу (например, auto у finance → read). */
export function normalizeMatrix(input: unknown): Record<OfficePermCategory, OfficeLevel> {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out = {} as Record<OfficePermCategory, OfficeLevel>;
  for (const c of OFFICE_PERM_CATEGORIES) {
    const raw = String(src[c.key] ?? 'off') as OfficeLevel;
    const allowed = levelsFor(c.key);
    let lv: OfficeLevel = OFFICE_LEVELS.includes(raw) ? raw : 'off';
    while (!allowed.includes(lv)) lv = OFFICE_LEVELS[OFFICE_LEVELS.indexOf(lv) - 1];
    out[c.key] = lv;
  }
  return out;
}

/**
 * Что разрешает матрица: allowed — ключи прав/действий, approval — действия, которые на этом
 * уровне обязаны идти через согласование человеком.
 */
export function matrixGrants(matrix: Record<OfficePermCategory, OfficeLevel>): { allowed: Set<string>; approval: Set<string> } {
  const allowed = new Set<string>(OFFICE_ALWAYS_ON);
  const approval = new Set<string>();
  const autoKeys = new Set<string>();
  for (const c of OFFICE_PERM_CATEGORIES) {
    const lv = matrix[c.key] ?? 'off';
    if (lv === 'off') continue;
    c.read.forEach((k) => allowed.add(k));
    if (lv === 'draft') c.draft.forEach((k) => allowed.add(k));
    if (lv === 'appr' || lv === 'auto') {
      c.write.forEach((k) => {
        allowed.add(k);
        if (lv === 'appr') approval.add(k);
        else autoKeys.add(k);
      });
    }
  }
  // ключ, разрешённый «сам» хоть в одной категории, не требует согласования из-за другой
  autoKeys.forEach((k) => approval.delete(k));
  // черновики никуда не уходят — согласовывать нечего, согласуется настоящая отправка
  ['draft_email', 'draft_whatsapp'].forEach((k) => approval.delete(k));
  return { allowed, approval };
}

// ───────────────────────── правила отдела ─────────────────────────

export const OFFICE_RULES = [
  'no_client_send_without_approval',
  'respect_daily_budget',
  'write_brain_notes',
  'notify_slack_on_done',
  'no_pii_outside_crm',
  'approve_sensitive',
] as const;

/** Сообщение клиенту про деньги/условия — даже у самостоятельного отдела ждёт согласования (правило approve_sensitive). */
export const SENSITIVE_SEND_RE =
  /цен[аыуеой](?![а-яё])|стоимост|скидк|прайс|оплат|предоплат|сч[её]т(а|у)? на|договор|возврат|рассрочк|price|pricing|discount|payment|invoice|contract|refund|fiyat|indirim|ödeme|fatura|sözleşme|iade|\d[\d\s.,]*\s?(€|\$|₺|руб(?![а-яё])|р\.|eur\b|usd\b|tl\b)|(€|\$|₺)\s?\d/i;
export type OfficeRule = (typeof OFFICE_RULES)[number];

export const OFFICE_WORK_HOURS = ['24/7', 'weekdays', 'on_demand'] as const;
export type OfficeWorkHours = (typeof OFFICE_WORK_HOURS)[number];

/** Палитра цветов комнат из дизайна. */
export const OFFICE_COLORS = ['#e9a5a0', '#f0b98a', '#ecc982', '#d9c3a1', '#c9d68f', '#9fd3c0', '#8cc9d6', '#a9c7e6', '#b5c2ea', '#c8b7e6', '#e6b3cf', '#c7c2b8'];

/** Слоты на карте: клетка 3×3 вокруг «Мозга» (0,0). Порядок заполнения. */
export const OFFICE_SLOTS: Array<[number, number]> = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
];

export const OFFICE_MAX_AGENTS = 8;
export const OFFICE_MAX_DEPARTMENTS = OFFICE_SLOTS.length;

/** Сколько отделов входит в тариф (решение владельца 2026-10-07). */
export function includedDepartmentsForPlan(plan: string): number {
  if (plan === 'ultimate') return 5;
  if (plan === 'enterprise') return 3;
  return 0;
}
export const OFFICE_EXTRA_SLOT_EUR = 200;

// ───────────────────────── KPI для карточки отдела ─────────────────────────

/** Реальные метрики, которые можно вывести на карточку отдела (считаются в AiOfficeService.kpiValues). */
export const OFFICE_KPIS = [
  'tasks_done_today',
  'tasks_waiting',
  'leads_new_7d',
  'leads_open',
  'meetings_upcoming',
  'sales_won_30d',
  'tasks_overdue',
  'tickets_open',
  'bookings_upcoming',
  'brain_files',
  'spend_month',
] as const;
export type OfficeKpi = (typeof OFFICE_KPIS)[number];

// ───────────────────────── шаблоны отделов (из дизайна) ─────────────────────────

type L = { ru: string; en: string; tr: string };

export type OfficeTemplate = {
  key: string;
  color: string;
  name: L;
  mission: L;
  agents: Array<{ title: L; lead?: boolean; prompt: L }>;
  permissions: Record<OfficePermCategory, OfficeLevel>;
  rules: OfficeRule[];
  connectors: string[];
  kpis: OfficeKpi[];
};

const P = (o: Partial<Record<OfficePermCategory, OfficeLevel>>): Record<OfficePermCategory, OfficeLevel> =>
  normalizeMatrix({ crm: 'off', finance: 'off', tasks: 'off', msg: 'off', ads: 'off', content: 'off', stock: 'off', code: 'off', ...o });

export const OFFICE_TEMPLATES: OfficeTemplate[] = [
  {
    key: 'marketing',
    color: '#e9a5a0',
    name: { ru: 'Маркетинг', en: 'Marketing', tr: 'Pazarlama' },
    mission: {
      ru: 'Привлекать заявки дешевле целевой цены лида, следить за рекламой в Meta и Google, раз в неделю отдавать отчёт руководителю. Любую отправку клиенту — только после согласования.',
      en: 'Bring in leads below the target cost per lead, watch Meta and Google ads, and send the manager a weekly report. Anything sent to a client goes out only after approval.',
      tr: 'Hedef lead maliyetinin altında talep getirmek, Meta ve Google reklamlarını izlemek, yöneticiye haftalık rapor vermek. Müşteriye giden her şey yalnızca onaydan sonra.',
    },
    agents: [
      { title: { ru: 'Лид маркетинга', en: 'Marketing lead', tr: 'Pazarlama lideri' }, lead: true, prompt: { ru: 'Распределяешь задачи отдела, следишь за целью по цене лида и собираешь недельный отчёт.', en: 'You distribute the department’s tasks, track the cost-per-lead goal and compile the weekly report.', tr: 'Departman görevlerini dağıtır, lead maliyeti hedefini izler ve haftalık raporu hazırlarsın.' } },
      { title: { ru: 'Таргетолог', en: 'Ads specialist', tr: 'Reklam uzmanı' }, prompt: { ru: 'Смотришь кампании Meta и Google: частота, CTR, цена лида. Предлагаешь замену креативов и перераспределение бюджета отчётом.', en: 'You review Meta and Google campaigns: frequency, CTR, cost per lead. Propose creative swaps and budget shifts as a report.', tr: 'Meta ve Google kampanyalarını incelersin: frekans, CTR, lead maliyeti. Kreatif değişikliği ve bütçe kaydırmayı rapor olarak önerirsin.' } },
      { title: { ru: 'Аналитик', en: 'Analyst', tr: 'Analist' }, prompt: { ru: 'Считаешь источники, конверсию и окупаемость каналов. Только цифры из CRM, никаких догадок.', en: 'You compute sources, conversion and channel ROI. Only CRM numbers, no guesses.', tr: 'Kaynakları, dönüşümü ve kanal getirisini hesaplarsın. Sadece CRM verileri, tahmin yok.' } },
      { title: { ru: 'Email', en: 'Email', tr: 'E-posta' }, prompt: { ru: 'Готовишь рассылки по сегментам. Каждая рассылка — только через согласование.', en: 'You prepare segment newsletters. Every send goes through approval.', tr: 'Segment bültenleri hazırlarsın. Her gönderim onaydan geçer.' } },
    ],
    permissions: P({ crm: 'read', ads: 'auto', msg: 'appr', tasks: 'appr', content: 'draft' }),
    rules: ['no_client_send_without_approval', 'write_brain_notes'],
    connectors: ['crm', 'meta_ads', 'google_ads', 'email'],
    kpis: ['leads_new_7d', 'spend_month'],
  },
  {
    key: 'sales',
    color: '#ecc982',
    name: { ru: 'Продажи', en: 'Sales', tr: 'Satış' },
    mission: {
      ru: 'Отвечать на входящие лиды в течение 5 минут, квалифицировать, назначать встречи менеджерам и вести follow-up, пока лид не ответит или не откажется.',
      en: 'Answer incoming leads within 5 minutes, qualify them, book meetings for managers and follow up until the lead replies or declines.',
      tr: 'Gelen lead’lere 5 dakika içinde yanıt vermek, nitelendirmek, yöneticilere toplantı ayarlamak ve lead yanıt verene ya da reddedene kadar takip etmek.',
    },
    agents: [
      { title: { ru: 'РОП', en: 'Head of sales', tr: 'Satış müdürü' }, lead: true, prompt: { ru: 'Распределяешь лиды и задачи, следишь, чтобы ни один лид не остался без ответа.', en: 'You distribute leads and tasks and make sure no lead is left unanswered.', tr: 'Lead’leri ve görevleri dağıtır, hiçbir lead’in yanıtsız kalmamasını sağlarsın.' } },
      { title: { ru: 'Квалификатор', en: 'Qualifier', tr: 'Nitelendirici' }, prompt: { ru: 'Первый ответ и квалификация лида по скрипту из «Мозга». Подходящих — передаёшь РОПу.', en: 'First reply and lead qualification by the script in the Brain. Qualified ones go to the head of sales.', tr: 'İlk yanıt ve Beyin’deki senaryoya göre nitelendirme. Uygun olanları satış müdürüne aktarırsın.' } },
      { title: { ru: 'Follow-up', en: 'Follow-up', tr: 'Takip' }, prompt: { ru: 'Напоминаешь лидам без ответа 3 дня. Коротко, вежливо, на языке клиента.', en: 'You nudge leads silent for 3 days. Short, polite, in the client’s language.', tr: '3 gündür yanıt vermeyen lead’lere hatırlatma yaparsın. Kısa, kibar, müşterinin dilinde.' } },
      { title: { ru: 'КП', en: 'Proposals', tr: 'Teklifler' }, prompt: { ru: 'Готовишь коммерческие предложения по прайсу из «Мозга». Если прайса нет — сообщаешь, а не выдумываешь.', en: 'You draft proposals using the price list in the Brain. No price list — report it, never invent.', tr: 'Beyin’deki fiyat listesine göre teklif hazırlarsın. Liste yoksa bildirirsin, uydurmazsın.' } },
    ],
    permissions: P({ crm: 'auto', msg: 'appr', tasks: 'auto', finance: 'read' }),
    rules: ['no_client_send_without_approval', 'write_brain_notes'],
    connectors: ['crm', 'email', 'telegram', 'whatsapp'],
    kpis: ['leads_open', 'meetings_upcoming'],
  },
  {
    key: 'content',
    color: '#c8b7e6',
    name: { ru: 'Контент', en: 'Content', tr: 'İçerik' },
    mission: {
      ru: 'Готовить контент-план на месяц, писать тексты и делать макеты. Публикация — только после согласования человеком.',
      en: 'Prepare the monthly content plan, write copy and make layouts. Publishing only after human approval.',
      tr: 'Aylık içerik planı hazırlamak, metin yazmak ve tasarım yapmak. Yayın yalnızca insan onayından sonra.',
    },
    agents: [
      { title: { ru: 'Главред', en: 'Editor-in-chief', tr: 'Genel yayın yönetmeni' }, lead: true, prompt: { ru: 'Держишь контент-план и единый тон из брендбука в «Мозге».', en: 'You own the content plan and the single tone of voice from the brand book in the Brain.', tr: 'İçerik planını ve Beyin’deki marka kılavuzundaki tek sesi korursun.' } },
      { title: { ru: 'Копирайтер', en: 'Copywriter', tr: 'Metin yazarı' }, prompt: { ru: 'Пишешь тексты постов, писем и статей по рубрикатору.', en: 'You write posts, emails and articles by the rubric list.', tr: 'Rubrik listesine göre gönderi, e-posta ve makale metinleri yazarsın.' } },
      { title: { ru: 'Дизайнер', en: 'Designer', tr: 'Tasarımcı' }, prompt: { ru: 'Делаешь макеты в Canva по готовым текстам.', en: 'You create Canva layouts from the finished copy.', tr: 'Hazır metinlerden Canva tasarımları yaparsın.' } },
      { title: { ru: 'SMM', en: 'SMM', tr: 'SMM' }, prompt: { ru: 'Готовишь сторис и подписи, ведёшь календарь публикаций.', en: 'You prepare stories and captions and keep the publishing calendar.', tr: 'Hikâye ve açıklamalar hazırlar, yayın takvimini yönetirsin.' } },
    ],
    permissions: P({ content: 'auto', tasks: 'appr', ads: 'read' }),
    rules: ['write_brain_notes', 'no_pii_outside_crm'],
    connectors: ['crm', 'canva', 'notion', 'telegram'],
    kpis: ['tasks_done_today', 'tasks_waiting'],
  },
  {
    key: 'ops',
    color: '#a9c7e6',
    name: { ru: 'Операции', en: 'Operations', tr: 'Operasyon' },
    mission: {
      ru: 'Держать регламенты актуальными, собирать KPI отделов к первому числу и следить за просроченными задачами.',
      en: 'Keep the procedures up to date, collect department KPIs by the first of the month and watch overdue tasks.',
      tr: 'Prosedürleri güncel tutmak, departman KPI’larını ayın birine kadar toplamak ve geciken görevleri izlemek.',
    },
    agents: [
      { title: { ru: 'Операционист', en: 'Operations lead', tr: 'Operasyon lideri' }, lead: true, prompt: { ru: 'Следишь за процессами и просрочками, распределяешь задачи.', en: 'You watch processes and overdue items and distribute tasks.', tr: 'Süreçleri ve gecikmeleri izler, görevleri dağıtırsın.' } },
      { title: { ru: 'Регламенты', en: 'Procedures', tr: 'Prosedürler' }, prompt: { ru: 'Обновляешь регламенты в «Мозге» и Notion.', en: 'You update procedures in the Brain and Notion.', tr: 'Beyin’de ve Notion’da prosedürleri güncellersin.' } },
      { title: { ru: 'Отчёты', en: 'Reports', tr: 'Raporlar' }, prompt: { ru: 'Собираешь сводки KPI по отделам из данных CRM.', en: 'You compile KPI summaries per department from CRM data.', tr: 'CRM verilerinden departman KPI özetleri hazırlarsın.' } },
    ],
    permissions: P({ tasks: 'auto', ads: 'auto', crm: 'read', content: 'draft' }),
    rules: ['write_brain_notes', 'notify_slack_on_done'],
    connectors: ['crm', 'notion', 'slack', 'jira'],
    kpis: ['tasks_overdue', 'tasks_done_today'],
  },
  {
    key: 'dev',
    color: '#9fd3c0',
    name: { ru: 'Разработка', en: 'Development', tr: 'Geliştirme' },
    mission: {
      ru: 'Разбирать задачи и баги, заводить issue в GitHub с понятным описанием и шагами воспроизведения. Изменения кода — только после ревью человека.',
      en: 'Triage tasks and bugs, open GitHub issues with clear descriptions and reproduction steps. Code changes only after human review.',
      tr: 'Görev ve hataları ayıklamak, açık açıklama ve yeniden üretme adımlarıyla GitHub issue açmak. Kod değişiklikleri yalnızca insan incelemesinden sonra.',
    },
    agents: [
      { title: { ru: 'Тимлид', en: 'Team lead', tr: 'Takım lideri' }, lead: true, prompt: { ru: 'Разбираешь входящие задачи, приоритизируешь, распределяешь.', en: 'You triage incoming tasks, prioritise and distribute them.', tr: 'Gelen görevleri ayıklar, önceliklendirir ve dağıtırsın.' } },
      { title: { ru: 'QA', en: 'QA', tr: 'QA' }, prompt: { ru: 'Описываешь баги: шаги, ожидаемое и фактическое поведение.', en: 'You describe bugs: steps, expected and actual behaviour.', tr: 'Hataları tanımlarsın: adımlar, beklenen ve gerçek davranış.' } },
      { title: { ru: 'Ревьюер', en: 'Reviewer', tr: 'İnceleyici' }, prompt: { ru: 'Комментируешь issue и PR по существу, без воды.', en: 'You comment on issues and PRs to the point.', tr: 'Issue ve PR’lara öz yorumlar yaparsın.' } },
    ],
    permissions: P({ code: 'appr', tasks: 'auto' }),
    rules: ['write_brain_notes', 'no_pii_outside_crm'],
    connectors: ['crm', 'github', 'jira', 'slack'],
    kpis: ['tasks_done_today', 'tasks_waiting'],
  },
  {
    key: 'stock',
    color: '#d9c3a1',
    name: { ru: 'Склад и логистика', en: 'Stock & logistics', tr: 'Stok ve lojistik' },
    mission: {
      ru: 'Следить за остатками товаров и бронированиями, предупреждать о позициях на исходе и сообщать клиентам статус заказа.',
      en: 'Watch stock levels and reservations, warn about items running low and tell clients their order status.',
      tr: 'Stok seviyelerini ve rezervasyonları izlemek, azalan ürünleri bildirmek ve müşterilere sipariş durumunu iletmek.',
    },
    agents: [
      { title: { ru: 'Логист', en: 'Logistics lead', tr: 'Lojistik lideri' }, lead: true, prompt: { ru: 'Следишь за остатками и сроками, распределяешь задачи.', en: 'You watch stock and deadlines and distribute tasks.', tr: 'Stok ve süreleri izler, görevleri dağıtırsın.' } },
      { title: { ru: 'Остатки', en: 'Inventory', tr: 'Envanter' }, prompt: { ru: 'Находишь позиции ниже порога и ставишь задачу на дозаказ.', en: 'You find items below threshold and create a reorder task.', tr: 'Eşiğin altındaki ürünleri bulur, yeniden sipariş görevi açarsın.' } },
      { title: { ru: 'Доставка', en: 'Delivery', tr: 'Teslimat' }, prompt: { ru: 'Сообщаешь клиентам статус заказа — через согласование.', en: 'You tell clients their order status — through approval.', tr: 'Müşterilere sipariş durumunu onay üzerinden iletirsin.' } },
    ],
    permissions: P({ stock: 'appr', tasks: 'auto', msg: 'appr', crm: 'read' }),
    rules: ['no_client_send_without_approval', 'write_brain_notes'],
    connectors: ['crm', 'email', 'telegram'],
    kpis: ['bookings_upcoming', 'tasks_waiting'],
  },
  {
    key: 'support',
    color: '#8cc9d6',
    name: { ru: 'Поддержка', en: 'Support', tr: 'Destek' },
    mission: {
      ru: 'Отвечать на заявки клиентов и сотрудников быстро и по базе знаний из «Мозга», доводить заявку до решения, сложное и жалобы — сразу человеку. Ни одна заявка не ждёт ответа дольше 4 часов.',
      en: 'Answer client and staff tickets quickly from the Brain knowledge base, drive each ticket to resolution, pass complex cases and complaints to a human right away. No ticket waits longer than 4 hours for a reply.',
      tr: 'Müşteri ve çalışan taleplerine Beyin’deki bilgi tabanına göre hızlı yanıt vermek, talebi çözüme götürmek, karmaşık durumları ve şikâyetleri hemen bir insana aktarmak. Hiçbir talep 4 saatten fazla yanıt beklemez.',
    },
    agents: [
      { title: { ru: 'Руководитель поддержки', en: 'Support lead', tr: 'Destek lideri' }, lead: true, prompt: { ru: 'Распределяешь заявки, следишь за сроком ответа и качеством, сложное передаёшь людям.', en: 'You distribute tickets, watch reply times and quality, and pass hard cases to people.', tr: 'Talepleri dağıtır, yanıt süresini ve kaliteyi izler, zor durumları insanlara aktarırsın.' } },
      { title: { ru: 'Первая линия', en: 'First line', tr: 'Birinci hat' }, prompt: { ru: 'Отвечаешь на заявки по базе знаний из «Мозга»: коротко, по шагам, на языке клиента. Не знаешь ответа — не выдумываешь, назначаешь человека.', en: 'You answer tickets from the Brain knowledge base: short, step by step, in the client’s language. If you do not know — never invent, assign a human.', tr: 'Talepleri Beyin’deki bilgi tabanına göre yanıtlarsın: kısa, adım adım, müşterinin dilinde. Bilmiyorsan uydurmaz, bir insan atarsın.' } },
      { title: { ru: 'Качество', en: 'Quality', tr: 'Kalite' }, prompt: { ru: 'Следишь за повторяющимися вопросами и жалобами, дополняешь базу знаний в «Мозге».', en: 'You track recurring questions and complaints and extend the knowledge base in the Brain.', tr: 'Tekrarlayan soruları ve şikâyetleri izler, Beyin’deki bilgi tabanını genişletirsin.' } },
    ],
    permissions: P({ crm: 'auto', msg: 'appr', tasks: 'auto' }),
    rules: ['no_client_send_without_approval', 'approve_sensitive', 'write_brain_notes'],
    connectors: ['crm', 'email', 'telegram', 'whatsapp'],
    kpis: ['tickets_open', 'tasks_waiting'],
  },
  {
    key: 'reception',
    color: '#c9d68f',
    name: { ru: 'Ресепшн и бронирования', en: 'Reception & bookings', tr: 'Resepsiyon ve rezervasyonlar' },
    mission: {
      ru: 'Чтобы каждый гость пришёл: подтверждать брони, напоминать накануне, разбирать неявки и неподтверждённые брони, после визита просить отзыв. Отмена брони — только с вашего согласия.',
      en: 'Make sure every guest shows up: confirm bookings, remind the day before, handle no-shows and unconfirmed bookings, ask for a review after the visit. Cancelling a booking only with your approval.',
      tr: 'Her misafirin gelmesini sağlamak: rezervasyonları onaylamak, bir gün önce hatırlatmak, gelmeyenleri ve onaylanmamış rezervasyonları ele almak, ziyaretten sonra yorum istemek. Rezervasyon iptali yalnızca onayınızla.',
    },
    agents: [
      { title: { ru: 'Администратор', en: 'Front desk lead', tr: 'Ön büro lideri' }, lead: true, prompt: { ru: 'Держишь расписание и брони в порядке, распределяешь задачи.', en: 'You keep the schedule and bookings in order and distribute tasks.', tr: 'Programı ve rezervasyonları düzenli tutar, görevleri dağıtırsın.' } },
      { title: { ru: 'Подтверждения и напоминания', en: 'Confirmations & reminders', tr: 'Onaylar ve hatırlatmalar' }, prompt: { ru: 'Подтверждаешь брони и напоминаешь гостям о визите: дата, время, адрес и как добраться — из «Мозга».', en: 'You confirm bookings and remind guests of their visit: date, time, address and directions from the Brain.', tr: 'Rezervasyonları onaylar, misafirlere ziyaretlerini hatırlatırsın: tarih, saat, adres ve yol tarifi Beyin’den.' } },
      { title: { ru: 'Гости после визита', en: 'After the visit', tr: 'Ziyaret sonrası' }, prompt: { ru: 'Благодаришь гостей, просишь отзыв по ссылке из «Мозга», тем, кто не пришёл, предлагаешь перенести визит.', en: 'You thank guests, ask for a review using the link from the Brain, and offer no-shows a new time.', tr: 'Misafirlere teşekkür eder, Beyin’deki bağlantıyla yorum ister, gelmeyenlere yeni bir saat önerirsin.' } },
    ],
    permissions: P({ stock: 'auto', msg: 'appr', crm: 'read', tasks: 'auto' }),
    rules: ['no_client_send_without_approval', 'approve_sensitive', 'write_brain_notes'],
    connectors: ['crm', 'email', 'telegram', 'whatsapp'],
    kpis: ['bookings_upcoming', 'tasks_waiting'],
  },
  {
    key: 'finance',
    color: '#b5c2ea',
    name: { ru: 'Финансы', en: 'Finance', tr: 'Finans' },
    mission: {
      ru: 'Следить за закрытыми сделками и оплатами, напоминать о просрочках и готовить финансовую сводку. Платежи — только с подтверждением человека.',
      en: 'Watch closed deals and payments, remind about overdue ones and prepare the finance summary. Payments only with human confirmation.',
      tr: 'Kapanan anlaşmaları ve ödemeleri izlemek, gecikenleri hatırlatmak ve finans özetini hazırlamak. Ödemeler yalnızca insan onayıyla.',
    },
    agents: [
      { title: { ru: 'Финдир', en: 'Finance lead', tr: 'Finans lideri' }, lead: true, prompt: { ru: 'Следишь за деньгами компании и распределяешь задачи отдела.', en: 'You watch the company’s money and distribute the department’s tasks.', tr: 'Şirketin parasını izler, departman görevlerini dağıtırsın.' } },
      { title: { ru: 'Сверка', en: 'Reconciliation', tr: 'Mutabakat' }, prompt: { ru: 'Сверяешь сделки и оплаты, находишь расхождения.', en: 'You reconcile deals and payments and find mismatches.', tr: 'Anlaşmaları ve ödemeleri karşılaştırır, tutarsızlıkları bulursun.' } },
      { title: { ru: 'Напоминания', en: 'Reminders', tr: 'Hatırlatmalar' }, prompt: { ru: 'Готовишь вежливые напоминания о просроченной оплате — через согласование.', en: 'You prepare polite overdue-payment reminders — through approval.', tr: 'Geciken ödemeler için kibar hatırlatmalar hazırlarsın — onay üzerinden.' } },
    ],
    permissions: P({ finance: 'appr', crm: 'read', msg: 'appr', tasks: 'auto', ads: 'auto' }),
    rules: ['no_client_send_without_approval', 'respect_daily_budget', 'write_brain_notes'],
    connectors: ['crm', 'email'],
    kpis: ['sales_won_30d', 'tasks_waiting'],
  },
];

export function getOfficeTemplate(key: string | null | undefined): OfficeTemplate | null {
  return OFFICE_TEMPLATES.find((t) => t.key === key) ?? null;
}

export function langOf(code: string | null | undefined): 'ru' | 'en' | 'tr' {
  return code === 'ru' || code === 'tr' ? code : 'en';
}

/** Шаги выполнения задачи (реальные фазы движка) и их вклад в процент готовности. */
export const OFFICE_TASK_STEPS = [
  { key: 'queued', progress: 0 },
  { key: 'context', progress: 12 }, // собирает данные CRM
  { key: 'brain', progress: 28 }, // сверяется с «Мозгом»
  { key: 'thinking', progress: 45 }, // модель решает, что делать
  { key: 'acting', progress: 70 }, // выполняет действия
  { key: 'reviewing', progress: 88 }, // фиксирует итог, пишет в «Мозг»
  { key: 'done', progress: 100 },
] as const;
export type OfficeTaskStep = (typeof OFFICE_TASK_STEPS)[number]['key'];
export const stepProgress = (s: OfficeTaskStep) => OFFICE_TASK_STEPS.find((x) => x.key === s)?.progress ?? 0;

/**
 * Модель ИИ-отделов на ключе платформы (решение владельца 2026-10-07: сильнее, чем gpt-4o-mini
 * у ИИ-сотрудников — анализы должны быть предметными). Цены в USD за 1M токенов — для честного
 * учёта расхода отдела и списания квоты. Переопределяется env без пересборки.
 */
export function officeModel(): { model: string; inPrice: number; outPrice: number } {
  return {
    model: process.env.AI_OFFICE_MODEL?.trim() || 'gpt-4.1',
    inPrice: Number(process.env.AI_OFFICE_PRICE_IN) || 2,
    outPrice: Number(process.env.AI_OFFICE_PRICE_OUT) || 8,
  };
}

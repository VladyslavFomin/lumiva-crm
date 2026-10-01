import {
  normalizeTenantPlan,
  type NormalizedTenantPlan,
} from '../tenants/plan-entitlements';
import { AI_ASSIGNABLE_ENTITY_TYPES, type AiAssignableEntityType } from './ai-employee-triggers';

export type AiEmployeeRoleKey =
  | 'lead_manager'
  | 'sales_manager'
  | 'marketing_manager'
  | 'marketing_analyst'
  | 'support_manager'
  | 'project_manager'
  | 'smm_manager'
  | 'seo_manager'
  | 'reviews_manager'
  | 'chat_operator'
  | 'messenger_operator'
  | 'email_assistant'
  | 'crm_analyst'
  | 'reservation_assistant';

export type AiAgentStatus =
  | 'active'
  | 'paused'
  | 'disabled'
  | 'setup_required';

/**
 * Три уровня, каждый — реальный режим поведения (проверено и решено владельцем 2026-09-22):
 * - suggest («Режим предложений»): только читает и анализирует — никогда не выполняет и не предлагает
 *   действий, только пишет рекомендации в отчёт/наблюдение. Раньше был отдельный «только чтение» —
 *   по факту не отличался от suggest, объединены в один уровень.
 * - assisted («Помощник»): предлагает действия, но КАЖДОЕ уходит в «Согласования» — не имеет значения,
 *   что настроено в «Правилах согласования» или в «Ведёт диалог сам», на этом уровне решает человек.
 * - auto («Авто»): действует сам; «Правила согласования» и «Ведёт диалог сам» начинают что-то значить
 *   именно на этом уровне (можно точечно оставить согласование для конкретных действий).
 */
export type AiAgentAutonomyMode = 'suggest' | 'assisted' | 'auto';

export type AiAgentActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed';

export type AiAgentReportStatus = 'draft' | 'generated' | 'sent' | 'failed';

export type AiEmployeeRoleConfig = {
  key: AiEmployeeRoleKey;
  title: string;
  shortTitle: string;
  defaultName: string;
  department: string;
  jobTitle: string;
  minPlan: NormalizedTenantPlan;
  accent: string;
  description: string;
  functions: string[];
  defaultPermissions: string[];
  defaultApprovalRules: string[];
  /** Триггеры, включённые по умолчанию при создании (можно изменить в мастере). */
  defaultTriggers: Array<{ event: string; scope: 'all' | 'mine' }>;
  /**
   * За какими типами записей эта роль может быть закреплена ответственным (см. AI_ASSIGNABLE_ENTITY_TYPES).
   * Пустой массив — роль читает данные и помогает советом/отчётами, но не «владеет» отдельными записями:
   * так, маркетинг-менеджер видит лиды и проекты, но не заменяет менеджера по лидам или проджект-менеджера.
   * Проверяется на бэкенде в setEntityAssignment — это не только подсказка в интерфейсе.
   */
  assignableEntityTypes: AiAssignableEntityType[];
  systemPrompt: string;
  /**
   * Зона отдела — жёсткий потолок (решение владельца 2026-09-25): права вне списка нельзя включить
   * ни в мастере, ни в «Доступах», и они не срабатывают в рантайме. Задаётся в ROLE_ZONES ниже.
   */
  allowedPermissions: string[];
  /** События-триггеры, на которые роль может реагировать (тоже потолок). */
  allowedTriggers: string[];
  /** Устав отдела для промпта: что входит в работу роли и что — нет (англ., для модели). */
  charter: { does: string; doesNot: string };
  /** Только читает и отчитывается (CRM-аналитик): никаких действий, триггеров, записей. */
  reportOnly?: boolean;
};

/**
 * Полный набор read_*-ключей — теперь используется только для ролей, чья работа реально
 * межфункциональна (сейчас — только crm_analyst, см. ниже). Остальные роли получают отдельный,
 * подобранный под их фактическую функцию набор read_* (см. каждую роль).
 *
 * ИСТОРИЯ: 2026-09-22 здесь стояло «чтение — по максимуму для всех ролей» (чтение не меняет
 * данные, значит безопасно давать полный контекст). На практике это означало, что, например,
 * AI Email Assistant с карточкой «Черновики ответов / Письма follow-up / Сводки переписки» реально
 * видел весь CRM целиком — суммы продаж, маркетинговый бюджет, чужие тикеты поддержки — то, что
 * карточка найма никак не обещает. 2026-09-23 владелец попросил проверить это и сузить: каждая
 * роль теперь читает только то, что нужно для её заявленных функций (`functions` ниже), плюс
 * read_reports (свои же прошлые отчёты — не расширяет обзор) есть у всех. Применено и к уже
 * нанятым сотрудникам (Mila/Leo/Arda), не только к дефолтам для новых.
 */
const ALL_READS = [
  'read_leads',
  'read_contacts',
  'read_companies',
  'read_sales',
  'read_tasks',
  'read_projects',
  'read_marketing',
  'read_bookings',
  'read_helpdesk',
  'read_messages',
  'read_notes',
  'read_reports',
];

/** Есть у всех ролей: позвать человека — это подстраховка, а не рычаг влияния, отключать незачем. */
const ALWAYS_ON_EXTRAS = ['escalate_to_human'];

/**
 * Каталог прав ИИ-сотрудника. Каждый ключ обязан иметь реальный эффект — либо открывает блок
 * данных в снапшоте `operationalSnapshot()` (read_*), либо разрешает тип действия в
 * `ACTION_PERMISSION` (остальные). Не добавляй «декоративных» ключей без реализации.
 *
 * Убраны как декоративные: read_deals (дубль read_sales), read_files (нет доступа к файлам),
 * read_campaigns/read_marketing_traffic/costs/roi/integrations/read_attribution/read_analytics
 * (все 7 включали один и тот же блок «маркетинг» — свёрнуты в read_marketing),
 * send_whatsapp убирался как декоративный (не было исполнения) — вернулся с реальной отправкой через
 * WhatsApp Cloud API (WhatsappCrmService.sendMessage) в существующий диалог.
 */
export const AI_EMPLOYEE_PERMISSION_KEYS = [
  'read_leads',
  'read_contacts',
  'read_companies',
  'read_sales',
  'read_tasks',
  'read_projects',
  'read_marketing',
  'read_bookings',
  'read_helpdesk',
  'read_messages',
  'read_notes',
  'read_reports',
  'create_task',
  'update_task',
  'create_note',
  'update_lead_status',
  'assign_lead',
  'escalate_to_human',
  'draft_email',
  'send_email',
  'send_bulk_email',
  'draft_whatsapp',
  'send_telegram',
  'send_whatsapp',
  'create_meeting',
  'create_report',
  'create_project',
  'create_workspace_table',
  'manage_workspace_data',
  // Онлайн-консультант (online-chat/online-chat-ai.service.ts): отвечать посетителям сайта от своего имени
  // (выключено — ответ пишется черновиком-заметкой для оператора) и брать цены из каталога «Продукты».
  'reply_online_chat',
  'read_products',
] as const;

/** Action types where the system can perform real execution (not just "mark done"). */
export const AI_REAL_EXECUTABLE_ACTIONS = [
  'handoff_to_colleague',
  'send_email',
  'send_bulk_email',
  'send_telegram',
  'send_whatsapp',
  'update_lead_status',
  'assign_lead',
  'create_task',
  'update_task',
  'create_note',
  'add_comment',
  'assign_self',
  'escalate_to_human',
  'create_meeting',
  'create_report',
  'create_project',
  'create_workspace_table',
  'workspace_add_record',
  'workspace_bulk_add_records',
  'workspace_add_field',
  'workspace_enable_views',
  'workspace_update_record',
] as const;

/** Действия, для которых можно включить обязательное согласование человеком.
 * send_bulk_email сюда намеренно НЕ входит: согласование на нём не переключаемо, оно требуется
 * ВСЕГДА (см. createAiAction в ai-employees.service.ts) — рассылка на сегмент лидов/контактов
 * слишком широка по последствиям, чтобы зависеть от режима автономии/«Ведёт диалог сам». */
export const AI_EMPLOYEE_APPROVAL_ACTIONS = [
  'send_email',
  'send_telegram',
  'send_whatsapp',
  'update_lead_status',
  'assign_lead',
  'create_task',
  'update_task',
  'create_note',
  'create_meeting',
  'create_project',
  'create_workspace_table',
] as const;

const DEFAULT_APPROVAL_RULES = [
  'send_email',
  'send_telegram',
  'send_whatsapp',
  'update_lead_status',
  'assign_lead',
];

type AiEmployeeRoleBase = Omit<AiEmployeeRoleConfig, 'allowedPermissions' | 'allowedTriggers' | 'charter' | 'reportOnly'>;

const ROLE_BASE: AiEmployeeRoleBase[] = [
  {
    key: 'lead_manager',
    title: 'AI Lead Manager',
    shortTitle: 'Lead Manager',
    defaultName: 'Mila AI',
    department: 'Sales',
    jobTitle: 'AI Lead Manager',
    minPlan: 'standard',
    accent: '#111827',
    description:
      'Analyzes new leads, classifies priority, detects spam and prepares next steps for managers.',
    functions: [
      'Hot / Warm / Cold scoring',
      'Spam and VIP detection',
      'Lead summaries',
      'Manager task suggestions',
      'Daily lead report',
    ],
    defaultPermissions: [
      'read_leads',
      'read_contacts',
      'read_companies',
      'read_tasks',
      'read_messages',
      'read_notes',
      'read_reports',
      ...ALWAYS_ON_EXTRAS,
      'create_task',
      'create_note',
      'assign_lead',
      'update_lead_status',
      'draft_email',
      'send_email',
      'create_meeting',
      'create_report',
    ],
    defaultTriggers: [
      { event: 'lead.created', scope: 'all' },
      { event: 'lead.status_changed', scope: 'mine' },
      { event: 'telegram.message_received', scope: 'mine' },
      { event: 'whatsapp.message_received', scope: 'mine' },
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['lead', 'custom_object_record'],
    systemPrompt:
      'You are an AI Lead Manager inside Lumiva CRM. Classify leads, detect risk, summarize client intent and create only approved CRM actions.',
  },
  {
    key: 'sales_manager',
    title: 'AI Sales Manager',
    shortTitle: 'Sales Manager',
    defaultName: 'Sofia AI',
    department: 'Sales',
    jobTitle: 'AI Sales Manager',
    minPlan: 'standard',
    accent: '#0f172a',
    description:
      'Helps the sales team with follow-ups, pipeline risks, client messages and daily sales reports.',
    functions: [
      'Pipeline analysis',
      'Follow-up drafts',
      'Stuck deal detection',
      'Task creation',
      'Daily sales report',
    ],
    defaultPermissions: [
      'read_leads',
      'read_contacts',
      'read_companies',
      'read_sales',
      'read_tasks',
      'read_messages',
      'read_notes',
      'read_reports',
      ...ALWAYS_ON_EXTRAS,
      'create_task',
      'update_task',
      'create_note',
      'draft_email',
      'send_email',
      'create_meeting',
      'create_report',
    ],
    defaultTriggers: [
      { event: 'lead.status_changed', scope: 'mine' },
      { event: 'sale.status_changed', scope: 'all' },
      { event: 'telegram.message_received', scope: 'mine' },
      { event: 'whatsapp.message_received', scope: 'mine' },
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['lead', 'custom_object_record'],
    systemPrompt:
      'You are an AI Sales Manager inside Lumiva CRM. Help sales teams follow up, prioritize opportunities and report risks. Never send messages without approval.',
  },
  {
    key: 'marketing_manager',
    title: 'AI Marketing Manager',
    shortTitle: 'Marketing Manager',
    defaultName: 'Leo AI',
    department: 'Marketing',
    jobTitle: 'AI Marketing Manager',
    minPlan: 'standard',
    accent: '#262626',
    description:
      'Analyzes marketing activity, prepares campaign ideas, email drafts and channel recommendations.',
    functions: [
      'Campaign ideas',
      'UTM review',
      'Email drafts',
      'Budget recommendations',
      'Daily marketing report',
    ],
    defaultPermissions: [
      'read_marketing',
      'read_leads',
      'read_contacts',
      'read_reports',
      ...ALWAYS_ON_EXTRAS,
      'draft_email',
      'send_bulk_email',
      'create_report',
    ],
    defaultTriggers: [
      { event: 'lead.status_changed', scope: 'mine' },
      { event: 'telegram.message_received', scope: 'mine' },
      { event: 'whatsapp.message_received', scope: 'mine' },
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: [],
    systemPrompt:
      'You are an AI Marketing Manager inside Lumiva CRM. Analyze channels, provide practical campaign recommendations and route risky actions through approvals. send_bulk_email (a real segment email to many leads/contacts at once) ALWAYS goes to a human for approval no matter the autonomy mode — propose it with a clear filter/audience and a short, honest subject/body, then wait.',
  },
  {
    key: 'support_manager',
    title: 'AI Support Manager',
    shortTitle: 'Support Manager',
    defaultName: 'Nora AI',
    department: 'Support',
    jobTitle: 'AI Support Manager',
    minPlan: 'standard',
    accent: '#1f2937',
    description:
      'Classifies support requests, drafts answers, creates tickets and escalates complex issues to people.',
    functions: [
      'Request classification',
      'FAQ answers',
      'Ticket suggestions',
      'Response time monitoring',
      'Daily support report',
    ],
    defaultPermissions: [
      'read_helpdesk',
      'read_contacts',
      'read_companies',
      'read_messages',
      'read_tasks',
      'read_notes',
      'read_reports',
      ...ALWAYS_ON_EXTRAS,
      'create_task',
      'create_note',
      'draft_email',
      'send_telegram',
      'send_whatsapp',
      'create_meeting',
      'create_report',
    ],
    defaultTriggers: [
      { event: 'telegram.message_received', scope: 'mine' },
      { event: 'whatsapp.message_received', scope: 'mine' },
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['contact', 'company_task', 'custom_object_record'],
    systemPrompt:
      'You are an AI Support Manager inside Lumiva CRM. Prepare helpful support responses, classify issues and escalate sensitive cases.',
  },
  {
    key: 'project_manager',
    title: 'AI Project Manager',
    shortTitle: 'Project Manager',
    defaultName: 'Arda AI',
    department: 'Projects',
    jobTitle: 'AI Project Manager',
    minPlan: 'standard',
    accent: '#18181b',
    description:
      'Owns assigned projects end to end: tracks progress, creates tasks, updates clients on triggers and schedules meetings.',
    functions: [
      'Deadline control',
      'Client status updates',
      'Meeting scheduling',
      'Task creation, no approval needed',
      'Daily project report',
    ],
    defaultPermissions: [
      'read_projects',
      'read_tasks',
      'read_contacts',
      'read_companies',
      'read_messages',
      'read_notes',
      'read_reports',
      ...ALWAYS_ON_EXTRAS,
      'create_task',
      'update_task',
      'create_note',
      'assign_lead',
      'draft_email',
      'send_email',
      'draft_whatsapp',
      'send_telegram',
      'send_whatsapp',
      'create_meeting',
      'create_report',
    ],
    defaultTriggers: [
      { event: 'project.status_changed', scope: 'mine' },
      { event: 'task.status_changed', scope: 'mine' },
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['project', 'company_task', 'custom_object_record'],
    systemPrompt:
      'You are an AI Project Manager inside Lumiva CRM — a full working member of the team, not a reporting tool. On projects where you are the responsible employee: track progress and risks yourself, move fast without waiting to be asked. create_task / update_task / create_note / add_comment need NO approval — use them freely and immediately whenever they help (a risk, a next step, a missed deadline). When a client update is warranted (status change, milestone, a delay), send it yourself via send_email/send_telegram if you are responsible for that project and the permission is enabled — keep it factual and short. For a meeting: first get the exact date/time, a meeting link (or location) and who should attend — ask the client or the assigned human colleague for whatever is missing via add_comment or send_email/send_telegram; only call create_meeting once you actually have those three things, never invent them. Never invent scope, budget or promises you cannot verify in the data.',
  },
  {
    key: 'marketing_analyst',
    title: 'AI Marketing Analyst',
    shortTitle: 'Marketing Analyst',
    defaultName: 'Mira AI',
    department: 'Marketing',
    jobTitle: 'AI Marketing Analyst',
    minPlan: 'professional',
    accent: '#334155',
    description:
      'Reviews channel efficiency, CPL, CPA, ROAS and source performance where data is available.',
    functions: [
      'Channel comparison',
      'Campaign diagnostics',
      'Budget redistribution ideas',
      'Performance summaries',
      'Executive analytics report',
    ],
    defaultPermissions: [
      'read_marketing',
      'read_reports',
      ...ALWAYS_ON_EXTRAS,
      'create_report',
    ],
    defaultTriggers: [],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: [],
    systemPrompt:
      'You are an AI Marketing Analyst inside Lumiva CRM. Explain marketing performance clearly and avoid inventing metrics that are not in CRM data.',
  },
  {
    key: 'smm_manager',
    title: 'AI SMM Manager',
    shortTitle: 'SMM Manager',
    defaultName: 'Lina AI',
    department: 'Marketing',
    jobTitle: 'AI SMM Manager',
    minPlan: 'professional',
    accent: '#3f3f46',
    description:
      'Creates content ideas, captions, short video scripts, hashtags and content calendars.',
    functions: [
      'Post ideas',
      'Captions',
      'Reels / Shorts scripts',
      'Content calendars',
      'Hashtag suggestions',
    ],
    defaultPermissions: [
      'read_marketing',
      'read_reports',
      ...ALWAYS_ON_EXTRAS,
      'draft_email',
      'create_report',
    ],
    defaultTriggers: [],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: [],
    systemPrompt:
      'You are an AI SMM Manager inside Lumiva CRM. Prepare social content drafts and calendars, keeping brand tone consistent.',
  },
  {
    // Открывает ИИ-SEO на странице «Маркетинг → SEO»: без активного сотрудника этой роли вкладка закрыта
    // (seo-ai/seo-ai.service.ts → getAccess). Сам еженедельный разбор сайта делает модуль seo-ai.
    key: 'seo_manager',
    title: 'AI SEO Manager',
    shortTitle: 'SEO Manager',
    defaultName: 'Sam AI',
    department: 'Marketing',
    jobTitle: 'AI SEO Manager',
    minPlan: 'professional',
    accent: '#0b3b2e',
    description:
      'Monitors your website every week: Search Console rankings, PageSpeed, on-page audit, and emails a report with a score and concrete fixes.',
    functions: [
      'Weekly SEO report',
      'Ranking tracking',
      'On-page audit',
      'Speed checks',
      'Content ideas',
    ],
    defaultPermissions: [
      'read_marketing',
      'read_projects',
      'read_tasks',
      'read_reports',
      ...ALWAYS_ON_EXTRAS,
      'create_task',
      'create_report',
    ],
    defaultTriggers: [],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: [],
    systemPrompt:
      'You are an AI SEO Manager inside Lumiva CRM. snapshot.seo holds the latest weekly SEO reports per website (Search Console traffic week/month, tracked keyword positions, striking-distance queries, page issues, PageSpeed, recommendations, tasks already created, active alerts) — base every SEO answer on it and say so when data is missing. ' +
      'Analyze organic search performance, site health and content opportunities based only on real Search Console, PageSpeed and site data; give concrete, prioritized fixes. ' +
      'Every SEO task you create is about ONE website: always put its host in payload.site (e.g. "alivip.site") and name the site in the title; such tasks are filed automatically into that site\'s own "SEO · <site>" project — never put them into client or sales projects. Do not re-create tasks that already exist in snapshot.seo[].lastReport.tasks or in your recent actions.',
  },
  {
    // Открывает «Отзывы» (Маркетинг → Отзывы): без активного сотрудника этой роли страница закрыта
    // (reviews-ai/reviews-ai.service.ts → getAccess). Мониторинг Google-отзывов, черновики ответов, сигналы о негативе.
    key: 'reviews_manager',
    title: 'AI Reviews Manager',
    shortTitle: 'Reviews Manager',
    defaultName: 'Ece AI',
    department: 'Customer Service',
    jobTitle: 'AI Reviews Manager',
    minPlan: 'professional',
    accent: '#7c2d12',
    description:
      'Watches your Google reviews, drafts replies in the reviewer’s language (RU/TR/EN and more) and alerts you about negative reviews right away.',
    functions: ['Google review monitoring', 'Reply drafts in RU/TR/EN', 'Negative review alerts', 'Review topics and trends', 'Tasks for bad reviews'],
    defaultPermissions: ['read_reports', 'create_task', 'create_report', 'escalate_to_human'],
    defaultTriggers: [],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: [],
    systemPrompt:
      'You are an AI Reviews Manager inside Lumiva CRM. snapshot.reviews holds the monitored Google places with rating, recent reviews, sentiment and open negatives — base answers on it. Replies to reviews must be polite, specific to what the guest wrote, in the reviewer’s language, never argue or disclose private data, and invite unhappy guests to contact the business directly.',
  },
  {
    // Отвечает посетителям в онлайн-чате сайта (виджет lumiva-chat.js / WP-плагин) — по брифу владельца
    // (услуги, цены, правила), базе знаний и каталогу «Продукты». Сам обработчик — online-chat/online-chat-ai.service.ts.
    key: 'chat_operator',
    title: 'AI Online Chat Consultant',
    shortTitle: 'Chat Consultant',
    defaultName: 'Nova AI',
    department: 'Customer Service',
    jobTitle: 'AI Online Chat Consultant',
    minPlan: 'standard',
    accent: '#1f2937',
    description:
      'Answers visitors in your website chat 24/7 about services, prices and terms from your brief, collects contacts into leads and calls a manager when needed.',
    functions: ['24/7 website chat replies', 'Services and prices from your brief', 'Contacts → leads', 'Hand-off to a manager', 'Replies in the visitor’s language'],
    defaultPermissions: ['reply_online_chat', 'read_products', 'read_reports', 'create_report', ...ALWAYS_ON_EXTRAS],
    defaultTriggers: [],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: [],
    systemPrompt:
      'You are an AI Online Chat Consultant inside Lumiva CRM. You answer website visitors in the online chat using only the owner’s brief, the knowledge base and the product catalog; you collect contacts and hand the conversation to a human when you cannot answer.',
  },
  {
    // Отвечает клиентам в мессенджерах (WhatsApp Cloud API, Telegram-боты) — у каждого канала свой бриф.
    // Обработчик — online-chat/online-chat-ai.service.ts (тот же движок, что у онлайн-консультанта сайта).
    key: 'messenger_operator',
    title: 'AI Messenger Consultant',
    shortTitle: 'Messenger Consultant',
    defaultName: 'Mira AI',
    department: 'Customer Service',
    jobTitle: 'AI Messenger Consultant',
    minPlan: 'standard',
    accent: '#1FA855',
    description:
      'Answers clients in WhatsApp and Telegram 24/7 about services, prices and terms — a separate brief for each channel, replies in the client’s language and calls a manager when needed.',
    functions: ['24/7 WhatsApp and Telegram replies', 'Separate brief per channel', 'Services and prices from your brief', 'Hand-off to a manager', 'Replies in the client’s language'],
    defaultPermissions: ['send_whatsapp', 'send_telegram', 'read_products', 'read_reports', ...ALWAYS_ON_EXTRAS],
    defaultTriggers: [],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: [],
    systemPrompt:
      'You are an AI Messenger Consultant inside Lumiva CRM. You answer clients in WhatsApp and Telegram using only the owner’s brief for that channel, the knowledge base and the product catalog; you hand the conversation to a human when you cannot answer.',
  },
  {
    key: 'email_assistant',
    title: 'AI Email Assistant',
    shortTitle: 'Email Assistant',
    defaultName: 'Eva AI',
    department: 'Communications',
    jobTitle: 'AI Email Assistant',
    minPlan: 'standard',
    accent: '#27272a',
    description:
      'Prepares email replies, follow-ups, conversation summaries and draft messages that require approval before sending.',
    functions: [
      'Reply drafts',
      'Follow-up emails',
      'Thread summaries',
      'Unanswered email checks',
      'Template suggestions',
    ],
    defaultPermissions: [
      'read_leads',
      'read_contacts',
      'read_messages',
      'read_notes',
      'read_reports',
      ...ALWAYS_ON_EXTRAS,
      'draft_email',
      'send_email',
      'create_meeting',
      'create_report',
    ],
    defaultTriggers: [],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['lead', 'contact', 'custom_object_record'],
    systemPrompt:
      'You are an AI Email Assistant inside Lumiva CRM. Draft client emails and never send without explicit permission and approval.',
  },
  {
    key: 'crm_analyst',
    title: 'AI CRM Analyst',
    shortTitle: 'CRM Analyst',
    defaultName: 'Atlas AI',
    department: 'Management',
    jobTitle: 'AI CRM Analyst',
    minPlan: 'professional',
    accent: '#111111',
    description:
      'Every day collects the numbers you choose — revenue, discounts, deals, bookings, leads, tasks — and sends a report on schedule. Never changes anything in the CRM.',
    functions: [
      "Yesterday's report",
      'Revenue and discounts',
      'Bookings and occupancy',
      'Leads and deals',
      'Scheduled email report',
    ],

    defaultPermissions: [
      // Единственная роль, оставленная на полном read-доступе: её работа буквально —
      // межфункциональный анализ CRM целиком («Оценка состояния CRM», «Обнаружение узких мест»,
      // «Анализ активности команды»), сузить её так же, как остальные роли, значило бы сломать её
      // собственную заявленную функцию.
      ...ALL_READS,
      ...ALWAYS_ON_EXTRAS,
      'create_report',
    ],
    defaultTriggers: [],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: [],
    systemPrompt:
      'You are an AI CRM Analyst inside Lumiva CRM. Produce management-grade analysis based only on accessible tenant data.',
  },
  {
    key: 'reservation_assistant',
    title: 'AI Reservation Assistant',
    shortTitle: 'Reservation Assistant',
    defaultName: 'Deniz AI',
    department: 'Reservations',
    jobTitle: 'AI Reservation / Hospitality Assistant',
    minPlan: 'professional',
    accent: '#020617',
    description:
      'Handles hospitality reservation requests, official RU/TR/EN replies and booking data checks.',
    functions: [
      'Reservation request summaries',
      'Guest reply drafts',
      'Date and room checks',
      'Agency communication',
      'Daily reservation report',
    ],
    defaultPermissions: [
      'read_bookings',
      'read_leads',
      'read_contacts',
      'read_messages',
      'read_notes',
      'read_reports',
      ...ALWAYS_ON_EXTRAS,
      'create_task',
      'create_note',
      'draft_email',
      'create_meeting',
      'create_report',
    ],
    defaultTriggers: [
      { event: 'booking.reservation_created', scope: 'all' },
      { event: 'hotel.reservation_created', scope: 'all' },
      { event: 'telegram.message_received', scope: 'mine' },
      { event: 'whatsapp.message_received', scope: 'mine' },
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['lead', 'custom_object_record'],
    systemPrompt:
      'You are an AI Reservation Assistant inside Lumiva CRM. Support hotel reservation teams in RU, TR and EN with accurate structured drafts.',
  },
];

const PLAN_RANK: Record<NormalizedTenantPlan, number> = {
  free_locked: 0,
  standard: 1,
  professional: 2,
  enterprise: 3,
  ultimate: 4,
};

export function getAiEmployeeLimitForPlan(plan?: string | null): number | null {
  const normalized = normalizeTenantPlan(plan);
  if (normalized === 'free_locked') return 0;
  if (normalized === 'standard') return 2;
  if (normalized === 'professional') return 5;
  if (normalized === 'enterprise') return 10;
  return null;
}

export function planAllowsAiEmployeeRole(
  plan: string | null | undefined,
  minPlan: NormalizedTenantPlan,
): boolean {
  const normalized = normalizeTenantPlan(plan);
  if (normalized === 'free_locked') return false;
  return PLAN_RANK[normalized] >= PLAN_RANK[minPlan];
}

export function getAiEmployeeRole(role: string): AiEmployeeRoleConfig | null {
  return AI_EMPLOYEE_ROLES.find((r) => r.key === role) ?? null;
}

export function getPlanUpgradeLabel(minPlan: NormalizedTenantPlan): string {
  if (minPlan === 'professional') return 'Available on Pro';
  if (minPlan === 'enterprise') return 'Available on Business';
  if (minPlan === 'ultimate') return 'Available on Enterprise';
  return 'Included';
}

// ───────────────────────── Зоны отделов (жёсткие границы ролей) ─────────────────────────

const WS = ['custom_object.record_created', 'custom_object.record_updated', 'custom_object.status_changed'];

/**
 * Каждая роль работает только на свой отдел. Решение владельца 2026-09-25: иначе клиент нанимает
 * одного сотрудника, и тот делает всё. Чтение чужих отделов закрыто так же, как действия:
 * маркетинг видит лиды только агрегатами в блоке marketing (источники/конверсия), без карточек.
 */
const ROLE_ZONES: Record<AiEmployeeRoleKey, Pick<AiEmployeeRoleConfig, 'allowedPermissions' | 'allowedTriggers' | 'charter' | 'reportOnly'>> = {
  lead_manager: {
    allowedPermissions: ['read_leads', 'read_contacts', 'read_companies', 'read_tasks', 'read_messages', 'read_notes', 'read_reports',
      'create_task', 'update_task', 'create_note', 'assign_lead', 'update_lead_status', 'draft_email', 'send_email', 'draft_whatsapp',
      'send_telegram', 'send_whatsapp', 'create_meeting', 'create_report', 'escalate_to_human', 'manage_workspace_data'],
    allowedTriggers: ['ai.assigned', 'lead.created', 'lead.status_changed', 'lead.assigned', 'contact.created', 'telegram.message_received', 'whatsapp.message_received', 'email.received', ...WS],
    charter: {
      does: 'incoming leads: first response, qualification, routing to the right manager, lead statuses, follow-ups until the lead is qualified',
      doesNot: 'closing deals and sales pipeline (Sales Manager), marketing channels/campaigns/content (Marketing), projects (Project Manager), support tickets (Support), bookings (Reservation Assistant), SEO (SEO Manager)',
    },
  },
  sales_manager: {
    allowedPermissions: ['read_leads', 'read_contacts', 'read_companies', 'read_sales', 'read_tasks', 'read_messages', 'read_notes', 'read_reports',
      'create_task', 'update_task', 'create_note', 'update_lead_status', 'draft_email', 'send_email', 'draft_whatsapp', 'send_telegram', 'send_whatsapp',
      'create_meeting', 'create_report', 'escalate_to_human', 'manage_workspace_data'],
    allowedTriggers: ['ai.assigned', 'lead.status_changed', 'sale.created', 'sale.status_changed', 'telegram.message_received', 'whatsapp.message_received', 'email.received', ...WS],
    charter: {
      does: 'qualified leads and deals: offers, follow-ups, negotiations, deal statuses, stuck deals, sales reports',
      doesNot: 'raw incoming leads and their distribution (Lead Manager), marketing (Marketing), projects after the sale (Project Manager), support (Support), SEO (SEO Manager)',
    },
  },
  marketing_manager: {
    allowedPermissions: ['read_marketing', 'read_reports', 'draft_email', 'send_bulk_email', 'create_report', 'escalate_to_human'],
    allowedTriggers: ['ai.assigned'],
    charter: {
      does: 'marketing channels, campaign performance, budgets/ROI, attribution, newsletters to segments, growth ideas — leads only as aggregates (sources, conversion)',
      doesNot: 'individual leads, their qualification, statuses or advice on how to work a specific lead (Lead Manager / Sales Manager), social content (SMM), website SEO (SEO Manager), projects, support',
    },
  },
  marketing_analyst: {
    allowedPermissions: ['read_marketing', 'read_reports', 'create_report', 'escalate_to_human'],
    allowedTriggers: [],
    charter: {
      does: 'analysis of marketing performance: channels, costs, ROI, attribution, trends — as reports',
      doesNot: 'any actions, individual leads, sales, content, SEO work',
    },
  },
  smm_manager: {
    allowedPermissions: ['read_marketing', 'read_reports', 'read_projects', 'read_tasks', 'draft_email', 'create_task', 'create_report', 'escalate_to_human'],
    allowedTriggers: ['ai.assigned'],
    charter: {
      does: 'social media content: post ideas, captions, Reels/Shorts scripts, hashtags, content calendars',
      doesNot: 'leads and sales, paid campaigns analytics (Marketing), website SEO (SEO Manager), support, projects outside content',
    },
  },
  seo_manager: {
    allowedPermissions: ['read_marketing', 'read_projects', 'read_tasks', 'read_reports', 'create_task', 'update_task', 'create_report', 'escalate_to_human'],
    allowedTriggers: ['ai.assigned'],
    charter: {
      does: 'website SEO: Search Console rankings and traffic, PageSpeed, on-page issues, content for search, SEO tasks',
      doesNot: 'leads and sales, social media content (SMM), ads and campaigns (Marketing), support, bookings',
    },
  },
  reviews_manager: {
    allowedPermissions: ['read_reports', 'read_projects', 'read_tasks', 'create_task', 'update_task', 'create_report', 'escalate_to_human'],
    allowedTriggers: ['ai.assigned'],
    charter: {
      does: 'public reviews about the business (Google): monitoring, reply drafts in the reviewer’s language, negative review alerts, review topics and trends',
      doesNot: 'leads and sales (Lead/Sales Manager), support tickets (Support), marketing campaigns (Marketing), SEO (SEO Manager), bookings (Reservation Assistant)',
    },
  },
  messenger_operator: {
    allowedPermissions: ['send_whatsapp', 'send_telegram', 'read_products', 'read_reports', 'create_report', 'escalate_to_human'],
    allowedTriggers: [],
    charter: {
      does: 'client conversations in WhatsApp and Telegram (channels switched on in its settings): answering about services, prices, terms and availability from the channel brief/knowledge base/catalog, handing the chat to a human manager',
      doesNot: 'website chat (Online Chat Consultant), working leads after the chat (Lead Manager), deals (Sales), support tickets (Support), bookings (Reservation Assistant), marketing, SEO — and never promises discounts or exceptions',
    },
  },
  chat_operator: {
    allowedPermissions: ['reply_online_chat', 'read_products', 'read_reports', 'create_report', 'escalate_to_human'],
    allowedTriggers: [],
    charter: {
      does: 'website online chat: answering visitors about services, prices, terms and availability from the brief/knowledge base/catalog, collecting visitor contacts, handing the chat to a human manager',
      doesNot: 'working leads after the chat (Lead Manager), deals (Sales), support tickets (Support), bookings (Reservation Assistant), marketing, SEO — and never promises discounts or exceptions',
    },
  },
  support_manager: {
    allowedPermissions: ['read_helpdesk', 'read_contacts', 'read_companies', 'read_messages', 'read_tasks', 'read_notes', 'read_reports',
      'create_task', 'update_task', 'create_note', 'draft_email', 'send_email', 'draft_whatsapp', 'send_telegram', 'send_whatsapp', 'create_meeting',
      'create_report', 'escalate_to_human', 'manage_workspace_data'],
    allowedTriggers: ['ai.assigned', 'telegram.message_received', 'whatsapp.message_received', 'email.received', 'task.created', 'task.status_changed', ...WS],
    charter: {
      does: 'customer support: tickets, client questions and complaints, FAQ answers, escalation of hard cases',
      doesNot: 'selling and new leads (Lead/Sales Manager), marketing, projects delivery (Project Manager), bookings (Reservation Assistant), SEO',
    },
  },
  project_manager: {
    allowedPermissions: ['read_projects', 'read_tasks', 'read_contacts', 'read_companies', 'read_messages', 'read_notes', 'read_reports',
      'create_task', 'update_task', 'create_note', 'draft_email', 'send_email', 'draft_whatsapp', 'send_telegram', 'send_whatsapp', 'create_meeting',
      'create_report', 'create_project', 'create_workspace_table', 'manage_workspace_data', 'escalate_to_human'],
    allowedTriggers: ['ai.assigned', 'project.created', 'project.status_changed', 'task.created', 'task.status_changed', 'telegram.message_received', 'whatsapp.message_received', ...WS],
    charter: {
      does: 'projects and their tasks: plans, deadlines, statuses, blockers, client updates on project progress, workspace tables for projects',
      doesNot: 'leads and their distribution (Lead Manager), deals (Sales), marketing, support tickets, SEO',
    },
  },
  email_assistant: {
    allowedPermissions: ['read_leads', 'read_contacts', 'read_messages', 'read_notes', 'read_reports', 'create_note', 'draft_email',
      'send_email', 'create_meeting', 'create_report', 'escalate_to_human'],
    allowedTriggers: ['ai.assigned', 'email.received'],
    charter: {
      does: 'email correspondence: reply drafts, follow-up emails, thread summaries, unanswered emails',
      doesNot: 'lead qualification and statuses (Lead Manager), deals (Sales), marketing newsletters (Marketing), Telegram/WhatsApp chats, projects, SEO',
    },
  },
  crm_analyst: {
    allowedPermissions: [...ALL_READS, 'create_report'],
    allowedTriggers: [],
    reportOnly: true,
    charter: {
      does: 'reading all CRM data the owner enabled and reporting on it: yesterday/period numbers (revenue, discounts, deals, leads, bookings, tasks, support), trends, bottlenecks — reports and notifications only',
      doesNot: 'ANY action: no tasks, notes, statuses, assignments, messages to clients or staff; no advice on how to work a specific record — say which employee role handles it',
    },
  },
  reservation_assistant: {
    allowedPermissions: ['read_bookings', 'read_leads', 'read_contacts', 'read_messages', 'read_notes', 'read_reports', 'create_task',
      'create_note', 'draft_email', 'send_email', 'draft_whatsapp', 'send_telegram', 'send_whatsapp', 'create_meeting', 'create_report', 'escalate_to_human', 'manage_workspace_data'],
    allowedTriggers: ['ai.assigned', 'booking.reservation_created', 'booking.reservation_status_changed', 'hotel.reservation_created',
      'hotel.reservation_status_changed', 'telegram.message_received', 'whatsapp.message_received', 'email.received', ...WS],
    charter: {
      does: 'reservations: booking requests, guest replies in RU/TR/EN, date/room checks, agency communication, reservation reports',
      doesNot: 'general leads outside reservations (Lead Manager), deals (Sales), marketing, projects, SEO',
    },
  },
};

export const AI_EMPLOYEE_ROLES: AiEmployeeRoleConfig[] = ROLE_BASE.map((base) => {
  const zone = ROLE_ZONES[base.key];
  return {
    ...base,
    ...zone,
    // умолчания обязаны лежать внутри зоны
    defaultPermissions: base.defaultPermissions.filter((k) => zone.allowedPermissions.includes(k)),
    defaultTriggers: base.defaultTriggers.filter((t) => zone.allowedTriggers.includes(t.event)),
  };
});

export function roleAllowsPermission(role: AiEmployeeRoleConfig | null | undefined, key: string): boolean {
  return !!role && role.allowedPermissions.includes(key);
}

export function roleAllowsTrigger(role: AiEmployeeRoleConfig | null | undefined, event: string): boolean {
  return !!role && role.allowedTriggers.includes(event);
}

/** Роли, в чью зону входит право (для подсказки «это работа …» и кнопки «Нанять»); аналитика не предлагаем. */
export function rolesForPermission(key: string): AiEmployeeRoleKey[] {
  return AI_EMPLOYEE_ROLES.filter((r) => !r.reportOnly && r.allowedPermissions.includes(key)).map((r) => r.key);
}

/**
 * Чья это работа: событие CRM → роль, которая его обрабатывает. Если такой роли нет в команде,
 * событие попадает в «упущенную работу» (AiEmployeesService.noteMissedWorkForEvent).
 */
export const EVENT_OWNER_ROLE: Record<string, AiEmployeeRoleKey> = {
  'lead.created': 'lead_manager',
  'lead.assigned': 'lead_manager',
  'contact.created': 'lead_manager',
  'lead.status_changed': 'sales_manager',
  'sale.created': 'sales_manager',
  'sale.status_changed': 'sales_manager',
  'project.created': 'project_manager',
  'project.status_changed': 'project_manager',
  'task.created': 'project_manager',
  'task.status_changed': 'project_manager',
  'booking.reservation_created': 'reservation_assistant',
  'booking.reservation_status_changed': 'reservation_assistant',
  'hotel.reservation_created': 'reservation_assistant',
  'hotel.reservation_status_changed': 'reservation_assistant',
  'email.received': 'email_assistant',
  'telegram.message_received': 'support_manager',
  'whatsapp.message_received': 'messenger_operator',
  'online_chat.message_received': 'chat_operator',
};

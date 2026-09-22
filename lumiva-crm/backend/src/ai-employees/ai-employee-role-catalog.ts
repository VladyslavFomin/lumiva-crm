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
};

/**
 * «Чтение — по максимуму» (по решению владельца от 2026-09-22): любой ИИ-сотрудник, независимо от роли,
 * видит все доступные модули CRM — это безопасно (чтение не меняет данные) и даёт ему полный контекст
 * для более осмысленных решений. Ограничивать роль имеет смысл только в ДЕЙСТВИЯХ (кто может писать
 * клиенту, назначать записи, создавать встречи и т.д.) — это остаётся индивидуальным для каждой роли ниже.
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
 * send_whatsapp (исполнения не было — действие «выполнялось» без отправки; остался draft_whatsapp).
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
  'create_meeting',
  'create_report',
  'create_project',
  'create_workspace_table',
  'manage_workspace_data',
] as const;

/** Action types where the system can perform real execution (not just "mark done"). */
export const AI_REAL_EXECUTABLE_ACTIONS = [
  'send_email',
  'send_bulk_email',
  'send_telegram',
  'update_lead_status',
  'assign_lead',
  'create_task',
  'update_task',
  'create_note',
  'add_comment',
  'assign_self',
  'escalate_to_human',
  'create_meeting',
  'create_project',
  'create_workspace_table',
  'workspace_add_record',
  'workspace_bulk_add_records',
  'workspace_add_field',
  'workspace_enable_views',
] as const;

/** Действия, для которых можно включить обязательное согласование человеком.
 * send_bulk_email сюда намеренно НЕ входит: согласование на нём не переключаемо, оно требуется
 * ВСЕГДА (см. createAiAction в ai-employees.service.ts) — рассылка на сегмент лидов/контактов
 * слишком широка по последствиям, чтобы зависеть от режима автономии/«Ведёт диалог сам». */
export const AI_EMPLOYEE_APPROVAL_ACTIONS = [
  'send_email',
  'send_telegram',
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
  'update_lead_status',
  'assign_lead',
];

export const AI_EMPLOYEE_ROLES: AiEmployeeRoleConfig[] = [
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
      ...ALL_READS,
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
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['lead'],
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
      ...ALL_READS,
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
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['lead'],
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
      ...ALL_READS,
      ...ALWAYS_ON_EXTRAS,
      'draft_email',
      'send_bulk_email',
      'create_report',
    ],
    defaultTriggers: [
      { event: 'lead.status_changed', scope: 'mine' },
      { event: 'telegram.message_received', scope: 'mine' },
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
      ...ALL_READS,
      ...ALWAYS_ON_EXTRAS,
      'create_task',
      'create_note',
      'draft_email',
      'send_telegram',
      'create_meeting',
      'create_report',
    ],
    defaultTriggers: [
      { event: 'telegram.message_received', scope: 'mine' },
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['contact', 'company_task'],
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
      ...ALL_READS,
      ...ALWAYS_ON_EXTRAS,
      'create_task',
      'update_task',
      'create_note',
      'assign_lead',
      'draft_email',
      'send_email',
      'draft_whatsapp',
      'send_telegram',
      'create_meeting',
      'create_report',
    ],
    defaultTriggers: [
      { event: 'project.status_changed', scope: 'mine' },
      { event: 'task.status_changed', scope: 'mine' },
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['project', 'company_task'],
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
      ...ALL_READS,
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
      ...ALL_READS,
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
      ...ALL_READS,
      ...ALWAYS_ON_EXTRAS,
      'draft_email',
      'send_email',
      'create_meeting',
      'create_report',
    ],
    defaultTriggers: [],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['lead', 'contact'],
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
      'Analyzes CRM activity, sales, leads, tasks and process bottlenecks for leadership.',
    functions: [
      'CRM health review',
      'Bottleneck detection',
      'Management reports',
      'Team activity analysis',
      'Process recommendations',
    ],
    defaultPermissions: [
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
      ...ALL_READS,
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
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    assignableEntityTypes: ['lead'],
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

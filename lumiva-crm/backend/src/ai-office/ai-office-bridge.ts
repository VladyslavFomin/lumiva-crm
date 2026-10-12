import type { AiAgentAction } from '../ai-employees/ai-agent-action.entity';
import type { AiEmployeeRoleConfig } from '../ai-employees/ai-employee-role-catalog';
import { AI_EMPLOYEE_PERMISSION_KEYS } from '../ai-employees/ai-employee-role-catalog';
import type { AiDepartment } from './ai-department.entity';

/**
 * Связка ИИ-офиса с движком ИИ-сотрудников.
 *
 * Агент отдела — обычная строка ai_agents (role = 'office_agent', department_id = отдел). Его
 * исполняет тот же движок (AiEmployeesService.executeEmployeeRunCore) со всеми защитами, но:
 *  - потолок прав и согласования задаёт матрица отдела (ai-office-catalog.matrixGrants), а не
 *    персональные строки ai_agent_permissions;
 *  - события CRM приходят в отдел (AiOfficeEngine), а не агенту напрямую;
 *  - есть офисные действия: передать задачу другому отделу, попросить помощи, записать в «Мозг»,
 *    а также действия коннекторов Notion/Canva/GitHub.
 *
 * AiOfficeService регистрирует хуки при старте (registerOfficeHooks) — так AiEmployeesModule не
 * зависит от AiOfficeModule (иначе цикл импортов).
 */

export const OFFICE_AGENT_ROLE_KEY = 'office_agent';

/** Действия, которые есть только у агентов отделов (их исполняет AiOfficeService). */
export const OFFICE_ACTION_PERMISSION: Record<string, string> = {
  office_handoff: 'escalate_to_human',
  office_request_help: 'escalate_to_human',
  brain_write: 'read_reports',
  notion_create_page: 'notion_create_page',
  notion_append: 'notion_append',
  canva_create_design: 'canva_create_design',
  github_create_issue: 'github_create_issue',
  github_comment: 'github_comment',
  // ревью PR (COMMENT / REQUEST_CHANGES, никогда APPROVE) — то же право, что и комментарий
  github_review: 'github_comment',
  // коммерческое предложение из «Мои документы» с отправкой клиенту — это сообщение клиенту, деньги → всегда владелец
  create_quote: 'send_email',
  // пауза/включение/дневной бюджет кампании в Google Ads / Meta — деньги → всегда владелец
  ads_campaign_control: 'ads_manage',
  // письмо клиенту со ссылкой на оплату продажи (iyzico/PayTR/ЮKassa) — деньги → всегда владелец
  send_payment_link: 'send_email',
  // заказ поставщику (письмо с позициями и количеством) — деньги → всегда владелец
  stock_purchase_order: 'stock_purchase_order',
  // ответ в заявке helpdesk (уходит клиенту в канал заявки) и смена статуса/приоритета/ответственного
  helpdesk_reply: 'helpdesk_reply',
  helpdesk_update: 'helpdesk_update',
  // письмо гостю по брони (напоминание, подтверждение, отзыв) и смена статуса брони (отмена → всегда владелец)
  send_booking_message: 'send_booking_message',
  booking_update: 'booking_update',
  // публикация в Telegram-канал компании (публично, на всех подписчиков) → всегда владелец
  publish_telegram_post: 'publish_telegram_post',
  // контент-план с расписанием постов: одобряет владелец, дальше посты выходят сами (автопостинг)
  content_plan: 'content_plan',
  // Jira: задача в проекте компании; Slack: сообщение команде (внутреннее)
  jira_create_issue: 'jira_create_issue',
  slack_post: 'slack_post',
  // отметить продажу оплаченной по успешному платежу шлюза (сверка) → всегда владелец
  sale_confirm_payment: 'sale_confirm_payment',
};
export const OFFICE_ACTIONS = Object.keys(OFFICE_ACTION_PERMISSION);

const OFFICE_EXTRA_KEYS = ['notion_read', 'canva_read', 'github_read', 'jira_read', ...new Set(Object.values(OFFICE_ACTION_PERMISSION))];

/** Синтетическая роль: потолок — все ключи; реальная граница — матрица отдела. В каталог найма не входит. */
export const OFFICE_AGENT_ROLE: AiEmployeeRoleConfig = {
  key: OFFICE_AGENT_ROLE_KEY as any,
  title: 'AI Department Agent',
  shortTitle: 'Department Agent',
  defaultName: 'Agent',
  department: 'AI Office',
  jobTitle: 'AI Department Agent',
  minPlan: 'enterprise',
  accent: '#1d1f20',
  description: 'Agent of an AI department',
  functions: [],
  defaultPermissions: [],
  defaultApprovalRules: [],
  defaultTriggers: [],
  assignableEntityTypes: ['lead', 'project', 'contact', 'company', 'company_task', 'custom_object_record'],
  systemPrompt: 'You are an agent of an AI department inside Lumiva CRM. You work for your department’s goal, by its rules and permissions.',
  allowedPermissions: [...new Set([...AI_EMPLOYEE_PERMISSION_KEYS, ...OFFICE_EXTRA_KEYS])],
  allowedTriggers: [],
  charter: { does: '', doesNot: '' },
};

/** Контекст отдела для одного запуска агента. */
export type OfficeRunContext = {
  department: AiDepartment;
  /** разрешённые ключи прав/действий */
  allowed: Set<string>;
  /** действия, которые на уровне «С согласованием» обязаны ждать человека */
  approval: Set<string>;
  /** текстовый блок для системного промпта: цель, промт отдела, правила, коллеги, другие отделы */
  promptBlock: string;
  /** только для запуска по задаче отдела */
  taskId?: string | null;
  /** описание действий подключённых сервисов (Notion/Canva/GitHub) — только реально доступных */
  connectorActions?: string;
  /** шаблоны КП и каталог товаров/услуг для create_quote (только если отделу можно писать клиентам) */
  quoteCatalog?: string;
  /** боты Telegram компании — для публикации в канал */
  telegramBots?: Array<{ id: string; username: string | null }>;
};

export interface OfficeHooks {
  /** Контекст отдела агента (null — агент не в отделе или отдел удалён). */
  contextFor(tenantId: string, agentId: string, departmentId: string): Promise<OfficeRunContext | null>;
  /** Исполнение офисного действия (передача, запрос помощи, запись в «Мозг», коннекторы). */
  dispatch(tenantId: string, action: AiAgentAction): Promise<void>;
  /** Человек одобрил/отклонил действие агента отдела (двигает задачу дальше). */
  onActionDecided(tenantId: string, action: AiAgentAction, decision: 'executed' | 'rejected' | 'failed'): Promise<void>;
  /** Описание офисных действий для промпта агента. */
  actionsPromptFor(ctx: OfficeRunContext): string;
  /** Проверка действия агента отдела до создания: коннектор, область доступа, правило о персональных данных. */
  preflight(tenantId: string, ctx: OfficeRunContext, actionType: string, payload: Record<string, any>): Promise<string | null>;
}

/**
 * Триггеры, инструкции и доступ к таблицам ИИ-сотрудника.
 *
 * Хранятся в `ai_agents.settings` (jsonb) — без миграций. Триггеры — это подмножество
 * событий автоматизаций (`TriggerEvent`), т.к. все они проходят через один вход
 * `AutomationsService.triggerAutomation`, куда и подключён диспетчер ИИ.
 *
 * email.received (2026-09-22, решение владельца — пересмотрено с 2026-09-21, где почта была
 * исключена целиком): теперь разрешено, но НЕ по умолчанию и НЕ на весь ящик — доступ явно
 * выдаётся отдельно на каждый email-аккаунт (emailInboxAccess.accountIds, пусто = ничего не видит,
 * как и было раньше) и даже с доступом ИИ видит только письма, привязанные к лиду/контакту, за
 * который он назначен ответственным (event.defaultScope='mine', см. handleAutomationEvent) — не
 * весь ящик целиком. email.sent осознанно не добавлен: конфиденциальность исходящей переписки,
 * не относящейся к его собственным send_email, остаётся закрытой.
 */

export type AiTriggerScope = 'all' | 'mine';

export type AiTriggerConfig = {
  event: string;
  enabled: boolean;
  /** all — любая запись; mine — только записи, где этот ИИ назначен ответственным. */
  scope: AiTriggerScope;
  /** Необязательная инструкция именно для этого триггера. */
  prompt: string;
};

export type AiTableGrant = { objectId: string; access: 'read' | 'write' };

export type AiTableAccess = {
  /** all — все таблицы рабочей области (поведение агентов, созданных до появления этой настройки). */
  mode: 'all' | 'selected';
  tables: AiTableGrant[];
};

/**
 * Как сотрудник общается с клиентом на записях, за которые он ответственный:
 * approval — письма/Telegram идут через «Согласования» (по правилам согласования сотрудника);
 * auto — отправляет сам, без вопроса человеку (только по своим записям, с лимитом сообщений в час).
 */
export type AiClientDialogue = 'approval' | 'auto';

/** Контроль скорости: сотрудник сам следит, чтобы клиент не ждал, и зовёт человека, если не справился. */
export type AiSlaConfig = { enabled: boolean; minutes: number };

/** Утренний план для команды (время — UTC, как у ежедневного отчёта). */
export type AiDailyPlanConfig = { enabled: boolean; time: string };

/** Какие почтовые ящики тенанта ИИ разрешено читать. Пусто по умолчанию — явный opt-in владельца. */
export type AiEmailInboxAccess = { accountIds: string[] };

export type AiAgentConfig = {
  instructions: string;
  triggers: AiTriggerConfig[];
  tableAccess: AiTableAccess;
  clientDialogue: AiClientDialogue;
  sla: AiSlaConfig;
  dailyPlan: AiDailyPlanConfig;
  emailInboxAccess: AiEmailInboxAccess;
  /**
   * IANA-зона для перевода "человеческого" времени (из письма/сообщения клиента) в UTC при
   * создании встречи — нигде в системе нет тенантного часового пояса вообще (ни у Tenant, ни у
   * StaffUser), поэтому модель, получив "завтра в 16:00", раньше просто дописывала "Z" к цифрам,
   * трактуя их как UTC. Подтверждено на проде: клиент написал 16:00, встреча создалась на 19:00
   * по фактическому местному времени владельца (UTC+3) — ИИ не сделал вычитание офсета вообще.
   * Настраивается за сотрудника (не за тенант) — тот же уровень, что language/tone.
   */
  timezone: string;
};

export type AiTriggerCatalogItem = {
  event: string;
  group: 'leads' | 'sales' | 'projects' | 'tasks' | 'clients' | 'messages' | 'bookings' | 'workspace' | 'ai';
  /** Тип записи, к которой относится событие (для scope=mine и фокус-контекста). */
  entity: string;
  defaultScope: AiTriggerScope;
};

export const AI_TRIGGER_CATALOG: AiTriggerCatalogItem[] = [
  { event: 'ai.assigned', group: 'ai', entity: 'any', defaultScope: 'mine' },
  { event: 'lead.created', group: 'leads', entity: 'lead', defaultScope: 'all' },
  { event: 'lead.status_changed', group: 'leads', entity: 'lead', defaultScope: 'mine' },
  { event: 'lead.assigned', group: 'leads', entity: 'lead', defaultScope: 'all' },
  { event: 'sale.created', group: 'sales', entity: 'sale', defaultScope: 'all' },
  { event: 'sale.status_changed', group: 'sales', entity: 'sale', defaultScope: 'all' },
  { event: 'project.created', group: 'projects', entity: 'project', defaultScope: 'all' },
  { event: 'project.status_changed', group: 'projects', entity: 'project', defaultScope: 'mine' },
  { event: 'task.created', group: 'tasks', entity: 'task', defaultScope: 'all' },
  { event: 'task.status_changed', group: 'tasks', entity: 'task', defaultScope: 'mine' },
  { event: 'contact.created', group: 'clients', entity: 'contact', defaultScope: 'all' },
  { event: 'company.created', group: 'clients', entity: 'company', defaultScope: 'all' },
  { event: 'telegram.message_received', group: 'messages', entity: 'telegram_message', defaultScope: 'mine' },
  { event: 'email.received', group: 'messages', entity: 'email', defaultScope: 'mine' },
  { event: 'booking.reservation_created', group: 'bookings', entity: 'reservation', defaultScope: 'all' },
  { event: 'booking.reservation_status_changed', group: 'bookings', entity: 'reservation', defaultScope: 'all' },
  { event: 'hotel.reservation_created', group: 'bookings', entity: 'hotel_reservation', defaultScope: 'all' },
  { event: 'hotel.reservation_status_changed', group: 'bookings', entity: 'hotel_reservation', defaultScope: 'all' },
  { event: 'custom_object.record_created', group: 'workspace', entity: 'custom_object_record', defaultScope: 'all' },
  { event: 'custom_object.record_updated', group: 'workspace', entity: 'custom_object_record', defaultScope: 'mine' },
  { event: 'custom_object.status_changed', group: 'workspace', entity: 'custom_object_record', defaultScope: 'mine' },
];

export const AI_TRIGGER_EVENTS = AI_TRIGGER_CATALOG.map((t) => t.event);

/** События, которые ИИ, назначенный ответственным, получает по умолчанию — без отдельного включения. */
export const AI_ASSIGNEE_IMPLICIT_EVENTS = new Set([
  'ai.assigned',
  'lead.status_changed',
  'project.status_changed',
  'task.status_changed',
  'telegram.message_received',
  'custom_object.status_changed',
]);

/** Записи, за которые ИИ может быть назначен ответственным. */
export const AI_ASSIGNABLE_ENTITY_TYPES = ['lead', 'project', 'company_task', 'company', 'contact', 'custom_object_record'] as const;
export type AiAssignableEntityType = (typeof AI_ASSIGNABLE_ENTITY_TYPES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AI_INSTRUCTIONS_MAX = 8000;
export const AI_TRIGGER_PROMPT_MAX = 2000;

/** Europe/Moscow — совпадает по офсету (UTC+3) с обоими приоритетными рынками платформы (Турция,
 * Россия — см. память проекта), и это единственная точка во всём приложении, где вообще есть
 * понятие часового пояса тенанта; владелец может сменить на любой другой в настройках сотрудника. */
export const DEFAULT_AI_TIMEZONE = 'Europe/Moscow';

let VALID_TIMEZONES: Set<string> | null = null;
function isValidTimezone(tz: string): boolean {
  if (!VALID_TIMEZONES) {
    try {
      VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));
    } catch {
      VALID_TIMEZONES = new Set();
    }
  }
  if (VALID_TIMEZONES.has(tz)) return true;
  // supportedValuesOf может отсутствовать/быть неполным в некоторых средах — резервная проверка.
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function sanitizeTimezone(input: unknown): string {
  const tz = String(input ?? '').trim();
  return tz && isValidTimezone(tz) ? tz : DEFAULT_AI_TIMEZONE;
}

export function defaultAiAgentConfig(): AiAgentConfig {
  return {
    instructions: '',
    triggers: [],
    tableAccess: { mode: 'selected', tables: [] },
    clientDialogue: 'approval',
    sla: { enabled: false, minutes: 30 },
    dailyPlan: { enabled: false, time: '09:00' },
    emailInboxAccess: { accountIds: [] },
    timezone: DEFAULT_AI_TIMEZONE,
  };
}

export function sanitizeTriggers(input: unknown): AiTriggerConfig[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: AiTriggerConfig[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const event = String(r.event ?? '').trim();
    const item = AI_TRIGGER_CATALOG.find((t) => t.event === event);
    if (!item || seen.has(event)) continue;
    seen.add(event);
    out.push({
      event,
      enabled: r.enabled !== false,
      scope: r.scope === 'all' || r.scope === 'mine' ? r.scope : item.defaultScope,
      prompt: String(r.prompt ?? '').slice(0, AI_TRIGGER_PROMPT_MAX),
    });
  }
  return out;
}

export function sanitizeTableAccess(input: unknown): AiTableAccess {
  if (!input || typeof input !== 'object') return { mode: 'selected', tables: [] };
  const r = input as Record<string, unknown>;
  const mode = r.mode === 'all' ? 'all' : 'selected';
  const seen = new Set<string>();
  const tables: AiTableGrant[] = [];
  if (Array.isArray(r.tables)) {
    for (const raw of r.tables.slice(0, 200)) {
      if (!raw || typeof raw !== 'object') continue;
      const t = raw as Record<string, unknown>;
      const objectId = String(t.objectId ?? '').trim();
      if (!UUID_RE.test(objectId) || seen.has(objectId)) continue;
      seen.add(objectId);
      tables.push({ objectId, access: t.access === 'write' ? 'write' : 'read' });
    }
  }
  return { mode, tables };
}

export function sanitizeSla(input: unknown): AiSlaConfig {
  const r = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const minutes = Math.round(Number(r.minutes));
  return { enabled: r.enabled === true, minutes: Number.isFinite(minutes) ? Math.min(1440, Math.max(5, minutes)) : 30 };
}

export function sanitizeDailyPlan(input: unknown): AiDailyPlanConfig {
  const r = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(r.time ?? '').trim());
  return { enabled: r.enabled === true, time: m ? `${m[1].padStart(2, '0')}:${m[2]}` : '09:00' };
}

export function sanitizeEmailInboxAccess(input: unknown): AiEmailInboxAccess {
  const r = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const seen = new Set<string>();
  const accountIds: string[] = [];
  if (Array.isArray(r.accountIds)) {
    for (const raw of r.accountIds.slice(0, 50)) {
      const id = String(raw ?? '').trim();
      if (!UUID_RE.test(id) || seen.has(id)) continue;
      seen.add(id);
      accountIds.push(id);
    }
  }
  return { accountIds };
}

/**
 * Читает конфиг из settings. Агент без ключа tableAccess (создан до этой настройки) сохраняет
 * прежнее поведение — доступ ко всем таблицам; новые агенты получают explicit `selected`.
 */
export function readAiAgentConfig(settings: Record<string, unknown> | null | undefined): AiAgentConfig {
  const s = settings && typeof settings === 'object' ? settings : {};
  return {
    instructions: typeof s.instructions === 'string' ? s.instructions.slice(0, AI_INSTRUCTIONS_MAX) : '',
    triggers: sanitizeTriggers(s.triggers),
    tableAccess: s.tableAccess ? sanitizeTableAccess(s.tableAccess) : { mode: 'all', tables: [] },
    clientDialogue: s.clientDialogue === 'auto' ? 'auto' : 'approval',
    sla: sanitizeSla(s.sla),
    dailyPlan: sanitizeDailyPlan(s.dailyPlan),
    emailInboxAccess: sanitizeEmailInboxAccess(s.emailInboxAccess),
    timezone: sanitizeTimezone(s.timezone),
  };
}

export function tableAccessLevel(access: AiTableAccess, objectId: string): 'write' | 'read' | null {
  if (access.mode === 'all') return 'write';
  return access.tables.find((t) => t.objectId === objectId)?.access ?? null;
}

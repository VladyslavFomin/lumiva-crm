import { useAlertModal } from '../../contexts/AlertModalContext';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction, i18n as I18NextInstance } from 'i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { OpenAiConnectModal } from '../../components/integrations/OpenAiConnectModal';
import { LottieIcon } from '../../components/LottieIcon';
import { fetchIntegrations, type IntegrationConnectionDto } from '../../api/integrations';
import { cn } from '../../lib/cn';
import {
  AiAvatar,
  deriveAvatarAccent,
  deriveAvatarStyle,
  AI_AVATAR_ACCENTS,
  AI_AVATAR_STYLES,
  type AiAvatarAccent,
  type AiAvatarStyle,
} from './AiAvatar';
import './ai-employees.css';
import './ai-emp2.css';
import {
  ClientDialogueEditor,
  ControlEditor,
  EmailInboxAccessEditor,
  InstructionsEditor,
  TableAccessEditor,
  TriggersEditor,
} from './AiAgentConfigEditors';
import { InsightsView, KnowledgeView } from './AiKnowledgeInsightsViews';
import { AiAgentWorkPanel } from './AiAgentWorkPanel';
import {
  approveAiAction,
  createAiEmployee,
  deleteAiEmployee,
  executeAiAction,
  fetchPendingAiActions,
  checkAiSlaNow,
  fetchAiAgentAssignments,
  fetchAiAgentConfig,
  fetchAiEmployee,
  fetchAiEmployees,
  fetchAiInsights,
  fetchAiLogs,
  fetchAiLessons,
  deleteAiLesson,
  type AiLesson,
  fetchAiPlanLimits,
  fetchAiReports,
  fetchAiRoles,
  generateAiEmployeeReport,
  pauseAiEmployee,
  rejectAiAction,
  resumeAiEmployee,
  runAiDailyPlanNow,
  runAiEmployeeNow,
  sendAiReport,
  updateAiAgentConfig,
  updateAiEmployee,
  updateAiEmployeeApprovalRules,
  updateAiEmployeePermissions,
  type AiAgent,
  type AiAgentAction,
  type AiAgentAssignmentItem,
  type AiAgentAutonomyMode,
  type AiAgentConfig,
  type AiAgentDetailResponse,
  type AiAgentLog,
  type AiAgentReport,
  type AiAgentsListResponse,
  type AiEmailInboxAccess,
  type AiEmployeeRole,
  type AiEmployeeRoleKey,
  type AiInsights,
  type AiPlanSnapshot,
  type AiTableAccess,
  type AiTriggerConfig,
} from '../../api/aiEmployees';

type AiEmployeesView = 'dashboard' | 'choose' | 'create' | 'edit' | 'approvals' | 'logs' | 'reports' | 'knowledge' | 'insights';

// Зеркало AI_EMPLOYEE_PERMISSION_KEYS / AI_EMPLOYEE_APPROVAL_ACTIONS из backend
// (ai-employee-role-catalog.ts). Каждое право реально что-то открывает или разрешает на бэкенде.
const permissionGroups: Array<{ titleKey: string; keys: string[] }> = [
  {
    titleKey: 'crm.aiEmployees.create.permissionGroups.read',
    keys: [
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
    ],
  },
  {
    titleKey: 'crm.aiEmployees.create.permissionGroups.actions',
    keys: ['create_task', 'update_task', 'create_note', 'update_lead_status', 'assign_lead', 'escalate_to_human', 'create_report'],
  },
  {
    titleKey: 'crm.aiEmployees.create.permissionGroups.communications',
    keys: ['draft_email', 'send_email', 'send_bulk_email', 'draft_whatsapp', 'send_telegram', 'create_meeting'],
  },
  {
    titleKey: 'crm.aiEmployees.create.permissionGroups.workspace',
    keys: ['create_project', 'create_workspace_table', 'manage_workspace_data'],
  },
];

/** Права, после которых сообщение реально уходит клиенту / меняются данные CRM — помечаем бейджем. */
const PERMISSION_BADGE: Record<string, 'external' | 'writes'> = {
  send_email: 'external',
  send_bulk_email: 'external',
  send_telegram: 'external',
  create_task: 'writes',
  update_task: 'writes',
  create_note: 'writes',
  update_lead_status: 'writes',
  assign_lead: 'writes',
  create_project: 'writes',
  create_workspace_table: 'writes',
  manage_workspace_data: 'writes',
};

const approvalKeys = [
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
];

const REAL_EXECUTABLE_ACTIONS = new Set([
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
  'create_meeting',
  'create_project',
  'create_workspace_table',
  'workspace_add_record',
  'workspace_bulk_add_records',
  'workspace_add_field',
  'workspace_enable_views',
]);

/* ---------------------------------------------------------------- access v2: off/appr/auto matrix
 * Заменяет разрозненные «Права» + «Правила согласования» одним 3-позиционным переключателем на
 * действие — чистое отображение поверх той же пары API (permissions bool + approvalRules bool),
 * бэкенд не менялся. send_bulk_email — единственное действие с backend-жёстким forceAppr
 * (ai-employee-role-catalog.ts, createAiAction) — никогда не auto, что бы ни настроили.
 * draft_email/draft_whatsapp/create_report/manage_workspace_data не входят в approvalKeys — для
 * них нет самого механизма согласования (черновик/отчёт не имеет "реальной" отправки), поэтому
 * доступные состояния — только off/auto. */
type AccessState = 'off' | 'appr' | 'auto';
const FORCE_APPR_ACTIONS = new Set(['send_bulk_email']);

type AccessModuleDef = { key: string; labelKey: string; acts: string[] };
const ACCESS_MODULES: AccessModuleDef[] = [
  { key: 'leads', labelKey: 'crm.aiEmployees.v2.groups.leads', acts: ['update_lead_status', 'assign_lead'] },
  { key: 'tasks', labelKey: 'crm.aiEmployees.v2.groups.tasks', acts: ['create_task', 'update_task', 'create_note'] },
  { key: 'mail', labelKey: 'crm.aiEmployees.v2.groups.mail', acts: ['draft_email', 'send_email', 'send_bulk_email', 'draft_whatsapp', 'send_telegram'] },
  { key: 'work', labelKey: 'crm.aiEmployees.v2.groups.work', acts: ['create_meeting', 'create_project'] },
  { key: 'data', labelKey: 'crm.aiEmployees.v2.groups.data', acts: ['create_report', 'create_workspace_table', 'manage_workspace_data'] },
];
const ACCESS_ALL_ACTS = ACCESS_MODULES.flatMap((m) => m.acts);

/** off/appr/auto по реальным permissions+approvalRules — учитывает то же самое, что решает бэкенд
 * при исполнении (suggest роняет всё, assisted форсит appr, forceAppr никогда не auto). */
function accessStateWithRules(
  autonomyMode: AiAgentAutonomyMode,
  permissions: Record<string, boolean>,
  approvalRules: Record<string, boolean>,
  key: string,
): AccessState {
  if (!permissions[key]) return 'off';
  if (autonomyMode === 'suggest') return 'off';
  if (autonomyMode === 'assisted') return 'appr';
  if (FORCE_APPR_ACTIONS.has(key)) return 'appr';
  if (!approvalKeys.includes(key)) return 'auto';
  return approvalRules[key] ? 'appr' : 'auto';
}
/** Какие состояния можно выбрать кнопкой при данном уровне автономии (не то, что отображается). */
function statesFor(autonomyMode: AiAgentAutonomyMode, key: string): AccessState[] {
  if (autonomyMode === 'suggest') return ['off'];
  if (FORCE_APPR_ACTIONS.has(key)) return ['off', 'appr'];
  if (autonomyMode === 'assisted') return ['off', 'appr'];
  if (!approvalKeys.includes(key)) return ['off', 'auto'];
  return ['off', 'appr', 'auto'];
}
function countAccessStates(autonomyMode: AiAgentAutonomyMode, permissions: Record<string, boolean>, approvalRules: Record<string, boolean>) {
  const c = { auto: 0, appr: 0, off: 0 };
  for (const k of ACCESS_ALL_ACTS) c[accessStateWithRules(autonomyMode, permissions, approvalRules, k)] += 1;
  return c;
}
const AUTONOMY_PRESET_ORDER: AiAgentAutonomyMode[] = ['suggest', 'assisted', 'auto'];

const AVATAR_SWATCH_BG: Record<AiAvatarAccent, string> = {
  ink: '#222',
  slate: '#eef1f5',
  green: '#eaf4ee',
  amber: '#fbf2dc',
  blue: '#eef3fb',
  rose: '#fbecef',
  violet: '#f1eefb',
};

/* ---------------------------------------------------------------- icons */
const ICON = {
  back: <path d="M15 6l-6 6 6 6" />,
  chevR: <path d="M9 6l6 6-6 6" />,
  check: <path d="M5 12l4 4 10-10" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M6 18L18 6" />
    </>
  ),
  shield: <path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5z" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  play: <path d="M6 4l14 8-14 8z" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.6 5L19 9.6 13.6 11 12 16l-1.6-5L5 9.6 10.4 8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  doc: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  wand: (
    <>
      <path d="M4 20l10-10" />
      <path d="M14 6l4 4" />
      <path d="M17 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" />
      <path d="M4 19a2 2 0 012-2h13" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" />
      <path d="M16 4a3.5 3.5 0 010 7" />
      <path d="M22 20c0-2.6-1.4-4.6-3.5-5.5" />
    </>
  ),
  lead: (
    <>
      <path d="M3 12c0-5 4-9 9-9s9 4 9 9-4 9-9 9" />
      <path d="M3 12l4-4" />
      <path d="M3 12l4 4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 00-2.1-1.2L14 3h-4l-.4 2.4a7 7 0 00-2.1 1.2L5.1 5.8l-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.8a7 7 0 002.1 1.2L10 21h4l.4-2.4a7 7 0 002.1-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 11-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
} as const;

function I({ d, size = 16, sw = 1.7 }: { d: React.ReactNode; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d}
    </svg>
  );
}

function clickableProps(fn: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: fn,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn();
      }
    },
  };
}

/* ---------------------------------------------------------------- helpers */
function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

/** «Правила согласования» и «Ведёт диалог сам» имеют силу только на уровне автономии «Авто». */
function autonomyLockNote(t: TFunction, autonomyMode: AiAgentAutonomyMode): string | undefined {
  if (autonomyMode === 'suggest') return t('crm.aiEmployees.autonomy.lockNoteSuggest');
  if (autonomyMode === 'assisted') return t('crm.aiEmployees.autonomy.lockNoteAssisted');
  return undefined;
}

function formatDate(value: string | null | undefined, t: TFunction, locale?: string) {
  if (!value) return t('crm.aiEmployees.activity.noneShort');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('crm.aiEmployees.activity.noneShort');
  return date.toLocaleString(locale || undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractError(error: unknown, t: TFunction) {
  const payload = (error as any)?.payload;
  return payload?.message || (error as Error)?.message || t('crm.aiEmployees.errors.generic');
}

function actionIcon(actionType: string): React.ReactNode {
  if (actionType.includes('email') || actionType.includes('whatsapp') || actionType.includes('telegram')) return ICON.mail;
  if (actionType.includes('lead')) return ICON.lead;
  if (actionType.includes('workspace') || actionType.includes('project') || actionType.includes('report')) return ICON.doc;
  return ICON.bolt;
}

function languageOptionValues(): Array<{ value: string; labelKey: string }> {
  return [
    { value: 'English', labelKey: 'crm.aiEmployees.languageOptions.english' },
    { value: 'Russian', labelKey: 'crm.aiEmployees.languageOptions.russian' },
    { value: 'Turkish', labelKey: 'crm.aiEmployees.languageOptions.turkish' },
    { value: 'English / Turkish / Russian', labelKey: 'crm.aiEmployees.languageOptions.mixed' },
  ];
}

/** Часовой пояс сотрудника — ни у тенанта, ни у сотрудника CRM в системе такого поля нет вообще
 * (проверено по схеме), поэтому у ИИ он свой, отдельный. Используется для перевода "человеческого"
 * времени из писем/сообщений клиента в UTC при создании встреч (create_meeting). Список не
 * исчерпывающий — только частые пояса; остальные не нужны почти никому из тенантов платформы. */
const TIMEZONE_OPTIONS = [
  'Europe/Moscow',
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Almaty',
  'America/New_York',
  'UTC',
];

function agentAvatarProps(agent: AiAgent): { accent: AiAvatarAccent; avStyle: AiAvatarStyle } {
  const settings = (agent.settings || {}) as Record<string, unknown>;
  return {
    accent: (settings.avatarAccent as AiAvatarAccent) || deriveAvatarAccent(agent.id),
    avStyle: (settings.avatarStyle as AiAvatarStyle) || deriveAvatarStyle(agent.id),
  };
}

/**
 * The role catalog (title/description/functions/…) is authored once in English on the
 * backend and only localized here, keyed by role key — matches the pattern used for
 * status/autonomy labels (i18n key with a fallback to the raw API string).
 */
function trRole(
  roleKey: string,
  field: 'title' | 'shortTitle' | 'department' | 'jobTitle' | 'description',
  fallback: string,
  t: TFunction,
  i18n: I18NextInstance,
): string {
  const key = `crm.aiEmployees.roleCatalog.${roleKey}.${field}`;
  return i18n.exists(key) ? t(key) : fallback;
}

function trRoleFunctions(roleKey: string, fallback: string[], t: TFunction, i18n: I18NextInstance): string[] {
  const key = `crm.aiEmployees.roleCatalog.${roleKey}.functions`;
  if (!i18n.exists(key)) return fallback;
  const value = t(key, { returnObjects: true });
  return Array.isArray(value) ? (value as string[]) : fallback;
}

const KNOWN_DEPARTMENT_KEYS: Record<string, string> = {
  Sales: 'sales',
  Marketing: 'marketing',
  Support: 'support',
  Projects: 'projects',
  Communications: 'communications',
  Management: 'management',
  Reservations: 'reservations',
};

/** Departments are free-editable per agent; only translate when it still matches a role's English default. */
function trDepartment(value: string | null | undefined, t: TFunction): string {
  if (!value) return '';
  const key = KNOWN_DEPARTMENT_KEYS[value];
  return key ? t(`crm.aiEmployees.departments.${key}`, { defaultValue: value }) : value;
}

const KNOWN_PLAN_BADGE_KEYS: Record<string, string> = {
  Included: 'included',
  'Available on Pro': 'pro',
  'Available on Business': 'business',
  'Available on Enterprise': 'enterprise',
};

function trPlanBadge(value: string, t: TFunction): string {
  const key = KNOWN_PLAN_BADGE_KEYS[value];
  return key ? t(`crm.aiEmployees.planBadge.${key}`, { defaultValue: value }) : value;
}

/* ---------------------------------------------------------------- shared bits */
function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('ai-st', status)}>
      <span className={cn('dot', status === 'active' && 'live')} />
      {t(`crm.aiEmployees.status.${status}`, { defaultValue: labelize(status) })}
    </span>
  );
}

function PlanUsage({ plan }: { plan?: AiPlanSnapshot | null }) {
  const { t } = useTranslation();
  if (!plan) return null;
  return (
    <div className="ai-plan">
      <div>
        <div className="pl">
          {t('crm.aiEmployees.plan.prefix')} {labelize(plan.plan)}
        </div>
        <div className="pv">{plan.unlimited ? t('crm.aiEmployees.plan.usageUnlimited') : `${plan.used} / ${plan.limit}`}</div>
      </div>
      {!plan.unlimited && plan.limit ? (
        <div className="track">
          <span style={{ width: `${Math.min(100, (plan.used / plan.limit) * 100)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function UpgradeModal({ open, onClose, plan }: { open: boolean; onClose: () => void; plan?: AiPlanSnapshot | null }) {
  const { t } = useTranslation();
  if (!open) return null;
  const lim = plan?.limit ?? 1;
  const subtitle =
    lim === 1
      ? t('crm.aiEmployees.upgradeModal.subtitleSingular', { count: lim })
      : t('crm.aiEmployees.upgradeModal.subtitlePlural', { count: lim });
  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">{t('crm.aiEmployees.upgradeModal.title')}</div>
            <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">
            {t('crm.aiEmployees.upgradeModal.close')}
          </button>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-sm leading-6 text-slate-600">{t('crm.aiEmployees.upgradeModal.body')}</p>
          <div className="flex flex-wrap gap-2">
            <button className="aib" onClick={() => { window.location.href = '/billing'; }}>
              {t('crm.aiEmployees.upgradeModal.upgradePlan')}
            </button>
            <button className="aib ghost" onClick={() => { window.location.href = '/pricing'; }}>
              {t('crm.aiEmployees.upgradeModal.comparePlans')}
            </button>
            <button className="aib ghost" onClick={onClose}>
              {t('crm.aiEmployees.upgradeModal.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="ai-kpi">
      <div className="l">
        <span className="ic">
          <I d={icon} size={11} />
        </span>
        {label}
      </div>
      <div className="v">{value}</div>
    </div>
  );
}

function AgentCard({ agent, onOpen }: { agent: AiAgent; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  const { accent, avStyle } = agentAvatarProps(agent);
  const roleTitle = trRole(agent.role, 'title', agent.roleTitle || '', t, i18n);
  const roleDescription = trRole(agent.role, 'description', agent.roleDescription || '', t, i18n);
  return (
    <div className="ai-card" {...clickableProps(onOpen)}>
      <div className="ai-card-top">
        <AiAvatar name={agent.name} accent={accent} avStyle={avStyle} size="lg" src={agent.avatarUrl} />
        <div className="ai-card-body">
          <div className="nm">
            {agent.name}
            <StatusBadge status={agent.status} />
          </div>
          <div className="role">{roleTitle}</div>
        </div>
      </div>
      <div className="desc">{roleDescription}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        <span className="ai-auto">{t(`crm.aiEmployees.autonomy.${agent.autonomyMode}.title`)}</span>
        {agent.department ? <span className="ai-auto">{trDepartment(agent.department, t)}</span> : null}
        <span className="ai-auto">{agent.dailyReportTime}</span>
      </div>
      <div className="ai-card-foot">
        <div className="ai-card-stat">
          <div className="sv">{agent.stats?.actionsToday ?? 0}</div>
          <div className="sl">{t('crm.aiEmployees.agentCard.today')}</div>
        </div>
        <div className={cn('ai-card-stat', (agent.stats?.pendingApprovals ?? 0) > 0 && 'alert')}>
          <div className="sv">{agent.stats?.pendingApprovals ?? 0}</div>
          <div className="sl">{t('crm.aiEmployees.agentCard.approvals')}</div>
        </div>
        <div className="ai-card-stat">
          <div className="sv">{agent.stats?.reportsGenerated ?? 0}</div>
          <div className="sl">{t('crm.aiEmployees.agentCard.reports')}</div>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  role,
  selected,
  planFull,
  onSelect,
  onUpgrade,
}: {
  role: AiEmployeeRole;
  selected?: boolean;
  planFull?: boolean;
  onSelect: () => void;
  onUpgrade: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locked = role.locked || planFull;
  const title = trRole(role.key, 'title', role.title, t, i18n);
  const shortTitle = trRole(role.key, 'shortTitle', role.shortTitle, t, i18n);
  const description = trRole(role.key, 'description', role.description, t, i18n);
  const functions = trRoleFunctions(role.key, role.functions, t, i18n);
  return (
    <div className={cn('ai-role', selected && 'on', locked && 'locked')} {...clickableProps(() => (locked ? onUpgrade() : onSelect()))}>
      <AiAvatar name={shortTitle} accent={deriveAvatarAccent(role.key)} avStyle={deriveAvatarStyle(role.key)} size="md" />
      <div className="ai-role-body">
        <div className="rn">
          {title}
          {locked ? <span className="plan-badge">{planFull ? t('crm.aiEmployees.choose.planLimitReached') : trPlanBadge(role.badge, t)}</span> : null}
        </div>
        <div className="rd">{description}</div>
        <div className="rf">
          {functions.slice(0, 4).map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      </div>
      {locked ? (
        <div className="rlock">
          <I d={ICON.shield} size={15} />
        </div>
      ) : (
        <div className="rcheck">
          <I d={ICON.check} size={12} />
        </div>
      )}
    </div>
  );
}

function LessonsPanel({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const [lessons, setLessons] = useState<AiLesson[]>([]);
  useEffect(() => {
    let alive = true;
    fetchAiLessons(agentId)
      .then((r) => alive && setLessons(r.lessons))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [agentId]);
  if (!lessons.length) return null;
  return (
    <div className="ai-panel">
      <div className="e2-lbl">{t('crm.aiEmployees.lessons.title')}</div>
      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 8 }}>{t('crm.aiEmployees.lessons.hint')}</div>
      {lessons.map((l) => (
        <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderTop: '1px solid var(--line, #eee)' }}>
          <div style={{ flex: 1, fontSize: 13 }}>{l.text}</div>
          <button
            type="button"
            className="e2-ib"
            title={t('crm.aiEmployees.lessons.remove')}
            onClick={() => deleteAiLesson(agentId, l.id).then(() => setLessons((cur) => cur.filter((x) => x.id !== l.id)))}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function ApprovalList({ actions, onChanged }: { actions: AiAgentAction[]; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const { showPrompt } = useAlertModal();
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = async (action: AiAgentAction, kind: 'approve' | 'reject' | 'execute') => {
    let reason: string | undefined;
    if (kind === 'reject') {
      // Причина превращается в постоянный «урок» сотрудника (попадает в его инструкции).
      const answer = await showPrompt({
        title: t('crm.aiEmployees.lessons.rejectTitle'),
        label: t('crm.aiEmployees.lessons.rejectLabel'),
        placeholder: t('crm.aiEmployees.lessons.rejectPlaceholder'),
      });
      if (answer === null) return;
      reason = answer.trim() || undefined;
    }
    setBusy((s) => ({ ...s, [action.id]: kind }));
    setErrors((s) => {
      const next = { ...s };
      delete next[action.id];
      return next;
    });
    try {
      if (kind === 'approve') await approveAiAction(action.id);
      if (kind === 'reject') await rejectAiAction(action.id, reason);
      if (kind === 'execute') await executeAiAction(action.id);
      onChanged();
    } catch (e) {
      // Раньше ошибка тут просто падала в необработанный reject промиса — кнопка выглядела
      // "нерабочей": ничего не происходило, без единого сообщения, почему.
      setErrors((s) => ({ ...s, [action.id]: extractError(e, t) }));
    } finally {
      setBusy((s) => {
        const next = { ...s };
        delete next[action.id];
        return next;
      });
    }
  };

  if (!actions.length) {
    return (
      <div className="ai-empty">
        <div className="ei">
          <I d={ICON.check} size={22} />
        </div>
        <div className="et">{t('crm.aiEmployees.approvalsPage.empty')}</div>
      </div>
    );
  }

  return (
    <div className="ai-appr">
      {actions.map((action) => {
        const canRealExecute = REAL_EXECUTABLE_ACTIONS.has(action.actionType);
        return (
          <div className="ai-appr-item" key={action.id}>
            <div className="at">
              <I d={actionIcon(action.actionType)} size={16} />
            </div>
            <div className="ai-appr-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div className="att">{action.title}</div>
                <span className={cn('ai-appr-badge', action.status)}>
                  {t(`crm.aiEmployees.status.${action.status}`, { defaultValue: labelize(action.status) })}
                </span>
              </div>
              <div className="atmeta">
                <span>{action.agent?.name || t('crm.aiEmployees.fallbackEmployee')}</span>
                <span className="sep">•</span>
                <span>{labelize(action.actionType)}</span>
                <span className="sep">•</span>
                <span>{formatDate(action.createdAt, t, i18n.language)}</span>
              </div>
              {action.reason ? <div className="ai-appr-reason">{action.reason}</div> : null}
              {action.status === 'pending' ? (
                <div className="ai-appr-actions">
                  <button className="ai-appr-btn approve" disabled={!!busy[action.id]} onClick={() => run(action, 'approve')}>
                    <I d={ICON.check} size={13} />
                    {t('crm.aiEmployees.approvalCard.approve')}
                  </button>
                  <button className="ai-appr-btn reject" disabled={!!busy[action.id]} onClick={() => run(action, 'reject')}>
                    <I d={ICON.x} size={13} />
                    {t('crm.aiEmployees.approvalCard.reject')}
                  </button>
                </div>
              ) : null}
              {action.status === 'approved' ? (
                <div className="ai-appr-actions">
                  <button className="ai-appr-btn approve" disabled={!!busy[action.id]} onClick={() => run(action, 'execute')}>
                    <I d={ICON.bolt} size={13} />
                    {canRealExecute ? t('crm.aiEmployees.approvalCard.execute') : t('crm.aiEmployees.approvalCard.markDone')}
                  </button>
                </div>
              ) : null}
              {errors[action.id] ? (
                <div className="ai-appr-reason" style={{ color: '#9a1f31' }}>
                  {errors[action.id]}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogList({ logs }: { logs: AiAgentLog[] }) {
  const { t, i18n } = useTranslation();
  if (!logs.length) {
    return (
      <div className="ai-empty">
        <div className="ei">
          <I d={ICON.book} size={22} />
        </div>
        <div className="et">{t('crm.aiEmployees.activity.none')}</div>
      </div>
    );
  }
  return (
    <div className="ai-log">
      {logs.map((log) => (
        <div className="ai-log-item" key={log.id}>
          <div className="ai-log-time">{formatDate(log.createdAt, t, i18n.language)}</div>
          <div className="ai-log-main">
            <div className="ai-log-ev">
              <span className={cn('ai-log-dot', log.status === 'error' ? 'err' : log.status === 'warning' ? 'info' : 'ok')} />
              <span className="ai-log-type">{log.outputSummary || labelize(log.eventType)}</span>
            </div>
            <div className="ai-log-io">
              {log.agent?.name || t('crm.aiEmployees.fallbackEmployee')}
              <span className="arr">→</span>
              {labelize(log.eventType)}
            </div>
            {log.tokensUsed ? (
              <div className="ai-log-tok">
                <span>{log.model || ''}</span>
                <span>
                  {log.tokensUsed.toLocaleString()} {t('crm.aiEmployees.logsPage.tokensLabel')}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportBrowser({ reports, onChanged }: { reports: AiAgentReport[]; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const [selId, setSelId] = useState<string | undefined>(reports[0]?.id);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!reports.some((r) => r.id === selId)) setSelId(reports[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);
  const cur = reports.find((r) => r.id === selId) || reports[0];

  if (!reports.length) {
    return (
      <div className="ai-empty">
        <div className="ei">
          <I d={ICON.doc} size={22} />
        </div>
        <div className="et">{t('crm.aiEmployees.reportsPage.empty')}</div>
      </div>
    );
  }

  return (
    <div className="ai-reports">
      <div className="ai-report-list">
        {reports.map((r) => (
          <div key={r.id} className={cn('ai-report-item', cur?.id === r.id && 'active')} onClick={() => setSelId(r.id)}>
            <div className="rt">{r.title}</div>
            <div className="rm">
              <span>{formatDate(r.createdAt, t, i18n.language)}</span>
              <span className={cn('ai-appr-badge', r.status === 'sent' ? 'approved' : 'executed')}>
                {t(`crm.aiEmployees.status.${r.status}`, { defaultValue: labelize(r.status) })}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="ai-report-view">
        {cur ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h2>{cur.title}</h2>
                <div className="rsub">
                  {formatDate(cur.createdAt, t, i18n.language)}
                  {cur.agent ? ` · ${cur.agent.name}` : ''}
                </div>
              </div>
              {cur.status !== 'sent' ? (
                <button
                  className="aib sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await sendAiReport(cur.id, ['dashboard']);
                      onChanged();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <I d={ICON.send} size={13} />
                  {t('crm.aiEmployees.reportsPage.markSent')}
                </button>
              ) : null}
            </div>
            <div className="ai-report-md">{cur.contentMd}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function PermissionEditor({
  permissions,
  setPermissions,
}: {
  permissions: Record<string, boolean>;
  setPermissions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3.5">
      <p className="ai-hint" style={{ margin: 0, fontSize: 12.5 }}>
        {t('crm.aiEmployees.create.permissionsHint')}
      </p>
      {permissionGroups.map((group) => (
        <div key={group.titleKey} className="ai-panel">
          <div className="ai-panel-head">
            <div className="pt">{t(group.titleKey)}</div>
          </div>
          <div className="ai-panel-body flush ai-perm-grid">
            {group.keys.map((key) => {
              const badge = PERMISSION_BADGE[key];
              return (
                <div className="ai-perm" key={key}>
                  <div className="pi">
                    <I d={ICON.shield} size={15} />
                  </div>
                  <div className="pb">
                    <div className="pn">
                      {t(`crm.aiEmployees.permissions.${key}.title`, { defaultValue: labelize(key) })}
                      {badge ? <span className={cn('ai-perm-badge', badge)}>{t(`crm.aiEmployees.create.permBadge.${badge}`)}</span> : null}
                    </div>
                    <div className="pd">{t(`crm.aiEmployees.permissions.${key}.hint`, { defaultValue: '' })}</div>
                  </div>
                  <button
                    type="button"
                    className={cn('ai-toggle', permissions[key] ? 'on' : 'off')}
                    onClick={() => setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ApprovalEditor({
  approvalRules,
  setApprovalRules,
  lockNote,
}: {
  approvalRules: Record<string, boolean>;
  setApprovalRules: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** Уровень автономии сейчас сам решает за эти переключатели — показать почему и заблокировать. */
  lockNote?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <div className="pt">{t('crm.aiEmployees.create.approvalRulesTitle')}</div>
      </div>
      <p className="ai-hint" style={{ margin: 0, padding: '12px 18px 0', fontSize: 12.5 }}>
        {t('crm.aiEmployees.create.approvalRulesHint')}
      </p>
      {lockNote ? (
        <p className="ai-hint" style={{ margin: 0, padding: '8px 18px 0', fontSize: 12.5, color: '#7a4a09' }}>
          ⓘ {lockNote}
        </p>
      ) : null}
      <div className="ai-panel-body flush ai-perm-grid" style={lockNote ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
        {approvalKeys.map((key) => (
          <div className="ai-perm" key={key}>
            <div className="pb">
              <div className="pn">
                {t('crm.aiEmployees.create.approvalRequireBefore', {
                  action: t(`crm.aiEmployees.approvalAction.${key}`, { defaultValue: labelize(key) }),
                })}
              </div>
            </div>
            <button
              type="button"
              className={cn('ai-toggle', approvalRules[key] ? 'on' : 'off')}
              onClick={() => setApprovalRules((prev) => ({ ...prev, [key]: !prev[key] }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AutonomySelector({ value, onChange }: { value: AiAgentAutonomyMode; onChange: (m: AiAgentAutonomyMode) => void }) {
  const { t } = useTranslation();
  const modes: Array<{ key: AiAgentAutonomyMode; lvl: number }> = [
    { key: 'suggest', lvl: 33 },
    { key: 'assisted', lvl: 66 },
    { key: 'auto', lvl: 100 },
  ];
  return (
    <div className="ai-autonomy">
      {modes.map((m) => (
        <button key={m.key} type="button" className={cn('ai-autonomy-opt', value === m.key && 'on')} onClick={() => onChange(m.key)}>
          <div className="an">
            {value === m.key ? <I d={ICON.check} size={13} /> : null}
            {t(`crm.aiEmployees.autonomy.${m.key}.title`)}
          </div>
          <div className="ad">{t(`crm.aiEmployees.autonomy.${m.key}.hint`)}</div>
          <div className="lvl">
            <span style={{ width: `${m.lvl}%` }} />
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- views */
function AccessFingerprint({
  autonomyMode,
  permissions,
  approvalRules,
  compact,
}: {
  autonomyMode: AiAgentAutonomyMode;
  permissions: Record<string, boolean>;
  approvalRules: Record<string, boolean>;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const c = countAccessStates(autonomyMode, permissions, approvalRules);
  const total = c.auto + c.appr + c.off || 1;
  return (
    <div>
      <div className="e2-fp">
        <span className="s-auto" style={{ width: `${(c.auto / total) * 100}%` }} />
        <span className="s-appr" style={{ width: `${(c.appr / total) * 100}%` }} />
        <span className="s-off" style={{ width: `${(c.off / total) * 100}%` }} />
      </div>
      {!compact ? (
        <div className="e2-fpl">
          <span>
            <b>{c.auto}</b> {t('crm.aiEmployees.v2.fp.auto')}
          </span>
          <span>
            <b>{c.appr}</b> {t('crm.aiEmployees.v2.fp.appr')}
          </span>
          <span>
            <b>{c.off}</b> {t('crm.aiEmployees.v2.fp.off')}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function DashboardView() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<AiAgentsListResponse | null>(null);
  const [insights, setInsights] = useState<AiInsights | null>(null);
  const [dayLogs, setDayLogs] = useState<AiAgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [ownKeyModalOpen, setOwnKeyModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'setup_required' | 'pending'>('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [employees, ins, logsRes] = await Promise.all([
        fetchAiEmployees(),
        fetchAiInsights(30).catch(() => null),
        fetchAiLogs({ limit: 60 }).catch(() => ({ items: [] as AiAgentLog[] })),
      ]);
      setData(employees);
      setInsights(ins);
      // «Лента дня»: только содержательные события (что сделано / пропущено / сломалось), без служебного шума.
      const keep = new Set(['action_created', 'action_executed', 'action_blocked', 'action_rejected', 'agent_auto_paused', 'daily_digest', 'escalated']);
      setDayLogs((logsRes.items || []).filter((l) => keep.has(l.eventType)).slice(0, 12));
    } catch (e) {
      setError(extractError(e, t));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const planFull = data?.plan.limit != null && data.plan.used >= data.plan.limit;
  const add = () => {
    if (planFull) setUpgradeOpen(true);
    else navigate('/ai-employees/choose');
  };
  const savedHours = insights ? Math.round(insights.totals.minutesSaved / 60) : null;
  const freeRoles = data ? data.roles.filter((r) => !data.items.some((a) => a.role === r.key)) : [];
  const list = data
    ? data.items.filter((a) => {
        if (filter === 'all') return true;
        if (filter === 'pending') return (a.stats?.pendingApprovals ?? 0) > 0;
        return a.status === filter;
      })
    : [];

  return (
    <MainLayout>
      <PageHelpButton topic="aiEmployees" />
      <div className="ai-emp e2">
        <div className="e2-head">
          <div>
            <div className="kick">{t('crm.aiEmployees.badge.workforce')}</div>
            <h1>{t('crm.aiEmployees.dashboard.title')}</h1>
            <div className="sub">{t('crm.aiEmployees.v2.subtitle')}</div>
          </div>
          <div className="e2-head-r">
            <PlanUsage plan={data?.plan} />
            <button className="e2b" onClick={add}>
              <I d={ICON.plus} size={14} />
              {t('crm.aiEmployees.v2.hire')}
            </button>
          </div>
        </div>

        <div className="e2-banner">
          <div className="t">
            <b>{t('crm.aiEmployees.ownKeyBanner.title')}</b> {t('crm.aiEmployees.ownKeyBanner.body')}
          </div>
          <button className="e2b gh" style={{ flexShrink: 0 }} onClick={() => setOwnKeyModalOpen(true)}>
            {t('crm.aiEmployees.ownKeyBanner.button')}
          </button>
        </div>
        <OpenAiConnectModal open={ownKeyModalOpen} onClose={() => setOwnKeyModalOpen(false)} onCreated={() => setOwnKeyModalOpen(false)} />

        {error ? (
          <div className="e2-panel" style={{ padding: 16, margin: '16px 0', color: '#9a1f31', fontSize: 13 }}>
            {error}
          </div>
        ) : null}
        {loading ? <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 16 }}>{t('crm.aiEmployees.dashboard.loading')}</div> : null}

        {data ? (
          data.items.length === 0 ? (
            <div className="e2-panel" style={{ padding: '40px 24px', textAlign: 'center', margin: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <LottieIcon name="welcome" size={168} />
              </div>
              <div className="h" style={{ fontSize: 19, marginTop: 4 }}>
                {t('crm.aiEmployees.empty.title')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)', maxWidth: 420, margin: '8px auto 0', lineHeight: 1.5 }}>
                {t('crm.aiEmployees.empty.body')}
              </div>
              <button className="e2b" style={{ marginTop: 18 }} onClick={add}>
                <I d={ICON.plus} size={14} />
                {t('crm.aiEmployees.empty.cta')}
              </button>
            </div>
          ) : (
            <>
              <div className="e2-kpis">
                <div className="e2-kpi">
                  <div className="kick">{t('crm.aiEmployees.v2.kpi.active')}</div>
                  <div className="num">{data.kpis.activeAiEmployees}</div>
                  <div className="d">{t('crm.aiEmployees.v2.kpi.activeD', { count: data.items.length })}</div>
                </div>
                <div className="e2-kpi">
                  <div className="kick">{t('crm.aiEmployees.v2.kpi.today')}</div>
                  <div className="num">{data.kpis.tasksCompletedToday}</div>
                  <div className="d">{t('crm.aiEmployees.v2.kpi.todayD')}</div>
                </div>
                <div
                  className={cn('e2-kpi', 'clk', data.kpis.pendingApprovals > 0 && 'warn')}
                  {...clickableProps(() => navigate('/ai-employees/approvals'))}
                >
                  <div className="kick">{t('crm.aiEmployees.v2.kpi.pending')}</div>
                  <div className="num">{data.kpis.pendingApprovals}</div>
                  <div className="d">{t('crm.aiEmployees.v2.kpi.pendingD')}</div>
                </div>
                <div className="e2-kpi clk" {...clickableProps(() => navigate('/ai-employees/reports'))}>
                  <div className="kick">{t('crm.aiEmployees.v2.kpi.reports')}</div>
                  <div className="num">{data.kpis.reportsGenerated}</div>
                  <div className="d">{t('crm.aiEmployees.v2.kpi.reportsD')}</div>
                </div>
                <div className="e2-kpi clk" {...clickableProps(() => navigate('/ai-employees/insights'))}>
                  <div className="kick">{t('crm.aiEmployees.v2.kpi.saved')}</div>
                  <div className="num">{savedHours == null ? '—' : t('crm.aiEmployees.v2.hoursValue', { count: savedHours })}</div>
                  <div className="d">{t('crm.aiEmployees.v2.kpi.savedD')}</div>
                </div>
              </div>

              <div className="e2-chipbar">
                {(
                  [
                    ['all', t('crm.aiEmployees.v2.filters.all', { count: data.items.length })],
                    ['active', t('crm.aiEmployees.v2.filters.active')],
                    ['paused', t('crm.aiEmployees.v2.filters.paused')],
                    ['setup_required', t('crm.aiEmployees.v2.filters.setup_required')],
                    ['pending', t('crm.aiEmployees.v2.filters.pending')],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} className={cn('e2-chip', filter === k && 'on')} onClick={() => setFilter(k)}>
                    {l}
                  </button>
                ))}
              </div>

              <div className="e2-tbl">
                <div className="e2-tr hd">
                  <div>{t('crm.aiEmployees.v2.colHead.employee')}</div>
                  <div className="c-st">{t('crm.aiEmployees.v2.colHead.status')}</div>
                  <div className="c-mode">{t('crm.aiEmployees.v2.colHead.level')}</div>
                  <div className="c-acc">{t('crm.aiEmployees.v2.colHead.access')}</div>
                  <div className="c-load">{t('crm.aiEmployees.v2.colHead.today')}</div>
                  <div className="c-appr">{t('crm.aiEmployees.v2.colHead.queue')}</div>
                  <div className="c-act" />
                </div>
                {list.map((agent) => {
                  const av = agentAvatarProps(agent);
                  const pending = agent.stats?.pendingApprovals ?? 0;
                  return (
                    <div key={agent.id} className="e2-tr ag" {...clickableProps(() => navigate(`/ai-employees/${agent.id}`))}>
                      <div className="e2-who">
                        <AiAvatar name={agent.name} accent={av.accent} avStyle={av.avStyle} size="md" src={agent.avatarUrl} />
                        <div style={{ minWidth: 0 }}>
                          <div className="nm">{agent.name}</div>
                          <div className="rl">{trRole(agent.role, 'shortTitle', agent.roleShortTitle || '', t, i18n)}</div>
                          {agent.status !== 'active' && agent.stats?.autoPausedReason ? (
                            <div className="rl" style={{ color: 'var(--err, #b4232a)', whiteSpace: 'normal' }} title={agent.stats.autoPausedReason}>
                              ⚠ {agent.stats.autoPausedReason}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="c-st">
                        <StatusBadge status={agent.status} />
                      </div>
                      <div className="c-mode">
                        <span className={cn('e2-mode', agent.autonomyMode === 'auto' && 'auto')}>{t(`crm.aiEmployees.autonomy.${agent.autonomyMode}.title`)}</span>
                      </div>
                      <div className="c-acc">
                        <AccessFingerprint autonomyMode={agent.autonomyMode} permissions={agent.permissions ?? {}} approvalRules={agent.approvalRules ?? {}} />
                      </div>
                      <div className="c-load e2-load">
                        <span className="num">{agent.stats?.executedToday ?? 0}</span>
                        {(agent.stats?.failedToday ?? 0) > 0 ? (
                          <span style={{ color: 'var(--err, #b4232a)', fontSize: 11, marginLeft: 6 }} title={t('crm.aiEmployees.v2.failedToday')}>
                            ✕ {agent.stats?.failedToday}
                          </span>
                        ) : null}
                        {(agent.stats?.blockedToday ?? 0) > 0 ? (
                          <span style={{ color: 'var(--fg-3)', fontSize: 11, marginLeft: 6 }} title={t('crm.aiEmployees.v2.blockedToday')}>
                            ⏸ {agent.stats?.blockedToday}
                          </span>
                        ) : null}
                      </div>
                      <div className="c-appr">
                        <span className={cn('e2-appr', pending > 0 && 'has')}>
                          <span className="b">{pending || '—'}</span>
                          {pending > 0 ? t('crm.aiEmployees.v2.queue') : ''}
                        </span>
                      </div>
                      <div className="c-act e2-rowbtns" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="e2-ib"
                          title={agent.status === 'active' ? t('crm.aiEmployees.profile.pause') : t('crm.aiEmployees.profile.resume')}
                          onClick={() => (agent.status === 'active' ? pauseAiEmployee(agent.id) : resumeAiEmployee(agent.id)).then(load)}
                        >
                          <I d={agent.status === 'active' ? ICON.pause : ICON.play} size={13} />
                        </button>
                        <button className="e2-ib" title={t('crm.aiEmployees.v2.hire')} onClick={() => navigate(`/ai-employees/${agent.id}`)}>
                          <I d={ICON.cog} size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!list.length ? <div className="e2-empty">{t('crm.aiEmployees.approvalsPage.empty')}</div> : null}
              </div>

              {dayLogs.length > 0 ? (
                <>
                  <div className="e2-sec">
                    <div className="h">{t('crm.aiEmployees.v2.dayFeed')}</div>
                    <div className="line" />
                    <button className="e2b gh" onClick={() => navigate('/ai-employees/logs')}>
                      {t('crm.aiEmployees.v2.dayFeedAll')}
                    </button>
                  </div>
                  <div className="ai-panel">
                    <LogList logs={dayLogs} />
                  </div>
                </>
              ) : null}

              {freeRoles.length > 0 ? (
                <>
                  <div className="e2-sec">
                    <div className="h">{t('crm.aiEmployees.v2.freeRoles')}</div>
                    <div className="line" />
                    <span className="kick">{freeRoles.length}</span>
                  </div>
                  <div className="e2-roles">
                    {freeRoles.map((r) => (
                      <div key={r.key} className={cn('e2-role', r.locked && 'lock')}>
                        <div className="rt">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="h">{trRole(r.key, 'shortTitle', r.shortTitle, t, i18n)}</div>
                            <div className="dp">
                              {trDepartment(r.department, t)} · {r.jobTitle}
                            </div>
                          </div>
                          {r.locked ? <span className="plan">{trPlanBadge(r.badge, t)}</span> : null}
                        </div>
                        <div className="ds">{trRole(r.key, 'description', r.description, t, i18n)}</div>
                        <div className="fn">
                          {trRoleFunctions(r.key, r.functions, t, i18n)
                            .slice(0, 3)
                            .map((f) => (
                              <span key={f}>{f}</span>
                            ))}
                        </div>
                        <div>
                          {!r.locked ? (
                            <button className="e2b gh sm" onClick={() => navigate(`/ai-employees/new?role=${r.key}`)}>
                              <I d={ICON.plus} size={12} />
                              {t('crm.aiEmployees.v2.hire')}
                            </button>
                          ) : (
                            <span className="e2-hint">{trPlanBadge(r.badge, t)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )
        ) : null}
      </div>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} plan={data?.plan} />
    </MainLayout>
  );
}

function ChooseView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [roles, setRoles] = useState<AiEmployeeRole[]>([]);
  const [plan, setPlan] = useState<AiPlanSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchAiRoles(), fetchAiPlanLimits()])
      .then(([r, p]) => {
        if (!alive) return;
        setRoles(r);
        setPlan(p);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const planFull = plan?.limit != null && plan.used >= plan.limit;

  return (
    <MainLayout>
      <PageHelpButton topic="aiEmployeesChoose" />
      <div className="ai-emp">
        <div className="ai-hero" style={{ marginBottom: 20 }}>
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.aiEmployees.badge.workforce')}
            </div>
            <h1>{t('crm.aiEmployees.choose.title')}</h1>
            <p className="sub">{t('crm.aiEmployees.choose.subtitle')}</p>
          </div>
          <div className="ai-hero-actions">
            <PlanUsage plan={plan} />
            <button className="aib ghost" onClick={() => navigate('/ai-employees')}>
              {t('crm.aiEmployees.choose.dashboardLink')}
            </button>
          </div>
        </div>
        {loading ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.choose.loading')}</div> : null}
        <div className="ai-role-grid">
          {roles.map((role) => (
            <RoleCard
              key={role.key}
              role={role}
              planFull={planFull}
              onSelect={() => navigate(`/ai-employees/new?role=${role.key}`)}
              onUpgrade={() => setUpgradeOpen(true)}
            />
          ))}
        </div>
      </div>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} plan={plan} />
    </MainLayout>
  );
}

function CreateView() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [search] = useSearchParams();
  const [roles, setRoles] = useState<AiEmployeeRole[]>([]);
  const [plan, setPlan] = useState<AiPlanSnapshot | null>(null);
  const [step, setStep] = useState(0);
  // Роль выбирается на /ai-employees/choose и приходит в ?role=… — отдельного шага «Роль» в мастере нет.
  const roleKey = (search.get('role') || '') as AiEmployeeRoleKey;
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('Professional, warm, concise');
  const [avatarAccent, setAvatarAccent] = useState<AiAvatarAccent>('ink');
  const [avatarStyle, setAvatarStyle] = useState<AiAvatarStyle>('rings');
  const [autonomyMode, setAutonomyMode] = useState<AiAgentAutonomyMode>('suggest');
  const [scheduleMode, setScheduleMode] = useState<'always' | 'business_hours' | 'custom' | 'manual'>('manual');
  const [dailyReportTime, setDailyReportTime] = useState('18:00');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [approvalRules, setApprovalRules] = useState<Record<string, boolean>>({});
  const [instructions, setInstructions] = useState('');
  const [clientDialogue, setClientDialogue] = useState<'approval' | 'auto'>('approval');
  const [sla, setSla] = useState({ enabled: false, minutes: 30 });
  const [dailyPlan, setDailyPlan] = useState({ enabled: false, time: '09:00' });
  const [triggers, setTriggers] = useState<AiTriggerConfig[]>([]);
  const [tableAccess, setTableAccess] = useState<AiTableAccess>({ mode: 'selected', tables: [] });
  const [emailInboxAccess, setEmailInboxAccess] = useState<AiEmailInboxAccess>({ accountIds: [] });
  const [timezone, setTimezone] = useState('Europe/Moscow');
  const [quickLang, setQuickLang] = useState<'Russian' | 'English' | 'Turkish'>('Russian');
  const [quickMode, setQuickMode] = useState<AiAgentAutonomyMode>('assisted');
  const [quickSchedule, setQuickSchedule] = useState<'always' | 'business_hours'>('business_hours');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [allConnections, setAllConnections] = useState<IntegrationConnectionDto[]>([]);
  const [openaiConnectionId, setOpenaiConnectionId] = useState('');
  const openaiConnections = useMemo(
    () => allConnections.filter((c) => c.kind === 'third_party_link' && c.linkCatalogId === 'openai'),
    [allConnections],
  );

  useEffect(() => {
    let alive = true;
    Promise.all([fetchAiRoles(), fetchAiPlanLimits(), fetchIntegrations()])
      .then(([r, p, conns]) => {
        if (!alive) return;
        setRoles(r);
        setPlan(p);
        setAllConnections(conns);
        const selected = r.find((role) => role.key === roleKey);
        if (!selected || selected.locked) {
          // Нет роли в адресе / роль недоступна на тарифе — назад к выбору сотрудника.
          navigate('/ai-employees/choose', { replace: true });
          return;
        }
        setName((current) => current || selected.defaultName);
        setDepartment((current) => current || trRole(selected.key, 'department', selected.department, t, i18n));
        setJobTitle((current) => current || trRole(selected.key, 'jobTitle', selected.jobTitle, t, i18n));
        setAvatarAccent(deriveAvatarAccent(selected.key));
        setAvatarStyle(deriveAvatarStyle(selected.key));
        setPermissions(selected.defaultPermissions.reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {}));
        setApprovalRules(selected.defaultApprovalRules.reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {}));
        setTriggers((selected.defaultTriggers || []).map((d) => ({ event: d.event, enabled: true, scope: d.scope, prompt: '' })));
        setRolesLoaded(true);
      })
      .catch(() => {
        if (alive) navigate('/ai-employees/choose', { replace: true });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRole = roles.find((role) => role.key === roleKey);

  const save = async (quick?: { language: string; mode: AiAgentAutonomyMode; schedule: 'always' | 'business_hours' }) => {
    if (!selectedRole) return;
    setSaving(true);
    setError('');
    try {
      const res = await createAiEmployee({
        role: selectedRole.key,
        name,
        department,
        jobTitle,
        language: quick ? quick.language : language,
        tone,
        autonomyMode: quick ? quick.mode : autonomyMode,
        scheduleMode: quick ? quick.schedule : scheduleMode,
        dailyReportTime,
        permissions,
        approvalRules,
        status: 'active',
        settings: {
          ...(openaiConnectionId ? { openaiConnectionId } : {}),
          avatarAccent,
          avatarStyle,
          instructions,
          triggers,
          tableAccess,
          // Быстрый старт: «сам» = полная автономия и сообщения клиентам без согласования;
          // остальное — с согласованием. План на день и контроль скорости включены сразу.
          clientDialogue: quick ? (quick.mode === 'auto' ? 'auto' : 'approval') : clientDialogue,
          sla: quick ? { enabled: true, minutes: 30 } : sla,
          dailyPlan: quick ? { enabled: true, time: '09:00' } : dailyPlan,
          emailInboxAccess,
          timezone,
        },
      });
      navigate(`/ai-employees/${res.agent.id}`);
    } catch (e) {
      setError(extractError(e, t));
      if ((e as any)?.payload?.code === 'AI_EMPLOYEE_PLAN_LIMIT') setUpgradeOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const stepIds = ['identity', 'access', 'actions', 'schedule', 'review'] as const;
  const back = () => (step === 0 ? navigate('/ai-employees/choose') : setStep((s) => Math.max(0, s - 1)));

  if (!rolesLoaded || !selectedRole) {
    return (
      <MainLayout>
        <div className="ai-emp">
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.choose.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="aiEmployeesCreate" />
      <div className="ai-emp">
        <button className="ai-back" onClick={back}>
          <I d={ICON.back} size={14} />
          {t('crm.aiEmployees.create.back')}
        </button>
        <div className="ai-create">
          <div style={{ marginBottom: 22 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>
              <span className="dot" />
              {t('crm.aiEmployees.create.title')}
            </div>
            <h1 style={{ fontSize: 26 }}>
              {`${t('crm.aiEmployees.create.title')} · ${trRole(selectedRole.key, 'title', selectedRole.title, t, i18n)}`}
            </h1>
            <p className="ai-hint" style={{ marginTop: 8, fontSize: 13, maxWidth: 760 }}>
              {trRole(selectedRole.key, 'description', selectedRole.description, t, i18n)}
            </p>
          </div>
          {error ? (
            <div className="ai-panel" style={{ padding: 14, marginBottom: 16, color: '#9a1f31', fontSize: 13 }}>
              {error}
            </div>
          ) : null}

          <div className="ai-steps">
            {stepIds.map((sid, index) => (
              <div key={sid} className={cn('ai-step', step === index && 'active', step > index && 'done')}>
                <span className="sn">{step > index ? <I d={ICON.check} size={13} /> : index + 1}</span>
                <span className="sl">{t(`crm.aiEmployees.create.steps.${sid}`)}</span>
                {index < stepIds.length - 1 ? <span className="sbar" /> : null}
              </div>
            ))}
          </div>

          {step === 0 && selectedRole ? (
            <>
              <div className="ai-form-card">
                <div className="fct">{t('crm.aiEmployees.quick.title')}</div>
                <p className="ai-hint" style={{ margin: '4px 0 12px' }}>{t('crm.aiEmployees.quick.hint')}</p>
                <div className="ai-field">
                  <label className="ai-label">{t('crm.aiEmployees.quick.q1')}</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['Russian', 'English', 'Turkish'] as const).map((lng) => (
                      <button key={lng} type="button" className={cn('e2-chip', quickLang === lng && 'on')} onClick={() => setQuickLang(lng)}>
                        {t(`crm.aiEmployees.quick.lang.${lng}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ai-field">
                  <label className="ai-label">{t('crm.aiEmployees.quick.q2')}</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['assisted', 'auto', 'suggest'] as const).map((m) => (
                      <button key={m} type="button" className={cn('e2-chip', quickMode === m && 'on')} onClick={() => setQuickMode(m)}>
                        {t(`crm.aiEmployees.quick.mode.${m}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ai-field">
                  <label className="ai-label">{t('crm.aiEmployees.quick.q3')}</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['always', 'business_hours'] as const).map((sc) => (
                      <button key={sc} type="button" className={cn('e2-chip', quickSchedule === sc && 'on')} onClick={() => setQuickSchedule(sc)}>
                        {t(`crm.aiEmployees.quick.schedule.${sc}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="aib primary" disabled={saving || !name.trim()} onClick={() => save({ language: quickLang, mode: quickMode, schedule: quickSchedule })}>
                  {t('crm.aiEmployees.quick.go')}
                </button>
                <div className="ai-hint" style={{ marginTop: 8 }}>{t('crm.aiEmployees.quick.orManual')}</div>
              </div>
              <div className="ai-form-card">
                <div className="fct">{t('crm.aiEmployees.create.steps.identity')}</div>
                <div className="ai-av-picker">
                  <div className="ai-av-preview">
                    <AiAvatar name={name || selectedRole.defaultName} accent={avatarAccent} avStyle={avatarStyle} size="xl" />
                    <span className="apl">{t('crm.aiEmployees.create.avatarPreviewLabel')}</span>
                  </div>
                  <div className="ai-av-controls">
                    <div className="ai-field" style={{ margin: 0 }}>
                      <label className="ai-label">{t('crm.aiEmployees.create.fields.name')}</label>
                      <input className="ai-input" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <label className="ai-label">{t('crm.aiEmployees.create.fields.avatarColor')}</label>
                      <div className="ai-av-swatches">
                        {AI_AVATAR_ACCENTS.map((a) => (
                          <button
                            key={a}
                            type="button"
                            className={cn('ai-av-sw', avatarAccent === a && 'on')}
                            style={{ background: AVATAR_SWATCH_BG[a] }}
                            onClick={() => setAvatarAccent(a)}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <label className="ai-label">{t('crm.aiEmployees.create.fields.avatarStyle')}</label>
                      <div className="ai-av-styles">
                        {AI_AVATAR_STYLES.map((s) => (
                          <button key={s} type="button" className={cn('ai-av-style', avatarStyle === s && 'on')} onClick={() => setAvatarStyle(s)}>
                            <AiAvatar name={name || 'AI'} accent={avatarAccent} avStyle={s} size="sm" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ai-form-card">
                <div className="fct">{t('crm.aiEmployees.create.fields.tone')}</div>
                <div className="ai-field-row">
                  <div className="ai-field" style={{ margin: 0 }}>
                    <label className="ai-label">{t('crm.aiEmployees.create.fields.language')}</label>
                    <select className="ai-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                      {languageOptionValues().map((item) => (
                        <option key={item.value} value={item.value}>
                          {t(item.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ai-field" style={{ margin: 0 }}>
                    <label className="ai-label">{t('crm.aiEmployees.create.fields.tone')}</label>
                    <input className="ai-input" value={tone} onChange={(e) => setTone(e.target.value)} />
                  </div>
                </div>
                <div className="ai-field-row" style={{ marginTop: 16 }}>
                  <div className="ai-field" style={{ margin: 0 }}>
                    <label className="ai-label">{t('crm.aiEmployees.create.fields.department')}</label>
                    <input className="ai-input" value={department} onChange={(e) => setDepartment(e.target.value)} />
                  </div>
                  <div className="ai-field" style={{ margin: 0 }}>
                    <label className="ai-label">{t('crm.aiEmployees.create.fields.jobTitle')}</label>
                    <input className="ai-input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                  </div>
                </div>
                <div className="ai-field" style={{ marginTop: 16, marginBottom: 0 }}>
                  <label className="ai-label">{t('crm.aiEmployees.create.fields.timezone')}</label>
                  <select className="ai-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <p className="ai-hint" style={{ marginTop: 6, fontSize: 11.5 }}>
                    {t('crm.aiEmployees.create.fields.timezoneHint')}
                  </p>
                </div>
                <div className="ai-field" style={{ marginTop: 16, marginBottom: 0 }}>
                  <label className="ai-label">{t('crm.aiEmployees.create.fields.aiProvider')}</label>
                  <select className="ai-select" value={openaiConnectionId} onChange={(e) => setOpenaiConnectionId(e.target.value)}>
                    <option value="">{t('crm.aiEmployees.create.aiProviderPlatform')}</option>
                    {openaiConnections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {openaiConnectionId && (
                    <p style={{ marginTop: 6, fontSize: 11, color: 'var(--ai-fg-3, #64748b)' }}>
                      {t('crm.aiEmployees.create.aiProviderOwnKeyHint')}
                    </p>
                  )}
                </div>
              </div>
              <InstructionsEditor
                value={instructions}
                onChange={setInstructions}
                expandContext={{ role: roleKey, name, department, jobTitle, language, tone }}
              />
            </>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-3.5">
              <PermissionEditor permissions={permissions} setPermissions={setPermissions} />
              <TableAccessEditor value={tableAccess} onChange={setTableAccess} />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-3.5">
              <div className="ai-panel">
                <div className="ai-panel-head">
                  <div className="pt">
                    <I d={ICON.wand} size={14} />
                    {t('crm.aiEmployees.profile.autonomySection')}
                  </div>
                </div>
                <div className="ai-panel-body">
                  <AutonomySelector value={autonomyMode} onChange={setAutonomyMode} />
                </div>
              </div>
              <ApprovalEditor approvalRules={approvalRules} setApprovalRules={setApprovalRules} lockNote={autonomyLockNote(t, autonomyMode)} />
              <ClientDialogueEditor value={clientDialogue} onChange={setClientDialogue} lockNote={autonomyLockNote(t, autonomyMode)} />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="ai-form-card">
              <div className="fct">{t('crm.aiEmployees.create.fields.schedule')}</div>
              <div className="ai-field-row">
                <div className="ai-field" style={{ margin: 0 }}>
                  <label className="ai-label">{t('crm.aiEmployees.create.fields.schedule')}</label>
                  <select className="ai-select" value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as any)}>
                    <option value="manual">{t('crm.aiEmployees.create.scheduleModes.manual')}</option>
                    <option value="always">{t('crm.aiEmployees.create.scheduleModes.always')}</option>
                    <option value="business_hours">{t('crm.aiEmployees.create.scheduleModes.business_hours')}</option>
                    <option value="custom">{t('crm.aiEmployees.create.scheduleModes.custom')}</option>
                  </select>
                </div>
                <div className="ai-field" style={{ margin: 0 }}>
                  <label className="ai-label">{t('crm.aiEmployees.create.fields.dailyReportTime')}</label>
                  <input className="ai-input" type="time" value={dailyReportTime} onChange={(e) => setDailyReportTime(e.target.value)} />
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-3.5">
              <TriggersEditor triggers={triggers} onChange={setTriggers} />
              <EmailInboxAccessEditor value={emailInboxAccess} onChange={setEmailInboxAccess} />
              <ControlEditor sla={sla} dailyPlan={dailyPlan} onSla={setSla} onDailyPlan={setDailyPlan} />
            </div>
          ) : null}

          {step === 4 && selectedRole ? (
            <div className="ai-panel" style={{ overflow: 'hidden' }}>
              <div className="ai-preview-hd">
                <AiAvatar name={name || selectedRole.defaultName} accent={avatarAccent} avStyle={avatarStyle} size="xl" />
                <div>
                  <div style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                    {name || selectedRole.defaultName}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--ff-mono)',
                      fontSize: 11,
                      color: 'var(--fg-3)',
                      marginTop: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {trRole(selectedRole.key, 'title', selectedRole.title, t, i18n)}
                  </div>
                </div>
              </div>
              <div className="ai-preview-rows">
                <div className="ai-info-row">
                  <span className="k">{t('crm.aiEmployees.create.fields.name')}</span>
                  <span className="v">{trRole(selectedRole.key, 'title', selectedRole.title, t, i18n)}</span>
                </div>
                <div className="ai-info-row">
                  <span className="k">{t('crm.aiEmployees.create.fields.department')}</span>
                  <span className="v">
                    {department} · {jobTitle}
                  </span>
                </div>
                <div className="ai-info-row">
                  <span className="k">{t('crm.aiEmployees.profile.autonomySection')}</span>
                  <span className="v">{t(`crm.aiEmployees.autonomy.${autonomyMode}.title`)}</span>
                </div>
                <div className="ai-info-row">
                  <span className="k">{t('crm.aiEmployees.create.fields.language')}</span>
                  <span className="v">
                    {language} · {tone}
                  </span>
                </div>
                <div className="ai-info-row">
                  <span className="k">{t('crm.aiEmployees.create.review.accesses')}</span>
                  <span className="v">{Object.values(permissions).filter(Boolean).length}</span>
                </div>
                <div className="ai-info-row">
                  <span className="k">{t('crm.aiEmployees.create.review.approvalRules')}</span>
                  <span className="v">{Object.values(approvalRules).filter(Boolean).length}</span>
                </div>
                <div className="ai-info-row">
                  <span className="k">{t('crm.aiEmployees.create.review.triggers')}</span>
                  <span className="v">{triggers.filter((x) => x.enabled).length}</span>
                </div>
                <div className="ai-info-row">
                  <span className="k">{t('crm.aiEmployees.create.review.tables')}</span>
                  <span className="v">
                    {tableAccess.mode === 'all' ? t('crm.aiEmployees.tableAccess.mode.all') : tableAccess.tables.length}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="ai-create-foot">
            <button className="aib ghost" onClick={back}>
              {t('crm.aiEmployees.create.back')}
            </button>
            <div className="spacer" />
            {step < stepIds.length - 1 ? (
              <button className="aib" onClick={() => setStep((s) => Math.min(stepIds.length - 1, s + 1))}>
                {t('crm.aiEmployees.create.continue')}
                <I d={ICON.chevR} size={14} />
              </button>
            ) : (
              <button className="aib" disabled={saving} onClick={() => save()}>
                <I d={ICON.check} size={15} />
                {t('crm.aiEmployees.create.activate')}
              </button>
            )}
          </div>
        </div>
      </div>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} plan={plan} />
    </MainLayout>
  );
}

function ApprovalsView() {
  const [actions, setActions] = useState<AiAgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchPendingAiActions();
      setActions(res.items);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <MainLayout>
      <PageHelpButton topic="aiEmployeesApprovals" />
      <div className="ai-emp">
        <div className="ai-hero" style={{ marginBottom: 20 }}>
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.aiEmployees.badge.workforce')}
            </div>
            <h1>{t('crm.aiEmployees.approvalsPage.title')}</h1>
            <p className="sub">{t('crm.aiEmployees.approvalsPage.subtitle')}</p>
          </div>
        </div>
        {loading ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.approvalsPage.loading')}</div> : null}
        <div className="ai-panel">
          <div className="ai-panel-body flush">
            <ApprovalList actions={actions} onChanged={load} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function LogsView() {
  const [logs, setLogs] = useState<AiAgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  useEffect(() => {
    let alive = true;
    fetchAiLogs({ limit: 150 })
      .then((res) => {
        if (alive) setLogs(res.items);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <MainLayout>
      <PageHelpButton topic="aiEmployeesLogs" />
      <div className="ai-emp">
        <div className="ai-hero" style={{ marginBottom: 20 }}>
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.aiEmployees.badge.workforce')}
            </div>
            <h1>{t('crm.aiEmployees.logsPage.title')}</h1>
            <p className="sub">{t('crm.aiEmployees.logsPage.subtitle')}</p>
          </div>
        </div>
        {loading ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.logsPage.loading')}</div> : null}
        <div className="ai-panel">
          <LogList logs={logs} />
        </div>
      </div>
    </MainLayout>
  );
}

function ReportsView() {
  const [reports, setReports] = useState<AiAgentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAiReports({ limit: 80 });
      setReports(res.items);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <MainLayout>
      <PageHelpButton topic="aiEmployeesReports" />
      <div className="ai-emp">
        <div className="ai-hero" style={{ marginBottom: 20 }}>
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.aiEmployees.badge.workforce')}
            </div>
            <h1>{t('crm.aiEmployees.reportsPage.title')}</h1>
            <p className="sub">{t('crm.aiEmployees.reportsPage.subtitle')}</p>
          </div>
        </div>
        {loading ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.reportsPage.loading')}</div> : null}
        <div className="ai-panel">
          <ReportBrowser reports={reports} onChanged={load} />
        </div>
      </div>
    </MainLayout>
  );
}

function EditIdentityView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [agent, setAgent] = useState<AiAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('');
  const [avatarAccent, setAvatarAccent] = useState<AiAvatarAccent>('ink');
  const [avatarStyle, setAvatarStyle] = useState<AiAvatarStyle>('mono');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchAiEmployee(id)
      .then((res) => {
        if (!alive) return;
        const a = res.agent;
        setAgent(a);
        setName(a.name);
        setDepartment(a.department || '');
        setJobTitle(a.jobTitle || '');
        setLanguage(a.language || 'English');
        setTone(a.tone || '');
        const av = agentAvatarProps(a);
        setAvatarAccent(av.accent);
        setAvatarStyle(av.avStyle);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const save = async () => {
    if (!id || !agent) return;
    setSaving(true);
    setError('');
    try {
      const settings = { ...(agent.settings || {}), avatarAccent, avatarStyle };
      await updateAiEmployee(id, { name, department, jobTitle, language, tone, settings });
      navigate(`/ai-employees/${id}`);
    } catch (e) {
      setError(extractError(e, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <PageHelpButton topic="aiEmployeesCreate" />
      <div className="ai-emp">
        <button className="ai-back" onClick={() => navigate(id ? `/ai-employees/${id}` : '/ai-employees')}>
          <I d={ICON.back} size={14} />
          {agent ? agent.name : t('crm.aiEmployees.dashboard.title')}
        </button>
        <div className="ai-create">
          <div style={{ marginBottom: 22 }}>
            <h1 style={{ fontSize: 26 }}>
              {agent ? `${t('crm.aiEmployees.create.editTitle')} · ${agent.name}` : t('crm.aiEmployees.create.editTitle')}
            </h1>
          </div>
          {loading ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.profile.loading')}</div> : null}
          {error ? (
            <div className="ai-panel" style={{ padding: 14, marginBottom: 16, color: '#9a1f31', fontSize: 13 }}>
              {error}
            </div>
          ) : null}
          {agent ? (
            <>
              <div className="ai-form-card">
                <div className="fct">{t('crm.aiEmployees.create.steps.identity')}</div>
                <div className="ai-av-picker">
                  <div className="ai-av-preview">
                    <AiAvatar name={name || agent.name} accent={avatarAccent} avStyle={avatarStyle} size="xl" />
                    <span className="apl">{t('crm.aiEmployees.create.avatarPreviewLabel')}</span>
                  </div>
                  <div className="ai-av-controls">
                    <div className="ai-field" style={{ margin: 0 }}>
                      <label className="ai-label">{t('crm.aiEmployees.create.fields.name')}</label>
                      <input className="ai-input" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <label className="ai-label">{t('crm.aiEmployees.create.fields.avatarColor')}</label>
                      <div className="ai-av-swatches">
                        {AI_AVATAR_ACCENTS.map((a) => (
                          <button
                            key={a}
                            type="button"
                            className={cn('ai-av-sw', avatarAccent === a && 'on')}
                            style={{ background: AVATAR_SWATCH_BG[a] }}
                            onClick={() => setAvatarAccent(a)}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <label className="ai-label">{t('crm.aiEmployees.create.fields.avatarStyle')}</label>
                      <div className="ai-av-styles">
                        {AI_AVATAR_STYLES.map((s) => (
                          <button key={s} type="button" className={cn('ai-av-style', avatarStyle === s && 'on')} onClick={() => setAvatarStyle(s)}>
                            <AiAvatar name={name || 'AI'} accent={avatarAccent} avStyle={s} size="sm" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ai-form-card">
                <div className="fct">{t('crm.aiEmployees.create.fields.tone')}</div>
                <div className="ai-field-row">
                  <div className="ai-field" style={{ margin: 0 }}>
                    <label className="ai-label">{t('crm.aiEmployees.create.fields.language')}</label>
                    <select className="ai-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                      {languageOptionValues().map((item) => (
                        <option key={item.value} value={item.value}>
                          {t(item.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ai-field" style={{ margin: 0 }}>
                    <label className="ai-label">{t('crm.aiEmployees.create.fields.tone')}</label>
                    <input className="ai-input" value={tone} onChange={(e) => setTone(e.target.value)} />
                  </div>
                </div>
                <div className="ai-field-row" style={{ marginTop: 16 }}>
                  <div className="ai-field" style={{ margin: 0 }}>
                    <label className="ai-label">{t('crm.aiEmployees.create.fields.department')}</label>
                    <input className="ai-input" value={department} onChange={(e) => setDepartment(e.target.value)} />
                  </div>
                  <div className="ai-field" style={{ margin: 0 }}>
                    <label className="ai-label">{t('crm.aiEmployees.create.fields.jobTitle')}</label>
                    <input className="ai-input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="ai-create-foot">
                <button className="aib ghost" onClick={() => navigate(`/ai-employees/${id}`)}>
                  {t('crm.aiEmployees.create.back')}
                </button>
                <div className="spacer" />
                <button className="aib" disabled={saving} onClick={save}>
                  <I d={ICON.check} size={15} />
                  {t('crm.aiEmployees.create.saveChanges')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </MainLayout>
  );
}

export function AiEmployeeProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [detail, setDetail] = useState<AiAgentDetailResponse | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [approvalRules, setApprovalRules] = useState<Record<string, boolean>>({});
  const [autonomyMode, setAutonomyMode] = useState<AiAgentAutonomyMode>('suggest');
  const [scheduleMode, setScheduleMode] = useState<'always' | 'business_hours' | 'custom' | 'manual'>('manual');
  const [dailyReportTime, setDailyReportTime] = useState('18:00');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('');
  const [openaiConnectionId, setOpenaiConnectionId] = useState('');
  const [allConnections, setAllConnections] = useState<IntegrationConnectionDto[]>([]);
  const [assignments, setAssignments] = useState<AiAgentAssignmentItem[]>([]);
  const [tab, setTab] = useState<'overview' | 'access' | 'work' | 'journal'>('overview');
  const [journalFilter, setJournalFilter] = useState<'all' | 'appr' | 'log' | 'rep' | 'err'>('all');
  const [accessOpen, setAccessOpen] = useState(true);
  const [cfg, setCfg] = useState<AiAgentConfig | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const openaiConnections = useMemo(
    () => allConnections.filter((c) => c.kind === 'third_party_link' && c.linkCatalogId === 'openai'),
    [allConnections],
  );

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [res, assignRes] = await Promise.all([fetchAiEmployee(id), fetchAiAgentAssignments(id).catch(() => ({ items: [] }))]);
      setDetail(res);
      setPermissions(res.permissions);
      setApprovalRules(res.approvalRules);
      setAutonomyMode(res.agent.autonomyMode);
      setScheduleMode(res.agent.scheduleMode);
      setDailyReportTime(res.agent.dailyReportTime);
      setLanguage(res.agent.language || 'English');
      setTone(res.agent.tone || '');
      setOpenaiConnectionId((((res.agent.settings || {}) as Record<string, unknown>).openaiConnectionId as string) || '');
      setAssignments(assignRes.items);
      try {
        setCfg((await fetchAiAgentConfig(id)).config);
      } catch {
        /* конфиг не загрузился — вкладки покажут пустые значения */
      }
    } catch (e) {
      setError(extractError(e, t));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    fetchIntegrations()
      .then(setAllConnections)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const agent = detail?.agent;
  const stats = detail?.stats || {};
  const accessCounts = countAccessStates(autonomyMode, permissions, approvalRules);

  const run = async (kind: 'pause' | 'resume' | 'run' | 'report' | 'save-access' | 'save-work' | 'delete') => {
    if (!agent) return;
    setBusy(kind);
    setError('');
    try {
      if (kind === 'pause') await pauseAiEmployee(agent.id);
      if (kind === 'resume') await resumeAiEmployee(agent.id);
      if (kind === 'run') await runAiEmployeeNow(agent.id);
      if (kind === 'report') await generateAiEmployeeReport(agent.id);
      if (kind === 'save-access') {
        await Promise.all([
          updateAiEmployee(agent.id, { autonomyMode }),
          updateAiEmployeePermissions(agent.id, permissions),
          updateAiEmployeeApprovalRules(agent.id, approvalRules),
          cfg ? updateAiAgentConfig(agent.id, cfg) : Promise.resolve(undefined),
        ]);
      }
      if (kind === 'save-work') {
        await Promise.all([
          updateAiEmployee(agent.id, {
            language,
            tone,
            scheduleMode,
            dailyReportTime,
            settings: { openaiConnectionId: openaiConnectionId || null },
          }),
          cfg ? updateAiAgentConfig(agent.id, cfg) : Promise.resolve(undefined),
        ]);
      }
      if (kind === 'delete') {
        await deleteAiEmployee(agent.id);
        navigate('/ai-employees');
        return;
      }
      await load();
    } catch (e) {
      setError(extractError(e, t));
    } finally {
      setBusy('');
    }
  };

  const avatar = agent ? agentAvatarProps(agent) : { accent: 'ink' as AiAvatarAccent, avStyle: 'mono' as AiAvatarStyle };

  const tabs = agent
    ? [
        { key: 'overview' as const, label: t('crm.aiEmployees.profile.tabs.overview'), icon: ICON.eye, badge: 0 },
        { key: 'access' as const, label: t('crm.aiEmployees.profile.tabs.access'), icon: ICON.shield, badge: 0 },
        { key: 'work' as const, label: t('crm.aiEmployees.profile.tabs.work'), icon: ICON.wand, badge: cfg?.triggers.filter((x) => x.enabled).length || 0 },
        {
          key: 'journal' as const,
          label: t('crm.aiEmployees.profile.tabs.journal'),
          icon: ICON.book,
          badge: detail?.recentActions.filter((a) => a.status === 'pending' && a.requiresApproval).length || 0,
        },
      ]
    : [];

  return (
    <MainLayout>
      <PageHelpButton topic="aiEmployeeProfile" />
      <div className="ai-emp e2">
        <button className="e2-back" onClick={() => navigate('/ai-employees')}>
          <I d={ICON.back} size={14} />
          {t('crm.aiEmployees.dashboard.title')}
        </button>

        {loading ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.profile.loading')}</div> : null}
        {error ? (
          <div className="e2-panel" style={{ padding: 14, marginBottom: 16, color: '#9a1f31', fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        {agent ? (
          <>
            <div className="e2-id">
              <AiAvatar name={agent.name} accent={avatar.accent} avStyle={avatar.avStyle} size="xl" src={agent.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1>
                  {agent.name}
                  <StatusBadge status={agent.status} />
                </h1>
                <div className="meta">
                  <span>{trRole(agent.role, 'title', agent.roleTitle || '', t, i18n)}</span>
                  <span className="sep">•</span>
                  <span>{t(`crm.aiEmployees.autonomy.${agent.autonomyMode}.title`)}</span>
                  <span className="sep">•</span>
                  <span>{agent.department ? trDepartment(agent.department, t) : t('crm.aiEmployees.profile.fallbackDepartment')}</span>
                  <span className="sep">•</span>
                  <span>{t('crm.aiEmployees.agentCard.lastActivity', { time: formatDate(stats.lastActivityAt, t, i18n.language) })}</span>
                </div>
              </div>
              <div className="e2-id-r">
                <button className="e2b gh sm" onClick={() => navigate(`/ai-employees/${agent.id}/edit`)}>
                  <I d={ICON.edit} size={13} />
                  {t('crm.aiEmployees.profile.edit')}
                </button>
                {agent.status === 'paused' ? (
                  <button className="e2b gh sm" disabled={busy === 'resume'} onClick={() => run('resume')}>
                    <I d={ICON.play} size={13} />
                    {t('crm.aiEmployees.profile.resume')}
                  </button>
                ) : (
                  <button className="e2b gh sm" disabled={busy === 'pause'} onClick={() => run('pause')}>
                    <I d={ICON.pause} size={13} />
                    {t('crm.aiEmployees.profile.pause')}
                  </button>
                )}
                <button className="e2b sm" disabled={busy === 'run'} onClick={() => run('run')}>
                  <I d={ICON.bolt} size={14} />
                  {t('crm.aiEmployees.profile.runNow')}
                </button>
                <button className="e2b gh sm" disabled={busy === 'report'} onClick={() => run('report')}>
                  <I d={ICON.doc} size={13} />
                  {t('crm.aiEmployees.profile.generateReport')}
                </button>
                <button className="aib danger sm" disabled={busy === 'delete'} onClick={() => run('delete')}>
                  <I d={ICON.trash} size={13} />
                  {t('crm.aiEmployees.profile.remove')}
                </button>
              </div>
            </div>

            <div className="e2-tabs">
              {tabs.map((tb) => (
                <button key={tb.key} className={cn('e2-tab', tab === tb.key && 'on')} onClick={() => setTab(tb.key)}>
                  <I d={tb.icon} size={14} />
                  {tb.label}
                  {tb.badge ? <span className="bg">{tb.badge}</span> : null}
                </button>
              ))}
            </div>

            {tab === 'overview' ? (
              <div className="e2-grid2">
                <div className="e2-col">
                  <div className="e2-panel">
                    <div className="e2-panel-hd">
                      <div className="h">{t('crm.aiEmployees.v2.overview.pendingTitle')}</div>
                      <div className="r">
                        <button className="e2b gh sm" onClick={() => setTab('journal')}>
                          {t('crm.aiEmployees.logsPage.title')}
                        </button>
                      </div>
                    </div>
                    {detail!.recentActions.filter((a) => a.status === 'pending' && a.requiresApproval).length ? (
                      <ApprovalList
                        actions={detail!.recentActions
                          .filter((a) => a.status === 'pending' && a.requiresApproval)
                          .slice(0, 5)
                          .map((a) => ({ ...a, agent }))}
                        onChanged={load}
                      />
                    ) : (
                      <div className="e2-empty">{t('crm.aiEmployees.v2.overview.pendingEmpty')}</div>
                    )}
                  </div>
                  <div className="e2-panel">
                    <div className="e2-panel-hd">
                      <div className="h">{t('crm.aiEmployees.v2.overview.recentTitle')}</div>
                    </div>
                    {detail!.recentLogs.length ? (
                      <LogList logs={detail!.recentLogs.slice(0, 5).map((l) => ({ ...l, agent }))} />
                    ) : (
                      <div className="e2-empty">{t('crm.aiEmployees.v2.overview.recentEmpty')}</div>
                    )}
                  </div>
                </div>
                <div className="e2-col">
                  <div className="e2-panel">
                    <div className="e2-panel-hd">
                      <div className="h">{t('crm.aiEmployees.v2.overview.profileTitle')}</div>
                    </div>
                    <div className="e2-rows">
                      <div className="e2-kv">
                        <span className="k">{t('crm.aiEmployees.v2.overview.role')}</span>
                        <span className="v">{trRole(agent.role, 'title', agent.roleTitle || '', t, i18n)}</span>
                      </div>
                      <div className="e2-kv">
                        <span className="k">{t('crm.aiEmployees.v2.overview.deptJob')}</span>
                        <span className="v">
                          {agent.department ? trDepartment(agent.department, t) : t('crm.aiEmployees.profile.fallbackDepartment')}
                          {agent.jobTitle ? ` · ${agent.jobTitle}` : ''}
                        </span>
                      </div>
                      <div className="e2-kv">
                        <span className="k">{t('crm.aiEmployees.v2.overview.responsible')}</span>
                        <span className="v">
                          {detail?.responsible
                            ? `${detail.responsible.name}${detail.responsible.via ? ` · ${detail.responsible.via}` : ''}`
                            : t('crm.aiEmployees.v2.overview.responsibleNone')}
                        </span>
                      </div>
                      <div className="e2-kv">
                        <span className="k">{t('crm.aiEmployees.v2.overview.level')}</span>
                        <span className="v">{t(`crm.aiEmployees.autonomy.${agent.autonomyMode}.title`)}</span>
                      </div>
                      <div className="e2-kv">
                        <span className="k">{t('crm.aiEmployees.v2.overview.langTone')}</span>
                        <span className="v">
                          {agent.language} · {agent.tone}
                        </span>
                      </div>
                      <div className="e2-kv">
                        <span className="k">{t('crm.aiEmployees.v2.overview.model')}</span>
                        <span className="v">
                          {openaiConnectionId
                            ? openaiConnections.find((c) => c.id === openaiConnectionId)?.name || t('crm.aiEmployees.create.aiProviderPlatform')
                            : t('crm.aiEmployees.create.aiProviderPlatform')}
                        </span>
                      </div>
                      <div className="e2-kv">
                        <span className="k">{t('crm.aiEmployees.v2.overview.tz')}</span>
                        <span className="v">{cfg?.timezone || '—'}</span>
                      </div>
                      <div className="e2-kv">
                        <span className="k">{t('crm.aiEmployees.v2.overview.reportAt')}</span>
                        <span className="v">{agent.dailyReportTime}</span>
                      </div>
                      <div className="e2-kv">
                        <span className="k">{t('crm.aiEmployees.v2.overview.triggersOn')}</span>
                        <span className="v">{cfg?.triggers.filter((x) => x.enabled).length ?? 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="e2-panel">
                    <div className="e2-panel-hd">
                      <div className="h">{t('crm.aiEmployees.v2.overview.assignedTitle')}</div>
                    </div>
                    {assignments.length ? (
                      <div className="e2-rows">
                        {assignments.slice(0, 8).map((a) => (
                          <div className="e2-kv" key={a.id}>
                            <span className="k">{a.name || a.entityType}</span>
                            <span className="v">{a.entityType}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="e2-panel-bd">
                        <div className="e2-hint">{t('crm.aiEmployees.v2.overview.assignedEmpty')}</div>
                      </div>
                    )}
                  </div>
                  <div className="e2-panel">
                    <div className="e2-panel-hd">
                      <div className="h">{t('crm.aiEmployees.v2.overview.lastReportTitle')}</div>
                    </div>
                    <div className="e2-panel-bd">
                      {detail!.latestReport ? (
                        <>
                          <div className="e2-note" style={{ marginBottom: 10 }}>
                            <b>{detail!.latestReport.title}</b>
                            <br />
                            {formatDate(detail!.latestReport.createdAt, t, i18n.language)}
                          </div>
                          <button className="e2b gh sm" onClick={() => setTab('journal')}>
                            {t('crm.aiEmployees.v2.overview.open')}
                          </button>
                        </>
                      ) : (
                        <div className="e2-hint">{t('crm.aiEmployees.v2.overview.lastReportEmpty')}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'access' ? (
              <>
                <div className="e2-grid2">
                  <div className="e2-col">
                    <div className="e2-panel">
                      <div className="e2-panel-hd">
                        <div className="h">{t('crm.aiEmployees.v2.access.levelTitle')}</div>
                      </div>
                      <div className="e2-presets">
                        {AUTONOMY_PRESET_ORDER.map((m) => (
                          <button key={m} type="button" className={cn('e2-preset', autonomyMode === m && 'on')} onClick={() => setAutonomyMode(m)}>
                            <div className="h">{t(`crm.aiEmployees.autonomy.${m}.title`)}</div>
                            <div className="ds">{t(`crm.aiEmployees.autonomy.${m}.hint`)}</div>
                          </button>
                        ))}
                      </div>
                      <div className="e2-panel-bd" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {autonomyMode === 'suggest' ? (
                          <p className="e2-note">{t('crm.aiEmployees.v2.access.levelNote_off')}</p>
                        ) : autonomyMode === 'assisted' ? (
                          <p className="e2-note">{t('crm.aiEmployees.v2.access.levelNote_appr', { appr: accessCounts.appr })}</p>
                        ) : (
                          <p className="e2-note">
                            {t('crm.aiEmployees.v2.access.levelNote_mixed', { auto: accessCounts.auto, appr: accessCounts.appr, off: accessCounts.off })}
                          </p>
                        )}
                        {autonomyMode === 'suggest' ? <p className="e2-warn">{t('crm.aiEmployees.v2.access.observerWarn')}</p> : null}
                        {autonomyMode === 'assisted' ? <p className="e2-warn">{t('crm.aiEmployees.v2.access.assistedWarn')}</p> : null}
                      </div>
                    </div>

                    <div className="e2-panel">
                      <div className="e2-panel-hd">
                        <div className="h">{t('crm.aiEmployees.v2.access.matrixTitle')}</div>
                        <div className="r">
                          <button
                            className="e2b gh sm"
                            onClick={() => {
                              const role = detail?.role;
                              if (!role) return;
                              setPermissions(Object.fromEntries(role.defaultPermissions.map((k) => [k, true])));
                              setApprovalRules(Object.fromEntries(role.defaultApprovalRules.map((k) => [k, true])));
                            }}
                          >
                            {t('crm.aiEmployees.v2.access.resetToRole')}
                          </button>
                          <button className="e2b gh sm" onClick={() => setAccessOpen((v) => !v)}>
                            {accessOpen ? t('crm.aiEmployees.v2.access.collapse') : t('crm.aiEmployees.v2.access.expand')}
                          </button>
                        </div>
                      </div>
                      {accessOpen ? (
                        <>
                          {ACCESS_MODULES.map((mod) => (
                            <div className="e2-mod" key={mod.key}>
                              <div className="e2-mod-hd">
                                <span className="t">{t(mod.labelKey)}</span>
                                <span className="c">
                                  {mod.acts.filter((k) => accessStateWithRules(autonomyMode, permissions, approvalRules, k) !== 'off').length}/
                                  {mod.acts.length}
                                </span>
                              </div>
                              {mod.acts.map((key) => {
                                const cur = accessStateWithRules(autonomyMode, permissions, approvalRules, key);
                                const allowed = statesFor(autonomyMode, key);
                                return (
                                  <div className="e2-act" key={key}>
                                    <div className="ab">
                                      <div className="an">{t(`crm.aiEmployees.permissions.${key}.title`, { defaultValue: labelize(key) })}</div>
                                      <div className="ad">{t(`crm.aiEmployees.permissions.${key}.hint`, { defaultValue: '' })}</div>
                                    </div>
                                    <div className="e2-tri">
                                      {(['off', 'appr', 'auto'] as AccessState[]).map((s) => (
                                        <button
                                          key={s}
                                          type="button"
                                          disabled={!allowed.includes(s)}
                                          className={cn(cur === s && 'on', cur === s && s === 'appr' && 'appr')}
                                          onClick={() => {
                                            if (!allowed.includes(s)) return;
                                            setPermissions((p) => ({ ...p, [key]: s !== 'off' }));
                                            setApprovalRules((r) => ({ ...r, [key]: s === 'appr' }));
                                          }}
                                        >
                                          {t(`crm.aiEmployees.v2.fp.${s}`)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                          <div className="e2-mod">
                            <div className="e2-mod-hd">
                              <span className="t">{t('crm.aiEmployees.v2.access.alwaysOnTitle')}</span>
                            </div>
                            <div className="e2-act">
                              <div className="ab">
                                <div className="an">{t('crm.aiEmployees.v2.access.escalateName')}</div>
                                <div className="ad">{t('crm.aiEmployees.v2.access.escalateDesc')}</div>
                              </div>
                              <span className="e2-fixed">{t('crm.aiEmployees.v2.fp.auto')}</span>
                            </div>
                          </div>
                          <div className="e2-mod">
                            <div className="e2-mod-hd">
                              <span className="t">{t('crm.aiEmployees.v2.access.dataTitle')}</span>
                            </div>
                            <div className="e2-act">
                              <div className="ab">
                                <div className="an">{t('crm.aiEmployees.v2.access.readsName')}</div>
                                <div className="ad">{t('crm.aiEmployees.v2.access.readsDesc')}</div>
                              </div>
                              <span className="e2-fixed">{t('crm.aiEmployees.v2.fp.auto')}</span>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>

                    {cfg ? (
                      <>
                        <div>
                          <div className="e2-sec" style={{ margin: '4px 0 -6px' }}>
                            <span className="h" style={{ fontSize: 15 }}>
                              {t('crm.aiEmployees.v2.access.tablesTitle')}
                            </span>
                            <span className="line" />
                          </div>
                          <TableAccessEditor value={cfg.tableAccess} onChange={(v) => setCfg({ ...cfg, tableAccess: v })} />
                        </div>
                        <div>
                          <div className="e2-sec" style={{ margin: '4px 0 -6px' }}>
                            <span className="h" style={{ fontSize: 15 }}>
                              {t('crm.aiEmployees.v2.access.mailboxesTitle')}
                            </span>
                            <span className="line" />
                          </div>
                          <EmailInboxAccessEditor value={cfg.emailInboxAccess} onChange={(v) => setCfg({ ...cfg, emailInboxAccess: v })} />
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="e2-col">
                    <div className="e2-panel">
                      <div className="e2-panel-hd">
                        <div className="h">{t('crm.aiEmployees.v2.access.summaryTitle')}</div>
                      </div>
                      <div className="e2-metrics">
                        <div className="e2-metric">
                          <div className="kick">{t('crm.aiEmployees.v2.access.summaryAuto')}</div>
                          <div className="num">{accessCounts.auto}</div>
                        </div>
                        <div className="e2-metric">
                          <div className="kick">{t('crm.aiEmployees.v2.access.summaryAppr')}</div>
                          <div className="num">{accessCounts.appr}</div>
                        </div>
                        <div className="e2-metric">
                          <div className="kick">{t('crm.aiEmployees.v2.access.summaryOff')}</div>
                          <div className="num">{accessCounts.off}</div>
                        </div>
                      </div>
                      <div className="e2-rows">
                        <div className="e2-kv">
                          <span className="k">{t('crm.aiEmployees.v2.access.summaryLevel')}</span>
                          <span className="v">{t(`crm.aiEmployees.autonomy.${autonomyMode}.title`)}</span>
                        </div>
                        <div className="e2-kv">
                          <span className="k">{t('crm.aiEmployees.v2.access.summaryModules')}</span>
                          <span className="v">
                            {ACCESS_MODULES.filter((m) => m.acts.some((k) => accessStateWithRules(autonomyMode, permissions, approvalRules, k) !== 'off')).length}/
                            {ACCESS_MODULES.length}
                          </span>
                        </div>
                        <div className="e2-kv">
                          <span className="k">{t('crm.aiEmployees.v2.access.summaryTables')}</span>
                          <span className="v">
                            {cfg?.tableAccess.mode === 'all' ? t('crm.aiEmployees.tableAccess.mode.all') : (cfg?.tableAccess.tables.length ?? 0)}
                          </span>
                        </div>
                        <div className="e2-kv">
                          <span className="k">{t('crm.aiEmployees.v2.access.summaryMailboxes')}</span>
                          <span className="v">{cfg?.emailInboxAccess.accountIds.length ?? 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="e2-panel">
                      <div className="e2-panel-hd">
                        <div className="h">{t('crm.aiEmployees.v2.access.ownedTitle')}</div>
                      </div>
                      <div className="e2-panel-bd">
                        {assignments.length ? (
                          <p className="e2-note">{t('crm.aiEmployees.v2.access.ownedCount', { count: assignments.length })}</p>
                        ) : (
                          <p className="e2-hint">{t('crm.aiEmployees.v2.access.ownedNone')}</p>
                        )}
                      </div>
                    </div>

                    <div className="e2-panel">
                      <div className="e2-panel-hd">
                        <div className="h">{t('crm.aiEmployees.v2.access.decidesTitle')}</div>
                      </div>
                      <div className="e2-panel-bd" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(['decidesAuto', 'decidesAppr', 'decidesOff', 'decidesBulk'] as const).map((k) => (
                          <p key={k} className="e2-note" dangerouslySetInnerHTML={{ __html: t(`crm.aiEmployees.v2.access.${k}`) }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end" style={{ marginTop: 16 }}>
                  <button className="e2b" disabled={busy === 'save-access'} onClick={() => run('save-access')}>
                    {t('crm.aiEmployees.v2.access.save')}
                  </button>
                </div>
              </>
            ) : null}

            {tab === 'work' ? (
              <>
                <div className="e2-grid2">
                  <div className="e2-col">
                    <div className="e2-panel">
                      <div className="e2-panel-hd">
                        <div className="h">{t('crm.aiEmployees.v2.work.identityTitle')}</div>
                      </div>
                      <div className="e2-panel-bd">
                        <div className="e2-f2">
                          <div>
                            <label className="e2-lbl">{t('crm.aiEmployees.create.fields.language')}</label>
                            <select className="e2-sel" value={language} onChange={(e) => setLanguage(e.target.value)}>
                              {languageOptionValues().map((item) => (
                                <option key={item.value} value={item.value}>
                                  {t(item.labelKey)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="e2-lbl">{t('crm.aiEmployees.create.fields.tone')}</label>
                            <input className="e2-inp" value={tone} onChange={(e) => setTone(e.target.value)} />
                          </div>
                        </div>
                        <div className="e2-f2" style={{ marginTop: 12 }}>
                          <div>
                            <label className="e2-lbl">{t('crm.aiEmployees.create.fields.timezone')}</label>
                            <select
                              className="e2-sel"
                              value={cfg?.timezone || 'Europe/Moscow'}
                              onChange={(e) => cfg && setCfg({ ...cfg, timezone: e.target.value })}
                            >
                              {TIMEZONE_OPTIONS.map((tz) => (
                                <option key={tz} value={tz}>
                                  {tz}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="e2-lbl">{t('crm.aiEmployees.create.fields.aiProvider')}</label>
                            <select className="e2-sel" value={openaiConnectionId} onChange={(e) => setOpenaiConnectionId(e.target.value)}>
                              <option value="">{t('crm.aiEmployees.create.aiProviderPlatform')}</option>
                              {openaiConnections.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="e2-f2" style={{ marginTop: 12 }}>
                          <div>
                            <label className="e2-lbl">{t('crm.aiEmployees.create.fields.schedule')}</label>
                            <select className="e2-sel" value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as any)}>
                              <option value="always">{t('crm.aiEmployees.create.scheduleModes.always')}</option>
                              <option value="business_hours">{t('crm.aiEmployees.create.scheduleModes.business_hours')}</option>
                              <option value="custom">{t('crm.aiEmployees.create.scheduleModes.custom')}</option>
                              <option value="manual">{t('crm.aiEmployees.create.scheduleModes.manual')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="e2-lbl">{t('crm.aiEmployees.create.fields.dailyReportTime')}</label>
                            <input className="e2-inp" type="time" value={dailyReportTime} onChange={(e) => setDailyReportTime(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {cfg ? (
                      <InstructionsEditor
                        value={cfg.instructions}
                        onChange={(v) => setCfg({ ...cfg, instructions: v })}
                        expandContext={{
                          role: agent.role,
                          agentId: agent.id,
                          name: agent.name,
                          department: agent.department || undefined,
                          jobTitle: agent.jobTitle || undefined,
                          language: agent.language,
                          tone: agent.tone,
                        }}
                      />
                    ) : null}

                    <LessonsPanel agentId={agent.id} />

                    <div>
                      <div className="e2-sec" style={{ margin: '4px 0 -6px' }}>
                        <span className="h" style={{ fontSize: 15 }}>
                          {t('crm.aiEmployees.v2.work.taskPanelTitle')}
                        </span>
                        <span className="line" />
                      </div>
                      <AiAgentWorkPanel agentId={agent.id} agentActive={agent.status === 'active'} />
                    </div>
                  </div>
                  <div className="e2-col">
                    {cfg ? <TriggersEditor triggers={cfg.triggers} onChange={(next) => setCfg({ ...cfg, triggers: next })} /> : null}
                    {cfg ? (
                      <ClientDialogueEditor
                        value={cfg.clientDialogue}
                        onChange={(v) => setCfg({ ...cfg, clientDialogue: v })}
                        lockNote={autonomyLockNote(t, autonomyMode)}
                      />
                    ) : null}
                    {cfg ? (
                      <ControlEditor
                        sla={cfg.sla}
                        dailyPlan={cfg.dailyPlan}
                        onSla={(v) => setCfg({ ...cfg, sla: v })}
                        onDailyPlan={(v) => setCfg({ ...cfg, dailyPlan: v })}
                        onCheckSla={async () => {
                          try {
                            await updateAiAgentConfig(agent.id, cfg);
                            const r = await checkAiSlaNow(agent.id);
                            setNotice(t('crm.aiEmployees.sla.checked', { breaches: r.breaches, escalated: r.escalated }));
                          } catch (e) {
                            setError(extractError(e, t));
                          }
                        }}
                        onRunPlan={async () => {
                          try {
                            await updateAiAgentConfig(agent.id, cfg);
                            const r = await runAiDailyPlanNow(agent.id);
                            setNotice(t('crm.aiEmployees.dailyPlan.sent', { count: r.staff }));
                          } catch (e) {
                            setError(extractError(e, t));
                          }
                        }}
                      />
                    ) : null}
                    {notice ? (
                      <div className="e2-hint" style={{ color: '#1f8a5e' }}>
                        {notice}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex justify-end" style={{ marginTop: 16 }}>
                  <button className="e2b" disabled={busy === 'save-work'} onClick={() => run('save-work')}>
                    {t('crm.aiEmployees.config.save')}
                  </button>
                </div>
              </>
            ) : null}

            {tab === 'journal' ? (
              <div className="e2-panel">
                <div className="e2-panel-hd">
                  <div className="h">{t('crm.aiEmployees.logsPage.title')}</div>
                  <div className="r">
                    <button className="e2b sm" disabled={busy === 'report'} onClick={() => run('report')}>
                      <I d={ICON.sparkles} size={13} />
                      {t('crm.aiEmployees.profile.generateReport')}
                    </button>
                  </div>
                </div>
                <div className="e2-panel-bd" style={{ paddingBottom: 0 }}>
                  <div className="e2-chipbar">
                    {(
                      [
                        ['all', t('crm.aiEmployees.v2.journal.all')],
                        ['appr', t('crm.aiEmployees.v2.journal.appr')],
                        ['log', t('crm.aiEmployees.v2.journal.log')],
                        ['rep', t('crm.aiEmployees.v2.journal.rep')],
                        ['err', t('crm.aiEmployees.v2.journal.err')],
                      ] as const
                    ).map(([k, l]) => (
                      <button key={k} className={cn('e2-chip', journalFilter === k && 'on')} onClick={() => setJournalFilter(k)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {journalFilter === 'all' || journalFilter === 'appr' ? (
                  <ApprovalList
                    actions={detail!.recentActions.filter((a) => a.status !== 'pending' || a.requiresApproval).map((a) => ({ ...a, agent }))}
                    onChanged={load}
                  />
                ) : null}
                {journalFilter === 'all' || journalFilter === 'log' ? (
                  <LogList logs={detail!.recentLogs.map((l) => ({ ...l, agent }))} />
                ) : null}
                {journalFilter === 'err' ? (
                  <LogList logs={detail!.recentLogs.filter((l) => l.status === 'error').map((l) => ({ ...l, agent }))} />
                ) : null}
                {journalFilter === 'all' || journalFilter === 'rep' ? (
                  <ReportBrowser reports={detail!.reports.map((r) => ({ ...r, agent }))} onChanged={load} />
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}

export function AiEmployeesPage({ view = 'dashboard' }: { view?: AiEmployeesView }) {
  if (view === 'choose') return <ChooseView />;
  if (view === 'create') return <CreateView />;
  if (view === 'edit') return <EditIdentityView />;
  if (view === 'approvals') return <ApprovalsView />;
  if (view === 'logs') return <LogsView />;
  if (view === 'reports') return <ReportsView />;
  if (view === 'knowledge') return <KnowledgeView />;
  if (view === 'insights') return <InsightsView />;
  return <DashboardView />;
}

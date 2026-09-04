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
import {
  approveAiAction,
  createAiEmployee,
  deleteAiEmployee,
  executeAiAction,
  fetchAiActions,
  fetchAiEmployee,
  fetchAiEmployees,
  fetchAiLogs,
  fetchAiPlanLimits,
  fetchAiReports,
  fetchAiRoles,
  generateAiEmployeeReport,
  pauseAiEmployee,
  rejectAiAction,
  resumeAiEmployee,
  runAiEmployeeNow,
  sendAiReport,
  updateAiEmployee,
  updateAiEmployeeApprovalRules,
  updateAiEmployeePermissions,
  type AiAgent,
  type AiAgentAction,
  type AiAgentAutonomyMode,
  type AiAgentDetailResponse,
  type AiAgentLog,
  type AiAgentReport,
  type AiAgentsListResponse,
  type AiEmployeeRole,
  type AiEmployeeRoleKey,
  type AiPlanSnapshot,
} from '../../api/aiEmployees';

type AiEmployeesView = 'dashboard' | 'choose' | 'create' | 'edit' | 'approvals' | 'logs' | 'reports';

const permissionGroups: Array<{ titleKey: string; keys: string[] }> = [
  {
    titleKey: 'crm.aiEmployees.create.permissionGroups.read',
    keys: [
      'read_leads',
      'read_contacts',
      'read_companies',
      'read_deals',
      'read_tasks',
      'read_projects',
      'read_marketing',
      'read_campaigns',
      'read_marketing_traffic',
      'read_marketing_costs',
      'read_marketing_roi',
      'read_marketing_integrations',
      'read_attribution',
      'read_analytics',
      'read_reports',
      'read_sales',
      'read_messages',
      'read_files',
      'read_notes',
    ],
  },
  {
    titleKey: 'crm.aiEmployees.create.permissionGroups.actions',
    keys: [
      'create_task',
      'update_task',
      'create_note',
      'update_lead_status',
      'assign_lead',
      'draft_email',
      'send_email',
      'draft_whatsapp',
      'send_whatsapp',
      'create_report',
    ],
  },
  {
    titleKey: 'crm.aiEmployees.create.permissionGroups.workspace',
    keys: ['create_project', 'create_workspace_table', 'manage_workspace_data'],
  },
];

const approvalKeys = [
  'send_email',
  'send_whatsapp',
  'update_lead_status',
  'assign_lead',
  'edit_client_data',
  'connect_integration',
  'delete_data',
  'create_workspace_table',
];

const REAL_EXECUTABLE_ACTIONS = new Set([
  'send_email',
  'send_telegram',
  'update_lead_status',
  'assign_lead',
  'create_project',
  'create_workspace_table',
  'workspace_add_record',
  'workspace_bulk_add_records',
  'workspace_add_field',
  'workspace_enable_views',
]);

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

function ApprovalList({ actions, onChanged }: { actions: AiAgentAction[]; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState<Record<string, string>>({});

  const run = async (action: AiAgentAction, kind: 'approve' | 'reject' | 'execute') => {
    setBusy((s) => ({ ...s, [action.id]: kind }));
    try {
      if (kind === 'approve') await approveAiAction(action.id);
      if (kind === 'reject') await rejectAiAction(action.id);
      if (kind === 'execute') await executeAiAction(action.id);
      onChanged();
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
      {permissionGroups.map((group) => (
        <div key={group.titleKey} className="ai-panel">
          <div className="ai-panel-head">
            <div className="pt">{t(group.titleKey)}</div>
          </div>
          <div className="ai-panel-body flush">
            {group.keys.map((key) => (
              <div className="ai-perm" key={key}>
                <div className="pi">
                  <I d={ICON.shield} size={15} />
                </div>
                <div className="pb">
                  <div className="pn">{labelize(key)}</div>
                </div>
                <button
                  type="button"
                  className={cn('ai-toggle', permissions[key] ? 'on' : 'off')}
                  onClick={() => setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ApprovalEditor({
  approvalRules,
  setApprovalRules,
}: {
  approvalRules: Record<string, boolean>;
  setApprovalRules: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const { t } = useTranslation();
  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <div className="pt">{t('crm.aiEmployees.create.approvalRulesTitle')}</div>
      </div>
      <div className="ai-panel-body flush">
        {approvalKeys.map((key) => (
          <div className="ai-perm" key={key}>
            <div className="pb">
              <div className="pn">{t(`crm.aiEmployees.approvalAction.${key}`)}</div>
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
    { key: 'read_only', lvl: 25 },
    { key: 'suggest', lvl: 50 },
    { key: 'assisted', lvl: 75 },
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
function DashboardView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<AiAgentsListResponse | null>(null);
  const [pending, setPending] = useState<AiAgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [ownKeyModalOpen, setOwnKeyModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [employees, actions] = await Promise.all([fetchAiEmployees(), fetchAiActions({ status: 'pending', limit: 5 })]);
      setData(employees);
      setPending(actions.items);
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

  return (
    <MainLayout>
      <PageHelpButton topic="aiEmployees" />
      <div className="ai-emp">
        <div className="ai-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.aiEmployees.badge.workforce')}
            </div>
            <h1>{t('crm.aiEmployees.dashboard.title')}</h1>
            <p className="sub">{t('crm.aiEmployees.dashboard.subtitle')}</p>
          </div>
          <div className="ai-hero-actions">
            <PlanUsage plan={data?.plan} />
            <button className="aib" onClick={add}>
              <I d={ICON.plus} size={15} />
              {t('crm.aiEmployees.dashboard.addEmployee')}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--fg-3)', margin: '-8px 0 20px', maxWidth: 640, lineHeight: 1.5 }}>
          {t('crm.aiEmployees.naming.dashboardHint')}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            border: '1px solid var(--line-2)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 20,
            background: 'rgba(124, 58, 237, 0.04)',
          }}
        >
          <div style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--fg-1)' }}>{t('crm.aiEmployees.ownKeyBanner.title')}</strong>{' '}
            {t('crm.aiEmployees.ownKeyBanner.body')}
          </div>
          <button
            className="aib"
            style={{ flexShrink: 0 }}
            onClick={() => setOwnKeyModalOpen(true)}
          >
            {t('crm.aiEmployees.ownKeyBanner.button')}
          </button>
        </div>
        <OpenAiConnectModal
          open={ownKeyModalOpen}
          onClose={() => setOwnKeyModalOpen(false)}
          onCreated={() => setOwnKeyModalOpen(false)}
        />

        {error ? (
          <div className="ai-panel" style={{ padding: 16, marginBottom: 16, color: '#9a1f31', fontSize: 13 }}>
            {error}
          </div>
        ) : null}
        {loading ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.dashboard.loading')}</div> : null}

        {data ? (
          <>
            {data.items.length === 0 ? (
              <div className="ai-panel" style={{ padding: '40px 24px', textAlign: 'center', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <LottieIcon name="welcome" size={168} />
                </div>
                <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 600, fontSize: 19, color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 4 }}>
                  {t('crm.aiEmployees.empty.title')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-3)', maxWidth: 420, margin: '8px auto 0', lineHeight: 1.5 }}>
                  {t('crm.aiEmployees.empty.body')}
                </div>
                <button className="aib" style={{ marginTop: 18 }} onClick={add}>
                  <I d={ICON.plus} size={15} />
                  {t('crm.aiEmployees.empty.cta')}
                </button>
              </div>
            ) : (
              <>
                <div className="ai-kpis">
                  <KpiTile label={t('crm.aiEmployees.dashboard.kpiActive')} value={data.kpis.activeAiEmployees} icon={ICON.users} />
                  <KpiTile label={t('crm.aiEmployees.dashboard.kpiTasksToday')} value={data.kpis.tasksCompletedToday} icon={ICON.bolt} />
                  <KpiTile label={t('crm.aiEmployees.dashboard.kpiPendingApprovals')} value={data.kpis.pendingApprovals} icon={ICON.shield} />
                  <KpiTile label={t('crm.aiEmployees.dashboard.kpiReports')} value={data.kpis.reportsGenerated} icon={ICON.doc} />
                  <KpiTile label={t('crm.aiEmployees.dashboard.kpiLeads')} value={data.kpis.leadsAnalyzed} icon={ICON.lead} />
                  <KpiTile label={t('crm.aiEmployees.dashboard.kpiIssues')} value={data.kpis.issuesDetected} icon={ICON.x} />
                </div>

                <div className="ai-grp">
                  {t('crm.aiEmployees.dashboard.title')} <span className="cnt">· {data.items.length}</span>
                </div>
                <div className="ai-roster">
                  {data.items.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} onOpen={() => navigate(`/ai-employees/${agent.id}`)} />
                  ))}
                  <div
                    className="ai-card"
                    {...clickableProps(add)}
                    style={{
                      border: '1.5px dashed var(--line-2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      minHeight: 220,
                      background: 'rgba(255,255,255,0.5)',
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'var(--bg-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--fg-3)',
                        margin: '0 auto 12px',
                      }}
                    >
                      <I d={ICON.plus} size={20} />
                    </div>
                    <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                      {t('crm.aiEmployees.dashboard.hireCardTitle')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 5, maxWidth: 220, marginLeft: 'auto', marginRight: 'auto' }}>
                      {t('crm.aiEmployees.dashboard.hireCardSubtitle')}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="ai-grp" style={{ margin: 0, flex: 1 }}>
                    {t('crm.aiEmployees.dashboard.pendingTitle')}
                  </div>
                  <button className="aib ghost sm" onClick={() => navigate('/ai-employees/approvals')}>
                    {t('crm.aiEmployees.dashboard.openQueue')}
                  </button>
                </div>
                <div className="ai-panel">
                  <div className="ai-panel-body flush">
                    <ApprovalList actions={pending} onChanged={load} />
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="ai-grp" style={{ margin: 0, flex: 1 }}>
                    {t('crm.aiEmployees.dashboard.recentActivity')}
                  </div>
                  <button className="aib ghost sm" onClick={() => navigate('/ai-employees/logs')}>
                    {t('crm.aiEmployees.dashboard.viewLogs')}
                  </button>
                </div>
                <div className="ai-panel">
                  <div className="ai-panel-body flush">
                    <LogList logs={data.recentLogs} />
                  </div>
                </div>
              </div>
            </div>
          </>
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
  const [roleKey, setRoleKey] = useState<AiEmployeeRoleKey>((search.get('role') as AiEmployeeRoleKey) || 'sales_manager');
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
    Promise.all([fetchAiRoles(), fetchAiPlanLimits(), fetchIntegrations()]).then(([r, p, conns]) => {
      if (!alive) return;
      setRoles(r);
      setPlan(p);
      setAllConnections(conns);
      const selected = r.find((role) => role.key === roleKey) || r.find((role) => role.available);
      if (selected) {
        setRoleKey(selected.key);
        setName((current) => current || selected.defaultName);
        setDepartment((current) => current || trRole(selected.key, 'department', selected.department, t, i18n));
        setJobTitle((current) => current || trRole(selected.key, 'jobTitle', selected.jobTitle, t, i18n));
        setAvatarAccent(deriveAvatarAccent(selected.key));
        setAvatarStyle(deriveAvatarStyle(selected.key));
        setPermissions(selected.defaultPermissions.reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {}));
        setApprovalRules(selected.defaultApprovalRules.reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {}));
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRole = roles.find((role) => role.key === roleKey);

  const selectRole = (role: AiEmployeeRole) => {
    if (role.locked) {
      setUpgradeOpen(true);
      return;
    }
    setRoleKey(role.key);
    setName(role.defaultName);
    setDepartment(trRole(role.key, 'department', role.department, t, i18n));
    setJobTitle(trRole(role.key, 'jobTitle', role.jobTitle, t, i18n));
    setAvatarAccent(deriveAvatarAccent(role.key));
    setAvatarStyle(deriveAvatarStyle(role.key));
    setPermissions(role.defaultPermissions.reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {}));
    setApprovalRules(role.defaultApprovalRules.reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {}));
  };

  const save = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setError('');
    try {
      const res = await createAiEmployee({
        role: selectedRole.key,
        name,
        department,
        jobTitle,
        language,
        tone,
        autonomyMode,
        scheduleMode,
        dailyReportTime,
        permissions,
        approvalRules,
        status: 'active',
        settings: { ...(openaiConnectionId ? { openaiConnectionId } : {}), avatarAccent, avatarStyle },
      });
      navigate(`/ai-employees/${res.agent.id}`);
    } catch (e) {
      setError(extractError(e, t));
      if ((e as any)?.payload?.code === 'AI_EMPLOYEE_PLAN_LIMIT') setUpgradeOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const stepIds = ['role', 'identity', 'access', 'actions', 'schedule', 'review'] as const;
  const back = () => (step === 0 ? navigate('/ai-employees/choose') : setStep((s) => Math.max(0, s - 1)));

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
              {selectedRole
                ? `${t('crm.aiEmployees.create.title')} · ${trRole(selectedRole.key, 'title', selectedRole.title, t, i18n)}`
                : t('crm.aiEmployees.create.title')}
            </h1>
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

          {step === 0 ? (
            <div className="ai-role-grid">
              {roles.map((role) => (
                <RoleCard key={role.key} role={role} selected={role.key === roleKey} onSelect={() => selectRole(role)} onUpgrade={() => setUpgradeOpen(true)} />
              ))}
            </div>
          ) : null}

          {step === 1 && selectedRole ? (
            <>
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
            </>
          ) : null}

          {step === 2 ? <PermissionEditor permissions={permissions} setPermissions={setPermissions} /> : null}

          {step === 3 ? (
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
              <ApprovalEditor approvalRules={approvalRules} setApprovalRules={setApprovalRules} />
            </div>
          ) : null}

          {step === 4 ? (
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

          {step === 5 && selectedRole ? (
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
              </div>
            </div>
          ) : null}

          <div className="ai-create-foot">
            <button className="aib ghost" onClick={back}>
              {t('crm.aiEmployees.create.back')}
            </button>
            <div className="spacer" />
            {step < stepIds.length - 1 ? (
              <button className="aib" disabled={step === 0 && !roleKey} onClick={() => setStep((s) => Math.min(stepIds.length - 1, s + 1))}>
                {t('crm.aiEmployees.create.continue')}
                <I d={ICON.chevR} size={14} />
              </button>
            ) : (
              <button className="aib" disabled={saving} onClick={save}>
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
      const res = await fetchAiActions({ status: 'pending', limit: 100 });
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
  const [tab, setTab] = useState<'overview' | 'assign' | 'approvals' | 'journal' | 'reports'>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchAiEmployee(id);
      setDetail(res);
      setPermissions(res.permissions);
      setApprovalRules(res.approvalRules);
      setAutonomyMode(res.agent.autonomyMode);
      setScheduleMode(res.agent.scheduleMode);
      setDailyReportTime(res.agent.dailyReportTime);
    } catch (e) {
      setError(extractError(e, t));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const agent = detail?.agent;
  const stats = detail?.stats || {};

  const run = async (kind: 'pause' | 'resume' | 'run' | 'report' | 'save-perms' | 'save-rules' | 'save-assign' | 'delete') => {
    if (!agent) return;
    setBusy(kind);
    setError('');
    try {
      if (kind === 'pause') await pauseAiEmployee(agent.id);
      if (kind === 'resume') await resumeAiEmployee(agent.id);
      if (kind === 'run') await runAiEmployeeNow(agent.id);
      if (kind === 'report') await generateAiEmployeeReport(agent.id);
      if (kind === 'save-perms') await updateAiEmployeePermissions(agent.id, permissions);
      if (kind === 'save-rules') await updateAiEmployeeApprovalRules(agent.id, approvalRules);
      if (kind === 'save-assign') await updateAiEmployee(agent.id, { autonomyMode, scheduleMode, dailyReportTime });
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
        { key: 'assign' as const, label: t('crm.aiEmployees.profile.tabs.assign'), icon: ICON.shield, badge: 0 },
        {
          key: 'approvals' as const,
          label: t('crm.aiEmployees.profile.tabs.approvals'),
          icon: ICON.check,
          badge: detail?.recentActions.filter((a) => a.status === 'pending').length || 0,
        },
        { key: 'journal' as const, label: t('crm.aiEmployees.profile.tabs.journal'), icon: ICON.book, badge: 0 },
        { key: 'reports' as const, label: t('crm.aiEmployees.profile.tabs.reports'), icon: ICON.doc, badge: 0 },
      ]
    : [];

  return (
    <MainLayout>
      <PageHelpButton topic="aiEmployeeProfile" />
      <div className="ai-emp">
        <button className="ai-back" onClick={() => navigate('/ai-employees')}>
          <I d={ICON.back} size={14} />
          {t('crm.aiEmployees.dashboard.title')}
        </button>

        {loading ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.profile.loading')}</div> : null}
        {error ? (
          <div className="ai-panel" style={{ padding: 14, marginBottom: 16, color: '#9a1f31', fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        {agent ? (
          <>
            <div className="ai-detail-head">
              <AiAvatar name={agent.name} accent={avatar.accent} avStyle={avatar.avStyle} size="xl" src={agent.avatarUrl} />
              <div className="ai-detail-id">
                <div className="nm">
                  {agent.name}
                  <StatusBadge status={agent.status} />
                </div>
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
              <div className="ai-detail-actions">
                <button className="aib ghost sm" onClick={() => navigate(`/ai-employees/${agent.id}/edit`)}>
                  <I d={ICON.edit} size={13} />
                  {t('crm.aiEmployees.profile.edit')}
                </button>
                {agent.status === 'paused' ? (
                  <button className="aib ghost sm" disabled={busy === 'resume'} onClick={() => run('resume')}>
                    <I d={ICON.play} size={13} />
                    {t('crm.aiEmployees.profile.resume')}
                  </button>
                ) : (
                  <button className="aib ghost sm" disabled={busy === 'pause'} onClick={() => run('pause')}>
                    <I d={ICON.pause} size={13} />
                    {t('crm.aiEmployees.profile.pause')}
                  </button>
                )}
                <button className="aib sm" disabled={busy === 'run'} onClick={() => run('run')}>
                  <I d={ICON.bolt} size={14} />
                  {t('crm.aiEmployees.profile.runNow')}
                </button>
                <button className="aib ghost sm" disabled={busy === 'report'} onClick={() => run('report')}>
                  <I d={ICON.doc} size={13} />
                  {t('crm.aiEmployees.profile.generateReport')}
                </button>
                <button className="aib danger sm" disabled={busy === 'delete'} onClick={() => run('delete')}>
                  <I d={ICON.trash} size={13} />
                  {t('crm.aiEmployees.profile.remove')}
                </button>
              </div>
            </div>

            <div className="ai-tabs">
              {tabs.map((tb) => (
                <button key={tb.key} className={cn('ai-tab', tab === tb.key && 'active')} onClick={() => setTab(tb.key)}>
                  <span className="ic">
                    <I d={tb.icon} size={14} />
                  </span>
                  {tb.label}
                  {tb.badge ? <span className="badge">{tb.badge}</span> : null}
                </button>
              ))}
            </div>

            {tab === 'overview' ? (
              <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="flex flex-col gap-4">
                  <div className="ai-panel">
                    <div className="ai-panel-head">
                      <div className="pt">
                        <I d={ICON.sparkles} size={14} />
                        {t('crm.aiEmployees.profile.aboutSection')}
                      </div>
                    </div>
                    <div className="ai-panel-body">
                      <p style={{ fontSize: 13.5, color: 'var(--fg-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
                        {trRole(agent.role, 'description', agent.roleDescription || '', t, i18n)}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {trRoleFunctions(agent.role, agent.roleFunctions || [], t, i18n).map((f) => (
                          <div
                            key={f}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 9,
                              padding: '10px 12px',
                              border: '1px solid var(--line-3)',
                              borderRadius: 9,
                              fontSize: 12.5,
                              color: 'var(--ink)',
                            }}
                          >
                            <span style={{ color: 'var(--fg-3)' }}>
                              <I d={ICON.check} size={14} />
                            </span>
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="ai-panel">
                    <div className="ai-panel-head">
                      <div className="pt">
                        <I d={ICON.book} size={14} />
                        {t('crm.aiEmployees.profile.recentLogs')}
                      </div>
                      <button className="aib ghost sm" onClick={() => setTab('journal')}>
                        {t('crm.aiEmployees.logsPage.title')}
                      </button>
                    </div>
                    <div className="ai-panel-body flush">
                      <LogList logs={detail!.recentLogs.slice(0, 4).map((l) => ({ ...l, agent }))} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="ai-panel">
                    <div className="ai-panel-head">
                      <div className="pt">{t('crm.aiEmployees.profile.todayStats')}</div>
                    </div>
                    <div className="ai-panel-body grid grid-cols-2 gap-2">
                      {[
                        [t('crm.aiEmployees.profile.kpiActionsToday'), stats.actionsToday ?? 0],
                        [t('crm.aiEmployees.dashboard.kpiPendingApprovals'), stats.pendingApprovals ?? 0],
                        [t('crm.aiEmployees.profile.kpiReportsGen'), stats.reportsGenerated ?? 0],
                        [t('crm.aiEmployees.dashboard.kpiIssues'), stats.errors ?? 0],
                      ].map(([l, v]) => (
                        <div key={String(l)} style={{ border: '1px solid var(--line-3)', borderRadius: 10, padding: '13px 14px' }}>
                          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{v}</div>
                          <div
                            style={{
                              fontFamily: 'var(--ff-mono)',
                              fontSize: 9,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: 'var(--fg-3)',
                              marginTop: 5,
                            }}
                          >
                            {l}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ai-panel">
                    <div className="ai-panel-head">
                      <div className="pt">{t('crm.aiEmployees.profile.configSection')}</div>
                    </div>
                    <div className="ai-panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                      <div className="ai-info-row">
                        <span className="k">{t('crm.aiEmployees.profile.autonomySection')}</span>
                        <span className="v">{t(`crm.aiEmployees.autonomy.${agent.autonomyMode}.title`)}</span>
                      </div>
                      <div className="ai-info-row">
                        <span className="k">{t('crm.aiEmployees.profile.scheduleSection')}</span>
                        <span className="v">{t(`crm.aiEmployees.create.scheduleModes.${agent.scheduleMode}`)}</span>
                      </div>
                      <div className="ai-info-row">
                        <span className="k">{t('crm.aiEmployees.create.fields.language')}</span>
                        <span className="v">
                          {agent.language} · {agent.tone}
                        </span>
                      </div>
                      <div className="ai-info-row">
                        <span className="k">{t('crm.aiEmployees.create.fields.dailyReportTime')}</span>
                        <span className="v">{agent.dailyReportTime}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'assign' ? (
              <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="flex flex-col gap-4">
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
                  <PermissionEditor permissions={permissions} setPermissions={setPermissions} />
                  <div className="flex justify-end">
                    <button className="aib" disabled={busy === 'save-perms'} onClick={() => run('save-perms')}>
                      {t('crm.aiEmployees.profile.savePermissions')}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <ApprovalEditor approvalRules={approvalRules} setApprovalRules={setApprovalRules} />
                  <div className="flex justify-end">
                    <button className="aib" disabled={busy === 'save-rules'} onClick={() => run('save-rules')}>
                      {t('crm.aiEmployees.profile.saveApprovalRules')}
                    </button>
                  </div>
                  <div className="ai-panel">
                    <div className="ai-panel-head">
                      <div className="pt">
                        <I d={ICON.clock} size={14} />
                        {t('crm.aiEmployees.profile.scheduleSection')}
                      </div>
                    </div>
                    <div className="ai-panel-body flex flex-col gap-3.5">
                      <div className="ai-field" style={{ margin: 0 }}>
                        <label className="ai-label">{t('crm.aiEmployees.create.fields.schedule')}</label>
                        <select className="ai-select" value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as any)}>
                          <option value="always">{t('crm.aiEmployees.create.scheduleModes.always')}</option>
                          <option value="business_hours">{t('crm.aiEmployees.create.scheduleModes.business_hours')}</option>
                          <option value="custom">{t('crm.aiEmployees.create.scheduleModes.custom')}</option>
                          <option value="manual">{t('crm.aiEmployees.create.scheduleModes.manual')}</option>
                        </select>
                      </div>
                      <div className="ai-field" style={{ margin: 0 }}>
                        <label className="ai-label">{t('crm.aiEmployees.create.fields.dailyReportTime')}</label>
                        <input className="ai-input" type="time" value={dailyReportTime} onChange={(e) => setDailyReportTime(e.target.value)} />
                      </div>
                      <button className="aib" style={{ justifyContent: 'center' }} disabled={busy === 'save-assign'} onClick={() => run('save-assign')}>
                        {t('crm.aiEmployees.profile.saveAssignments')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'approvals' ? (
              <div className="ai-panel">
                <div className="ai-panel-head">
                  <div className="pt">
                    <I d={ICON.check} size={14} />
                    {t('crm.aiEmployees.approvalsPage.title')}
                  </div>
                </div>
                <div className="ai-panel-body flush">
                  <ApprovalList actions={detail!.recentActions.map((a) => ({ ...a, agent }))} onChanged={load} />
                </div>
              </div>
            ) : null}

            {tab === 'journal' ? (
              <div className="ai-panel">
                <div className="ai-panel-head">
                  <div className="pt">
                    <I d={ICON.book} size={14} />
                    {t('crm.aiEmployees.logsPage.title')}
                  </div>
                </div>
                <LogList logs={detail!.recentLogs.map((l) => ({ ...l, agent }))} />
              </div>
            ) : null}

            {tab === 'reports' ? (
              <div className="ai-panel">
                <div className="ai-panel-head">
                  <div className="pt">
                    <I d={ICON.doc} size={14} />
                    {t('crm.aiEmployees.profile.tabs.reports')}
                  </div>
                  <button className="aib sm" disabled={busy === 'report'} onClick={() => run('report')}>
                    <I d={ICON.sparkles} size={13} />
                    {t('crm.aiEmployees.profile.generateReport')}
                  </button>
                </div>
                <ReportBrowser reports={detail!.reports.map((r) => ({ ...r, agent }))} onChanged={load} />
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
  return <DashboardView />;
}

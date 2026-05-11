import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MainLayout } from '../../layout/MainLayout';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
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

type AiEmployeesView = 'dashboard' | 'choose' | 'create' | 'approvals' | 'logs' | 'reports';

/** Shell + surfaces aligned with `DashboardPage` / `DashboardWidgetChrome` */
const PAGE_SHELL =
  'relative isolate overflow-visible rounded-2xl border border-slate-200 bg-white px-3 py-5 sm:px-4 md:px-7 md:py-7';
const CHROME_SURFACE =
  'rounded-3xl border border-slate-200/70 bg-white/85 backdrop-blur-sm ring-1 ring-slate-900/[0.04] shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const CHROME_SURFACE_HOVER =
  'transition-[border-color,background-color,box-shadow] duration-300 hover:border-slate-300/90 hover:bg-white hover:shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] hover:ring-slate-900/[0.06]';
const CHROME_GRADIENT =
  'pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-white/0 via-sky-50/25 to-slate-50/40';

function AiEmployeesPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={PAGE_SHELL}>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <svg
        className="h-3.5 w-3.5 shrink-0 text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
      <h2 className="text-[13px] font-semibold tracking-tight text-slate-800">{children}</h2>
    </div>
  );
}

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
      'create_campaign',
      'draft_email',
      'send_email',
      'draft_whatsapp',
      'send_whatsapp',
      'create_report',
    ],
  },
];

const approvalKeys = [
  'send_email',
  'send_whatsapp',
  'update_lead_status',
  'assign_lead',
  'edit_client_data',
  'create_campaign',
  'bulk_send_campaign',
  'connect_integration',
  'delete_data',
];

function languageOptionValues(): Array<{ value: string; labelKey: string }> {
  return [
    { value: 'English', labelKey: 'crm.aiEmployees.languageOptions.english' },
    { value: 'Russian', labelKey: 'crm.aiEmployees.languageOptions.russian' },
    { value: 'Turkish', labelKey: 'crm.aiEmployees.languageOptions.turkish' },
    { value: 'English / Turkish / Russian', labelKey: 'crm.aiEmployees.languageOptions.mixed' },
  ];
}

function autonomyModeDefs(): Array<{ key: AiAgentAutonomyMode; titleKey: string; hintKey: string }> {
  return [
    { key: 'read_only', titleKey: 'crm.aiEmployees.autonomy.read_only.title', hintKey: 'crm.aiEmployees.autonomy.read_only.hint' },
    { key: 'suggest', titleKey: 'crm.aiEmployees.autonomy.suggest.title', hintKey: 'crm.aiEmployees.autonomy.suggest.hint' },
    { key: 'assisted', titleKey: 'crm.aiEmployees.autonomy.assisted.title', hintKey: 'crm.aiEmployees.autonomy.assisted.hint' },
    { key: 'auto', titleKey: 'crm.aiEmployees.autonomy.auto.title', hintKey: 'crm.aiEmployees.autonomy.auto.hint' },
  ];
}

function labelize(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
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
  return (
    payload?.message ||
    (error as Error)?.message ||
    t('crm.aiEmployees.errors.generic')
  );
}

function initials(name?: string | null) {
  return (name || 'AI')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('');
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'paused'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : status === 'pending'
          ? 'bg-sky-50 text-sky-700 border-sky-200'
          : status === 'failed'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', cls)}>
      {t(`crm.aiEmployees.status.${status}`, { defaultValue: labelize(status) })}
    </span>
  );
}

function AgentAvatar({ agent, role }: { agent?: Partial<AiAgent> | null; role?: Partial<AiEmployeeRole> | null }) {
  const color = agent?.roleAccent || role?.accent || '#111827';
  if (agent?.avatarUrl) {
    return (
      <img
        src={agent.avatarUrl}
        alt=""
        className="h-12 w-12 rounded-3xl object-cover ring-1 ring-slate-900/[0.06]"
      />
    );
  }
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-3xl text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.25)] ring-1 ring-white/10"
      style={{ backgroundColor: color }}
    >
      {initials(agent?.name || role?.defaultName)}
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div
          
          className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400"
        >
          {t('crm.aiEmployees.badge.workforce')}
        </div>
        <h1
          
          className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900 md:text-[30px]"
        >
          {title}
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

function PlanUsage({ plan }: { plan?: AiPlanSnapshot | null }) {
  const { t } = useTranslation();
  if (!plan) return null;
  const limitText = plan.unlimited
    ? t('crm.aiEmployees.plan.usageUnlimited')
    : t('crm.aiEmployees.plan.usage', { used: plan.used, limit: plan.limit });
  return (
    <div
      
      className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-[10.5px] uppercase tracking-[0.08em] text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <span className="font-medium text-slate-900">
        {t('crm.aiEmployees.plan.prefix')} {labelize(plan.plan)}
      </span>
      <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline" />
      <span className="font-normal normal-case tracking-normal text-slate-500">{limitText}</span>
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
            <Button variant="primary" onClick={() => { window.location.href = '/billing'; }}>
              {t('crm.aiEmployees.upgradeModal.upgradePlan')}
            </Button>
            <Button onClick={() => { window.location.href = '/pricing'; }}>
              {t('crm.aiEmployees.upgradeModal.comparePlans')}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t('crm.aiEmployees.upgradeModal.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className={cn('group relative min-h-[104px] overflow-hidden p-4 md:p-5', CHROME_SURFACE, CHROME_SURFACE_HOVER)}>
      <div className={CHROME_GRADIENT} />
      <div className="relative z-10">
        <div
          
          className="text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400"
        >
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
        {hint ? <div className="mt-1 text-[11px] text-slate-400">{hint}</div> : null}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AiAgent }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lastAt = formatDate(agent.stats?.lastActivityAt, t, i18n.language);
  return (
    <div className={cn('group relative flex h-full flex-col gap-5 overflow-hidden p-5 lg:p-6', CHROME_SURFACE, CHROME_SURFACE_HOVER)}>
      <div className={CHROME_GRADIENT} />
      <div className="relative z-10 flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <AgentAvatar agent={agent} />
          <div>
            <div className="font-semibold tracking-tight text-slate-900">{agent.name}</div>
            <div className="text-xs text-slate-500">{agent.roleTitle}</div>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      <p className="line-clamp-2 text-sm leading-6 text-slate-600">{agent.roleDescription}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-slate-50/90 px-2 py-3 ring-1 ring-slate-900/[0.04]">
          <div className="text-lg font-semibold text-slate-950">{agent.stats?.actionsToday ?? 0}</div>
          <div className="text-[11px] text-slate-500">{t('crm.aiEmployees.agentCard.today')}</div>
        </div>
        <div className="rounded-2xl bg-slate-50/90 px-2 py-3 ring-1 ring-slate-900/[0.04]">
          <div className="text-lg font-semibold text-slate-950">{agent.stats?.pendingApprovals ?? 0}</div>
          <div className="text-[11px] text-slate-500">{t('crm.aiEmployees.agentCard.approvals')}</div>
        </div>
        <div className="rounded-2xl bg-slate-50/90 px-2 py-3 ring-1 ring-slate-900/[0.04]">
          <div className="text-lg font-semibold text-slate-950">{agent.stats?.reportsGenerated ?? 0}</div>
          <div className="text-[11px] text-slate-500">{t('crm.aiEmployees.agentCard.reports')}</div>
        </div>
      </div>
      <div className="mt-auto border-t border-slate-100 pt-4">
        <div className="mb-3 text-xs text-slate-500">{t('crm.aiEmployees.agentCard.lastActivity', { time: lastAt })}</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={() => navigate(`/ai-employees/${agent.id}`)}>
            {t('crm.aiEmployees.agentCard.openProfile')}
          </Button>
          <Button size="sm" onClick={() => navigate(`/ai-employees/${agent.id}`)}>
            {t('crm.aiEmployees.agentCard.settings')}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

function RoleCard({
  role,
  planFull,
  onAdd,
  onUpgrade,
}: {
  role: AiEmployeeRole;
  planFull?: boolean;
  onAdd: () => void;
  onUpgrade: () => void;
}) {
  const { t } = useTranslation();
  const locked = role.locked || planFull;
  return (
    <div className={cn('group relative overflow-hidden p-5 lg:p-6', CHROME_SURFACE, !locked && CHROME_SURFACE_HOVER)}>
      <div className={cn(CHROME_GRADIENT, locked && 'hidden')} />
      <div className="relative z-10">
      {locked ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/72 backdrop-blur-[2px]">
          <div
            
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-700 shadow-sm"
          >
            {planFull ? t('crm.aiEmployees.choose.planLimitReached') : role.badge}
          </div>
        </div>
      ) : null}
      <div className={cn('space-y-4', locked && 'opacity-45')}>
        <div className="flex items-start gap-3">
          <AgentAvatar role={role} />
          <div className="min-w-0">
            <div className="font-semibold text-slate-950">{role.title}</div>
            <div className="mt-1 text-xs text-slate-500">{role.department}</div>
          </div>
        </div>
        <p className="min-h-[72px] text-sm leading-6 text-slate-600">{role.description}</p>
        <div className="space-y-2">
          {role.functions.slice(0, 5).map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
              {item}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="badge bg-slate-100 text-slate-600">{role.badge}</span>
          <Button size="sm" variant={locked ? 'secondary' : 'primary'} onClick={locked ? onUpgrade : onAdd}>
            {locked ? t('crm.aiEmployees.choose.upgradeToUnlock') : t('crm.aiEmployees.choose.addRole', { role: role.shortTitle })}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50/80 via-white to-white px-6 py-14 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-slate-900/[0.03]',
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]" />
      <div className="relative z-10">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-900 text-lg font-semibold text-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.35)] ring-1 ring-white/10">
          AI
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t('crm.aiEmployees.empty.title')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">{t('crm.aiEmployees.empty.body')}</p>
        <Button className="mt-7" variant="primary" onClick={onAdd}>
          {t('crm.aiEmployees.empty.cta')}
        </Button>
      </div>
    </div>
  );
}

function DashboardView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<AiAgentsListResponse | null>(null);
  const [pending, setPending] = useState<AiAgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [employees, actions] = await Promise.all([
        fetchAiEmployees(),
        fetchAiActions({ status: 'pending', limit: 5 }),
      ]);
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
      <AiEmployeesPageShell>
      <div className="w-full">
        <PageHeader
          title={t('crm.aiEmployees.dashboard.title')}
          subtitle={t('crm.aiEmployees.dashboard.subtitle')}
        >
          <PlanUsage plan={data?.plan} />
          <Button variant="primary" onClick={add}>
            {t('crm.aiEmployees.dashboard.addEmployee')}
          </Button>
        </PageHeader>
        <p className="mb-6 max-w-3xl text-sm leading-relaxed text-slate-500">{t('crm.aiEmployees.naming.dashboardHint')}</p>

        {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="text-sm text-slate-500">{t('crm.aiEmployees.dashboard.loading')}</div> : null}

        {data ? (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-4 xl:grid-cols-7">
              <KpiCard label={t('crm.aiEmployees.dashboard.kpiActive')} value={data.kpis.activeAiEmployees} />
              <KpiCard label={t('crm.aiEmployees.dashboard.kpiTasksToday')} value={data.kpis.tasksCompletedToday} />
              <KpiCard label={t('crm.aiEmployees.dashboard.kpiPendingApprovals')} value={data.kpis.pendingApprovals} />
              <KpiCard label={t('crm.aiEmployees.dashboard.kpiReports')} value={data.kpis.reportsGenerated} />
              <KpiCard label={t('crm.aiEmployees.dashboard.kpiLeads')} value={data.kpis.leadsAnalyzed} />
              <KpiCard label={t('crm.aiEmployees.dashboard.kpiMessages')} value={data.kpis.messagesDrafted} />
              <KpiCard label={t('crm.aiEmployees.dashboard.kpiIssues')} value={data.kpis.issuesDetected} />
            </div>

            {data.items.length === 0 ? (
              <EmptyState onAdd={add} />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 md:gap-5 xl:grid-cols-3">
                {data.items.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            )}

            <div className="mt-10 grid gap-6 border-t border-slate-100 pt-8 lg:grid-cols-[1.05fr_0.95fr]">
              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <SectionHeading>{t('crm.aiEmployees.dashboard.pendingTitle')}</SectionHeading>
                  <Button size="sm" onClick={() => navigate('/ai-employees/approvals')}>{t('crm.aiEmployees.dashboard.openQueue')}</Button>
                </div>
                <div className="space-y-3">
                  {pending.length ? pending.map((action) => <ApprovalCard key={action.id} action={action} onChanged={load} compact />) : (
                    <div className={cn('rounded-3xl border border-slate-200/70 bg-slate-50/50 p-5 text-sm text-slate-500 ring-1 ring-slate-900/[0.03]')}>{t('crm.aiEmployees.dashboard.noApprovalsWaiting')}</div>
                  )}
                </div>
              </section>
              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <SectionHeading>{t('crm.aiEmployees.dashboard.recentActivity')}</SectionHeading>
                  <Button size="sm" onClick={() => navigate('/ai-employees/logs')}>{t('crm.aiEmployees.dashboard.viewLogs')}</Button>
                </div>
                <ActivityList logs={data.recentLogs} />
              </section>
            </div>
          </>
        ) : null}
      </div>
      </AiEmployeesPageShell>
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
    return () => { alive = false; };
  }, []);

  const planFull = plan?.limit != null && plan.used >= plan.limit;

  return (
    <MainLayout>
      <AiEmployeesPageShell>
      <div className="w-full">
        <PageHeader
          title={t('crm.aiEmployees.choose.title')}
          subtitle={t('crm.aiEmployees.choose.subtitle')}
        >
          <PlanUsage plan={plan} />
          <Button onClick={() => navigate('/ai-employees')}>{t('crm.aiEmployees.choose.dashboardLink')}</Button>
        </PageHeader>
        {loading ? <div className="text-sm text-slate-500">{t('crm.aiEmployees.choose.loading')}</div> : null}
        <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
          {roles.map((role) => (
            <RoleCard
              key={role.key}
              role={role}
              planFull={planFull}
              onAdd={() => navigate(`/ai-employees/new?role=${role.key}`)}
              onUpgrade={() => setUpgradeOpen(true)}
            />
          ))}
        </div>
      </div>
      </AiEmployeesPageShell>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} plan={plan} />
    </MainLayout>
  );
}

function CreateView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  const [autonomyMode, setAutonomyMode] = useState<AiAgentAutonomyMode>('suggest');
  const [scheduleMode, setScheduleMode] = useState<'always' | 'business_hours' | 'custom' | 'manual'>('manual');
  const [dailyReportTime, setDailyReportTime] = useState('18:00');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [approvalRules, setApprovalRules] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchAiRoles(), fetchAiPlanLimits()]).then(([r, p]) => {
      if (!alive) return;
      setRoles(r);
      setPlan(p);
      const selected = r.find((role) => role.key === roleKey) || r.find((role) => role.available);
      if (selected) {
        setRoleKey(selected.key);
        setName((current) => current || selected.defaultName);
        setDepartment((current) => current || selected.department);
        setJobTitle((current) => current || selected.jobTitle);
        setPermissions(selected.defaultPermissions.reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {}));
        setApprovalRules(selected.defaultApprovalRules.reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {}));
      }
    });
    return () => { alive = false; };
  }, []);

  const selectedRole = roles.find((role) => role.key === roleKey);

  const selectRole = (role: AiEmployeeRole) => {
    if (role.locked) {
      setUpgradeOpen(true);
      return;
    }
    setRoleKey(role.key);
    setName(role.defaultName);
    setDepartment(role.department);
    setJobTitle(role.jobTitle);
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

  return (
    <MainLayout>
      <AiEmployeesPageShell>
      <div className="w-full">
        <PageHeader title={t('crm.aiEmployees.create.title')} subtitle={t('crm.aiEmployees.create.subtitle')}>
          <PlanUsage plan={plan} />
        </PageHeader>
        {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <div className="mb-6 grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
          {stepIds.map((sid, index) => (
            <button
              key={sid}
              type="button"
              onClick={() => setStep(index)}
              className={cn(
                'rounded-xl border px-3 py-2 text-[11px] font-medium transition-colors',
                step === index
                  ? 'border-slate-900 bg-slate-900 text-white shadow-[0_4px_14px_-6px_rgba(15,23,42,0.45)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              {index + 1}. {t(`crm.aiEmployees.create.steps.${sid}`)}
            </button>
          ))}
        </div>

        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
            {roles.map((role) => (
              <button key={role.key} type="button" className="text-left" onClick={() => selectRole(role)}>
                <div
                  className={cn(
                    'group relative h-full overflow-hidden p-5 transition-colors lg:p-6',
                    CHROME_SURFACE,
                    role.key === roleKey ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white' : CHROME_SURFACE_HOVER,
                  )}
                >
                  <div className={cn(CHROME_GRADIENT, role.key === roleKey && 'opacity-40')} />
                  <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <AgentAvatar role={role} />
                    <div>
                      <div className="font-semibold tracking-tight text-slate-900">{role.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{role.badge}</div>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">{role.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className={cn('p-5 lg:p-6', CHROME_SURFACE)}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('crm.aiEmployees.create.fields.name')}><input className="base-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label={t('crm.aiEmployees.create.fields.department')}><input className="base-input" value={department} onChange={(e) => setDepartment(e.target.value)} /></Field>
              <Field label={t('crm.aiEmployees.create.fields.jobTitle')}><input className="base-input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></Field>
              <Field label={t('crm.aiEmployees.create.fields.language')}>
                <select className="base-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {languageOptionValues().map((item) => (
                    <option key={item.value} value={item.value}>{t(item.labelKey)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('crm.aiEmployees.create.fields.tone')}>
                <input className="base-input" value={tone} onChange={(e) => setTone(e.target.value)} />
              </Field>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <PermissionEditor permissions={permissions} setPermissions={setPermissions} />
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              {autonomyModeDefs().map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setAutonomyMode(mode.key)}
                  className={cn(
                    'relative overflow-hidden rounded-3xl border bg-white/90 p-4 text-left ring-1 ring-slate-900/[0.04] transition-colors',
                    autonomyMode === mode.key
                      ? 'border-slate-900 shadow-[0_4px_18px_-8px_rgba(15,23,42,0.35)] ring-slate-900/15'
                      : 'border-slate-200/80 hover:border-slate-300 hover:bg-white',
                  )}
                >
                  <div className="text-sm font-semibold tracking-tight text-slate-900">{t(mode.titleKey)}</div>
                  <div className="mt-2 text-xs leading-relaxed text-slate-500">{t(mode.hintKey)}</div>
                </button>
              ))}
            </div>
            <ApprovalEditor approvalRules={approvalRules} setApprovalRules={setApprovalRules} />
          </div>
        ) : null}

        {step === 4 ? (
          <div className={cn('p-5 lg:p-6', CHROME_SURFACE)}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label={t('crm.aiEmployees.create.fields.schedule')}>
                <select className="base-select" value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as any)}>
                  <option value="manual">{t('crm.aiEmployees.create.scheduleModes.manual')}</option>
                  <option value="always">{t('crm.aiEmployees.create.scheduleModes.always')}</option>
                  <option value="business_hours">{t('crm.aiEmployees.create.scheduleModes.business_hours')}</option>
                  <option value="custom">{t('crm.aiEmployees.create.scheduleModes.custom')}</option>
                </select>
              </Field>
              <Field label={t('crm.aiEmployees.create.fields.dailyReportTime')}>
                <input className="base-input" type="time" value={dailyReportTime} onChange={(e) => setDailyReportTime(e.target.value)} />
              </Field>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className={cn('p-5 lg:p-6', CHROME_SURFACE)}>
            <div className="flex flex-col gap-5 md:flex-row md:items-start">
              <AgentAvatar role={selectedRole} agent={{ name }} />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-950">{name || selectedRole?.defaultName}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedRole?.title} · {t(`crm.aiEmployees.autonomy.${autonomyMode}.title`)}
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <SummaryTile label={t('crm.aiEmployees.create.review.accesses')} value={Object.values(permissions).filter(Boolean).length} />
                  <SummaryTile label={t('crm.aiEmployees.create.review.approvalRules')} value={Object.values(approvalRules).filter(Boolean).length} />
                  <SummaryTile label={t('crm.aiEmployees.create.review.reportTime')} value={dailyReportTime} />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <Button onClick={() => step === 0 ? navigate('/ai-employees/choose') : setStep((s) => Math.max(0, s - 1))}>
            {t('crm.aiEmployees.create.back')}
          </Button>
          {step < stepIds.length - 1 ? (
            <Button variant="primary" onClick={() => setStep((s) => Math.min(stepIds.length - 1, s + 1))}>
              {t('crm.aiEmployees.create.continue')}
            </Button>
          ) : (
            <Button variant="primary" loading={saving} onClick={save}>
              {t('crm.aiEmployees.create.activate')}
            </Button>
          )}
        </div>
      </div>
      </AiEmployeesPageShell>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} plan={plan} />
    </MainLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-group">
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}

function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
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
    <div className="grid gap-4 lg:grid-cols-2">
      {permissionGroups.map((group) => (
        <div key={group.titleKey} className={cn('p-5 lg:p-6', CHROME_SURFACE)}>
          <h3 className="mb-4 text-[13px] font-semibold tracking-tight text-slate-800">{t(group.titleKey)}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.keys.map((key) => (
              <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white/80 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-900/[0.02] transition-colors hover:border-slate-200">
                <input
                  type="checkbox"
                  checked={permissions[key] === true}
                  onChange={(e) => setPermissions((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
                {labelize(key)}
              </label>
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
    <div className={cn('p-5 lg:p-6', CHROME_SURFACE)}>
      <h3 className="mb-4 text-[13px] font-semibold tracking-tight text-slate-800">{t('crm.aiEmployees.create.approvalRulesTitle')}</h3>
      <div className="grid gap-2 md:grid-cols-3">
        {approvalKeys.map((key) => (
          <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white/80 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-900/[0.02] transition-colors hover:border-slate-200">
            <input
              type="checkbox"
              checked={approvalRules[key] === true}
              onChange={(e) => setApprovalRules((prev) => ({ ...prev, [key]: e.target.checked }))}
            />
            {t('crm.aiEmployees.create.approvalRequireBefore', {
              action: t(`crm.aiEmployees.approvalAction.${key}`),
            })}
          </label>
        ))}
      </div>
    </div>
  );
}

function ActivityList({ logs }: { logs: AiAgentLog[] }) {
  const { t, i18n } = useTranslation();
  if (!logs.length) {
    return (
      <div className={cn('rounded-3xl border border-slate-200/70 bg-slate-50/50 p-5 text-sm text-slate-500 ring-1 ring-slate-900/[0.03]')}>
        {t('crm.aiEmployees.activity.none')}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {logs.slice(0, 8).map((log) => (
        <div key={log.id} className={cn('group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 p-4 ring-1 ring-slate-900/[0.04] transition-colors hover:border-slate-300/90 hover:bg-white')}>
          <div className={cn(CHROME_GRADIENT)} />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium tracking-tight text-slate-900">{log.outputSummary || labelize(log.eventType)}</div>
              <div className="mt-1 text-xs text-slate-500">
                {log.agent?.name || t('crm.aiEmployees.fallbackEmployee')} · {labelize(log.eventType)}
              </div>
            </div>
            <div className="text-[11px] font-medium text-slate-400">{formatDate(log.createdAt, t, i18n.language)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const REAL_EXECUTABLE_ACTIONS = new Set(['send_email', 'send_telegram', 'update_lead_status', 'assign_lead']);

function ApprovalCard({ action, onChanged, compact }: { action: AiAgentAction; onChanged: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState('');
  const { t, i18n } = useTranslation();
  const canRealExecute = REAL_EXECUTABLE_ACTIONS.has(action.actionType);

  const run = async (kind: 'approve' | 'reject' | 'execute') => {
    setBusy(kind);
    try {
      if (kind === 'approve') await approveAiAction(action.id);
      if (kind === 'reject') await rejectAiAction(action.id);
      if (kind === 'execute') await executeAiAction(action.id);
      onChanged();
    } finally {
      setBusy('');
    }
  };
  return (
    <div className={cn('group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 p-4 ring-1 ring-slate-900/[0.04] transition-colors hover:border-slate-300/90 hover:bg-white')}>
      <div className={CHROME_GRADIENT} />
      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">{action.title}</h3>
            <StatusBadge status={action.status} />
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {action.agent?.name || t('crm.aiEmployees.fallbackEmployee')} · {labelize(action.actionType)} ·{' '}
            {formatDate(action.createdAt, t, i18n.language)}
          </div>
          {!compact && action.reason ? <p className="mt-3 text-sm leading-relaxed text-slate-600">{action.reason}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {action.status === 'pending' ? (
            <>
              <Button size="sm" variant="primary" loading={busy === 'approve'} onClick={() => run('approve')}>
                {t('crm.aiEmployees.approvalCard.approve')}
              </Button>
              <Button size="sm" variant="danger" loading={busy === 'reject'} onClick={() => run('reject')}>
                {t('crm.aiEmployees.approvalCard.reject')}
              </Button>
            </>
          ) : null}
          {action.status === 'approved' ? (
            <Button size="sm" variant="primary" loading={busy === 'execute'} onClick={() => run('execute')}>
              {canRealExecute
                ? t('crm.aiEmployees.approvalCard.execute')
                : t('crm.aiEmployees.approvalCard.markDone')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
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
  useEffect(() => { void load(); }, []);
  return (
    <MainLayout>
      <AiEmployeesPageShell>
      <div className="w-full">
        <PageHeader title={t('crm.aiEmployees.approvalsPage.title')} subtitle={t('crm.aiEmployees.approvalsPage.subtitle')} />
        {loading ? <div className="text-sm text-slate-500">{t('crm.aiEmployees.approvalsPage.loading')}</div> : null}
        <div className="space-y-3">
          {actions.length ? actions.map((action) => <ApprovalCard key={action.id} action={action} onChanged={load} />) : (
            <div className={cn('rounded-3xl border border-slate-200/70 bg-slate-50/80 p-8 text-center text-sm text-slate-500 ring-1 ring-slate-900/[0.03]')}>{t('crm.aiEmployees.approvalsPage.empty')}</div>
          )}
        </div>
      </div>
      </AiEmployeesPageShell>
    </MainLayout>
  );
}

function LogsView() {
  const [logs, setLogs] = useState<AiAgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();
  useEffect(() => {
    let alive = true;
    fetchAiLogs({ limit: 120 }).then((res) => { if (alive) setLogs(res.items); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return (
    <MainLayout>
      <AiEmployeesPageShell>
      <div className="w-full">
        <PageHeader title={t('crm.aiEmployees.logsPage.title')} subtitle={t('crm.aiEmployees.logsPage.subtitle')} />
        {loading ? <div className="text-sm text-slate-500">{t('crm.aiEmployees.logsPage.loading')}</div> : null}
        <div className={cn('overflow-hidden rounded-3xl ring-1 ring-slate-900/[0.04]', CHROME_SURFACE)}>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr>
                <th className="table-header-cell">{t('crm.aiEmployees.logsPage.colTime')}</th>
                <th className="table-header-cell">{t('crm.aiEmployees.logsPage.colEmployee')}</th>
                <th className="table-header-cell">{t('crm.aiEmployees.logsPage.colAction')}</th>
                <th className="table-header-cell">{t('crm.aiEmployees.logsPage.colObject')}</th>
                <th className="table-header-cell">{t('crm.aiEmployees.logsPage.colStatus')}</th>
                <th className="table-header-cell">{t('crm.aiEmployees.logsPage.colResult')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="table-row">
                  <td className="table-cell whitespace-nowrap">{formatDate(log.createdAt, t, i18n.language)}</td>
                  <td className="table-cell">{log.agent?.name || t('crm.aiEmployees.fallbackEmployee')}</td>
                  <td className="table-cell">{labelize(log.eventType)}</td>
                  <td className="table-cell">{log.targetType || '-'}</td>
                  <td className="table-cell"><StatusBadge status={log.status} /></td>
                  <td className="table-cell">{log.outputSummary || log.errorMessage || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      </AiEmployeesPageShell>
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
  useEffect(() => { void load(); }, []);
  return (
    <MainLayout>
      <AiEmployeesPageShell>
      <div className="w-full">
        <PageHeader title={t('crm.aiEmployees.reportsPage.title')} subtitle={t('crm.aiEmployees.reportsPage.subtitle')} />
        {loading ? <div className="text-sm text-slate-500">{t('crm.aiEmployees.reportsPage.loading')}</div> : null}
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} onChanged={load} />
          ))}
          {!reports.length && !loading ? (
            <div className={cn('rounded-3xl border border-slate-200/70 bg-slate-50/70 p-8 text-center text-sm text-slate-500 ring-1 ring-slate-900/[0.03]')}>{t('crm.aiEmployees.reportsPage.empty')}</div>
          ) : null}
        </div>
      </div>
      </AiEmployeesPageShell>
    </MainLayout>
  );
}

function ReportCard({ report, onChanged }: { report: AiAgentReport; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const { t, i18n } = useTranslation();
  return (
    <div className={cn('group relative overflow-hidden p-5 lg:p-6', CHROME_SURFACE, CHROME_SURFACE_HOVER)}>
      <div className={CHROME_GRADIENT} />
      <div className="relative z-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">{report.title}</h3>
            <StatusBadge status={report.status} />
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {report.agent?.name || t('crm.aiEmployees.fallbackEmployee')} · {formatDate(report.createdAt, t, i18n.language)}
          </div>
        </div>
        {report.status !== 'sent' ? (
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await sendAiReport(report.id, ['dashboard']);
                onChanged();
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('crm.aiEmployees.reportsPage.markSent')}
          </Button>
        ) : null}
        </div>
        <div className="mt-4 max-h-80 overflow-auto rounded-2xl border border-slate-100 bg-slate-50/90 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap ring-1 ring-slate-900/[0.03]">
          {report.contentMd}
        </div>
      </div>
    </div>
  );
}

export function AiEmployeeProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [detail, setDetail] = useState<AiAgentDetailResponse | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [approvalRules, setApprovalRules] = useState<Record<string, boolean>>({});
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
    } catch (e) {
      setError(extractError(e, t));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const agent = detail?.agent;
  const stats = detail?.stats || {};

  const run = async (kind: 'pause' | 'resume' | 'run' | 'report' | 'save-perms' | 'save-rules' | 'delete') => {
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

  return (
    <MainLayout>
      <AiEmployeesPageShell>
      <div className="w-full">
        {loading ? <div className="text-sm text-slate-500">{t('crm.aiEmployees.profile.loading')}</div> : null}
        {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {agent ? (
          <>
            <div className={cn('group relative mb-6 overflow-hidden p-6 lg:p-7', CHROME_SURFACE, CHROME_SURFACE_HOVER)}>
              <div className={CHROME_GRADIENT} />
              <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <AgentAvatar agent={agent} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1
                        
                        className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 md:text-[28px]"
                      >
                        {agent.name}
                      </h1>
                      <StatusBadge status={agent.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {agent.roleTitle} ·{' '}
                      {t(`crm.aiEmployees.autonomy.${agent.autonomyMode}.title`, { defaultValue: labelize(agent.autonomyMode) })} ·{' '}
                      {agent.department || t('crm.aiEmployees.profile.fallbackDepartment')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {agent.status === 'paused' ? (
                    <Button variant="primary" loading={busy === 'resume'} onClick={() => run('resume')}>
                      {t('crm.aiEmployees.profile.resume')}
                    </Button>
                  ) : (
                    <Button loading={busy === 'pause'} onClick={() => run('pause')}>{t('crm.aiEmployees.profile.pause')}</Button>
                  )}
                  <Button variant="primary" loading={busy === 'run'} onClick={() => run('run')}>
                    {t('crm.aiEmployees.profile.runNow')}
                  </Button>
                  <Button loading={busy === 'report'} onClick={() => run('report')}>
                    {t('crm.aiEmployees.profile.generateReport')}
                  </Button>
                  <Button variant="danger" loading={busy === 'delete'} onClick={() => run('delete')}>
                    {t('crm.aiEmployees.profile.remove')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-6">
              <KpiCard label={t('crm.aiEmployees.profile.kpiActionsToday')} value={stats.actionsToday ?? 0} />
              <KpiCard label={t('crm.aiEmployees.profile.kpiLeadsAnalyzed')} value={detail.recentLogs.filter((x) => x.eventType.includes('lead')).length} />
              <KpiCard label={t('crm.aiEmployees.profile.kpiTasksCreated')} value={detail.recentActions.filter((x) => x.actionType === 'create_task').length} />
              <KpiCard label={t('crm.aiEmployees.profile.kpiMessagesDrafted')} value={detail.recentActions.filter((x) => x.actionType.includes('email')).length} />
              <KpiCard label={t('crm.aiEmployees.profile.kpiReportsGen')} value={stats.reportsGenerated ?? 0} />
              <KpiCard label={t('crm.aiEmployees.profile.kpiPendingApprovals')} value={stats.pendingApprovals ?? 0} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-5">
                <section>
                  <div className="mb-3">
                    <SectionHeading>{t('crm.aiEmployees.profile.currentWork')}</SectionHeading>
                  </div>
                  <div className={cn('group relative overflow-hidden p-5 lg:p-6', CHROME_SURFACE)}>
                    <div className={CHROME_GRADIENT} />
                    <p className="relative z-10 text-sm leading-relaxed text-slate-600">
                      {stats.lastActivity || t('crm.aiEmployees.profile.readyManual', { name: agent.name })}
                    </p>
                  </div>
                </section>

                <section>
                  <div className="mb-3">
                    <SectionHeading>{t('crm.aiEmployees.profile.pendingSection')}</SectionHeading>
                  </div>
                  <div className="space-y-3">
                    {detail.recentActions.filter((x) => x.status === 'pending').map((action) => (
                      <ApprovalCard key={action.id} action={{ ...action, agent }} onChanged={load} />
                    ))}
                    {!detail.recentActions.some((x) => x.status === 'pending') ? (
                      <div className={cn('rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 text-sm text-slate-500 ring-1 ring-slate-900/[0.03]')}>
                        {t('crm.aiEmployees.profile.noPendingForEmployee')}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section>
                  <div className="mb-3">
                    <SectionHeading>{t('crm.aiEmployees.profile.recentActions')}</SectionHeading>
                  </div>
                  <div className="space-y-3">
                    {detail.recentActions.map((action) => (
                      <ApprovalCard key={action.id} action={{ ...action, agent }} onChanged={load} compact />
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                <section>
                  <div className="mb-3">
                    <SectionHeading>{t('crm.aiEmployees.profile.permissionsSummary')}</SectionHeading>
                  </div>
                  <PermissionEditor permissions={permissions} setPermissions={setPermissions} />
                  <div className="mt-3 flex justify-end">
                    <Button variant="primary" loading={busy === 'save-perms'} onClick={() => run('save-perms')}>
                      {t('crm.aiEmployees.profile.savePermissions')}
                    </Button>
                  </div>
                </section>

                <section>
                  <div className="mb-3">
                    <SectionHeading>{t('crm.aiEmployees.profile.approvalRulesSection')}</SectionHeading>
                  </div>
                  <ApprovalEditor approvalRules={approvalRules} setApprovalRules={setApprovalRules} />
                  <div className="mt-3 flex justify-end">
                    <Button variant="primary" loading={busy === 'save-rules'} onClick={() => run('save-rules')}>
                      {t('crm.aiEmployees.profile.saveApprovalRules')}
                    </Button>
                  </div>
                </section>

                <section>
                  <div className="mb-3">
                    <SectionHeading>{t('crm.aiEmployees.profile.dailyReportPreview')}</SectionHeading>
                  </div>
                  {detail.latestReport ? <ReportCard report={{ ...detail.latestReport, agent }} onChanged={load} /> : (
                    <div className={cn('rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 text-sm text-slate-500 ring-1 ring-slate-900/[0.03]')}>{t('crm.aiEmployees.profile.noReportYet')}</div>
                  )}
                </section>

                <section>
                  <div className="mb-3">
                    <SectionHeading>{t('crm.aiEmployees.profile.recentLogs')}</SectionHeading>
                  </div>
                  <ActivityList logs={detail.recentLogs.map((log) => ({ ...log, agent }))} />
                </section>
              </div>
            </div>
          </>
        ) : null}
      </div>
      </AiEmployeesPageShell>
    </MainLayout>
  );
}

export function AiEmployeesPage({ view = 'dashboard' }: { view?: AiEmployeesView }) {
  if (view === 'choose') return <ChooseView />;
  if (view === 'create') return <CreateView />;
  if (view === 'approvals') return <ApprovalsView />;
  if (view === 'logs') return <LogsView />;
  if (view === 'reports') return <ReportsView />;
  return <DashboardView />;
}

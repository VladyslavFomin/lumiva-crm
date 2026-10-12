import { API_BASE, api } from './client';
import { getAccessToken } from '../auth/session';

export type OfficeLevel = 'off' | 'read' | 'draft' | 'appr' | 'auto';
export type OfficePermCategory = 'crm' | 'finance' | 'tasks' | 'msg' | 'ads' | 'content' | 'stock' | 'code';
export type OfficeTaskStatus = 'backlog' | 'progress' | 'waiting' | 'blocked' | 'done' | 'rejected' | 'failed' | 'foreign';
export type OfficeKpiKey =
  | 'tasks_done_today'
  | 'tasks_waiting'
  | 'leads_new_7d'
  | 'leads_open'
  | 'meetings_upcoming'
  | 'sales_won_30d'
  | 'tasks_overdue'
  | 'tickets_open'
  | 'bookings_upcoming'
  | 'brain_files'
  | 'spend_month';

export interface OfficeAgent {
  id: string;
  title: string;
  isLead: boolean;
  prompt: string;
  status: string;
  sort: number;
  state?: string;
  currentTask?: { id: string; title: string; progress: number; status: OfficeTaskStatus } | null;
  doneToday?: number;
}

export interface OfficeIssue {
  id: string;
  departmentId: string;
  agentId: string | null;
  taskId: string | null;
  kind: 'error' | 'data' | 'access';
  title: string;
  detail: string;
  fix: 'upload' | 'access' | 'reconnect' | 'billing' | 'settings' | 'grant' | 'connect' | 'autonomy';
  target: string | null;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface OfficeDeptLive {
  next: number;
  doing: number;
  waiting: number;
  blocked: number;
  doneToday: number;
  spendMonthCents: number;
  kpis: Array<{ key: OfficeKpiKey; value: number }>;
  issue: OfficeIssue | null;
}

export interface OfficeDepartment {
  id: string;
  name: string;
  color: string;
  slot: [number, number];
  templateKey: string | null;
  mission: string;
  systemPrompt: string;
  rules: string[];
  permissions: Record<OfficePermCategory, OfficeLevel>;
  connectors: string[];
  engine: { mode: 'platform' | 'byok'; connectionId?: string | null };
  monthlyBudgetCents: number;
  parallelLimit: number;
  safety?: { dailySends: number; minHoursPerClient: number; stopList: string[]; allowAdChanges?: boolean; autoPurchaseOrders?: boolean; autoKbReplies?: boolean; autoBookingMessages?: boolean; autoPosting?: boolean };
  workHours: '24/7' | 'weekdays' | 'on_demand';
  timezone: string;
  status: 'active' | 'paused';
  pausedReason: string | null;
  kpis: OfficeKpiKey[];
  proactiveEveryHours: number;
  lastPlannedAt?: string | null;
  language?: 'ru' | 'en' | 'tr';
  sort: number;
  createdAt: string;
  agents: OfficeAgent[];
  live?: OfficeDeptLive;
  issues?: OfficeIssue[];
  curatorAgentId?: string | null;
  programs?: {
    followup: { enabled: boolean; days: number[]; loseAfterDays: number };
    reactivation: { enabled: boolean; afterDays: number; perWeek: number };
    adsWatch: { enabled: boolean; days: number };
    budgetReview: { enabled: boolean };
    debtReminders: { enabled: boolean; days: number[] };
    financeWeekly: { enabled: boolean };
    stockWatch: { enabled: boolean };
    prReview: { enabled: boolean };
    supportSla: { enabled: boolean; hours: number };
    bookingReminders: { enabled: boolean };
    noShows: { enabled: boolean };
    confirmations: { enabled: boolean };
    reviewRequests: { enabled: boolean };
    reconcile: { enabled: boolean };
    digest?: { enabled: boolean };
  };
  curator?: { id: string; name: string; role: string; jobTitle: string | null; status: string; week: { approved: number; revised: number; escalated: number } } | null;
}

export interface OfficePost {
  id: string;
  channel: string;
  text: string;
  publishAt: string;
  status: 'scheduled' | 'published' | 'failed' | 'cancelled' | 'expired';
  error: string | null;
  url: string | null;
  publishedAt: string | null;
}

export interface OfficeTask {
  id: string;
  departmentId: string;
  agentId: string | null;
  agentTitle: string | null;
  title: string;
  details: string;
  source: string;
  entityType: string | null;
  entityId: string | null;
  status: OfficeTaskStatus;
  progress: number;
  step: string;
  priority: number;
  pendingActionIds: string[];
  resultSummary: string | null;
  resultReport?: string | null;
  dataUsed?: Array<{ key: string; label: string; period?: string }>;
  artifacts: Array<{ actionId?: string; actionType?: string; title?: string; status?: string; targetType?: string | null; targetId?: string | null; error?: string | null; url?: string | null }>;
  issueId: string | null;
  fromDepartmentId: string | null;
  costCents: number;
  error: string | null;
  attempts: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeEvent {
  id: string;
  departmentId: string | null;
  taskId: string | null;
  agentId: string | null;
  agentTitle: string | null;
  toAgentId: string | null;
  toAgentTitle: string | null;
  kind: string;
  tool: string | null;
  text: string;
  level: 'ok' | 'warn' | 'error';
  createdAt: string;
}

export interface OfficePlan {
  plan: string;
  available: boolean;
  included: number;
  extraSlots: number;
  extraActive: number;
  slotsUntil: string | null;
  capacity: number;
  used: number;
  maxDepartments: number;
  extraPriceEur: number;
}

export interface OfficeOverview {
  plan: OfficePlan;
  departments: OfficeDepartment[];
  tasks: OfficeTask[];
  issues: OfficeIssue[];
  events: OfficeEvent[];
  brainFiles: number;
  serverTime: string;
}

export interface OfficeLive {
  departments: Array<{ id: string; status: 'active' | 'paused'; pausedReason: string | null; live: OfficeDeptLive }>;
  tasks: OfficeTask[];
  events: OfficeEvent[];
  issues: OfficeIssue[];
  brainFiles: number;
  serverTime: string;
}

export interface OfficeTemplate {
  key: string;
  color: string;
  name: string;
  mission: string;
  agents: Array<{ title: string; isLead: boolean; prompt: string }>;
  permissions: Record<OfficePermCategory, OfficeLevel>;
  rules: string[];
  connectors: string[];
  kpis: OfficeKpiKey[];
}

export interface OfficeCatalog {
  categories: Array<{ key: OfficePermCategory; levels: OfficeLevel[] }>;
  rules: string[];
  workHours: string[];
  colors: string[];
  kpis: OfficeKpiKey[];
  maxAgents: number;
  slots: Array<[number, number]>;
}

export type ConnStatus = 'ok' | 'expired' | 'error' | 'off';
export interface OfficeConnector {
  key: string;
  name: string;
  color: string;
  logo: string | null;
  letter: string;
  catalogId?: string;
  tokenGrant?: boolean;
  status: ConnStatus;
  oauth?: boolean;
  instances: Array<{
    connectionId: string;
    label: string;
    status: ConnStatus;
    detail: string | null;
    expiresAt: string | null;
    departmentIds: string[];
    settings?: { repo?: string | null; parentPageId?: string | null } | null;
  }>;
  departmentIds: string[];
}

export interface BrainFile {
  id: string;
  folder: string;
  name: string;
  type: string;
  sizeBytes: number;
  scope: string[];
  indexStatus: 'pending' | 'indexing' | 'ready' | 'failed';
  indexProgress: number;
  chunkCount: number;
  indexError: string | null;
  source: string;
  authorAgentId: string | null;
  lastReadAt: string | null;
  lastReadAgentId: string | null;
  createdAt: string;
  updatedAt: string;
  editable: boolean;
  bodyMd?: string | null;
  preview?: string | null;
}

export interface OfficePlanPage extends OfficePlan {
  rates: { RUB: number | null; TRY: number | null };
  lang: 'ru' | 'en' | 'tr';
  departments: Array<{
    id: string;
    name: string;
    color: string;
    agents: number;
    engine: { mode: string };
    status: string;
    pausedReason: string | null;
    spendMonthCents: number;
    monthlyBudgetCents: number;
    slot: 'included' | 'extra';
  }>;
}

export type DepartmentInput = Partial<
  Pick<
    OfficeDepartment,
    'name' | 'color' | 'mission' | 'systemPrompt' | 'rules' | 'permissions' | 'connectors' | 'engine' | 'monthlyBudgetCents' | 'parallelLimit' | 'safety' | 'curatorAgentId' | 'programs' | 'workHours' | 'timezone' | 'kpis' | 'proactiveEveryHours' | 'language'
  >
> & { templateKey?: string | null; agents?: Array<{ id?: string; title: string; isLead: boolean; prompt: string }> };

export interface OfficeImpact {
  days: number;
  tasks: { done: number; failed: number; waiting: number };
  actions: Record<string, number>;
  leadsHandled: number;
  firstResponse: { newLeads: number; answered: number; medianMinutes: number | null; within5: number };
  wonAfterTouch: number;
  savedMinutes: number;
  spendCents: number;
  minutesPerAction: Record<string, number>;
}

export type OfficeTaskDetail = {
      task: OfficeTask;
      issue: { id: string; kind: string; title: string; detail: string; fix: string; target: string | null; departmentId: string } | null;
      events: OfficeEvent[];
      actions: Array<{
        id: string;
        actionType: string;
        title: string;
        reason: string | null;
        status: string;
        targetType: string | null;
        targetId: string | null;
        payload: Record<string, unknown>;
        editable: string[];
        error: string | null;
        resultUrl: string | null;
        rejectionReason: string | null;
        sends?: boolean;
        approvedByCurator?: string | null;
        curatorComment?: string | null;
        curatorNote?: string | null;
        sendable?: boolean;
        sentFromDraft?: boolean;
        sendResult?: { sent: number; total: number; failed: number } | null;
      }>;
    };

const B = '/ai-office';

export const aiOfficeApi = {
  overview: () => api.get<OfficeOverview>(`${B}/overview`),
  live: (since?: string) => api.get<OfficeLive>(`${B}/live`, { params: since ? { since } : undefined }),
  plan: () => api.get<OfficePlanPage>(`${B}/plan`),
  templates: (lang?: string) => api.get<OfficeTemplate[]>(`${B}/templates`, { params: lang ? { lang } : undefined }),
  catalog: () => api.get<OfficeCatalog>(`${B}/catalog`),

  departments: () => api.get<OfficeDepartment[]>(`${B}/departments`),
  department: (id: string) => api.get<OfficeDepartment>(`${B}/departments/${id}`),
  createDepartment: (body: DepartmentInput) => api.post<OfficeDepartment>(`${B}/departments`, body),
  updateDepartment: (id: string, body: DepartmentInput) => api.patch<OfficeDepartment>(`${B}/departments/${id}`, body),
  deleteDepartment: (id: string) => api.delete<{ ok: boolean }>(`${B}/departments/${id}`),
  pause: (id: string) => api.post<OfficeDepartment>(`${B}/departments/${id}/pause`),
  resume: (id: string) => api.post<OfficeDepartment>(`${B}/departments/${id}/resume`),
  move: (id: string, slot: [number, number]) => api.post<OfficeDepartment[]>(`${B}/departments/${id}/move`, { slot }),

  tasks: (params?: { departmentId?: string; status?: string; limit?: number }) => api.get<OfficeTask[]>(`${B}/tasks`, { params: params as any }),
  createTask: (body: { departmentId: string; title: string; details?: string; priority?: number; entityType?: string; entityId?: string }) =>
    api.post<OfficeTask>(`${B}/tasks`, body),
  taskDetail: (id: string) => api.get<OfficeTaskDetail>(`${B}/tasks/${id}`),
  sendDraft: (taskId: string, actionId: string, edits: Record<string, string>) => api.post<OfficeTaskDetail>(`${B}/tasks/${taskId}/actions/${actionId}/send`, edits),
  editAction: (taskId: string, actionId: string, patch: Record<string, string>) =>
    api.patch<OfficeTaskDetail>(`${B}/tasks/${taskId}/actions/${actionId}`, patch),
  posts: (deptId: string) => api.get<OfficePost[]>(`${B}/departments/${deptId}/posts`),
  cancelPost: (id: string) => api.post<{ ok: boolean }>(`${B}/posts/${id}/cancel`),
  impact: (deptId: string, days: number) => api.get<OfficeImpact>(`${B}/departments/${deptId}/impact`, { params: { days } }),
  grantAutonomy: (deptId: string) => api.post<unknown>(`${B}/departments/${deptId}/autonomy`),
  grantData: (deptId: string, key: string) => api.post<{ status: 'ok' | 'grant' | 'connect' }>(`${B}/departments/${deptId}/data-access/${key}`),
  planNow: (deptId: string) => api.post<{ created: number }>(`${B}/departments/${deptId}/plan`),
  approve: (id: string) => api.post<{ ok: boolean; errors: string[]; task: OfficeTask }>(`${B}/tasks/${id}/approve`),
  reject: (id: string, reason?: string) => api.post<OfficeTask>(`${B}/tasks/${id}/reject`, { reason }),
  retry: (id: string) => api.post<OfficeTask>(`${B}/tasks/${id}/retry`),
  cancel: (id: string) => api.post<OfficeTask>(`${B}/tasks/${id}/cancel`),

  issues: () => api.get<OfficeIssue[]>(`${B}/issues`),
  resolveIssue: (id: string) => api.post<OfficeIssue>(`${B}/issues/${id}/resolve`),
  events: (params?: { departmentId?: string; since?: string; before?: string; limit?: number }) => api.get<OfficeEvent[]>(`${B}/events`, { params: params as any }),

  connectors: () => api.get<OfficeConnector[]>(`${B}/connectors`),
  engines: () =>
    api.get<{ platform: boolean; byok: Array<{ connectionId: string; label: string; provider: 'openai' | 'anthropic'; model: string | null; keyTail: string; status: string }> }>(`${B}/engines`),
  setScope: (body: { connector: string; connectionId: string; departmentIds: string[] }) => api.post(`${B}/connectors/scope`, body),
  grant: (body: { connector: string; label?: string; token: string; departmentIds?: string[]; settings?: Record<string, string>; requestId?: string }) =>
    api.post<{ connectionId: string }>(`${B}/connectors/grant`, body),

  brainFiles: (folder?: string) => api.get<BrainFile[]>(`${B}/brain/files`, { params: folder ? { folder } : undefined }),
  brainFile: (id: string) => api.get<BrainFile>(`${B}/brain/files/${id}`),
  brainUpload: (file: File, folder: string, opts?: { scope?: string[]; requestId?: string }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    if (opts?.scope) form.append('scope', JSON.stringify(opts.scope));
    if (opts?.requestId) form.append('requestId', opts.requestId);
    return api.postForm<BrainFile>(`${B}/brain/files`, form);
  },
  brainCreateDoc: (body: { name: string; folder: string; bodyMd: string; scope?: string[]; requestId?: string }) => api.post<BrainFile>(`${B}/brain/docs`, body),
  brainUpdate: (id: string, body: { name?: string; bodyMd?: string; scope?: string[]; folder?: string }) => api.patch<BrainFile>(`${B}/brain/files/${id}`, body),
  brainDelete: (id: string) => api.delete<{ ok: boolean }>(`${B}/brain/files/${id}`),
  brainDownloadPath: (id: string) => `${B}/brain/files/${id}/download`,

  checkoutSlots: (extraSlots: number) =>
    api.post<{ url: string | null; provider: 'stripe' | 'yookassa' | 'iyzico'; id?: string; ref?: string }>(`/billing/checkout-ai-office`, {
      extraSlots,
      successUrl: `${window.location.origin}/ai-office/plan?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/ai-office/plan`,
    }),
  confirmPayment: (p: { provider: string; sessionId?: string; ref?: string }) =>
    api.get<{ ok: boolean }>(`/billing/checkout-confirm`, {
      params: { provider: p.provider, ...(p.sessionId ? { session_id: p.sessionId } : {}), ...(p.ref ? { ref: p.ref } : {}) },
    }),
  oauthStart: (provider: 'notion' | 'github' | 'canva') => api.post<{ url: string }>(`${B}/oauth/${provider}/start`),
  connectionSettings: (id: string, body: { repo?: string; parentPageId?: string }) => api.patch<{ ok: boolean }>(`${B}/connections/${id}/settings`, body),
  connectionOptions: (id: string) => api.get<Array<{ id: string; label: string }>>(`${B}/connections/${id}/options`),
};

/** Скачать исходник файла «Мозга» (с авторизацией). */
export async function downloadBrainFile(id: string, name: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/ai-office/brain/files/${id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const url = window.URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

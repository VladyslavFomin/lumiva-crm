import {
  normalizeTenantPlan,
  type NormalizedTenantPlan,
} from '../tenants/plan-entitlements';

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

export type AiAgentAutonomyMode =
  | 'read_only'
  | 'suggest'
  | 'assisted'
  | 'auto';

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
  systemPrompt: string;
};

const READ_COMMON = [
  'read_contacts',
  'read_companies',
  'read_reports',
  'read_notes',
];

export const AI_EMPLOYEE_PERMISSION_KEYS = [
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
  'send_telegram',
  'create_report',
] as const;

/** Action types where the system can perform real execution (not just "mark done"). */
export const AI_REAL_EXECUTABLE_ACTIONS = [
  'send_email',
  'send_telegram',
  'update_lead_status',
  'assign_lead',
] as const;

export const AI_EMPLOYEE_APPROVAL_ACTIONS = [
  'send_email',
  'send_telegram',
  'send_whatsapp',
  'update_lead_status',
  'assign_lead',
  'edit_client_data',
  'create_campaign',
  'bulk_send_campaign',
  'connect_integration',
  'delete_data',
] as const;

const DEFAULT_APPROVAL_RULES = [
  'send_email',
  'send_telegram',
  'send_whatsapp',
  'update_lead_status',
  'assign_lead',
  'edit_client_data',
  'create_campaign',
  'bulk_send_campaign',
  'connect_integration',
  'delete_data',
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
      ...READ_COMMON,
      'read_leads',
      'read_deals',
      'read_sales',
      'read_tasks',
      'create_task',
      'create_note',
      'assign_lead',
      'update_lead_status',
      'draft_email',
      'create_report',
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
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
      ...READ_COMMON,
      'read_leads',
      'read_deals',
      'read_sales',
      'read_tasks',
      'read_reports',
      'read_analytics',
      'create_task',
      'create_note',
      'draft_email',
      'create_report',
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
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
      ...READ_COMMON,
      'read_leads',
      'read_marketing',
      'read_campaigns',
      'read_marketing_traffic',
      'read_marketing_costs',
      'read_marketing_roi',
      'read_marketing_integrations',
      'read_attribution',
      'read_analytics',
      'read_sales',
      'draft_email',
      'create_campaign',
      'create_report',
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    systemPrompt:
      'You are an AI Marketing Manager inside Lumiva CRM. Analyze channels, create practical campaign ideas and route risky actions through approvals.',
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
      ...READ_COMMON,
      'read_messages',
      'read_tasks',
      'create_task',
      'create_note',
      'draft_email',
      'create_report',
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
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
      'Monitors projects, overdue tasks, risks, responsibilities and project summaries for managers.',
    functions: [
      'Deadline control',
      'Overdue task detection',
      'Project summaries',
      'Responsibility checks',
      'Daily project report',
    ],
    defaultPermissions: [
      ...READ_COMMON,
      'read_projects',
      'read_tasks',
      'create_task',
      'update_task',
      'create_note',
      'create_report',
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
    systemPrompt:
      'You are an AI Project Manager inside Lumiva CRM. Monitor deadlines, task health and project risks without changing critical data unless allowed.',
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
      ...READ_COMMON,
      'read_leads',
      'read_marketing',
      'read_campaigns',
      'read_marketing_traffic',
      'read_marketing_costs',
      'read_marketing_roi',
      'read_marketing_integrations',
      'read_attribution',
      'read_analytics',
      'read_sales',
      'read_deals',
      'read_projects',
      'read_tasks',
      'create_report',
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
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
      ...READ_COMMON,
      'read_marketing',
      'read_campaigns',
      'read_marketing_traffic',
      'read_marketing_integrations',
      'read_attribution',
      'read_analytics',
      'draft_email',
      'create_report',
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
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
      ...READ_COMMON,
      'read_messages',
      'read_leads',
      'read_contacts',
      'read_companies',
      'draft_email',
      'send_email',
      'create_report',
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
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
      ...READ_COMMON,
      'read_leads',
      'read_deals',
      'read_sales',
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
      'read_messages',
      'read_files',
      'create_report',
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
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
      ...READ_COMMON,
      'read_sales',
      'read_messages',
      'read_leads',
      'read_contacts',
      'read_companies',
      'create_task',
      'draft_email',
      'create_report',
    ],
    defaultApprovalRules: DEFAULT_APPROVAL_RULES,
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

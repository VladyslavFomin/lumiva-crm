import { api } from './client';

export interface TrafficData {
  date: string;
  sessions: number;
  clicks: number;
  leads: number;
  revenue: number;
  cost: number;
  impressions: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  startDate: string;
  endDate: string | null;
}

export interface Utm {
  id: string;
  source: string;
  medium: string;
  campaign: string;
  term: string | null;
  content: string | null;
  clicks: number;
  conversions: number;
}

export interface SegmentTrafficPreset {
  dataSource: string;
  source: string | null;
  medium: string | null;
  campaign: string;
}

/** Mirrors backend SegmentDto exactly (marketing.service.ts toSegmentDto) — segments only
 * support entityType 'lead' today. `source`/`country`/`manager` are singular despite being named
 * as arrays in the create DTO: the backend only ever reads index 0 of each ("legacy" filters). */
export interface Segment {
  id: string;
  entityType: 'lead';
  name: string;
  description: string | null;
  leadStatuses: string[] | null;
  source: string | null;
  country: string | null;
  manager: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  trafficPresets: SegmentTrafficPreset[] | null;
  lastMatchedCount: number | null;
  lastRunAt: string | null;
  createdAt: string;
}

export interface TrafficChannelStat {
  dataSource: string;
  sessions: number;
  clicks: number;
  leads: number;
  revenue: number;
  cost: number;
  impressions: number;
  currency: string;
}

/** One (dataSource, source, medium, campaign) aggregate row — the real per-campaign granularity behind a channel. */
export interface TrafficItem {
  dataSource: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  clicks: number;
  leads: number;
  revenue: number;
  impressions: number;
  cost: number;
  currency: string;
}

export interface TrafficChannelsStats {
  totalSessions: number;
  totalLeads: number;
  totalRevenue: number;
  totalClicks: number;
  totalImpressions: number;
  totalCost: number;
  currency: string;
  providerBreakdown: TrafficChannelStat[];
  dataSourceLabels?: Record<string, string>;
  items?: TrafficItem[];
}

export async function fetchTrafficChannels(params?: { from?: string; to?: string; dataSource?: string }): Promise<TrafficChannelsStats> {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.dataSource) search.set('dataSource', params.dataSource);
  const qs = search.toString();
  const res = await api.get<TrafficChannelsStats>(`/marketing/traffic${qs ? `?${qs}` : ''}`);
  return res.data;
}

export interface TrafficCountryRow {
  country: string | null;
  sessions: number;
  clicks: number;
  impressions: number;
}

export async function fetchTrafficByCountry(params?: { from?: string; to?: string; dataSource?: string }): Promise<TrafficCountryRow[]> {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.dataSource) search.set('dataSource', params.dataSource);
  const qs = search.toString();
  const res = await api.get<{ rows: TrafficCountryRow[] }>(`/marketing/traffic/by-country${qs ? `?${qs}` : ''}`);
  return res.data.rows || [];
}

export async function fetchTraffic(params?: { from?: string; to?: string; dataSource?: string }): Promise<TrafficData[]> {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.dataSource) search.set('dataSource', params.dataSource);
  const res = await api.get<{ series: TrafficData[] }>(`/marketing/traffic/daily${search.toString() ? `?${search}` : ''}`);
  const data = res.data;
  return Array.isArray(data) ? data : (data as any)?.series || [];
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await api.get<Campaign[] | { items?: Campaign[] }>('/marketing/campaigns');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data;
}

export async function fetchUtms(): Promise<Utm[]> {
  const res = await api.get<Utm[] | { items?: Utm[] }>('/marketing/utms');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data;
}

export async function fetchSegments(): Promise<Segment[]> {
  const res = await api.get<Segment[] | { items?: Segment[] }>('/marketing/segments');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data;
}

export async function fetchSegment(id: string): Promise<Segment> {
  const res = await api.get<Segment>(`/marketing/segments/${id}`);
  return res.data;
}

export interface CreateSegmentPayload {
  name: string;
  description?: string;
  filters?: {
    statuses?: string[];
    sources?: string[];
    countries?: string[];
    managers?: string[];
    createdFrom?: string;
    createdTo?: string;
  };
}
/** Only entityType 'lead' is supported by the backend today — no other segment target exists. */
export async function createSegment(payload: CreateSegmentPayload): Promise<Segment> {
  const res = await api.post<Segment>('/marketing/segments', { entityType: 'lead', ...payload });
  return res.data;
}

export interface SegmentMatchedLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
}
export async function runSegment(id: string): Promise<SegmentMatchedLead[]> {
  const res = await api.post<SegmentMatchedLead[]>(`/marketing/segments/${id}/run`);
  return res.data;
}

/** n8n/webhook integration hooks registered against marketing events — mirrors
 * marketing-automation.entity.ts. Distinct from the tenant-wide "Automations" module
 * elsewhere in the app; this one is marketing-specific. */
export interface MarketingAutomation {
  id: string;
  name: string;
  type: string;
  webhookUrl: string | null;
  isActive: boolean;
  lastStatus: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export async function fetchAutomations(): Promise<MarketingAutomation[]> {
  const res = await api.get<MarketingAutomation[]>('/marketing/automations');
  return res.data;
}
export interface AutomationPayload {
  name: string;
  type?: string;
  webhookUrl?: string;
  isActive?: boolean;
}
export async function createAutomation(payload: AutomationPayload): Promise<MarketingAutomation> {
  const res = await api.post<MarketingAutomation>('/marketing/automations', payload);
  return res.data;
}
export async function updateAutomation(id: string, payload: Partial<AutomationPayload>): Promise<MarketingAutomation> {
  const res = await api.patch<MarketingAutomation>(`/marketing/automations/${id}`, payload);
  return res.data;
}
export async function deleteAutomation(id: string): Promise<void> {
  await api.delete(`/marketing/automations/${id}`);
}




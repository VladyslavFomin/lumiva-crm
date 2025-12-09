// src/api/marketing.ts
import { api } from './client';

//
// ===== ТРАФИК / КАМПАНИИ =====
//

export interface MarketingTrafficRow {
  channel: string;
  utmCampaign: string;
  utmSource: string | null;
  utmMedium: string | null;

  impressions: number;
  clicks: number;
  cost: number;
  currency: string;

  leads: number;
  projects: number;
  revenue: number;

  cpc: number;
  cpl: number;
  roas: number;
}

export interface MarketingTrafficStats {
  from?: string | null;
  to?: string | null;
  currency: string;
  totals: {
    impressions: number;
    clicks: number;
    cost: number;
    leads: number;
    projects: number;
    revenue: number;
    cpc: number;
    cpl: number;
    roas: number;
  };
  items: MarketingTrafficRow[];
}

export async function fetchMarketingTraffic(params?: {
  from?: string;
  to?: string;
}): Promise<MarketingTrafficStats> {
  const search = new URLSearchParams();
  if (params?.from) search.append('from', params.from);
  if (params?.to) search.append('to', params.to);

  const qs = search.toString();
  const url = `/marketing/traffic${qs ? `?${qs}` : ''}`;

  return api.get<MarketingTrafficStats>(url);
}

// опционально: bulk-импорт затрат (пока может не использоваться)
export async function importMarketingCostsBulk(body: {
  items: Array<{
    date: string;
    sourceSystem: string;
    channel?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    impressions?: number;
    clicks?: number;
    cost: number;
    currency?: string;
  }>;
}): Promise<void> {
  await api.post('/marketing/costs/bulk', body);
}

//
// ===== СЕГМЕНТЫ =====
//

export type SegmentEntityType = 'lead';

export interface LeadSegmentFilters {
  statuses?: string[];
  sources?: string[];
  countries?: string[];
  managers?: string[];
  createdFrom?: string;
  createdTo?: string;
}

export interface MarketingSegment {
  id: string;
  tenantId: string;
  entityType: SegmentEntityType;
  name: string;
  description: string | null;
  filters: LeadSegmentFilters;
  createdAt: string;
}

export interface CreateSegmentPayload {
  entityType: SegmentEntityType;
  name: string;
  description?: string;
  filters: LeadSegmentFilters;
}

export async function createSegment(
  payload: CreateSegmentPayload,
): Promise<MarketingSegment> {
  return api.post<MarketingSegment>('/marketing/segments', payload);
}

export async function fetchSegments(): Promise<MarketingSegment[]> {
  return api.get<MarketingSegment[]>('/marketing/segments');
}

export async function runSegment(id: string) {
  // backend: POST /marketing/segments/:id/run
  return api.post(`/marketing/segments/${id}/run`, {});
}

//
// ===== UTM-ШАБЛОНЫ (UtmsPage) =====
//

// предустановленные типы каналов (чтобы совпало с UtmsPage.tsx)
export type ChannelPreset =
  | 'google_search'
  | 'meta_ads'
  | 'yandex_direct'
  | 'email'
  | 'other';

export interface UtmTemplatePayload {
  name: string;

  baseUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;

  // UtmsPage использует tpl.channelType
  channelType?: ChannelPreset;
}

export interface UtmTemplate extends UtmTemplatePayload {
  id: string;
  tenantId: string;
  createdAt: string;
}

export type MarketingUtmTemplate = UtmTemplate;

export async function fetchUtmTemplates(): Promise<MarketingUtmTemplate[]> {
  // соответствует @Get('utms/templates') в контроллере
  return api.get<MarketingUtmTemplate[]>('/marketing/utms/templates');
}

export async function createUtmTemplate(
  payload: UtmTemplatePayload,
): Promise<MarketingUtmTemplate> {
  return api.post<MarketingUtmTemplate>(
    '/marketing/utms/templates',
    payload,
  );
}

export async function deleteUtmTemplate(id: string): Promise<void> {
  await api.del(`/marketing/utms/templates/${id}`);
}

//
// ===== ИНТЕГРАЦИИ МАРКЕТИНГА (MarketingIntegrationsPage) =====
//

export interface MarketingIntegration {
  id: string;
  tenantId: string;

  provider: string;          // 'ga4' | 'google_ads' | 'meta_ads' | ...
  kind?: string;             // 'ads' | 'analytics' | 'other'
  name: string;              // человекочитаемое имя
  primaryId?: string | null; // measurement id, ad account и т.п.
  isActive: boolean;

  settings?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export interface MarketingIntegrationPayload {
  provider: string;
  kind?: string;
  name: string;
  primaryId?: string | null;
  isActive?: boolean;
  settings?: Record<string, any>;
}

export type MarketingIntegrationUpdatePayload =
  Partial<MarketingIntegrationPayload>;

export async function fetchMarketingIntegrations(): Promise<
  MarketingIntegration[]
> {
  // @Get('integrations')
  return api.get<MarketingIntegration[]>('/marketing/integrations');
}

export async function createMarketingIntegration(
  payload: MarketingIntegrationPayload,
): Promise<MarketingIntegration> {
  // @Post('integrations')
  return api.post<MarketingIntegration>('/marketing/integrations', payload);
}

export async function updateMarketingIntegration(
  id: string,
  payload: MarketingIntegrationUpdatePayload,
): Promise<MarketingIntegration> {
  // @Patch('integrations/:id')
  return api.patch<MarketingIntegration>(
    `/marketing/integrations/${id}`,
    payload,
  );
}

export async function deleteMarketingIntegration(id: string): Promise<void> {
  // @Delete('integrations/:id')
  await api.del(`/marketing/integrations/${id}`);
}

//
// ===== АВТОМАТИЗАЦИИ (n8n) – AutomationsPage.tsx =====
//

export interface MarketingAutomation {
  id: string;
  tenantId: string;

  name: string;
  description?: string;

  // AutomationsPage ждёт эти поля
  type?: string;        // напр. 'n8n_webhook'
  webhookUrl?: string;  // URL вебхука в n8n
  isActive: boolean;

  lastStatus?: string;        // последний статус (optional)
  createdAt: string;
  lastTriggeredAt?: string;   // когда последний раз запускался
}

export interface MarketingAutomationPayload {
  name: string;
  description?: string;
  type?: string;
  webhookUrl?: string; // опционально, чтобы можно было передавать webhookUrl || undefined
  isActive?: boolean;
}

export async function fetchMarketingAutomations(): Promise<
  MarketingAutomation[]
> {
  // соответствует @Get('automations')
  return api.get<MarketingAutomation[]>('/marketing/automations');
}

export async function createMarketingAutomation(
  payload: MarketingAutomationPayload,
): Promise<MarketingAutomation> {
  // @Post('automations')
  return api.post<MarketingAutomation>('/marketing/automations', payload);
}

export async function updateMarketingAutomation(
  id: string,
  payload: Partial<MarketingAutomationPayload>,
): Promise<MarketingAutomation> {
  // @Patch('automations/:id')
  return api.patch<MarketingAutomation>(
    `/marketing/automations/${id}`,
    payload,
  );
}

export async function deleteMarketingAutomation(id: string): Promise<void> {
  // @Delete('automations/:id')
  await api.del(`/marketing/automations/${id}`);
}

//
// ===== API-ТОКЕН ДЛЯ ИМПОРТА МАРКЕТИНГА =====
//

export async function fetchMarketingApiToken(): Promise<string> {
  const data = await api.get<{ token: string }>('/api-tokens/marketing');
  return data.token;
}

export async function regenerateMarketingApiToken(): Promise<string> {
  const data = await api.post<{ token: string }>(
    '/api-tokens/marketing/regenerate',
    {},
  );
  return data.token;
}
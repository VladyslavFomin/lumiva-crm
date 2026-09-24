import { api } from './client';
import { EntityComment } from './comments';

export interface SaleDto {
  id: string;
  tenantId: string | null;
  leadId: string | null;
  projectId: string | null;
  contactId: string | null;
  channelId: string | null;
  amount: number;
  currency: string;
  status: string;
  saleDate: string | null;
  guestName: string | null;
  agentName: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  externalId: string | null;
  market: string | null;
  managerName: string | null;
  notes: string | null;
  hotel: string | null;
  externalOrderNo: string | null;
  customFields: Record<string, any> | null;
  comments: EntityComment[] | null;
  createdAt: string;
}

export interface Sale {
  id: string;
  leadId: string | null;
  projectId: string | null;
  contactId: string | null;
  channelId: string | null;
  amount: number;
  currency: string;
  status: string;
  saleDate: string | null;
  guestName: string | null;
  agentName: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  externalId: string | null;
  market: string | null;
  managerName: string | null;
  notes: string | null;
  hotel: string | null;
  externalOrderNo: string | null;
  customFields: Record<string, any> | null;
  comments: EntityComment[];
  createdAt: string;
}

export interface SalesChannel {
  id: string;
  name: string;
  type: string;
}

function mapSale(dto: SaleDto): Sale {
  return {
    id: dto.id,
    leadId: dto.leadId,
    projectId: dto.projectId,
    contactId: dto.contactId,
    channelId: dto.channelId,
    amount: dto.amount,
    currency: dto.currency || 'EUR',
    status: dto.status,
    saleDate: dto.saleDate,
    guestName: dto.guestName,
    agentName: dto.agentName ?? null,
    checkInAt: dto.checkInAt ?? null,
    checkOutAt: dto.checkOutAt ?? null,
    externalId: dto.externalId ?? null,
    market: dto.market,
    managerName: dto.managerName,
    notes: dto.notes,
    hotel: dto.hotel,
    externalOrderNo: dto.externalOrderNo,
    customFields: dto.customFields ?? null,
    comments: dto.comments ?? [],
    createdAt: dto.createdAt,
  };
}

export async function fetchSalesChannels(): Promise<SalesChannel[]> {
  const res = await api.get<SalesChannel[]>('/sales-channels');
  return res.data;
}

const SALES_PAGE_SIZE = 200;
const SALES_MAX_PAGES = 25; // safety net: 5000 sales — beyond that a single mobile list isn't the right tool anyway

/** `/sales` is paginated server-side (default pageSize 25). Calling it bare silently truncated the list, its count
 *  chips and its turnover total to the newest 25 orders — so walk every page. */
export async function fetchSales() {
  const all: SaleDto[] = [];
  for (let page = 1; page <= SALES_MAX_PAGES; page++) {
    const res = await api.get<SaleDto[] | { items?: SaleDto[]; total?: number }>('/sales', { params: { page, pageSize: SALES_PAGE_SIZE } });
    if (Array.isArray(res.data)) { all.push(...res.data); break; } // legacy un-paginated shape
    const items = res.data?.items || [];
    all.push(...items);
    const total = res.data?.total ?? all.length;
    if (items.length < SALES_PAGE_SIZE || all.length >= total) break;
  }
  return all.map(mapSale);
}

export async function fetchSale(id: string): Promise<Sale> {
  const res = await api.get<SaleDto>(`/sales/${id}`);
  return mapSale(res.data);
}

export interface UpdateSaleDto {
  id: string;
  status?: string;
  managerName?: string | null;
  notes?: string | null;
  leadId?: string | null;
  customFields?: Record<string, any>;
  comments?: EntityComment[];
}

export async function updateSale(payload: UpdateSaleDto): Promise<Sale> {
  const { id, ...body } = payload;
  const res = await api.patch<SaleDto>(`/sales/${id}`, body);
  return mapSale(res.data);
}

export async function fetchSalesByLead(leadId: string): Promise<Sale[]> {
  const res = await api.get<SaleDto[] | { items?: SaleDto[] }>('/sales', { params: { leadId } });
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data.map(mapSale);
}

export interface SalesAnalytics {
  totalCount: number;
  totalAmount: number;
  avgCheck: number;
  displayCurrency: string;
  byStatus: { status: string; count: number; amount: number }[];
  byChannel: { channelId: string | null; label: string; count: number; amount: number }[];
  byMarket: { label: string; count: number; amount: number }[];
  byManager: { label: string; count: number; amount: number }[];
  byCurrency: { label: string; count: number; amount: number }[];
  timeline: { amount: Array<{ month: string } & Record<string, number>> };
}

export async function fetchSalesAnalytics(params?: { from?: string; to?: string; currencyMode?: 'native' | 'converted'; displayCurrency?: string }): Promise<SalesAnalytics> {
  const res = await api.get<SalesAnalytics>('/sales/analytics', { params });
  return res.data;
}

export async function fetchSalesByContact(contactId: string): Promise<Sale[]> {
  const res = await api.get<SaleDto[] | { items?: SaleDto[] }>('/sales', { params: { contactId, pageSize: 200 } });
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data.map(mapSale);
}

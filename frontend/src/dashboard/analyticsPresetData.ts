/**
 * Загрузка реальных данных для пресетов аналитики (главная, модалка превью).
 */
import { fetchProjects } from '../api/projects';
import { fetchLeads, type Lead } from '../api/leads';
import { fetchSales } from '../api/sales';
import { fetchSalesChannels } from '../api/salesChannels';
import type { Project } from '../pages/projects/projectTypes';
import type { DashboardPresetSource } from './presetCatalog';

function isLeadActive(l: Lead): boolean {
  const m = (l as any).meta;
  if (m?.deleted) return false;
  if (m?.archived) return false;
  return true;
}

function parseProjectsRes(res: unknown): Project[] {
  if (Array.isArray((res as any)?.items)) return (res as any).items;
  if (Array.isArray(res)) return res as Project[];
  return [];
}

async function loadAllSalesMapped(
  channelNameById: Map<string, string>,
): Promise<Project[]> {
  const pageSize = 200;
  let page = 1;
  const all: Project[] = [];
  let total = 0;
  while (true) {
    const res = await fetchSales({ page, pageSize });
    const chunk = res.items.map((sale) => {
      const channelName =
        sale.channel?.name || (sale.channelId ? channelNameById.get(sale.channelId) : '') || '';
      const product = sale.hotel || '';
      const market = sale.market || '';
      const manager = sale.managerName || '';
      const guestName = sale.guestName || '';
      const rowName =
        sale.externalOrderNo || guestName || product || `Sale ${sale.id.slice(0, 6)}`;
      return {
        id: sale.id,
        name: rowName,
        description: sale.notes || '',
        amount: typeof sale.amount === 'number' ? sale.amount : 0,
        currency: sale.currency || 'EUR',
        status: (sale.status || 'new') as any,
        category: market || null,
        tags: channelName ? [channelName] : [],
        owner: manager || null,
        leadId: sale.leadId || null,
        leadName: guestName || null,
        leadEmail: null,
        ownerUserIds: [],
        customFields: { ...(sale.customFields || {}) },
        tasks: [],
        comments: [],
        createdAt: sale.saleDate || sale.createdAt,
        updatedAt: sale.updatedAt,
      } as Project;
    });
    all.push(...chunk);
    total = res.total || all.length;
    if (!res.items.length || all.length >= total) break;
    page += 1;
  }
  return all;
}

function mapLeadsToProjects(leads: Lead[]): Project[] {
  const detectAmount = (lead: Lead) => {
    const fields = (lead.customFields || {}) as Record<string, any>;
    const amountLikeKey = Object.keys(fields).find((key) => {
      const lower = key.toLowerCase();
      return (
        lower.includes('amount') ||
        lower.includes('price') ||
        lower.includes('sum') ||
        lower.includes('value') ||
        lower.includes('total')
      );
    });
    const raw = amountLikeKey ? fields[amountLikeKey] : null;
    if (typeof raw === 'number') return raw;
    if (raw === undefined || raw === null || raw === '') return 0;
    const normalized = String(raw)
      .replace(/\s+/g, '')
      .replace(/,/g, '.')
      .replace(/[^0-9.\-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const detectCurrency = (lead: Lead) => {
    const fields = (lead.customFields || {}) as Record<string, any>;
    const key = Object.keys(fields).find((fieldKey) =>
      fieldKey.toLowerCase().includes('currency'),
    );
    if (key) return String(fields[key] || 'EUR');
    return 'EUR';
  };

  return leads.map(
    (lead) =>
      ({
        id: lead.id,
        name: lead.name || lead.phone || lead.email || `Lead ${lead.id.slice(0, 6)}`,
        description: '',
        amount: detectAmount(lead),
        currency: detectCurrency(lead),
        status: (lead.status || 'new') as any,
        category: lead.country || null,
        tags: lead.channel ? [lead.channel] : [],
        owner: lead.assignedTo || null,
        leadId: lead.id,
        leadName: lead.name || null,
        leadEmail: lead.email || null,
        ownerUserIds: lead.assignedUserIds || [],
        customFields: { ...(lead.customFields || {}) },
        tasks: [],
        comments: [],
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      }) as Project,
  );
}

/** Один запрос на вкладку модалки — реальные данные API, без моков. */
export async function loadAnalyticsItemsForSource(
  source: DashboardPresetSource,
): Promise<Project[]> {
  try {
    if (source === 'projects') {
      const res = await fetchProjects();
      return parseProjectsRes(res);
    }
    if (source === 'leads') {
      const raw = await fetchLeads();
      const leads = (raw || []).filter(isLeadActive);
      return mapLeadsToProjects(leads);
    }
    if (source === 'sales') {
      const channels = await fetchSalesChannels().catch(() => [] as any[]);
      const map = new Map<string, string>();
      (channels || []).forEach((c: any) => map.set(c.id, c.name));
      return await loadAllSalesMapped(map);
    }
  } catch {
    /* ignore */
  }
  return [];
}

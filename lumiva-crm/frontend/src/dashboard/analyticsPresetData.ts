/**
 * Загрузка реальных данных для пресетов аналитики (главная, модалка превью).
 */
import type { TFunction } from 'i18next';
import { fetchProjects } from '../api/projects';
import { fetchLeads, isLeadOmittedFromAnalytics, type Lead } from '../api/leads';
import { fetchSales } from '../api/sales';
import { fetchSalesChannels } from '../api/salesChannels';
import type { Project } from '../pages/projects/projectTypes';
import type { DashboardPresetSource } from './presetCatalog';
import {
  convertMarketingAmount,
  loadMarketingDisplayCurrency,
  normalizeMarketingDisplayCurrency,
} from '../pages/marketing/marketingDisplayCurrencyStorage';
import { translateSalesOrderStatus } from './salesOrderStatusLabel';

function parseProjectsRes(res: unknown): Project[] {
  if (Array.isArray((res as any)?.items)) return (res as any).items;
  if (Array.isArray(res)) return res as Project[];
  return [];
}

function splitMulti(raw: unknown) {
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
  return String(raw ?? '')
    .split(/[,;/]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueFilled(values: unknown[]) {
  return Array.from(new Set(values.flatMap(splitMulti).filter(Boolean)));
}

function buildProjectsByLeadId(projects: Project[]) {
  const map = new Map<string, Project[]>();
  projects
    .filter((project) => project.leadId && !project.isArchived && !project.isDeleted)
    .forEach((project) => {
      const leadId = project.leadId as string;
      map.set(leadId, [...(map.get(leadId) || []), project]);
    });
  return map;
}

async function loadAllSalesMapped(
  channelNameById: Map<string, string>,
  t: TFunction,
): Promise<Project[]> {
  const currencyPrefs = loadMarketingDisplayCurrency();
  const displayCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);
  const rates = { ...currencyPrefs.rates, [displayCurrency]: 1 };
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
	      const statusLabel = translateSalesOrderStatus(sale.status, t);
	      const orderNo = sale.externalOrderNo || sale.externalId || '';
	      const sourceAmount = typeof sale.amount === 'number' ? sale.amount : 0;
	      const sourceCurrency = sale.currency || 'EUR';
	      const converted = convertMarketingAmount(
	        sourceAmount,
	        sourceCurrency,
	        'converted',
	        displayCurrency,
	        rates,
	      );
	      const rowName =
	        orderNo || guestName || product || `Sale ${sale.id.slice(0, 6)}`;
	      return {
        id: sale.id,
        name: rowName,
        description: sale.notes || '',
	        amount: converted.value,
	        currency: converted.currency,
        status: statusLabel as any,
        category: market || null,
        tags: Array.from(new Set([channelName, product, market, statusLabel].filter(Boolean).map(String))),
        owner: manager || null,
        leadId: sale.leadId || null,
        leadName: guestName || null,
        leadEmail: null,
        ownerUserIds: [],
        customFields: {
          ...(sale.customFields || {}),
          status: statusLabel,
          statusCode: sale.status || '',
          channel: channelName || t('crm.dashboard.fallbacks.noChannel'),
          product,
          hotel: product,
          market,
          manager,
          customer: guestName,
          guestName,
          orderNo,
          externalOrderNo: orderNo,
	          amount: converted.value,
	          convertedAmount: converted.value,
	          sourceAmount,
	          nativeAmount: sourceAmount,
	          currency: sourceCurrency,
	          sourceCurrency,
	          nativeCurrency: sourceCurrency,
	          reportCurrency: converted.currency,
	          displayCurrency: converted.currency,
          saleDate: sale.saleDate || sale.createdAt,
          createdDate: sale.createdAt,
          updatedDate: sale.updatedAt,
        },
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

function mapLeadsToProjects(
  leads: Lead[],
  projectsByLeadId: Map<string, Project[]>,
  t: TFunction,
): Project[] {
  const currencyPrefs = loadMarketingDisplayCurrency();
  const displayCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);
  const rates = { ...currencyPrefs.rates, [displayCurrency]: 1 };
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
    (lead) => {
      const source =
        lead.source ||
        lead.channel ||
        lead.utmSource ||
        t('crm.dashboard.fallbacks.notSpecified');
	      const manager =
	        lead.assignedTo ||
	        lead.assignedToList?.join(', ') ||
	        t('crm.projects.analytics.unknownOwner');
	      const linkedProjects = (projectsByLeadId.get(lead.id) || []).filter((project) => !project.isArchived && !project.isDeleted);
	      const projectAmount = linkedProjects.reduce((sum, project) => {
	        const converted = convertMarketingAmount(
	          Number(project.amount) || 0,
	          project.currency || 'EUR',
	          'converted',
	          displayCurrency,
	          rates,
	        );
	        return sum + converted.value;
	      }, 0);
      const projectStatuses = uniqueFilled(linkedProjects.map((project) => project.status));
      const projectCategories = uniqueFilled(linkedProjects.map((project) => project.category));
      const projectOwners = uniqueFilled(linkedProjects.map((project) => project.owner));
      const projectTags = uniqueFilled(linkedProjects.flatMap((project) => project.tags || []));
	      const leadCurrency = detectCurrency(lead);
	      const leadAmount = convertMarketingAmount(
	        detectAmount(lead),
	        leadCurrency,
	        'converted',
	        displayCurrency,
	        rates,
	      ).value;
      return ({
        id: lead.id,
        name: lead.name || lead.phone || lead.email || `Lead ${lead.id.slice(0, 6)}`,
        description: '',
        amount: projectAmount || leadAmount,
	        currency: displayCurrency,
        status: (lead.status || 'new') as any,
        category: source,
        tags: Array.from(new Set([
          lead.channel,
          lead.utmSource,
          lead.utmMedium,
          lead.utmCampaign,
          lead.country,
        ].filter(Boolean).map(String))),
        owner: manager,
        leadId: lead.id,
        leadName: lead.name || null,
        leadEmail: lead.email || null,
        ownerUserIds: lead.assignedUserIds || [],
        customFields: {
          ...(lead.customFields || {}),
          status: lead.status,
          source,
          channel: lead.channel || source,
          country: lead.country || '',
          manager,
	          assignedTo: manager,
	          leadAmount,
	          leadCurrency,
	          projectCount: linkedProjects.length,
          projectAmount,
          projectStatus: projectStatuses,
          projectCategory: projectCategories,
          projectOwner: projectOwners,
          projectTags,
          projectName: uniqueFilled(linkedProjects.map((project) => project.name)),
          utmSource: lead.utmSource || '',
          utmMedium: lead.utmMedium || '',
          utmCampaign: lead.utmCampaign || '',
          utmContent: lead.utmContent || '',
          utmTerm: lead.utmTerm || '',
          phone: lead.phone || '',
          email: lead.email || '',
          createdDate: lead.createdAt,
          updatedDate: lead.updatedAt,
        },
        tasks: [],
        comments: [],
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      }) as Project;
    },
  );
}

/** Один запрос на вкладку модалки — реальные данные API, без моков. */
export async function loadAnalyticsItemsForSource(
  source: DashboardPresetSource,
  t: TFunction,
): Promise<Project[]> {
  try {
    if (source === 'projects') {
      const res = await fetchProjects();
      return parseProjectsRes(res);
    }
    if (source === 'leads') {
      const [raw, projectsRes] = await Promise.all([
        fetchLeads(),
        fetchProjects().catch(() => ({ total: 0, items: [] as Project[] })),
      ]);
      const leads = (raw || []).filter((l) => !isLeadOmittedFromAnalytics(l));
      return mapLeadsToProjects(leads, buildProjectsByLeadId(parseProjectsRes(projectsRes)), t);
    }
    if (source === 'sales') {
      const channels = await fetchSalesChannels().catch(() => [] as any[]);
      const map = new Map<string, string>();
      (channels || []).forEach((c: any) => map.set(c.id, c.name));
      return await loadAllSalesMapped(map, t);
    }
  } catch {
    /* ignore */
  }
  return [];
}

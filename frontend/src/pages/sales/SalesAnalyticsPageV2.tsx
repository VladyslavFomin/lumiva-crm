import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchSales, type Sale } from '../../api/sales';
import { fetchSalesChannels, type SalesChannel } from '../../api/salesChannels';
import { fetchCustomFields, type CustomField } from '../../api/custom-fields';
import { ProjectsAnalyticsPage } from '../projects/ProjectsAnalyticsPage';
import type { Project } from '../projects/projectTypes';

type AnalyticsFieldMeta = {
  key: string;
  label: string;
  type?: string;
};

const dedupe = <T,>(arr: T[]) => Array.from(new Set(arr));

const guessFieldType = (values: any[]): string => {
  if (values.some((value) => Array.isArray(value))) return 'multiselect';
  const meaningful = values.filter(
    (value) => value !== undefined && value !== null && String(value).trim() !== '',
  );
  if (!meaningful.length) return 'text';
  const numericCount = meaningful.filter((value) => {
    const normalized = String(value)
      .replace(/\s+/g, '')
      .replace(/,/g, '.')
      .replace(/[^0-9.\-]/g, '');
    if (!normalized || normalized === '-' || normalized === '.') return false;
    return Number.isFinite(Number(normalized));
  }).length;
  if (numericCount >= Math.max(1, Math.floor(meaningful.length * 0.6))) return 'number';
  return 'text';
};

const normalizeCustomFieldType = (type?: string): string => {
  if (!type) return 'text';
  if (type === 'number') return 'number';
  if (type === 'select') return 'select';
  if (type === 'multiselect') return 'multiselect';
  if (type === 'date' || type === 'datetime') return 'date';
  return 'text';
};

const fetchAllSales = async (): Promise<Sale[]> => {
  const pageSize = 200;
  let page = 1;
  let total = 0;
  const all: Sale[] = [];

  while (true) {
    const res = await fetchSales({ page, pageSize });
    all.push(...res.items);
    total = res.total || all.length;
    if (!res.items.length || all.length >= total) break;
    page += 1;
  }

  return all;
};

export const SalesAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const [sales, setSales] = useState<Sale[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchAllSales(),
      fetchSalesChannels().catch(() => [] as SalesChannel[]),
      fetchCustomFields('sale').catch(() => [] as CustomField[]),
    ])
      .then(([items, loadedChannels, loadedCustomFields]) => {
        if (!alive) return;
        setSales(items);
        setChannels(loadedChannels);
        setCustomFields(loadedCustomFields.filter((field) => field.entityType === 'sale'));
      })
      .catch(() => {
        if (!alive) return;
        setSales([]);
        setChannels([]);
        setCustomFields([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  const channelNameById = useMemo(() => {
    const map = new Map<string, string>();
    channels.forEach((channel) => map.set(channel.id, channel.name));
    return map;
  }, [channels]);

  const analyticsFields = useMemo<AnalyticsFieldMeta[]>(() => {
    const base: AnalyticsFieldMeta[] = [
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'channel', label: 'Channel', type: 'text' },
      { key: 'product', label: 'Product', type: 'text' },
      { key: 'market', label: 'Market', type: 'text' },
      { key: 'manager', label: 'Manager', type: 'text' },
      { key: 'guestName', label: 'Guest', type: 'text' },
      { key: 'agentName', label: 'Agent', type: 'text' },
      { key: 'externalOrderNo', label: 'Order ID', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
    ];

    const customByKey = new Map(customFields.map((field) => [field.key, field]));
    const customKeysFromData = dedupe(
      sales.flatMap((sale) => Object.keys((sale.customFields || {}) as Record<string, any>)),
    );

    const custom: AnalyticsFieldMeta[] = customKeysFromData.map((key) => {
      const fromSchema = customByKey.get(key);
      if (fromSchema) {
        return {
          key,
          label: fromSchema.label || key,
          type: normalizeCustomFieldType(fromSchema.type),
        };
      }
      const values = sales.map((sale) => (sale.customFields as Record<string, any> | null)?.[key]);
      return {
        key,
        label: key,
        type: guessFieldType(values),
      };
    });

    return [...base, ...custom];
  }, [customFields, sales]);

  const mappedItems = useMemo<Project[]>(() => {
    return sales.map((sale) => {
      const channelName =
        sale.channel?.name || (sale.channelId ? channelNameById.get(sale.channelId) : '') || '';
      const product = sale.hotel || '';
      const market = sale.market || '';
      const manager = sale.managerName || '';
      const guestName = sale.guestName || '';
      const agentName = sale.agentName || '';
      const externalOrderNo = sale.externalOrderNo || sale.externalId || '';
      const rowName = externalOrderNo || guestName || product || `Sale ${sale.id.slice(0, 6)}`;

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
        customFields: {
          ...(sale.customFields || {}),
          status: sale.status,
          amount: sale.amount,
          currency: sale.currency,
          channel: channelName,
          product,
          hotel: product,
          market,
          manager,
          guestName,
          agentName,
          externalOrderNo,
          checkInAt: sale.checkInAt,
          checkOutAt: sale.checkOutAt,
          saleDate: sale.saleDate,
        },
        tasks: [],
        comments: [],
        createdAt: sale.saleDate || sale.createdAt,
        updatedAt: sale.updatedAt,
      };
    });
  }, [channelNameById, sales]);

  const header = useMemo(
    () => ({
      kicker: t('crm.sales.analytics.kicker'),
      title: t('crm.sales.analytics.title'),
      subtitle: t('crm.sales.analytics.subtitle'),
    }),
    [t],
  );

  return (
    <ProjectsAnalyticsPage
      externalItems={mappedItems}
      analyticsFields={analyticsFields}
      storageNamespace="sales_analytics"
      dashboardPresetSource="sales"
      header={header}
    />
  );
};


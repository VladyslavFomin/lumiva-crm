import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardPresetInstance } from './dashboardLayout';
import type { Project } from '../pages/projects/projectTypes';
import {
  ProjectsAnalyticsPage,
  type ProjectsAnalyticsEmbedWidget,
  type ProjectsAnalyticsGlobalFilter,
} from '../pages/projects/ProjectsAnalyticsPage';
import { SalesAnalyticsPage, findSalesBlockById } from '../pages/sales/SalesAnalyticsPageV2';
import { LeadsAnalyticsPage, findLeadsBlockById } from '../pages/analytics/LeadsAnalyticsPageV2';
import i18n from '../i18n';
import { loadWorkspaceAnalyticsItems } from './workspaceAnalyticsItems';
import {
  clientAccountAnalyticsFields,
  clientAccountAnalyticsLabels,
  loadClientAccountAnalyticsItems,
} from './clientAccountAnalyticsItems';
import type { NativeAnalyticsPin } from '../components/analytics/EmbedBody';

type FieldMeta = { key: string; label: string; type?: string };

/** Исходный блок Продаж/Лидов: из пресета, а у старых закреплений — по id из раскладки страницы. */
function resolveNativeBlock(instance: DashboardPresetInstance): unknown | null {
  const wc = instance.widgetConfig as NativeAnalyticsPin | undefined;
  if (wc?.nativeBlock) return wc.nativeBlock;
  const id = String((instance.widgetConfig as { id?: string } | undefined)?.id || instance.slug || '');
  if (!id) return null;
  const t = i18n.t.bind(i18n);
  if (instance.source === 'sales') return findSalesBlockById(id, t);
  if (instance.source === 'leads') return findLeadsBlockById(id, t);
  return null;
}

/** Можно ли нарисовать блок «родным» кодом страницы аналитики (1 в 1). Старые блоки Продаж/Лидов,
 * закреплённые до появления nativeBlock, остаются на упрощённом рендере. */
export function canRenderNativeBlock(instance: DashboardPresetInstance): boolean {
  const wc = instance.widgetConfig as (NativeAnalyticsPin & { type?: string }) | undefined;
  if (!wc?.type) return false;
  if (instance.source === 'sales' || instance.source === 'leads') return Boolean(resolveNativeBlock(instance));
  if (instance.source === 'workspace' || instance.source === 'client-account') return Boolean(instance.sourceRef);
  return instance.source === 'projects';
}

/** Блок аналитики на главной, отрисованный тем же компонентом, что и на странице аналитики. */
export const NativeAnalyticsBlock: React.FC<{ instance: DashboardPresetInstance }> = ({ instance }) => {
  const { t } = useTranslation();
  const wc = instance.widgetConfig as (NativeAnalyticsPin & Record<string, unknown>) | undefined;
  const [items, setItems] = useState<Project[] | null>(null);
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [failed, setFailed] = useState<false | 'error' | 'missing'>(false);

  const embed = useMemo(() => {
    const { nativeFilters, nativeBlock: _b, nativePeriod: _p, ...widget } = (wc || {}) as NativeAnalyticsPin &
      Record<string, unknown>;
    return {
      widget: widget as unknown as ProjectsAnalyticsEmbedWidget,
      globalFilters: (Array.isArray(nativeFilters) ? nativeFilters : undefined) as ProjectsAnalyticsGlobalFilter[] | undefined,
      dateFrom: instance.filters?.dateFrom || undefined,
      dateTo: instance.filters?.dateTo || undefined,
    };
  }, [wc, instance.filters?.dateFrom, instance.filters?.dateTo]);

  const embedBlock = useMemo(() => {
    const block = resolveNativeBlock(instance);
    return block
        ? {
            block,
            period: wc?.nativePeriod,
            globalFilters: Array.isArray(wc?.nativeFilters) ? wc?.nativeFilters : undefined,
          }
        : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wc, instance.source, instance.slug]);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (instance.source === 'workspace' && instance.sourceRef) {
      setItems(null);
      loadWorkspaceAnalyticsItems(instance.sourceRef)
        .then(({ items: mapped, fields: loaded }) => {
          if (!alive) return;
          setFields(loaded.map((f) => ({ key: f.key, label: f.label, type: f.type })));
          setItems(mapped);
        })
        .catch((e: { status?: number }) => alive && setFailed(e?.status === 404 ? 'missing' : 'error'));
    } else if (instance.source === 'client-account' && instance.sourceRef) {
      setItems(null);
      loadClientAccountAnalyticsItems(instance.sourceRef, t)
        .then((mapped) => alive && setItems(mapped))
        .catch((e: { status?: number }) => alive && setFailed(e?.status === 404 ? 'missing' : 'error'));
    }
    return () => {
      alive = false;
    };
  }, [instance.source, instance.sourceRef, t]);

  const clientFields = useMemo(() => clientAccountAnalyticsFields(t), [t]);
  const clientLabels = useMemo(() => clientAccountAnalyticsLabels(t), [t]);

  const placeholder = (text: string) => (
    <div className="flex h-full min-h-[160px] items-center justify-center text-[11px] text-neutral-400">{text}</div>
  );

  if (failed === 'missing') return placeholder(t('crm.dashboard.presets.sourceMissing'));
  if (failed) return placeholder(t('crm.dashboard.presets.loadFailed'));

  switch (instance.source) {
    case 'sales':
      return embedBlock ? <SalesAnalyticsPage embedBlock={embedBlock} /> : null;
    case 'leads':
      return embedBlock ? <LeadsAnalyticsPage embedBlock={embedBlock} /> : null;
    case 'projects':
      return <ProjectsAnalyticsPage embed={embed} />;
    case 'workspace':
      if (!items) return placeholder(t('crm.dashboard.loading'));
      return (
        <ProjectsAnalyticsPage
          embed={embed}
          externalItems={items}
          analyticsFields={fields}
          storageNamespace={`workspace_analytics_${instance.sourceRef}`}
          workspaceObjectId={instance.sourceRef || undefined}
          dashboardPresetSource="workspace"
          dashboardPresetRef={instance.sourceRef || undefined}
        />
      );
    case 'client-account':
      if (!items) return placeholder(t('crm.dashboard.loading'));
      return (
        <ProjectsAnalyticsPage
          embed={embed}
          externalItems={items}
          analyticsFields={clientFields}
          analyticsLabels={clientLabels}
          storageNamespace={`client_account_operations_analytics_v3_${instance.sourceRef}`}
          dashboardPresetSource="client-account"
          dashboardPresetRef={instance.sourceRef || undefined}
        />
      );
    default:
      return null;
  }
};

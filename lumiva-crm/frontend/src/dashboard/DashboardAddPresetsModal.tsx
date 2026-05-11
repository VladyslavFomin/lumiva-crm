import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  PRESETS_BY_TAB,
  type DashboardPresetDefinition,
  type DashboardPresetSource,
} from './presetCatalog';
import type { DashboardPresetInstance } from './dashboardLayout';
import { DashboardPresetWidget } from './DashboardPresetWidget';
import { DASH_BTN_PRIMARY_SM } from './dashboardUi';
import {
  ANALYTICS_STORAGE_NAMESPACE,
  ANALYTICS_WIDGETS_CHANGED_EVENT,
  loadAnalyticsWidgetsFromStorage,
  type ProjectsAnalyticsWidgetConfig,
} from './analyticsStorage';
import type { Project } from '../pages/projects/projectTypes';
import { loadAnalyticsItemsForSource } from './analyticsPresetData';

type TabId = DashboardPresetSource;

type PresetRow =
  | { kind: 'catalog'; def: DashboardPresetDefinition }
  | { kind: 'saved'; config: ProjectsAnalyticsWidgetConfig };

function kindLabelForSaved(
  t: (k: string) => string,
  type: ProjectsAnalyticsWidgetConfig['type'],
): string {
  switch (type) {
    case 'metric':
      return t('crm.projects.analytics.widgets.type.metric');
    case 'donut':
      return t('crm.projects.analytics.widgets.type.donut');
    case 'bar':
      return t('crm.projects.analytics.widgets.type.bar');
    case 'table':
      return t('crm.projects.analytics.widgets.type.table');
    case 'formula':
      return t('crm.projects.analytics.widgets.type.formula');
    case 'pivot':
      return t('crm.projects.analytics.widgets.type.pivot');
    default:
      return type;
  }
}

export const DashboardAddPresetsModal: React.FC<{
  onClose: () => void;
  onPick: (preset: DashboardPresetInstance) => void;
  /** Скрытые стандартные блоки главной (kpi, calendar, …) */
  hiddenStandardIds: string[];
  onAddStandard: (id: string) => void;
  widgetTitle: (id: string) => string;
}> = ({ onClose, onPick, hiddenStandardIds, onAddStandard, widgetTitle }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>('sales');
  const [tick, setTick] = useState(0);
  /** Реальные данные API для превью (один запрос на вкладку) */
  const [previewItems, setPreviewItems] = useState<Project[] | null>(null);

  const refresh = useCallback(() => setTick((x) => x + 1), []);

  useEffect(() => {
    let alive = true;
    setPreviewItems(null);
    loadAnalyticsItemsForSource(tab, t).then((data) => {
      if (alive) setPreviewItems(data);
    });
    return () => {
      alive = false;
    };
  }, [tab, t]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      const ns = ANALYTICS_STORAGE_NAMESPACE[tab];
      if (e.key === `${ns}_widgets` || e.key === `${ns}_version`) refresh();
    };
    const onCustom = (ev: Event) => {
      const d = (ev as CustomEvent<{ namespace?: string }>).detail;
      if (d?.namespace === ANALYTICS_STORAGE_NAMESPACE[tab]) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(ANALYTICS_WIDGETS_CHANGED_EVENT, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ANALYTICS_WIDGETS_CHANGED_EVENT, onCustom);
    };
  }, [tab, refresh]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'sales', label: t('crm.dashboard.presets.tabSales') },
    { id: 'projects', label: t('crm.dashboard.presets.tabProjects') },
    { id: 'leads', label: t('crm.dashboard.presets.tabLeads') },
  ];

  const rows: PresetRow[] = useMemo(() => {
    const saved = loadAnalyticsWidgetsFromStorage(tab);
    if (saved.length > 0) {
      return saved.map((config) => ({ kind: 'saved' as const, config }));
    }
    return PRESETS_BY_TAB[tab].map((def) => ({ kind: 'catalog' as const, def }));
  }, [tab, tick]);

  const pickRow = (row: PresetRow) => {
    if (row.kind === 'saved') {
      onPick({
        source: tab,
        slug: row.config.id,
        widgetConfig: row.config,
      });
      return;
    }
    onPick({ source: tab, slug: row.def.slug });
  };

  return createPortal(
    <div className="fixed inset-0 z-[10080] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        role="dialog"
        className="w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col rounded-[18px] border border-neutral-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.35)] text-[#222]"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-neutral-100">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              {t('crm.dashboard.hero.kicker')}
            </div>
            <h2 className="text-sm font-semibold text-[#222]">{t('crm.dashboard.presets.modalTitle')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-medium text-[#222] hover:bg-neutral-50"
          >
            {t('crm.common.close')}
          </button>
        </div>

        <div className="px-5 pt-4 flex flex-wrap gap-2 border-b border-neutral-50 pb-4">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setTab(x.id)}
              className={
                'rounded-2xl px-4 py-2 text-[11px] font-semibold transition border ' +
                (tab === x.id
                  ? 'border-lumiva-accent bg-lumiva-accent text-white shadow-[0_8px_20px_rgba(34,34,34,0.12)]'
                  : 'border-neutral-200 bg-white text-[#222] hover:bg-neutral-50')
              }
            >
              {x.label}
            </button>
          ))}
        </div>

        <div key={tab} className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[11px] text-neutral-600 mb-4">{t('crm.dashboard.presets.pickHint')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map((row) => {
              const key =
                row.kind === 'saved' ? `saved-${row.config.id}` : `cat-${tab}-${row.def.slug}`;
              const title =
                row.kind === 'saved' ? row.config.title : t(row.def.titleKey);
              const kindLabel =
                row.kind === 'saved'
                  ? kindLabelForSaved(t, row.config.type)
                  : row.def.kind === 'metric'
                    ? t('crm.projects.analytics.widgets.type.metric')
                    : row.def.kind === 'donut'
                      ? t('crm.projects.analytics.widgets.type.donut')
                      : row.def.kind === 'bar'
                        ? t('crm.projects.analytics.widgets.type.bar')
                        : t('crm.projects.analytics.widgets.type.table');
              const instance: DashboardPresetInstance =
                row.kind === 'saved'
                  ? { source: tab, slug: row.config.id, widgetConfig: row.config }
                  : { source: tab, slug: row.def.slug };

              return (
                <div
                  key={key}
                  className="flex flex-col rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="px-3 pt-3 pb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                      {kindLabel}
                    </span>
                    <span className="text-[9px] font-semibold text-lumiva-accent truncate max-w-[120px]">
                      {tab === 'sales'
                        ? t('crm.dashboard.presets.tabSales')
                        : tab === 'leads'
                          ? t('crm.dashboard.presets.tabLeads')
                          : t('crm.dashboard.presets.tabProjects')}
                    </span>
                  </div>
                  <div className="text-[12px] font-semibold text-[#222] px-3 pb-2 leading-snug">
                    {title}
                  </div>
                  <div className="h-[200px] border-y border-neutral-100 bg-gradient-to-b from-neutral-50/80 to-white px-2 py-1">
                    <div className="h-full w-full overflow-hidden rounded-xl bg-white border border-neutral-100 shadow-inner px-2 py-2">
                      <DashboardPresetWidget
                        variant="preview"
                        instance={instance}
                        projectsFromDashboard={previewItems}
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-50/50">
                    <button
                      type="button"
                      onClick={() => pickRow(row)}
                      className={`w-full ${DASH_BTN_PRIMARY_SM}`}
                    >
                      {t('crm.dashboard.presets.addToDashboard')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hiddenStandardIds.length > 0 && (
            <div className="mt-8 pt-6 border-t border-neutral-100">
              <div className="text-[11px] font-semibold text-[#222] mb-3">
                {t('crm.dashboard.presets.standardBlocks')}
              </div>
              <div className="flex flex-wrap gap-2">
                {hiddenStandardIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onAddStandard(id)}
                    className="rounded-xl border border-dashed border-neutral-300 bg-white px-3 py-2 text-[11px] font-medium text-[#222] hover:bg-neutral-50"
                  >
                    + {widgetTitle(id)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

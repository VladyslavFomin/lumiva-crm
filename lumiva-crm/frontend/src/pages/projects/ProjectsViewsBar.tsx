import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  createProjectsCustomView,
  copyProjectsCustomView,
  defaultProjectsViewSettings,
  deleteProjectsCustomView,
  loadProjectsViewsState,
  moveProjectsTab,
  saveProjectsViewsState,
  updateProjectsCustomView,
  type ProjectsCustomView,
  type ProjectsViewSettings,
  type ProjectsViewType,
  type ProjectsViewsState,
} from './projectsViewsStore';

type TabItem = {
  id: string;
  type: ProjectsViewType;
  isBase: boolean;
};

type Props = {
  currentType: ProjectsViewType;
  activeViewId: string | null;
  onOpenView: (type: ProjectsViewType, viewId?: string) => void;
  onSettingsChange: (settings: ProjectsViewSettings) => void;
  projectCount?: number;
};

type SettingsTarget = {
  type: ProjectsViewType;
  viewId: string | null;
  name: string;
};

type KanbanFieldKey = NonNullable<ProjectsViewSettings['kanbanCardFields']>[number];

const BASE_TABS: Array<{ id: string; type: ProjectsViewType }> = [
  { id: 'base-table', type: 'table' },
  { id: 'base-kanban', type: 'kanban' },
  { id: 'base-calendar', type: 'calendar' },
];

const findBaseByType = (type: ProjectsViewType) =>
  BASE_TABS.find((tab) => tab.type === type) as (typeof BASE_TABS)[number];

const BASE_SETTINGS_KEY = 'projects_base_view_settings_v1';

const loadBaseSettings = (): Record<ProjectsViewType, ProjectsViewSettings> => {
  const defaults: Record<ProjectsViewType, ProjectsViewSettings> = {
    table: defaultProjectsViewSettings('table'),
    kanban: defaultProjectsViewSettings('kanban'),
    calendar: defaultProjectsViewSettings('calendar'),
  };
  try {
    const raw = localStorage.getItem(BASE_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<ProjectsViewType, ProjectsViewSettings>>;
    return {
      table: { ...defaults.table, ...(parsed.table || {}) },
      kanban: { ...defaults.kanban, ...(parsed.kanban || {}) },
      calendar: { ...defaults.calendar, ...(parsed.calendar || {}) },
    };
  } catch {
    return defaults;
  }
};

const saveBaseSettings = (value: Record<ProjectsViewType, ProjectsViewSettings>) => {
  try {
    localStorage.setItem(BASE_SETTINGS_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const KANBAN_FIELD_OPTIONS: Array<{
  key: KanbanFieldKey;
  labelKey: string;
  previewKey: string;
}> = [
  { key: 'owner', labelKey: 'crm.projects.viewsBar.fields.owner', previewKey: 'crm.projects.viewsBar.preview.owner' },
  { key: 'amount', labelKey: 'crm.projects.viewsBar.fields.amount', previewKey: 'crm.projects.viewsBar.preview.amount' },
  { key: 'progress', labelKey: 'crm.projects.viewsBar.fields.progress', previewKey: 'crm.projects.viewsBar.preview.progress' },
  { key: 'created', labelKey: 'crm.projects.viewsBar.fields.created', previewKey: 'crm.projects.viewsBar.preview.created' },
  { key: 'priority', labelKey: 'crm.projects.viewsBar.fields.priority', previewKey: 'crm.projects.viewsBar.preview.priority' },
  { key: 'tags', labelKey: 'crm.projects.viewsBar.fields.tags', previewKey: 'crm.projects.viewsBar.preview.tags' },
  { key: 'deadline', labelKey: 'crm.projects.viewsBar.fields.deadline', previewKey: 'crm.projects.viewsBar.preview.deadline' },
];

export const ProjectsViewsBar: React.FC<Props> = ({
  currentType,
  activeViewId,
  onOpenView,
  onSettingsChange,
  projectCount,
}) => {
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const [viewsState, setViewsState] = useState<ProjectsViewsState>(() =>
    loadProjectsViewsState(),
  );
  const [baseSettings, setBaseSettings] = useState<
    Record<ProjectsViewType, ProjectsViewSettings>
  >(() => loadBaseSettings());
  const [menuTabId, setMenuTabId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [settingsTarget, setSettingsTarget] = useState<SettingsTarget | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<ProjectsViewSettings>({});
  const [kanbanEntity, setKanbanEntity] = useState<'deal' | 'subdeal'>('deal');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveProjectsViewsState(viewsState);
  }, [viewsState]);

  useEffect(() => {
    saveBaseSettings(baseSettings);
  }, [baseSettings]);

  const menuOpen = Boolean(menuTabId);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuTabId(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const viewsById = useMemo(() => {
    const map = new Map<string, ProjectsCustomView>();
    viewsState.customViews.forEach((view) => map.set(view.id, view));
    return map;
  }, [viewsState.customViews]);

  const activeBase = findBaseByType(currentType);
  const activeTabId = activeViewId || activeBase.id;
  const activeCustomView = activeViewId ? viewsById.get(activeViewId) || null : null;
  const settingsView = settingsTarget?.viewId ? viewsById.get(settingsTarget.viewId) || null : null;

  const settings = useMemo(() => {
    if (activeCustomView) {
      return {
        ...defaultProjectsViewSettings(activeCustomView.type),
        ...(activeCustomView.settings || {}),
      };
    }
    return {
      ...defaultProjectsViewSettings(currentType),
      ...(baseSettings[currentType] || {}),
    };
  }, [activeCustomView?.id, currentType, baseSettings]);

  useEffect(() => {
    onSettingsChange(settings);
  }, [settings, onSettingsChange]);

  const tabItems = useMemo(() => {
    const list: TabItem[] = [];
    const existing = new Set<string>();
    viewsState.tabOrder.forEach((id) => {
      if (existing.has(id)) return;
      existing.add(id);
      const base = BASE_TABS.find((tab) => tab.id === id);
      if (base) {
        list.push({
          id: base.id,
          type: base.type,
          isBase: true,
        });
        return;
      }
      const custom = viewsById.get(id);
      if (!custom) return;
      list.push({
        id: custom.id,
        type: custom.type,
        isBase: false,
      });
    });
    BASE_TABS.forEach((base) => {
      if (!list.find((tab) => tab.id === base.id)) {
        list.push({
          id: base.id,
          type: base.type,
          isBase: true,
        });
      }
    });
    viewsState.customViews.forEach((custom) => {
      if (!list.find((tab) => tab.id === custom.id)) {
        list.push({
          id: custom.id,
          type: custom.type,
          isBase: false,
        });
      }
    });
    return list;
  }, [viewsState.tabOrder, viewsState.customViews, viewsById]);

  const openSettings = (targetTabId?: string) => {
    const targetTab = tabItems.find((tab) => tab.id === (targetTabId || activeTabId)) || null;
    if (!targetTab) return;
    const targetView = targetTab.isBase ? null : viewsById.get(targetTab.id) || null;
    const resolvedType = targetView?.type || targetTab.type;
    const resolvedSettings = targetView
      ? targetView.settings || {}
      : baseSettings[resolvedType] || {};
    setSettingsDraft({
      ...defaultProjectsViewSettings(resolvedType),
      ...resolvedSettings,
    });
    setSettingsTarget({
      type: resolvedType,
      viewId: targetView?.id || null,
      name:
        targetView?.name ||
        t(
          resolvedType === 'table'
            ? 'crm.projects.views.table'
            : resolvedType === 'kanban'
              ? 'crm.projects.views.kanban'
              : 'crm.projects.views.calendar',
        ),
    });
    setMenuTabId(null);
  };

  const saveSettings = () => {
    if (!settingsTarget) return;
    if (settingsTarget.viewId) {
      setViewsState((prev) =>
        updateProjectsCustomView(prev, settingsTarget.viewId as string, { settings: settingsDraft }),
      );
    } else {
      setBaseSettings((prev) => ({
        ...prev,
        [settingsTarget.type]: {
          ...defaultProjectsViewSettings(settingsTarget.type),
          ...settingsDraft,
        },
      }));
    }
    setSettingsTarget(null);
  };

  const createView = (type: ProjectsViewType) => {
    const name = window.prompt(t('crm.projects.viewsBar.prompts.viewName'));
    if (!name || !name.trim()) return;
    const next = createProjectsCustomView(viewsState, type, name.trim());
    const created = next.customViews[next.customViews.length - 1] || null;
    setViewsState(next);
    if (created) onOpenView(type, created.id);
    setMenuTabId(null);
  };

  const copyActive = (targetTabId?: string) => {
    const targetTab = tabItems.find((tab) => tab.id === (targetTabId || activeTabId)) || null;
    if (!targetTab) return;
    const targetCustomView = targetTab.isBase ? null : viewsById.get(targetTab.id) || null;
    if (targetCustomView) {
      const next = copyProjectsCustomView(viewsState, targetCustomView);
      const copied = next.customViews[next.customViews.length - 1] || null;
      setViewsState(next);
      if (copied) onOpenView(targetCustomView.type, copied.id);
      setMenuTabId(null);
      return;
    }
    const name =
      targetTab.type === 'table'
        ? t('crm.projects.viewsBar.copyNames.table')
        : targetTab.type === 'kanban'
          ? t('crm.projects.viewsBar.copyNames.kanban')
          : t('crm.projects.viewsBar.copyNames.calendar');
    const next = createProjectsCustomView(viewsState, targetTab.type, name);
    const created = next.customViews[next.customViews.length - 1] || null;
    setViewsState(next);
    if (created) onOpenView(targetTab.type, created.id);
    setMenuTabId(null);
  };

  const deleteActive = async (targetTabId?: string) => {
    const targetTab = tabItems.find((tab) => tab.id === (targetTabId || activeTabId)) || null;
    if (!targetTab || targetTab.isBase) return;
    const targetCustomView = viewsById.get(targetTab.id) || null;
    if (!targetCustomView) return;
    const ok = await showConfirm(t('crm.projects.viewsBar.confirm.deleteCurrentView'), {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    setViewsState((prev) => deleteProjectsCustomView(prev, targetCustomView.id));
    onOpenView(targetCustomView.type);
    setMenuTabId(null);
  };

  const moveActive = (direction: 'left' | 'right', targetTabId?: string) => {
    const tabId = targetTabId || activeTabId;
    setViewsState((prev) => moveProjectsTab(prev, tabId, direction));
    setMenuTabId(null);
  };

  const tabIcon = (type: ProjectsViewType) => {
    if (type === 'table') return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="1" y="1" width="14" height="14" rx="2" /><path d="M1 5h14M5 5v10" /></svg>
    );
    if (type === 'kanban') return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="1" y="1" width="4" height="14" rx="1" /><rect x="6" y="1" width="4" height="10" rx="1" /><rect x="11" y="1" width="4" height="12" rx="1" /></svg>
    );
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="1" y="2" width="14" height="13" rx="2" /><path d="M1 6h14M5 1v2M11 1v2" /></svg>
    );
  };

  return (
    <>
      <div className="lv-view-tabs">
        {tabItems.map((tab) => (
          <div key={tab.id} className="group relative flex items-center">
            <button
              className={`lv-view-tab${activeTabId === tab.id ? ' active' : ''}`}
              type="button"
              onClick={() => onOpenView(tab.type, tab.isBase ? undefined : tab.id)}
            >
              {tabIcon(tab.type)}
              {tab.isBase
                ? t(
                    tab.type === 'table'
                      ? 'crm.projects.views.table'
                      : tab.type === 'kanban'
                        ? 'crm.projects.views.kanban'
                        : 'crm.projects.views.calendar',
                  )
                : (viewsById.get(tab.id)?.name ?? '')}
              {tab.isBase && tab.type === 'table' && activeTabId === tab.id && typeof projectCount === 'number' && (
                <span className="badge">{projectCount}</span>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                setMenuPosition({
                  top: rect.bottom + 6,
                  left: Math.min(rect.left, window.innerWidth - 240),
                });
                setMenuTabId((prev) => (prev === tab.id ? null : tab.id));
              }}
              className={`lv-view-tab-menu-btn${menuTabId === tab.id ? ' visible' : ''}`}
              title={t('crm.projects.viewsBar.menu.tabMenu')}
            >
              ···
            </button>
          </div>
        ))}
        <button type="button" className="lv-view-tabs-add" title={t('crm.projects.views.addTab', 'Добавить вид')}>+</button>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed w-56 rounded-2xl border border-slate-200 bg-white shadow-2xl p-2 z-[1400]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <button type="button" onClick={() => createView('table')} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-700 hover:bg-slate-100">
            {t('crm.projects.viewsBar.menu.newTable')}
          </button>
          <button type="button" onClick={() => createView('kanban')} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-700 hover:bg-slate-100">
            {t('crm.projects.viewsBar.menu.newKanban')}
          </button>
          <button type="button" onClick={() => createView('calendar')} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-700 hover:bg-slate-100">
            {t('crm.projects.viewsBar.menu.newCalendar')}
          </button>
          <div className="my-1 border-t border-slate-200" />
          <button type="button" onClick={() => moveActive('left', menuTabId || undefined)} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-700 hover:bg-slate-100">
            {t('crm.projects.viewsBar.menu.moveLeft')}
          </button>
          <button type="button" onClick={() => moveActive('right', menuTabId || undefined)} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-700 hover:bg-slate-100">
            {t('crm.projects.viewsBar.menu.moveRight')}
          </button>
          <button type="button" onClick={() => copyActive(menuTabId || undefined)} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-700 hover:bg-slate-100">
            {t('crm.projects.viewsBar.menu.copyTab')}
          </button>
          {!!menuTabId && tabItems.find((tab) => tab.id === menuTabId && !tab.isBase) && (
            <button type="button" onClick={() => void deleteActive(menuTabId || undefined)} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-[#9a1f31] hover:bg-[#fbecef]">
              {t('crm.projects.viewsBar.menu.deleteTab')}
            </button>
          )}
          <div className="my-1 border-t border-slate-200" />
          <button type="button" onClick={() => openSettings(menuTabId || undefined)} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-700 hover:bg-slate-100">
            {t('crm.projects.viewsBar.menu.settings')}
          </button>
        </div>
      )}

      {settingsTarget && (
        <div className="fixed inset-0 z-[8500] bg-black/35">
          <button
            type="button"
            aria-label={t('crm.projects.viewsBar.settings.close')}
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setSettingsTarget(null)}
          />
          <div className="absolute right-0 top-0 h-screen w-full max-w-2xl border-l border-slate-200 bg-white shadow-2xl">
            <div className="h-full overflow-y-auto p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {t('crm.projects.viewsBar.settings.title')}
                </h3>
                <div className="text-[12px] text-slate-500">{settingsTarget.name}</div>
              </div>
              <button
                type="button"
                onClick={() => setSettingsTarget(null)}
                className="h-7 w-7 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 mb-4">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Тип вида
              </label>
              <div className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                {settingsTarget.type === 'table'
                  ? t('crm.projects.views.table')
                  : settingsTarget.type === 'kanban'
                    ? t('crm.projects.views.kanban')
                    : t('crm.projects.views.calendar')}
              </div>
            </div>

            {settingsTarget.type === 'kanban' && (
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">
                    {t('crm.projects.viewsBar.settings.kanbanCardTitle')}
                  </div>
                </div>
                <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setKanbanEntity('deal')}
                    className={`px-4 py-1.5 text-xs rounded-lg ${kanbanEntity === 'deal' ? 'bg-[#d8eef7] text-slate-900 border border-[#72c3db]' : 'text-slate-600'}`}
                  >
                    Deal
                  </button>
                  <button
                    type="button"
                    onClick={() => setKanbanEntity('subdeal')}
                    className={`px-4 py-1.5 text-xs rounded-lg ${kanbanEntity === 'subdeal' ? 'bg-[#d8eef7] text-slate-900 border border-[#72c3db]' : 'text-slate-600'}`}
                  >
                    Sub-deal
                  </button>
                </div>
                <div className="text-xs text-slate-600">
                  {t('crm.projects.viewsBar.settings.kanbanFieldsHint')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {KANBAN_FIELD_OPTIONS.map((field) => {
                    const list = settingsDraft.kanbanCardFields || [];
                    const checked = list.includes(field.key);
                  return (
                      <button
                        key={field.key}
                        type="button"
                        onClick={() =>
                          setSettingsDraft((prev) => {
                            const current = prev.kanbanCardFields || [];
                            return {
                              ...prev,
                              kanbanCardFields: checked
                                ? current.filter((item) => item !== field.key)
                                : [...current, field.key],
                            };
                          })
                        }
                        className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                          checked
                            ? 'border-[#72c3db] bg-[#d8eef7] text-slate-900'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {t(field.labelKey)}
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <div className="mx-auto max-w-sm rounded-2xl border border-slate-300 bg-white p-3">
                    <div className="text-sm font-semibold text-slate-800 mb-2">
                      {t('crm.projects.viewsBar.settings.previewTitle')}
                    </div>
                    <div className="space-y-1.5">
                      {(settingsDraft.kanbanCardFields || []).length ? (
                        (settingsDraft.kanbanCardFields || []).map((fieldKey) => {
                          const option = KANBAN_FIELD_OPTIONS.find((item) => item.key === fieldKey);
                          if (!option) return null;
                          return (
                            <div key={fieldKey} className="inline-flex mr-1 mb-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700">
                              {t(option.previewKey)}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-500">
                          {t('crm.projects.viewsBar.settings.previewEmpty')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {settingsTarget.type === 'calendar' && (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-800">
                  {t('crm.projects.viewsBar.settings.calendarFilterTitle')}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      calendarImportantOnly: !prev.calendarImportantOnly,
                    }))
                  }
                  className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                    settingsDraft.calendarImportantOnly
                      ? 'border-[#72c3db] bg-[#d8eef7] text-slate-900'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {t('crm.projects.viewsBar.settings.calendarImportantOnly')}
                  <span>
                    {settingsDraft.calendarImportantOnly
                      ? t('crm.projects.viewsBar.settings.enabled')
                      : t('crm.projects.viewsBar.settings.disabled')}
                  </span>
                </button>
              </div>
            )}

            {settingsTarget.type === 'table' && (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-800">
                  {t('crm.projects.viewsBar.settings.tableTitle')}
                </div>
                <div className="text-xs text-slate-600">
                  {t('crm.projects.viewsBar.settings.tableHint')}
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettingsTarget(null)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                {t('crm.common.cancel')}
              </button>
              <button
                type="button"
                onClick={saveSettings}
                className="px-3 py-1.5 text-xs rounded-xl bg-[#222222] text-white hover:bg-black"
              >
                {t('crm.common.save')}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
};



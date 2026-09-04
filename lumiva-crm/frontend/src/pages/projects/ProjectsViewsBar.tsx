import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchProjectStatuses,
  createProjectStatus,
  updateProjectStatus,
  deleteProjectStatus,
  reorderProjectStatuses,
  type ProjectStatusDefinition,
} from '../../api/project-statuses';
import {
  fetchProjectTagDefinitions,
  createProjectTagDefinition,
  updateProjectTagDefinition,
  deleteProjectTagDefinition,
  reorderProjectTagDefinitions,
  type ProjectTagDefinition,
} from '../../api/project-tags';
import {
  fetchProjectCurrencyDefinitions,
  createProjectCurrencyDefinition,
  updateProjectCurrencyDefinition,
  deleteProjectCurrencyDefinition,
  reorderProjectCurrencyDefinitions,
  type ProjectCurrencyDefinition,
} from '../../api/project-currencies';
import {
  fetchProjectTables,
  createProjectTable,
  updateProjectTable,
  deleteProjectTable,
  type ProjectTable,
} from '../../api/projectTables';
import {
  defaultProjectsViewSettings,
  loadTableViewSettings,
  saveTableViewSettings,
  type ProjectsViewSettings,
  type ProjectsViewType,
} from './projectsViewSettings';
import { ProjectTableMembersSection } from '../../components/projects/ProjectTableMembersSection';

type Props = {
  currentType: ProjectsViewType;
  activeTableId: string;
  onOpenType: (type: ProjectsViewType) => void;
  onTableChange: (tableId: string) => void;
  onSettingsChange: (settings: ProjectsViewSettings) => void;
  onTablesChange?: (tables: ProjectTable[]) => void;
  projectCount?: number;
};

type KanbanFieldKey = NonNullable<ProjectsViewSettings['kanbanCardFields']>[number];

const VIEW_TYPES: ProjectsViewType[] = ['table', 'kanban', 'calendar'];

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
  activeTableId,
  onOpenType,
  onTableChange,
  onSettingsChange,
  onTablesChange,
  projectCount,
}) => {
  const { t } = useTranslation();
  const { showAlert, showConfirm, showPrompt } = useAlertModal();

  const [tables, setTables] = useState<ProjectTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tableMenuId, setTableMenuId] = useState<string | null>(null);
  const [tableMenuPosition, setTableMenuPosition] = useState({ top: 0, left: 0 });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<ProjectsViewSettings>({});
  const [kanbanEntity, setKanbanEntity] = useState<'deal' | 'subdeal'>('deal');
  const [statusDefs, setStatusDefs] = useState<ProjectStatusDefinition[]>([]);
  const [statusDefsLoading, setStatusDefsLoading] = useState(false);
  const [newStatusValue, setNewStatusValue] = useState('');
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [tagDefs, setTagDefs] = useState<ProjectTagDefinition[]>([]);
  const [tagDefsLoading, setTagDefsLoading] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');
  const [tagBusy, setTagBusy] = useState<string | null>(null);
  const [currencyDefs, setCurrencyDefs] = useState<ProjectCurrencyDefinition[]>([]);
  const [currencyDefsLoading, setCurrencyDefsLoading] = useState(false);
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [currencyBusy, setCurrencyBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    setTablesLoading(true);
    fetchProjectTables()
      .then((list) => {
        if (!alive) return;
        setTables(list);
        onTablesChange?.(list);
      })
      .catch((e) => console.error('Ошибка загрузки таблиц проектов:', e))
      .finally(() => {
        if (alive) setTablesLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menuOpen = Boolean(tableMenuId);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setTableMenuId(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const settings = useMemo(
    () =>
      activeTableId
        ? loadTableViewSettings(activeTableId, currentType)
        : defaultProjectsViewSettings(currentType),
    [activeTableId, currentType],
  );

  useEffect(() => {
    onSettingsChange(settings);
  }, [settings, onSettingsChange]);

  const activeTable = tables.find((tbl) => tbl.id === activeTableId) || null;

  const openSettings = () => {
    setSettingsDraft(settings);
    setSettingsOpen(true);
  };

  useEffect(() => {
    if (!settingsOpen) return;
    let alive = true;
    setStatusDefsLoading(true);
    fetchProjectStatuses()
      .then((list) => {
        if (!alive) return;
        setStatusDefs([...list].sort((a, b) => a.order - b.order));
      })
      .catch((e) => console.error('Ошибка загрузки статусов проектов:', e))
      .finally(() => {
        if (alive) setStatusDefsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    let alive = true;
    setTagDefsLoading(true);
    fetchProjectTagDefinitions()
      .then((list) => {
        if (!alive) return;
        setTagDefs([...list].sort((a, b) => a.order - b.order));
      })
      .catch((e) => console.error('Ошибка загрузки меток проектов:', e))
      .finally(() => {
        if (alive) setTagDefsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    let alive = true;
    setCurrencyDefsLoading(true);
    fetchProjectCurrencyDefinitions()
      .then((list) => {
        if (!alive) return;
        setCurrencyDefs([...list].sort((a, b) => a.order - b.order));
      })
      .catch((e) => console.error('Ошибка загрузки валют проектов:', e))
      .finally(() => {
        if (alive) setCurrencyDefsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [settingsOpen]);

  const addStatus = async () => {
    const value = newStatusValue.trim();
    if (!value) return;
    setStatusBusy('new');
    try {
      const created = await createProjectStatus({ value });
      setStatusDefs((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setNewStatusValue('');
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось добавить статус', { title: 'Ошибка', variant: 'error' });
    } finally {
      setStatusBusy(null);
    }
  };

  const changeStatusColor = async (id: string, color: string) => {
    setStatusDefs((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
    try {
      await updateProjectStatus(id, { color });
    } catch (e) {
      console.error('Ошибка обновления цвета статуса:', e);
    }
  };

  const renameStatus = async (id: string, rawValue: string) => {
    const value = rawValue.trim();
    if (!value) {
      // пустое имя — откатываем к серверной версии
      try {
        const list = await fetchProjectStatuses();
        setStatusDefs([...list].sort((a, b) => a.order - b.order));
      } catch (e) {
        console.error('Ошибка перезагрузки статусов:', e);
      }
      return;
    }
    try {
      const updated = await updateProjectStatus(id, { value });
      setStatusDefs((prev) =>
        prev.map((s) => (s.id === id ? updated : s)).sort((a, b) => a.order - b.order),
      );
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось переименовать статус', { title: 'Ошибка', variant: 'error' });
      try {
        const list = await fetchProjectStatuses();
        setStatusDefs([...list].sort((a, b) => a.order - b.order));
      } catch (err) {
        console.error('Ошибка перезагрузки статусов:', err);
      }
    }
  };

  const removeStatus = async (status: ProjectStatusDefinition) => {
    const ok = await showConfirm(`Удалить статус «${status.value}»?`, {
      title: 'Удаление статуса',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    setStatusBusy(status.id);
    try {
      await deleteProjectStatus(status.id);
      setStatusDefs((prev) => prev.filter((s) => s.id !== status.id));
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось удалить статус', { title: 'Ошибка', variant: 'error' });
    } finally {
      setStatusBusy(null);
    }
  };

  const moveStatus = async (id: string, direction: 'up' | 'down') => {
    const idx = statusDefs.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= statusDefs.length) return;
    const next = [...statusDefs];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    setStatusDefs(next);
    try {
      await reorderProjectStatuses(next.map((s) => s.id));
    } catch (e) {
      console.error('Ошибка изменения порядка статусов:', e);
    }
  };

  const addTag = async () => {
    const value = newTagValue.trim();
    if (!value) return;
    setTagBusy('new');
    try {
      const created = await createProjectTagDefinition({ value });
      setTagDefs((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setNewTagValue('');
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось добавить метку', { title: 'Ошибка', variant: 'error' });
    } finally {
      setTagBusy(null);
    }
  };

  const changeTagColor = async (id: string, color: string) => {
    setTagDefs((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
    try {
      await updateProjectTagDefinition(id, { color });
    } catch (e) {
      console.error('Ошибка обновления цвета метки:', e);
    }
  };

  const renameTag = async (id: string, rawValue: string) => {
    const value = rawValue.trim();
    if (!value) {
      try {
        const list = await fetchProjectTagDefinitions();
        setTagDefs([...list].sort((a, b) => a.order - b.order));
      } catch (e) {
        console.error('Ошибка перезагрузки меток:', e);
      }
      return;
    }
    try {
      const updated = await updateProjectTagDefinition(id, { value });
      setTagDefs((prev) => prev.map((s) => (s.id === id ? updated : s)).sort((a, b) => a.order - b.order));
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось переименовать метку', { title: 'Ошибка', variant: 'error' });
      try {
        const list = await fetchProjectTagDefinitions();
        setTagDefs([...list].sort((a, b) => a.order - b.order));
      } catch (err) {
        console.error('Ошибка перезагрузки меток:', err);
      }
    }
  };

  const removeTag = async (tag: ProjectTagDefinition) => {
    const ok = await showConfirm(`Удалить метку «${tag.value}»?`, {
      title: 'Удаление метки',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    setTagBusy(tag.id);
    try {
      await deleteProjectTagDefinition(tag.id);
      setTagDefs((prev) => prev.filter((s) => s.id !== tag.id));
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось удалить метку', { title: 'Ошибка', variant: 'error' });
    } finally {
      setTagBusy(null);
    }
  };

  const moveTag = async (id: string, direction: 'up' | 'down') => {
    const idx = tagDefs.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= tagDefs.length) return;
    const next = [...tagDefs];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    setTagDefs(next);
    try {
      await reorderProjectTagDefinitions(next.map((s) => s.id));
    } catch (e) {
      console.error('Ошибка изменения порядка меток:', e);
    }
  };

  const addCurrency = async () => {
    const code = newCurrencyCode.trim().toUpperCase();
    if (!code) return;
    setCurrencyBusy('new');
    try {
      const created = await createProjectCurrencyDefinition({ code });
      setCurrencyDefs((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setNewCurrencyCode('');
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось добавить валюту', { title: 'Ошибка', variant: 'error' });
    } finally {
      setCurrencyBusy(null);
    }
  };

  const makeCurrencyDefault = async (id: string) => {
    setCurrencyDefs((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
    try {
      const updated = await updateProjectCurrencyDefinition(id, { isDefault: true });
      setCurrencyDefs((prev) => prev.map((c) => (c.id === id ? updated : { ...c, isDefault: false })));
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось изменить валюту по умолчанию', { title: 'Ошибка', variant: 'error' });
    }
  };

  const removeCurrency = async (currency: ProjectCurrencyDefinition) => {
    const ok = await showConfirm(`Удалить валюту «${currency.code}»?`, {
      title: 'Удаление валюты',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    setCurrencyBusy(currency.id);
    try {
      await deleteProjectCurrencyDefinition(currency.id);
      setCurrencyDefs((prev) => prev.filter((c) => c.id !== currency.id));
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось удалить валюту', { title: 'Ошибка', variant: 'error' });
    } finally {
      setCurrencyBusy(null);
    }
  };

  const moveCurrency = async (id: string, direction: 'up' | 'down') => {
    const idx = currencyDefs.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= currencyDefs.length) return;
    const next = [...currencyDefs];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    setCurrencyDefs(next);
    try {
      await reorderProjectCurrencyDefinitions(next.map((c) => c.id));
    } catch (e) {
      console.error('Ошибка изменения порядка валют:', e);
    }
  };

  const saveSettings = () => {
    if (activeTableId) {
      saveTableViewSettings(activeTableId, currentType, settingsDraft);
    }
    onSettingsChange({ ...defaultProjectsViewSettings(currentType), ...settingsDraft });
    setSettingsOpen(false);
  };

  const createTable = async () => {
    const name = await showPrompt({
      title: t('crm.projects.viewsBar.prompts.tableNameTitle', 'Новая таблица'),
      label: t('crm.projects.viewsBar.prompts.tableName', 'Название'),
      placeholder: t('crm.projects.views.table'),
      confirmLabel: t('crm.common.create', 'Создать'),
    });
    if (!name) return;
    try {
      const created = await createProjectTable({ name });
      const next = [...tables, created];
      setTables(next);
      onTablesChange?.(next);
      onTableChange(created.id);
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось создать таблицу', { title: 'Ошибка', variant: 'error' });
    }
  };

  const renameTable = async (table: ProjectTable) => {
    setTableMenuId(null);
    const name = await showPrompt({
      title: t('crm.projects.viewsBar.prompts.renameTableTitle', 'Переименовать таблицу'),
      label: t('crm.projects.viewsBar.prompts.tableName', 'Название'),
      placeholder: table.name,
      confirmLabel: t('crm.common.save'),
    });
    if (!name) return;
    try {
      const updated = await updateProjectTable(table.id, { name });
      const next = tables.map((tbl) => (tbl.id === table.id ? updated : tbl));
      setTables(next);
      onTablesChange?.(next);
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось переименовать таблицу', { title: 'Ошибка', variant: 'error' });
    }
  };

  const removeTable = async (table: ProjectTable) => {
    setTableMenuId(null);
    const ok = await showConfirm(
      t(
        'crm.projects.viewsBar.confirm.deleteTable',
        `Удалить таблицу «${table.name}»? Проекты будут перенесены в основную таблицу.`,
      ) as string,
      { title: 'Удаление', confirmLabel: 'Удалить', cancelLabel: 'Отмена', danger: true },
    );
    if (!ok) return;
    try {
      await deleteProjectTable(table.id);
      const next = tables.filter((tbl) => tbl.id !== table.id);
      setTables(next);
      onTablesChange?.(next);
      if (activeTableId === table.id) {
        const main = next.find((tbl) => tbl.slug === 'main');
        if (main) onTableChange(main.id);
      }
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось удалить таблицу', { title: 'Ошибка', variant: 'error' });
    }
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
        {tablesLoading && tables.length === 0 ? (
          <span className="text-[11px] text-slate-400 px-2">…</span>
        ) : (
          tables.map((table) => (
            <div key={table.id} className="group relative flex items-center">
              <button
                className={`lv-view-tab${activeTableId === table.id ? ' active' : ''}`}
                type="button"
                onClick={() => onTableChange(table.id)}
              >
                {table.name}
                {activeTableId === table.id && typeof projectCount === 'number' && (
                  <span className="badge">{projectCount}</span>
                )}
              </button>
              {table.slug !== 'main' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                    setTableMenuPosition({
                      top: rect.bottom + 6,
                      left: Math.min(rect.left, window.innerWidth - 240),
                    });
                    setTableMenuId((prev) => (prev === table.id ? null : table.id));
                  }}
                  className={`lv-view-tab-menu-btn${tableMenuId === table.id ? ' visible' : ''}`}
                  title={t('crm.projects.viewsBar.menu.tabMenu')}
                >
                  ···
                </button>
              )}
            </div>
          ))
        )}
        <button
          type="button"
          className="lv-view-tabs-add"
          title={t('crm.projects.viewsBar.menu.newTableTab', 'Новая таблица')}
          onClick={() => void createTable()}
        >
          +
        </button>

        <div className="lv-view-tabs-sep" aria-hidden />

        {VIEW_TYPES.map((type) => (
          <button
            key={type}
            className={`lv-view-tab${currentType === type ? ' active' : ''}`}
            type="button"
            onClick={() => onOpenType(type)}
          >
            {tabIcon(type)}
            {t(
              type === 'table'
                ? 'crm.projects.views.table'
                : type === 'kanban'
                  ? 'crm.projects.views.kanban'
                  : 'crm.projects.views.calendar',
            )}
          </button>
        ))}

        <button
          type="button"
          className="lv-view-tabs-add"
          title={t('crm.projects.viewsBar.menu.settings')}
          onClick={openSettings}
        >
          ⚙
        </button>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed w-56 rounded-2xl border border-slate-200 bg-white shadow-2xl p-2 z-[1400]"
          style={{ top: tableMenuPosition.top, left: tableMenuPosition.left }}
        >
          <button
            type="button"
            onClick={() => {
              const table = tables.find((tbl) => tbl.id === tableMenuId);
              if (table) void renameTable(table);
            }}
            className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-700 hover:bg-slate-100"
          >
            {t('crm.projects.viewsBar.menu.renameTable', 'Переименовать')}
          </button>
          <button
            type="button"
            onClick={() => {
              const table = tables.find((tbl) => tbl.id === tableMenuId);
              if (table) void removeTable(table);
            }}
            className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-[#9a1f31] hover:bg-[#fbecef]"
          >
            {t('crm.projects.viewsBar.menu.deleteTable', 'Удалить')}
          </button>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-[8500] bg-black/35">
          <button
            type="button"
            aria-label={t('crm.projects.viewsBar.settings.close')}
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="absolute right-0 top-0 h-screen w-full max-w-2xl border-l border-slate-200 bg-white shadow-2xl">
            <div className="h-full overflow-y-auto p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {t('crm.projects.viewsBar.settings.title')}
                </h3>
                <div className="text-[12px] text-slate-500">{activeTable?.name || ''}</div>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
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
                {currentType === 'table'
                  ? t('crm.projects.views.table')
                  : currentType === 'kanban'
                    ? t('crm.projects.views.kanban')
                    : t('crm.projects.views.calendar')}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">Статусы проектов</div>
                <div className="text-[11px] text-slate-500">
                  {statusDefs.length ? `${statusDefs.length}` : ''}
                </div>
              </div>
              <div className="text-xs text-slate-600">
                Колонки канбана и бейджи статуса в таблице. Встроенные статусы нельзя удалить (на
                них завязана аналитика), но можно переименовывать, менять цвет и порядок — при
                переименовании существующие проекты автоматически переносятся на новое название.
              </div>
              {statusDefsLoading ? (
                <div className="text-xs text-slate-400">Загрузка…</div>
              ) : (
                <div className="space-y-1.5">
                  {statusDefs.map((s, idx) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5"
                    >
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => changeStatusColor(s.id, e.target.value)}
                        className="h-6 w-6 shrink-0 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
                        title="Цвет статуса"
                      />
                      <input
                        type="text"
                        value={s.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStatusDefs((prev) =>
                            prev.map((x) => (x.id === s.id ? { ...x, value: val } : x)),
                          );
                        }}
                        onBlur={(e) => void renameStatus(s.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-slate-800 outline-none focus:border-slate-300 focus:bg-white"
                      />
                      {s.isBuiltIn && (
                        <span className="shrink-0 text-[10px] text-slate-400">встроенный</span>
                      )}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveStatus(s.id, 'up')}
                        className="h-6 w-6 shrink-0 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        title="Выше"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === statusDefs.length - 1}
                        onClick={() => moveStatus(s.id, 'down')}
                        className="h-6 w-6 shrink-0 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        title="Ниже"
                      >
                        ↓
                      </button>
                      {!s.isBuiltIn && (
                        <button
                          type="button"
                          disabled={statusBusy === s.id}
                          onClick={() => void removeStatus(s)}
                          className="h-6 w-6 shrink-0 rounded-md border border-[#f0c8cf] bg-white text-[#9a1f31] hover:bg-[#fbecef] disabled:opacity-40"
                          title="Удалить статус"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newStatusValue}
                  onChange={(e) => setNewStatusValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addStatus();
                    }
                  }}
                  placeholder="Новый статус…"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  disabled={!newStatusValue.trim() || statusBusy === 'new'}
                  onClick={() => void addStatus()}
                  className="rounded-xl border border-[#222] bg-[#222] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#111] disabled:opacity-40"
                >
                  Добавить
                </button>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">
                  {t('crm.projects.viewsBar.settings.tagsTitle', 'Метки проектов')}
                </div>
                <div className="text-[11px] text-slate-500">{tagDefs.length ? `${tagDefs.length}` : ''}</div>
              </div>
              <div className="text-xs text-slate-600">
                {t(
                  'crm.projects.viewsBar.settings.tagsHint',
                  'Варианты меток, которые можно проставить на проект.',
                )}
              </div>
              {tagDefsLoading ? (
                <div className="text-xs text-slate-400">Загрузка…</div>
              ) : (
                <div className="space-y-1.5">
                  {tagDefs.map((tg, idx) => (
                    <div
                      key={tg.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5"
                    >
                      <input
                        type="color"
                        value={tg.color}
                        onChange={(e) => changeTagColor(tg.id, e.target.value)}
                        className="h-6 w-6 shrink-0 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
                        title="Цвет метки"
                      />
                      <input
                        type="text"
                        value={tg.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTagDefs((prev) => prev.map((x) => (x.id === tg.id ? { ...x, value: val } : x)));
                        }}
                        onBlur={(e) => void renameTag(tg.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-slate-800 outline-none focus:border-slate-300 focus:bg-white"
                      />
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveTag(tg.id, 'up')}
                        className="h-6 w-6 shrink-0 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        title="Выше"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === tagDefs.length - 1}
                        onClick={() => moveTag(tg.id, 'down')}
                        className="h-6 w-6 shrink-0 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        title="Ниже"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={tagBusy === tg.id}
                        onClick={() => void removeTag(tg)}
                        className="h-6 w-6 shrink-0 rounded-md border border-[#f0c8cf] bg-white text-[#9a1f31] hover:bg-[#fbecef] disabled:opacity-40"
                        title="Удалить метку"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newTagValue}
                  onChange={(e) => setNewTagValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addTag();
                    }
                  }}
                  placeholder="Новая метка…"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  disabled={!newTagValue.trim() || tagBusy === 'new'}
                  onClick={() => void addTag()}
                  className="rounded-xl border border-[#222] bg-[#222] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#111] disabled:opacity-40"
                >
                  Добавить
                </button>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">
                  {t('crm.projects.viewsBar.settings.currenciesTitle', 'Валюты')}
                </div>
                <div className="text-[11px] text-slate-500">
                  {currencyDefs.length ? `${currencyDefs.length}` : ''}
                </div>
              </div>
              <div className="text-xs text-slate-600">
                {t(
                  'crm.projects.viewsBar.settings.currenciesHint',
                  'Список валют, доступных при создании проекта. По умолчанию используется отмеченная валюта.',
                )}
              </div>
              {currencyDefsLoading ? (
                <div className="text-xs text-slate-400">Загрузка…</div>
              ) : (
                <div className="space-y-1.5">
                  {currencyDefs.map((cur, idx) => (
                    <div
                      key={cur.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => void makeCurrencyDefault(cur.id)}
                        title={
                          cur.isDefault
                            ? 'Валюта по умолчанию'
                            : 'Сделать валютой по умолчанию'
                        }
                        className={`h-5 w-5 shrink-0 rounded-full border ${
                          cur.isDefault
                            ? 'border-[#1f8a5e] bg-[#1f8a5e]'
                            : 'border-slate-300 bg-white'
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{cur.code}</span>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveCurrency(cur.id, 'up')}
                        className="h-6 w-6 shrink-0 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        title="Выше"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === currencyDefs.length - 1}
                        onClick={() => moveCurrency(cur.id, 'down')}
                        className="h-6 w-6 shrink-0 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        title="Ниже"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={currencyBusy === cur.id}
                        onClick={() => void removeCurrency(cur)}
                        className="h-6 w-6 shrink-0 rounded-md border border-[#f0c8cf] bg-white text-[#9a1f31] hover:bg-[#fbecef] disabled:opacity-40"
                        title="Удалить валюту"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newCurrencyCode}
                  onChange={(e) => setNewCurrencyCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addCurrency();
                    }
                  }}
                  placeholder="Новая валюта, напр. GBP…"
                  maxLength={8}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400 uppercase"
                />
                <button
                  type="button"
                  disabled={!newCurrencyCode.trim() || currencyBusy === 'new'}
                  onClick={() => void addCurrency()}
                  className="rounded-xl border border-[#222] bg-[#222] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#111] disabled:opacity-40"
                >
                  Добавить
                </button>
              </div>
            </div>

            {activeTable && activeTable.slug !== 'main' && (
              <div className="mb-4">
                <ProjectTableMembersSection tableId={activeTable.id} />
              </div>
            )}

            {currentType === 'kanban' && (
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

            {currentType === 'calendar' && (
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

            {currentType === 'table' && (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-800">
                  {t('crm.projects.viewsBar.settings.densityTitle', 'Плотность строк')}
                </div>
                <div className="text-xs text-slate-600">
                  {t(
                    'crm.projects.viewsBar.settings.densityHint',
                    'Высота строк таблицы. Настройка сохраняется в этом браузере.',
                  )}
                </div>
                <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1">
                  {(['compact', 'comfortable', 'spacious'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSettingsDraft((prev) => ({ ...prev, density: d }))}
                      className={`px-4 py-1.5 text-xs rounded-lg ${
                        (settingsDraft.density || 'comfortable') === d
                          ? 'bg-[#d8eef7] text-slate-900 border border-[#72c3db]'
                          : 'text-slate-600'
                      }`}
                    >
                      {d === 'compact'
                        ? t('crm.projects.viewsBar.settings.densityCompact', 'Компактно')
                        : d === 'comfortable'
                          ? t('crm.projects.viewsBar.settings.densityComfortable', 'Обычно')
                          : t('crm.projects.viewsBar.settings.densitySpacious', 'Просторно')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
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

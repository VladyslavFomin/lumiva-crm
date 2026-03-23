import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchCustomObject,
  updateCustomObject,
  type CustomObject,
} from '../../api/customObjects';
import {
  addEnabledView,
  parseEnabledViews,
  type ExtraWorkspaceViewKey,
} from '../../workspace/workspaceEnabledViews';

type WorkspaceTabKey = 'table' | 'kanban' | 'calendar' | 'analytics' | 'settings';

interface WorkspaceViewTabsProps {
  objectId: string;
  active: WorkspaceTabKey;
}

const EXTRA_VIEWS: Array<{ key: ExtraWorkspaceViewKey; path: string; labelKey: string }> = [
  { key: 'kanban', path: 'kanban', labelKey: 'crm.workspace.views.kanban' },
  { key: 'calendar', path: 'calendar', labelKey: 'crm.workspace.views.calendar' },
  { key: 'analytics', path: 'analytics', labelKey: 'crm.workspace.views.analytics' },
];

export const WorkspaceViewTabs: React.FC<WorkspaceViewTabsProps> = ({
  objectId,
  active,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [object, setObject] = useState<CustomObject | null>(null);
  const [loadingObject, setLoadingObject] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState<ExtraWorkspaceViewKey | null>(null);
  const addRef = useRef<HTMLDivElement | null>(null);

  const load = () => {
    if (!objectId) {
      setLoadingObject(false);
      setObject(null);
      return;
    }
    setLoadingObject(true);
    fetchCustomObject(objectId)
      .then(setObject)
      .catch(() => setObject(null))
      .finally(() => setLoadingObject(false));
  };

  useEffect(() => {
    load();
  }, [objectId]);

  useEffect(() => {
    if (!addOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    };
    document.addEventListener('click', onDoc, true);
    return () => document.removeEventListener('click', onDoc, true);
  }, [addOpen]);

  const enabled = parseEnabledViews(object?.meta);
  const canAddMore = EXTRA_VIEWS.some((v) => !enabled[v.key]);

  const tabButton = (key: WorkspaceTabKey, label: string, path: string) => {
    const isActive = active === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => navigate(`/workspace/${objectId}/${path}`)}
        style={isActive ? { backgroundColor: '#222222', color: '#ffffff' } : undefined}
        className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm transition-all duration-200 ${
          isActive ? 'shadow-sm' : 'text-slate-700 hover:-translate-y-0.5 hover:bg-slate-50'
        }`}
      >
        {label}
      </button>
    );
  };

  const handleAddView = async (key: ExtraWorkspaceViewKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let base = object;
    if (!base) {
      try {
        base = await fetchCustomObject(objectId);
        setObject(base);
      } catch {
        return;
      }
    }
    setAdding(key);
    try {
      const next = addEnabledView(base.meta, key);
      const mergedMeta = {
        ...(base.meta && typeof base.meta === 'object' ? base.meta : {}),
        enabledViews: next,
      };
      const updated = await updateCustomObject(objectId, { meta: mergedMeta });
      setObject(updated);
      setAddOpen(false);
      navigate(`/workspace/${objectId}/${key}`);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabButton('table', t('crm.workspace.views.table'), 'table')}
        {enabled.kanban && tabButton('kanban', t('crm.workspace.views.kanban'), 'kanban')}
        {enabled.calendar && tabButton('calendar', t('crm.workspace.views.calendar'), 'calendar')}
        {enabled.analytics && tabButton('analytics', t('crm.workspace.views.analytics'), 'analytics')}

        {canAddMore && !loadingObject && object && (
          <div className="relative shrink-0" ref={addRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAddOpen((v) => !v);
              }}
              className="inline-flex items-center gap-0.5 rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-xs sm:text-sm text-slate-600 hover:bg-slate-50"
              title={t('crm.workspace.views.addView')}
            >
              + {t('crm.workspace.views.add')}
            </button>
            {addOpen && (
              <div className="absolute left-0 top-full z-[60] mt-1 min-w-[11rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {t('crm.workspace.views.addView')}
                </div>
                {EXTRA_VIEWS.filter((v) => !enabled[v.key]).map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    disabled={!!adding}
                    className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    onClick={(e) => void handleAddView(v.key, e)}
                  >
                    {adding === v.key ? '…' : t(v.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tabButton('settings', t('crm.workspace.views.settings'), 'settings')}
      </div>
    </div>
  );
};

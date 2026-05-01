import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../pages/projects/ProjectsListPage.css';
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

type WorkspaceTabKey = 'table' | 'kanban' | 'calendar' | 'analytics' | 'gantt' | 'settings';

interface WorkspaceViewTabsProps {
  objectId: string;
  active: WorkspaceTabKey;
}

const EXTRA_VIEWS: Array<{ key: ExtraWorkspaceViewKey; path: string; labelKey: string }> = [
  { key: 'kanban', path: 'kanban', labelKey: 'crm.workspace.views.kanban' },
  { key: 'calendar', path: 'calendar', labelKey: 'crm.workspace.views.calendar' },
  { key: 'analytics', path: 'analytics', labelKey: 'crm.workspace.views.analytics' },
  { key: 'gantt', path: 'gantt', labelKey: 'crm.workspace.views.gantt' },
];

function tabIcon(key: WorkspaceTabKey) {
  if (key === 'table') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="1" y="1" width="14" height="14" rx="2" />
        <path d="M1 5h14M5 5v10" />
      </svg>
    );
  }
  if (key === 'kanban') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="1" y="1" width="4" height="14" rx="1" />
        <rect x="6" y="1" width="4" height="10" rx="1" />
        <rect x="11" y="1" width="4" height="12" rx="1" />
      </svg>
    );
  }
  if (key === 'calendar') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="1" y="2" width="14" height="13" rx="2" />
        <path d="M1 6h14M5 1v2M11 1v2" />
      </svg>
    );
  }
  if (key === 'analytics') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M2 14V8M7 14V4M12 14v-5" strokeLinecap="round" />
      </svg>
    );
  }
  if (key === 'gantt') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M2 4h10M2 8h6M2 12h12" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export const WorkspaceViewTabs: React.FC<WorkspaceViewTabsProps> = ({ objectId, active }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [object, setObject] = useState<CustomObject | null>(null);
  const [loadingObject, setLoadingObject] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState<ExtraWorkspaceViewKey | null>(null);
  const addRef = useRef<HTMLDivElement | null>(null);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

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

  // Reposition the portal dropdown on open and on scroll/resize
  useEffect(() => {
    if (!addOpen) return;
    const update = () => {
      if (!addBtnRef.current) return;
      const r = addBtnRef.current.getBoundingClientRect();
      const DROPDOWN_W = 192;
      const vw = window.innerWidth;
      // Align left edge with button, but flip to right-align if it would overflow
      const left = r.left + DROPDOWN_W > vw - 8 ? Math.max(8, r.right - DROPDOWN_W) : r.left;
      setDropdownStyle({
        position: 'fixed',
        top: r.bottom + 4,
        left,
        minWidth: DROPDOWN_W,
        zIndex: 9999,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [addOpen]);

  // Close on outside click
  useEffect(() => {
    if (!addOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideBtn = addRef.current?.contains(target);
      // Also check the portal dropdown rendered in body
      const portalDropdown = document.getElementById('lv-add-view-dropdown');
      const insidePortal = portalDropdown?.contains(target);
      if (!insideBtn && !insidePortal) {
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
        className={`lv-view-tab${isActive ? ' active' : ''}`}
      >
        {tabIcon(key)}
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
    <div className="lv-pt w-full min-w-0">
      <div className="lv-view-tabs">
        {tabButton('table', t('crm.workspace.views.table'), 'table')}
        {enabled.kanban && tabButton('kanban', t('crm.workspace.views.kanban'), 'kanban')}
        {enabled.calendar && tabButton('calendar', t('crm.workspace.views.calendar'), 'calendar')}
        {enabled.analytics && tabButton('analytics', t('crm.workspace.views.analytics'), 'analytics')}
        {enabled.gantt && tabButton('gantt', t('crm.workspace.views.gantt'), 'gantt')}

        {canAddMore && !loadingObject && object && (
          <div className="relative shrink-0 group" ref={addRef}>
            <button
              ref={addBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAddOpen((v) => !v);
              }}
              className="lv-view-tabs-add"
              title={t('crm.workspace.views.addView')}
            >
              +
            </button>
          </div>
        )}

        {tabButton('settings', t('crm.workspace.views.settings'), 'settings')}
      </div>

      {addOpen && createPortal(
        <div
          id="lv-add-view-dropdown"
          style={dropdownStyle}
          className="rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
};

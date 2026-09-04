// src/components/projects/ProjectTableOwnerCell.tsx
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateProject } from '../../api/projects';
import type { StaffUser } from '../../api/staff';
import type { Project } from '../../pages/projects/projectTypes';
import {
  initialsFromName,
  OwnerAvatarsRow,
  resolveProjectOwnersDisplay,
} from '../crm/OwnerAvatarsRow';
import { getFixedPopoverLayout, type FixedPopoverLayout } from '../../utils/tablePopoverFixedPosition';

type Props = {
  project: Project;
  staff: StaffUser[];
  onUpdated: (project: Project) => void;
};

export const ProjectTableOwnerCell: React.FC<Props> = ({
  project,
  staff,
  onUpdated,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [popoverLayout, setPopoverLayout] = useState<FixedPopoverLayout | null>(null);

  const managerStaff = useMemo(
    () =>
      staff
        .filter(
          (u) =>
            u.isActive &&
            (u.role === 'owner' || u.role === 'manager' || u.role === 'sales'),
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [staff],
  );
  const staffForPicker = managerStaff.length ? managerStaff : staff.filter((u) => u.isActive);

  const items = useMemo(() => resolveProjectOwnersDisplay(project, staff), [project, staff]);

  const openEditor = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const matchedIds = project.ownerUserIds?.length
        ? [...project.ownerUserIds]
        : (project.owner ?? '')
            .split(/[,;/]+/)
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name) => staff.find((u) => u.fullName === name)?.id)
            .filter((id): id is string => Boolean(id));
      setDraftIds(matchedIds);
      setSearch('');
      setOpen(true);
    },
    [project, staff],
  );

  const toggleDraft = (id: string) => {
    setDraftIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const save = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const selected = staff.filter((u) => draftIds.includes(u.id));
    const names = selected.map((u) => u.fullName);
    try {
      const updated = await updateProject(
        {
          ...project,
          owner: names.length ? names.join(', ') : null,
          ownerUserId: selected.length ? selected[0].id : null,
          ownerUserIds: selected.length ? selected.map((u) => u.id) : [],
        },
        { excludeStatus: true },
      );
      onUpdated(updated);
    } catch (err) {
      console.error(err);
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (menuRef.current?.contains(t)) return;
      if ((ev.target as Element)?.closest?.('[data-lv-owner-popover-anchor]')) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverLayout(null);
      return;
    }
    const btn = menuRef.current?.querySelector<HTMLButtonElement>('.lv-owner-add');
    if (!btn) return;
    const apply = () =>
      setPopoverLayout(
        getFixedPopoverLayout(btn.getBoundingClientRect(), { popoverWidth: 320, maxScroll: 280 }),
      );
    apply();
    window.addEventListener('scroll', apply, true);
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('scroll', apply, true);
      window.removeEventListener('resize', apply);
    };
  }, [open, search]);

  const filtered = staffForPicker.filter((u) =>
    search ? u.fullName.toLowerCase().includes(search.toLowerCase()) : true,
  );

  if (!staff.length) {
    return (
      <span className="text-[11px] text-[var(--fg-3)] text-center block">
        {project.owner?.trim() || '—'}
      </span>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <OwnerAvatarsRow
        items={items}
        readOnly={false}
        onAddClick={openEditor}
        addTitle={t('crm.projects.list.owner.edit')}
      />
      {open && popoverLayout && (
        <div
          className="lv-owner-popover lv-owner-popover--fixed"
          style={popoverLayout.style}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="lv-popover-title">{t('crm.projects.list.owner.title')}</div>
          <div className="lv-popover-search">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.5-4.5" />
            </svg>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm.projects.list.owner.search')}
            />
          </div>
          <div className="lv-owner-pop-list" style={{ maxHeight: popoverLayout.scrollMaxHeight }}>
            {filtered.map((u) => (
              <div
                key={u.id}
                className={`lv-owner-pop-item${draftIds.includes(u.id) ? ' on' : ''}`}
                onClick={() => toggleDraft(u.id)}
              >
                <div className="ava">
                  {u.avatarUrl ? (
                    <img
                      src={u.avatarUrl}
                      alt={u.fullName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    initialsFromName(u.fullName)
                  )}
                </div>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {u.fullName}
                </span>
                <span className="check">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                </span>
              </div>
            ))}
            {!filtered.length && (
              <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--fg-3)' }}>
                {t('crm.projects.list.owner.empty')}
              </div>
            )}
          </div>
          <div className="lv-owner-pop-foot">
            <button type="button" className="lv-tb-btn" onClick={() => setOpen(false)}>
              {t('crm.common.cancel')}
            </button>
            <button
              type="button"
              className="lv-tb-btn"
              style={{ background: '#222', color: '#fff', borderColor: '#222' }}
              onClick={save}
            >
              {t('crm.common.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

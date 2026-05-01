// src/components/crm/OwnerAvatarsRow.tsx
import React from 'react';
import type { StaffUser } from '../../api/staff';
import type { Lead } from '../../api/leads';
import type { Project } from '../../pages/projects/projectTypes';

export function initialsFromName(name: string) {
  const parts = name.split(' ').filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return `${first}${second}`.toUpperCase();
}

export type OwnerDisplayItem = { label: string; avatarUrl?: string | null };

/** Как в ProjectsListPage.resolveOwners — до 3 для стека. */
function uniqueStrings(ids: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const raw of ids) {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

function staffItemsFromIds(ids: string[], staff: StaffUser[], max = 5): OwnerDisplayItem[] {
  if (!ids.length || !staff.length) return [];
  const out: OwnerDisplayItem[] = [];
  for (const id of ids) {
    const u = staff.find((s) => s.id === id);
    if (u) out.push({ label: u.fullName || u.email, avatarUrl: u.avatarUrl });
  }
  return out.slice(0, max);
}

function normalizeOwnerNameToken(raw: string): string {
  const first = raw.split(/[·|]/)[0]?.trim() ?? raw.trim();
  return first;
}

function staffItemsFromNames(names: string[], staff: StaffUser[], max = 5): OwnerDisplayItem[] {
  if (!names.length) return [];
  return names.slice(0, max).map((name) => {
    const token = normalizeOwnerNameToken(name);
    if (!token) return { label: name, avatarUrl: null };
    const lower = token.toLowerCase();
    const u =
      staff.find((s) => s.fullName === token || s.email === token) ||
      staff.find((s) => (s.fullName || '').trim().toLowerCase() === lower) ||
      staff.find((s) => (s.email || '').toLowerCase() === lower);
    if (u) return { label: u.fullName || u.email, avatarUrl: u.avatarUrl };
    return { label: token, avatarUrl: null };
  });
}

export function resolveProjectOwnersDisplay(
  project: Project,
  staff: StaffUser[],
): OwnerDisplayItem[] {
  const cf = project.customFields || {};
  const idList = uniqueStrings([
    ...(project.ownerUserIds ?? []),
    ...(Array.isArray(cf.ownerUserIds) ? (cf.ownerUserIds as unknown[]) : []).map((x) =>
      typeof x === 'string' ? x : '',
    ),
    ...(Array.isArray(cf.assignedUserIds) ? (cf.assignedUserIds as unknown[]) : []).map((x) =>
      typeof x === 'string' ? x : '',
    ),
    project.ownerUserId ?? '',
    typeof cf.ownerUserId === 'string' ? cf.ownerUserId : '',
    typeof cf.assignedUserId === 'string' ? cf.assignedUserId : '',
  ]);

  const fromIds = staffItemsFromIds(idList, staff, 5);
  if (fromIds.length) return fromIds;

  const listFromCf = Array.isArray(cf.assignedToList)
    ? (cf.assignedToList as unknown[])
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
    : [];
  if (listFromCf.length) {
    const fromNames = staffItemsFromNames(listFromCf, staff, 5);
    if (fromNames.some((it) => it.label)) return fromNames;
  }

  const ownerText =
    (typeof project.owner === 'string' && project.owner.trim()) ||
    (typeof cf.ownerName === 'string' && cf.ownerName.trim()) ||
    (typeof cf.owner === 'string' && cf.owner.trim()) ||
    (typeof cf.assignedTo === 'string' && cf.assignedTo.trim()) ||
    '';
  if (!ownerText.trim()) return [];
  const names = ownerText
    .split(/[,;/]+/)
    .map((name) => name.trim())
    .filter(Boolean);
  return staffItemsFromNames(names, staff, 5);
}

/** Для таблицы проектов на карточке компании: проект → лид → ответственные компании. */
export function resolveProjectOwnersWithContext(
  project: Project,
  staff: StaffUser[],
  ctx?: { lead?: Lead | null; companyOwners?: OwnerDisplayItem[] },
): OwnerDisplayItem[] {
  const direct = resolveProjectOwnersDisplay(project, staff);
  if (direct.length) return direct;
  if (ctx?.lead) {
    const fromLead = resolveLeadAssigneesDisplay(ctx.lead, staff);
    if (fromLead.length) return fromLead;
  }
  return ctx?.companyOwners?.length ? ctx.companyOwners : [];
}

/** Как в LeadsListPage.resolveLeadAssignees — для отображения. */
export function resolveLeadAssigneesDisplay(
  lead: Lead,
  staff: StaffUser[],
): OwnerDisplayItem[] {
  const cf = lead.customFields || {};
  const idList = uniqueStrings([
    ...(lead.assignedUserIds ?? []),
    ...(Array.isArray(cf.assignedUserIds) ? (cf.assignedUserIds as unknown[]) : []).map((x) =>
      typeof x === 'string' ? x : '',
    ),
    lead.assignedUserId ?? '',
    typeof cf.assignedUserId === 'string' ? cf.assignedUserId : '',
  ]);

  const fromIds = staffItemsFromIds(idList, staff, 5);
  if (fromIds.length) return fromIds;

  const listFromModel = lead.assignedToList?.filter(Boolean) ?? [];
  const listFromCf = Array.isArray(cf.assignedToList)
    ? (cf.assignedToList as unknown[])
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
    : [];
  const fromAssignedTo =
    (typeof lead.assignedTo === 'string' && lead.assignedTo.trim()
      ? lead.assignedTo.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean)
      : []) ||
    [];
  const fromCfAssignedTo =
    typeof cf.assignedTo === 'string' && cf.assignedTo.trim()
      ? cf.assignedTo.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean)
      : [];
  const names = uniqueStrings([
    ...listFromModel,
    ...listFromCf,
    ...fromAssignedTo,
    ...fromCfAssignedTo,
  ]);
  return staffItemsFromNames(names, staff, 5);
}

export function resolveCompanyAssigneeDisplay(
  company: {
    assignedUserId?: string | null;
    assignedTo?: string | null;
    customFields?: Record<string, any> | null;
  },
  staff: StaffUser[],
): OwnerDisplayItem[] {
  return resolveCompanyOwnersDisplay(company, staff).slice(0, 3);
}

/** Все ответственные компании (в т.ч. из customFields), для таблиц и карточек. */
export function resolveCompanyOwnersDisplay(
  company: {
    assignedUserId?: string | null;
    assignedTo?: string | null;
    customFields?: Record<string, any> | null;
  },
  staff: StaffUser[],
): OwnerDisplayItem[] {
  const cf = company.customFields || {};
  const idList = uniqueStrings([
    ...(Array.isArray(cf.assignedUserIds)
      ? (cf.assignedUserIds as unknown[]).map((x) => (typeof x === 'string' ? x : ''))
      : []),
    company.assignedUserId ?? '',
  ]);

  const fromIds = staffItemsFromIds(idList, staff, 5);
  if (fromIds.length) return fromIds;

  const listFromCf = Array.isArray(cf.assignedToList)
    ? (cf.assignedToList as unknown[])
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
    : [];
  const fromAssignedTo = company.assignedTo?.trim()
    ? company.assignedTo.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const names = uniqueStrings([...listFromCf, ...fromAssignedTo]);
  return staffItemsFromNames(names, staff, 5);
}

export function resolveContactManagerDisplay(
  contact: {
    assignedUserId?: string | null;
    assignedTo?: string | null;
    customFields?: Record<string, any> | null;
  },
  staff: StaffUser[],
): OwnerDisplayItem[] {
  const cf = contact.customFields || {};
  const idList = uniqueStrings([
    ...(Array.isArray(cf.assignedUserIds)
      ? (cf.assignedUserIds as unknown[]).map((x) => (typeof x === 'string' ? x : ''))
      : []),
    contact.assignedUserId ?? '',
  ]);

  const fromIds = staffItemsFromIds(idList, staff, 5);
  if (fromIds.length) return fromIds;

  const listFromCf = Array.isArray(cf.assignedToList)
    ? (cf.assignedToList as unknown[])
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
    : [];
  const fromAssignedTo = contact.assignedTo?.trim()
    ? contact.assignedTo.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const names = uniqueStrings([...listFromCf, ...fromAssignedTo]);
  return staffItemsFromNames(names, staff, 5);
}

type OwnerAvatarsRowProps = {
  items: OwnerDisplayItem[];
  /** Без кнопки «+» (вложенные таблицы). */
  readOnly?: boolean;
  onAddClick?: (e: React.MouseEvent) => void;
  addTitle?: string;
  className?: string;
};

export const OwnerAvatarsRow: React.FC<OwnerAvatarsRowProps> = ({
  items,
  readOnly = true,
  onAddClick,
  addTitle,
  className = '',
}) => (
  <div
    className={`lv-owners justify-center ${className}`.trim()}
    onClick={(e) => e.stopPropagation()}
  >
    {items.map((it, idx) => (
      <div
        key={`${it.label}-${idx}`}
        className={`lv-ava${idx === 0 ? ' dark' : ''}`}
        title={it.label}
      >
        {it.avatarUrl ? (
          <img
            src={it.avatarUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          initialsFromName(it.label)
        )}
      </div>
    ))}
    {!readOnly && onAddClick && (
      <button
        type="button"
        className="lv-owner-add"
        title={addTitle}
        data-lv-owner-popover-anchor
        onClick={onAddClick}
      >
        +
      </button>
    )}
  </div>
);

import type { StaffUser } from '../../api/staff';

/** Сопоставить запись в task.assignees (id или ФИО) с карточкой сотрудника. */
export function resolveStaffForAssigneeEntry(
  staffList: StaffUser[],
  entry: string,
): StaffUser | undefined {
  const e = (entry ?? '').trim();
  if (!e) return undefined;
  const byId = staffList.find((s) => s.id === e);
  if (byId) return byId;
  return staffList.find((s) => s.fullName === e);
}

export function assigneeEntryDisplayLabel(
  staffList: StaffUser[],
  entry: string,
): string {
  const u = resolveStaffForAssigneeEntry(staffList, entry);
  return u?.fullName ?? entry;
}

export function isTaskAssigneeSelected(
  assignees: string[] | undefined,
  user: StaffUser,
): boolean {
  const list = assignees || [];
  return list.some((a) => a === user.id || a === user.fullName);
}

/** Переключить исполнителя; новые записи сохраняются как staff id. */
export function toggleTaskAssigneeIds(
  assignees: string[] | undefined,
  user: StaffUser,
): string[] {
  const cur = [...(assignees || [])];
  if (isTaskAssigneeSelected(cur, user)) {
    return cur.filter((a) => a !== user.id && a !== user.fullName);
  }
  return [...cur, user.id];
}

export function normalizeAssigneesToStaffIds(
  assignees: string[] | undefined,
  staffList: StaffUser[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of assignees || []) {
    const u = resolveStaffForAssigneeEntry(staffList, raw);
    const id = u?.id ?? raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Проверка «текущий пользователь в исполнителях» (для прав редактирования и дашборда). */
export function taskAssigneesMatchNormalizedLabels(
  assignees: string[] | undefined,
  staffList: StaffUser[],
  normalizedLabels: string[],
): boolean {
  return (assignees || []).some((raw) => {
    const n = (raw ?? '').toString().trim().toLowerCase();
    if (normalizedLabels.includes(n)) return true;
    const u = resolveStaffForAssigneeEntry(staffList, raw);
    if (!u) return false;
    return (
      normalizedLabels.includes(u.fullName.trim().toLowerCase()) ||
      (!!u.email &&
        normalizedLabels.includes(u.email.trim().toLowerCase()))
    );
  });
}

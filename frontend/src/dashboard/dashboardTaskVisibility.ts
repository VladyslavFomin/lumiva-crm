/**
 * Видимость задач на дашборде по ролям и иерархии отделов:
 * — owner / admin / superadmin: все задачи;
 * — руководитель отдела (department.managerId = текущий staff): свои + подчинённые (рекурсивно по отделу);
 * — остальные: только задачи, где пользователь в исполнителях.
 */
import type { Department } from '../api/departments';
import { fetchDepartmentStaff, fetchDepartmentsTree } from '../api/departments';
import type { StaffUser } from '../api/staff';

export type DashboardTaskVisibility = 'all' | { matchSet: Set<string> };

export function normKey(s: string): string {
  return s.trim().toLowerCase();
}

function addStaffToMatchSet(set: Set<string>, staff: StaffUser) {
  if (staff.fullName?.trim()) set.add(normKey(staff.fullName));
  if (staff.email?.trim()) set.add(normKey(staff.email));
}

/** Обход дерева: id отделов, где этот сотрудник указан как руководитель */
function collectManagedDepartmentIds(
  nodes: Department[] | undefined,
  managerStaffId: string,
  out: string[],
): void {
  if (!nodes?.length) return;
  for (const d of nodes) {
    if (d.managerId && d.managerId === managerStaffId) {
      out.push(d.id);
    }
    if (d.children?.length) {
      collectManagedDepartmentIds(d.children, managerStaffId, out);
    }
  }
}

export function taskMatchesDashboardVisibility(
  task: { assignees?: string[] },
  visibility: DashboardTaskVisibility,
): boolean {
  if (visibility === 'all') return true;
  const assignees = task.assignees || [];
  if (!assignees.length) return false;
  const set = visibility.matchSet;
  return assignees.some((a) => {
    const n = typeof a === 'string' ? a.trim() : '';
    if (!n) return false;
    return set.has(normKey(n));
  });
}

export async function buildDashboardTaskVisibility(opts: {
  role: string;
  staffId: string | null;
  userEmail: string | null;
  userName: string | null;
  staffList: StaffUser[];
}): Promise<DashboardTaskVisibility> {
  const { role, staffId, userEmail, userName, staffList } = opts;

  if (role === 'owner' || role === 'admin' || role === 'superadmin') {
    return 'all';
  }

  const me =
    (staffId && staffList.find((s) => s.id === staffId)) ||
    (userEmail &&
      staffList.find((s) => normKey(s.email) === normKey(userEmail))) ||
    null;

  const matchSet = new Set<string>();
  if (userName?.trim()) matchSet.add(normKey(userName));
  if (userEmail?.trim()) matchSet.add(normKey(userEmail));
  if (me) addStaffToMatchSet(matchSet, me);

  if (!me?.id) {
    return { matchSet };
  }

  let tree: Department[] = [];
  try {
    tree = await fetchDepartmentsTree();
  } catch {
    tree = [];
  }

  const managedDeptIds: string[] = [];
  collectManagedDepartmentIds(tree, me.id, managedDeptIds);

  if (!managedDeptIds.length) {
    return { matchSet };
  }

  const seenStaffIds = new Set<string>([me.id]);
  const groups = await Promise.all(
    managedDeptIds.map((id) =>
      fetchDepartmentStaff(id).catch(() => [] as StaffUser[]),
    ),
  );

  for (const group of groups) {
    for (const row of group) {
      const u = row as StaffUser;
      if (!u?.id || seenStaffIds.has(u.id)) continue;
      seenStaffIds.add(u.id);
      addStaffToMatchSet(matchSet, u);
    }
  }

  return { matchSet };
}

import type { StaffUser } from '../staff/staff-user.entity';

/**
 * Удаление файлов общего хранилища: владелец или сотрудник ИТ-отдела
 * (по названию отдела в справочнике или строке department).
 */
export function isItDepartmentStaff(staff: StaffUser | null | undefined): boolean {
  if (!staff) return false;
  const deptName = staff.departmentEntity?.name ?? '';
  const legacy = staff.department ?? '';
  const label = `${deptName} ${legacy}`.trim();
  if (!label) return false;
  return (
    /\b(it|technology|technologies|технолог|инфо|информацион|devops|helpdesk|поддержк|системн|digital|цифров|айти)\b/i.test(
      label,
    ) ||
    /(^|\s)ит(\s|$)/i.test(label) ||
    /\bit\b/i.test(label)
  );
}

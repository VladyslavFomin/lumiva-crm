// backend/src/staff/staff-manage-access.ts
// Кто может изменять сотрудников и их права: владелец компании всегда, остальные — только с
// правом «Сотрудники» ('staff' в матрице ролей или индивидуально). Без него сотрудник видит
// список коллег (пикеры «ответственный» и т.п.), но ничего у них не меняет.
//
// Ограничения для не-владельца даже с правом 'staff' — иначе право становится лестницей к
// полному доступу:
//  - нельзя трогать владельца и назначать роль owner;
//  - нельзя менять собственную роль/права (ни свою строку в индивидуальных правах, ни матрицу
//    своей роли) и деактивировать/удалять себя;
//  - нельзя выдать другим право, которого нет у самого себя.
import { ForbiddenException } from '@nestjs/common';
import type { RbacService } from '../rbac/rbac.service';
import type { PermissionKey, RoleMatrix, UserPermissionMatrix } from '../rbac/permission.types';
import type { StaffRole } from './staff-user.entity';

export interface StaffActor {
  tenantId: string;
  role?: string | null;
  staffUserId?: string | null;
}

export const isOwnerActor = (actor: StaffActor) => (actor.role || '').toLowerCase() === 'owner';

export async function canManageStaff(rbac: RbacService, actor: StaffActor): Promise<boolean> {
  if (isOwnerActor(actor)) return true;
  if (!actor.staffUserId) return false;
  return rbac.canForUser(actor.tenantId, actor.staffUserId, (actor.role || 'viewer') as StaffRole, 'staff');
}

export async function assertCanManageStaff(rbac: RbacService, actor: StaffActor): Promise<void> {
  if (!(await canManageStaff(rbac, actor))) {
    throw new ForbiddenException('Изменять сотрудников может только владелец или сотрудник с правом «Сотрудники»');
  }
}

/** Проверки конкретного действия над сотрудником `target` (для владельца — без ограничений). */
export function assertStaffTargetAllowed(
  actor: StaffActor,
  target: { id: string; role: string },
  opts: { newRole?: string | null; selfForbidden?: boolean } = {},
): void {
  if (isOwnerActor(actor)) return;
  if (target.role === 'owner') {
    throw new ForbiddenException('Изменять владельца компании может только он сам');
  }
  if (opts.newRole === 'owner') {
    throw new ForbiddenException('Назначить владельца может только владелец компании');
  }
  if (opts.selfForbidden && actor.staffUserId && target.id === actor.staffUserId) {
    throw new ForbiddenException('Нельзя менять собственную роль или доступ');
  }
}

const sameSet = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((x) => b.includes(x));

async function assertActorHas(rbac: RbacService, actor: StaffActor, perms: Iterable<string>): Promise<void> {
  for (const perm of new Set(perms)) {
    const has = await rbac.canForUser(actor.tenantId, actor.staffUserId || '', (actor.role || 'viewer') as StaffRole, perm as PermissionKey);
    if (!has) {
      throw new ForbiddenException(`Нельзя выдать право, которого нет у вас самих: ${perm}`);
    }
  }
}

/** Матрица ролей сохраняется целиком — сверяем, что именно поменялось. */
export async function assertRoleMatrixChangeAllowed(
  rbac: RbacService,
  actor: StaffActor,
  before: RoleMatrix,
  next: RoleMatrix,
): Promise<void> {
  if (isOwnerActor(actor)) return;
  const roles = new Set([...Object.keys(before), ...Object.keys(next)]) as Set<StaffRole>;
  const granted: string[] = [];
  for (const role of roles) {
    const was = (before[role] || []) as string[];
    const now = (next[role] || []) as string[];
    if (sameSet(was, now)) continue;
    if (role === 'owner') throw new ForbiddenException('Права владельца менять нельзя');
    if (role === actor.role) throw new ForbiddenException('Нельзя менять права собственной роли');
    granted.push(...now.filter((p) => !was.includes(p)));
  }
  await assertActorHas(rbac, actor, granted);
}

/** Индивидуальные права тоже сохраняются целиком по тенанту. */
export async function assertUserMatrixChangeAllowed(
  rbac: RbacService,
  actor: StaffActor,
  before: UserPermissionMatrix,
  next: UserPermissionMatrix,
  roleOfStaff: (staffId: string) => Promise<string | null>,
): Promise<void> {
  if (isOwnerActor(actor)) return;
  const ids = new Set([...Object.keys(before), ...Object.keys(next)]);
  const granted: string[] = [];
  for (const id of ids) {
    const was = before[id] || {};
    const now = next[id] || {};
    const keys = new Set([...Object.keys(was), ...Object.keys(now)]);
    const changed = [...keys].filter((k) => (was as any)[k] !== (now as any)[k]);
    if (!changed.length) continue;
    if (actor.staffUserId && id === actor.staffUserId) {
      throw new ForbiddenException('Нельзя менять собственные права');
    }
    if ((await roleOfStaff(id)) === 'owner') {
      throw new ForbiddenException('Права владельца менять нельзя');
    }
    granted.push(...changed.filter((k) => (now as any)[k] === true));
  }
  await assertActorHas(rbac, actor, granted);
}

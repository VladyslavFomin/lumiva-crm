import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchProjectTableMembers,
  addProjectTableMember,
  updateProjectTableMemberRole,
  removeProjectTableMember,
} from '../../api/projectTables';
import type { ProjectTableMember, ProjectTableRole } from '../../pages/projects/projectTableRole';
import { fetchStaff, type StaffUser } from '../../api/staff';

const ROLES: ProjectTableRole[] = ['owner', 'editor', 'reader'];

function initials(name: string | undefined | null, fallback: string): string {
  const n = (name || '').trim();
  if (!n) return (fallback || '?').slice(0, 1).toUpperCase();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

type Props = {
  tableId: string;
};

/** Управление доступом к приватной таблице — встраивается прямо в окно «Настройки»
 * (не отдельным попапом), чтобы весь доступ к таблице настраивался в одном месте. */
export const ProjectTableMembersSection: React.FC<Props> = ({ tableId }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();

  const [members, setMembers] = useState<ProjectTableMember[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [addStaffId, setAddStaffId] = useState('');
  const [addRole, setAddRole] = useState<ProjectTableRole>('editor');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchProjectTableMembers(tableId).catch(() => [] as ProjectTableMember[]),
      fetchStaff().catch(() => [] as StaffUser[]),
    ])
      .then(([mem, staffList]) => {
        if (!alive) return;
        setMembers(mem);
        setStaff(staffList);
      })
      .catch((e) => console.error('Ошибка загрузки участников таблицы:', e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tableId]);

  const availableStaff = useMemo(
    () => staff.filter((s) => !members.some((m) => m.staffUserId === s.id)),
    [staff, members],
  );
  const ownerCount = useMemo(() => members.filter((m) => m.role === 'owner').length, [members]);

  const addMember = async () => {
    if (!addStaffId) return;
    setAddingMember(true);
    setAddMemberError(null);
    try {
      const created = await addProjectTableMember(tableId, { staffUserId: addStaffId, role: addRole });
      setMembers((prev) => [...prev, created]);
      setAddStaffId('');
      setAddRole('editor');
    } catch (e: any) {
      setAddMemberError(e?.message || String(e));
    } finally {
      setAddingMember(false);
    }
  };

  const changeMemberRole = async (m: ProjectTableMember, role: ProjectTableRole) => {
    setMemberBusyId(m.id);
    try {
      const updated = await updateProjectTableMemberRole(tableId, m.id, role);
      setMembers((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось изменить роль', { title: 'Ошибка', variant: 'error' });
    } finally {
      setMemberBusyId(null);
    }
  };

  const removeMember = async (m: ProjectTableMember) => {
    setMemberBusyId(m.id);
    try {
      await removeProjectTableMember(tableId, m.id);
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось убрать участника', { title: 'Ошибка', variant: 'error' });
    } finally {
      setMemberBusyId(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <div className="text-sm font-semibold text-slate-800">
        {t('crm.projects.viewsBar.share.title', 'Доступ к таблице')}
      </div>
      <div className="text-xs text-slate-600">
        {t(
          'crm.projects.viewsBar.share.hint',
          'Эта таблица приватная — проекты в ней видят только владелец и добавленные сюда сотрудники.',
        )}
      </div>

      {loading ? (
        <div className="text-xs text-slate-400">{t('crm.common.loading', 'Загрузка…')}</div>
      ) : (
        <>
          <div className="space-y-2">
            {members.map((m) => {
              const lastOwner = m.role === 'owner' && ownerCount <= 1;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                    {initials(m.staffUser?.fullName, m.staffUser?.email || '?')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <div className="truncate text-sm text-slate-800">
                      {m.staffUser?.fullName || m.staffUser?.email || '—'}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">{m.staffUser?.email}</div>
                  </span>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                    value={m.role}
                    disabled={memberBusyId === m.id || lastOwner}
                    onChange={(e) => void changeMemberRole(m, e.target.value as ProjectTableRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`crm.projects.viewsBar.share.roles.${r}`, r)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={memberBusyId === m.id || lastOwner}
                    title={lastOwner ? t('crm.projects.viewsBar.share.lastOwnerHint', 'Нужен хотя бы один владелец') : undefined}
                    onClick={() => void removeMember(m)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  >
                    {t('crm.common.remove', 'Убрать')}
                  </button>
                </div>
              );
            })}
            {members.length === 0 && (
              <div className="text-xs text-slate-500 py-2">
                {t('crm.projects.viewsBar.share.noMembers', 'Пока ни с кем не поделились')}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              {t('crm.projects.viewsBar.share.addTitle', 'Добавить сотрудника')}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <select
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                value={addStaffId}
                onChange={(e) => setAddStaffId(e.target.value)}
              >
                <option value="">{t('crm.projects.viewsBar.share.pickStaff', 'Выберите сотрудника')}</option>
                {availableStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.email})
                  </option>
                ))}
              </select>
              <select
                className="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as ProjectTableRole)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`crm.projects.viewsBar.share.roles.${r}`, r)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!addStaffId || addingMember}
                onClick={() => void addMember()}
                className="rounded-xl border border-[#222] bg-[#222] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-40"
              >
                {addingMember ? '…' : t('crm.projects.viewsBar.share.addBtn', 'Добавить')}
              </button>
            </div>
            {availableStaff.length === 0 && staff.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                {t('crm.projects.viewsBar.share.allStaffAdded', 'Все сотрудники уже добавлены')}
              </p>
            )}
            {addMemberError && <p className="mt-2 text-[11px] text-[#9c2338]">{addMemberError}</p>}
          </div>
        </>
      )}
    </div>
  );
};

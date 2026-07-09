// src/pages/departments/DepartmentsPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchDepartmentsTree,
  deleteDepartment,
  type Department,
} from '../../api/departments';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useAlertModal } from '../../contexts/AlertModalContext';

// Функция для получения инициалов
const getInitials = (fullName: string): string => {
  const parts = fullName.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return fullName.substring(0, 2).toUpperCase();
};

/** Менеджер из API отдела — роль строкой; для аватара нужны только имя и фото. */
type StaffAvatarUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
};

// Компонент аватара сотрудника
const StaffAvatar: React.FC<{ staff: StaffAvatarUser }> = ({ staff }) => {
  if (staff.avatarUrl) {
    return (
      <img
        src={staff.avatarUrl}
        alt={staff.fullName}
        className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
        title={staff.fullName}
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white shadow-sm"
      title={staff.fullName}
    >
      {getInitials(staff.fullName)}
    </div>
  );
};

interface DepartmentCardProps {
  department: Department;
  level: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  allStaff: StaffUser[];
  isRoot?: boolean;
}

const DepartmentCard: React.FC<DepartmentCardProps> = ({
  department,
  level,
  onEdit,
  onDelete,
  allStaff,
  isRoot = false,
}) => {
  const { t } = useTranslation();
  const hasChildren = department.children && department.children.length > 0;
  const departmentStaff = allStaff.filter(
    (s) => s.departmentId === department.id && s.isActive,
  );

  return (
    <div className="flex flex-col items-center">
      {/* Карточка отдела */}
      <div className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow min-w-[280px]">
        {/* Название отдела */}
        <div className="text-center mb-3">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            {department.name}
          </h3>
          {!department.isActive && (
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-300">
              {t('crm.departments.inactive')}
            </span>
          )}
        </div>

        {/* Руководитель */}
        {department.manager && (
          <div className="mb-3 pb-3 border-b border-slate-200">
            <div className="text-[10px] text-slate-500 mb-1.5 text-center">
              {t('crm.departments.manager')}
            </div>
            <div className="flex items-center justify-center gap-2">
              <StaffAvatar staff={department.manager} />
              <div className="text-xs text-slate-700 font-medium">
                {department.manager.fullName}
              </div>
            </div>
          </div>
        )}

        {/* Сотрудники отдела */}
        {departmentStaff.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-slate-500 mb-2 text-center">
              {t('crm.departments.staff')} ({departmentStaff.length})
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {departmentStaff.map((staff) => (
                <StaffAvatar key={staff.id} staff={staff} />
              ))}
            </div>
          </div>
        )}

        {/* Пустое состояние для сотрудников */}
        {departmentStaff.length === 0 && (
          <div className="mb-3 text-center">
            <div className="text-[10px] text-slate-400">
              {t('crm.departments.noStaff')}
            </div>
          </div>
        )}

        {/* Действия */}
        <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-200">
          <button
            onClick={() => onEdit(department.id)}
            className="px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors shadow-md border border-slate-700"
            style={{ 
              backgroundColor: '#0f172a',
              minWidth: '80px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f172a'}
          >
            {t('crm.departments.edit')}
          </button>
          {!isRoot && (
            <button
              onClick={() => onDelete(department.id)}
              className="px-4 py-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-semibold"
            >
              {t('crm.departments.delete')}
            </button>
          )}
        </div>
      </div>

      {/* Вертикальная линия вниз к дочерним отделам */}
      {hasChildren && (
        <div className="relative w-full flex justify-center my-2">
          <div className="w-0.5 h-6 bg-slate-300" />
        </div>
      )}
    </div>
  );
};

interface DepartmentLevelProps {
  departments: Department[];
  level: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  allStaff: StaffUser[];
  isRoot?: boolean;
}

const DepartmentLevel: React.FC<DepartmentLevelProps> = ({
  departments,
  level,
  onEdit,
  onDelete,
  allStaff,
  isRoot = false,
}) => {
  if (departments.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Горизонтальная линия для соединения отделов одного уровня */}
      {departments.length > 1 && (
        <div className="relative w-full mb-4" style={{ width: `${departments.length * 320}px`, maxWidth: '100%' }}>
          <div className="absolute left-0 right-0 h-0.5 bg-slate-300 top-1/2" />
          {departments.map((_, idx) => (
            <div
              key={idx}
              className="absolute w-0.5 h-4 bg-slate-300 top-1/2 transform -translate-y-1/2"
              style={{
                left: `${(idx + 0.5) * (100 / departments.length)}%`,
              }}
            />
          ))}
        </div>
      )}

      {/* Карточки отделов */}
      <div className="flex flex-wrap justify-center gap-6">
        {departments.map((dept) => (
          <div key={dept.id} className="flex flex-col items-center">
            <DepartmentCard
              department={dept}
              level={level}
              onEdit={onEdit}
              onDelete={onDelete}
              allStaff={allStaff}
              isRoot={isRoot && level === 0}
            />
            {/* Рекурсивно отображаем дочерние отделы */}
            {dept.children && dept.children.length > 0 && (
              <div className="mt-4">
                <DepartmentLevel
                  departments={dept.children}
                  level={level + 1}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  allStaff={allStaff}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const DepartmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allStaff, setAllStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [depts, staff] = await Promise.all([
        fetchDepartmentsTree(),
        fetchStaff(),
      ]);
      setDepartments(depts);
      setAllStaff(staff);
    } catch (e: any) {
      setError(e.message || t('crm.departments.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => navigate('/app/departments/new');
  const handleEdit = (id: string) => navigate(`/app/departments/${id}`);
  const handleDelete = async (id: string) => {
    if (!confirm(t('crm.departments.deleteConfirm'))) return;
    try {
      await deleteDepartment(id);
      await loadData();
    } catch (err: any) {
      showAlert(err.message || t('crm.departments.errors.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {t('crm.departments.title')}
            </h1>
            <div className="text-[11px] text-slate-600">
              {t('crm.departments.subtitle')}
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="btn-primary btn-secondary-sm"
          >
            + {t('crm.departments.create')}
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Загрузка */}
        {loading && !error && (
          <div className="text-xs text-slate-400">{t('crm.departments.loading')}</div>
        )}

        {/* Пустое состояние */}
        {!loading && !error && departments.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
            <div className="text-sm text-slate-600 mb-2">
              {t('crm.departments.empty')}
            </div>
            <div className="text-xs text-slate-500 mb-4">
              {t('crm.departments.emptyHint')}
            </div>
            <button
              onClick={handleCreate}
              className="btn-primary btn-secondary-sm"
            >
              {t('crm.departments.createFirst')}
            </button>
          </div>
        )}

        {/* Дерево отделов в стиле Битрикс24 */}
        {!loading && !error && departments.length > 0 && (
          <div className="bg-slate-50 rounded-3xl p-8 overflow-x-auto">
            <div className="min-w-max">
              <DepartmentLevel
                departments={departments}
                level={0}
                onEdit={handleEdit}
                onDelete={handleDelete}
                allStaff={allStaff}
                isRoot={true}
              />
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

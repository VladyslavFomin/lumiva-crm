// src/pages/departments/DepartmentFormPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchDepartment,
  fetchDepartments,
  createDepartment,
  updateDepartment,
  type CreateDepartmentDto,
  type UpdateDepartmentDto,
  type Department,
} from '../../api/departments';
import { fetchStaff, updateStaffUser, type StaffUser } from '../../api/staff';

export const DepartmentFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<CreateDepartmentDto>({
    name: '',
    description: '',
    parentId: null,
    managerId: null,
    sortOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    loadInitialData();
    if (id) {
      loadDepartment();
    }
  }, [id]);

  const loadInitialData = async () => {
    try {
      const [depts, staffList] = await Promise.all([
        fetchDepartments(),
        fetchStaff(),
      ]);
      setDepartments(depts);
      setStaff(staffList);
    } catch (e: any) {
      console.error('Failed to load initial data:', e);
    }
  };

  const loadDepartment = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const dept = await fetchDepartment(id);
      setFormData({
        name: dept.name,
        description: dept.description || '',
        parentId: dept.parentId,
        managerId: dept.managerId,
        sortOrder: dept.sortOrder,
        isActive: dept.isActive,
      });
      
      // Загружаем сотрудников отдела
      if (dept.staff && dept.staff.length > 0) {
        setSelectedStaffIds(new Set(dept.staff.map((s) => s.id)));
      }
    } catch (e: any) {
      setError(e.message || t('crm.departments.form.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let departmentId: string;
      
      if (id) {
        await updateDepartment(id, formData as UpdateDepartmentDto);
        departmentId = id;
      } else {
        const newDept = await createDepartment(formData);
        departmentId = newDept.id;
      }

      // Обновляем назначение сотрудников в отдел
      // Сначала убираем всех сотрудников из этого отдела
      const allStaffInThisDept = staff.filter(
        (s) => s.departmentId === departmentId
      );
      for (const staffMember of allStaffInThisDept) {
        if (!selectedStaffIds.has(staffMember.id)) {
          await updateStaffUser(staffMember.id, { departmentId: null });
        }
      }

      // Затем назначаем выбранных сотрудников в отдел
      for (const staffId of selectedStaffIds) {
        await updateStaffUser(staffId, { departmentId });
      }

      navigate('/app/departments');
    } catch (err: any) {
      setError(err.message || t('crm.departments.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CreateDepartmentDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Фильтруем отделы, исключая текущий (чтобы не создать цикл)
  const availableDepartments = departments.filter((d) => d.id !== id);

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-slate-400">
          {t('crm.common.loading')}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {id
                ? t('crm.departments.form.titleEdit')
                : t('crm.departments.form.titleNew')}
            </h1>
            <div className="text-[11px] text-slate-600">
              {t('crm.departments.form.subtitle')}
            </div>
          </div>
          <button
            onClick={() => navigate('/app/departments')}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors"
          >
            {t('crm.common.cancel')}
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-4">
            <h2 className="text-xs font-semibold text-slate-900 mb-3">
              {t('crm.departments.form.sections.basic')}
            </h2>

            <div>
              <label className="block text-[11px] text-slate-700 mb-1.5">
                {t('crm.departments.form.fields.name')}
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder={t('crm.departments.form.fields.namePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-700 mb-1.5">
                {t('crm.departments.form.fields.description')}
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none"
                placeholder={t('crm.departments.form.fields.descriptionPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-700 mb-1.5">
                {t('crm.departments.form.fields.parent')}
              </label>
              <select
                value={formData.parentId || ''}
                onChange={(e) =>
                  handleChange('parentId', e.target.value || null)
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
              >
                <option value="">
                  {t('crm.departments.form.fields.parentNone')}
                </option>
                {availableDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-slate-600 mt-1">
                {t('crm.departments.form.hints.parent')}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-700 mb-1.5">
                {t('crm.departments.form.fields.manager')}
              </label>
              <select
                value={formData.managerId || ''}
                onChange={(e) =>
                  handleChange('managerId', e.target.value || null)
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
              >
                <option value="">
                  {t('crm.departments.form.fields.managerNone')}
                </option>
                {staff
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.role})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-700 mb-1.5">
                {t('crm.departments.form.fields.staff')}
              </label>
              <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-xl bg-white p-2">
                {staff
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStaffIds.has(s.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedStaffIds);
                          if (e.target.checked) {
                            newSet.add(s.id);
                          } else {
                            newSet.delete(s.id);
                          }
                          setSelectedStaffIds(newSet);
                        }}
                        className="w-4 h-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                      />
                      <span className="text-xs text-slate-900">
                        {s.fullName} ({s.role})
                      </span>
                    </label>
                  ))}
                {staff.filter((s) => s.isActive).length === 0 && (
                  <div className="text-xs text-slate-500 p-2 text-center">
                    {t('crm.departments.form.fields.noStaffAvailable')}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-slate-600 mt-1">
                {t('crm.departments.form.hints.staff')}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-700 mb-1.5">
                {t('crm.departments.form.fields.sortOrder')}
              </label>
              <input
                type="number"
                min="0"
                value={formData.sortOrder}
                onChange={(e) =>
                  handleChange('sortOrder', parseInt(e.target.value) || 0)
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="block text-[11px] text-slate-700 mb-1.5">
                  {t('crm.departments.form.fields.isActive')}
                </label>
                <div className="text-[10px] text-slate-600">
                  {t('crm.departments.form.hints.active')}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive !== false}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/departments')}
              className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 transition-colors"
            >
              {t('crm.common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md border border-slate-700"
              style={{ 
                backgroundColor: '#0f172a',
                minWidth: '100px'
              }}
              onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = '#1e293b')}
              onMouseLeave={(e) => !saving && (e.currentTarget.style.backgroundColor = '#0f172a')}
            >
              {saving
                ? t('crm.common.saving')
                : id
                  ? t('crm.departments.form.actions.save')
                  : t('crm.departments.form.actions.create')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};


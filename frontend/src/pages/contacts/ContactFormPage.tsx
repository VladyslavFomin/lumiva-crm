// src/pages/contacts/ContactFormPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchContact, createContact, updateContact, type CreateContactDto } from '../../api/contacts';
import { CompanySelect } from '../../components/CompanySelect';
import { fetchStaff, type StaffUser } from '../../api/staff';

const COUNTRY_OPTIONS: Array<{ code: string; name: string }> = [
  { code: 'TR', name: 'Turkey' },
  { code: 'RU', name: 'Russia' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'TJ', name: 'Tajikistan' },
];

export const ContactFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  const [formData, setFormData] = useState<CreateContactDto>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    country: '',
    city: '',
    address: '',
    status: 'active',
  });

  useEffect(() => {
    let alive = true;
    fetchStaff()
      .then((items) => {
        if (!alive) return;
        setStaff(items.filter((user) => user.isActive));
      })
      .catch((e) => console.error('Ошибка загрузки сотрудников:', e));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchContact(id)
        .then((contact) => {
          const fromCustom = Array.isArray(contact.customFields?.assignedUserIds)
            ? contact.customFields.assignedUserIds
            : [];
          const normalizedIds = fromCustom.filter(
            (value: unknown): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          );
          setAssignedUserIds(
            normalizedIds.length
              ? normalizedIds
              : contact.assignedUserId
                ? [contact.assignedUserId]
                : [],
          );
          setFormData({
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            email: contact.email || '',
            phone: contact.phone || '',
            company: contact.company || '',
            companyId: contact.companyId || '',
            position: contact.position || '',
            country: contact.country || '',
            city: contact.city || '',
            address: contact.address || '',
            status: contact.status || 'active',
            assignedUserId: contact.assignedUserId || undefined,
            assignedTo: contact.assignedTo || undefined,
            customFields: contact.customFields || {},
          });
        })
        .catch((e) => {
          setError(e.message || t('crm.contacts.form.errors.loadFailed'));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  const ownerDepartmentGroups = useMemo(() => {
    const groups = new Map<string, StaffUser[]>();
    staff.forEach((user) => {
      const key = (user.department || '').trim() || 'Без отдела';
      const list = groups.get(key) || [];
      list.push(user);
      groups.set(key, list);
    });
    return Array.from(groups.entries())
      .map(([department, users]) => ({
        department,
        users: users.slice().sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email)),
      }))
      .sort((a, b) => {
        if (a.department === 'Без отдела') return 1;
        if (b.department === 'Без отдела') return -1;
        return a.department.localeCompare(b.department, 'ru');
      });
  }, [staff]);
  const assignedNames = useMemo(
    () =>
      staff
        .filter((user) => assignedUserIds.includes(user.id))
        .map((user) => user.fullName || user.email),
    [assignedUserIds, staff],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const normalizedCountry = (formData.country || '').trim().toUpperCase();
      const payload: CreateContactDto = {
        ...formData,
        country: normalizedCountry.length === 2 ? normalizedCountry : '',
        city: (formData.city || '').trim(),
        assignedUserId: assignedUserIds[0] || undefined,
        assignedTo: assignedNames.length ? assignedNames.join(', ') : undefined,
        customFields: {
          ...(formData.customFields || {}),
          assignedUserIds,
          assignedToList: assignedNames,
        },
      };

      if (id) {
        await updateContact(id, payload);
      } else {
        await createContact(payload);
      }
      navigate('/contacts');
    } catch (err: any) {
      setError(err.message || t('crm.contacts.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CreateContactDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const toggleOwnerUser = (userId: string, checked: boolean) => {
    setAssignedUserIds((prev) =>
      checked ? Array.from(new Set([...prev, userId])) : prev.filter((id) => id !== userId),
    );
  };
  const toggleOwnerDepartment = (department: string, checked: boolean) => {
    const group = ownerDepartmentGroups.find((item) => item.department === department);
    if (!group) return;
    const ids = group.users.map((user) => user.id);
    setAssignedUserIds((prev) =>
      checked
        ? Array.from(new Set([...prev, ...ids]))
        : prev.filter((id) => !ids.includes(id)),
    );
  };

  const labelClassName = 'block text-[11px] font-medium text-slate-600 mb-1.5';
  const inputClassName =
    'w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors';
  const sectionClassName =
    'bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_8px_24px_rgba(15,23,42,0.08)]';

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-slate-400">{t('crm.common.loading')}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 md:px-6 md:py-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Lumiva CRM
              </div>
              <h1 className="mt-2 text-xl font-semibold text-slate-900">
                {id ? t('crm.contacts.form.titleEdit') : t('crm.contacts.form.titleNew')}
              </h1>
              <div className="mt-1 text-xs text-slate-500">{t('crm.contacts.form.subtitle')}</div>
            </div>
            <button
              onClick={() => navigate('/contacts')}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors"
            >
              {t('crm.common.cancel')}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Контактные данные</h2>
            <div className="text-xs text-slate-500">Заполните ключевые поля для карточки клиента</div>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={sectionClassName}>
            <h3 className="text-sm font-semibold text-slate-800 mb-4">{t('crm.contacts.form.sections.basic')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <div>
                <label className={labelClassName}>{t('crm.contacts.form.fields.firstName')}</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className={inputClassName}
                />
              </div>

              <div>
                <label className={labelClassName}>{t('crm.contacts.form.fields.lastName')}</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className={inputClassName}
                />
              </div>

              <div>
                <label className={labelClassName}>{t('crm.contacts.form.fields.email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={inputClassName}
                />
              </div>

              <div>
                <label className={labelClassName}>{t('crm.contacts.form.fields.phone')}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className={inputClassName}
                />
              </div>

              <div>
                <label className={labelClassName}>{t('crm.contacts.form.fields.company')}</label>
                <CompanySelect
                  value={formData.companyId || null}
                  onChange={(companyId, company) => {
                    handleChange('companyId', companyId || '');
                    handleChange('company', company?.name || '');
                  }}
                  placeholder={t('crm.contacts.form.fields.companyPlaceholder')}
                  className="w-full"
                  allowCreate={true}
                  theme="light"
                />
              </div>

              <div>
                <label className={labelClassName}>{t('crm.contacts.form.fields.position')}</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                  className={inputClassName}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClassName}>Ответственные по отделам</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] text-slate-600">Выбор сотрудников</div>
                    <div className="text-[11px] text-slate-500">
                      Выбрано: {assignedUserIds.length}
                    </div>
                  </div>
                  <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                    {ownerDepartmentGroups.map((group) => {
                      const ids = group.users.map((user) => user.id);
                      const selectedInGroup = ids.filter((id) => assignedUserIds.includes(id)).length;
                      const allChecked = selectedInGroup > 0 && selectedInGroup === ids.length;
                      return (
                        <div
                          key={group.department}
                          className="rounded-lg border border-slate-200 bg-white p-2"
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <div className="truncate text-[11px] font-semibold text-slate-700">
                              {group.department}
                            </div>
                            <label className="flex items-center gap-1 text-[10px] text-slate-500">
                              <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={(e) =>
                                  toggleOwnerDepartment(group.department, e.target.checked)
                                }
                              />
                              Весь отдел
                            </label>
                          </div>
                          <div className="space-y-1">
                            {group.users.map((user) => {
                              const checked = assignedUserIds.includes(user.id);
                              return (
                                <label
                                  key={user.id}
                                  className="flex items-center gap-2 text-[11px] text-slate-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => toggleOwnerUser(user.id, e.target.checked)}
                                  />
                                  <span className="truncate">
                                    {user.fullName || user.email}
                                    {user.email ? ` · ${user.email}` : ''}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {assignedNames.length > 0 && (
                    <div className="mt-2 text-[11px] text-slate-600">
                      {assignedNames.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClassName}>{t('crm.contacts.form.fields.country')}</label>
                <select
                  value={
                    (formData.country || '').trim().length === 2
                      ? (formData.country || '').trim().toUpperCase()
                      : ''
                  }
                  onChange={(e) => handleChange('country', e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Выберите страну</option>
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name} ({country.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName}>{t('crm.contacts.form.fields.city')}</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <div>
              <label className={labelClassName}>{t('crm.contacts.form.fields.address')}</label>
              <textarea
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                rows={2}
                className={`${inputClassName} min-h-[88px] resize-y`}
              />
            </div>

            <div>
              <label className={labelClassName}>{t('crm.common.status')}</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className={inputClassName}
              >
                <option value="active">{t('crm.common.statusOptions.active')}</option>
                <option value="inactive">{t('crm.common.statusOptions.inactive')}</option>
                <option value="archived">{t('crm.common.statusOptions.archived')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/contacts')}
              className="px-4 py-2.5 text-xs rounded-xl border border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-xs rounded-xl bg-[#222222] text-white font-semibold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('crm.common.saving') : id ? t('crm.contacts.form.actions.save') : t('crm.contacts.form.actions.create')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};




// src/pages/contacts/ContactFormPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchContact, createContact, updateContact, type CreateContactDto } from '../../api/contacts';
import { CompanySelect } from '../../components/CompanySelect';
import { fetchStaff, type StaffUser } from '../../api/staff';

const INK = '#222';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

const inpCls =
  'w-full px-3 py-2.5 text-[13px] rounded-[10px] border border-[#e7e7e7] bg-white outline-none focus:border-[#222] transition-colors placeholder:text-[#b5b5b5] text-[#222]';
const lblCls =
  'block text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5 text-[#888]';

const COUNTRY_OPTIONS = [
  { code: 'TR', name: 'Turkey' },
  { code: 'RU', name: 'Russia' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AE', name: 'UAE' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'UZ', name: 'Uzbekistan' },
];

export const ContactFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id;
  const prefilledCompanyId = searchParams.get('companyId') || '';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [passport, setPassport] = useState('');

  const [form, setForm] = useState<CreateContactDto>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    companyId: prefilledCompanyId,
    position: '',
    country: '',
    city: '',
    address: '',
    status: 'active',
  });

  useEffect(() => {
    let alive = true;
    fetchStaff()
      .then((items) => { if (alive) setStaff(items.filter((u) => u.isActive)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchContact(id)
      .then((c) => {
        const fromCustom = Array.isArray(c.customFields?.assignedUserIds)
          ? c.customFields.assignedUserIds
          : [];
        const ids = fromCustom.filter(
          (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0,
        );
        setAssignedUserIds(ids.length ? ids : c.assignedUserId ? [c.assignedUserId] : []);
        setPassport(typeof c.customFields?.passport === 'string' ? c.customFields.passport : '');
        setForm({
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          email: c.email || '',
          phone: c.phone || '',
          company: c.company || '',
          companyId: c.companyId || '',
          position: c.position || '',
          country: c.country || '',
          city: c.city || '',
          address: c.address || '',
          status: c.status || 'active',
          assignedUserId: c.assignedUserId || undefined,
          customFields: c.customFields || {},
        });
      })
      .catch((e) => setError(e.message || t('crm.contacts.form.errors.loadFailed')))
      .finally(() => setLoading(false));
  }, [id]);

  const ownerGroups = useMemo(() => {
    const groups = new Map<string, StaffUser[]>();
    staff.forEach((u) => {
      const key = (u.department || '').trim() || 'Без отдела';
      groups.set(key, [...(groups.get(key) || []), u]);
    });
    return Array.from(groups.entries())
      .map(([dept, users]) => ({
        dept,
        users: users.sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email)),
      }))
      .sort((a, b) => {
        if (a.dept === 'Без отдела') return 1;
        if (b.dept === 'Без отдела') return -1;
        return a.dept.localeCompare(b.dept, 'ru');
      });
  }, [staff]);

  const assignedNames = useMemo(
    () => staff.filter((u) => assignedUserIds.includes(u.id)).map((u) => u.fullName || u.email),
    [assignedUserIds, staff],
  );

  const set = (field: keyof CreateContactDto, value: any) =>
    setForm((p) => ({ ...p, [field]: value }));

  const toggleUser = (userId: string, checked: boolean) =>
    setAssignedUserIds((prev) =>
      checked ? Array.from(new Set([...prev, userId])) : prev.filter((x) => x !== userId),
    );

  const toggleDept = (dept: string, checked: boolean) => {
    const group = ownerGroups.find((g) => g.dept === dept);
    if (!group) return;
    const ids = group.users.map((u) => u.id);
    setAssignedUserIds((prev) =>
      checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((x) => !ids.includes(x)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const normalizedCountry = (form.country || '').trim().toUpperCase();
      const payload: CreateContactDto = {
        ...form,
        companyId: form.companyId || undefined,
        country: normalizedCountry.length === 2 ? normalizedCountry : '',
        city: (form.city || '').trim(),
        assignedUserId: assignedUserIds[0] || undefined,
        assignedTo: assignedNames.length ? assignedNames.join(', ') : undefined,
        customFields: {
          ...(form.customFields || {}),
          assignedUserIds,
          assignedToList: assignedNames,
          passport: passport.trim() || undefined,
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

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ');

  if (loading) {
    return (
      <MainLayout>
        <div className="py-16 text-center text-[13px]" style={{ color: FG4 }}>
          {t('crm.common.loading')}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="contacts" />
      <div style={{ color: INK }}>
        {/* ── Header ───────────────────────────────────────────── */}
        <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 20, marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => navigate('/contacts')}
            style={{ fontSize: 11, color: FG3, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← {t('crm.contacts.list.title', { defaultValue: 'Контакты' })}
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: FG4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {isNew ? 'Новый контакт' : `Контакт · ${String(id).slice(0, 8).toUpperCase()}`}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: INK, marginTop: 6, lineHeight: 1.1 }}>
                {fullName || (isNew ? 'Имя контакта' : '—')}
              </h1>
              {form.position && (
                <div style={{ marginTop: 6, fontSize: 13, color: FG3 }}>{form.position}</div>
              )}
              {isNew && !prefilledCompanyId && (
                <div style={{ marginTop: 8, fontSize: 12, color: FG3, maxWidth: 480 }}>
                  {t('crm.contacts.form.newColdStartHint', {
                    defaultValue:
                      'Обычно контакт создаётся автоматически при конвертации лида в клиента. Создавайте вручную, если работа уже началась без лида.',
                  })}
                </div>
              )}
            </div>
            <button
              type="submit"
              form="contact-form"
              disabled={saving}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer', opacity: saving ? 0.65 : 1, alignSelf: 'flex-start', marginTop: 16 }}
            >
              {saving ? t('crm.common.saving') : isNew ? t('crm.contacts.form.actions.create') : t('crm.contacts.form.actions.save')}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, border: '1px solid #f0c8cf', background: '#fbecef', fontSize: 12, color: '#9a1f31' }}>
            {error}
          </div>
        )}

        <form id="contact-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">

            {/* ── Left: main fields ────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* First + Last name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.contacts.form.fields.firstName')}</label>
                  <input className={inpCls} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Иван" />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.contacts.form.fields.lastName')}</label>
                  <input className={inpCls} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Иванов" />
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.contacts.form.fields.email')}</label>
                  <input type="email" className={inpCls} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="ivan@..." />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.contacts.form.fields.phone')}</label>
                  <input type="tel" className={inpCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+7 900..." />
                </div>
              </div>

              {/* Company */}
              <div>
                <label className={lblCls}>{t('crm.contacts.form.fields.company')}</label>
                <CompanySelect
                  value={form.companyId || null}
                  onChange={(companyId, company) => {
                    set('companyId', companyId || '');
                    set('company', company?.name || '');
                  }}
                  placeholder={t('crm.contacts.form.fields.companyPlaceholder')}
                  className="w-full"
                  allowCreate={true}
                  theme="light"
                />
              </div>

              {/* Position */}
              <div>
                <label className={lblCls}>{t('crm.contacts.form.fields.position')}</label>
                <input className={inpCls} value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="CEO, Директор..." />
              </div>

              {/* City + Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.contacts.form.fields.city')}</label>
                  <input className={inpCls} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Москва" />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.contacts.form.fields.country')}</label>
                  <select
                    className={inpCls}
                    value={(form.country || '').trim().length === 2 ? form.country!.trim().toUpperCase() : ''}
                    onChange={(e) => set('country', e.target.value)}
                  >
                    <option value="">— Выберите</option>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className={lblCls}>{t('crm.contacts.form.fields.address')}</label>
                <textarea
                  className={inpCls}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Passport / ID */}
              <div>
                <label className={lblCls}>{t('crm.contacts.form.fields.passport')}</label>
                <input className={inpCls} value={passport} onChange={(e) => setPassport(e.target.value)} placeholder={t('crm.contacts.form.fields.passportPlaceholder')} />
                <p className="mt-1 text-[11px]" style={{ color: FG3 }}>{t('crm.contacts.form.fields.passportHint')}</p>
              </div>
            </div>

            {/* ── Right sidebar ─────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Status */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, background: BG_MUTED }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 12 }}>
                  {t('crm.common.status')}
                </div>
                <select className={inpCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="active">{t('crm.common.statusOptions.active')}</option>
                  <option value="inactive">{t('crm.common.statusOptions.inactive')}</option>
                  <option value="archived">{t('crm.common.statusOptions.archived')}</option>
                </select>
              </div>

              {/* Assignees */}
              {ownerGroups.length > 0 && (
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, background: BG_MUTED }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
                      Ответственные
                    </div>
                    {assignedUserIds.length > 0 && (
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: FG3 }}>
                        {assignedUserIds.length}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                    {ownerGroups.map((group) => {
                      const ids = group.users.map((u) => u.id);
                      const selCount = ids.filter((x) => assignedUserIds.includes(x)).length;
                      const allChecked = selCount > 0 && selCount === ids.length;
                      return (
                        <div key={group.dept} style={{ borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', padding: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: INK }}>{group.dept}</span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: FG3, cursor: 'pointer' }}>
                              <input type="checkbox" checked={allChecked} onChange={(e) => toggleDept(group.dept, e.target.checked)} />
                              Весь отдел
                            </label>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {group.users.map((u) => (
                              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#444', cursor: 'pointer' }}>
                                <input type="checkbox" checked={assignedUserIds.includes(u.id)} onChange={(e) => toggleUser(u.id, e.target.checked)} />
                                {u.fullName || u.email}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {assignedNames.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: FG3 }}>{assignedNames.join(', ')}</div>
                  )}
                </div>
              )}

              {/* ID (edit only) */}
              {!isNew && (
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 10 }}>
                    ID контакта
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: FG3, wordBreak: 'break-all' }}>
                    {id}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};

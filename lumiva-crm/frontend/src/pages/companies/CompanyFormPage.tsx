// src/pages/companies/CompanyFormPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchCompany, createCompany, updateCompany, type CreateCompanyDto } from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { LegalRequisitesEditor } from '../../legal/LegalRequisitesEditor';
import type { LegalRequisiteItem } from '../../legal/legalRequisites';

const INK = '#222';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

const inpCls =
  'w-full px-3 py-2.5 text-[13px] rounded-[10px] border border-[#e7e7e7] bg-white outline-none focus:border-[#222] transition-colors placeholder:text-[#b5b5b5] text-[#222]';
const lblCls =
  'block text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5 text-[#888]';

const INDUSTRY_OPTIONS = [
  'Финансы', 'Инвестиции', 'Недвижимость', 'IT / Технологии',
  'Консалтинг', 'Торговля', 'Производство', 'Логистика',
  'Образование', 'Медицина', 'Юридические услуги', 'Другое',
];

export const CompanyFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignedUserId, setAssignedUserId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [legalRequisites, setLegalRequisites] = useState<LegalRequisiteItem[]>([]);

  const [form, setForm] = useState<CreateCompanyDto>({
    name: '',
    legalName: '',
    taxId: '',
    email: '',
    phone: '',
    website: '',
    country: '',
    city: '',
    address: '',
    industry: '',
    size: '',
    status: 'active',
    description: '',
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
    fetchCompany(id)
      .then((c) => {
        setForm({
          name: c.name,
          legalName: c.legalName || '',
          taxId: c.taxId || '',
          email: c.email || '',
          phone: c.phone || '',
          website: c.website || '',
          country: c.country || '',
          city: c.city || '',
          address: c.address || '',
          industry: c.industry || '',
          size: c.size || '',
          status: c.status || 'active',
          description: (c as any).description || '',
        });
        if (c.assignedUserId) setAssignedUserId(c.assignedUserId);
        if (c.assignedTo) setAssignedTo(c.assignedTo);
        setLegalRequisites(c.legalRequisites || []);
      })
      .catch((e) => setError(e.message || t('crm.companies.form.errors.loadFailed')))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field: keyof CreateCompanyDto, value: any) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t('crm.companies.form.errors.nameRequired')); return; }
    setSaving(true);
    setError(null);
    try {
      const staffMember = staff.find((u) => u.id === assignedUserId);
      const payload = {
        ...form,
        assignedUserId: assignedUserId || undefined,
        assignedTo: staffMember?.fullName || staffMember?.email || assignedTo || undefined,
        legalRequisites,
      };
      if (id) {
        await updateCompany(id, payload);
      } else {
        await createCompany(payload);
      }
      navigate('/companies');
    } catch (err: any) {
      setError(err.message || t('crm.companies.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

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
      <PageHelpButton topic="companies" />
      <div style={{ color: INK }}>
        {/* ── Header ────────────────────────────────────────────── */}
        <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 20, marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => navigate('/companies')}
            style={{ fontSize: 11, color: FG3, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← {t('crm.companies.list.title')}
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: FG4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {isNew ? 'Новая компания' : `Компания · ${String(id).slice(0, 8).toUpperCase()}`}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: INK, marginTop: 6, lineHeight: 1.1 }}>
                {form.name.trim() || (isNew ? 'Название компании' : '—')}
              </h1>
              {isNew && (
                <div style={{ marginTop: 8, fontSize: 12, color: FG3, maxWidth: 480 }}>
                  {t('crm.companies.form.newColdStartHint', {
                    defaultValue:
                      'Обычно компания появляется автоматически при конвертации лида в клиента. Создавайте вручную, если работа уже началась без лида.',
                  })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isNew && (
                <button
                  type="button"
                  onClick={() => navigate(`/companies/${id}/tasks`)}
                  style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
                >
                  {t('crm.companies.list.tasks')}
                </button>
              )}
              <button
                type="submit"
                form="company-form"
                disabled={saving}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer', opacity: saving ? 0.65 : 1 }}
              >
                {saving ? t('crm.common.saving') : isNew ? t('crm.companies.form.actions.create') : t('crm.companies.form.actions.save')}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, border: '1px solid #f0c8cf', background: '#fbecef', fontSize: 12, color: '#9a1f31' }}>
            {error}
          </div>
        )}

        <form id="company-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">

            {/* ── Left: main fields ─────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Name */}
              <div>
                <label className={lblCls}>{t('crm.companies.form.fields.name')} *</label>
                <input
                  className={inpCls}
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="ООО Ромашка"
                  required
                />
              </div>

              {/* Legal name + Tax ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.companies.form.fields.legalName')}</label>
                  <input className={inpCls} value={form.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder={t('crm.companies.form.fields.legalNamePlaceholder')} />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.companies.form.fields.taxId')}</label>
                  <input className={inpCls} value={form.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder={t('crm.companies.form.fields.taxIdPlaceholder')} />
                  <p className="mt-1 text-[11px]" style={{ color: FG3 }}>{t('crm.companies.form.fields.taxIdHint')}</p>
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.companies.form.fields.email')}</label>
                  <input type="email" className={inpCls} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="info@company.com" />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.companies.form.fields.phone')}</label>
                  <input type="tel" className={inpCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+7 900 000-00-00" />
                </div>
              </div>

              {/* Website + Industry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.companies.form.fields.website')}</label>
                  <input type="url" className={inpCls} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.companies.form.fields.industry')}</label>
                  <select className={inpCls} value={form.industry} onChange={(e) => set('industry', e.target.value)}>
                    <option value="">— Выберите</option>
                    {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* City + Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.companies.form.fields.city')}</label>
                  <input className={inpCls} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Москва" />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.companies.form.fields.country')}</label>
                  <input className={inpCls} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Россия" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={lblCls}>Описание</label>
                <textarea
                  className={inpCls}
                  value={(form as any).description || ''}
                  onChange={(e) => set('description' as any, e.target.value)}
                  rows={3}
                  placeholder="Кратко о компании, сфере деятельности..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Address */}
              <div>
                <label className={lblCls}>{t('crm.companies.form.fields.address')}</label>
                <textarea
                  className={inpCls}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Реквизиты и юр. данные */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <label className={lblCls}>{t('crm.companies.form.fields.legalRequisites')}</label>
                <LegalRequisitesEditor
                  value={legalRequisites}
                  onChange={setLegalRequisites}
                  hint={t('crm.companies.form.fields.legalRequisitesHint')}
                />
              </div>
            </div>

            {/* ── Right sidebar ──────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Status */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, background: BG_MUTED }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 12 }}>
                  {t('crm.common.status')}
                </div>
                <select
                  className={inpCls}
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                >
                  <option value="active">{t('crm.common.statusOptions.active')}</option>
                  <option value="inactive">{t('crm.common.statusOptions.inactive')}</option>
                  <option value="archived">{t('crm.common.statusOptions.archived')}</option>
                </select>
              </div>

              {/* Size */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, background: BG_MUTED }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 12 }}>
                  {t('crm.companies.form.fields.size')}
                </div>
                <select className={inpCls} value={form.size} onChange={(e) => set('size', e.target.value)}>
                  <option value="">{t('crm.companies.form.fields.sizePlaceholder')}</option>
                  <option value="1-10">{t('crm.companies.form.sizeOptions.1-10')}</option>
                  <option value="11-50">{t('crm.companies.form.sizeOptions.11-50')}</option>
                  <option value="51-200">{t('crm.companies.form.sizeOptions.51-200')}</option>
                  <option value="201-500">{t('crm.companies.form.sizeOptions.201-500')}</option>
                  <option value="500+">{t('crm.companies.form.sizeOptions.500+')}</option>
                </select>
              </div>

              {/* Assignee */}
              {staff.length > 0 && (
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, background: BG_MUTED }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 12 }}>
                    Ответственный
                  </div>
                  <select
                    className={inpCls}
                    value={assignedUserId}
                    onChange={(e) => {
                      setAssignedUserId(e.target.value);
                      const u = staff.find((s) => s.id === e.target.value);
                      setAssignedTo(u?.fullName || u?.email || '');
                    }}
                  >
                    <option value="">— Не назначен</option>
                    {staff.map((u) => (
                      <option key={u.id} value={u.id}>{u.fullName || u.email}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dates (edit only) */}
              {!isNew && (
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 10 }}>
                    ID компании
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

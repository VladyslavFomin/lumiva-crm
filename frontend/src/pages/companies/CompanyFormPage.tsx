// src/pages/companies/CompanyFormPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchCompany, createCompany, updateCompany, type CreateCompanyDto } from '../../api/companies';

export const CompanyFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateCompanyDto>({
    name: '',
    email: '',
    phone: '',
    website: '',
    country: '',
    city: '',
    address: '',
    industry: '',
    size: '',
    status: 'active',
  });

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchCompany(id)
        .then((company) => {
          setFormData({
            name: company.name,
            email: company.email || '',
            phone: company.phone || '',
            website: company.website || '',
            country: company.country || '',
            city: company.city || '',
            address: company.address || '',
            industry: company.industry || '',
            size: company.size || '',
            status: company.status || 'active',
          });
        })
        .catch((e) => {
          setError(e.message || t('crm.companies.form.errors.loadFailed'));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (id) {
        await updateCompany(id, formData);
      } else {
        await createCompany(formData);
      }
      navigate('/companies');
    } catch (err: any) {
      setError(err.message || t('crm.companies.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CreateCompanyDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-slate-400">{t('crm.common.loading')}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              {id ? t('crm.companies.form.titleEdit') : t('crm.companies.form.titleNew')}
            </h1>
            <div className="text-[11px] text-slate-500">{t('crm.companies.form.subtitle')}</div>
          </div>
          <div className="flex gap-2">
            {id && (
              <button
                onClick={() => navigate(`/companies/${id}/tasks`)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-400 hover:text-slate-50 transition-colors"
              >
                {t('crm.companies.list.tasks')}
              </button>
            )}
            <button
              onClick={() => navigate('/companies')}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-50 transition-colors"
            >
              {t('crm.common.cancel')}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            <h2 className="text-xs font-semibold text-slate-300 mb-3">{t('crm.companies.form.sections.basic')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.companies.form.fields.name')}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.companies.form.fields.email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.companies.form.fields.phone')}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.companies.form.fields.website')}</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.companies.form.fields.industry')}</label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => handleChange('industry', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.companies.form.fields.size')}</label>
                <select
                  value={formData.size}
                  onChange={(e) => handleChange('size', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                >
                  <option value="">{t('crm.companies.form.fields.sizePlaceholder')}</option>
                  <option value="1-10">{t('crm.companies.form.sizeOptions.1-10')}</option>
                  <option value="11-50">{t('crm.companies.form.sizeOptions.11-50')}</option>
                  <option value="51-200">{t('crm.companies.form.sizeOptions.51-200')}</option>
                  <option value="201-500">{t('crm.companies.form.sizeOptions.201-500')}</option>
                  <option value="500+">{t('crm.companies.form.sizeOptions.500+')}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.companies.form.fields.country')}</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.companies.form.fields.city')}</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('crm.companies.form.fields.address')}</label>
              <textarea
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                rows={2}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('crm.common.status')}</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              onClick={() => navigate('/companies')}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-50 transition-colors"
            >
              {t('crm.common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('crm.common.saving') : id ? t('crm.companies.form.actions.save') : t('crm.companies.form.actions.create')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};




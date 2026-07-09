// src/pages/settings/AppSettingsPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { api } from '../../api/client';

interface CompanySettings {
  id: string;
  name: string;
  clientKey: string;
  logoUrl: string | null;
  uiLanguage: string | null;
}

export const AppSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<CompanySettings | null>(null);
  const [name, setName] = useState('');
  const [uiLanguage, setUiLanguage] = useState('ru');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    api
      .get<CompanySettings>('/tenants/settings')
      .then((res) => {
        if (!alive) return;
        setData(res);
        setName(res.name || '');
        setUiLanguage(res.uiLanguage || 'ru');
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.settings.app.errors.load'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const updated = await api.patch<CompanySettings>('/tenants/settings', {
        name: name.trim() || null,
        logoUrl: data.logoUrl?.trim() || null,
        uiLanguage: uiLanguage || null,
      });
      setData(updated);
      setSaved(true);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.settings.app.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="page-header">
          <div>
            <div className="page-subtitle">{t('crm.settings.app.sectionLabel')}</div>
            <h1 className="page-title">{t('crm.settings.app.title')}</h1>
          </div>
        </div>

        {error && (
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {saved && (
          <div className="text-xs text-status-success bg-status-success-bg border border-green-200 rounded-xl px-3 py-2">
            {t('crm.settings.app.success')}
          </div>
        )}

        {loading && (
          <div className="text-xs text-text-tertiary">{t('crm.settings.app.loading')}</div>
        )}

        {!loading && data && (
          <div className="card p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">{t('crm.settings.app.fields.name')}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="base-input"
                  placeholder={t('crm.settings.app.fields.namePlaceholder')}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('crm.settings.app.fields.clientKey')}</label>
                <input
                  value={data.clientKey}
                  readOnly
                  className="base-input bg-surface-subtle text-text-secondary"
                />
                <span className="form-hint">{t('crm.settings.app.fields.clientKeyHint')}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border-default flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? t('crm.settings.app.saving') : t('crm.settings.app.save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

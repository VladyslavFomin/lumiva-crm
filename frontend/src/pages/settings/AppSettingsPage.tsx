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
  const [logoUrl, setLogoUrl] = useState('');
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
        setLogoUrl(res.logoUrl || '');
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
        logoUrl: logoUrl.trim() || null,
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
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-slate-500">
              {t('crm.settings.app.sectionLabel')}
            </div>
            <h1 className="text-lg font-semibold text-slate-50">
              {t('crm.settings.app.title')}
            </h1>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {saved && (
          <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-700/60 rounded-xl px-3 py-2">
            {t('crm.settings.app.success')}
          </div>
        )}

        {loading && (
          <div className="text-xs text-slate-400">
            {t('crm.settings.app.loading')}
          </div>
        )}

        {!loading && data && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-5 space-y-4">
            {/* Основные поля */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Название */}
              <div className="space-y-1.5">
                <div className="text-slate-400">{t('crm.settings.app.fields.name')}</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none"
                  placeholder={t('crm.settings.app.fields.namePlaceholder')}
                />
              </div>

              {/* Клиентский ключ (read-only) */}
              <div className="space-y-1.5">
                <div className="text-slate-400">{t('crm.settings.app.fields.clientKey')}</div>
                <input
                  value={data.clientKey}
                  readOnly
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-sm outline-none text-slate-400"
                />
                <div className="text-[10px] text-slate-500">
                  {t('crm.settings.app.fields.clientKeyHint')}
                </div>
              </div>

              {/* Лого (URL) */}
              <div className="space-y-1.5">
                <div className="text-slate-400">{t('crm.settings.app.fields.logo')}</div>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none"
                  placeholder="https://example.com/logo.png"
                />
                <div className="text-[10px] text-slate-500">
                  {t('crm.settings.app.fields.logoHint')}
                </div>
              </div>

            </div>

            {/* Превью логотипа */}
            {logoUrl && (
              <div className="pt-3 border-t border-slate-800/70 mt-3">
                <div className="text-[11px] text-slate-500 mb-2">
                  {t('crm.settings.app.fields.logoPreview')}
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt={t('crm.settings.app.fields.logoAlt')}
                      className="max-h-12 max-w-12 object-contain"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 break-all">
                    {logoUrl}
                  </div>
                </div>
              </div>
            )}

            {/* Кнопка сохранить */}
            <div className="pt-3 border-t border-slate-800/70 mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-lumiva-accent text-slate-950 text-xs font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
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

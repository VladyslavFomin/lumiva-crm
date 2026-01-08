// src/pages/settings/SettingsCompanyPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchCompanySettings,
  updateCompanySettings,
  type CompanySettings,
} from '../../api/settings';

export const SettingsCompanyPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uiLanguage, setUiLanguage] = useState<string | ''>('');

  const locale = useMemo(() => {
    if (i18n.language === 'tr') return 'tr-TR';
    if (i18n.language === 'en') return 'en-US';
    return 'ru-RU';
  }, [i18n.language]);

  const langOptions = useMemo(
    () => [
      { value: 'ru', label: t('lang.ru') },
      { value: 'en', label: t('lang.en') },
      { value: 'tr', label: t('lang.tr') },
    ],
    [t],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setSuccess(null);

    fetchCompanySettings()
      .then((settings) => {
        if (!alive) return;
        setData(settings);
        setName(settings.name || '');
        setLogoUrl(settings.logoUrl || '');
        setUiLanguage(settings.uiLanguage || '');
      })
      .catch((e: any) => {
        if (!alive) return;
        console.error(e);
        setError(e.message || t('crm.settings.company.errors.load'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateCompanySettings({
        name: name.trim() || data.name,
        logoUrl: logoUrl.trim() || null,
        uiLanguage: uiLanguage || null,
      });
      setData(updated);
      setSuccess(t('crm.settings.company.success'));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.settings.company.errors.save'));
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
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              {t('crm.settings.company.sectionLabel')}
            </div>
            <h1 className="text-lg font-semibold text-slate-50">
              {t('crm.settings.company.title')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.settings.company.subtitle')}
            </div>
          </div>
        </div>

        {/* Статусы / алерты */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-2xl px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl px-3 py-2">
            {success}
          </div>
        )}

        {loading && (
          <div className="text-xs text-slate-400">
            {t('crm.settings.company.loading')}
          </div>
        )}

        {!loading && data && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 lg:grid-cols-3 gap-4"
          >
            {/* Левая колонка — форма */}
            <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {t('crm.settings.company.fields.name')}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none text-slate-50"
                  placeholder={t('crm.settings.company.fields.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {t('crm.settings.company.fields.logo')}
                </label>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none text-slate-50"
                  placeholder="https://…"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {t('crm.settings.company.fields.logoHint')}
                </p>
              </div>


              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-lumiva-accent text-slate-950 text-xs font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                >
                  {saving
                    ? t('crm.settings.company.saving')
                    : t('crm.settings.company.save')}
                </button>
              </div>
            </div>

            {/* Правая колонка — инфо о клиенте */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-3 text-xs">
              <div>
                <div className="text-[11px] text-slate-400 mb-1">
                  {t('crm.settings.company.fields.clientKey')}
                </div>
                <div className="px-2 py-1 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-[11px] break-all">
                  {data.clientKey}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">
                    {t('crm.settings.company.fields.plan')}
                  </div>
                  <div className="inline-flex px-2 py-1 rounded-full bg-slate-800 text-slate-100">
                    {data.plan}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">
                    {t('crm.settings.company.fields.status')}
                  </div>
                  <div
                    className={
                      'inline-flex px-2 py-1 rounded-full ' +
                      (data.status === 'active'
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : 'bg-slate-800 text-slate-300')
                    }
                  >
                    {data.status}
                  </div>
                </div>
              </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">
                  {t('crm.settings.company.fields.created')}
                  </div>
                  <div className="text-slate-200">
                  {new Date(data.createdAt).toLocaleString(locale)}
                  </div>
                </div>

              <div>
                <div className="text-[11px] text-slate-400 mb-1">
                  {t('crm.settings.company.fields.updated')}
                </div>
                <div className="text-slate-200">
                  {new Date(data.updatedAt).toLocaleString(locale)}
                </div>
              </div>

              {logoUrl && (
                <div className="pt-2">
                  <div className="text-[11px] text-slate-400 mb-1">
                    {t('crm.settings.company.fields.logoPreview')}
                  </div>
                  <div className="rounded-2xl bg-slate-950/70 border border-slate-800/80 p-3 flex items-center justify-center">
                    <img
                      src={logoUrl}
                      alt={t('crm.settings.company.fields.logoAlt')}
                      className="max-h-16 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </MainLayout>
  );
};

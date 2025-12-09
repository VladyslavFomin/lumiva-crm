// src/pages/settings/SettingsCompanyPage.tsx
import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchCompanySettings,
  updateCompanySettings,
  type CompanySettings,
} from '../../api/settings';

const LANG_OPTIONS = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Türkçe' },
];

export const SettingsCompanyPage: React.FC = () => {
  const [data, setData] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uiLanguage, setUiLanguage] = useState<string | ''>('');

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
        setError(e.message || 'Ошибка загрузки настроек компании');
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
      setSuccess('Настройки сохранены');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Ошибка сохранения настроек');
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
              Настройки
            </div>
            <h1 className="text-lg font-semibold text-slate-50">
              Настройки компании
            </h1>
            <div className="text-[11px] text-slate-500">
              Название, логотип и базовые параметры клиента
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
          <div className="text-xs text-slate-400">Загружаем настройки…</div>
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
                  Название компании
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none text-slate-50"
                  placeholder="Название, которое будет видно в CRM"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Логотип (URL)
                </label>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none text-slate-50"
                  placeholder="https://…"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Позже можно будет сделать загрузку файла. Сейчас — только URL
                  к изображению.
                </p>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Основной язык интерфейса
                </label>
                <select
                  value={uiLanguage}
                  onChange={(e) => setUiLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none text-slate-50"
                >
                  <option value="">— Не выбран —</option>
                  {LANG_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Пока это только поле в настройках. Переключение UI по языку
                  можно добавить позже.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-lumiva-accent text-slate-950 text-xs font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                >
                  {saving ? 'Сохраняем…' : 'Сохранить изменения'}
                </button>
              </div>
            </div>

            {/* Правая колонка — инфо о клиенте */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-3 text-xs">
              <div>
                <div className="text-[11px] text-slate-400 mb-1">
                  Клиентский ключ
                </div>
                <div className="px-2 py-1 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-[11px] break-all">
                  {data.clientKey}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">
                    Тариф
                  </div>
                  <div className="inline-flex px-2 py-1 rounded-full bg-slate-800 text-slate-100">
                    {data.plan}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">
                    Статус
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
                  Создан
                </div>
                <div className="text-slate-200">
                  {new Date(data.createdAt).toLocaleString('ru-RU')}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400 mb-1">
                  Обновлён
                </div>
                <div className="text-slate-200">
                  {new Date(data.updatedAt).toLocaleString('ru-RU')}
                </div>
              </div>

              {logoUrl && (
                <div className="pt-2">
                  <div className="text-[11px] text-slate-400 mb-1">
                    Превью логотипа
                  </div>
                  <div className="rounded-2xl bg-slate-950/70 border border-slate-800/80 p-3 flex items-center justify-center">
                    <img
                      src={logoUrl}
                      alt="Лого компании"
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
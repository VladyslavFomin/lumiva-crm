// src/pages/profile/ProfilePage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { fetchMe, updateMe, changeMyPassword, type MeDto } from '../../api/users';

export const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const [me, setMe] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passSaving, setPassSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchMe()
      .then((u) => {
        if (!alive) return;
        setMe(u);
        setName(u.name ?? '');
        setPhone(u.phone ?? '');
        setAvatarUrl(u.avatarUrl ?? '');
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.profile.errors.load'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleSaveProfile = async () => {
    if (!me) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateMe({
        name: name || null,
        phone: phone || null,
        avatarUrl: avatarUrl || null,
      });
      setMe(updated);
      setSuccess(t('crm.profile.success'));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.profile.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPassError(null);
    setPassSuccess(null);

    if (!oldPassword || !newPassword) {
      setPassError(t('crm.profile.password.errors.required'));
      return;
    }
    if (newPassword !== newPassword2) {
      setPassError(t('crm.profile.password.errors.mismatch'));
      return;
    }

    setPassSaving(true);
    try {
      await changeMyPassword(oldPassword, newPassword);
      setPassSuccess(t('crm.profile.password.success'));
      setOldPassword('');
      setNewPassword('');
      setNewPassword2('');
    } catch (e: any) {
      console.error(e);
      setPassError(e.message || t('crm.profile.password.errors.failed'));
    } finally {
      setPassSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <div className="text-[11px] text-slate-500 mb-1">
            {t('crm.profile.sectionLabel')}
          </div>
          <h1 className="text-lg font-semibold text-slate-50">
            {t('crm.profile.title')}
          </h1>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-xs text-slate-400">{t('crm.profile.loading')}</div>
        )}

        {!loading && me && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Профиль */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold">
                  {me.name?.[0]?.toUpperCase() || me.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-50">
                    {me.name || me.email}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {me.email}
                  </div>
                </div>
              </div>

              {success && (
                <div className="text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-700/60 rounded-xl px-3 py-2">
                  {success}
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-[11px] text-slate-500 mb-1">
                    {t('crm.profile.fields.name')}
                  </div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 outline-none focus:border-lumiva-accent-soft"
                    placeholder={t('crm.profile.fields.namePlaceholder')}
                  />
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 mb-1">
                    {t('crm.profile.fields.phone')}
                  </div>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 outline-none focus:border-lumiva-accent-soft"
                    placeholder={t('crm.profile.fields.phonePlaceholder')}
                  />
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 mb-1">
                    {t('crm.profile.fields.avatar')}
                  </div>
                  <input
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 outline-none focus:border-lumiva-accent-soft"
                    placeholder={t('crm.profile.fields.avatarPlaceholder')}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                >
                  {saving
                    ? t('crm.profile.saving')
                    : t('crm.profile.save')}
                </button>
              </div>
            </div>

            {/* Пароль */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-3 text-sm">
              <div className="text-sm font-medium text-slate-50">
                {t('crm.profile.password.title')}
              </div>
              <div className="text-[11px] text-slate-500">
                {t('crm.profile.password.subtitle')}
              </div>

              {passError && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
                  {passError}
                </div>
              )}
              {passSuccess && (
                <div className="text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-700/60 rounded-xl px-3 py-2">
                  {passSuccess}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <div className="text-[11px] text-slate-500 mb-1">
                    {t('crm.profile.password.current')}
                  </div>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 outline-none focus:border-lumiva-accent-soft"
                  />
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 mb-1">
                    {t('crm.profile.password.new')}
                  </div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 outline-none focus:border-lumiva-accent-soft"
                  />
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 mb-1">
                    {t('crm.profile.password.confirm')}
                  </div>
                  <input
                    type="password"
                    value={newPassword2}
                    onChange={(e) => setNewPassword2(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 outline-none focus:border-lumiva-accent-soft"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={passSaving}
                  className="px-3 py-1.5 text-xs rounded-xl bg-slate-900 text-slate-100 border border-slate-700 hover:bg-slate-800 disabled:opacity-60"
                >
                  {passSaving
                    ? t('crm.profile.password.saving')
                    : t('crm.profile.password.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

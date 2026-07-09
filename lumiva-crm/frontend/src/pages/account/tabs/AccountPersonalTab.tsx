import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchMe,
  updateMe,
  uploadMyAvatar,
  type MeDto,
} from '../../../api/users';
import { resolvePublicAssetUrl } from '../../../api/client';
import { updateStoredUser } from '../../../auth/session';

const PRESET_SEEDS = ['Aurora', 'Bay', 'Cobalt', 'Dawn', 'Eclipse', 'Fjord'];

function dicebearThumb(seed: string) {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
}

export const AccountPersonalTab: React.FC = () => {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<MeDto | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        if (!alive) return;
        setError(e?.message || t('crm.account.personal.errors.load'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [t]);

  const preview = resolvePublicAssetUrl(avatarUrl || null);

  const handleSave = async () => {
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
      updateStoredUser({
        name: updated.name,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
      });
      setSuccess(t('crm.account.personal.success'));
    } catch (e: any) {
      setError(e?.message || t('crm.account.personal.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await uploadMyAvatar(file);
      setMe(updated);
      setAvatarUrl(updated.avatarUrl ?? '');
      updateStoredUser({
        name: updated.name,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
      });
      setSuccess(t('crm.account.personal.success'));
    } catch (err: any) {
      setError(err?.message || t('crm.account.personal.errors.upload'));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">{t('crm.profile.loading')}</div>;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t('crm.account.personal.title')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('crm.account.personal.subtitle')}</p>
      </div>

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {t('crm.account.personal.avatarTitle')}
        </div>
        <p className="mt-1 text-xs text-slate-500">{t('crm.account.personal.avatarHint')}</p>

        <div className="mt-5 flex flex-col sm:flex-row gap-6 items-start">
          <div className="flex flex-col items-center gap-3">
            <div className="h-28 w-28 overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-50 shadow-sm">
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-400">
                  {(name?.[0] || me?.email?.[0] || '?').toUpperCase()}
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onPickFile} />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="btn-primary"
            >
              {uploading ? t('crm.account.personal.uploading') : t('crm.account.personal.upload')}
            </button>
          </div>

          <div className="flex-1 min-w-0 w-full space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t('crm.account.personal.presetsTitle')}
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_SEEDS.map((seed) => {
                const url = dicebearThumb(seed);
                const active = avatarUrl === url;
                return (
                  <button
                    key={seed}
                    type="button"
                    title={seed}
                    onClick={() => setAvatarUrl(url)}
                    className={`h-12 w-12 overflow-hidden rounded-xl border-2 transition ${
                      active ? 'border-[#222222] ring-2 ring-[#222222]/15' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full bg-slate-100 object-cover" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-[11px] text-slate-500">{t('crm.profile.fields.name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#222222]/40"
            placeholder={t('crm.profile.fields.namePlaceholder')}
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500">{t('crm.profile.fields.phone')}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#222222]/40"
            placeholder={t('crm.profile.fields.phonePlaceholder')}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="btn-primary btn-primary-lg"
      >
        {saving ? t('crm.account.personal.saving') : t('crm.account.personal.save')}
      </button>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import {
  fetchMe,
  updateMe,
  uploadMyAvatar,
  type MeDto,
} from '../../../api/users';
import { resolvePublicAssetUrl } from '../../../api/client';
import { updateStoredUser } from '../../../auth/session';
import { updatePreferences } from '../../../api/account';

const PRESET_SEEDS = ['Aurora', 'Bay', 'Cobalt', 'Dawn', 'Eclipse', 'Fjord'];

function dicebearThumb(seed: string) {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
}

const TIMEZONES = [
  'Europe/Istanbul',
  'Europe/Moscow',
  'Europe/Kyiv',
  'Europe/Warsaw',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Almaty',
];

export const AccountPersonalTab: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<MeDto | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [timezone, setTimezone] = useState('Europe/Istanbul');
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('19:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchMe()
      .then((u) => {
        if (!alive) return;
        setMe(u);
        setName(u.name ?? '');
        setPhone(u.phone ?? '');
        setAvatarUrl(u.avatarUrl ?? '');
        setTimezone(u.timezone || 'Europe/Istanbul');
        const wh = (u.preferences as any)?.workHours;
        if (wh?.start) setWorkStart(wh.start);
        if (wh?.end) setWorkEnd(wh.end);
      })
      .catch((e) => {
        if (alive) setError(e?.message || 'Не удалось загрузить профиль');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const preview = resolvePublicAssetUrl(avatarUrl || null);

  const handleSave = async () => {
    if (!me) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateMe({ name: name || null, phone: phone || null, avatarUrl: avatarUrl || null });
      setMe(updated);
      updateStoredUser({ name: updated.name, phone: updated.phone, avatarUrl: updated.avatarUrl });
      setSuccess('Сохранено');
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить');
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
      updateStoredUser({ name: updated.name, phone: updated.phone, avatarUrl: updated.avatarUrl });
      setSuccess('Фото обновлено');
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveHours = async () => {
    setSavingHours(true);
    setError(null);
    setSuccess(null);
    try {
      await updatePreferences({ timezone, workHours: { start: workStart, end: workEnd } });
      setSuccess('Рабочее время сохранено');
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить');
    } finally {
      setSavingHours(false);
    }
  };

  if (loading) {
    return <div className="acc-log-empty">Загрузка…</div>;
  }

  return (
    <div className="acc-grid">
      <div className="acc-col">
        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Личные данные</h3>
              <div className="sub">Имя и телефон видны коллегам в задачах, сделках и чатах.</div>
            </div>
          </div>
          <div className="acc-body">
            {error && (
              <div className="acc-note" style={{ marginBottom: 14 }}>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="acc-note ok" style={{ marginBottom: 14 }}>
                <span>{success}</span>
              </div>
            )}
            <div className="acc-fields">
              <div className="acc-f">
                <label>Имя и фамилия</label>
                <input className="acc-in" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="acc-f">
                <label>Телефон</label>
                <input className="acc-in" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 ..." />
              </div>
              <div className="acc-f wide">
                <label>Почта</label>
                <input className="acc-in" value={me?.email || ''} disabled />
                <div className="hint">Подтверждена</div>
              </div>
            </div>
          </div>
          <div className="acc-foot">
            <span>Изменения применяются сразу во всех модулях</span>
            <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? '…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      <div className="acc-col">
        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Фото профиля</h3>
              <div className="sub">PNG, JPG или WebP до 2 МБ.</div>
            </div>
          </div>
          <div className="acc-body">
            <div className="acc-avatar">
              <div className="acc-face" style={{ width: 92, height: 92, fontSize: 32 }}>
                {preview ? <img src={preview} alt="" /> : (name?.[0] || me?.email?.[0] || '?').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onPickFile} />
                <button type="button" className="btn btn-sm btn-primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? 'Загружаем…' : 'Загрузить файл'}
                </button>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', margin: '10px 0 0' }}>Или выберите готовую аватарку</div>
                <div className="acc-presets">
                  {PRESET_SEEDS.map((seed) => {
                    const url = dicebearThumb(seed);
                    const active = avatarUrl === url;
                    return (
                      <button
                        key={seed}
                        type="button"
                        title={seed}
                        className={`acc-preset${active ? ' on' : ''}`}
                        onClick={() => setAvatarUrl(url)}
                      >
                        <img src={url} alt="" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Рабочее время</h3>
              <div className="sub">Используется в расписании и бронированиях.</div>
            </div>
          </div>
          <div className="acc-body">
            <div className="acc-fields" style={{ gridTemplateColumns: '1fr' }}>
              <div className="acc-f">
                <label>Часовой пояс</label>
                <select className="acc-sel" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div className="acc-f">
                <label>Рабочие часы</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="acc-in" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
                  <input className="acc-in" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <div className="acc-foot">
            <span>&nbsp;</span>
            <button type="button" className="btn btn-sm btn-primary" disabled={savingHours} onClick={() => void handleSaveHours()}>
              {savingHours ? '…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

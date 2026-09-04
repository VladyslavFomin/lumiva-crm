// src/pages/account/AccountCenterLayout.tsx
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { getStoredUser, updateStoredUser } from '../../auth/session';
import { fetchMe, uploadMyAvatar, type MeDto } from '../../api/users';
import { resolvePublicAssetUrl } from '../../api/client';
import './account-design.css';

const BASE = '/profile';

export const AccountCenterLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const pathNorm = location.pathname.replace(/^\/app(?=\/|$)/, '') || '/';
  const storedUser = getStoredUser();
  const role = String(storedUser?.role || '').toLowerCase();
  const isOwnerLike = role === 'owner' || role === 'admin' || role === 'superadmin';
  const isManagerLike = isOwnerLike || role === 'manager';

  const [me, setMe] = useState<MeDto | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    fetchMe()
      .then(setMe)
      .catch(() => {});
  };
  useEffect(load, []);

  const main = [
    { to: `${BASE}/overview`, end: true, label: 'Обзор' },
    { to: `${BASE}/personal`, end: false, label: 'Профиль' },
    { to: `${BASE}/security`, end: false, label: 'Безопасность' },
    { to: `${BASE}/preferences`, end: false, label: 'Интерфейс' },
  ];

  const roleLabel =
    role === 'owner' ? 'Владелец' : role === 'manager' ? 'Менеджер' : role === 'admin' ? 'Администратор' : storedUser?.role || '—';

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const updated = await uploadMyAvatar(file);
      setMe(updated);
      updateStoredUser({ name: updated.name, phone: updated.phone, avatarUrl: updated.avatarUrl });
    } catch {
      // тихо — детальная ошибка/повтор доступны на вкладке «Профиль»
    } finally {
      setUploading(false);
    }
  };

  const avatarSrc = resolvePublicAssetUrl(me?.avatarUrl || null);
  const initials = (me?.name?.trim()?.[0] || me?.email?.[0] || '?').toUpperCase();

  const checklist = [
    { done: true, label: 'Почта подтверждена' },
    { done: !!me?.phone, label: 'Телефон добавлен' },
    { done: !!me?.twoFactorEnabled, label: 'Двухфакторная защита' },
    { done: !!me?.avatarUrl, label: 'Фото профиля' },
  ];
  const done = checklist.filter((c) => c.done).length;
  const pct = Math.round((done / checklist.length) * 100);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ru-RU');
    } catch {
      return iso;
    }
  };

  return (
    <MainLayout>
      <div className="acc-scope w-full">
        <div className="acc-band">
          <div className="acc-face">
            {avatarSrc ? <img src={avatarSrc} alt="" /> : initials}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onPickFile} />
            <span className="edit" onClick={() => !uploading && fileRef.current?.click()}>
              {uploading ? '…' : 'фото'}
            </span>
          </div>
          <div className="acc-id">
            <div className="nm">
              {me?.name || me?.email || '—'}
              <span className="acc-pill ink">{roleLabel}</span>
            </div>
            <div className="em">{me?.email}</div>
            <div className="acc-pills">
              <span className="acc-pill ok">
                <span className="dot" />
                Активен
              </span>
              {me?.twoFactorEnabled ? (
                <span className="acc-pill ok">
                  <span className="dot" />
                  2FA включена
                </span>
              ) : (
                <span className="acc-pill warn">
                  <span className="dot" />
                  2FA выключена
                </span>
              )}
            </div>
          </div>
          <div className="acc-band-r">
            <div className="acc-band-stats">
              <div>
                <div className="k">В системе с</div>
                <div className="v">{formatDate(me?.createdAt)}</div>
              </div>
              <div>
                <div className="k">Активность</div>
                <div className="v">{formatDate(me?.lastActiveAt)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-sm" onClick={() => navigate(`${BASE}/preferences`)}>
                Интерфейс
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate(`${BASE}/personal`)}>
                Редактировать профиль
              </button>
            </div>
          </div>
        </div>

        <div className="acc-meter">
          <span className="lbl">Аккаунт заполнен</span>
          <span className="pc">{pct}%</span>
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
          {done < checklist.length ? (
            <span className="rest">Осталось: {checklist.filter((c) => !c.done).map((c) => c.label).join(', ')}</span>
          ) : (
            <span className="rest">Всё готово</span>
          )}
          {done < checklist.length && (
            <button type="button" className="btn btn-sm" onClick={() => navigate(`${BASE}/security`)}>
              Заняться
            </button>
          )}
        </div>

        <div className="acc-tabs">
          {main.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `acc-tab${isActive ? ' on' : ''}`}>
              {item.label}
            </NavLink>
          ))}
          {isManagerLike && (
            <>
              <div style={{ flex: 1 }} />
              <a className="acc-tab" href="/app/settings">
                Настройки компании ↗
              </a>
              {isOwnerLike && (
                <a className="acc-tab" href="/app/staff/permissions">
                  Права доступа ↗
                </a>
              )}
            </>
          )}
        </div>

        <div key={pathNorm}>
          <Outlet context={{ me, reloadMe: load }} />
        </div>
      </div>
    </MainLayout>
  );
};

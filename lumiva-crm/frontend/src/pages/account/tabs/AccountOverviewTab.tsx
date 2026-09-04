import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMe, type MeDto } from '../../../api/users';
import { getStoredTenantName } from '../../../auth/session';
import {
  fetchMySessions,
  fetchSecurityLog,
  revokeMySession,
  type AccountSession,
  type SecurityLogItem,
} from '../../../api/account';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

const LINKS: Array<{ t: string; d: string; href: string }> = [
  { t: 'Компания и бренд', d: 'Название, логотип, реквизиты', href: '/app/settings' },
  { t: 'Ключи API', d: 'Управление интеграциями', href: '/app/settings/api-tokens' },
  { t: 'Биллинг', d: 'Тариф и способы оплаты', href: '/app/settings?tab=billing' },
  { t: 'Команда', d: 'Сотрудники и приглашения', href: '/app/staff' },
  { t: 'Права доступа', d: 'Роли и области видимости записей', href: '/app/staff/permissions' },
  { t: 'Отделы', d: 'Структура компании', href: '/app/departments' },
];

export const AccountOverviewTab: React.FC = () => {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeDto | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [log, setLog] = useState<SecurityLogItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchMe().then(setMe).catch((e) => setErr(e?.message || 'Не удалось загрузить профиль'));
    fetchMySessions().then(setSessions).catch(() => {});
    fetchSecurityLog().then((r) => setLog(r.items)).catch(() => {});
  }, []);

  const tenantName = getStoredTenantName();

  const tasks = [
    { done: true, t: 'Почта подтверждена', d: me?.email || '' },
    { done: !!me?.phone, t: 'Телефон добавлен', d: 'Нужен для входа по SMS и уведомлений о сделках', cta: !me?.phone ? 'personal' : undefined },
    {
      done: !!me?.twoFactorEnabled,
      t: 'Двухфакторная защита',
      d: 'Владелец видит финансы и ключи API — без 2FA один пароль защищает всё',
      cta: !me?.twoFactorEnabled ? 'security' : undefined,
    },
    { done: !!me?.avatarUrl, t: 'Фото профиля', d: 'Помогает команде узнавать вас в задачах и чатах', cta: !me?.avatarUrl ? 'personal' : undefined },
  ];
  const done = tasks.filter((t) => t.done).length;

  const revoke = async (id: string) => {
    await revokeMySession(id).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="acc-grid">
      <div className="acc-col">
        {err && (
          <div className="acc-note">
            <span>{err}</span>
          </div>
        )}

        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Что стоит завершить</h3>
              <div className="sub">Шаги, после которых аккаунт перестанет быть слабым звеном.</div>
            </div>
            <span className="acc-pill">
              {done} из {tasks.length}
            </span>
          </div>
          <div className="acc-body tight">
            {tasks.map((task, i) => (
              <div key={i} className={`acc-task${task.done ? ' done' : ''}`}>
                <div className="tick">{task.done ? '✓' : ''}</div>
                <div>
                  <div className="t">{task.t}</div>
                  <div className="d">{task.d}</div>
                </div>
                {task.cta ? (
                  <button type="button" className="btn btn-sm" onClick={() => navigate(`/app/profile/${task.cta}`)}>
                    Заняться
                  </button>
                ) : (
                  <span className="acc-pill ok">
                    <span className="dot" />
                    готово
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Настройки рабочего пространства</h3>
              <div className="sub">Разделы CRM, за которые отвечает владелец аккаунта.</div>
            </div>
          </div>
          <div className="acc-links">
            {LINKS.map((l) => (
              <a key={l.t} className="acc-link" href={l.href}>
                <div className="ic">↗</div>
                <div>
                  <div className="t">{l.t}</div>
                  <div className="d">{l.d}</div>
                </div>
                <span className="ar">›</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="acc-col">
        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Активные сессии</h3>
              <div className="sub">Устройства с доступом к аккаунту.</div>
            </div>
          </div>
          <div className="acc-body tight">
            {sessions.length === 0 ? (
              <div className="acc-log-empty">Загрузка…</div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="acc-row">
                  <div className="ic">{s.os === 'iOS' || s.os === 'Android' ? '📱' : '💻'}</div>
                  <div>
                    <div className="t">
                      {s.os} · {s.browser}
                    </div>
                    <div className="d">{s.ip || '—'}</div>
                  </div>
                  <span className="when">{formatDate(s.lastSeenAt)}</span>
                  {s.isCurrent ? (
                    <span className="acc-pill ok">
                      <span className="dot" />
                      это вы
                    </span>
                  ) : (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => revoke(s.id)}>
                      ×
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Журнал аккаунта</h3>
              <div className="sub">Последние события по вашему пользователю.</div>
            </div>
          </div>
          <div className="acc-log">
            {log.length === 0 ? (
              <div className="acc-log-empty">Пока нет событий</div>
            ) : (
              log.slice(0, 6).map((l) => (
                <div key={l.id} className="acc-log-i">
                  <span className="tm">{formatDate(l.createdAt)}</span>
                  <span className="pt" />
                  <span className="tx">{l.summary}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="acc-card">
          <div className="acc-card-head">
            <h3>Организация</h3>
          </div>
          <div className="acc-body">
            <div className="acc-kv">
              <span className="k">Компания</span>
              <span className="v">{tenantName?.trim() || '—'}</span>
            </div>
            <div className="acc-kv">
              <span className="k">Ваш ID</span>
              <span className="v mono">{me?.id?.slice(0, 8) || '—'}</span>
            </div>
            <div className="acc-kv">
              <span className="k">В системе с</span>
              <span className="v mono">{formatDate(me?.createdAt)}</span>
            </div>
            <div className="acc-kv">
              <span className="k">Последняя активность</span>
              <span className="v mono">{formatDate(me?.lastActiveAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

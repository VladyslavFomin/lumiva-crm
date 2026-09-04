import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../../i18n';
import { fetchMe } from '../../../api/users';
import { updatePreferences } from '../../../api/account';

const THEMES: Array<{ id: string; t: string; d: string; sw: string[] }> = [
  { id: 'light', t: 'Светлая', d: 'Основной вид CRM', sw: ['#fff', '#fafafa', '#e7e7e7'] },
  { id: 'dark', t: 'Тёмная', d: 'Скоро', sw: ['#1a1a1a', '#242424', '#3a3a3a'] },
  { id: 'auto', t: 'Системная', d: 'По настройке ОС', sw: ['#fff', '#8a8a8a', '#1a1a1a'] },
];

const DENSITIES: Array<{ id: string; t: string; d: string }> = [
  { id: 'compact', t: 'Компактно', d: 'Больше строк на экран' },
  { id: 'comfort', t: 'Обычно', d: 'Стандартный вид' },
  { id: 'relax', t: 'Свободно', d: 'Больше воздуха' },
];

const NOTIF_ROWS: Array<{ key: string; t: string; d: string }> = [
  { key: 'newLead', t: 'Новый лид на мне', d: 'В колокольчик сразу после назначения' },
  { key: 'telegramHandoff', t: 'Сообщения в Telegram-боте', d: 'Когда бот передаёт диалог человеку' },
  { key: 'mentions', t: 'Упоминания в комментариях', d: 'Задачи, сделки, проекты' },
  { key: 'dailyDigest', t: 'Сводка за день', d: 'Письмо в 19:00 по вашему часовому поясу' },
  { key: 'aiReports', t: 'Отчёты автоматизаций', d: 'Согласования и уведомления сценариев' },
  { key: 'newDeviceLogin', t: 'Вход с нового устройства', d: 'Письмо о каждой новой сессии' },
];

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`acc-tg${on ? ' on' : ''}`} onClick={onToggle} disabled={disabled}>
      <i />
    </button>
  );
}

export const AccountPreferencesTab: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2);

  const [theme, setTheme] = useState('light');
  const [density, setDensity] = useState('comfort');
  const [dateFormat, setDateFormat] = useState('DD.MM.YYYY');
  const [weekStart, setWeekStart] = useState('monday');
  const [notifications, setNotifications] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMe().then((u) => {
      const p = u.preferences || {};
      setTheme(p.theme || 'light');
      setDensity(p.density || 'comfort');
      setDateFormat(p.dateFormat || 'DD.MM.YYYY');
      setWeekStart(p.weekStart || 'monday');
      setNotifications({
        newLead: true,
        telegramHandoff: true,
        mentions: true,
        dailyDigest: false,
        aiReports: true,
        newDeviceLogin: true,
        ...(p.notifications || {}),
      });
    });
  }, []);

  const toggleNotif = async (key: string) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    try {
      await updatePreferences({ notifications: { [key]: next[key] } });
    } catch {
      setNotifications(notifications); // откат при ошибке
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePreferences({ theme, density, dateFormat, weekStart });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acc-grid">
      <div className="acc-col">
        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Тема</h3>
              <div className="sub">Применяется только к вашему аккаунту. Тёмная тема сейчас в разработке — выбор сохраняется, но интерфейс пока остаётся светлым.</div>
            </div>
          </div>
          <div className="acc-body">
            <div className="acc-choices">
              {THEMES.map((th) => (
                <button key={th.id} type="button" className={`acc-choice${theme === th.id ? ' on' : ''}`} onClick={() => setTheme(th.id)}>
                  <div className="acc-swatch">
                    {th.sw.map((c, i) => (
                      <i key={i} style={{ background: c }} />
                    ))}
                  </div>
                  <div className="t">{th.t}</div>
                  <div className="d">{th.d}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="acc-card">
          <div className="acc-card-head">
            <div>
              <h3>Плотность и язык</h3>
              <div className="sub">Насколько компактно показывать таблицы и на каком языке работать.</div>
            </div>
          </div>
          <div className="acc-body">
            <div className="acc-choices" style={{ marginBottom: 16 }}>
              {DENSITIES.map((d) => (
                <button key={d.id} type="button" className={`acc-choice${density === d.id ? ' on' : ''}`} onClick={() => setDensity(d.id)}>
                  <div className="t">{d.t}</div>
                  <div className="d">{d.d}</div>
                </button>
              ))}
            </div>
            <div className="acc-fields">
              <div className="acc-f">
                <label>Язык интерфейса</label>
                <select
                  className="acc-sel"
                  value={lang === 'en' ? 'en' : lang === 'tr' ? 'tr' : 'ru'}
                  onChange={(e) => setAppLanguage(e.target.value as 'ru' | 'en' | 'tr')}
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                </select>
              </div>
              <div className="acc-f">
                <label>Формат даты</label>
                <select className="acc-sel" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                  <option value="DD.MM.YYYY">ДД.ММ.ГГГГ</option>
                  <option value="YYYY-MM-DD">ГГГГ-ММ-ДД</option>
                  <option value="MM/DD/YYYY">ММ/ДД/ГГГГ</option>
                </select>
              </div>
              <div className="acc-f">
                <label>Первый день недели</label>
                <select className="acc-sel" value={weekStart} onChange={(e) => setWeekStart(e.target.value)}>
                  <option value="monday">Понедельник</option>
                  <option value="sunday">Воскресенье</option>
                </select>
              </div>
            </div>
          </div>
          <div className="acc-foot">
            <span>Настройки хранятся за вашим пользователем</span>
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
              <h3>Уведомления</h3>
              <div className="sub">Что присылать лично вам.</div>
            </div>
          </div>
          <div className="acc-body tight">
            {NOTIF_ROWS.map((row) => (
              <div key={row.key} className="acc-tg-row">
                <div>
                  <div className="t">{row.t}</div>
                  <div className="d">{row.d}</div>
                </div>
                <Toggle on={!!notifications[row.key]} onToggle={() => void toggleNotif(row.key)} />
              </div>
            ))}
          </div>
        </div>

        <div className="acc-card">
          <div className="acc-card-head">
            <h3>Быстрые клавиши</h3>
          </div>
          <div className="acc-body">
            {[
              ['Поиск по системе', '⌘ K'],
              ['ИИ-ассистент', '⌘ J'],
            ].map(([k, v]) => (
              <div key={k} className="acc-kv">
                <span className="k">{k}</span>
                <span className="v mono">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

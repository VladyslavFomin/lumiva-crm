// src/pages/settings/ApiTokensPage.tsx
import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchApiTokens,
  createApiToken,
  updateApiToken,
  deleteApiToken,
  type ApiTokenRecord,
} from '../../api/apiTokens';
import { useAlertModal } from '../../contexts/AlertModalContext';
import '../telephony/telephony-design.css';

const maskToken = (token: string) => {
  if (token.length <= 10) return token;
  return `${token.slice(0, 6)}${'•'.repeat(10)}${token.slice(-4)}`;
};

export const ApiTokensPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justCreated, setJustCreated] = useState<ApiTokenRecord | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    fetchApiTokens()
      .then(setTokens)
      .catch((e: any) => showAlert(e?.message || 'Не удалось загрузить токены', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const created = await createApiToken({ name: name.trim(), description: description.trim() || null });
      setJustCreated(created);
      setName('');
      setDescription('');
      setShowForm(false);
      load();
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось создать токен', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (t: ApiTokenRecord) => {
    try {
      await updateApiToken(t.id, { isActive: !t.isActive });
      load();
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось изменить токен', { variant: 'error' });
    }
  };

  const handleDelete = async (t: ApiTokenRecord) => {
    if (!window.confirm(`Удалить токен «${t.name}»? Действие необратимо.`)) return;
    try {
      await deleteApiToken(t.id);
      load();
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось удалить токен', { variant: 'error' });
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <h1>API-токены</h1>
            <p className="sub">
              Ключи для доступа к публичному API от имени вашей компании — для интеграций с сайтом,
              виджетами и внешними сервисами. Полный список эндпоинтов — на странице{' '}
              <a href="/api-integration" style={{ textDecoration: 'underline' }}>документации API</a>.
            </p>
          </div>
          <div className="tel-hero-r">
            <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Отмена' : 'Новый токен'}
            </button>
          </div>
        </div>

        {justCreated && (
          <div className="ha-section" style={{ borderColor: '#1f8a5e' }}>
            <div className="ha-section-head">
              <div>
                <h3 style={{ color: '#1f8a5e' }}>Токен создан</h3>
                <div className="sub">Скопируйте его сейчас — он не будет показан в открытом виде повторно.</div>
              </div>
            </div>
            <div
              style={{
                fontFamily: 'var(--ff-mono)',
                fontSize: 13,
                background: 'var(--bg-muted)',
                padding: '10px 14px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span>{justCreated.token}</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(justCreated.token);
                  showAlert('Скопировано', { variant: 'success' });
                }}
              >
                Копировать
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="ha-section">
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gap: 10, maxWidth: 480 }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Название токена (например, «Сайт — форма заявок»)"
                  className="info-input"
                />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Описание (необязательно)"
                  className="info-input"
                />
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: 'fit-content' }}>
                  {submitting ? 'Создаём…' : 'Создать токен'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3>Ваши токены</h3>
              <div className="sub">Передавайте в заголовке запроса: <code>X-Api-Token: &lt;token&gt;</code></div>
            </div>
          </div>
          {loading ? (
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Загрузка…</div>
          ) : tokens.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Токенов пока нет</div>
          ) : (
            <div className="pace-table-wrap">
              <table className="pace-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Токен</th>
                    <th>Статус</th>
                    <th>Создан</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.name}
                        {t.description && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t.description}</div>}
                      </td>
                      <td>
                        <span
                          style={{ fontFamily: 'var(--ff-mono)', fontSize: 11.5, cursor: 'pointer' }}
                          onClick={() => toggleReveal(t.id)}
                          title="Показать/скрыть"
                        >
                          {revealedIds.has(t.id) ? t.token : maskToken(t.token)}
                        </span>
                      </td>
                      <td>
                        <span className={t.isActive ? 'need low' : 'need high'}>{t.isActive ? 'активен' : 'отозван'}</span>
                      </td>
                      <td style={{ color: 'var(--fg-3)' }}>{new Date(t.createdAt).toLocaleDateString('ru-RU')}</td>
                      <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-sm" onClick={() => handleToggleActive(t)}>
                          {t.isActive ? 'Отозвать' : 'Восстановить'}
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => handleDelete(t)}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ApiTokensPage;

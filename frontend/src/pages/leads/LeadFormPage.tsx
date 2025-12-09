// src/pages/leads/LeadFormPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';

import {
  fetchLeadById,
  createLead,
  updateLead,
  fetchLeadHistory,
  addLeadComment,
} from '../../api/leads';
import type { Lead, LeadStatus, LeadActivity } from '../../api/leads';
import { fetchStaff, type StaffUser } from '../../api/staff';

type TabId = 'main' | 'history';

// статусы — ровно те же строки, что в api/leads.ts (LeadStatus)
const STATUS_OPTIONS: LeadStatus[] = [
  'Новый клиент',
  'В работе',
  'Ожидает ответа',
  'Закрыт (успех)',
  'Закрыт (проигран)',
];

function getStatusLabel(status: LeadStatus | string): string {
  return STATUS_OPTIONS.includes(status as LeadStatus)
    ? (status as LeadStatus)
    : String(status);
}

// Читабельные подписи для типов активностей
function getActivityLabel(a: LeadActivity): string {
  switch (a.type) {
    case 'created':
      return 'Лид создан';
    case 'status_changed':
      return 'Изменён статус';
    case 'assignee_changed':
      return 'Изменён ответственный';
    case 'comment':
      return 'Комментарий';
    default:
      return a.type;
  }
}

// Заготовка для нового лида
function createEmptyLead(): Lead {
  const now = new Date().toISOString();
  return {
    id: 'new',
    name: '',
    phone: '',
    email: '',
    country: '',
    status: 'Новый клиент', // человекочитаемый статус
    channel: 'manual',
    assignedTo: null,
    assignedUserId: null,
    meta: {},
    createdAt: now,
    updatedAt: now,
  } as Lead;
}

export const LeadFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const navigate = useNavigate();

  const [tab, setTab] = useState<TabId>('main');
  const [lead, setLead] = useState<Lead>(createEmptyLead());
  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);

  // история лида
  const [history, setHistory] = useState<LeadActivity[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');

  // аккуратный helper для показа тостов
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage((current) => (current === msg ? null : current));
    }, 2500);
  };

  // загрузка лида + сотрудников + истории
  useEffect(() => {
    let alive = true;
    setError(null);

    if (isNew) {
      setLead(createEmptyLead());
      setLoading(false);
      setHistory([]);
      setHistoryError(null);
    } else {
      setLoading(true);

      fetchLeadById(id as string)
        .then((data) => {
          if (!alive) return;
          setLead(data);
        })
        .catch((e) => {
          console.error(e);
          if (!alive) return;
          setError(e.message || 'Ошибка загрузки лида');
        })
        .finally(() => {
          if (!alive) return;
          setLoading(false);
        });

      // история
      setHistoryLoading(true);
      setHistoryError(null);
      fetchLeadHistory(id as string)
        .then((items) => {
          if (!alive) return;
          setHistory(items ?? []);
        })
        .catch((e) => {
          console.error('Ошибка загрузки истории лида', e);
          if (!alive) return;
          setHistory([]);
          setHistoryError(e.message || 'Ошибка загрузки истории');
        })
        .finally(() => {
          if (!alive) return;
          setHistoryLoading(false);
        });
    }

    // Сотрудники
    fetchStaff()
      .then((users) => {
        if (!alive) return;
        setStaff(users);
      })
      .catch((e) => {
        console.error('Ошибка загрузки сотрудников для лида', e);
      });

    return () => {
      alive = false;
    };
  }, [id, isNew]);

  const title = useMemo(() => {
    if (isNew) return 'Новый лид';
    const shortId =
      lead && lead.id ? String(lead.id).slice(0, 8) : '';
    return shortId ? `Лид #${shortId}` : 'Лид';
  }, [isNew, lead]);

  // --- обработчики ---

  const handleChange =
    (field: keyof Lead) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setLead((prev) => ({ ...prev, [field]: value }));
    };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as LeadStatus;
    setLead((prev) => ({ ...prev, status: value }));
  };

  // выбор ответственного из справочника сотрудников
  const handleAssigneeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value || null;
    const user = staff.find((u) => u.id === selectedId);

    setLead((prev) => ({
      ...prev,
      assignedUserId: selectedId,
      assignedTo: user ? user.fullName : null,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isNew) {
        const saved = await createLead({
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          country: lead.country,
          status: lead.status, // русская строка — в api/leads будет замаплена на код
          source: 'manual',
          assignedTo: lead.assignedTo ?? undefined,
          assignedUserId: lead.assignedUserId ?? undefined,
          meta: lead.meta ?? {},
        });
        setLead(saved);
        showSuccess('Лид создан');
        navigate(`/app/leads/${saved.id}`, { replace: true });
      } else {
        const saved = await updateLead(lead.id, {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          country: lead.country,
          status: lead.status,
          assignedTo: lead.assignedTo ?? undefined,
          assignedUserId: lead.assignedUserId ?? undefined,
          meta: lead.meta ?? {},
        });
        setLead(saved);
        showSuccess('Изменения по лиду сохранены');

        // после обновления — можно перезагрузить историю,
        // если мы меняли статус / ответственного
        if (!isNew) {
          fetchLeadHistory(lead.id)
            .then((items) => setHistory(items ?? []))
            .catch((e) =>
              console.error('Ошибка обновления истории после сохранения', e),
            );
        }
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Ошибка сохранения лида');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/app/leads');
  };

  // (пока) заглушка для "Создать аккаунт"
  const handleCreateAccount = () => {
    alert(
      'Здесь будет логика создания аккаунта на стороне WordPress клиента и линковки с лидом.',
    );
  };

  // (пока) заглушка для удаления
  const handleDelete = () => {
    alert(
      'Удаление лида через API /leads/:id (DELETE) мы добавим на отдельном шаге.',
    );
  };

  const handleSendComment = async () => {
    if (!id || isNew) {
      alert('Сначала сохраните лид, чтобы добавлять комментарии.');
      return;
    }
    const text = newComment.trim();
    if (!text) return;

    try {
      await addLeadComment(id, text);
      setNewComment('');
      const items = await fetchLeadHistory(id);
      setHistory(items ?? []);
      showSuccess('Комментарий добавлен');
    } catch (e: any) {
      console.error(e);
      setHistoryError(e.message || 'Не удалось добавить комментарий');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Верхняя панель */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={handleBack}
              className="text-[11px] text-slate-400 hover:text-slate-200 mb-1"
            >
              ← Назад к лидам
            </button>
            <div className="text-[11px] text-slate-500">{title}</div>
            <h1 className="text-lg font-semibold text-slate-50">
              {lead.name || 'Без имени'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <>
                <button
                  type="button"
                  onClick={handleCreateAccount}
                  className="px-3 py-1.5 text-xs rounded-xl border border-lumiva-accent-soft text-lumiva-accent hover:bg-slate-900/80"
                >
                  Создать аккаунт
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs rounded-xl border border-rose-500/60 text-rose-300 hover:bg-rose-950/60"
                >
                  Удалить лид
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
            >
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>

        {/* Уведомление об успехе */}
        {successMessage && !error && (
          <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg shadow-emerald-900/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Лоадер */}
        {loading && (
          <div className="text-xs text-slate-400">Загружаем данные лида…</div>
        )}

        {!loading && (
          <>
            {/* Вкладки */}
            <div className="inline-flex bg-slate-900/70 border border-slate-800/80 rounded-2xl p-1 text-[13px]">
              <button
                type="button"
                onClick={() => setTab('main')}
                className={
                  'px-4 py-1.5 rounded-xl ' +
                  (tab === 'main'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-100')
                }
              >
                Лид
              </button>
              <button
                type="button"
                onClick={() => setTab('history')}
                className={
                  'px-4 py-1.5 rounded-xl ' +
                  (tab === 'history'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-100')
                }
              >
                История
              </button>
            </div>

            {/* Контент вкладок */}
            {tab === 'main' && (
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
                {/* Имя / Контакты */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={lead.name}
                    onChange={handleChange('name')}
                    placeholder="Имя лида"
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                  <input
                    value={lead.email}
                    onChange={handleChange('email')}
                    placeholder="E-mail"
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                </div>

                {/* Связанные проекты */}
                {Array.isArray((lead as any).projects) &&
                  (lead as any).projects.length > 0 && (
                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 mt-2">
                      <div className="text-xs text-slate-400 mb-2">
                        Связанные проекты
                      </div>

                      <div className="space-y-2">
                        {(lead as any).projects.map((p: any) => (
                          <div
                            key={p.id}
                            onClick={() => navigate(`/app/projects/${p.id}`)}
                            className="cursor-pointer rounded-xl bg-slate-950/80 border border-slate-800/80 px-3 py-2 text-xs hover:border-lumiva-accent-soft"
                          >
                            <div className="font-medium text-slate-100">
                              {p.name}
                            </div>
                            <div className="text-slate-500 text-[11px]">
                              Статус: {p.status} — #{String(p.id).slice(0, 6)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Телефон / страна / ответственный */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={lead.phone}
                    onChange={handleChange('phone')}
                    placeholder="Телефон"
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                  <input
                    value={lead.country}
                    onChange={handleChange('country')}
                    placeholder="Страна (код или текст)"
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />

                  {/* Ответственный (выбор из сотрудников) */}
                  <select
                    value={lead.assignedUserId || ''}
                    onChange={handleAssigneeSelect}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  >
                    <option value="">Ответственный не назначен</option>
                    {staff.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} {u.email ? `· ${u.email}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Статус / Канал / дата создания */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={lead.status}
                    onChange={handleStatusChange}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    value={lead.channel}
                    onChange={handleChange('channel')}
                    placeholder="Канал (например, FORM / CHAT / GOOGLE)"
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                  <input
                    disabled
                    value={new Date(lead.createdAt).toLocaleString('ru-RU')}
                    className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-500"
                  />
                </div>

                {/* Текст / meta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <textarea
                    value={
                      (lead.meta && (lead.meta as any).comment) ||
                      (lead.meta && (lead.meta as any).message) ||
                      ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setLead((prev) => ({
                        ...prev,
                        meta: {
                          ...(prev.meta || {}),
                          comment: val,
                        },
                      }));
                    }}
                    placeholder="Текст лида / запрос клиента / важные детали..."
                    rows={5}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft resize-none"
                  />

                  <textarea
                    value={JSON.stringify(lead.meta ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const obj = JSON.parse(e.target.value || '{}');
                        setLead((prev) => ({ ...prev, meta: obj }));
                        setError(null);
                      } catch {
                        setError('Meta: некорректный JSON');
                      }
                    }}
                    placeholder="Сырые данные meta (utm, page, form_id...)"
                    rows={5}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono outline-none focus:border-lumiva-accent-soft resize-none"
                  />
                </div>
              </div>
            )}

            {tab === 'history' && (
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-3 text-sm text-slate-100">
                {isNew && (
                  <div className="text-xs text-slate-400">
                    История появится после того, как вы сохраните лид.
                  </div>
                )}

                {!isNew && (
                  <>
                    {historyError && (
                      <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2 mb-2">
                        {historyError}
                      </div>
                    )}

                    {historyLoading && (
                      <div className="text-xs text-slate-400 mb-2">
                        Загружаем историю…
                      </div>
                    )}

                    {!historyLoading && history.length === 0 && (
                      <div className="text-xs text-slate-500">
                        Пока нет событий по этому лиду.
                      </div>
                    )}

                    <div className="space-y-2">
                      {history.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-2xl bg-slate-950/80 border border-slate-800/80 px-3 py-2"
                        >
                          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>{getActivityLabel(a)}</span>
                            <span>
                              {new Date(a.createdAt).toLocaleString('ru-RU')}
                            </span>
                          </div>

                          {(a.userName || a.userEmail) && (
                            <div className="text-[11px] text-slate-400 mb-1">
                              Пользователь: {a.userName || a.userEmail}
                            </div>
                          )}

                          {a.comment && (
                            <div className="text-slate-100">{a.comment}</div>
                          )}

                          {(a.fromValue || a.toValue) && (
                            <div className="text-[11px] text-slate-400 mt-1">
                              {a.fromValue && (
                                <span className="line-through text-slate-500 mr-1">
                                  {a.fromValue}
                                </span>
                              )}
                              {a.toValue && (
                                <span className="text-emerald-300">
                                  {a.toValue}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Добавление комментария */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <div className="text-xs text-slate-400 mb-1">
                        Добавить комментарий
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Напишите комментарий…"
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                        />
                        <button
                          type="button"
                          onClick={handleSendComment}
                          className="px-3 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
                        >
                          Отправить
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};
// src/pages/leads/LeadFormPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';
import { deleteLead } from '../../api/leads';
import {
  fetchLeadById,
  createLead,
  updateLead,
  fetchLeadHistory,
  addLeadComment,
} from '../../api/leads';
import type { Lead, LeadStatus, LeadActivity } from '../../api/leads';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { ccpApi, type CcpSite } from '../../api/ccp';

type TabId = 'main' | 'history';

function resolveLocale(lang: string) {
  if (lang === 'tr') return 'tr-TR';
  if (lang === 'en') return 'en-US';
  return 'ru-RU';
}

// статусы — ровно те же строки, что в api/leads.ts (LeadStatus)
const STATUS_OPTIONS: LeadStatus[] = [
  'Новый клиент',
  'В работе',
  'Ожидает ответа',
  'Закрыт (успех)',
  'Закрыт (проигран)',
];

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
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    utmContent: '',
    utmTerm: '',
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

  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
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

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSites, setAccountSites] = useState<CcpSite[]>([]);
  const [accountSiteId, setAccountSiteId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountBalanceEur, setAccountBalanceEur] = useState('');
  const [accountBalanceUsd, setAccountBalanceUsd] = useState('');

  // аккуратный helper для показа тостов
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage((current) => (current === msg ? null : current));
    }, 2500);
  };
  const showError = (msg: string) => {
  setError(msg);
  setTimeout(() => {
    setError((current) => (current === msg ? null : current));
  }, 3500);
};

  const statusLabels = useMemo(
    () => ({
      'Новый клиент': t('crm.leads.statusValues.new'),
      'В работе': t('crm.leads.statusValues.inProgress'),
      'Ожидает ответа': t('crm.leads.statusValues.waiting'),
      'Закрыт (успех)': t('crm.leads.statusValues.won'),
      'Закрыт (проигран)': t('crm.leads.statusValues.lost'),
    }),
    [t],
  );

  const getActivityLabel = (a: LeadActivity): string => {
    switch (a.type) {
      case 'created':
        return t('crm.leads.form.activity.created');
      case 'status_changed':
        return t('crm.leads.form.activity.statusChanged');
      case 'assignee_changed':
        return t('crm.leads.form.activity.assigneeChanged');
      case 'comment':
        return t('crm.leads.form.activity.comment');
      default:
        return a.type;
    }
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
          setError(e.message || t('crm.leads.form.errors.loadLead'));
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
          setHistoryError(e.message || t('crm.leads.form.errors.historyLoad'));
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
    if (isNew) return t('crm.leads.form.titleNew');
    const shortId =
      lead && lead.id ? String(lead.id).slice(0, 8) : '';
    return shortId
      ? t('crm.leads.form.titleId', { id: shortId })
      : t('crm.leads.form.titleDefault');
  }, [isNew, lead, t]);

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
        showSuccess(t('crm.leads.form.messages.leadCreated'));
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
        showSuccess(t('crm.leads.form.messages.leadSaved'));

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
      setError(e.message || t('crm.leads.form.errors.saveLead'));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/app/leads');
  };

  // (пока) заглушка для "Создать аккаунт"
  const handleCreateAccount = async () => {
    setAccountError(null);
    setAccountModalOpen(true);
    setAccountName(lead.name || '');
    setAccountEmail(lead.email || '');
    setAccountPassword('');
    setAccountBalanceEur('');
    setAccountBalanceUsd('');

    if (accountSites.length === 0) {
      try {
        const sites = await ccpApi.sites();
        setAccountSites(sites || []);
        if (sites?.length === 1) {
          setAccountSiteId(sites[0].id);
        }
      } catch (e: any) {
        console.error(e);
        setAccountError(t('crm.leads.form.account.errors.loadSites'));
      }
    }
  };

  const parseMoney = (value: string) => {
    const raw = value.trim().replace(/\s+/g, '').replace(',', '.');
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  };

  const handleAccountSave = async () => {
    setAccountError(null);
    if (!accountSiteId) {
      setAccountError(t('crm.leads.form.account.errors.siteRequired'));
      return;
    }
    if (!accountEmail.trim()) {
      setAccountError(t('crm.leads.form.account.errors.emailRequired'));
      return;
    }
    if (!accountPassword.trim()) {
      setAccountError(t('crm.leads.form.account.errors.passwordRequired'));
      return;
    }

    setAccountBusy(true);
    try {
      await ccpApi.createClient(accountSiteId, {
        email: accountEmail.trim(),
        name: accountName.trim() || null,
        password: accountPassword.trim(),
        balanceEur: accountBalanceEur ? parseMoney(accountBalanceEur) : undefined,
        balanceUsd: accountBalanceUsd ? parseMoney(accountBalanceUsd) : undefined,
      });
      showSuccess(t('crm.leads.form.account.messages.created'));
      setAccountModalOpen(false);
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || '');
      if (/account already exists/i.test(msg)) {
        setAccountError(t('crm.leads.form.account.errors.exists'));
      } else {
        setAccountError(t('crm.leads.form.account.errors.createFailed'));
      }
    } finally {
      setAccountBusy(false);
    }
  };

  // Удаление
  const handleDeleteLead = async () => {
  if (isNew || !lead?.id || lead.id === 'new') return;

  const ok = window.confirm(t('crm.leads.form.alerts.deleteConfirm'));
  if (!ok) return;

  try {
    await deleteLead(lead.id);
    showSuccess(t('crm.leads.form.messages.leadDeleted'));
    navigate('/app/leads');
  } catch (e: any) {
    console.error(e);

    const status =
      e?.statusCode ??
      e?.response?.status ??
      e?.data?.statusCode ??
      e?.data?.status;

    if (status === 403) {
      showError(t('crm.leads.form.errors.deleteForbidden'));
      return;
    }

    showError(e?.message || t('crm.leads.form.errors.deleteLead'));
  }
  };

  const handleSendComment = async () => {
    if (!id || isNew) {
      alert(t('crm.leads.form.alerts.commentRequiresSave'));
      return;
    }
    const text = newComment.trim();
    if (!text) return;

    try {
      await addLeadComment(id, text);
      setNewComment('');
      const items = await fetchLeadHistory(id);
      setHistory(items ?? []);
      showSuccess(t('crm.leads.form.messages.commentAdded'));
    } catch (e: any) {
      console.error(e);
      setHistoryError(e.message || t('crm.leads.form.errors.commentFailed'));
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
              {t('crm.leads.form.back')}
            </button>
            <div className="text-[11px] text-slate-500">{title}</div>
            <h1 className="text-lg font-semibold text-slate-50">
              {lead.name || t('crm.leads.form.nameFallback')}
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
                  {t('crm.leads.form.actions.createAccount')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteLead}
                  className="px-3 py-1.5 text-xs rounded-xl border border-rose-500/60 text-rose-300 hover:bg-rose-950/60"
                >
                  {t('crm.leads.form.actions.delete')}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
            >
              {saving ? t('crm.leads.form.actions.saving') : t('crm.leads.form.actions.save')}
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
          <div className="text-xs text-slate-400">{t('crm.leads.form.loadingLead')}</div>
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
                {t('crm.leads.form.tabs.main')}
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
                {t('crm.leads.form.tabs.history')}
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
                    placeholder={t('crm.leads.form.fields.namePlaceholder')}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                  <input
                    value={lead.email}
                    onChange={handleChange('email')}
                    placeholder={t('crm.leads.form.fields.emailPlaceholder')}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                </div>

                {/* Связанные проекты */}
                {Array.isArray((lead as any).projects) &&
                  (lead as any).projects.length > 0 && (
                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 mt-2">
                      <div className="text-xs text-slate-400 mb-2">
                        {t('crm.leads.form.sections.relatedProjects')}
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
                              {t('crm.leads.form.fields.projectStatus', {
                                status: p.status,
                                id: String(p.id).slice(0, 6),
                              })}
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
                    placeholder={t('crm.leads.form.fields.phonePlaceholder')}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                  <input
                    value={lead.country}
                    onChange={handleChange('country')}
                    placeholder={t('crm.leads.form.fields.countryPlaceholder')}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />

                  {/* Ответственный (выбор из сотрудников) */}
                  <select
                    value={lead.assignedUserId || ''}
                    onChange={handleAssigneeSelect}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  >
                    <option value="">{t('crm.leads.form.fields.assigneePlaceholder')}</option>
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
                        {statusLabels[s] ?? s}
                      </option>
                    ))}
                  </select>
                  <input
                    value={lead.channel}
                    onChange={handleChange('channel')}
                    placeholder={t('crm.leads.form.fields.channelPlaceholder')}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                  <input
                    disabled
                    value={new Date(lead.createdAt).toLocaleString(locale)}
                    className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-500"
                  />
                </div>

                {/* UTM поля */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    disabled
                    value={lead.utmSource || ''}
                    placeholder="utm_source"
                    className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-400"
                  />
                  <input
                    disabled
                    value={lead.utmMedium || ''}
                    placeholder="utm_medium"
                    className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-400"
                  />
                  <input
                    disabled
                    value={lead.utmCampaign || ''}
                    placeholder="utm_campaign"
                    className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-400"
                  />
                  <input
                    disabled
                    value={lead.utmContent || ''}
                    placeholder="utm_content"
                    className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-400"
                  />
                  <input
                    disabled
                    value={lead.utmTerm || ''}
                    placeholder="utm_term"
                    className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-400"
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
                    placeholder={t('crm.leads.form.fields.notesPlaceholder')}
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
                        setError(t('crm.leads.form.errors.metaInvalid'));
                      }
                    }}
                    placeholder={t('crm.leads.form.fields.metaPlaceholder')}
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
                    {t('crm.leads.form.sections.historyEmptyNew')}
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
                        {t('crm.leads.form.sections.historyLoading')}
                      </div>
                    )}

                    {!historyLoading && history.length === 0 && (
                      <div className="text-xs text-slate-500">
                        {t('crm.leads.form.sections.historyEmpty')}
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
                              {new Date(a.createdAt).toLocaleString(locale)}
                            </span>
                          </div>

                          {(a.userName || a.userEmail) && (
                            <div className="text-[11px] text-slate-400 mb-1">
                              {t('crm.leads.form.sections.user')}: {a.userName || a.userEmail}
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
                        {t('crm.leads.form.sections.addComment')}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder={t('crm.leads.form.fields.commentPlaceholder')}
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                        />
                        <button
                          type="button"
                          onClick={handleSendComment}
                          className="px-3 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
                        >
                          {t('crm.leads.form.actions.send')}
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

      {accountModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-50">
                  {t('crm.leads.form.account.title')}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {t('crm.leads.form.account.subtitle')}
                </div>
              </div>
              <button
                onClick={() => setAccountModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
                aria-label={t('crm.common.close')}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t('crm.leads.form.account.fields.site')}
                </div>
                <select
                  value={accountSiteId}
                  onChange={(e) => setAccountSiteId(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                >
                  <option value="">{t('crm.leads.form.account.fields.sitePlaceholder')}</option>
                  {accountSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.siteHost || site.siteUrl || site.id}
                    </option>
                  ))}
                </select>
                {accountSites.length === 0 ? (
                  <div className="mt-2 text-[11px] text-slate-500">
                    {t('crm.leads.form.account.hints.noSites')}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('crm.leads.form.account.fields.name')}
                  </div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder={t('crm.leads.form.account.fields.namePlaceholder')}
                  />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('crm.leads.form.account.fields.email')}
                  </div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder={t('crm.leads.form.account.fields.emailPlaceholder')}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('crm.leads.form.account.fields.password')}
                  </div>
                  <input
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    placeholder={t('crm.leads.form.account.fields.passwordPlaceholder')}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('crm.leads.form.account.fields.balanceEur')}
                  </div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    value={accountBalanceEur}
                    onChange={(e) => setAccountBalanceEur(e.target.value)}
                    placeholder={t('crm.leads.form.account.fields.balanceEurPlaceholder')}
                  />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('crm.leads.form.account.fields.balanceUsd')}
                  </div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    value={accountBalanceUsd}
                    onChange={(e) => setAccountBalanceUsd(e.target.value)}
                    placeholder={t('crm.leads.form.account.fields.balanceUsdPlaceholder')}
                  />
                </div>
              </div>

              {accountError && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
                  {accountError}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="px-4 py-2 text-xs rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-900"
                disabled={accountBusy}
              >
                {t('crm.common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleAccountSave}
                className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                disabled={accountBusy}
              >
                {accountBusy ? t('crm.common.saving') : t('crm.leads.form.account.actions.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

// src/pages/helpdesk/HelpdeskPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchHelpdeskTickets,
  fetchHelpdeskTicket,
  createHelpdeskTicket,
  replyToHelpdeskTicket,
  updateHelpdeskTicket,
  searchHelpdeskLinkOptions,
  type HelpdeskTicketRow,
  type HelpdeskMessage,
  type HelpdeskTicketDetail,
  type TicketStatus,
  type TicketPriority,
  type HelpdeskChannel,
  type HelpdeskLinkType,
  type HelpdeskLinkOption,
} from '../../api/helpdesk';
import { fetchContacts } from '../../api/contacts';
import type { Contact } from '../../api/contacts';
import { fetchStaff } from '../../api/staff';
import type { StaffUser } from '../../api/staff';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, HD_ICON, CHANNEL_ICON } from './HelpdeskIcons';
import './helpdesk-design.css';

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

const STATUS: Record<TicketStatus, { label: string; cls: string }> = {
  open: { label: 'Открыт', cls: 'open' },
  pending: { label: 'В обработке', cls: 'pending' },
  resolved: { label: 'Решён', cls: 'resolved' },
  closed: { label: 'Закрыт', cls: 'closed' },
};
const PRIORITY: Record<TicketPriority, { label: string; cls: string }> = {
  low: { label: 'Низкий', cls: 'low' },
  medium: { label: 'Средний', cls: 'medium' },
  high: { label: 'Высокий', cls: 'high' },
  urgent: { label: 'Критичный', cls: 'urgent' },
};
const CHANNEL_LABEL: Record<HelpdeskChannel, string> = {
  portal: 'Чат в кабинете',
  email: 'Email',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  internal: 'Внутреннее обращение',
};
const LINK_TYPE_LABEL: Record<HelpdeskLinkType, string> = { lead: 'Лид', company: 'Компания', project: 'Проект' };
const LINK_TYPE_ROUTE: Record<HelpdeskLinkType, string> = { lead: '/leads', company: '/companies', project: '/projects' };

const TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'open', label: 'Открытые' },
  { key: 'pending', label: 'В обработке' },
  { key: 'resolved', label: 'Решённые' },
  { key: 'closed', label: 'Закрытые' },
];

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtSla = (min: number) => (min < 60 ? `${min} мин` : min % 60 === 0 ? `${min / 60} ч` : `${Math.round(min / 60)} ч`);

export const HelpdeskPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [tickets, setTickets] = useState<HelpdeskTicketRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ ticket: HelpdeskTicketDetail; messages: HelpdeskMessage[] } | null>(null);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [staff, setStaff] = useState<StaffUser[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [channel, setChannel] = useState<HelpdeskChannel>('portal');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactId, setContactId] = useState('');
  const [entityType, setEntityType] = useState<HelpdeskLinkType | ''>('');
  const [entitySearch, setEntitySearch] = useState('');
  const [entityOptions, setEntityOptions] = useState<HelpdeskLinkOption[]>([]);
  const [entityId, setEntityId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadList = () => {
    setLoading(true);
    fetchHelpdeskTickets()
      .then(setTickets)
      .catch((e: any) => showAlert(e?.message || 'Не удалось загрузить обращения', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
    fetchStaff().then(setStaff).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetchHelpdeskTicket(selectedId)
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (!showForm) return;
    fetchContacts({ search: contactSearch || undefined, limit: 10 })
      .then((res) => setContacts(res.items))
      .catch(() => {});
  }, [showForm, contactSearch]);

  useEffect(() => {
    if (!entityType) {
      setEntityOptions([]);
      return;
    }
    searchHelpdeskLinkOptions(entityType, entitySearch).then(setEntityOptions).catch(() => {});
  }, [entityType, entitySearch]);

  const filtered = useMemo(
    () =>
      tickets.filter((t) => {
        if (tab !== 'all' && t.status !== tab) return false;
        if (q && !t.subject.toLowerCase().includes(q.toLowerCase()) && !(t.contactName || '').toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [tickets, tab, q],
  );

  const tabCount = (key: string) => (key === 'all' ? tickets.length : tickets.filter((t) => t.status === key).length);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const counts = {
    open: tickets.filter((t) => t.status === 'open').length,
    pending: tickets.filter((t) => t.status === 'pending').length,
    overdue: tickets.filter((t) => t.overdue).length,
    closed7: tickets.filter((t) => t.status === 'closed' && t.closedAt && new Date(t.closedAt).getTime() >= sevenDaysAgo).length,
  };

  const resetForm = () => {
    setSubject('');
    setCategory('');
    setPriority('medium');
    setChannel('portal');
    setContactId('');
    setContactSearch('');
    setEntityType('');
    setEntityId('');
    setEntitySearch('');
    setMessage('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setSubmitting(true);
    try {
      const ticket = await createHelpdeskTicket({
        contactId: contactId || undefined,
        subject: subject.trim(),
        message: message.trim(),
        category: category.trim() || undefined,
        priority,
        channel,
        entityType: entityType || undefined,
        entityId: entityType && entityId ? entityId : undefined,
      });
      setShowForm(false);
      resetForm();
      loadList();
      setSelectedId(ticket.id);
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось создать тикет', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !selectedId) return;
    setSending(true);
    try {
      await replyToHelpdeskTicket(selectedId, reply.trim());
      setReply('');
      const fresh = await fetchHelpdeskTicket(selectedId);
      setDetail(fresh);
      loadList();
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось отправить ответ', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const patchTicket = async (patch: Parameters<typeof updateHelpdeskTicket>[1]) => {
    if (!selectedId) return;
    try {
      await updateHelpdeskTicket(selectedId, patch);
      const fresh = await fetchHelpdeskTicket(selectedId);
      setDetail(fresh);
      loadList();
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось обновить тикет', { variant: 'error' });
    }
  };

  const sel = detail?.ticket;

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="esn-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              ПОДДЕРЖКА
            </div>
            <h1>Хэлпдеск</h1>
            <p className="sub">Обращения клиентов из кабинета, email, Telegram, WhatsApp и SMS — в одном списке. Ответ уходит обратно в тот же канал.</p>
          </div>
          <div className="esn-hero-r">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowForm((v) => !v);
                if (!showForm) resetForm();
              }}
            >
              <Ic d={HD_ICON.plus} size={13} />
              {showForm ? 'Отмена' : 'Создать тикет'}
            </button>
          </div>
        </div>

        <div className="esn-kpis">
          <div className="esn-kpi">
            <div className="l">Открытых</div>
            <div className="v">{counts.open}</div>
            <div className="d warn">требуют ответа</div>
          </div>
          <div className="esn-kpi">
            <div className="l">В обработке</div>
            <div className="v">{counts.pending}</div>
            <div className="d">в диалоге с агентом</div>
          </div>
          <div className="esn-kpi">
            <div className="l">Просрочено по SLA</div>
            <div className="v">{counts.overdue}</div>
            <div className="d warn">ответ не отправлен вовремя</div>
          </div>
          <div className="esn-kpi">
            <div className="l">Закрыто</div>
            <div className="v">{counts.closed7}</div>
            <div className="d up">за последние 7 дней</div>
          </div>
        </div>

        {showForm && (
          <form className="esn-panel" onSubmit={handleCreate}>
            <div className="esn-row2">
              <div className="esn-field">
                <span className="l">Тема обращения</span>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Коротко опишите проблему" required />
              </div>
              <div className="esn-field">
                <span className="l">Категория</span>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Например: Биллинг, Доступ/Аккаунт…" />
              </div>
            </div>

            <div className="esn-row3">
              <div className="esn-field">
                <span className="l">Приоритет</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
                  {(Object.keys(PRIORITY) as TicketPriority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY[p].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="esn-field">
                <span className="l">Канал ответа</span>
                <select value={channel} onChange={(e) => setChannel(e.target.value as HelpdeskChannel)}>
                  {(Object.keys(CHANNEL_LABEL) as HelpdeskChannel[]).map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="esn-field">
                <span className="l">Привязка к записи CRM</span>
                <select
                  value={entityType}
                  onChange={(e) => {
                    setEntityType(e.target.value as HelpdeskLinkType | '');
                    setEntityId('');
                    setEntitySearch('');
                  }}
                >
                  <option value="">Без привязки</option>
                  <option value="lead">Лид</option>
                  <option value="company">Компания</option>
                  <option value="project">Проект</option>
                </select>
              </div>
            </div>

            {channel !== 'portal' && (
              <div className="esn-alert warn">
                Ответы будут отправляться контакту напрямую через {CHANNEL_LABEL[channel]} — убедитесь, что у контакта есть {channel === 'email' ? 'email' : channel === 'sms' ? 'телефон' : `привязка к ${CHANNEL_LABEL[channel]}`}.
              </div>
            )}

            <div className="esn-row2">
              <div className="esn-field">
                <span className="l">Контакт{channel !== 'portal' ? ' (обязательно для этого канала)' : ''}</span>
                <input type="text" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Поиск контакта…" />
                <select value={contactId} onChange={(e) => setContactId(e.target.value)} style={{ marginTop: 4 }}>
                  <option value="">Без привязки к контакту</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ')} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {entityType && (
                <div className="esn-field">
                  <span className="l">{LINK_TYPE_LABEL[entityType]}</span>
                  <input
                    type="text"
                    value={entitySearch}
                    onChange={(e) => setEntitySearch(e.target.value)}
                    placeholder={`Поиск: ${LINK_TYPE_LABEL[entityType].toLowerCase()}…`}
                  />
                  <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ marginTop: 4 }}>
                    <option value="">— выберите —</option>
                    {entityOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="esn-field">
              <span className="l">Первое сообщение</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Опишите суть обращения…" />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Создаём…' : 'Создать тикет'}
            </button>
          </form>
        )}

        <div className="view-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={cx('view-tab', tab === t.key && 'active')} onClick={() => setTab(t.key)}>
              {t.label}
              <span className="badge">{tabCount(t.key)}</span>
            </button>
          ))}
          <div className="toolbar-spacer" />
          <div className="tb-search" style={{ width: 220 }}>
            <Ic d={HD_ICON.search} size={13} />
            <input placeholder="Найти тикет…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="ds-layout hd-layout">
          <div className="ds-list">
            {loading && <div className="ds-empty">Загрузка…</div>}
            {!loading && filtered.length === 0 && <div className="ds-empty">{tickets.length === 0 ? 'Обращений нет' : 'Ничего не найдено'}</div>}
            {!loading &&
              filtered.map((t) => (
                <div key={t.id} className={cx('hd-ticket', selectedId === t.id && 'active')} onClick={() => setSelectedId(t.id)}>
                  <div className="hd-ticket-top">
                    <span className="hd-id">
                      #{t.id.slice(0, 6)}
                      {t.unreadCount > 0 && (
                        <span style={{ marginLeft: 6, color: '#cc2f47', fontWeight: 700 }}>· {t.unreadCount} новых</span>
                      )}
                    </span>
                    <span className={cx('hd-pill', PRIORITY[t.priority].cls)}>{PRIORITY[t.priority].label}</span>
                  </div>
                  <div className="ds-doc-title">{t.subject}</div>
                  <div className="ds-doc-link">
                    {t.requesterName
                      ? `${t.requesterName}${t.requesterDepartment ? ` · ${t.requesterDepartment}` : ''}`
                      : t.entityLabel
                        ? `${LINK_TYPE_LABEL[t.entityType as HelpdeskLinkType]} · ${t.entityLabel}`
                        : t.contactName || 'Без привязки'}
                    {t.overdue && <span className="hd-overdue"> · SLA просрочен</span>}
                  </div>
                  <div className="ds-doc-foot">
                    <Ic d={CHANNEL_ICON[t.channel]} size={12} />
                    <span>{CHANNEL_LABEL[t.channel]}</span>
                    <span className="sep">·</span>
                    <span className={cx('ds-status', STATUS[t.status].cls)} style={{ padding: '1px 7px' }}>
                      {STATUS[t.status].label}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          <div className="ds-detail hd-detail">
            {!selectedId && (
              <div className="ds-empty" style={{ margin: 'auto' }}>
                Выберите тикет
              </div>
            )}
            {selectedId && detailLoading && (
              <div className="ds-empty" style={{ margin: 'auto' }}>
                Загрузка…
              </div>
            )}
            {sel && !detailLoading && (
              <>
                <div className="ds-detail-head">
                  <div>
                    <div className="ds-detail-kind">
                      #{sel.id.slice(0, 6)}
                      {sel.category ? ` · ${sel.category}` : ''}
                    </div>
                    <h2>{sel.subject}</h2>
                    <div className="ds-detail-link">
                      {sel.entityType && sel.entityLabel ? (
                        <>
                          {LINK_TYPE_LABEL[sel.entityType]} · <Link to={`${LINK_TYPE_ROUTE[sel.entityType]}/${sel.entityId}`}>{sel.entityLabel}</Link>
                        </>
                      ) : (
                        'Без привязки к лиду, компании или проекту'
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <span className={cx('hd-pill', 'lg', PRIORITY[sel.priority].cls)}>{PRIORITY[sel.priority].label}</span>
                    <span className={cx('ds-status', 'lg', STATUS[sel.status].cls)}>{STATUS[sel.status].label}</span>
                  </div>
                </div>

                {sel.overdue && (
                  <div className="esn-alert warn" style={{ marginTop: 14 }}>
                    Ответ не отправлен в течение {fmtSla(sel.slaTargetMinutes)} — SLA просрочен.
                  </div>
                )}

                <div className="hd-body">
                  <div className="hd-thread">
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {detail!.messages.map((m) => (
                        <div key={m.id} className={cx('hd-msg', m.direction === 'outgoing' && 'outgoing')}>
                          <div className="hd-msg-head">
                            <span className="nm">{m.authorName || (m.direction === 'incoming' ? 'Клиент' : 'Сотрудник')}</span>
                            <span className="tm">{fmtDate(m.createdAt)}</span>
                          </div>
                          <div className="hd-msg-text">{m.text}</div>
                        </div>
                      ))}
                      {detail!.messages.length === 0 && <div className="ds-empty">Сообщений пока нет</div>}
                    </div>

                    <form className="hd-reply" onSubmit={handleReply}>
                      <textarea placeholder="Написать ответ…" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                      <div className="hd-reply-actions">
                        <span className="hd-reply-chan">
                          <Ic d={CHANNEL_ICON[sel.channel]} size={13} className="ic" />
                          {sel.channel === 'internal' ? `Придёт уведомлением сотруднику${sel.requesterName ? ` (${sel.requesterName})` : ''}` : `Уйдёт через ${CHANNEL_LABEL[sel.channel]}`}
                        </span>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !reply.trim()}>
                          <Ic d={HD_ICON.email} size={13} />
                          {sending ? 'Отправляем…' : 'Отправить'}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="ds-side">
                    <div className="ds-meta">
                      <div className="ds-meta-row">
                        <span className="l">{sel.requesterName ? 'Внутреннее обращение от' : 'Обращение от'}</span>
                        <span className="v">
                          {sel.requesterName
                            ? `${sel.requesterName}${sel.requesterDepartment ? ` · ${sel.requesterDepartment}` : ''}`
                            : sel.contactName || '—'}
                        </span>
                      </div>
                      <div className="ds-meta-row">
                        <span className="l">Канал</span>
                        <span className="v hd-channel">
                          <Ic d={CHANNEL_ICON[sel.channel]} size={12} />
                          {CHANNEL_LABEL[sel.channel]}
                        </span>
                      </div>
                      {sel.category && (
                        <div className="ds-meta-row">
                          <span className="l">Категория</span>
                          <span className="v">{sel.category}</span>
                        </div>
                      )}
                      <div className="ds-meta-row">
                        <span className="l">Приоритет</span>
                        <select className="hd-select-inline" value={sel.priority} onChange={(e) => patchTicket({ priority: e.target.value as TicketPriority })}>
                          {(Object.keys(PRIORITY) as TicketPriority[]).map((p) => (
                            <option key={p} value={p}>
                              {PRIORITY[p].label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ds-meta-row">
                        <span className="l">Ответственный</span>
                        <select
                          className="hd-select-inline"
                          value={sel.assignedUserId || ''}
                          onChange={(e) => patchTicket({ assignedUserId: e.target.value || null })}
                        >
                          <option value="">— не назначен —</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ds-meta-row">
                        <span className="l">Создан</span>
                        <span className="v">{fmtDate(sel.createdAt)}</span>
                      </div>
                      <div className="ds-meta-row">
                        <span className="l">SLA до ответа</span>
                        <span className={cx('v', sel.overdue && 'hd-overdue')}>
                          {fmtSla(sel.slaTargetMinutes)}
                          {sel.overdue ? ' · просрочен' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="ds-actions">
                      <select className="hd-select-inline" value={sel.status} onChange={(e) => patchTicket({ status: e.target.value as TicketStatus })}>
                        {(Object.keys(STATUS) as TicketStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {STATUS[s].label}
                          </option>
                        ))}
                      </select>
                      {sel.status !== 'closed' && (
                        <button type="button" className="btn btn-sm" onClick={() => patchTicket({ status: 'closed' })}>
                          <Ic d={HD_ICON.check} size={13} />
                          Закрыть тикет
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default HelpdeskPage;

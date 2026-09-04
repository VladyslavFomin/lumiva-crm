// src/pages/helpdesk/HelpdeskPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
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

const STATUS_CLS: Record<TicketStatus, string> = { open: 'open', pending: 'pending', resolved: 'resolved', closed: 'closed' };
const PRIORITY_CLS: Record<TicketPriority, string> = { low: 'low', medium: 'medium', high: 'high', urgent: 'urgent' };
const STATUS_KEYS: TicketStatus[] = ['open', 'pending', 'resolved', 'closed'];
const PRIORITY_KEYS: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
const CHANNEL_KEYS: HelpdeskChannel[] = ['portal', 'email', 'telegram', 'whatsapp', 'sms', 'internal'];
const LINK_TYPE_ROUTE: Record<HelpdeskLinkType, string> = { lead: '/leads', company: '/companies', project: '/projects' };
const TAB_KEYS = ['all', 'open', 'pending', 'resolved', 'closed'] as const;

const fmtDate = (iso: string | null, locale: string) => (iso ? new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export const HelpdeskPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlertModal();
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const statusLabel = (s: TicketStatus) => t(`crm.helpdesk.status.${s}`);
  const priorityLabel = (p: TicketPriority) => t(`crm.helpdesk.priority.${p}`);
  const channelLabel = (c: HelpdeskChannel) => t(`crm.helpdesk.channel.${c}`);
  const linkTypeLabel = (lt: HelpdeskLinkType) => t(`crm.helpdesk.linkType.${lt}`);
  const fmtSla = (min: number) => (min < 60 ? `${min} ${t('crm.helpdesk.minShort')}` : min % 60 === 0 ? `${min / 60} ${t('crm.helpdesk.hourShort')}` : `${Math.round(min / 60)} ${t('crm.helpdesk.hourShort')}`);

  const [tickets, setTickets] = useState<HelpdeskTicketRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ ticket: HelpdeskTicketDetail; messages: HelpdeskMessage[] } | null>(null);
  const [tab, setTab] = useState<typeof TAB_KEYS[number]>('all');
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
      .catch((e: any) => showAlert(e?.message || t('crm.helpdesk.loadListError'), { variant: 'error' }))
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
      tickets.filter((tk) => {
        if (tab !== 'all' && tk.status !== tab) return false;
        if (q && !tk.subject.toLowerCase().includes(q.toLowerCase()) && !(tk.contactName || '').toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [tickets, tab, q],
  );

  const tabCount = (key: string) => (key === 'all' ? tickets.length : tickets.filter((tk) => tk.status === key).length);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const counts = {
    open: tickets.filter((tk) => tk.status === 'open').length,
    pending: tickets.filter((tk) => tk.status === 'pending').length,
    overdue: tickets.filter((tk) => tk.overdue).length,
    closed7: tickets.filter((tk) => tk.status === 'closed' && tk.closedAt && new Date(tk.closedAt).getTime() >= sevenDaysAgo).length,
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
      showAlert(e?.message || t('crm.helpdesk.form.createError'), { variant: 'error' });
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
      showAlert(e?.message || t('crm.helpdesk.replyError'), { variant: 'error' });
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
      showAlert(e?.message || t('crm.helpdesk.updateError'), { variant: 'error' });
    }
  };

  const sel = detail?.ticket;

  return (
    <MainLayout>
      <PageHelpButton topic="helpdesk" />
      <div className="px-scope">
        <div className="esn-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.helpdesk.kicker')}
            </div>
            <h1>{t('crm.helpdesk.title')}</h1>
            <p className="sub">{t('crm.helpdesk.subtitle')}</p>
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
              {showForm ? t('crm.helpdesk.cancelBtn') : t('crm.helpdesk.createTicketBtn')}
            </button>
          </div>
        </div>

        <div className="esn-kpis">
          <div className="esn-kpi">
            <div className="l">{t('crm.helpdesk.kpis.open')}</div>
            <div className="v">{counts.open}</div>
            <div className="d warn">{t('crm.helpdesk.kpis.openDesc')}</div>
          </div>
          <div className="esn-kpi">
            <div className="l">{t('crm.helpdesk.kpis.pending')}</div>
            <div className="v">{counts.pending}</div>
            <div className="d">{t('crm.helpdesk.kpis.pendingDesc')}</div>
          </div>
          <div className="esn-kpi">
            <div className="l">{t('crm.helpdesk.kpis.overdue')}</div>
            <div className="v">{counts.overdue}</div>
            <div className="d warn">{t('crm.helpdesk.kpis.overdueDesc')}</div>
          </div>
          <div className="esn-kpi">
            <div className="l">{t('crm.helpdesk.kpis.closed')}</div>
            <div className="v">{counts.closed7}</div>
            <div className="d up">{t('crm.helpdesk.kpis.closedDesc')}</div>
          </div>
        </div>

        {showForm && (
          <form className="esn-panel" onSubmit={handleCreate}>
            <div className="esn-row2">
              <div className="esn-field">
                <span className="l">{t('crm.helpdesk.form.subjectLabel')}</span>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('crm.helpdesk.form.subjectPlaceholder')} required />
              </div>
              <div className="esn-field">
                <span className="l">{t('crm.helpdesk.form.categoryLabel')}</span>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('crm.helpdesk.form.categoryPlaceholder')} />
              </div>
            </div>

            <div className="esn-row3">
              <div className="esn-field">
                <span className="l">{t('crm.helpdesk.form.priorityLabel')}</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
                  {PRIORITY_KEYS.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="esn-field">
                <span className="l">{t('crm.helpdesk.form.channelLabel')}</span>
                <select value={channel} onChange={(e) => setChannel(e.target.value as HelpdeskChannel)}>
                  {CHANNEL_KEYS.map((c) => (
                    <option key={c} value={c}>
                      {channelLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="esn-field">
                <span className="l">{t('crm.helpdesk.form.linkLabel')}</span>
                <select
                  value={entityType}
                  onChange={(e) => {
                    setEntityType(e.target.value as HelpdeskLinkType | '');
                    setEntityId('');
                    setEntitySearch('');
                  }}
                >
                  <option value="">{t('crm.helpdesk.form.noLink')}</option>
                  <option value="lead">{linkTypeLabel('lead')}</option>
                  <option value="company">{linkTypeLabel('company')}</option>
                  <option value="project">{linkTypeLabel('project')}</option>
                </select>
              </div>
            </div>

            {channel !== 'portal' && (
              <div className="esn-alert warn">
                {t('crm.helpdesk.form.channelWarning', {
                  channel: channelLabel(channel),
                  requirement: channel === 'email' ? t('crm.helpdesk.form.requirementEmail') : channel === 'sms' ? t('crm.helpdesk.form.requirementPhone') : t('crm.helpdesk.form.requirementLinkTo', { channel: channelLabel(channel) }),
                })}
              </div>
            )}

            <div className="esn-row2">
              <div className="esn-field">
                <span className="l">{t('crm.helpdesk.form.contactLabel')}{channel !== 'portal' ? t('crm.helpdesk.form.contactRequiredSuffix') : ''}</span>
                <input type="text" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder={t('crm.helpdesk.form.contactSearchPlaceholder')} />
                <select value={contactId} onChange={(e) => setContactId(e.target.value)} style={{ marginTop: 4 }}>
                  <option value="">{t('crm.helpdesk.form.noContactLink')}</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ')} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {entityType && (
                <div className="esn-field">
                  <span className="l">{linkTypeLabel(entityType)}</span>
                  <input
                    type="text"
                    value={entitySearch}
                    onChange={(e) => setEntitySearch(e.target.value)}
                    placeholder={t('crm.helpdesk.form.linkSearchPlaceholder', { type: linkTypeLabel(entityType).toLowerCase() })}
                  />
                  <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ marginTop: 4 }}>
                    <option value="">{t('crm.helpdesk.form.chooseOption')}</option>
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
              <span className="l">{t('crm.helpdesk.form.firstMessageLabel')}</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder={t('crm.helpdesk.form.firstMessagePlaceholder')} />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('crm.helpdesk.form.creatingBtn') : t('crm.helpdesk.form.createBtn')}
            </button>
          </form>
        )}

        <div className="view-tabs">
          {TAB_KEYS.map((k) => (
            <button key={k} type="button" className={cx('view-tab', tab === k && 'active')} onClick={() => setTab(k)}>
              {t(`crm.helpdesk.tabs.${k}`)}
              <span className="badge">{tabCount(k)}</span>
            </button>
          ))}
          <div className="toolbar-spacer" />
          <div className="tb-search" style={{ width: 220 }}>
            <Ic d={HD_ICON.search} size={13} />
            <input placeholder={t('crm.helpdesk.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="ds-layout hd-layout">
          <div className="ds-list">
            {loading && <div className="ds-empty">{t('crm.helpdesk.loadingList')}</div>}
            {!loading && filtered.length === 0 && <div className="ds-empty">{tickets.length === 0 ? t('crm.helpdesk.emptyTickets') : t('crm.helpdesk.emptySearch')}</div>}
            {!loading &&
              filtered.map((tk) => (
                <div key={tk.id} className={cx('hd-ticket', selectedId === tk.id && 'active')} onClick={() => setSelectedId(tk.id)}>
                  <div className="hd-ticket-top">
                    <span className="hd-id">
                      #{tk.id.slice(0, 6)}
                      {tk.unreadCount > 0 && (
                        <span style={{ marginLeft: 6, color: '#cc2f47', fontWeight: 700 }}>· {t('crm.helpdesk.newMessagesSuffix', { count: tk.unreadCount })}</span>
                      )}
                    </span>
                    <span className={cx('hd-pill', PRIORITY_CLS[tk.priority])}>{priorityLabel(tk.priority)}</span>
                  </div>
                  <div className="ds-doc-title">{tk.subject}</div>
                  <div className="ds-doc-link">
                    {tk.requesterName
                      ? `${tk.requesterName}${tk.requesterDepartment ? ` · ${tk.requesterDepartment}` : ''}`
                      : tk.entityLabel
                        ? `${linkTypeLabel(tk.entityType as HelpdeskLinkType)} · ${tk.entityLabel}`
                        : tk.contactName || t('crm.helpdesk.noLinkFallback')}
                    {tk.overdue && <span className="hd-overdue"> · {t('crm.helpdesk.slaOverdueSuffix')}</span>}
                  </div>
                  <div className="ds-doc-foot">
                    <Ic d={CHANNEL_ICON[tk.channel]} size={12} />
                    <span>{channelLabel(tk.channel)}</span>
                    <span className="sep">·</span>
                    <span className={cx('ds-status', STATUS_CLS[tk.status])} style={{ padding: '1px 7px' }}>
                      {statusLabel(tk.status)}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          <div className="ds-detail hd-detail">
            {!selectedId && (
              <div className="ds-empty" style={{ margin: 'auto' }}>
                {t('crm.helpdesk.selectTicket')}
              </div>
            )}
            {selectedId && detailLoading && (
              <div className="ds-empty" style={{ margin: 'auto' }}>
                {t('crm.helpdesk.loadingDetail')}
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
                          {linkTypeLabel(sel.entityType)} · <Link to={`${LINK_TYPE_ROUTE[sel.entityType]}/${sel.entityId}`}>{sel.entityLabel}</Link>
                        </>
                      ) : (
                        t('crm.helpdesk.noLinkDetail')
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <span className={cx('hd-pill', 'lg', PRIORITY_CLS[sel.priority])}>{priorityLabel(sel.priority)}</span>
                    <span className={cx('ds-status', 'lg', STATUS_CLS[sel.status])}>{statusLabel(sel.status)}</span>
                  </div>
                </div>

                {sel.overdue && (
                  <div className="esn-alert warn" style={{ marginTop: 14 }}>
                    {t('crm.helpdesk.slaOverdueBanner', { sla: fmtSla(sel.slaTargetMinutes) })}
                  </div>
                )}

                <div className="hd-body">
                  <div className="hd-thread">
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {detail!.messages.map((m) => (
                        <div key={m.id} className={cx('hd-msg', m.direction === 'outgoing' && 'outgoing')}>
                          <div className="hd-msg-head">
                            <span className="nm">{m.authorName || (m.direction === 'incoming' ? t('crm.helpdesk.authorClient') : t('crm.helpdesk.authorStaff'))}</span>
                            <span className="tm">{fmtDate(m.createdAt, dateLocale)}</span>
                          </div>
                          <div className="hd-msg-text">{m.text}</div>
                        </div>
                      ))}
                      {detail!.messages.length === 0 && <div className="ds-empty">{t('crm.helpdesk.noMessages')}</div>}
                    </div>

                    <form className="hd-reply" onSubmit={handleReply}>
                      <textarea placeholder={t('crm.helpdesk.replyPlaceholder')} rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                      <div className="hd-reply-actions">
                        <span className="hd-reply-chan">
                          <Ic d={CHANNEL_ICON[sel.channel]} size={13} className="ic" />
                          {sel.channel === 'internal'
                            ? t('crm.helpdesk.replyViaInternal', { name: sel.requesterName ? ` (${sel.requesterName})` : '' })
                            : t('crm.helpdesk.replyViaChannel', { channel: channelLabel(sel.channel) })}
                        </span>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !reply.trim()}>
                          <Ic d={HD_ICON.email} size={13} />
                          {sending ? t('crm.helpdesk.sendingBtn') : t('crm.helpdesk.sendBtn')}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="ds-side">
                    <div className="ds-meta">
                      <div className="ds-meta-row">
                        <span className="l">{sel.requesterName ? t('crm.helpdesk.meta.fromInternal') : t('crm.helpdesk.meta.from')}</span>
                        <span className="v">
                          {sel.requesterName
                            ? `${sel.requesterName}${sel.requesterDepartment ? ` · ${sel.requesterDepartment}` : ''}`
                            : sel.contactName || '—'}
                        </span>
                      </div>
                      <div className="ds-meta-row">
                        <span className="l">{t('crm.helpdesk.meta.channel')}</span>
                        <span className="v hd-channel">
                          <Ic d={CHANNEL_ICON[sel.channel]} size={12} />
                          {channelLabel(sel.channel)}
                        </span>
                      </div>
                      {sel.category && (
                        <div className="ds-meta-row">
                          <span className="l">{t('crm.helpdesk.meta.category')}</span>
                          <span className="v">{sel.category}</span>
                        </div>
                      )}
                      <div className="ds-meta-row">
                        <span className="l">{t('crm.helpdesk.meta.priority')}</span>
                        <select className="hd-select-inline" value={sel.priority} onChange={(e) => patchTicket({ priority: e.target.value as TicketPriority })}>
                          {PRIORITY_KEYS.map((p) => (
                            <option key={p} value={p}>
                              {priorityLabel(p)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ds-meta-row">
                        <span className="l">{t('crm.helpdesk.meta.assignee')}</span>
                        <select
                          className="hd-select-inline"
                          value={sel.assignedUserId || ''}
                          onChange={(e) => patchTicket({ assignedUserId: e.target.value || null })}
                        >
                          <option value="">{t('crm.helpdesk.meta.unassigned')}</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ds-meta-row">
                        <span className="l">{t('crm.helpdesk.meta.created')}</span>
                        <span className="v">{fmtDate(sel.createdAt, dateLocale)}</span>
                      </div>
                      <div className="ds-meta-row">
                        <span className="l">{t('crm.helpdesk.meta.slaUntilReply')}</span>
                        <span className={cx('v', sel.overdue && 'hd-overdue')}>
                          {fmtSla(sel.slaTargetMinutes)}
                          {sel.overdue ? t('crm.helpdesk.meta.overdueSuffix') : ''}
                        </span>
                      </div>
                    </div>

                    <div className="ds-actions">
                      <select className="hd-select-inline" value={sel.status} onChange={(e) => patchTicket({ status: e.target.value as TicketStatus })}>
                        {STATUS_KEYS.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                      {sel.status !== 'closed' && (
                        <button type="button" className="btn btn-sm" onClick={() => patchTicket({ status: 'closed' })}>
                          <Ic d={HD_ICON.check} size={13} />
                          {t('crm.helpdesk.closeTicketBtn')}
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmailBulkSendModal } from './EmailBulkSendModal';
import { postAiEmailReplySuggest } from '../../api/ai';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { CrmShellModal } from '../../components/ui/CrmShellModal';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { EmailComposeWindow } from './EmailComposeWindow';
import { EmailFolderModal } from './EmailFolderModal';
import { EmailMoveToFolderModal } from './EmailMoveToFolderModal';
import { SystemFolderIcon, IconFolder as OutlineIconFolder } from './EmailOutlineIcons';
import {
  fetchEmailAccounts,
  fetchEmailMessages,
  fetchEmailMessage,
  patchEmailMessage,
  deleteEmailMessage,
  syncEmailMailboxNow,
  importEmailCalendarInvite,
  backfillEmailCalendarInvites,
  fetchEmailFolders,
  createEmailFolder,
  patchEmailFolder,
  deleteEmailFolder,
  reorderEmailFolders,
  type EmailAccount,
  type EmailCalendarInviteMeta,
  type EmailMessage,
  type EmailFolder,
} from '../../api/email';
import { Ic, NI } from './EmailInboxIcons';
import './email-settings-design.css';
import './email-inbox-design.css';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

const LS_FOLDER_W = 'lumiva-email-folder-w';
const LS_LIST_W = 'lumiva-email-list-w';
const LS_FOLD_COLLAPSE = 'lumiva-email-folders-collapsed';
const MAILBOX_REFRESH_MS = 30_000;
const MAILBOX_SYNC_MS = 120_000;
const CALENDAR_BACKFILL_MS = 300_000;

function readStoredInt(key: string, fallback: number, min: number, max: number): number {
  try {
    const v = parseInt(localStorage.getItem(key) || '', 10);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  } catch {
    return fallback;
  }
}

function replySubject(original: string | null): string {
  const s = (original || '').trim();
  if (!s) return 'Re: ';
  if (/^re:\s*/i.test(s)) return s;
  return `Re: ${s}`;
}

function forwardSubject(original: string | null): string {
  const s = (original || '').trim();
  if (!s) return 'Fwd: ';
  if (/^fwd:\s*/i.test(s)) return s;
  return `Fwd: ${s}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailMessageSrcDoc(html: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base target="_blank" />
  <style>
    html, body { margin: 0; background: #fff; color: #222; }
    body {
      padding: 12px;
      font: 14px/1.55 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow-wrap: anywhere;
    }
    a { color: #222; text-decoration: underline; }
    img, video, canvas, svg { max-width: 100%; height: auto; }
    table { max-width: 100%; border-collapse: collapse; }
    pre { white-space: pre-wrap; }
    blockquote { margin-left: 0; padding-left: 12px; border-left: 3px solid #e7e7e7; color: #555; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

function replyInitialHtml(m: EmailMessage): string {
  const subj = escapeHtml(m.subject || '—');
  if (m.htmlBody && m.htmlBody.trim()) {
    return `<p></p><p><br></p><hr/><p style="color:#888;font-size:12px">${subj}</p><blockquote style="margin:8px 0;padding-left:12px;border-left:2px solid #e7e7e7;color:#555">${m.htmlBody}</blockquote>`;
  }
  const txt = escapeHtml((m.textBody || '').slice(0, 50_000));
  return `<p></p><p><br></p><hr/><p style="color:#888">${subj}</p><pre style="white-space:pre-wrap;font-family:inherit;font-size:13px">${txt}</pre>`;
}

function forwardInitialHtml(m: EmailMessage): string {
  const meta = `Пересланное письмо<br/>От: ${escapeHtml(m.fromName ? `${m.fromName} <${m.from}>` : m.from)}<br/>Кому: ${escapeHtml((m.to || []).join(', '))}<br/>Тема: ${escapeHtml(m.subject || '—')}`;
  if (m.htmlBody && m.htmlBody.trim()) {
    return `<p></p><p><br></p><hr/><p style="color:#888;font-size:12px">${meta}</p><blockquote style="margin:8px 0;padding-left:12px;border-left:2px solid #e7e7e7;color:#555">${m.htmlBody}</blockquote>`;
  }
  const txt = escapeHtml((m.textBody || '').slice(0, 50_000));
  return `<p></p><p><br></p><hr/><p style="color:#888">${meta}</p><pre style="white-space:pre-wrap;font-family:inherit;font-size:13px">${txt}</pre>`;
}

function orderedFolderTree(folders: EmailFolder[]): Array<{ f: EmailFolder; depth: number }> {
  const byParent = new Map<string | null, EmailFolder[]>();
  for (const f of folders) {
    const p = f.parentId ?? null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(f);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }
  const out: Array<{ f: EmailFolder; depth: number }> = [];
  const walk = (pid: string | null, depth: number) => {
    for (const f of byParent.get(pid) || []) {
      out.push({ f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function dayBucket(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function initialsOf(name: string | null | undefined, addr: string): string {
  const src = (name || addr || '').trim();
  if (!src) return '?';
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function snippetOf(m: EmailMessage): string {
  const raw = m.textBody || (m.htmlBody ? m.htmlBody.replace(/<[^>]*>/g, ' ') : '') || '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, 140);
}

function crmTag(m: EmailMessage): { cls: string; label: string } | null {
  if (m.leadId) return { cls: 'lead', label: 'Лид' };
  if (m.saleId) return { cls: 'deal', label: 'Сделка' };
  if (m.companyId) return { cls: 'deal', label: 'Компания' };
  if (m.contactId) return { cls: 'deal', label: 'Контакт' };
  if (m.direction === 'incoming') return { cls: 'none', label: 'Нет в CRM' };
  return null;
}

function fmtSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function formatInviteDate(raw: string | null | undefined): string {
  const value = String(raw || '').trim();
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function inviteStatusLabel(status: string | null | undefined): string {
  if (status === 'requested') return 'Запрошена';
  if (status === 'confirmed') return 'Подтверждена';
  if (status === 'tentative') return 'Предварительно';
  if (status === 'cancelled') return 'Отменена';
  return status || '—';
}

function formatAutoRefreshTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CalendarInviteCard({ invite, importError }: { invite: EmailCalendarInviteMeta; importError?: string | null }) {
  const attendees = Array.isArray(invite.attendees) ? invite.attendees.filter(Boolean) : [];
  return (
    <div className="em-fs" style={{ border: '1px solid var(--line-2)', borderRadius: 11, padding: 12, background: 'var(--bg-muted)' }}>
      <div className="in-crm" style={{ margin: 0, background: 'transparent', border: 0, padding: 0 }}>
        <span className="l">Встреча из письма</span>
        <span className="card"><Ic d={NI.cal} size={13} /><b>{invite.title || 'Встреча'}</b></span>
        <span className="sp" />
        {invite.workspaceCalendarPath ? (
          <Link to={invite.workspaceCalendarPath} className="in-btn sm">Открыть календарь</Link>
        ) : null}
        {invite.workspaceTablePath ? (
          <Link to={invite.workspaceTablePath} className="in-btn sm">Открыть таблицу</Link>
        ) : null}
      </div>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11.5, color: 'var(--fg-2)' }}>
        <div><span style={{ color: 'var(--fg-3)' }}>Начало:</span> {formatInviteDate(invite.startAt)}</div>
        <div><span style={{ color: 'var(--fg-3)' }}>Окончание:</span> {formatInviteDate(invite.endAt)}</div>
        <div><span style={{ color: 'var(--fg-3)' }}>Место:</span> {invite.location || '—'}</div>
        <div><span style={{ color: 'var(--fg-3)' }}>Участников:</span> {(invite.attendeesCount ?? attendees.length) || '—'}</div>
        <div><span style={{ color: 'var(--fg-3)' }}>Статус:</span> {inviteStatusLabel(invite.status)}</div>
        <div><span style={{ color: 'var(--fg-3)' }}>Организатор:</span> {invite.organizerName || invite.organizerEmail || '—'}</div>
      </div>
      {importError ? (
        <div className="em-hint" style={{ marginTop: 8 }}>Встреча распознана, но не перенесена в таблицу: {importError}</div>
      ) : null}
    </div>
  );
}

function RowCheckbox({
  checked,
  indeterminate,
  onClick,
  title,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onClick: (e: React.MouseEvent) => void;
  title?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  const on = Boolean(checked || indeterminate);
  return (
    <label className="relative mt-0.5 inline-flex shrink-0 cursor-pointer select-none" title={title}>
      <input ref={ref} type="checkbox" checked={checked} onChange={() => {}} onClick={onClick} className="sr-only" />
      <span
        className={cx(
          'flex h-[16px] w-[16px] items-center justify-center rounded-[5px] border transition',
          on ? 'border-[#222] bg-[#222]' : 'border-[var(--line-2)] bg-white hover:border-[#888]',
        )}
      >
        {indeterminate ? (
          <span className="block h-0.5 w-2 rounded-sm bg-white" />
        ) : checked ? (
          <svg viewBox="0 0 12 12" className="h-2 w-2 text-white" aria-hidden>
            <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M2.5 6l2.5 2.5L9.5 3" />
          </svg>
        ) : null}
      </span>
    </label>
  );
}

export const EmailInboxPage: React.FC = () => {
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const [searchParams] = useSearchParams();
  const accountDeepLink = searchParams.get('accountId') || '';
  const messageDeepLink = searchParams.get('messageId') || '';
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [folders, setFolders] = useState<EmailFolder[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmailMessage | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [autoSyncBusy, setAutoSyncBusy] = useState(false);
  const [autoSyncError, setAutoSyncError] = useState<string | null>(null);
  const [autoRefreshAt, setAutoRefreshAt] = useState<string | null>(null);
  const [calendarImportingId, setCalendarImportingId] = useState<string | null>(null);
  const [calendarBackfillRunning, setCalendarBackfillRunning] = useState(false);
  const [calendarImportNotice, setCalendarImportNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [flagFilter, setFlagFilter] = useState<'all' | 'starred' | 'calendar' | 'leadless' | 'withCrm'>('all');
  const [fromFilter, setFromFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [folderW, setFolderW] = useState(() => readStoredInt(LS_FOLDER_W, 200, 140, 340));
  const [listW, setListW] = useState(() => readStoredInt(LS_LIST_W, 340, 220, 580));
  const [foldersCollapsed, setFoldersCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_FOLD_COLLAPSE) === '1';
    } catch {
      return false;
    }
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const rangeAnchorRef = useRef<number | null>(null);

  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'forward'>('new');
  const [composeResetKey, setComposeResetKey] = useState(0);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeHtml, setComposeHtml] = useState('<p></p>');
  const [composeLeadId, setComposeLeadId] = useState<string | null>(null);

  const [aiReplySuggestions, setAiReplySuggestions] = useState<string[]>([]);
  const [aiReplySuggestLoading, setAiReplySuggestLoading] = useState(false);
  const [aiReplySuggestOpen, setAiReplySuggestOpen] = useState(false);

  const [folderModal, setFolderModal] = useState<
    null | { kind: 'create'; parentId: string | null } | { kind: 'rename'; folder: EmailFolder }
  >(null);
  const [folderModalBusy, setFolderModalBusy] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTargetIds, setMoveTargetIds] = useState<string[]>([]);

  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  useEffect(() => {
    const fn = () => setVw(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  const isLg = vw >= 1024;

  useEffect(() => {
    try {
      localStorage.setItem(LS_FOLDER_W, String(folderW));
    } catch {
      /* ignore */
    }
  }, [folderW]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LIST_W, String(listW));
    } catch {
      /* ignore */
    }
  }, [listW]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_FOLD_COLLAPSE, foldersCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [foldersCollapsed]);

  useEffect(() => {
    setSelectedIds(new Set());
    rangeAnchorRef.current = null;
  }, [selectedFolderId, accountId, search, readFilter, flagFilter, fromFilter, dateFrom, dateTo]);

  const loadAccounts = useCallback(async () => {
    try {
      const list = await fetchEmailAccounts();
      setAccounts(list);
    } catch {
      /* ignore */
    }
  }, []);

  const loadFolders = useCallback(async () => {
    if (!accountId) {
      setFolders([]);
      return;
    }
    setFolderLoading(true);
    try {
      const list = await fetchEmailFolders(accountId);
      setFolders(list);
    } catch {
      setFolders([]);
    } finally {
      setFolderLoading(false);
    }
  }, [accountId]);

  const loadMessages = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const query: {
        accountId?: string;
        folderId?: string;
        search?: string;
        read?: boolean;
        starred?: boolean;
        hasCalendarInvite?: boolean;
        hasLead?: boolean;
        from?: string;
        dateFrom?: string;
        dateTo?: string;
        limit: number;
        offset: number;
      } = { limit: 100, offset: 0 };
      if (accountId) query.accountId = accountId;
      if (accountId && selectedFolderId) query.folderId = selectedFolderId;
      if (search.trim()) query.search = search.trim();
      if (readFilter === 'read') query.read = true;
      if (readFilter === 'unread') query.read = false;
      if (flagFilter === 'starred') query.starred = true;
      if (flagFilter === 'calendar') query.hasCalendarInvite = true;
      if (flagFilter === 'leadless') query.hasLead = false;
      if (flagFilter === 'withCrm') query.hasLead = true;
      if (fromFilter.trim()) query.from = fromFilter.trim();
      if (dateFrom) query.dateFrom = `${dateFrom}T00:00:00.000Z`;
      if (dateTo) query.dateTo = `${dateTo}T23:59:59.999Z`;
      const res = await fetchEmailMessages(query);
      setMessages(res.items);
      setTotal(res.total);
    } catch (e: any) {
      setError(e?.message || 'load failed');
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [accountId, selectedFolderId, search, readFilter, flagFilter, fromFilter, dateFrom, dateTo]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accountDeepLink) setAccountId(accountDeepLink);
    if (messageDeepLink) setSelectedId(messageDeepLink);
  }, [accountDeepLink, messageDeepLink]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (!folders.length) {
      setSelectedFolderId('');
      return;
    }
    setSelectedFolderId((prev) => {
      if (prev && folders.some((f) => f.id === prev)) return prev;
      return folders.find((f) => f.systemKey === 'inbox')?.id || folders[0].id;
    });
  }, [folders]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setAiReplySuggestions([]);
    setAiReplySuggestOpen(false);
    let alive = true;
    fetchEmailMessage(selectedId)
      .then((m) => {
        if (alive) setDetail(m);
      })
      .catch(() => {
        if (alive) setDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [selectedId]);

  const fetchAiReplySuggestions = useCallback(async (msg: EmailMessage) => {
    setAiReplySuggestLoading(true);
    try {
      const res = await postAiEmailReplySuggest({
        subject: msg.subject ?? undefined,
        body: msg.textBody ?? undefined,
        senderName: msg.fromName ?? undefined,
      });
      if (res.ok && res.suggestions) {
        setAiReplySuggestions(res.suggestions);
        setAiReplySuggestOpen(true);
      }
    } finally {
      setAiReplySuggestLoading(false);
    }
  }, []);

  const selectedAccount = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId]);

  const trashFolderId = useMemo(() => folders.find((f) => f.systemKey === 'trash')?.id, [folders]);

  const systemFoldersOrdered = useMemo(() => {
    const out: EmailFolder[] = [];
    for (const key of ['inbox', 'sent', 'trash'] as const) {
      const f = folders.find((x) => x.systemKey === key);
      if (f) out.push(f);
    }
    return out;
  }, [folders]);

  const userFolderTree = useMemo(() => orderedFolderTree(folders.filter((f) => !f.systemKey)), [folders]);

  const folderRowIcon = useCallback(
    (f: EmailFolder) => <SystemFolderIcon systemKey={f.systemKey} className="h-4 w-4 shrink-0" />,
    [],
  );

  const allSelected = messages.length > 0 && messages.every((m) => selectedIds.has(m.id));
  const someSelected = messages.some((m) => selectedIds.has(m.id)) && !allSelected;
  const unreadInList = useMemo(() => messages.filter((m) => !m.isRead).length, [messages]);

  const folderLabel = useCallback(
    (f: EmailFolder) => {
      if (f.systemKey === 'inbox') return t('crm.email.inbox.sysFolder.inbox');
      if (f.systemKey === 'sent') return t('crm.email.inbox.sysFolder.sent');
      if (f.systemKey === 'trash') return t('crm.email.inbox.sysFolder.trash');
      return f.name;
    },
    [t],
  );

  const currentFolderTitle = useMemo(() => {
    if (!accountId) return 'Все письма';
    const f = folders.find((x) => x.id === selectedFolderId);
    return f ? folderLabel(f) : 'Все письма';
  }, [accountId, folders, selectedFolderId, folderLabel]);

  const refreshVisibleMessages = useCallback(async () => {
    await loadMessages({ silent: true });
    if (selectedId) {
      const fresh = await fetchEmailMessage(selectedId).catch(() => null);
      if (fresh) setDetail(fresh);
    }
    setAutoRefreshAt(formatAutoRefreshTime());
  }, [loadMessages, selectedId]);

  const runMailboxSync = useCallback(
    async (id: string, options?: { silent?: boolean }) => {
      const account = accounts.find((item) => item.id === id);
      if (!account?.hasOAuthTokens && !account?.imapHost) return;
      const silent = Boolean(options?.silent);
      if (silent) {
        if (autoSyncBusy) return;
        setAutoSyncBusy(true);
        setAutoSyncError(null);
      } else {
        setSyncingId(id);
        setSyncError(null);
      }
      try {
        await syncEmailMailboxNow(id, account.hasOAuthTokens ? 'oauth' : 'imap');
        await refreshVisibleMessages();
        await loadFolders();
        await loadAccounts();
      } catch (e: any) {
        const message = e?.message || 'sync failed';
        if (silent) setAutoSyncError(message);
        else setSyncError(message);
      } finally {
        if (silent) setAutoSyncBusy(false);
        else setSyncingId(null);
      }
    },
    [accounts, autoSyncBusy, loadAccounts, loadFolders, refreshVisibleMessages],
  );

  const handleSync = async (id: string) => {
    await runMailboxSync(id);
  };

  const handleImportCalendarInvite = async (messageId: string) => {
    setCalendarImportingId(messageId);
    setCalendarImportNotice(null);
    try {
      const updated = await importEmailCalendarInvite(messageId);
      setMessages((prev) => prev.map((x) => (x.id === updated.id ? { ...x, meta: updated.meta } : x)));
      if (detail?.id === updated.id) setDetail(updated);
      setCalendarImportNotice(
        updated.meta?.calendarInvite ? 'Встреча перенесена в таблицу и календарь.' : 'Письмо проверено, но встречу не удалось распознать.',
      );
    } catch (e: any) {
      setCalendarImportNotice(e?.message || 'Не удалось перенести встречу.');
    } finally {
      setCalendarImportingId(null);
    }
  };

  const handleBackfillCalendarInvites = async () => {
    setCalendarBackfillRunning(true);
    setCalendarImportNotice(null);
    try {
      const result = await backfillEmailCalendarInvites({ accountId: accountId || undefined, limit: 100 });
      setCalendarImportNotice(
        `Импорт встреч: обработано ${result.processed}, перенесено ${result.imported}, пропущено ${result.skipped}, ошибок ${result.failed}.`,
      );
      await loadMessages();
      if (selectedId) {
        const fresh = await fetchEmailMessage(selectedId).catch(() => null);
        if (fresh) setDetail(fresh);
      }
    } catch (e: any) {
      setCalendarImportNotice(e?.message || 'Не удалось перенести встречи.');
    } finally {
      setCalendarBackfillRunning(false);
    }
  };

  useEffect(() => {
    if (!accountId) return;
    let alive = true;
    const refresh = () => {
      if (document.hidden) return;
      void refreshVisibleMessages().catch(() => {
        if (alive) setAutoSyncError('Не удалось автообновить список писем.');
      });
    };
    const timer = window.setInterval(refresh, MAILBOX_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [accountId, refreshVisibleMessages]);

  useEffect(() => {
    if (!accountId || (!selectedAccount?.hasOAuthTokens && !selectedAccount?.imapHost)) return;
    const sync = () => {
      if (document.hidden) return;
      void runMailboxSync(accountId, { silent: true });
    };
    const timer = window.setInterval(sync, MAILBOX_SYNC_MS);
    return () => window.clearInterval(timer);
  }, [accountId, runMailboxSync, selectedAccount?.hasOAuthTokens, selectedAccount?.imapHost]);

  useEffect(() => {
    if (!accountId || !selectedAccount?.hasOAuthTokens) return;
    let running = false;
    const backfill = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const result = await backfillEmailCalendarInvites({ accountId, limit: 100 });
        if (result.imported > 0) {
          setCalendarImportNotice(`Встречи обновлены автоматически: перенесено ${result.imported}.`);
          await refreshVisibleMessages();
        }
      } catch {
        /* quiet background backfill */
      } finally {
        running = false;
      }
    };
    const timer = window.setInterval(() => {
      void backfill();
    }, CALENDAR_BACKFILL_MS);
    return () => window.clearInterval(timer);
  }, [accountId, refreshVisibleMessages, selectedAccount?.hasOAuthTokens]);

  const handleMarkRead = async () => {
    if (!detail || detail.isRead) return;
    try {
      const m = await patchEmailMessage(detail.id, { isRead: true });
      setDetail(m);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, isRead: true } : x)));
    } catch {
      /* ignore */
    }
  };

  const moveMessageToFolder = async (messageId: string, folderId: string) => {
    try {
      await patchEmailMessage(messageId, { crmFolderId: folderId });
      await loadMessages();
      if (selectedId === messageId) {
        const m = await fetchEmailMessage(messageId);
        setDetail(m);
      }
    } catch {
      /* ignore */
    }
  };

  const toggleStar = async (m: EmailMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !Boolean(m.isStarred);
    try {
      await patchEmailMessage(m.id, { isStarred: next });
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, isStarred: next } : x)));
      if (detail?.id === m.id) setDetail({ ...detail, isStarred: next });
    } catch {
      /* ignore */
    }
  };

  const onToggleRowSelect = (m: EmailMessage, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && rangeAnchorRef.current != null) {
      const a = Math.min(rangeAnchorRef.current, index);
      const b = Math.max(rangeAnchorRef.current, index);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        for (let i = a; i <= b; i++) {
          if (messages[i]) n.add(messages[i].id);
        }
        return n;
      });
    } else {
      rangeAnchorRef.current = index;
      setSelectedIds((prev) => {
        const n = new Set(prev);
        if (n.has(m.id)) n.delete(m.id);
        else n.add(m.id);
        return n;
      });
    }
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      rangeAnchorRef.current = null;
    } else {
      setSelectedIds(new Set(messages.map((m) => m.id)));
    }
  };

  const bulkMarkRead = async () => {
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await patchEmailMessage(id, { isRead: true });
      } catch {
        /* ignore */
      }
    }
    setMessages((prev) => prev.map((x) => (selectedIds.has(x.id) ? { ...x, isRead: true } : x)));
    if (detail && selectedIds.has(detail.id)) setDetail({ ...detail, isRead: true });
    setSelectedIds(new Set());
    rangeAnchorRef.current = null;
  };

  const bulkTrash = async () => {
    if (!trashFolderId) return;
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await patchEmailMessage(id, { crmFolderId: trashFolderId });
      } catch {
        /* ignore */
      }
    }
    setSelectedIds(new Set());
    rangeAnchorRef.current = null;
    await loadMessages();
  };

  const deleteMessages = async (ids: string[]) => {
    if (!ids.length) return;
    const ok = await showConfirm(t('crm.email.inbox.deleteMessagesConfirm', { count: ids.length }), {
      title: t('crm.email.inbox.deleteMessagesTitle'),
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    for (const id of ids) {
      try {
        await deleteEmailMessage(id);
      } catch {
        /* ignore */
      }
    }
    setSelectedIds((prev) => {
      const n = new Set(prev);
      for (const id of ids) n.delete(id);
      return n;
    });
    if (detail && ids.includes(detail.id)) {
      setSelectedId(null);
      setDetail(null);
    }
    rangeAnchorRef.current = null;
    await loadMessages();
  };

  const openBulkDeleteMessages = () => {
    if (selectedIds.size === 0) return;
    void deleteMessages([...selectedIds]);
  };

  const openDetailDeleteMessage = () => {
    if (!detail) return;
    void deleteMessages([detail.id]);
  };

  const bulkMarkUnread = async () => {
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await patchEmailMessage(id, { isRead: false });
      } catch {
        /* ignore */
      }
    }
    setMessages((prev) => prev.map((x) => (selectedIds.has(x.id) ? { ...x, isRead: false } : x)));
    if (detail && selectedIds.has(detail.id)) setDetail({ ...detail, isRead: false });
    setSelectedIds(new Set());
    rangeAnchorRef.current = null;
  };

  const openMoveModalForSelection = () => {
    if (selectedIds.size === 0) return;
    setMoveTargetIds([...selectedIds]);
    setMoveModalOpen(true);
  };

  const openMoveModalForDetail = () => {
    if (!detail) return;
    setMoveTargetIds([detail.id]);
    setMoveModalOpen(true);
  };

  const bulkMoveToFolder = async (folderId: string) => {
    const ids = moveTargetIds.length > 0 ? moveTargetIds : [...selectedIds];
    if (ids.length === 0) return;
    for (const id of ids) {
      try {
        await patchEmailMessage(id, { crmFolderId: folderId });
      } catch {
        /* ignore */
      }
    }
    setSelectedIds((prev) => {
      const n = new Set(prev);
      for (const id of ids) n.delete(id);
      return n;
    });
    rangeAnchorRef.current = null;
    setMoveTargetIds([]);
    await loadMessages();
  };

  const handleMarkUnread = async () => {
    if (!detail || !detail.isRead) return;
    try {
      const m = await patchEmailMessage(detail.id, { isRead: false });
      setDetail(m);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, isRead: false } : x)));
    } catch {
      /* ignore */
    }
  };

  const startResizeFolder = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = folderW;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      setFolderW(Math.min(340, Math.max(140, startW + dx)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResizeList = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = listW;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      setListW(Math.min(580, Math.max(220, startW + dx)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const openNewCompose = () => {
    setComposeMode('new');
    setComposeTo('');
    setComposeSubject('');
    setComposeHtml('<p></p>');
    setComposeLeadId(null);
    setComposeResetKey((k) => k + 1);
    setComposeOpen(true);
  };

  const openReply = (prefillText?: string) => {
    if (!detail || detail.direction !== 'incoming') return;
    setComposeMode('reply');
    setComposeTo(detail.from);
    setComposeSubject(replySubject(detail.subject));
    const base = replyInitialHtml(detail);
    setComposeHtml(prefillText ? `<p>${prefillText.replace(/\n/g, '</p><p>')}</p>${base}` : base);
    setComposeLeadId(detail.leadId);
    setComposeResetKey((k) => k + 1);
    setComposeOpen(true);
  };

  const openReplyAll = () => {
    if (!detail || detail.direction !== 'incoming') return;
    const own = selectedAccount?.email?.toLowerCase();
    const recipients = [detail.from, ...(detail.to || [])]
      .filter(Boolean)
      .filter((addr, i, arr) => arr.findIndex((x) => x.toLowerCase() === addr.toLowerCase()) === i)
      .filter((addr) => addr.toLowerCase() !== own);
    setComposeMode('reply');
    setComposeTo(recipients.join(', '));
    setComposeSubject(replySubject(detail.subject));
    setComposeHtml(replyInitialHtml(detail));
    setComposeLeadId(detail.leadId);
    setComposeResetKey((k) => k + 1);
    setComposeOpen(true);
  };

  const openForward = () => {
    if (!detail) return;
    setComposeMode('forward');
    setComposeTo('');
    setComposeSubject(forwardSubject(detail.subject));
    setComposeHtml(forwardInitialHtml(detail));
    setComposeLeadId(null);
    setComposeResetKey((k) => k + 1);
    setComposeOpen(true);
  };

  const submitFolderModal = async (name: string) => {
    if (!accountId || !folderModal) return;
    setFolderModalBusy(true);
    try {
      if (folderModal.kind === 'create') {
        await createEmailFolder({ accountId, name, parentId: folderModal.parentId });
      } else {
        await patchEmailFolder(folderModal.folder.id, { name });
      }
      setFolderModal(null);
      await loadFolders();
    } catch {
      /* ignore */
    } finally {
      setFolderModalBusy(false);
    }
  };

  const deleteFolder = async (folder: EmailFolder) => {
    const ok = await showConfirm(t('crm.email.inbox.deleteFolderConfirm'), {
      title: t('crm.email.inbox.deleteFolder'),
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEmailFolder(folder.id);
      await loadFolders();
      await loadMessages();
    } catch {
      /* ignore */
    }
  };

  const reorderSibling = async (folderId: string, delta: number) => {
    if (!accountId) return;
    const f = folders.find((x) => x.id === folderId);
    if (!f) return;
    const pid = f.parentId ?? null;
    const sibs = folders
      .filter((x) => (x.parentId ?? null) === pid)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
    const idx = sibs.findIndex((x) => x.id === folderId);
    const j = idx + delta;
    if (idx < 0 || j < 0 || j >= sibs.length) return;
    const next = [...sibs];
    [next[idx], next[j]] = [next[j], next[idx]];
    const items = next.map((x, i) => ({ id: x.id, sortOrder: i, parentId: x.parentId ?? null }));
    try {
      await reorderEmailFolders({ accountId, items });
      await loadFolders();
    } catch {
      /* ignore */
    }
  };

  const onFolderDrop = async (e: React.DragEvent, targetFolderId: string | 'root') => {
    e.preventDefault();
    e.stopPropagation();
    const mid = e.dataTransfer.getData('messageId');
    const fid = e.dataTransfer.getData('folderId');
    if (mid && accountId) {
      const dest = targetFolderId === 'root' ? folders.find((x) => x.systemKey === 'inbox')?.id : targetFolderId;
      if (dest) await moveMessageToFolder(mid, dest);
      return;
    }
    if (fid && accountId) {
      const dragged = folders.find((x) => x.id === fid);
      if (!dragged || dragged.systemKey) return;
      const parentId = targetFolderId === 'root' ? null : targetFolderId;
      if (parentId === fid) return;
      try {
        await patchEmailFolder(fid, { parentId });
        await loadFolders();
      } catch {
        /* ignore */
      }
    }
  };

  const mobileDetailOpen = !isLg && Boolean(selectedId);
  const anyOAuth = accounts.some((a) => a.hasOAuthTokens);
  const hasActiveFilters = Boolean(search || readFilter !== 'all' || flagFilter !== 'all' || fromFilter || dateFrom || dateTo);

  return (
    <MainLayout>
      <PageHelpButton topic="emailInbox" />
      <div className="px-scope">
        <div className="em-hero" style={{ marginBottom: 14 }}>
          <div>
            <div className="kicker">
              <span className="dot" />
              ПОЧТА · ВХОДЯЩИЕ
            </div>
            <h1>Входящие</h1>
            <p className="sub">Письма со всех подключённых аккаунтов, связанные с контактами и сделками CRM</p>
          </div>
          <div className="em-hero-r">
            <button type="button" className="em-btn" onClick={() => void loadMessages()}>
              <Ic d={NI.refresh} size={14} />
              Обновить
            </button>
            <button
              type="button"
              className="em-btn"
              disabled={accounts.length === 0}
              onClick={() => setBulkSendOpen(true)}
              title="Массовая рассылка"
            >
              <Ic d={NI.send} size={14} />
              Рассылка
            </button>
            <Link to="/email" className="em-btn">
              <Ic d={NI.task} size={14} />
              Настройки почты
            </Link>
            <button type="button" className="em-btn solid" disabled={accounts.length === 0} onClick={openNewCompose}>
              <Ic d={NI.plus} size={14} />
              Новое письмо
            </button>
          </div>
        </div>

        <div className="in-top">
          <div className="in-search">
            <Ic d={NI.search} size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по отправителю, теме, тексту…" />
          </div>
          {accountId && (selectedAccount?.hasOAuthTokens || selectedAccount?.imapHost) ? (
            <button type="button" className="in-btn sm" disabled={syncingId === accountId} onClick={() => void handleSync(accountId)}>
              <Ic d={NI.refresh} size={12} />
              {syncingId === accountId ? 'Синхронизация…' : 'Синхронизировать'}
            </button>
          ) : null}
          {(accountId ? selectedAccount?.hasOAuthTokens : anyOAuth) ? (
            <button type="button" className="in-btn sm" disabled={calendarBackfillRunning} onClick={() => void handleBackfillCalendarInvites()}>
              <Ic d={NI.cal} size={12} />
              {calendarBackfillRunning ? 'Переносим встречи…' : 'Перенести встречи'}
            </button>
          ) : null}
          <select className="em-in" style={{ width: 140 }} value={readFilter} onChange={(e) => setReadFilter(e.target.value as typeof readFilter)}>
            <option value="all">Все статусы</option>
            <option value="unread">Непрочитанные</option>
            <option value="read">Прочитанные</option>
          </select>
          <select className="em-in" style={{ width: 150 }} value={flagFilter} onChange={(e) => setFlagFilter(e.target.value as typeof flagFilter)}>
            <option value="all">Все письма</option>
            <option value="withCrm">Связанные с CRM</option>
            <option value="starred">Со звездой</option>
            <option value="calendar">С приглашением</option>
            <option value="leadless">Без лида</option>
          </select>
          <input className="em-in" style={{ width: 150 }} value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} placeholder="Отправитель" />
          <input className="em-in mono" style={{ width: 132 }} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input className="em-in mono" style={{ width: 132 }} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {hasActiveFilters ? (
            <button
              type="button"
              className="in-btn ghost sm"
              onClick={() => {
                setSearch('');
                setReadFilter('all');
                setFlagFilter('all');
                setFromFilter('');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Сбросить
            </button>
          ) : null}
          <span className="in-sp" />
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--fg-3)' }}>
            {autoSyncBusy ? 'Автосинхронизация…' : autoRefreshAt ? `Обновлено ${autoRefreshAt}` : 'Автообновление каждые 30 сек'}
          </span>
        </div>

        {error ? <div className="em-err" style={{ marginBottom: 12 }}><Ic d={NI.spam} size={15} /><div className="b"><div className="t">{error}</div></div></div> : null}
        {autoSyncError ? <div className="em-hint" style={{ marginBottom: 12 }}>{autoSyncError}</div> : null}
        {calendarImportNotice ? <div className="em-info" style={{ marginBottom: 12 }}><Ic d={NI.cal} size={15} /><span>{calendarImportNotice}</span></div> : null}

        <div className="in-wrap" style={{ display: 'flex' }}>
          {isLg ? (
            foldersCollapsed ? (
              <div className="in-nav" style={{ width: 34, flexShrink: 0, padding: 6 }}>
                <button type="button" className="in-ico sm" onClick={() => setFoldersCollapsed(false)} title="Показать папки" style={{ margin: '0 auto' }}>
                  <span style={{ transform: 'rotate(180deg)', display: 'flex' }}><Ic d={NI.chevL} size={14} /></span>
                </button>
              </div>
            ) : (
              <>
                <div className="in-nav" style={{ width: folderW, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 8px' }}>
                    <span className="in-nav-l" style={{ padding: 0 }}>Аккаунт</span>
                    <button type="button" className="in-ico sm" onClick={() => setFoldersCollapsed(true)} title="Свернуть папки">
                      <Ic d={NI.chevL} size={12} />
                    </button>
                  </div>
                  <div className="in-acc-sel">
                    <span className="l">Почтовый ящик</span>
                    <select
                      value={accountId}
                      onChange={(e) => {
                        setAccountId(e.target.value);
                        setSelectedId(null);
                      }}
                    >
                      <option value="">Все почтовые ящики</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.email}
                          {a.hasOAuthTokens ? ' · OAuth' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!accountId ? (
                    <p className="em-hint">Выберите почтовый ящик, чтобы увидеть папки.</p>
                  ) : (
                  <>
                  <div className="in-nav-l">Папки</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {systemFoldersOrdered.map((f) => (
                      <button
                        key={f.id}
                        className={cx('in-fold', selectedFolderId === f.id && 'on')}
                        onClick={() => setSelectedFolderId(f.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => void onFolderDrop(e, f.id)}
                      >
                        <SystemFolderIcon systemKey={f.systemKey} className="h-[14px] w-[14px]" />
                        <span className="t">{folderLabel(f)}</span>
                      </button>
                    ))}
                  </div>

                  <div className="in-nav-l" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Мои папки</span>
                    <button
                      type="button"
                      onClick={() => setFolderModal({ kind: 'create', parentId: null })}
                      className="in-ico sm"
                      title="Новая папка"
                    >
                      <Ic d={NI.plus} size={11} />
                    </button>
                  </div>
                  {folderLoading ? (
                    <div className="em-hint">Загрузка…</div>
                  ) : (
                    <div
                      style={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => void onFolderDrop(e, 'root')}
                    >
                      {userFolderTree.map(({ f, depth }) => (
                        <div
                          key={f.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('folderId', f.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => void onFolderDrop(e, f.id)}
                          className="group"
                          style={{ paddingLeft: depth * 12 }}
                        >
                          <button
                            type="button"
                            className={cx('in-fold', selectedFolderId === f.id && 'on')}
                            onClick={() => setSelectedFolderId(f.id)}
                          >
                            <OutlineIconFolder className="h-[14px] w-[14px]" />
                            <span className="t">{f.name}</span>
                          </button>
                          <div className="hidden gap-1 pl-2 group-hover:flex" style={{ marginTop: 1 }}>
                            <button type="button" className="in-ico sm" title="Вверх" onClick={() => void reorderSibling(f.id, -1)}>↑</button>
                            <button type="button" className="in-ico sm" title="Вниз" onClick={() => void reorderSibling(f.id, 1)}>↓</button>
                            <button type="button" className="in-ico sm" title="Переименовать" onClick={() => setFolderModal({ kind: 'rename', folder: f })}>
                              <Ic d={NI.draft} size={11} />
                            </button>
                            <button type="button" className="in-ico sm" title="Удалить" onClick={() => void deleteFolder(f)}>
                              <Ic d={NI.trash} size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="em-hint" style={{ marginTop: 8 }}>Перетащите письмо или папку сюда</div>
                  </>
                  )}
                </div>
                <div
                  role="separator"
                  aria-label="resize folders"
                  style={{ width: 6, flexShrink: 0, cursor: 'col-resize', background: 'var(--line-3)' }}
                  onMouseDown={startResizeFolder}
                />
              </>
            )
          ) : null}

          <div
            className={cx(mobileDetailOpen ? 'hidden' : 'flex', 'in-list')}
            style={isLg ? { width: listW, flexShrink: 0, flexDirection: 'column' } : { width: '100%', flexShrink: 0, flexDirection: 'column' }}
          >
            <div className="in-list-h">
              <RowCheckbox
                checked={allSelected && messages.length > 0}
                indeterminate={someSelected}
                onClick={(e) => {
                  e.preventDefault();
                  toggleSelectAll();
                }}
                title="Выбрать все"
              />
              <span className="t">{currentFolderTitle}</span>
              <span className="n">{unreadInList > 0 ? `${unreadInList} непрочитанных` : `${total} всего`}</span>
              <span className="sp" />
              <div className="in-seg">
                <button className={flagFilter !== 'withCrm' ? 'on' : ''} onClick={() => setFlagFilter('all')}>Все</button>
                <button className={flagFilter === 'withCrm' ? 'on' : ''} onClick={() => setFlagFilter('withCrm')}>С CRM</button>
              </div>
            </div>

            {selectedIds.size > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--line-3)', background: 'var(--bg-muted)' }}>
                <span style={{ fontSize: 11, color: 'var(--fg-2)', alignSelf: 'center' }}>{selectedIds.size} выбрано</span>
                <button type="button" className="in-btn sm" onClick={() => void bulkMarkRead()}>Прочитано</button>
                <button type="button" className="in-btn sm" onClick={() => void bulkMarkUnread()}>Непрочитано</button>
                <button type="button" className="in-btn sm" onClick={openMoveModalForSelection}>В папку</button>
                {trashFolderId ? <button type="button" className="in-btn sm" onClick={() => void bulkTrash()}>В корзину</button> : null}
                <button type="button" className="in-btn sm" style={{ color: '#b0233a' }} onClick={openBulkDeleteMessages}>Удалить</button>
                <button
                  type="button"
                  className="in-btn ghost sm"
                  onClick={() => {
                    setSelectedIds(new Set());
                    rangeAnchorRef.current = null;
                  }}
                >
                  Снять выбор
                </button>
              </div>
            ) : null}

            <div className="in-scroll">
              {!loading && messages.length === 0 ? (
                <div className="em-empty">
                  <b>Писем нет</b>
                  <p>{accountId ? 'В этой папке пока пусто.' : 'Подключите почтовый аккаунт, чтобы увидеть письма.'}</p>
                </div>
              ) : null}
              {(() => {
                let lastDay: string | null = null;
                return messages.map((m, index) => {
                  const bucket = dayBucket(m.date);
                  const showDay = bucket !== lastDay;
                  lastDay = bucket;
                  const unread = !m.isRead;
                  const tag = crmTag(m);
                  const hasClip = Boolean(m.attachments?.length) || Boolean(m.meta?.hasCalendarAttachment);
                  return (
                    <React.Fragment key={m.id}>
                      {showDay && <div className="in-day">{bucket}</div>}
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('messageId', m.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className={cx('in-item', (selectedIds.has(m.id) || selectedId === m.id) && 'sel', unread && 'unread')}
                        style={{ gridTemplateColumns: '16px 28px minmax(0,1fr)' }}
                        onClick={() => setSelectedId(m.id)}
                      >
                        <span style={{ marginTop: 2 }} onClick={(e) => e.stopPropagation()}>
                          <RowCheckbox checked={selectedIds.has(m.id)} onClick={(e) => onToggleRowSelect(m, index, e)} title="Выбрать" />
                        </span>
                        <span className="in-av">{initialsOf(m.fromName, m.direction === 'incoming' ? m.from : (m.to || [])[0] || '')}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="in-r1">
                            <button
                              type="button"
                              onClick={(e) => void toggleStar(m, e)}
                              style={{ color: m.isStarred ? 'var(--ink)' : 'var(--fg-4)', lineHeight: 1, flexShrink: 0 }}
                              title="Звезда"
                            >
                              <Ic d={NI.star} size={12} />
                            </button>
                            <span className="in-from">{m.direction === 'incoming' ? (m.fromName || m.from) : `Кому: ${(m.to || []).join(', ')}`}</span>
                            {hasClip && <span className="in-clip"><Ic d={NI.clip} size={12} /></span>}
                            <span className="in-time">{shortTime(m.date)}</span>
                          </div>
                          <div className="in-subj">{m.subject || '(без темы)'}</div>
                          <div className="in-snip">{snippetOf(m)}</div>
                          {tag && (
                            <div className="in-tags">
                              <span className={'in-tag ' + tag.cls}>{tag.label}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                });
              })()}
            </div>
          </div>

          {isLg ? (
            <div
              role="separator"
              aria-label="resize list"
              style={{ width: 6, flexShrink: 0, cursor: 'col-resize', background: 'var(--line-3)' }}
              onMouseDown={startResizeList}
            />
          ) : null}

          <div className={cx(!isLg && !selectedId && 'hidden', 'in-read')} style={{ flex: 1, minWidth: 0 }}>
            {!detail ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
                {selectedId ? 'Загрузка…' : 'Выберите письмо'}
              </div>
            ) : (
              <>
                <div className="in-rh">
                  {!isLg ? (
                    <button type="button" className="in-btn sm" style={{ marginBottom: 10 }} onClick={() => setSelectedId(null)}>
                      ← Назад
                    </button>
                  ) : null}
                  <div className="in-rh-top">
                    <button
                      type="button"
                      onClick={(e) => void toggleStar(detail, e)}
                      style={{ color: detail.isStarred ? 'var(--ink)' : 'var(--fg-4)', flexShrink: 0 }}
                      title="Звезда"
                    >
                      <Ic d={NI.star} size={17} />
                    </button>
                    <h2>{detail.subject || '(без темы)'}</h2>
                    <div className="in-rh-acts">
                      <button type="button" className="in-ico" title="В папку" onClick={openMoveModalForDetail}>
                        <Ic d={NI.folder} size={14} />
                      </button>
                      {trashFolderId ? (
                        <button type="button" className="in-ico" title="В корзину" onClick={() => void moveMessageToFolder(detail.id, trashFolderId)}>
                          <Ic d={NI.arch} size={14} />
                        </button>
                      ) : null}
                      <button type="button" className="in-ico" title="Удалить навсегда" onClick={openDetailDeleteMessage}>
                        <Ic d={NI.trash} size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="in-rh-meta">
                    <div className="in-rh-who">
                      <span className="av">{initialsOf(detail.fromName, detail.from)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="nm">{detail.direction === 'incoming' ? (detail.fromName || detail.from) : `Кому: ${(detail.to || []).join(', ')}`}</div>
                        <div className="ad">{detail.direction === 'incoming' ? detail.from : detail.from}</div>
                      </div>
                    </div>
                    <span className="in-sp" />
                    <span className="in-time">{dayBucket(detail.date)}, {shortTime(detail.date)}</span>
                  </div>
                  <div className="em-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                    {detail.direction === 'incoming' ? (
                      <button type="button" className="in-btn solid sm" disabled={accounts.length === 0} onClick={() => openReply()}>
                        <Ic d={NI.reply} size={12} />
                        Ответить
                      </button>
                    ) : null}
                    {detail.direction === 'incoming' ? (
                      <button type="button" className="in-btn sm" disabled={accounts.length === 0} onClick={openReplyAll}>
                        <Ic d={NI.replyAll} size={12} />
                        Всем
                      </button>
                    ) : null}
                    <button type="button" className="in-btn sm" disabled={accounts.length === 0} onClick={openForward}>
                      <Ic d={NI.fwd} size={12} />
                      Переслать
                    </button>
                    {!detail.isRead ? (
                      <button type="button" className="in-btn sm" onClick={() => void handleMarkRead()}>Прочитано</button>
                    ) : (
                      <button type="button" className="in-btn sm" onClick={() => void handleMarkUnread()}>Непрочитано</button>
                    )}
                    {detail.meta?.hasCalendarAttachment && (!detail.meta.calendarInvite || detail.meta.calendarInviteImportError) ? (
                      <button type="button" className="in-btn sm" disabled={calendarImportingId === detail.id} onClick={() => void handleImportCalendarInvite(detail.id)}>
                        <Ic d={NI.cal} size={12} />
                        {calendarImportingId === detail.id ? 'Переносим…' : detail.meta.calendarInviteImportError ? 'Повторить перенос' : 'В календарь'}
                      </button>
                    ) : null}
                    <span className="in-sp" />
                    {detail.leadId ? (
                      <Link to={`/leads/${detail.leadId}`} className="in-tag lead" style={{ padding: '5px 10px' }}>
                        <Ic d={NI.bolt} size={12} />
                        Открыть лид
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="in-rbody">
                  {(detail.leadId || detail.contactId || detail.companyId || detail.saleId) && (
                    <div className="in-crm">
                      <span className="l">Связано</span>
                      {detail.leadId && (
                        <Link to={`/leads/${detail.leadId}`} className="card">
                          <Ic d={NI.bolt} size={13} /><b>Лид</b>
                        </Link>
                      )}
                      {detail.contactId && (
                        <Link to={`/contacts/${detail.contactId}`} className="card">
                          <Ic d={NI.user} size={13} /><b>Контакт</b>
                        </Link>
                      )}
                      {detail.companyId && (
                        <Link to={`/companies/${detail.companyId}`} className="card">
                          <Ic d={NI.deal} size={13} /><b>Компания</b>
                        </Link>
                      )}
                      {detail.saleId && (
                        <Link to={`/sales/${detail.saleId}`} className="card">
                          <Ic d={NI.deal} size={13} /><b>Сделка</b>
                        </Link>
                      )}
                      <span className="sp" />
                    </div>
                  )}

                  {detail.meta?.calendarInvite ? (
                    <div style={{ marginBottom: 16 }}>
                      <CalendarInviteCard invite={detail.meta.calendarInvite} importError={detail.meta.calendarInviteImportError} />
                    </div>
                  ) : null}

                  {detail.direction === 'incoming' && (
                    <div className="em-fs" style={{ border: '1px solid var(--line-2)', borderRadius: 11, padding: 12, marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-3)' }}>
                          AI варианты ответа
                        </span>
                        <button
                          type="button"
                          disabled={aiReplySuggestLoading}
                          onClick={() => {
                            if (aiReplySuggestions.length > 0) setAiReplySuggestOpen((v) => !v);
                            else void fetchAiReplySuggestions(detail);
                          }}
                          className="in-btn ghost sm"
                        >
                          <Ic d={NI.sparkle} size={12} />
                          {aiReplySuggestLoading ? 'Генерация…' : aiReplySuggestions.length > 0 ? (aiReplySuggestOpen ? 'Скрыть' : 'Показать') : 'Предложить ответ'}
                        </button>
                      </div>
                      {aiReplySuggestOpen && aiReplySuggestions.length > 0 && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {aiReplySuggestions.map((s, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', border: '1px solid var(--line-2)', borderRadius: 9, padding: '8px 10px', background: '#fff' }}>
                              <p style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: 'var(--fg-1)', margin: 0 }}>{s}</p>
                              <button type="button" className="in-btn sm" onClick={() => openReply(s)}>Ответить</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="in-rtext">
                    {detail.htmlBody ? (
                      <iframe
                        title={detail.subject || 'Email message'}
                        style={{ width: '100%', minHeight: 420, border: '1px solid var(--line-2)', borderRadius: 11, background: '#fff' }}
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                        referrerPolicy="no-referrer"
                        srcDoc={buildEmailMessageSrcDoc(detail.htmlBody)}
                      />
                    ) : (
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13.5 }}>{detail.textBody || '—'}</pre>
                    )}
                  </div>

                  {detail.attachments && detail.attachments.length > 0 ? (
                    <div className="in-atts">
                      {detail.attachments.map((a, i) =>
                        a.url ? (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="in-att">
                            <Ic d={NI.file} size={16} />
                            <span><b>{a.filename}</b><i>{fmtSize(a.size)}</i></span>
                          </a>
                        ) : (
                          <span key={i} className="in-att" style={{ cursor: 'default' }}>
                            <Ic d={NI.file} size={16} />
                            <span><b>{a.filename}</b><i>{fmtSize(a.size)}</i></span>
                          </span>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <EmailBulkSendModal open={bulkSendOpen} onClose={() => setBulkSendOpen(false)} />

      <EmailComposeWindow
        open={composeOpen}
        mode={composeMode}
        accounts={accounts}
        accountId={accountId || accounts[0]?.id || ''}
        onAccountChange={(id) => {
          setAccountId(id);
          setSelectedId(null);
        }}
        initialTo={composeTo}
        initialSubject={composeSubject}
        initialHtml={composeHtml}
        resetKey={composeResetKey}
        leadId={composeLeadId}
        onClose={() => setComposeOpen(false)}
        onSent={() => void loadMessages()}
      />

      <button
        type="button"
        onClick={openNewCompose}
        disabled={accounts.length === 0}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-xl border border-[#222] bg-[#222] text-xl font-light text-white shadow-lg transition hover:bg-black disabled:hidden md:hidden"
        aria-label="Новое письмо"
      >
        +
      </button>

      <EmailFolderModal
        open={!!folderModal}
        title={folderModal?.kind === 'rename' ? t('crm.email.inbox.folderModalRenameTitle') : t('crm.email.inbox.folderModalCreateTitle')}
        initialName={folderModal?.kind === 'rename' ? folderModal.folder.name : ''}
        hint={
          folderModal?.kind === 'create' && folderModal.parentId
            ? t('crm.email.inbox.folderModalSubfolderHint', { name: folders.find((x) => x.id === folderModal.parentId)?.name || '—' })
            : undefined
        }
        submitLabel={folderModal?.kind === 'rename' ? t('crm.common.save') : t('crm.email.inbox.folderModalCreateSubmit')}
        busy={folderModalBusy}
        onClose={() => setFolderModal(null)}
        onSubmit={submitFolderModal}
      />

      <EmailMoveToFolderModal
        open={moveModalOpen}
        folders={folders}
        onClose={() => {
          setMoveModalOpen(false);
          setMoveTargetIds([]);
        }}
        onPick={(fid) => bulkMoveToFolder(fid)}
        folderLabel={folderLabel}
        folderRowIcon={folderRowIcon}
      />

      <CrmShellModal open={!!syncError} title={t('crm.common.modalError')} message={syncError || ''} variant="error" onClose={() => setSyncError(null)} />
    </MainLayout>
  );
};

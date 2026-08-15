import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmailBulkSendModal } from './EmailBulkSendModal';
import { postAiEmailReplySuggest } from '../../api/ai';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { CrmShellModal } from '../../components/ui/CrmShellModal';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { EmailComposeWindow } from './EmailComposeWindow';
import { EmailFolderModal } from './EmailFolderModal';
import { EmailMoveToFolderModal } from './EmailMoveToFolderModal';
import {
  IconCalendar,
  IconEuro,
  IconFolder,
  IconMail,
  IconPencil,
  SystemFolderIcon,
} from './EmailOutlineIcons';
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

const TEAL = '#45a094';
const LS_FOLDER_W = 'lumiva-email-folder-w';
const LS_LIST_W = 'lumiva-email-list-w';
const LS_FOLD_COLLAPSE = 'lumiva-email-folders-collapsed';
const MAILBOX_REFRESH_MS = 30_000;
const MAILBOX_SYNC_MS = 120_000;
const CALENDAR_BACKFILL_MS = 300_000;

const leadBadgeClass =
  'inline-flex items-center rounded-2xl px-3 py-1 text-xs font-semibold text-white shadow-md transition hover:opacity-95';
const leadBadgeStyle = { backgroundColor: TEAL, boxShadow: '0 6px 20px rgba(69,160,148,0.35)' };

/** Пилюли: белый фон + чёрная обводка / акцент; hover — слегка slate-50 (не «серый снизу»). */
const BTN_PRIMARY = 'btn-primary';
const BTN_SECONDARY = 'btn-secondary';
const BTN_SECONDARY_SM = 'btn-secondary-sm';
const FOLDER_ACTION = 'btn-icon px-1.5 py-0.5 text-[9px] rounded-md';
const FOLDER_ACTION_DANGER = 'btn-icon-danger px-1.5 py-0.5 text-[9px] rounded-md';
const BTN_SECONDARY_LIGHT = 'btn-secondary';
const BTN_GENTLE_ROSE = 'btn-danger';

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
    html, body { margin: 0; background: #fff; color: #0f172a; }
    body {
      padding: 12px;
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow-wrap: anywhere;
    }
    a { color: ${TEAL}; text-decoration: underline; }
    img, video, canvas, svg { max-width: 100%; height: auto; }
    table { max-width: 100%; border-collapse: collapse; }
    pre { white-space: pre-wrap; }
    blockquote { margin-left: 0; padding-left: 12px; border-left: 3px solid #cbd5e1; color: #334155; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

function replyInitialHtml(m: EmailMessage): string {
  const subj = escapeHtml(m.subject || '—');
  if (m.htmlBody && m.htmlBody.trim()) {
    return `<p></p><p><br></p><hr/><p style="color:#94a3b8;font-size:12px">${subj}</p><blockquote style="margin:8px 0;padding-left:12px;border-left:2px solid #475569;color:#cbd5e1">${m.htmlBody}</blockquote>`;
  }
  const txt = escapeHtml((m.textBody || '').slice(0, 50_000));
  return `<p></p><p><br></p><hr/><p style="color:#94a3b8">${subj}</p><pre style="white-space:pre-wrap;font-family:inherit;font-size:13px">${txt}</pre>`;
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

function MessageRowIcon({ m }: { m: EmailMessage }) {
  const cn = 'h-4 w-4 shrink-0 text-slate-500';
  if (m.meta && typeof m.meta === 'object' && (m.meta as { hasCalendarAttachment?: boolean }).hasCalendarAttachment) {
    return <IconCalendar className={cn} />;
  }
  const subj = (m.subject || '').toLowerCase();
  if (/оплат|платеж|payment|invoice|счёт|счет|eur|€|\beuro\b|usd|\$|цена|price/.test(subj)) {
    return <IconEuro className={cn} />;
  }
  if (/заметк|note|напоминан|reminder|todo|задач|draft|черновик/.test(subj)) {
    return <IconPencil className={cn} />;
  }
  return <IconMail className={cn} />;
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
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CalendarInviteCard({
  invite,
  importError,
}: {
  invite: EmailCalendarInviteMeta;
  importError?: string | null;
}) {
  const attendees = Array.isArray(invite.attendees) ? invite.attendees.filter(Boolean) : [];
  return (
    <div className="mx-3 mb-2 mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Встреча из письма
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {invite.title || 'Встреча'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {invite.workspaceCalendarPath ? (
            <Link
              to={invite.workspaceCalendarPath}
              className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100"
            >
              Открыть календарь
            </Link>
          ) : null}
          {invite.workspaceTablePath ? (
            <Link
              to={invite.workspaceTablePath}
              className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100"
            >
              Открыть таблицу
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-slate-700 sm:grid-cols-2">
        <div><span className="text-slate-500">Начало:</span> {formatInviteDate(invite.startAt)}</div>
        <div><span className="text-slate-500">Окончание:</span> {formatInviteDate(invite.endAt)}</div>
        <div><span className="text-slate-500">Место:</span> {invite.location || '—'}</div>
        <div><span className="text-slate-500">Участников:</span> {(invite.attendeesCount ?? attendees.length) || '—'}</div>
        <div><span className="text-slate-500">Статус:</span> {inviteStatusLabel(invite.status)}</div>
        <div>
          <span className="text-slate-500">Организатор:</span>{' '}
          {invite.organizerName || invite.organizerEmail || '—'}
        </div>
      </div>
      {attendees.length ? (
        <div className="mt-2 break-words text-[11px] text-slate-600">
          <span className="text-slate-500">Участники:</span> {attendees.join(', ')}
        </div>
      ) : null}
      {importError ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
          Встреча распознана, но не перенесена в таблицу: {importError}
        </div>
      ) : null}
    </div>
  );
}

function EmailCheckbox({
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
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={() => {}}
        onClick={onClick}
        className="sr-only"
      />
      <span
        className={`flex h-[18px] w-[18px] items-center justify-center rounded-md border transition ${
          on
            ? 'border-lumiva-accent bg-lumiva-accent shadow-[0_0_0_1px_rgba(34,34,34,0.12)]'
            : 'border-slate-300 bg-white hover:border-slate-500'
        }`}
      >
        {indeterminate ? (
          <span className="block h-0.5 w-2.5 rounded-sm bg-white" />
        ) : checked ? (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white" aria-hidden>
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.5 6l2.5 2.5L9.5 3"
            />
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
  const [flagFilter, setFlagFilter] = useState<'all' | 'starred' | 'calendar' | 'leadless'>('all');
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
  const [composeMode, setComposeMode] = useState<'new' | 'reply'>('new');
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

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId],
  );

  const trashFolderId = useMemo(
    () => folders.find((f) => f.systemKey === 'trash')?.id,
    [folders],
  );

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
    (f: EmailFolder) => (
      <SystemFolderIcon
        systemKey={f.systemKey}
        className={`h-5 w-5 shrink-0 ${f.systemKey ? 'text-slate-600' : 'text-slate-500'}`}
      />
    ),
    [],
  );

  const allSelected =
    messages.length > 0 && messages.every((m) => selectedIds.has(m.id));
  const someSelected = messages.some((m) => selectedIds.has(m.id)) && !allSelected;

  const folderLabel = useCallback(
    (f: EmailFolder) => {
      if (f.systemKey === 'inbox') return t('crm.email.inbox.sysFolder.inbox');
      if (f.systemKey === 'sent') return t('crm.email.inbox.sysFolder.sent');
      if (f.systemKey === 'trash') return t('crm.email.inbox.sysFolder.trash');
      return f.name;
    },
    [t],
  );

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
    [
      accounts,
      autoSyncBusy,
      loadAccounts,
      loadFolders,
      refreshVisibleMessages,
    ],
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
        updated.meta?.calendarInvite
          ? 'Встреча перенесена в таблицу и календарь.'
          : 'Письмо проверено, но встречу не удалось распознать.',
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
      const result = await backfillEmailCalendarInvites({
        accountId: accountId || undefined,
        limit: 100,
      });
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
    if (!accountId || (!selectedAccount?.hasOAuthTokens && !selectedAccount?.imapHost)) {
      return;
    }
    const sync = () => {
      if (document.hidden) return;
      void runMailboxSync(accountId, { silent: true });
    };
    const timer = window.setInterval(sync, MAILBOX_SYNC_MS);
    return () => window.clearInterval(timer);
  }, [
    accountId,
    runMailboxSync,
    selectedAccount?.hasOAuthTokens,
    selectedAccount?.imapHost,
  ]);

  useEffect(() => {
    if (!accountId || !selectedAccount?.hasOAuthTokens) return;
    let running = false;
    const backfill = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const result = await backfillEmailCalendarInvites({
          accountId,
          limit: 100,
        });
        if (result.imported > 0) {
          setCalendarImportNotice(
            `Встречи обновлены автоматически: перенесено ${result.imported}.`,
          );
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

  const submitFolderModal = async (name: string) => {
    if (!accountId || !folderModal) return;
    setFolderModalBusy(true);
    try {
      if (folderModal.kind === 'create') {
        await createEmailFolder({
          accountId,
          name,
          parentId: folderModal.parentId,
        });
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
    const items = next.map((x, i) => ({
      id: x.id,
      sortOrder: i,
      parentId: x.parentId ?? null,
    }));
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
      const dest =
        targetFolderId === 'root'
          ? folders.find((x) => x.systemKey === 'inbox')?.id
          : targetFolderId;
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

  const folderAside = (narrow: boolean) => (
    <aside
      className={`flex min-h-0 flex-col border-slate-200 bg-white lg:border-r ${narrow ? 'max-h-[200px] lg:max-h-none' : ''} lg:rounded-l-2xl`}
      style={narrow ? undefined : { width: folderW, flexShrink: 0 }}
    >
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-200 px-2 py-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{t('crm.email.inbox.folders')}</div>
        <button
          type="button"
          className="hidden rounded-lg px-1.5 py-0.5 text-[10px] text-slate-500 transition hover:bg-slate-100 hover:text-lumiva-accent lg:inline"
          onClick={() => setFoldersCollapsed(true)}
          title={t('crm.email.inbox.hideFolders')}
        >
          ◂
        </button>
      </div>
      {!accountId ? (
        <p className="px-2 py-2 text-[10px] text-slate-500">{t('crm.email.inbox.selectMailboxForFolders')}</p>
      ) : (
        <>
          <div className="border-b border-slate-200 px-2 py-2">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              {t('crm.email.inbox.standardFolders')}
            </p>
            <div className="space-y-1">
              {systemFoldersOrdered.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFolderId(f.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => void onFolderDrop(e, f.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition ${
                    selectedFolderId === f.id
                      ? 'border-lumiva-accent bg-slate-100 text-lumiva-accent shadow-sm'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px] ${selectedFolderId === f.id ? 'text-lumiva-accent' : 'text-slate-600'}`}
                    aria-hidden
                  >
                    <SystemFolderIcon systemKey={f.systemKey} />
                  </span>
                  <span className="truncate">{folderLabel(f)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="border-b border-slate-200 px-2 py-2">
            <div className="mb-1 flex items-center justify-between gap-1">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{t('crm.email.inbox.myFolders')}</p>
              <button
                type="button"
                onClick={() => setFolderModal({ kind: 'create', parentId: null })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 transition hover:border-lumiva-accent hover:bg-slate-50 hover:text-lumiva-accent"
              >
                + {t('crm.email.inbox.newFolder')}
              </button>
            </div>
            <div
              className="mt-1 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-2 py-1.5 text-[9px] text-slate-500"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void onFolderDrop(e, 'root')}
            >
              {t('crm.email.inbox.dropFolderRoot')}
            </div>
          </div>
        </>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto bg-white px-1.5 py-1">
        {accountId && folderLoading ? (
          <div className="p-2 text-[10px] text-slate-500">{t('crm.email.inbox.load')}</div>
        ) : null}
        {accountId &&
          !folderLoading &&
          userFolderTree.map(({ f, depth }) => (
            <div
              key={f.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('folderId', f.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void onFolderDrop(e, f.id)}
              className={`group mb-1 rounded-xl border px-1 py-1 text-left text-[11px] transition ${
                selectedFolderId === f.id
                  ? 'border-slate-900/12 bg-slate-100'
                  : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
              }`}
              style={{ paddingLeft: 4 + depth * 12 }}
            >
              <button
                type="button"
                onClick={() => setSelectedFolderId(f.id)}
                className={`flex w-full items-center gap-2 truncate text-left font-medium ${
                  selectedFolderId === f.id ? 'text-lumiva-accent' : 'text-slate-800'
                }`}
              >
                <span className="shrink-0 text-slate-600 [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
                  <IconFolder />
                </span>
                <span className="truncate">{f.name}</span>
              </button>
              <div className="mt-0.5 flex flex-wrap gap-0.5 pl-1">
                <button type="button" className={FOLDER_ACTION} onClick={() => void reorderSibling(f.id, -1)}>
                  {t('crm.email.inbox.folderUp')}
                </button>
                <button type="button" className={FOLDER_ACTION} onClick={() => void reorderSibling(f.id, 1)}>
                  {t('crm.email.inbox.folderDown')}
                </button>
                <button type="button" className={FOLDER_ACTION} onClick={() => setFolderModal({ kind: 'create', parentId: f.id })}>
                  {t('crm.email.inbox.newSubfolder')}
                </button>
                <button type="button" className={FOLDER_ACTION} onClick={() => setFolderModal({ kind: 'rename', folder: f })}>
                  {t('crm.email.inbox.renameFolder')}
                </button>
                <button type="button" className={FOLDER_ACTION_DANGER} onClick={() => void deleteFolder(f)}>
                  {t('crm.email.inbox.deleteFolder')}
                </button>
              </div>
            </div>
          ))}
      </div>
      {accountId ? (
        <p className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-2 py-1.5 text-[9px] text-slate-400">{t('crm.email.inbox.dropOnFolder')}</p>
      ) : null}
    </aside>
  );

  const mobileDetailOpen = !isLg && Boolean(selectedId);

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-0 sm:px-1">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-lumiva-accent">{t('crm.email.inbox.title')}</h1>
            <p className="text-[11px] text-slate-500">{t('crm.email.inbox.subtitle')}</p>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={openNewCompose}
              disabled={accounts.length === 0}
              className={`inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap ${BTN_PRIMARY}`}
              title={t('crm.email.inbox.compose')}
            >
              <span className="text-sm leading-none">+</span>
              {t('crm.email.inbox.compose')}
            </button>
            <Link to="/email" className={`inline-flex min-w-0 items-center justify-center whitespace-nowrap px-3 py-1.5 ${BTN_SECONDARY_LIGHT}`}>
              {t('crm.email.accounts.title')}
            </Link>
            <button
              type="button"
              onClick={() => setBulkSendOpen(true)}
              disabled={accounts.length === 0}
              className={`inline-flex min-w-0 items-center justify-center gap-1 whitespace-nowrap ${BTN_SECONDARY_LIGHT}`}
              title="Send bulk email campaign"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M1 4l7 5 7-5" />
                <rect x="1" y="4" width="14" height="10" rx="1.5" />
              </svg>
              Bulk Send
            </button>
            <button type="button" onClick={() => void loadMessages()} className={`min-w-0 whitespace-nowrap ${BTN_PRIMARY}`}>
              {t('crm.email.inbox.refresh')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center">
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setSelectedId(null);
            }}
            className="col-span-2 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm sm:col-span-3 lg:w-[300px] lg:max-w-[300px]"
          >
            <option value="">{t('crm.email.inbox.allMailboxes')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
                {a.hasOAuthTokens ? ' · OAuth' : ''}
              </option>
            ))}
          </select>
          {accountId && (selectedAccount?.hasOAuthTokens || selectedAccount?.imapHost) ? (
            <button
              type="button"
              disabled={syncingId === accountId}
              onClick={() => void handleSync(accountId)}
              className="min-w-0 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sky-800 shadow-sm transition hover:bg-sky-50 disabled:opacity-50"
            >
              {syncingId === accountId
                ? t('crm.email.inbox.syncInProgress')
                : selectedAccount?.hasOAuthTokens
                  ? t('crm.email.accounts.syncNow')
                  : 'Синхронизировать IMAP'}
            </button>
          ) : null}
          {(accountId ? selectedAccount?.hasOAuthTokens : accounts.some((account) => account.hasOAuthTokens)) ? (
            <button
              type="button"
              disabled={calendarBackfillRunning}
              onClick={() => void handleBackfillCalendarInvites()}
              className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              {calendarBackfillRunning ? 'Переносим встречи…' : 'Перенести встречи'}
            </button>
          ) : null}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по письмам"
            className="col-span-2 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm outline-none focus:border-slate-400 sm:col-span-1 lg:w-48"
          />
          <select
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value as typeof readFilter)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm"
          >
            <option value="all">Все статусы</option>
            <option value="unread">Непрочитанные</option>
            <option value="read">Прочитанные</option>
          </select>
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value as typeof flagFilter)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm"
          >
            <option value="all">Все письма</option>
            <option value="starred">Со звездой</option>
            <option value="calendar">С приглашением</option>
            <option value="leadless">Без лида</option>
          </select>
          <input
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            placeholder="Отправитель"
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm outline-none focus:border-slate-400 lg:w-40"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm"
          />
          {(search || readFilter !== 'all' || flagFilter !== 'all' || fromFilter || dateFrom || dateTo) ? (
            <button
              type="button"
              className={`min-w-0 ${BTN_SECONDARY_LIGHT}`}
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
          <span className="col-span-2 text-[10px] text-slate-500 sm:col-span-1 lg:col-span-1">
            {autoSyncBusy
              ? 'Автосинхронизация…'
              : autoRefreshAt
                ? `Автообновлено ${autoRefreshAt}`
                : 'Автообновление каждые 30 сек'}
          </span>
          {autoSyncError ? (
            <span className="col-span-2 min-w-0 truncate text-[10px] text-rose-700 sm:col-span-1 lg:max-w-[260px]" title={autoSyncError}>
              {autoSyncError}
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>
        ) : null}
        {syncError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{syncError}</div>
        ) : null}
        {calendarImportNotice ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{calendarImportNotice}</div>
        ) : null}

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-none">
            <span className="font-medium text-slate-600">{t('crm.email.inbox.selectedCount', { count: selectedIds.size })}</span>
            <button type="button" className={BTN_PRIMARY} onClick={() => void bulkMarkRead()}>
              {t('crm.email.inbox.bulkMarkRead')}
            </button>
            <button type="button" className={BTN_SECONDARY_LIGHT} onClick={() => void bulkMarkUnread()}>
              {t('crm.email.inbox.bulkUnread')}
            </button>
            <button type="button" className={BTN_SECONDARY_LIGHT} onClick={openMoveModalForSelection}>
              {t('crm.email.inbox.moveToFolderAction')}
            </button>
            {trashFolderId ? (
              <button type="button" className={BTN_GENTLE_ROSE} onClick={() => void bulkTrash()}>
                {t('crm.email.inbox.bulkTrash')}
              </button>
            ) : null}
            <button type="button" className={BTN_GENTLE_ROSE} onClick={openBulkDeleteMessages}>
              {t('crm.email.inbox.deletePermanently')}
            </button>
            <button
              type="button"
              className={BTN_SECONDARY_LIGHT}
              onClick={() => {
                setSelectedIds(new Set());
                rangeAnchorRef.current = null;
              }}
            >
              {t('crm.email.inbox.clearSelection')}
            </button>
          </div>
        ) : null}

        <div className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:h-[calc(100vh-180px)] lg:min-h-0">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {isLg && foldersCollapsed && accountId ? (
              <div
                className="flex w-full flex-row border-b border-slate-200 bg-white lg:w-11 lg:flex-col lg:border-b-0 lg:border-r lg:rounded-l-2xl"
                style={{ flexShrink: 0 }}
              >
                <button
                  type="button"
                  onClick={() => setFoldersCollapsed(false)}
                  className="flex flex-1 items-center justify-center gap-1 py-2 text-[10px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-lumiva-accent lg:flex-none lg:py-3 lg:writing-mode-vertical"
                  title={t('crm.email.inbox.showFolders')}
                >
                  <span className="lg:hidden">{t('crm.email.inbox.showFolders')}</span>
                  <span className="hidden lg:inline">▸</span>
                </button>
              </div>
            ) : null}

            {isLg && !foldersCollapsed && accountId ? (
              <>
                {folderAside(false)}
                <button
                  type="button"
                  aria-label="resize folders"
                  className="w-1.5 shrink-0 cursor-col-resize bg-slate-200/90 hover:bg-lumiva-accent/35"
                  onMouseDown={startResizeFolder}
                />
              </>
            ) : null}

            <div
              className={`${mobileDetailOpen ? 'hidden' : 'flex'} min-h-0 flex-col border-slate-200 lg:flex lg:border-r`}
              style={isLg ? { width: listW, flexShrink: 0 } : { width: '100%', flexShrink: 0 }}
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-2 py-2">
                <EmailCheckbox
                  checked={allSelected && messages.length > 0}
                  indeterminate={someSelected}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleSelectAll();
                  }}
                  title={t('crm.email.inbox.selectAll')}
                />
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {total} · {loading ? t('crm.email.inbox.load') : ''}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!loading && messages.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500">{t('crm.email.inbox.empty')}</div>
                ) : null}
                {messages.map((m, index) => {
                  const rowActive = selectedIds.has(m.id) || selectedId === m.id;
                  const unread = !m.isRead;
                  return (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('messageId', m.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(m.id);
                      }
                    }}
                    className={
                      'flex w-full cursor-pointer items-start gap-2 border-b border-slate-100 px-3 py-3 text-left transition-colors lg:px-2 lg:py-2 ' +
                      (rowActive
                        ? 'bg-slate-100 hover:bg-slate-100'
                        : 'hover:bg-slate-50')
                    }
                  >
                    <EmailCheckbox
                      checked={selectedIds.has(m.id)}
                      onClick={(e) => onToggleRowSelect(m, index, e)}
                      title={t('crm.email.inbox.toggleRow')}
                    />
                    <button
                      type="button"
                      onClick={(e) => void toggleStar(m, e)}
                      className={`mt-0.5 shrink-0 text-base leading-none ${m.isStarred ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}
                      title={t('crm.email.inbox.star')}
                    >
                      {m.isStarred ? '★' : '☆'}
                    </button>
                    <span className="mt-0.5 flex w-5 shrink-0 justify-center" aria-hidden>
                      <MessageRowIcon m={m} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            unread ? 'bg-lumiva-accent' : 'bg-transparent'
                          }`}
                          aria-hidden
                        />
                        <div
                          className={`min-w-0 flex-1 truncate text-sm lg:text-xs ${
                            unread ? 'font-bold text-slate-950' : 'font-medium text-slate-800'
                          }`}
                        >
                          {m.subject || '—'}
                        </div>
                      </div>
                      <div
                        className={`mt-1 truncate pl-4 text-xs lg:text-[10px] ${
                          unread ? 'font-semibold text-slate-900' : 'font-normal text-slate-500'
                        }`}
                      >
                        {m.direction === 'incoming' ? m.from : m.to?.join(', ')}
                      </div>
                      <div
                        className={`mt-1 pl-4 text-xs lg:text-[10px] ${
                          unread ? 'font-semibold text-slate-900' : 'font-normal text-slate-500'
                        }`}
                      >
                        {new Date(m.date).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {isLg ? (
              <button
                type="button"
                aria-label="resize list"
                className="w-1.5 shrink-0 cursor-col-resize bg-slate-200/90 hover:bg-slate-400/40"
                onMouseDown={startResizeList}
              />
            ) : null}

            <div className={`${!isLg && !selectedId ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-1 flex-col`}>
              {!detail ? (
                <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
                  {selectedId ? t('crm.email.inbox.load') : t('crm.email.inbox.selectMessage')}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="shrink-0 border-b border-slate-200 px-3 py-3 sm:px-4">
                    {!isLg ? (
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="mb-3 inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                      >
                        ← Назад
                      </button>
                    ) : null}
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={(e) => void toggleStar(detail, e)}
                        className={`shrink-0 text-xl ${detail.isStarred ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}
                        title={t('crm.email.inbox.star')}
                      >
                        {detail.isStarred ? '★' : '☆'}
                      </button>
                      <h2 className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{detail.subject || '—'}</h2>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-500">From:</span> {detail.fromName ? `${detail.fromName} ` : ''}
                        &lt;{detail.from}&gt;
                      </div>
                      <div>
                        <span className="text-slate-500">To:</span> {detail.to?.join(', ')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {detail.direction === 'incoming' ? (
                          <button
                            type="button"
                            onClick={() => openReply()}
                            disabled={accounts.length === 0}
                            className={`${BTN_SECONDARY} px-3 py-1 text-[11px]`}
                          >
                            {t('crm.email.inbox.reply')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={openMoveModalForDetail}
                          className={`${BTN_SECONDARY} px-3 py-1 text-[11px]`}
                        >
                          {t('crm.email.inbox.moveToFolderAction')}
                        </button>
                        {trashFolderId ? (
                          <button
                            type="button"
                            onClick={() => void moveMessageToFolder(detail.id, trashFolderId)}
                            className={`${BTN_GENTLE_ROSE} px-3 py-1 text-[11px]`}
                          >
                            {t('crm.email.inbox.moveToTrash')}
                          </button>
                        ) : null}
                        <button type="button" onClick={openDetailDeleteMessage} className={`${BTN_GENTLE_ROSE} px-3 py-1 text-[11px]`}>
                          {t('crm.email.inbox.deletePermanently')}
                        </button>
                        {detail.leadId ? (
                          <Link to={`/leads/${detail.leadId}`} className={leadBadgeClass} style={leadBadgeStyle}>
                            {t('crm.email.inbox.openLead')}
                          </Link>
                        ) : null}
                        {detail.meta?.hasCalendarAttachment ? (
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                            {t('crm.email.inbox.calendarInvite')}
                          </span>
                        ) : null}
                        {detail.meta?.hasCalendarAttachment && (!detail.meta.calendarInvite || detail.meta.calendarInviteImportError) ? (
                          <button
                            type="button"
                            onClick={() => void handleImportCalendarInvite(detail.id)}
                            disabled={calendarImportingId === detail.id}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            {calendarImportingId === detail.id
                              ? 'Переносим…'
                              : detail.meta.calendarInviteImportError
                                ? 'Повторить перенос'
                                : 'Перенести в календарь'}
                          </button>
                        ) : null}
                        {!detail.isRead ? (
                          <button type="button" onClick={() => void handleMarkRead()} className={BTN_SECONDARY_SM}>
                            {t('crm.email.inbox.markRead')}
                          </button>
                        ) : (
                          <button type="button" onClick={() => void handleMarkUnread()} className={BTN_SECONDARY_SM}>
                            {t('crm.email.inbox.markUnread')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {detail.meta?.calendarInvite ? (
                    <CalendarInviteCard
                      invite={detail.meta.calendarInvite}
                      importError={detail.meta.calendarInviteImportError}
                    />
                  ) : null}
                  {/* AI Reply Suggestions — incoming only */}
                  {detail.direction === 'incoming' && (
                    <div className="mx-3 mb-2 mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">AI варианты ответа</span>
                        <button
                          type="button"
                          disabled={aiReplySuggestLoading}
                          onClick={() => {
                            if (aiReplySuggestions.length > 0) {
                              setAiReplySuggestOpen(v => !v);
                            } else {
                              void fetchAiReplySuggestions(detail);
                            }
                          }}
                          className="text-[10px] font-semibold tracking-wide text-slate-700 transition hover:text-slate-950 disabled:opacity-50"
                        >
                          {aiReplySuggestLoading ? 'Генерация…' : aiReplySuggestions.length > 0 ? (aiReplySuggestOpen ? 'Скрыть' : 'Показать') : 'Предложить ответ'}
                        </button>
                      </div>
                      {aiReplySuggestOpen && aiReplySuggestions.length > 0 && (
                        <div className="mt-2 flex flex-col gap-2">
                          {aiReplySuggestions.map((s, i) => (
                            <div key={i} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                              <p className="flex-1 text-[12px] leading-relaxed text-slate-700">{s}</p>
                              <button
                                type="button"
                                onClick={() => openReply(s)}
                                className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-800 transition hover:bg-slate-50"
                              >
                                Ответить
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-3 text-sm text-slate-900 sm:px-5 sm:py-4">
                    {detail.htmlBody ? (
                      <iframe
                        title={detail.subject || 'Email message'}
                        className="h-full min-h-[420px] w-full rounded-xl border border-slate-200 bg-white"
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                        referrerPolicy="no-referrer"
                        srcDoc={buildEmailMessageSrcDoc(detail.htmlBody)}
                      />
                    ) : (
                      <pre className="w-full max-w-none whitespace-pre-wrap break-words font-sans text-sm">
                        {detail.textBody || '—'}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <EmailBulkSendModal
        open={bulkSendOpen}
        onClose={() => setBulkSendOpen(false)}
      />

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
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-xl border border-lumiva-accent bg-lumiva-accent text-xl font-light text-white shadow-lg transition hover:bg-lumiva-accent-soft disabled:hidden md:hidden"
        aria-label={t('crm.email.inbox.compose')}
      >
        +
      </button>

      <EmailFolderModal
        open={!!folderModal}
        title={
          folderModal?.kind === 'rename'
            ? t('crm.email.inbox.folderModalRenameTitle')
            : t('crm.email.inbox.folderModalCreateTitle')
        }
        initialName={folderModal?.kind === 'rename' ? folderModal.folder.name : ''}
        hint={
          folderModal?.kind === 'create' && folderModal.parentId
            ? t('crm.email.inbox.folderModalSubfolderHint', {
                name: folders.find((x) => x.id === folderModal.parentId)?.name || '—',
              })
            : undefined
        }
        submitLabel={
          folderModal?.kind === 'rename' ? t('crm.common.save') : t('crm.email.inbox.folderModalCreateSubmit')
        }
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

      <CrmShellModal
        open={!!syncError}
        title={t('crm.common.modalError')}
        message={syncError || ''}
        variant="error"
        onClose={() => setSyncError(null)}
      />
    </MainLayout>
  );
};

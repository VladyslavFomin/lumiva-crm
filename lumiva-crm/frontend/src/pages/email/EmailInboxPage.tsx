import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { CrmShellModal } from '../../components/ui/CrmShellModal';
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
  fetchEmailFolders,
  createEmailFolder,
  patchEmailFolder,
  deleteEmailFolder,
  reorderEmailFolders,
  type EmailAccount,
  type EmailMessage,
  type EmailFolder,
} from '../../api/email';

const TEAL = '#45a094';
const LS_FOLDER_W = 'lumiva-email-folder-w';
const LS_LIST_W = 'lumiva-email-list-w';
const LS_FOLD_COLLAPSE = 'lumiva-email-folders-collapsed';

const leadBadgeClass =
  'inline-flex items-center rounded-2xl px-3 py-1 text-xs font-semibold text-white shadow-md transition hover:opacity-95';
const leadBadgeStyle = { backgroundColor: TEAL, boxShadow: '0 6px 20px rgba(69,160,148,0.35)' };

/** Пилюли: белый фон + чёрная обводка / акцент; hover — слегка slate-50 (не «серый снизу»). */
const BTN_PRIMARY =
  'rounded-full border border-lumiva-accent bg-lumiva-accent px-3 py-1.5 text-xs font-semibold text-white shadow-none transition hover:bg-lumiva-accent-soft disabled:cursor-not-allowed disabled:opacity-40';
const BTN_SECONDARY =
  'rounded-full border border-slate-600/90 bg-transparent px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40';
const BTN_SECONDARY_SM =
  'rounded-full border border-slate-600/90 bg-transparent px-2 py-0.5 text-[11px] font-medium text-slate-200 transition hover:border-slate-500 hover:bg-white/[0.06] hover:text-white';
const FOLDER_ACTION =
  'rounded-md px-1.5 py-0.5 text-[9px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-lumiva-accent';
const FOLDER_ACTION_DANGER =
  'rounded-md px-1.5 py-0.5 text-[9px] font-medium text-rose-600 transition hover:bg-rose-50 hover:text-rose-700';

/** Панель над светлым фоном страницы (как сайдбар CRM). */
const BTN_SECONDARY_LIGHT =
  'rounded-full border border-slate-800/20 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-none transition hover:border-slate-800/40 hover:bg-slate-50';
/**
 * «В корзину» / «Удалить» — светлая капсула: почти белый розоватый фон, бордовый текст,
 * без тени (чтобы не было «серого снизу»). Не вариант с белым текстом на сплошной розе.
 */
const BTN_GENTLE_ROSE =
  'rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-950 shadow-none transition hover:border-rose-400 hover:bg-rose-100';

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
            ? 'border-teal-500/70 bg-teal-600/80 shadow-[0_0_0_1px_rgba(69,160,148,0.2)]'
            : 'border-slate-500/55 bg-white/[0.04] hover:border-[#45a094]/45'
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

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<'new' | 'reply'>('new');
  const [composeResetKey, setComposeResetKey] = useState(0);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeHtml, setComposeHtml] = useState('<p></p>');
  const [composeLeadId, setComposeLeadId] = useState<string | null>(null);

  const [folderModal, setFolderModal] = useState<
    null | { kind: 'create'; parentId: string | null } | { kind: 'rename'; folder: EmailFolder }
  >(null);
  const [folderModalBusy, setFolderModalBusy] = useState(false);
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<EmailFolder | null>(null);
  const [messageDeleteIds, setMessageDeleteIds] = useState<string[] | null>(null);
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
  }, [selectedFolderId, accountId]);

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

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: {
        accountId?: string;
        folderId?: string;
        limit: number;
        offset: number;
      } = { limit: 100, offset: 0 };
      if (accountId) query.accountId = accountId;
      if (accountId && selectedFolderId) query.folderId = selectedFolderId;
      const res = await fetchEmailMessages(query);
      setMessages(res.items);
      setTotal(res.total);
    } catch (e: any) {
      setError(e?.message || 'load failed');
    } finally {
      setLoading(false);
    }
  }, [accountId, selectedFolderId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

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

  const handleSync = async (id: string) => {
    setSyncingId(id);
    setSyncError(null);
    try {
      await syncEmailMailboxNow(id);
      await loadMessages();
      await loadFolders();
      await loadAccounts();
    } catch (e: any) {
      setSyncError(e?.message || 'sync failed');
    } finally {
      setSyncingId(null);
    }
  };

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

  const openBulkDeleteMessages = () => {
    if (selectedIds.size === 0) return;
    setMessageDeleteIds([...selectedIds]);
  };

  const openDetailDeleteMessage = () => {
    if (!detail) return;
    setMessageDeleteIds([detail.id]);
  };

  const confirmDeleteMessages = async () => {
    const ids = messageDeleteIds;
    if (!ids?.length) return;
    for (const id of ids) {
      try {
        await deleteEmailMessage(id);
      } catch {
        /* ignore */
      }
    }
    setMessageDeleteIds(null);
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

  const openReply = () => {
    if (!detail || detail.direction !== 'incoming') return;
    setComposeMode('reply');
    setComposeTo(detail.from);
    setComposeSubject(replySubject(detail.subject));
    setComposeHtml(replyInitialHtml(detail));
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

  const confirmDeleteFolder = async () => {
    if (!folderDeleteTarget) return;
    try {
      await deleteEmailFolder(folderDeleteTarget.id);
      setFolderDeleteTarget(null);
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
                <button type="button" className={FOLDER_ACTION_DANGER} onClick={() => setFolderDeleteTarget(f)}>
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

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-[1680px] min-h-[72vh] flex-col gap-3 px-0 sm:px-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-lumiva-accent">{t('crm.email.inbox.title')}</h1>
            <p className="text-[11px] text-slate-500">{t('crm.email.inbox.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openNewCompose}
              disabled={accounts.length === 0}
              className={`inline-flex items-center gap-1.5 ${BTN_PRIMARY}`}
              title={t('crm.email.inbox.compose')}
            >
              <span className="text-sm leading-none">+</span>
              {t('crm.email.inbox.compose')}
            </button>
            <Link to="/email" className={`inline-flex items-center px-3 py-1.5 ${BTN_SECONDARY_LIGHT}`}>
              {t('crm.email.accounts.title')}
            </Link>
            <button type="button" onClick={() => void loadMessages()} className={BTN_PRIMARY}>
              {t('crm.email.inbox.refresh')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setSelectedId(null);
            }}
            className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-slate-800 shadow-sm"
          >
            <option value="">{t('crm.email.inbox.allMailboxes')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
                {a.hasOAuthTokens ? ' · OAuth' : ''}
              </option>
            ))}
          </select>
          {accountId && selectedAccount?.hasOAuthTokens ? (
            <button
              type="button"
              disabled={syncingId === accountId}
              onClick={() => void handleSync(accountId)}
              className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-sky-800 shadow-sm transition hover:bg-sky-50 disabled:opacity-50"
            >
              {syncingId === accountId ? t('crm.email.inbox.syncInProgress') : t('crm.email.accounts.syncNow')}
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</div>
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

        <div className="flex min-h-[min(78vh,880px)] min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {foldersCollapsed && accountId ? (
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

            {!foldersCollapsed && accountId ? (
              <>
                {folderAside(false)}
                {isLg ? (
                  <button
                    type="button"
                    aria-label="resize folders"
                    className="w-1.5 shrink-0 cursor-col-resize bg-slate-200/90 hover:bg-lumiva-accent/35"
                    onMouseDown={startResizeFolder}
                  />
                ) : null}
              </>
            ) : null}

            <div
              className="flex min-h-0 flex-col border-slate-800/80 lg:border-r"
              style={isLg ? { width: listW, flexShrink: 0 } : { width: '100%', flexShrink: 0 }}
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-2 py-2 lg:hidden">
                {accountId ? (
                  <button
                    type="button"
                    onClick={() => setFoldersCollapsed((c) => !c)}
                    className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300"
                  >
                    {foldersCollapsed ? t('crm.email.inbox.showFolders') : t('crm.email.inbox.hideFolders')}
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-2 py-2">
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
                      'flex w-full cursor-pointer items-start gap-2 border-b border-slate-800/80 px-2 py-2 text-left transition-colors ' +
                      (rowActive
                        ? 'bg-[#45a094]/[0.055] hover:bg-[#45a094]/[0.08]'
                        : 'hover:bg-[#45a094]/[0.03]') +
                      (!m.isRead ? ' border-l-2 border-l-[#45a094]' : '')
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
                      className={`mt-0.5 shrink-0 text-base leading-none ${m.isStarred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                      title={t('crm.email.inbox.star')}
                    >
                      {m.isStarred ? '★' : '☆'}
                    </button>
                    <span className="mt-0.5 flex w-5 shrink-0 justify-center" aria-hidden>
                      <MessageRowIcon m={m} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-100">{m.subject || '—'}</div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-400">
                        {m.direction === 'incoming' ? m.from : m.to?.join(', ')}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">{new Date(m.date).toLocaleString()}</div>
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
                className="w-1.5 shrink-0 cursor-col-resize border-slate-700 bg-slate-800/50 hover:bg-teal-600/40"
                onMouseDown={startResizeList}
              />
            ) : null}

            <div className="flex min-h-[200px] min-h-0 min-w-0 flex-1 flex-col">
              {!detail ? (
                <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
                  {t('crm.email.inbox.selectMessage')}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="shrink-0 border-b border-slate-800 px-3 py-3 sm:px-4">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={(e) => void toggleStar(detail, e)}
                        className={`shrink-0 text-xl ${detail.isStarred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                        title={t('crm.email.inbox.star')}
                      >
                        {detail.isStarred ? '★' : '☆'}
                      </button>
                      <h2 className="min-w-0 flex-1 text-sm font-semibold text-slate-50">{detail.subject || '—'}</h2>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-400">
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
                            onClick={openReply}
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
                          <span className="rounded-lg bg-amber-900/40 px-2 py-0.5 text-amber-200">
                            {t('crm.email.inbox.calendarInvite')}
                          </span>
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
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm text-slate-200 sm:px-5 sm:py-4">
                    {detail.htmlBody ? (
                      <div
                        className="email-html-body prose prose-invert max-w-none text-sm [&_*]:max-w-full [&_img]:h-auto [&_img]:max-w-full [&_table]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: detail.htmlBody }}
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
        open={!!folderDeleteTarget}
        title={t('crm.email.inbox.deleteFolder')}
        message={t('crm.email.inbox.deleteFolderConfirm')}
        variant="error"
        cancelLabel={t('crm.common.cancel')}
        confirmLabel={t('crm.common.delete')}
        confirmTone="danger"
        onClose={() => setFolderDeleteTarget(null)}
        onConfirm={() => void confirmDeleteFolder()}
      />

      <CrmShellModal
        open={!!messageDeleteIds?.length}
        title={t('crm.email.inbox.deleteMessagesTitle')}
        message={t('crm.email.inbox.deleteMessagesConfirm', { count: messageDeleteIds?.length ?? 0 })}
        variant="error"
        cancelLabel={t('crm.common.cancel')}
        confirmLabel={t('crm.common.delete')}
        confirmTone="danger"
        onClose={() => setMessageDeleteIds(null)}
        onConfirm={() => void confirmDeleteMessages()}
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  addAiMemory,
  createAiSession,
  deleteAiMemory,
  deleteAiSession,
  fetchAiMemory,
  fetchAiSessionMessages,
  fetchAiSessions,
  fetchAiStatus,
  postAiChat,
  postAiImage,
  type AiChatMessageDto,
  type AiChatSalesImportContext,
  type AiChatWorkspaceCsvContext,
  type AiMemoryChunkDto,
  type AiQuotaSnapshot,
} from '../../api/ai';
import { previewSalesImport } from '../../api/imports';
import { ApiError, createAiAddonCheckoutSession } from '../../api/client';
import { AiChatMarkdown } from './AiChatMarkdown';
import { AiEmailComposerModal } from './AiEmailComposerModal';

function formatCents(c: number): string {
  return (Math.max(0, c) / 100).toFixed(2);
}

function formatBytes(b: string): string {
  const n = BigInt(b || '0');
  if (n < 1024n) return `${n} B`;
  const kb = n / 1024n;
  if (kb < 1024n) return `${kb} KB`;
  const mb = kb / 1024n;
  if (mb < 1024n) return `${mb} MB`;
  return `${mb / 1024n} GB`;
}

/** Имя для приветствия: не показываем email */
function greetingDisplayName(raw: string | null | undefined, fallback: string): string {
  const s = (raw || '').trim();
  if (!s) return fallback;
  if (s.includes('@')) return fallback;
  const first = s.split(/\s+/)[0] || s;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function slugCsvFieldKey(header: string, used: Set<string>): string {
  let base = header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9а-яё_]/gi, '')
    .replace(/_+/g, '_')
    .slice(0, 60);
  if (!base) base = 'col';
  let k = base;
  let n = 1;
  while (used.has(k)) {
    k = `${base}_${n++}`;
  }
  used.add(k);
  return k;
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (!q && c === delim) {
      out.push(cur.trim().replace(/^"|"$/g, ''));
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim().replace(/^"|"$/g, ''));
  return out;
}

function parseWorkspaceCsv(
  text: string,
  fileName: string,
  maxRows: number,
): AiChatWorkspaceCsvContext {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const hint = fileName.replace(/\.[^/.]+$/, '') || 'table';
  if (!lines.length) {
    return { fileName, tableNameHint: hint, headers: [], fieldKeys: [], rows: [] };
  }
  const delim =
    lines[0].split(';').length > lines[0].split(',').length ? ';' : ',';
  const headerCells = splitCsvLine(lines[0], delim);
  const headers = headerCells.map((h, i) => h.trim() || `column_${i + 1}`);
  const used = new Set<string>();
  const fieldKeys = headers.map((h) => slugCsvFieldKey(h, used));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length && rows.length < maxRows; i++) {
    const cells = splitCsvLine(lines[i], delim);
    const row: Record<string, string> = {};
    fieldKeys.forEach((key, j) => {
      row[key] = cells[j] ?? '';
    });
    rows.push(row);
  }
  return { fileName, tableNameHint: hint, headers, fieldKeys, rows };
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Цветной ободок круга — как на референсе Monday */
const PRESET_CIRCLE_BORDER: Record<string, string> = {
  board: 'border-[#a855f7]',
  doc: 'border-[#14b8a6]',
  search: 'border-[#eab308]',
  data: 'border-[#ec4899]',
  brain: 'border-[#38bdf8]',
  image: 'border-[#22c55e]',
  vibe: 'border-[#fb923c]',
  more: 'border-[#2563eb]',
};

const PRESET_ORDER = ['board', 'doc', 'search', 'data', 'brain', 'image', 'vibe', 'more'] as const;

/** Чёрный линейный контур внутри белого круга (stroke currentColor = slate-900) */
function MondayLineIcon({ presetKey }: { presetKey: string }) {
  const g = 'h-[26px] w-[26px] text-slate-900';
  const s = 1.65;
  switch (presetKey) {
    case 'board':
      return (
        <svg className={g} fill="none" viewBox="0 0 24 24" aria-hidden>
          <rect x="4.5" y="5.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth={s} />
          <path
            d="M14.25 6.25V9M12.75 7.625h3"
            stroke="currentColor"
            strokeWidth={s}
            strokeLinecap="round"
          />
        </svg>
      );
    case 'doc':
      return (
        <svg className={g} fill="none" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M14.5 3.5H7A2.5 2.5 0 0 0 4.5 6v13A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8L14.5 3.5Z"
            stroke="currentColor"
            strokeWidth={s}
            strokeLinejoin="round"
          />
          <path d="M14.5 3.5V8h4.5" stroke="currentColor" strokeWidth={s} strokeLinejoin="round" />
          <path
            d="M16.25 5.25V7.5M15 6.375h2.5"
            stroke="currentColor"
            strokeWidth={s}
            strokeLinecap="round"
          />
        </svg>
      );
    case 'search':
      return (
        <svg className={g} fill="none" viewBox="0 0 24 24" aria-hidden>
          <rect x="3.5" y="11" width="9.5" height="8" rx="1.2" stroke="currentColor" strokeWidth={s} />
          <rect x="6.5" y="8" width="9.5" height="8" rx="1.2" stroke="currentColor" strokeWidth={s} />
          <rect x="9.5" y="5" width="9.5" height="8" rx="1.2" stroke="currentColor" strokeWidth={s} />
        </svg>
      );
    case 'data':
      return (
        <svg className={g} fill="none" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M5.5 18.5V11M12 18.5V7.5M18.5 18.5v-6"
            stroke="currentColor"
            strokeWidth={s}
            strokeLinecap="round"
          />
        </svg>
      );
    case 'brain':
      return (
        <svg className={g} fill="none" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 3.5a3.8 3.8 0 0 0-1.9 7.1V13a1.8 1.8 0 0 0 1.8 1.8h.2a1.8 1.8 0 0 0 1.8-1.8v-2.4a3.8 3.8 0 0 0-1.9-7.1Z"
            stroke="currentColor"
            strokeWidth={s}
            strokeLinejoin="round"
          />
          <path d="M9.5 18.5h5" stroke="currentColor" strokeWidth={s} strokeLinecap="round" />
        </svg>
      );
    case 'image':
      return (
        <svg className={g} fill="none" viewBox="0 0 24 24" aria-hidden>
          <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth={s} />
          <circle cx="8" cy="10" r="1.3" stroke="currentColor" strokeWidth={s} />
          <path
            d="M3.5 16.5 8 12l3.5 3 3-2.5 6 5"
            stroke="currentColor"
            strokeWidth={s}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'vibe':
      return (
        <svg className={g} fill="none" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 20.2c-3.2-2.1-6-5.2-6-9.1a3.6 3.6 0 0 1 6-2.2 3.6 3.6 0 0 1 6 2.2c0 3.9-2.8 7-6 9.1Z"
            stroke="currentColor"
            strokeWidth={s}
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'more':
      return (
        <svg className={g} fill="none" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M5 5.5A2 2 0 0 1 7 3.5h4.5V20H7a2 2 0 0 1-2-2v-12.5Z"
            stroke="currentColor"
            strokeWidth={s}
            strokeLinejoin="round"
          />
          <path
            d="M19 5.5A2 2 0 0 0 17 3.5h-4.5V20H17a2 2 0 0 0 2-2v-12.5Z"
            stroke="currentColor"
            strokeWidth={s}
            strokeLinejoin="round"
          />
          <path d="M12 3.5V20.5" stroke="currentColor" strokeWidth={s} strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className={g} fill="none" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={s} />
        </svg>
      );
  }
}

function SendArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 19V5M12 5l-5 5M12 5l5 5"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PresetCircleRing({
  presetKey,
  children,
}: {
  presetKey: string;
  children: React.ReactNode;
}) {
  const b = PRESET_CIRCLE_BORDER[presetKey] || PRESET_CIRCLE_BORDER.more;
  return (
    <span
      className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border-[2.5px] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.11),0_2px_8px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,1)] transition-transform duration-200 group-hover:scale-[1.06] group-hover:shadow-[0_12px_28px_rgba(15,23,42,0.14)] ${b}`}
    >
      {children}
    </span>
  );
}

export interface AiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  /** Отображаемое имя (без email); если пусто — общее приветствие */
  userName?: string | null;
}

type SessionRow = { id: string; title: string | null; updatedAt: string };

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  open,
  onClose,
  userName,
}) => {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<'assistant' | 'memory'>('assistant');
  const [hub, setHub] = useState(true);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [quota, setQuota] = useState<AiQuotaSnapshot | null>(null);
  const [configured, setConfigured] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessageDto[]>([]);
  const [input, setInput] = useState('');
  /** Черновик названия до первого сообщения; дублируется в ref для актуального значения в async. */
  const [newChatTitleDraft, setNewChatTitleDraft] = useState('');
  const newChatTitleDraftRef = useRef('');
  const [loading, setLoading] = useState(false);
  const [imageGenPending, setImageGenPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memory, setMemory] = useState<AiMemoryChunkDto[]>([]);
  const [memTitle, setMemTitle] = useState('');
  const [memContent, setMemContent] = useState('');
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);
  const [lastImageUserPrompt, setLastImageUserPrompt] = useState<string | null>(
    null,
  );
  const [lastImageRevisedPrompt, setLastImageRevisedPrompt] = useState<
    string | null
  >(null);
  const [salesImportAttachment, setSalesImportAttachment] =
    useState<AiChatSalesImportContext | null>(null);
  const [workspaceCsvAttachment, setWorkspaceCsvAttachment] =
    useState<AiChatWorkspaceCsvContext | null>(null);
  const [imagePanelOpen, setImagePanelOpen] = useState(false);
  const [imagePromptLocal, setImagePromptLocal] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshQuota = useCallback(async () => {
    try {
      const s = await fetchAiStatus();
      setQuota(s.quota);
      setConfigured(s.configured);
    } catch {
      setQuota(null);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const list = await fetchAiSessions(60);
      setSessions(
        list.map((x) => ({
          id: x.id,
          title: x.title,
          updatedAt: x.updatedAt,
        })),
      );
    } catch {
      setSessions([]);
    }
  }, []);

  const loadMemory = useCallback(async () => {
    try {
      setMemory(await fetchAiMemory(50));
    } catch {
      setMemory([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshQuota();
    void loadSessions();
    void loadMemory();
  }, [open, refreshQuota, loadSessions, loadMemory]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (open && !hub) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, hub]);

  const ensureSessionId = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const titleOpt = newChatTitleDraftRef.current.trim();
    const s = await createAiSession(titleOpt ? { title: titleOpt } : undefined);
    newChatTitleDraftRef.current = '';
    setNewChatTitleDraft('');
    sessionIdRef.current = s.id;
    setSessionId(s.id);
    await loadSessions();
    return s.id;
  }, [loadSessions]);

  const deleteSessionFromList = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await deleteAiSession(id);
        if (sessionIdRef.current === id) {
          sessionIdRef.current = null;
          setSessionId(null);
          setMessages([]);
          setHub(true);
          setLastImageUrl(null);
          setLastImageUserPrompt(null);
          setLastImageRevisedPrompt(null);
        }
        await loadSessions();
      } catch (e: any) {
        setError(e?.message || 'Ошибка');
      }
    },
    [loadSessions],
  );

  const displayMessages = useMemo(
    () =>
      messages.filter((m) => {
        if (m.role !== 'assistant') return true;
        const c = (m.content || '').trim();
        const tc = m.toolCalls as unknown[] | null;
        const hasTools = Array.isArray(tc) && tc.length > 0;
        return !(hasTools && !c);
      }),
    [messages],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const startNewChat = async () => {
    setError(null);
    setLastImageUrl(null);
    setLastImageUserPrompt(null);
    setLastImageRevisedPrompt(null);
    try {
      const titleOpt = newChatTitleDraftRef.current.trim();
      const s = await createAiSession(titleOpt ? { title: titleOpt } : undefined);
      newChatTitleDraftRef.current = '';
      setNewChatTitleDraft('');
      sessionIdRef.current = s.id;
      setSessionId(s.id);
      setMessages([]);
      setHub(true);
      await loadSessions();
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    }
  };

  const selectSession = async (id: string) => {
    setError(null);
    setLastImageUrl(null);
    setLastImageUserPrompt(null);
    setLastImageRevisedPrompt(null);
    newChatTitleDraftRef.current = '';
    setNewChatTitleDraft('');
    setHub(false);
    sessionIdRef.current = id;
    setSessionId(id);
    try {
      const { messages: m } = await fetchAiSessionMessages(id);
      setMessages(m.filter((x) => x.role === 'user' || x.role === 'assistant'));
    } catch {
      setMessages([]);
    }
  };

  const openChatFromHistory = async (id: string) => {
    setTab('assistant');
    await selectSession(id);
  };

  const send = async () => {
    const text = input.trim();
    const hasAtt = Boolean(salesImportAttachment || workspaceCsvAttachment);
    if ((!text && !hasAtt) || loading) return;
    const salesCtx = salesImportAttachment || undefined;
    const wsCtx =
      workspaceCsvAttachment &&
      workspaceCsvAttachment.headers.length > 0 &&
      workspaceCsvAttachment.rows.length > 0
        ? workspaceCsvAttachment
        : undefined;
    setInput('');
    setSalesImportAttachment(null);
    setWorkspaceCsvAttachment(null);
    setError(null);
    setHub(false);
    setLoading(true);
    try {
      const sid = await ensureSessionId();
      const res = await postAiChat({
        sessionId: sid,
        message: text,
        salesImportContext: salesCtx,
        workspaceCsvContext: wsCtx,
        imageFollowUpContext:
          lastImageUrl != null
            ? {
                lastUrl: lastImageUrl,
                lastUserPrompt: lastImageUserPrompt || undefined,
                lastRevisedPrompt: lastImageRevisedPrompt || undefined,
              }
            : undefined,
      });
      setSessionId(res.sessionId);
      const { messages: m } = await fetchAiSessionMessages(res.sessionId);
      setMessages(m.filter((x) => x.role === 'user' || x.role === 'assistant'));
      if (res.imageUrl) {
        setLastImageUrl(res.imageUrl);
        setLastImageUserPrompt(text || null);
        setLastImageRevisedPrompt(res.imageRevisedPrompt ?? null);
      }
      await refreshQuota();
      await loadSessions();
    } catch (e: any) {
      const msg =
        e instanceof ApiError && e.payload?.message
          ? String(e.payload.message)
          : e?.message || 'Ошибка';
      setError(msg);
      setInput(text);
      if (salesCtx) setSalesImportAttachment(salesCtx);
      if (wsCtx) setWorkspaceCsvAttachment(wsCtx);
    } finally {
      setLoading(false);
    }
  };

  const onAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const prev = await previewSalesImport(file);
      setSalesImportAttachment({
        importId: prev.importId,
        suggestedMapping: prev.suggestedMapping,
        fileName: file.name,
        totalRows: prev.totalRows,
      });
      setWorkspaceCsvAttachment(null);
    } catch {
      try {
        const raw = await file.text();
        const ws = parseWorkspaceCsv(raw, file.name, 55);
        if (ws.headers.length > 0 && ws.fieldKeys.length > 0) {
          setWorkspaceCsvAttachment(ws);
          setSalesImportAttachment(null);
        } else {
          setError(t('crm.aiAssistant.attachParseError'));
        }
      } catch {
        setError(t('crm.aiAssistant.attachParseError'));
      }
    }
  };

  const runImageWithPrompt = async (promptRaw: string) => {
    const prompt = promptRaw.trim();
    if (!prompt) return;
    setImagePanelOpen(false);
    setImagePromptLocal('');
    setLoading(true);
    setImageGenPending(true);
    setError(null);
    try {
      const sid = await ensureSessionId();
      const img = await postAiImage({ prompt, sessionId: sid });
      if (img.ok && img.url) {
        setHub(false);
        setInput('');
        setLastImageUrl(img.url);
        setLastImageUserPrompt(prompt);
        setLastImageRevisedPrompt(img.revised_prompt ?? null);
        const { messages: m } = await fetchAiSessionMessages(sid);
        setMessages(m.filter((x) => x.role === 'user' || x.role === 'assistant'));
        await refreshQuota();
      }
    } catch (e: any) {
      setError(e?.message || 'Image error');
    } finally {
      setLoading(false);
      setImageGenPending(false);
    }
  };

  const topup = async (kind: 'ai_prepaid' | 'storage_pack') => {
    const origin = window.location.origin;
    const res = await createAiAddonCheckoutSession({
      kind,
      successUrl: `${origin}/app/billing?addon_ok=1`,
      cancelUrl: `${origin}/app/billing?addon_cancel=1`,
    });
    if (res.url) window.location.href = res.url;
  };

  const saveMemory = async () => {
    if (!memContent.trim()) return;
    setLoading(true);
    try {
      await addAiMemory({ title: memTitle.trim() || undefined, content: memContent.trim() });
      setMemTitle('');
      setMemContent('');
      await loadMemory();
      await refreshQuota();
    } catch (e: any) {
      setError(e?.message || 'Memory error');
    } finally {
      setLoading(false);
    }
  };

  const removeMemory = async (id: string) => {
    await deleteAiMemory(id);
    await loadMemory();
    await refreshQuota();
  };

  const quickPresets = t('crm.aiAssistant.presets', { returnObjects: true }) as Record<
    string,
    { label: string; prompt: string }
  >;

  const presetCards = t('crm.aiAssistant.cards', { returnObjects: true }) as Array<{
    title: string;
    prompt: string;
    tag: string;
  }>;

  const formatSessionDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(i18n.language || 'ru', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const renderPresetKeyRow = (keys: readonly (typeof PRESET_ORDER)[number][]) =>
    keys.map((key) => {
      const p = quickPresets[key];
      if (!p) return null;
      return (
        <button
          key={key}
          type="button"
          title={t('crm.aiAssistant.presetQuickActionTitle')}
          onClick={() => {
            void (async () => {
              try {
                await ensureSessionId();
              } catch {
                return;
              }
              setInput(p.prompt);
              setHub(false);
            })();
          }}
          className="group flex w-[76px] shrink-0 flex-col items-center gap-2 text-center"
        >
          <PresetCircleRing presetKey={key}>
            <MondayLineIcon presetKey={key} />
          </PresetCircleRing>
          <span className="text-[10px] font-medium leading-tight text-slate-600">{p.label}</span>
        </button>
      );
    });

  if (!open) return null;

  const displayName = greetingDisplayName(userName, t('crm.aiAssistant.fallbackName'));

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-row text-slate-900 [color-scheme:light]">
      <AiEmailComposerModal
        open={emailComposerOpen}
        onClose={() => setEmailComposerOpen(false)}
      />
      {/* Размытие страницы под панелью (нужен webkit для Safari) */}
      <button
        type="button"
        className="min-h-0 min-w-0 flex-1 cursor-default border-0 p-0 transition hover:bg-slate-900/35"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.28)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.15)',
          backdropFilter: 'blur(14px) saturate(1.15)',
        }}
        aria-label={t('crm.common.close')}
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full min-w-0 shrink-0 flex-col overflow-hidden border-l border-slate-300/90 bg-gradient-to-b from-white/95 via-slate-50/92 to-slate-100/88 shadow-[-48px_0_120px_rgba(15,23,42,0.28),-16px_0_48px_rgba(99,102,241,0.12),inset_1px_0_0_rgba(255,255,255,0.95)] backdrop-blur-xl md:w-2/5">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(167,139,250,0.12),transparent_55%)]"
          aria-hidden
        />
        <div className="relative flex min-h-0 flex-1 flex-col">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.txt,.xml,text/csv,text/plain,application/xml,text/xml"
          onChange={(e) => void onAttachFile(e)}
        />
        <div className="h-0.5 w-full shrink-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500" aria-hidden />

        <div className="flex items-start justify-between gap-3 border-b border-slate-200/40 bg-white/25 px-5 py-4 backdrop-blur-sm">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-600/90">
              Lumiva AI
            </div>
            <div className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
              {t('crm.aiAssistant.title')}
            </div>
            {quota && (
              <div className="mt-1.5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span className="rounded-full border border-slate-200/50 bg-white px-2.5 py-0.5 font-medium !text-slate-700 shadow-sm">
                  {t('crm.aiAssistant.quotaLine', {
                    left: formatCents(quota.totalAvailableCents),
                    storage: formatBytes(quota.storageUsedBytes),
                    cap: formatBytes(quota.storageQuotaBytes),
                  })}
                </span>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab('assistant')}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition ${
                tab === 'assistant'
                  ? 'border-lumiva-accent bg-lumiva-accent !text-white shadow-md'
                  : 'border-slate-300 bg-white !text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {t('crm.aiAssistant.tabChat')}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('memory');
                void loadSessions();
              }}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition ${
                tab === 'memory'
                  ? 'border-lumiva-accent bg-lumiva-accent !text-white shadow-md'
                  : 'border-slate-300 bg-white !text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {t('crm.aiAssistant.tabMemory')}
            </button>
            <button
              type="button"
              title={t('crm.aiAssistant.emailComposer.title')}
              onClick={() => setEmailComposerOpen(true)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold !text-slate-900 shadow-sm transition hover:border-violet-400 hover:bg-violet-50"
            >
              {t('crm.aiAssistant.openEmailComposer')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-lg font-light leading-none !text-slate-800 shadow-md transition hover:border-slate-400 hover:bg-slate-50"
            >
              ×
            </button>
          </div>
        </div>

        {!configured && (
          <div className="mx-5 mt-3 rounded-xl border border-amber-200/70 bg-amber-50/85 px-3 py-2.5 text-xs text-amber-950 shadow-sm backdrop-blur-sm">
            {t('crm.aiAssistant.notConfigured')}
          </div>
        )}

        {error && (
          <div className="mx-5 mt-2 rounded-xl border border-rose-200/70 bg-rose-50/85 px-3 py-2.5 text-xs text-rose-900 shadow-sm backdrop-blur-sm">
            {error}
          </div>
        )}

        {tab === 'memory' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-slate-100/90 px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t('crm.aiAssistant.chatHistoryTitle')}
              </div>
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('crm.aiAssistant.chatHistoryEmpty')}</p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex w-full items-stretch gap-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50 text-xs transition hover:border-violet-200 hover:bg-white hover:shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => void openChatFromHistory(s.id)}
                        className="flex min-w-0 flex-1 items-start justify-between gap-2 px-3 py-2 text-left transition hover:bg-white/80"
                      >
                        <span className="line-clamp-2 font-medium text-slate-800">
                          {(s.title || t('crm.aiAssistant.chatUntitled')).slice(0, 120)}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatSessionDate(s.updatedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        title={t('crm.aiAssistant.deleteSession')}
                        className="shrink-0 border-l border-slate-100/80 px-2.5 py-2 text-[10px] font-semibold text-rose-600 hover:bg-rose-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteSessionFromList(s.id);
                        }}
                      >
                        {t('crm.aiAssistant.deleteChatFromList')}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2 border-b border-slate-100/90 px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t('crm.aiAssistant.memoryFragmentsTitle')}
              </div>
              <input
                className="ai-assistant-input w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm !text-slate-900 shadow-sm outline-none transition placeholder:!text-slate-500 caret-slate-900 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                placeholder={t('crm.aiAssistant.memoryTitlePh')}
                value={memTitle}
                onChange={(e) => setMemTitle(e.target.value)}
              />
              <textarea
                className="ai-assistant-input min-h-[80px] w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm !text-slate-900 shadow-sm outline-none transition placeholder:!text-slate-500 caret-slate-900 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                placeholder={t('crm.aiAssistant.memoryContentPh')}
                value={memContent}
                onChange={(e) => setMemContent(e.target.value)}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => void saveMemory()}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-semibold text-white shadow-md hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50"
              >
                {t('crm.aiAssistant.saveMemory')}
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {memory.length === 0 ? (
                <p className="text-xs text-slate-400">{t('crm.aiAssistant.memoryListEmpty')}</p>
              ) : (
                memory.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50/90 to-white p-3 text-xs text-slate-700 shadow-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {m.title || t('crm.aiAssistant.memoryUntitled')}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-rose-500 hover:underline"
                        onClick={() => void removeMemory(m.id)}
                      >
                        {t('crm.common.delete')}
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
                      {m.content.slice(0, 2000)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/40 bg-slate-100/90 px-5 py-2.5">
              <button
                type="button"
                onClick={() => void startNewChat()}
                className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-[11px] font-medium !text-slate-900 shadow-sm transition hover:border-violet-400 hover:text-violet-800"
              >
                {t('crm.aiAssistant.newChat')}
              </button>
              <select
                className="max-w-[220px] rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] !text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                value={sessionId || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) void selectSession(v);
                }}
              >
                <option value="">{t('crm.aiAssistant.pickSession')}</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(s.title || t('crm.aiAssistant.chatUntitled')).slice(0, 42)}
                  </option>
                ))}
              </select>
              {sessionId && (
                <button
                  type="button"
                  className="text-[11px] font-medium !text-rose-600 hover:underline"
                  onClick={() => void deleteAiSession(sessionId).then(() => startNewChat())}
                >
                  {t('crm.aiAssistant.deleteSession')}
                </button>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {hub && messages.length === 0 ? (
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
                  <h2 className="text-center text-[1.35rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl">
                    {t('crm.aiAssistant.greeting', { name: displayName })}
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-center text-sm leading-relaxed text-slate-500">
                    {t('crm.aiAssistant.subGreeting')}
                  </p>

                  <div className="relative mx-auto mt-6 w-full max-w-xl px-1">
                    <label className="mb-1 block text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {t('crm.aiAssistant.chatTitleField')}
                    </label>
                    <input
                      type="text"
                      className="ai-assistant-input w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm !text-slate-900 shadow-sm outline-none transition placeholder:!text-slate-400 caret-slate-900 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                      placeholder={t('crm.aiAssistant.chatTitlePlaceholder')}
                      value={newChatTitleDraft}
                      maxLength={200}
                      onChange={(e) => {
                        const v = e.target.value;
                        newChatTitleDraftRef.current = v;
                        setNewChatTitleDraft(v);
                      }}
                      disabled={loading || !configured}
                    />
                    <p className="mt-1 text-center text-[10px] text-slate-500">
                      {t('crm.aiAssistant.chatTitleHint')}
                    </p>
                  </div>

                  <div className="relative mx-auto mt-6 max-w-xl">
                    <div
                      className="rounded-2xl p-[2px] shadow-[0_12px_40px_rgba(99,102,241,0.15),0_4px_12px_rgba(15,23,42,0.08)]"
                      style={{
                        background:
                          'linear-gradient(125deg, #c084fc, #818cf8, #22d3ee, #34d399, #fbbf24, #fb7185)',
                      }}
                    >
                      <div className="rounded-[14px] bg-white p-1 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)]">
                        <textarea
                          className="ai-assistant-input min-h-[104px] w-full resize-none border-0 bg-white px-3 py-3 text-sm !text-slate-900 outline-none focus:ring-0 placeholder:!text-slate-500 caret-slate-900"
                          placeholder={t('crm.aiAssistant.inputPlaceholder')}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void send();
                            }
                          }}
                        />
                        <div className="flex flex-col gap-1 border-t border-slate-200 bg-slate-50/80">
                          <div className="flex flex-wrap items-center gap-2 px-2 pt-2">
                            <button
                              type="button"
                              title={t('crm.aiAssistant.attachFileTitle')}
                              onClick={() => fileInputRef.current?.click()}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-800"
                            >
                              <PaperclipIcon className="h-4 w-4" />
                            </button>
                            <span className="text-[10px] font-medium text-slate-600">
                              {t('crm.aiAssistant.addContextLabel')}
                            </span>
                            {salesImportAttachment && (
                              <span className="inline-flex max-w-[min(100%,280px)] items-center gap-1 truncate rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-800">
                                <span className="truncate">
                                  {t('crm.aiAssistant.attachedSales')}:{' '}
                                  {salesImportAttachment.fileName}
                                </span>
                                <button
                                  type="button"
                                  className="shrink-0 text-rose-600 hover:underline"
                                  onClick={() => setSalesImportAttachment(null)}
                                >
                                  {t('crm.aiAssistant.removeAttachment')}
                                </button>
                              </span>
                            )}
                            {workspaceCsvAttachment &&
                              workspaceCsvAttachment.headers.length > 0 && (
                                <span className="inline-flex max-w-[min(100%,280px)] items-center gap-1 truncate rounded-full border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 text-[10px] text-emerald-950">
                                  <span className="truncate">
                                    {t('crm.aiAssistant.attachedWorkspaceCsv')}:{' '}
                                    {workspaceCsvAttachment.fileName} (
                                    {workspaceCsvAttachment.rows.length})
                                  </span>
                                  <button
                                    type="button"
                                    className="shrink-0 text-rose-600 hover:underline"
                                    onClick={() => setWorkspaceCsvAttachment(null)}
                                  >
                                    {t('crm.aiAssistant.removeAttachment')}
                                  </button>
                                </span>
                              )}
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2 pb-2">
                            <span className="text-[10px] text-slate-500">
                              {t('crm.aiAssistant.addContextHint')}
                            </span>
                            <button
                              type="button"
                              disabled={
                                loading ||
                                !configured ||
                                (!input.trim() &&
                                  !salesImportAttachment &&
                                  !workspaceCsvAttachment)
                              }
                              onClick={() => void send()}
                              title={t('crm.aiAssistant.send')}
                              className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-violet-700 bg-violet-600 !text-white shadow-[0_4px_14px_rgba(109,40,217,0.45)] transition hover:bg-violet-700 hover:brightness-105 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-200 disabled:shadow-none"
                            >
                              <SendArrowIcon className="h-5 w-5 shrink-0 text-white group-disabled:text-slate-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {imagePanelOpen && (
                    <div className="mx-auto mt-6 w-full max-w-xl rounded-2xl border border-violet-200 bg-violet-50/95 p-4 shadow-sm">
                      <div className="text-xs font-semibold text-slate-900">
                        {t('crm.aiAssistant.imagePanelTitle')}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                        {t('crm.aiAssistant.imagePanelHint')}
                      </p>
                      <textarea
                        className="ai-assistant-input mt-3 min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                        value={imagePromptLocal}
                        onChange={(e) => setImagePromptLocal(e.target.value)}
                        placeholder={t('crm.aiAssistant.imagePrompt')}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loading || !configured || !imagePromptLocal.trim()}
                          onClick={() => void runImageWithPrompt(imagePromptLocal)}
                          className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50"
                        >
                          {t('crm.aiAssistant.generateImageAction')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImagePanelOpen(false);
                            setImagePromptLocal('');
                          }}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                        >
                          {t('crm.common.cancel')}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mx-auto mt-9 w-full max-w-lg px-1">
                    <div className="flex flex-col items-center gap-5">
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-4 sm:gap-x-4">
                        {renderPresetKeyRow(PRESET_ORDER.slice(0, 5))}
                      </div>
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-4 sm:gap-x-4">
                        {renderPresetKeyRow(PRESET_ORDER.slice(5))}
                        <button
                          type="button"
                          title={t('crm.aiAssistant.presetQuickActionTitle')}
                          onClick={() => {
                            void (async () => {
                              try {
                                await ensureSessionId();
                              } catch {
                                return;
                              }
                              setImagePanelOpen(true);
                              setImagePromptLocal((prev) => prev || input.trim());
                            })();
                          }}
                          className="group flex w-[76px] shrink-0 flex-col items-center gap-2 text-center"
                        >
                          <PresetCircleRing presetKey="image">
                            <MondayLineIcon presetKey="image" />
                          </PresetCircleRing>
                          <span className="text-[10px] font-medium leading-tight text-slate-600">
                            {t('crm.aiAssistant.genImage')}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="mt-10 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                    {t('crm.aiAssistant.cardsIntro')}
                  </p>
                  <div className="mx-auto mt-4 w-full rounded-2xl bg-slate-200/50 p-3 ring-1 ring-slate-300/60">
                    <div className="grid w-full grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
                    {presetCards.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          void (async () => {
                            try {
                              await ensureSessionId();
                            } catch {
                              return;
                            }
                            setInput(c.prompt);
                            setHub(false);
                          })();
                        }}
                        className="group rounded-xl border-2 border-slate-200 bg-white p-3.5 text-left shadow-[0_4px_16px_rgba(15,23,42,0.08)] transition hover:border-violet-400 hover:shadow-[0_8px_24px_rgba(99,102,241,0.15)]"
                      >
                        <span className="mb-2 inline-block rounded-lg bg-violet-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 group-hover:bg-violet-100">
                          {c.tag}
                        </span>
                        <div className="text-[11px] font-medium leading-snug text-slate-800">{c.title}</div>
                      </button>
                    ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {lastImageUrl && (
                    <div className="rounded-2xl border border-emerald-100/90 bg-emerald-50/90 p-3 text-xs text-emerald-950 shadow-sm">
                      <div className="mb-2 font-semibold">{t('crm.aiAssistant.imageReady')}</div>
                      <img
                        src={lastImageUrl}
                        alt=""
                        className="max-h-48 w-auto max-w-full rounded-xl border border-white shadow"
                      />
                      <button
                        type="button"
                        className="mt-2 text-[11px] font-medium text-emerald-700 underline"
                        onClick={() => setLastImageUrl(null)}
                      >
                        {t('crm.aiAssistant.dismissImage')}
                      </button>
                    </div>
                  )}
                  {displayMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-[0_4px_16px_rgba(15,23,42,0.08)] ${
                          m.role === 'user'
                            ? 'border border-lumiva-accent/30 bg-lumiva-accent !text-white'
                            : 'border border-slate-200 bg-white !text-slate-900 shadow-sm'
                        }`}
                      >
                        <AiChatMarkdown
                          text={m.content || ''}
                          variant={m.role === 'user' ? 'user' : 'assistant'}
                        />
                      </div>
                    </div>
                  ))}
                  {(loading || imageGenPending) && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                      {imageGenPending
                        ? t('crm.aiAssistant.imageGenerating')
                        : t('crm.aiAssistant.thinking')}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}

              {!hub || messages.length > 0 ? (
                <div className="border-t border-slate-200/80 bg-slate-100/95 px-4 py-3 shadow-[0_-8px_32px_rgba(15,23,42,0.06)]">
                  <div
                    className="rounded-xl p-[2px] shadow-[0_8px_24px_rgba(99,102,241,0.12)]"
                    style={{
                      background:
                        'linear-gradient(120deg, #c084fc, #818cf8, #22d3ee, #34d399, #fbbf24)',
                    }}
                  >
                    <div className="flex flex-col gap-1.5 rounded-[10px] border border-slate-100 bg-white p-2 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]">
                      <div className="flex flex-wrap items-center gap-2 px-0.5">
                        <button
                          type="button"
                          title={t('crm.aiAssistant.attachFileTitle')}
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-violet-300 hover:text-violet-800"
                        >
                          <PaperclipIcon className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] font-medium text-slate-600">
                          {t('crm.aiAssistant.addContextLabel')}
                        </span>
                        {salesImportAttachment && (
                          <span className="inline-flex max-w-[200px] items-center gap-1 truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] text-slate-800">
                            <span className="truncate">{salesImportAttachment.fileName}</span>
                            <button
                              type="button"
                              className="shrink-0 text-rose-600"
                              onClick={() => setSalesImportAttachment(null)}
                            >
                              ×
                            </button>
                          </span>
                        )}
                        {workspaceCsvAttachment &&
                          workspaceCsvAttachment.headers.length > 0 && (
                            <span className="inline-flex max-w-[200px] items-center gap-1 truncate rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] text-emerald-950">
                              <span className="truncate">
                                {workspaceCsvAttachment.fileName}
                              </span>
                              <button
                                type="button"
                                className="shrink-0 text-rose-600"
                                onClick={() => setWorkspaceCsvAttachment(null)}
                              >
                                ×
                              </button>
                            </span>
                          )}
                      </div>
                      <div className="flex items-end gap-2">
                        <textarea
                          className="ai-assistant-input max-h-32 min-h-[44px] flex-1 resize-none border-0 bg-white px-2 py-2 text-sm !text-slate-900 outline-none placeholder:!text-slate-500 caret-slate-900"
                          placeholder={t('crm.aiAssistant.chatPlaceholder')}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void send();
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={
                            loading ||
                            !configured ||
                            (!input.trim() &&
                              !salesImportAttachment &&
                              !workspaceCsvAttachment)
                          }
                          onClick={() => void send()}
                          title={t('crm.aiAssistant.send')}
                          className="group mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-violet-700 bg-violet-600 !text-white shadow-[0_4px_14px_rgba(109,40,217,0.45)] transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-200 disabled:shadow-none"
                        >
                          <SendArrowIcon className="h-5 w-5 shrink-0 text-white group-disabled:text-slate-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void topup('ai_prepaid')}
                      className="rounded-full border border-violet-400 bg-violet-100 px-3 py-1 text-[10px] font-semibold !text-violet-950 shadow-sm transition hover:bg-violet-200"
                    >
                      {t('crm.aiAssistant.topupAi')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void topup('storage_pack')}
                      className="rounded-full border-2 border-slate-400 bg-white px-3 py-1 text-[10px] font-medium !text-slate-900 shadow-sm transition hover:bg-slate-50"
                    >
                      {t('crm.aiAssistant.topupStorage')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHub(true)}
                      className="rounded-full border-2 border-slate-400 bg-white px-3 py-1 text-[10px] font-medium !text-slate-900 shadow-sm transition hover:bg-slate-50"
                    >
                      {t('crm.aiAssistant.backToHub')}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
        </div>
      </aside>
    </div>,
    document.body,
  );
};

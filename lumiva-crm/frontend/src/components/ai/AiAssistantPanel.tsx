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
  type AiChatWorkspaceFileContext,
  type AiMemoryChunkDto,
  type AiQuotaSnapshot,
} from '../../api/ai';
import { previewSalesImport, previewWorkspaceFileImport } from '../../api/imports';
import { ApiError, createAiAddonCheckoutSession } from '../../api/client';
import { AiChatMarkdown } from './AiChatMarkdown';
import { AiEmailComposerTab } from './AiEmailComposerTab';
import { OpenAiConnectModal } from '../integrations/OpenAiConnectModal';
import { LottieIcon } from '../LottieIcon';
import { InlineHelpButton } from '../help/PageHelpButton';

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

/** Инициалы для аватара в переписке (1-2 буквы); email не учитываем */
function initialsFromName(raw: string | null | undefined): string {
  const s = (raw || '').trim();
  if (!s || s.includes('@')) return '';
  const parts = s.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

/* ---- flat monochrome line icons (замена старым цветным круглым иконкам) ---- */

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth={1.6} />
      <path
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 19V6M12 6l-6 6M12 6l6 6"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h13M12 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Иконки быстрых сценариев — плоские, монохромные (см. crm.aiAssistant.presets) */
const PRESET_ICON: Record<string, (p: { className?: string }) => React.JSX.Element> = {
  board: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth={1.5} />
      <path d="M9 4v16M15 4v16" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  ),
  doc: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  ),
  search: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M4.5 5.5v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path
        d="M4.5 11.5v6c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8v-6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  ),
  data: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V11M12 19V5M19 19v-6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  ),
  brain: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18h6M10 21h4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path
        d="M12 3a6 6 0 0 0-3.5 10.9c.3.3.5.7.5 1.1v1h6v-1c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  image: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth={1.5} />
      <circle cx="8.5" cy="10" r="1.4" stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M4 17l4.5-4.5 3 3 3.5-3L20 17"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  vibe: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 5h16v14H4z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 9h6M7 12.5h10M7 16h10" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  ),
  more: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 3v6M15 3v6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M6 9h12v3a6 6 0 0 1-12 0z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 18v3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  ),
};

const PRESET_ORDER = ['board', 'doc', 'search', 'data', 'brain', 'image', 'vibe', 'more'] as const;

/** Заметный "проговариваемый" прелоадер на время создания таблицы рабочей области и импорта строк из файла. */
function WorkspaceImportingIndicator({
  fileName,
  totalRows,
}: {
  fileName?: string;
  totalRows: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-slate-200 border-t-[#5b4bec]" />
        <PlusIcon className="h-3.5 w-3.5 rotate-45 text-slate-700" />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-900">
          {t('crm.aiAssistant.workspaceImporting')}
        </div>
        {fileName && (
          <div className="truncate text-[11px] text-slate-500">
            {fileName}
            {totalRows ? ` · ${totalRows} ${t('crm.aiAssistant.rowsShort')}` : ''}
          </div>
        )}
        <div className="mt-1.5 h-1 w-40 max-w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 animate-indeterminate-bar rounded-full bg-[#5b4bec]" />
        </div>
      </div>
    </div>
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
  const [tab, setTab] = useState<'assistant' | 'memory' | 'letter'>('assistant');
  const [hub, setHub] = useState(true);
  const [quota, setQuota] = useState<AiQuotaSnapshot | null>(null);
  const [usingOwnKey, setUsingOwnKey] = useState(false);
  const [ownKeyModalOpen, setOwnKeyModalOpen] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessageDto[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const speechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
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
  const [workspaceFileAttachment, setWorkspaceFileAttachment] =
    useState<AiChatWorkspaceFileContext | null>(null);
  const [workspaceImportPending, setWorkspaceImportPending] = useState<{
    fileName?: string;
    totalRows: number;
  } | null>(null);
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
    const hasAtt = Boolean(salesImportAttachment || workspaceFileAttachment);
    if ((!text && !hasAtt) || loading) return;
    const salesCtx = salesImportAttachment || undefined;
    const wsCtx =
      workspaceFileAttachment && workspaceFileAttachment.columns.length > 0
        ? workspaceFileAttachment
        : undefined;
    setInput('');
    setSalesImportAttachment(null);
    setWorkspaceFileAttachment(null);
    setError(null);
    setHub(false);
    setLoading(true);
    if (wsCtx) setWorkspaceImportPending({ fileName: wsCtx.fileName, totalRows: wsCtx.totalRows });
    try {
      const sid = await ensureSessionId();
      const res = await postAiChat({
        sessionId: sid,
        message: text,
        salesImportContext: salesCtx,
        workspaceFileContext: wsCtx,
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
      setUsingOwnKey(Boolean(res.usingOwnKey));
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
      if (wsCtx) setWorkspaceFileAttachment(wsCtx);
    } finally {
      setLoading(false);
      setWorkspaceImportPending(null);
    }
  };

  const toggleVoice = () => {
    if (!speechSupported) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' + transcript : transcript));
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  const onAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setSalesImportAttachment(null);
    setWorkspaceFileAttachment(null);
    let wsErrorMessage: string | null = null;
    const [salesResult, wsResult] = await Promise.all([
      previewSalesImport(file).catch(() => null),
      previewWorkspaceFileImport(file).catch((err) => {
        wsErrorMessage = err instanceof Error ? err.message : null;
        return null;
      }),
    ]);
    if (salesResult) {
      setSalesImportAttachment({
        importId: salesResult.importId,
        suggestedMapping: salesResult.suggestedMapping,
        fileName: file.name,
        totalRows: salesResult.totalRows,
      });
    }
    if (wsResult && wsResult.columns.length > 0) {
      setWorkspaceFileAttachment({
        importId: wsResult.importId,
        fileName: file.name,
        tableNameHint: file.name.replace(/\.[^/.]+$/, ''),
        columns: wsResult.columns,
        sample: wsResult.sample,
        totalRows: wsResult.totalRows,
      });
    }
    if (!salesResult && !(wsResult && wsResult.columns.length > 0)) {
      setError(wsErrorMessage || t('crm.aiAssistant.attachParseError'));
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

  const formatMsgTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(i18n.language || 'ru', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const runPreset = (key: (typeof PRESET_ORDER)[number]) => {
    const p = quickPresets[key];
    if (!p) return;
    void (async () => {
      try {
        await ensureSessionId();
      } catch {
        return;
      }
      setInput(p.prompt);
      setHub(false);
    })();
  };

  if (!open) return null;

  const displayName = greetingDisplayName(userName, t('crm.aiAssistant.fallbackName'));
  const userInitials = initialsFromName(userName) || t('crm.aiAssistant.fallbackName').slice(0, 2).toUpperCase();

  const composerAttachChip = (compact: boolean) => (
    <>
      {salesImportAttachment && (
        <span
          className={`inline-flex items-center gap-1.5 truncate rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-slate-700 ${compact ? 'max-w-[180px] text-[10px]' : 'max-w-[min(100%,280px)] text-[11px]'}`}
        >
          <span className="truncate font-medium">
            {t('crm.aiAssistant.attachedSales')}: {salesImportAttachment.fileName}
          </span>
          <button
            type="button"
            className="shrink-0 text-slate-400 transition hover:text-rose-600"
            onClick={() => setSalesImportAttachment(null)}
          >
            <CloseIcon className="h-2.5 w-2.5" />
          </button>
        </span>
      )}
      {workspaceFileAttachment && workspaceFileAttachment.columns.length > 0 && (
        <span
          className={`inline-flex items-center gap-1.5 truncate rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-slate-700 ${compact ? 'max-w-[180px] text-[10px]' : 'max-w-[min(100%,280px)] text-[11px]'}`}
        >
          <span className="truncate font-medium">
            {t('crm.aiAssistant.attachedWorkspaceCsv')}: {workspaceFileAttachment.fileName} (
            {workspaceFileAttachment.totalRows})
          </span>
          <button
            type="button"
            className="shrink-0 text-slate-400 transition hover:text-rose-600"
            onClick={() => setWorkspaceFileAttachment(null)}
          >
            <CloseIcon className="h-2.5 w-2.5" />
          </button>
        </span>
      )}
    </>
  );

  const canSend = !loading && configured && (input.trim() || salesImportAttachment || workspaceFileAttachment);

  return createPortal(
    <div className="fixed inset-0 z-[8500] flex flex-row text-slate-900 [color-scheme:light]">
      <OpenAiConnectModal
        open={ownKeyModalOpen}
        onClose={() => setOwnKeyModalOpen(false)}
        onCreated={() => setOwnKeyModalOpen(false)}
      />
      {/* Затемнение и размытие страницы под панелью */}
      <button
        type="button"
        className="min-h-0 min-w-0 flex-1 cursor-default border-0 p-0"
        style={{
          backgroundColor: 'rgba(20, 20, 22, 0.34)',
          WebkitBackdropFilter: 'blur(6px) saturate(1.1)',
          backdropFilter: 'blur(6px) saturate(1.1)',
        }}
        aria-label={t('crm.common.close')}
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full min-w-0 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[-40px_0_90px_-30px_rgba(15,17,25,0.35)] md:w-[min(46%,660px)] md:min-w-[520px]">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.txt,.xml,.xlsx,.xls,text/csv,text/plain,application/xml,text/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={(e) => void onAttachFile(e)}
        />
        <div className="h-[2px] w-full shrink-0 bg-gradient-to-r from-[#5b4bec] via-[#8f7bff] to-[#0f172a]" aria-hidden />

        {/* HEADER */}
        <div className="shrink-0 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-[#5b4bec]">
                Lumiva AI
              </div>
              <div className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight text-slate-900">
                {t('crm.aiAssistant.title')}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-[3px]">
                <button
                  type="button"
                  onClick={() => setTab('assistant')}
                  className={`rounded-full px-3 py-[5px] text-[12px] font-medium transition ${
                    tab === 'assistant' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-900'
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
                  className={`rounded-full px-3 py-[5px] text-[12px] font-medium transition ${
                    tab === 'memory' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t('crm.aiAssistant.tabMemory')}
                </button>
                <button
                  type="button"
                  title={t('crm.aiAssistant.emailComposer.title')}
                  onClick={() => setTab('letter')}
                  className={`rounded-full px-3 py-[5px] text-[12px] font-medium transition ${
                    tab === 'letter' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t('crm.aiAssistant.openEmailComposer')}
                </button>
              </div>
              <InlineHelpButton
                topic="aiAssistant"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-[#0f172a] hover:text-slate-900"
              />
              <button
                type="button"
                onClick={onClose}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-[#0f172a] hover:text-slate-900"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            {usingOwnKey ? (
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-slate-400">
                  {t('crm.aiAssistant.usingOwnKey')}
                </span>
              </span>
            ) : quota ? (
              <span className="inline-flex items-center gap-2.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-slate-400">AI</span>
                  <span className="text-[12.5px] font-semibold leading-none tracking-tight text-slate-900">
                    ~{formatCents(quota.totalAvailableCents)} USD
                  </span>
                </span>
                <span className="h-6 w-px bg-slate-200" />
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-slate-400">
                    {t('crm.aiAssistant.topupStorage').replace('+ ', '')}
                  </span>
                  <span className="text-[11.5px] font-medium leading-none text-slate-700">
                    {formatBytes(quota.storageUsedBytes)} / {formatBytes(quota.storageQuotaBytes)}
                  </span>
                </span>
              </span>
            ) : null}
            {!usingOwnKey && (
              <button
                type="button"
                onClick={() => setOwnKeyModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#ddd8ff] bg-[#f1efff] px-2.5 py-1.5 text-[12px] font-medium text-[#5b4bec] transition hover:border-[#5b4bec] hover:bg-[#e9e5ff]"
              >
                <PlusIcon className="h-3 w-3" />
                {t('crm.aiAssistant.connectOwnKey')}
              </button>
            )}
          </div>
        </div>

        {!configured && (
          <div className="mx-5 mt-3 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            {t('crm.aiAssistant.notConfigured')}
          </div>
        )}
        {error && (
          <div className="mx-5 mt-2 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-900">
            {error}
          </div>
        )}

        {tab === 'letter' ? (
          /* ---------------------------- LETTER TAB ---------------------------- */
          <AiEmailComposerTab active={tab === 'letter'} />
        ) : tab === 'memory' ? (
          /* ---------------------------- MEMORY TAB ---------------------------- */
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  {t('crm.aiAssistant.chatHistoryTitle')}
                </span>
                <span className="h-px flex-1 bg-slate-100" />
                <span className="font-mono text-[9.5px] text-slate-300">
                  {String(sessions.length).padStart(2, '0')}
                </span>
              </div>
              <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('crm.aiAssistant.chatHistoryEmpty')}</p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition hover:border-[#0f172a]"
                    >
                      <button
                        type="button"
                        onClick={() => void openChatFromHistory(s.id)}
                        className="min-w-0 flex-1 truncate text-left text-[12.5px] text-slate-900"
                      >
                        {(s.title || t('crm.aiAssistant.chatUntitled')).slice(0, 120)}
                      </button>
                      <span className="shrink-0 font-mono text-[9.5px] text-slate-400">
                        {formatSessionDate(s.updatedAt)}
                      </span>
                      <button
                        type="button"
                        title={t('crm.aiAssistant.deleteSession')}
                        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteSessionFromList(s.id);
                        }}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-b border-slate-100 px-5 py-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  {t('crm.aiAssistant.memoryFragmentsTitle')}
                </span>
                <span className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
                <input
                  className="ai-assistant-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] !text-slate-900 outline-none transition placeholder:!text-slate-400 focus:border-[#c9c3ff] focus:ring-2 focus:ring-[#5b4bec]/10"
                  placeholder={t('crm.aiAssistant.memoryTitlePh')}
                  value={memTitle}
                  onChange={(e) => setMemTitle(e.target.value)}
                />
                <textarea
                  className="ai-assistant-input min-h-[80px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] !text-slate-900 outline-none transition placeholder:!text-slate-400 focus:border-[#c9c3ff] focus:ring-2 focus:ring-[#5b4bec]/10"
                  placeholder={t('crm.aiAssistant.memoryContentPh')}
                  value={memContent}
                  onChange={(e) => setMemContent(e.target.value)}
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400">
                    {t('crm.aiAssistant.addContextHint')}
                  </span>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void saveMemory()}
                    className="shrink-0 rounded-lg bg-[#0f172a] px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {t('crm.aiAssistant.saveMemory')}
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {memory.length > 0 && (
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="font-mono text-[9.5px] text-slate-300">
                    {String(memory.length).padStart(2, '0')}
                  </span>
                  <span className="h-px flex-1 bg-slate-100" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                {memory.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('crm.aiAssistant.memoryListEmpty')}</p>
                ) : (
                  memory.map((m) => (
                    <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                      <div className="flex items-start justify-between gap-2.5">
                        <span className="text-[13px] font-semibold tracking-tight text-slate-900">
                          {m.title || t('crm.aiAssistant.memoryUntitled')}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 text-[11px] font-medium text-slate-400 transition hover:text-rose-600"
                          onClick={() => void removeMemory(m.id)}
                        >
                          {t('crm.common.delete')}
                        </button>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600">
                        {m.content.slice(0, 2000)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ---------------------------- CHAT TAB ---------------------------- */
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2.5">
              <button
                type="button"
                onClick={() => void startNewChat()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-[7px] text-[12.5px] font-medium text-slate-900 transition hover:border-[#0f172a]"
              >
                <PlusIcon className="h-3 w-3 text-slate-400" />
                {t('crm.aiAssistant.newChat')}
              </button>
              <div className="relative max-w-[220px] flex-1">
                <select
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-[7px] pl-3 pr-7 text-[12.5px] text-slate-900 outline-none focus:border-[#0f172a]"
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
                <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
              {sessionId && (
                <button
                  type="button"
                  className="text-[12px] font-medium text-slate-400 transition hover:text-rose-600"
                  onClick={() => void deleteAiSession(sessionId).then(() => startNewChat())}
                >
                  {t('crm.aiAssistant.deleteSession')}
                </button>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {hub && messages.length === 0 ? (
                /* ---- HUB / стартовый экран ---- */
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
                  <div className="text-center">
                    <div className="flex justify-center">
                      <LottieIcon name="welcome" size={110} />
                    </div>
                    <h2 className="text-[1.35rem] font-semibold leading-snug tracking-tight text-slate-900">
                      {t('crm.aiAssistant.greeting', { name: displayName })
                        .split(displayName)
                        .map((part, i, arr) =>
                          i < arr.length - 1 ? (
                            <React.Fragment key={i}>
                              {part}
                              <em className="text-[#5b4bec] not-italic">{displayName}</em>
                            </React.Fragment>
                          ) : (
                            part
                          ),
                        )}
                    </h2>
                    <p className="mx-auto mt-2 max-w-lg text-[13.5px] leading-relaxed text-slate-500">
                      {t('crm.aiAssistant.subGreeting')}
                    </p>
                  </div>

                  <div className="mt-6 w-full">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_-22px_rgba(15,17,25,0.4)] transition focus-within:border-[#c9c3ff] focus-within:shadow-[0_0_0_3px_rgba(91,75,236,0.09)]">
                      <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2">
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">
                          {t('crm.aiAssistant.chatTitleField')}
                        </span>
                        <input
                          type="text"
                          className="ai-assistant-input min-w-0 flex-1 border-0 bg-transparent px-0 py-0.5 text-[12.5px] !text-slate-900 outline-none placeholder:!text-slate-400"
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
                      </div>
                      <textarea
                        className="ai-assistant-input block min-h-[96px] w-full resize-none border-0 bg-white px-4 py-4 text-[14.5px] leading-relaxed !text-slate-900 outline-none focus:ring-0 placeholder:!text-slate-400"
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
                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-2.5 py-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            title={t('crm.aiAssistant.attachFileTitle')}
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600 transition hover:border-[#0f172a] hover:text-slate-900"
                          >
                            <PaperclipIcon className="h-3.5 w-3.5" />
                            {t('crm.aiAssistant.addContextLabel')}
                          </button>
                          {speechSupported && (
                            <button
                              type="button"
                              onClick={toggleVoice}
                              title={isListening ? 'Остановить запись' : 'Голосовой ввод'}
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${isListening ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-600 hover:border-[#0f172a] hover:text-slate-900'}`}
                            >
                              <MicIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {composerAttachChip(false)}
                        </div>
                        <button
                          type="button"
                          disabled={!canSend}
                          onClick={() => void send()}
                          title={t('crm.aiAssistant.send')}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0f172a] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          <SendArrowIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 px-1">
                      <span className="text-[11px] text-slate-400">{t('crm.aiAssistant.chatTitleHint')}</span>
                      <span className="hidden shrink-0 items-center gap-1 text-[11px] text-slate-400 sm:inline-flex">
                        <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[9.5px]">Enter</kbd>
                        {t('crm.aiAssistant.send')}
                      </span>
                    </div>
                  </div>

                  {imagePanelOpen && (
                    <div className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold text-slate-900">
                        {t('crm.aiAssistant.imagePanelTitle')}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {t('crm.aiAssistant.imagePanelHint')}
                      </p>
                      <textarea
                        className="ai-assistant-input mt-3 min-h-[96px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#c9c3ff] focus:ring-2 focus:ring-[#5b4bec]/10"
                        value={imagePromptLocal}
                        onChange={(e) => setImagePromptLocal(e.target.value)}
                        placeholder={t('crm.aiAssistant.imagePrompt')}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loading || !configured || !imagePromptLocal.trim()}
                          onClick={() => void runImageWithPrompt(imagePromptLocal)}
                          className="rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
                        >
                          {t('crm.aiAssistant.generateImageAction')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImagePanelOpen(false);
                            setImagePromptLocal('');
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:border-[#0f172a]"
                        >
                          {t('crm.common.cancel')}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 w-full">
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-slate-400">
                        {t('crm.aiAssistant.presetQuickActionTitle')}
                      </span>
                      <span className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {PRESET_ORDER.map((key) => {
                        const p = quickPresets[key];
                        if (!p) return null;
                        const Icon = PRESET_ICON[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            title={t('crm.aiAssistant.presetQuickActionTitle')}
                            onClick={() => runPreset(key)}
                            className="group flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-left transition hover:-translate-y-px hover:border-[#0f172a] hover:shadow-[0_10px_22px_-18px_rgba(15,17,25,0.5)]"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-900 transition group-hover:border-[#0f172a] group-hover:bg-[#0f172a] group-hover:text-white">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-medium leading-tight text-slate-900">
                                {p.label}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        title={t('crm.aiAssistant.genImage')}
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
                        className="group flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-left transition hover:-translate-y-px hover:border-[#0f172a] hover:shadow-[0_10px_22px_-18px_rgba(15,17,25,0.5)]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-900 transition group-hover:border-[#0f172a] group-hover:bg-[#0f172a] group-hover:text-white">
                          <PRESET_ICON.image className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-medium leading-tight text-slate-900">
                            {t('crm.aiAssistant.genImage')}
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 w-full">
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-slate-400">
                        {t('crm.aiAssistant.cardsIntro')}
                      </span>
                      <span className="h-px flex-1 bg-slate-100" />
                      <span className="font-mono text-[9.5px] text-slate-300">
                        {String(presetCards.length).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
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
                          className="group relative flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-[#0f172a] hover:shadow-[0_10px_24px_-20px_rgba(15,17,25,0.5)]"
                        >
                          <span className="font-mono text-[8.5px] font-medium uppercase tracking-[0.11em] text-slate-400">
                            {c.tag}
                          </span>
                          <p className="pr-4 text-[12.5px] leading-snug text-slate-800">{c.title}</p>
                          <ArrowRightIcon className="absolute bottom-3 right-3 h-3.5 w-3.5 -translate-x-0.5 text-slate-300 opacity-0 transition group-hover:translate-x-0 group-hover:text-slate-900 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* ---- активный диалог ---- */
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                  {lastImageUrl && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
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
                  {displayMessages.map((m) => {
                    const isUser = m.role === 'user';
                    return (
                      <div key={m.id} className="flex gap-2.5">
                        <span
                          className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg font-mono text-[9px] font-medium tracking-wide ${
                            isUser ? 'border border-slate-200 bg-slate-50 text-slate-600' : 'bg-[#0f172a] text-white'
                          }`}
                        >
                          {isUser ? userInitials : 'AI'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">
                            {isUser ? `Вы · ${formatMsgTime(m.createdAt)}` : t('crm.aiAssistant.title')}
                          </div>
                          <div
                            className={`text-[13.5px] leading-relaxed ${
                              isUser ? 'rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-900' : 'text-slate-800'
                            }`}
                          >
                            <AiChatMarkdown text={m.content || ''} variant={isUser ? 'user' : 'assistant'} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(loading || imageGenPending) &&
                    (workspaceImportPending ? (
                      <WorkspaceImportingIndicator
                        fileName={workspaceImportPending.fileName}
                        totalRows={workspaceImportPending.totalRows}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 pl-9 text-xs text-slate-400">
                        <LottieIcon name="ai-sparkle-orbit" size={20} className="shrink-0 -my-1.5" />
                        {imageGenPending ? t('crm.aiAssistant.imageGenerating') : t('crm.aiAssistant.thinking')}
                      </div>
                    ))}
                  <div ref={bottomRef} />
                </div>
              )}

              {!hub || messages.length > 0 ? (
                /* ---- докованный композер ---- */
                <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3.5">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-[#c9c3ff] focus-within:ring-2 focus-within:ring-[#5b4bec]/10">
                    <textarea
                      className="ai-assistant-input block max-h-32 min-h-[44px] w-full resize-none border-0 bg-white px-3.5 py-2.5 text-sm !text-slate-900 outline-none placeholder:!text-slate-400"
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
                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-2.5 py-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          title={t('crm.aiAssistant.attachFileTitle')}
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-[#0f172a] hover:text-slate-900"
                        >
                          <PaperclipIcon className="h-3.5 w-3.5" />
                        </button>
                        {speechSupported && (
                          <button
                            type="button"
                            onClick={toggleVoice}
                            title={isListening ? 'Остановить запись' : 'Голосовой ввод'}
                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${isListening ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-600 hover:border-[#0f172a] hover:text-slate-900'}`}
                          >
                            <MicIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {composerAttachChip(true)}
                      </div>
                      <button
                        type="button"
                        disabled={!canSend}
                        onClick={() => void send()}
                        title={t('crm.aiAssistant.send')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0f172a] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        <SendArrowIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void topup('ai_prepaid')}
                      className="rounded-full border border-[#ddd8ff] bg-[#f1efff] px-3 py-1 text-[10.5px] font-medium text-[#5b4bec] transition hover:bg-[#e9e5ff]"
                    >
                      {t('crm.aiAssistant.topupAi')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void topup('storage_pack')}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10.5px] font-medium text-slate-700 transition hover:border-[#0f172a]"
                    >
                      {t('crm.aiAssistant.topupStorage')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHub(true)}
                      className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1 text-[10.5px] font-medium text-slate-700 transition hover:border-[#0f172a]"
                    >
                      {t('crm.aiAssistant.backToHub')}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </aside>
    </div>,
    document.body,
  );
};

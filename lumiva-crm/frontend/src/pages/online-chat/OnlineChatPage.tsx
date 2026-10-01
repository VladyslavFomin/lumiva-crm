// src/pages/online-chat/OnlineChatPage.tsx
// Редизайн 2026-10-01 по макету claude.ai/design online-chat.html
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import {
  ChatMessage,
  ChatSession,
  fetchChatMessages,
  fetchChatSessions,
  sendChatMessage,
  deleteChatSession,
  fetchChatAiStatus,
  setChatSessionAiPaused,
  setChatSessionStatus,
  type ChatAiStatus,
  type ChatMessagesPayload,
} from '../../api/onlineChat';
import { useAlertModal } from '../../contexts/AlertModalContext';
import './onlineChat.css';

const POLL_MS_OPEN = 2000;
const POLL_MS_BG = 5000;
const SESSIONS_POLL_MS = 10000;
const PANEL_KEY = 'lumiva_online_chat_panel';

type Filter = 'all' | 'ai' | 'op' | 'closed';

const px = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

const Ic: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const I = {
  srch: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" /></>,
  send: <><path d="M4 12l16-8-6 16-2.5-6.5z" /><path d="M11.5 13.5L20 4" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>,
  ref: <><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 5v6h-6" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M15 4v16" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  clip: <path d="M20 11l-8.5 8.5a5 5 0 01-7-7L13 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L14 7" />,
  check: <path d="M5 12l4 4 10-10" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></>,
};

const getFile = (m: any, fallback: string) => {
  const a0 = Array.isArray(m?.attachments) ? m.attachments[0] : null;
  const url = a0?.url || m?.file_url || m?.fileUrl || null;
  const name = a0?.name || m?.fileName || m?.file_name || null;
  return url ? { url: String(url), name: String(name || fallback) } : null;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const OnlineChatPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert, showConfirm } = useAlertModal();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [detail, setDetail] = useState<Omit<ChatMessagesPayload, 'messages'> | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [aiStatus, setAiStatus] = useState<ChatAiStatus | null>(null);
  const [aiToggleBusy, setAiToggleBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [panel, setPanel] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PANEL_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [searchParams] = useSearchParams();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const msgsRef = useRef<HTMLDivElement | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const selectedIdRef = useRef<string | null>(null);
  const lastPollAtRef = useRef<number>(0);
  const searchRef = useRef('');
  const lastMsgKeyRef = useRef('');

  const isVisible = () => (typeof document === 'undefined' ? true : document.visibilityState === 'visible');

  const aiOn = !!aiStatus?.active && aiStatus.mode !== 'off';
  const aiName = aiStatus?.employee?.name || t('crm.chat.assistant');

  const selectedSession = useMemo(() => sessions.find((s) => s.id === selectedId) ?? null, [sessions, selectedId]);

  const isAiLed = (s: ChatSession) => aiOn && s.status === 'open' && !s.aiPaused;

  const counts = useMemo(() => {
    const open = sessions.filter((s) => s.status === 'open');
    return {
      all: sessions.length,
      ai: open.filter(isAiLed).length,
      op: open.filter((s) => !isAiLed(s)).length,
      closed: sessions.length - open.length,
      open: open.length,
      waiting: open.filter((s) => s.unread).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, aiOn]);

  const list = useMemo(
    () =>
      sessions.filter((s) => {
        if (filter === 'all') return true;
        if (filter === 'closed') return s.status === 'closed';
        if (s.status !== 'open') return false;
        return filter === 'ai' ? isAiLed(s) : !isAiLed(s);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, filter, aiOn],
  );

  const fmtTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';

  const fmtListTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return sameDay(d, new Date()) ? fmtTime(iso) : d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  };

  const fmtDay = (d: Date) => {
    const now = new Date();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (sameDay(d, now)) return t('crm.chat.today');
    if (sameDay(d, y)) return t('crm.chat.yesterday');
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  };

  const visitorName = (s: { visitorName?: string | null; visitorEmail?: string | null } | null) =>
    s?.visitorName || s?.visitorEmail || t('crm.chat.visitorFallback');

  const loadSessions = async (silent = false) => {
    try {
      if (!silent) setLoadingSessions(true);
      const data = await fetchChatSessions({ search: searchRef.current || undefined });
      if (!aliveRef.current) return;
      setSessions(data);
      if (!selectedIdRef.current) {
        const wanted = searchParams.get('session');
        if (wanted && data.some((x) => x.id === wanted)) setSelectedId(wanted);
        else if (data.length && window.innerWidth > 820) {
          const firstOpen = data.find((x) => x.status === 'open') ?? data[0];
          setSelectedId(firstOpen.id);
        }
      }
    } catch (e) {
      if (!silent) console.error(e);
    } finally {
      if (!silent && aliveRef.current) setLoadingSessions(false);
    }
  };

  const applyMessagesPayload = (sessionId: string, data: ChatMessagesPayload) => {
    if (selectedIdRef.current !== sessionId) return;
    const { messages: msgs, ...rest } = data;
    setMessages(msgs);
    setDetail(rest);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              leadId: rest.leadId ?? s.leadId,
              status: rest.status ?? s.status,
              aiPaused: rest.aiPaused ?? s.aiPaused,
            }
          : s,
      ),
    );
  };

  const loadMessages = async (sessionId: string, silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      const data = await fetchChatMessages(sessionId);
      if (!aliveRef.current) return;
      applyMessagesPayload(sessionId, data);
    } catch (e) {
      if (!silent) console.error(e);
    } finally {
      if (!silent && aliveRef.current) setLoadingMessages(false);
    }
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    lastPollAtRef.current = Date.now();
    pollTimerRef.current = window.setInterval(() => {
      if (!aliveRef.current) return;
      const sid = selectedIdRef.current;
      if (!sid) return;
      const now = Date.now();
      if (now - lastPollAtRef.current < (isVisible() ? POLL_MS_OPEN : POLL_MS_BG)) return;
      lastPollAtRef.current = now;
      void loadMessages(sid, true);
    }, 1000);
  };

  useEffect(() => {
    aliveRef.current = true;
    fetchChatAiStatus()
      .then((st) => aliveRef.current && setAiStatus(st))
      .catch(() => undefined);
    const id = window.setInterval(() => {
      if (isVisible()) void loadSessions(true);
    }, SESSIONS_POLL_MS);
    return () => {
      aliveRef.current = false;
      stopPolling();
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    searchRef.current = search;
    const h = window.setTimeout(() => void loadSessions(), search ? 300 : 0);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    setDetail(null);
    setMessages([]);
    lastMsgKeyRef.current = '';
    if (selectedId) {
      void loadMessages(selectedId);
      startPolling();
    } else {
      stopPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const onVis = () => {
      if (!aliveRef.current || document.visibilityState !== 'visible') return;
      void loadSessions(true);
      if (selectedIdRef.current) {
        lastPollAtRef.current = Date.now();
        void loadMessages(selectedIdRef.current, true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // прокрутка вниз только когда пришло новое сообщение, а не на каждом опросе
  useEffect(() => {
    const last = messages[messages.length - 1];
    const key = `${messages.length}:${last?.id ?? ''}`;
    if (key === lastMsgKeyRef.current) return;
    lastMsgKeyRef.current = key;
    const box = msgsRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [text]);

  const togglePanel = () =>
    setPanel((v) => {
      try {
        localStorage.setItem(PANEL_KEY, v ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !v;
    });

  const focusComposer = (value: string) => {
    setText(value);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const toggleSessionAi = async () => {
    if (!selectedSession) return;
    const paused = !selectedSession.aiPaused;
    setAiToggleBusy(true);
    try {
      await setChatSessionAiPaused(selectedSession.id, paused);
      setSessions((prev) => prev.map((x) => (x.id === selectedSession.id ? { ...x, aiPaused: paused } : x)));
    } catch (e: any) {
      showAlert(e?.message || t('crm.chat.ai.toggleFailed'), { variant: 'error' });
    } finally {
      setAiToggleBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!selectedSession) return;
    const next = selectedSession.status === 'closed' ? 'open' : 'closed';
    setStatusBusy(true);
    try {
      await setChatSessionStatus(selectedSession.id, next);
      setSessions((prev) => prev.map((x) => (x.id === selectedSession.id ? { ...x, status: next } : x)));
      setDetail((d) => (d ? { ...d, status: next } : d));
    } catch (e: any) {
      showAlert(e?.message || t('crm.chat.errors.statusFailed'), { variant: 'error' });
    } finally {
      setStatusBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSession) return;
    const ok = await showConfirm(t('crm.chat.deleteText', { name: visitorName(selectedSession), id: selectedSession.id.slice(0, 8) }), {
      title: t('crm.chat.deleteTitle'),
      confirmLabel: t('crm.chat.deleteConfirm'),
      cancelLabel: t('crm.chat.cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteChatSession(selectedSession.id);
      setSessions((prev) => prev.filter((x) => x.id !== selectedSession.id));
      setSelectedId(null);
    } catch (e: any) {
      console.error(e);
      showAlert(e?.message || t('crm.chat.errors.deleteFailed'), { variant: 'error' });
    }
  };

  const handleSend = async () => {
    const body = text.trim();
    if (!selectedId || !body || sending) return;
    try {
      setSending(true);
      const msg = await sendChatMessage(selectedId, body);
      setMessages((prev) => [...prev, msg]);
      setText('');
      // бэкенд ставит паузу ИИ, как только оператор ответил сам
      setSessions((prev) =>
        prev.map((x) =>
          x.id === selectedId
            ? { ...x, aiPaused: true, unread: false, lastMessageAt: msg.createdAt, lastMessage: { text: body, sender: 'staff', createdAt: msg.createdAt, hasFile: false } }
            : x,
        ),
      );
      lastPollAtRef.current = Date.now();
    } catch (e: any) {
      showAlert(e?.message || t('crm.chat.errors.sendFailed'), { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const renderAiStrip = () => {
    if (!aiStatus) return null;
    const emp = aiStatus.employee;
    if (aiStatus.active && emp) {
      return (
        <div className="oc-ai">
          <span className={px('dot', aiStatus.mode === 'draft' && 'draft', aiStatus.mode === 'off' && 'off')} />
          <div className="t">
            <b>{t(`crm.chat.ai.mode.${aiStatus.mode}`, { name: emp.name })}</b>
            {!aiStatus.hasBrief ? (
              <span className="warn">{t('crm.chat.ai.noBrief')}</span>
            ) : (
              <span>{t(`crm.chat.ai.modeHint.${aiStatus.mode}`)}</span>
            )}
          </div>
          <Link className="oc-btn" to={`/ai-employees/${emp.id}`}>
            {t('crm.chat.ai.settings')}
          </Link>
        </div>
      );
    }
    return (
      <div className="oc-ai">
        <span className="dot off" />
        <div className="t">
          <b>{t('crm.chat.ai.offTitle')}</b>
          <span>{t('crm.chat.ai.notHired')}</span>
        </div>
        {emp ? (
          <Link className="oc-btn" to={`/ai-employees/${emp.id}`}>
            {t('crm.chat.ai.activate', { name: emp.name })}
          </Link>
        ) : aiStatus.canHire ? (
          <Link className="oc-btn pri" to="/ai-employees/new?role=chat_operator">
            <Ic d={I.spark} />
            {t('crm.chat.ai.hire')}
          </Link>
        ) : (
          <Link className="oc-btn" to="/ai-employees">
            {t('crm.chat.ai.noSeats')}
          </Link>
        )}
      </div>
    );
  };

  const renderItem = (s: ChatSession) => {
    const last = s.lastMessage;
    const name = visitorName(s);
    return (
      <button
        key={s.id}
        type="button"
        className={px('oc-it', s.id === selectedId && 'on', s.unread && s.status === 'open' && 'unread')}
        onClick={() => setSelectedId(s.id)}
      >
        <span className="oc-ava">{name.charAt(0).toUpperCase()}</span>
        <span className="nm">{name}</span>
        <span className="tm">{fmtListTime(last?.createdAt ?? s.lastMessageAt)}</span>
        <span className="pv">
          {last && last.sender !== 'visitor' ? <b>{last.sender === 'assistant' ? t('crm.chat.aiPrefix') : t('crm.chat.youPrefix')}</b> : null}
          {last ? (last.hasFile && !last.text ? `📎 ${t('crm.chat.file')}` : last.text) : t('crm.chat.noMessages')}
        </span>
        {s.unread && s.status === 'open' ? <span className="bd" title={t('crm.chat.waitingReply')} /> : <span />}
        <span className="mt">
          <span className="oc-tag" title={s.siteHost}>
            <Ic d={I.globe} size={10} />
            {s.siteHost}
          </span>
          {s.status === 'closed' ? (
            <span className="oc-tag cl">{t('crm.chat.statusClosed')}</span>
          ) : isAiLed(s) ? (
            <span className="oc-tag ai">
              <Ic d={I.spark} size={10} />
              {t('crm.chat.ai.badgeAi')}
            </span>
          ) : (
            <span className="oc-tag op">{t('crm.chat.ai.badgeHuman')}</span>
          )}
        </span>
      </button>
    );
  };

  const renderMessages = () => {
    const out: React.ReactNode[] = [];
    let prevKind: string | null = null;
    let prevDay: Date | null = null;
    const visible = messages as any[];
    visible.forEach((m, i) => {
      const at = new Date(m.createdAt);
      if (!prevDay || !sameDay(prevDay, at)) {
        out.push(
          <div key={`d-${m.id}`} className="oc-day">
            {fmtDay(at)}
          </div>,
        );
        prevKind = null;
      }
      prevDay = at;

      const isDraft = m.isInternal;
      const kind = m.sender === 'visitor' ? 'v' : isDraft ? 'draft' : m.sender === 'assistant' ? 'ai' : 'op';
      const grp = prevKind === kind;
      prevKind = kind;
      const next = visible[i + 1];
      const nextKind = next ? (next.sender === 'visitor' ? 'v' : next.isInternal ? 'draft' : next.sender === 'assistant' ? 'ai' : 'op') : null;
      const lastOfGroup = !next || nextKind !== kind || !sameDay(new Date(next.createdAt), at);
      const file = getFile(m, t('crm.chat.file'));

      const by =
        kind === 'v'
          ? visitorName(detail ?? selectedSession)
          : kind === 'ai'
            ? m.senderName || aiName
            : kind === 'draft'
              ? m.sender === 'assistant'
                ? t('crm.chat.ai.draftLabel', { name: m.senderName || aiName })
                : t('crm.chat.internalNote')
              : m.senderName || t('crm.chat.operator');

      out.push(
        <div key={m.id} className={px('oc-m', kind === 'v' ? 'in' : 'out', kind, grp && 'grp')}>
          {!grp ? (
            <span className="by">
              {(kind === 'ai' || (kind === 'draft' && m.sender === 'assistant')) && <Ic d={I.spark} size={10} />}
              {by}
            </span>
          ) : null}
          <div className="oc-b">
            {file ? (
              <a className="oc-file" href={file.url} target="_blank" rel="noreferrer" title={file.name}>
                <Ic d={I.clip} size={12} />
                {file.name}
              </a>
            ) : null}
            {m.text && (!file || m.text !== file.name) ? <div>{m.text}</div> : null}
          </div>
          {kind === 'draft' && m.sender === 'assistant' && selectedSession?.status === 'open' ? (
            <button type="button" className="oc-btn sm" onClick={() => focusComposer(m.text)}>
              {t('crm.chat.ai.useDraft')}
            </button>
          ) : null}
          {lastOfGroup ? <span className="ts">{fmtTime(m.createdAt)}</span> : null}
        </div>,
      );
    });
    return out;
  };

  const quick = [t('crm.chat.quick.greet'), t('crm.chat.quick.handoff'), t('crm.chat.quick.askContact')];
  const cur = selectedSession;
  const leadId = detail?.leadId ?? cur?.leadId ?? null;
  const utm = detail?.utm ?? (cur ? { source: cur.utmSource ?? null, medium: cur.utmMedium ?? null, campaign: cur.utmCampaign ?? null, content: null, term: null } : null);
  const hasUtm = !!utm && Object.values(utm).some(Boolean);
  const curAiLed = cur ? isAiLed(cur) : false;
  const draftMode = !!aiStatus?.active && aiStatus.mode === 'draft' && !cur?.aiPaused;

  return (
    <MainLayout>
      <PageHelpButton topic="onlineChat" />
      <div className="oc">
        <div className="oc-head">
          <div>
            <div className="kick">{t('crm.chat.kicker')}</div>
            <h1>{t('crm.chat.title')}</h1>
            <p>{t('crm.chat.subtitle')}</p>
          </div>
          <div className="oc-stats">
            <div>
              <span className="kick">{t('crm.chat.stats.open')}</span>
              <b>{counts.open}</b>
            </div>
            <div>
              <span className="kick">{t('crm.chat.stats.waiting')}</span>
              <b>{counts.waiting}</b>
            </div>
            <div>
              <span className="kick">{t('crm.chat.stats.ai')}</span>
              <b>{counts.ai}</b>
            </div>
          </div>
        </div>

        {renderAiStrip()}

        <div className={px('oc-box', (!panel || !cur) && 'nopanel', cur && 'has-sel')}>
          <div className="oc-list">
            <div className="oc-list-h">
              <label className="oc-search">
                <Ic d={I.srch} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('crm.chat.searchPlaceholder')} />
              </label>
              <div className="oc-seg" role="tablist">
                {(['all', 'ai', 'op', 'closed'] as Filter[]).map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={filter === k} className={px(filter === k && 'on')} onClick={() => setFilter(k)}>
                    {t(`crm.chat.filters.${k}`)}
                    <em>{counts[k]}</em>
                  </button>
                ))}
              </div>
            </div>
            <div className="oc-items">
              {loadingSessions && !sessions.length ? <div className="oc-empty">{t('crm.chat.loadingChats')}</div> : null}
              {!loadingSessions && !sessions.length ? <div className="oc-empty">{search ? t('crm.chat.noMatches') : t('crm.chat.empty')}</div> : null}
              {sessions.length > 0 && !list.length ? <div className="oc-empty">{t('crm.chat.noMatches')}</div> : null}
              {list.map(renderItem)}
            </div>
          </div>

          {cur ? (
            <div className="oc-conv">
              <div className="oc-conv-h">
                <div className="who">
                  <button type="button" className="oc-ib oc-back" title={t('crm.chat.back')} onClick={() => setSelectedId(null)}>
                    <Ic d={I.back} size={15} />
                  </button>
                  <span className="oc-ava">{visitorName(cur).charAt(0).toUpperCase()}</span>
                  <div style={{ minWidth: 0 }}>
                    <h2>{visitorName(detail ?? cur)}</h2>
                    <div className="sub">
                      <span className="mono">#{cur.id.slice(0, 8)}</span>
                      <span>·</span>
                      <span>{detail?.siteHost ?? cur.siteHost}</span>
                      {cur.status === 'closed' ? (
                        <>
                          <span>·</span>
                          <span>{t('crm.chat.statusClosed')}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="acts">
                  {aiStatus?.active ? (
                    <button
                      type="button"
                      className="oc-btn"
                      disabled={aiToggleBusy || cur.status === 'closed'}
                      onClick={() => void toggleSessionAi()}
                      title={cur.aiPaused ? t('crm.chat.ai.resumeHint') : t('crm.chat.ai.pauseHint')}
                    >
                      <Ic d={cur.aiPaused ? I.spark : I.user} />
                      {cur.aiPaused ? t('crm.chat.ai.giveBack') : t('crm.chat.ai.takeOver')}
                    </button>
                  ) : null}
                  {leadId ? (
                    <Link className="oc-btn pri" to={`/leads/${leadId}`}>
                      {t('crm.chat.openLead')}
                      <Ic d={I.arrow} />
                    </Link>
                  ) : null}
                  <button type="button" className="oc-ib" title={t('crm.chat.refresh')} onClick={() => void loadMessages(cur.id)}>
                    <Ic d={I.ref} size={15} />
                  </button>
                  <button type="button" className={px('oc-ib', panel && 'on')} title={t('crm.chat.panelToggle')} onClick={togglePanel}>
                    <Ic d={I.panel} size={15} />
                  </button>
                  <button type="button" className="oc-ib dng" title={t('crm.chat.delete')} onClick={() => void handleDelete()}>
                    <Ic d={I.trash} size={15} />
                  </button>
                </div>
              </div>

              <div className="oc-msgs" ref={msgsRef}>
                {loadingMessages && !messages.length ? <div className="oc-empty">{t('crm.chat.loadingMessages')}</div> : null}
                {!loadingMessages && !messages.length ? <div className="oc-empty">{t('crm.chat.noMessages')}</div> : null}
                {renderMessages()}
              </div>

              {cur.status === 'closed' ? (
                <div className="oc-closed">
                  {t('crm.chat.closedBar')}
                  <button type="button" className="oc-btn" disabled={statusBusy} onClick={() => void toggleStatus()}>
                    {t('crm.chat.reopen')}
                  </button>
                </div>
              ) : (
                <div className="oc-comp">
                  <div className="note">
                    {curAiLed ? (
                      <>
                        <Ic d={I.spark} size={12} />
                        <span>
                          {t('crm.chat.note.aiPrefix')} <b>{aiName}</b>. {t('crm.chat.note.aiSuffix')}
                        </span>
                      </>
                    ) : draftMode ? (
                      <>
                        <Ic d={I.spark} size={12} />
                        <span>{t('crm.chat.note.draft', { name: aiName })}</span>
                      </>
                    ) : (
                      <>
                        <Ic d={I.user} size={12} />
                        <span>{t('crm.chat.note.human')}</span>
                      </>
                    )}
                  </div>
                  <div className="oc-quick">
                    {quick.map((q) => (
                      <button key={q} type="button" onClick={() => focusComposer(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="oc-inp">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder={t('crm.chat.replyPlaceholder')}
                    />
                    <span className="kb">{t('crm.chat.enterHint')}</span>
                    <button type="button" className="oc-btn pri" disabled={sending || !text.trim()} onClick={() => void handleSend()}>
                      <Ic d={I.send} />
                      {t('crm.chat.send')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="oc-conv">
              <div className="oc-empty" style={{ margin: 'auto' }}>
                {t('crm.chat.selectPrompt')}
              </div>
            </div>
          )}

          {panel && cur ? (
            <aside className="oc-info">
              <div className="oc-sec">
                <h4>{t('crm.chat.info.visitor')}</h4>
                <dl className="oc-kv">
                  <dt>{t('crm.chat.info.name')}</dt>
                  <dd title={detail?.visitorName ?? cur.visitorName ?? ''}>{detail?.visitorName ?? cur.visitorName ?? '—'}</dd>
                  <dt>{t('crm.chat.info.email')}</dt>
                  <dd title={detail?.visitorEmail ?? cur.visitorEmail ?? ''}>{detail?.visitorEmail ?? cur.visitorEmail ?? '—'}</dd>
                  <dt>{t('crm.chat.info.started')}</dt>
                  <dd>{new Date(detail?.createdAt ?? cur.createdAt).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</dd>
                  <dt>{t('crm.chat.info.messages')}</dt>
                  <dd>{messages.filter((m) => !m.isInternal).length}</dd>
                  <dt>{t('crm.chat.info.status')}</dt>
                  <dd>{cur.status === 'closed' ? t('crm.chat.statusClosed') : t('crm.chat.statusOpen')}</dd>
                </dl>
              </div>
              <div className="oc-sec">
                <h4>{t('crm.chat.info.source')}</h4>
                <dl className="oc-kv">
                  <dt>{t('crm.chat.info.site')}</dt>
                  <dd className="mono" title={detail?.siteHost ?? cur.siteHost}>{detail?.siteHost ?? cur.siteHost}</dd>
                  {hasUtm && utm ? (
                    <>
                      {utm.source || utm.medium ? (
                        <>
                          <dt>{t('crm.chat.info.channel')}</dt>
                          <dd className="mono">{[utm.source, utm.medium].filter(Boolean).join(' / ')}</dd>
                        </>
                      ) : null}
                      {utm.campaign ? (
                        <>
                          <dt>{t('crm.chat.info.campaign')}</dt>
                          <dd className="mono" title={utm.campaign}>{utm.campaign}</dd>
                        </>
                      ) : null}
                      {utm.content ? (
                        <>
                          <dt>{t('crm.chat.info.content')}</dt>
                          <dd className="mono" title={utm.content}>{utm.content}</dd>
                        </>
                      ) : null}
                      {utm.term ? (
                        <>
                          <dt>{t('crm.chat.info.term')}</dt>
                          <dd className="mono" title={utm.term}>{utm.term}</dd>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <dt>{t('crm.chat.info.channel')}</dt>
                      <dd>{t('crm.chat.info.noUtm')}</dd>
                    </>
                  )}
                </dl>
              </div>
              <div className="oc-sec">
                <h4>{t('crm.chat.info.lead')}</h4>
                {leadId ? (
                  <Link className="oc-btn" to={`/leads/${leadId}`}>
                    {t('crm.chat.openLead')}
                    <Ic d={I.arrow} />
                  </Link>
                ) : (
                  <p>{t('crm.chat.noLeadYet')}</p>
                )}
              </div>
              <div className="oc-sec">
                <button type="button" className="oc-btn" disabled={statusBusy} onClick={() => void toggleStatus()}>
                  <Ic d={I.check} />
                  {cur.status === 'closed' ? t('crm.chat.reopenDialog') : t('crm.chat.closeDialog')}
                </button>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </MainLayout>
  );
};

export default OnlineChatPage;

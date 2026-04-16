// src/pages/online-chat/OnlineChatPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  ChatMessage,
  ChatSession,
  fetchChatMessages,
  fetchChatSessions,
  sendChatMessage,
  deleteChatSession,
  type ChatMessagesPayload,
} from '../../api/onlineChat';

const ACCENT = '#222222';

const POLL_MS_OPEN = 2000;
const POLL_MS_BG = 5000;

const OnlineChatPage: React.FC = () => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionPanel, setSessionPanel] = useState<{
    leadId: string | null;
    siteHost: string;
  } | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');

  const pollTimerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const selectedIdRef = useRef<string | null>(null);
  const lastPollAtRef = useRef<number>(0);

  const isVisible = () =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible';

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? null,
    [sessions, selectedId],
  );

  const displaySiteHost =
    sessionPanel?.siteHost ?? selectedSession?.siteHost ?? null;

  const displayLeadId =
    sessionPanel?.leadId ?? selectedSession?.leadId ?? null;

  const getFile = (m: any) => {
    const a0 = Array.isArray(m?.attachments) ? m.attachments[0] : null;

    const url =
      a0?.url ||
      m?.file_url ||
      m?.fileUrl ||
      m?.file ||
      m?.url ||
      null;

    const name =
      a0?.name ||
      m?.fileName ||
      m?.file_name ||
      m?.filename ||
      null;

    return url
      ? { url: String(url), name: String(name || t('crm.chat.file')) }
      : null;
  };

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const data = await fetchChatSessions({
        status: 'open',
        search: search || undefined,
      });

      if (!aliveRef.current) return;

      setSessions(data);
      if (!selectedIdRef.current && data.length) {
        setSelectedId(data[0].id);
      }
    } finally {
      if (aliveRef.current) setLoadingSessions(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const ok = window.confirm(t('crm.chat.confirmDelete'));
    if (!ok) return;
    try {
      await deleteChatSession(selectedId);
      setSelectedId(null);
      setMessages([]);
      setSessionPanel(null);
      await loadSessions();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || t('crm.chat.errors.deleteFailed'));
    }
  };

  const applyMessagesPayload = (sessionId: string, data: ChatMessagesPayload | ChatMessage[]) => {
    if (Array.isArray(data)) {
      setMessages(data);
      setSessionPanel(null);
      return;
    }
    setMessages(data.messages);
    setSessionPanel({
      leadId: data.leadId,
      siteHost: data.siteHost,
    });
    if (data.leadId) {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, leadId: data.leadId } : s)),
      );
    }
  };

  const loadMessages = async (sessionId: string, silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);

      const data = await fetchChatMessages(sessionId);
      if (!aliveRef.current) return;

      applyMessagesPayload(sessionId, data as ChatMessagesPayload | ChatMessage[]);
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

  const startPolling = (sessionId: string) => {
    stopPolling();

    pollTimerRef.current = window.setInterval(() => {
      if (!aliveRef.current) return;

      const sid = selectedIdRef.current;
      if (!sid) return;

      const now = Date.now();
      const interval = isVisible() ? POLL_MS_OPEN : POLL_MS_BG;

      if (now - lastPollAtRef.current < interval) return;
      lastPollAtRef.current = now;

      loadMessages(sid, true);
    }, 1000);

    lastPollAtRef.current = 0;
    loadMessages(sessionId, true);
  };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopPolling();
    };
  }, []);

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    setSessionPanel(null);

    if (selectedId) {
      loadMessages(selectedId);
      startPolling(selectedId);
    } else {
      setMessages([]);
      stopPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, t]);

  useEffect(() => {
    const onVis = () => {
      if (!aliveRef.current) return;
      if (document.visibilityState === 'visible' && selectedIdRef.current) {
        lastPollAtRef.current = 0;
        loadMessages(selectedIdRef.current, true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !text.trim()) return;

    try {
      setSending(true);

      const msg = await sendChatMessage(selectedId, text.trim());
      setMessages((prev) => [...prev, msg]);
      setText('');

      lastPollAtRef.current = 0;
      await loadMessages(selectedId, true);
    } finally {
      setSending(false);
    }
  };

  const headerLabel = useMemo(() => {
    if (!selectedId) return '';
    return t('crm.chat.dialogTitle', { id: selectedId.slice(0, 8) });
  }, [selectedId, t]);

  const accentButton =
    'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition hover:opacity-90 disabled:opacity-40';

  return (
    <MainLayout>
      <div className="mb-4">
        <h1
          className="text-lg font-semibold tracking-tight"
          style={{ color: ACCENT }}
        >
          {t('crm.chat.title')}
        </h1>
        <p className="mt-1 text-xs text-neutral-500 max-w-xl leading-relaxed">
          {t('crm.chat.subtitle')}
        </p>
      </div>

      <div
        className="flex h-[calc(100vh-220px)] min-h-[480px] overflow-hidden rounded-2xl border bg-white shadow-sm"
        style={{ borderColor: `${ACCENT}18` }}
      >
        {/* Список */}
        <div
          className="flex w-[320px] flex-col border-r bg-white"
          style={{ borderColor: `${ACCENT}14` }}
        >
          <div
            className="border-b px-4 py-3"
            style={{ borderColor: `${ACCENT}12`, background: `${ACCENT}06` }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: ACCENT }}
            >
              {t('crm.chat.listHeading')}
            </div>
            <div className="mt-2">
              <input
                className="w-full rounded-full border bg-white px-3 py-1.5 text-xs text-neutral-800 outline-none transition focus:ring-1"
                style={
                  {
                    borderColor: `${ACCENT}22`,
                    ['--tw-ring-color' as string]: `${ACCENT}55`,
                  } as React.CSSProperties
                }
                placeholder={t('crm.chat.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingSessions && (
              <div className="p-4 text-xs text-neutral-500">{t('crm.chat.loadingChats')}</div>
            )}

            {!loadingSessions && sessions.length === 0 && (
              <div className="p-4 text-xs text-neutral-500">{t('crm.chat.empty')}</div>
            )}

            {sessions.map((s) => {
              const isActive = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={
                    'w-full border-b px-4 py-3 text-left text-xs transition ' +
                    (isActive
                      ? 'bg-neutral-50'
                      : 'border-neutral-100 hover:bg-neutral-50/80')
                  }
                  style={
                    isActive
                      ? {
                          borderLeftWidth: 3,
                          borderLeftColor: ACCENT,
                          borderBottomColor: `${ACCENT}10`,
                        }
                      : {
                          borderLeftWidth: 3,
                          borderLeftColor: 'transparent',
                          borderBottomColor: `${ACCENT}08`,
                        }
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-neutral-900">
                        {s.visitorName || s.visitorEmail || t('crm.chat.visitorFallback')}
                      </div>
                      <div
                        className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium text-neutral-800"
                        style={{
                          borderColor: `${ACCENT}22`,
                          background: `${ACCENT}08`,
                        }}
                        title={s.siteHost}
                      >
                        <span className="shrink-0 text-neutral-500">{t('crm.chat.siteLabel')}</span>
                        <span className="truncate font-mono">{s.siteHost}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-500">
                    {s.status === 'open' ? t('crm.chat.statusOpen') : t('crm.chat.statusClosed')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Переписка */}
        <div className="flex flex-1 flex-col bg-neutral-50">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-500">
              {t('crm.chat.selectPrompt')}
            </div>
          ) : (
            <>
              <div
                className="flex flex-col gap-3 border-b bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: `${ACCENT}14` }}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="text-xs font-medium text-neutral-900">{headerLabel}</div>
                  {displaySiteHost ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        {t('crm.chat.siteLabel')}
                      </span>
                      <span
                        className="inline-flex max-w-full items-center rounded-md border px-2.5 py-1 font-mono text-[11px] font-medium text-neutral-900"
                        style={{
                          borderColor: `${ACCENT}28`,
                          background: `${ACCENT}0A`,
                        }}
                      >
                        {displaySiteHost}
                      </span>
                    </div>
                  ) : null}
                  {!displayLeadId ? (
                    <p className="text-[11px] text-neutral-500">{t('crm.chat.noLeadYet')}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {displayLeadId ? (
                    <Link
                      to={`/leads/${displayLeadId}`}
                      className={`${accentButton} shrink-0`}
                      style={{ backgroundColor: ACCENT }}
                    >
                      {t('crm.chat.openLead')}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => selectedId && loadMessages(selectedId)}
                    className="text-[11px] text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
                  >
                    {t('crm.chat.refresh')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="text-[11px] text-rose-600 hover:text-rose-700"
                  >
                    {t('crm.chat.delete')}
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {loadingMessages && (
                  <div className="text-xs text-neutral-500">{t('crm.chat.loadingMessages')}</div>
                )}

                {!loadingMessages &&
                  messages.map((m: any) => {
                    const isMe = m.sender === 'staff';
                    const isBot = m.sender === 'assistant';
                    const file = getFile(m);

                    return (
                      <div
                        key={m.id}
                        className={'flex ' + (isMe ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={
                            'max-w-[70%] rounded-2xl px-3 py-2 text-xs shadow-sm ' +
                            (isMe
                              ? 'text-white'
                              : isBot
                                ? 'border border-neutral-200 bg-white text-neutral-900'
                                : 'border border-neutral-200 bg-white text-neutral-900')
                          }
                          style={isMe ? { backgroundColor: ACCENT } : undefined}
                        >
                          {!isMe && (
                            <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                              {isBot ? t('crm.chat.assistant') : t('crm.chat.visitor')}
                            </div>
                          )}

                          <div className="break-words whitespace-pre-wrap">
                            {file ? (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className={
                                  'block max-w-full truncate underline underline-offset-2 ' +
                                  (isMe ? 'text-white/95' : 'text-neutral-700')
                                }
                                title={file.name}
                              >
                                📎 {file.name}
                              </a>
                            ) : null}

                            {m.text ? <div className={file ? 'mt-2' : ''}>{m.text}</div> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <form
                onSubmit={handleSend}
                className="flex items-end gap-3 border-t bg-white px-4 py-3"
                style={{ borderColor: `${ACCENT}14` }}
              >
                <textarea
                  className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border bg-white px-3 py-2 text-xs text-neutral-800 outline-none transition focus:ring-1"
                  style={
                    {
                      borderColor: `${ACCENT}22`,
                      ['--tw-ring-color' as string]: `${ACCENT}44`,
                    } as React.CSSProperties
                  }
                  placeholder={t('crm.chat.replyPlaceholder')}
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className={accentButton}
                  style={{ backgroundColor: ACCENT }}
                >
                  {t('crm.chat.send')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default OnlineChatPage;

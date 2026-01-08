// src/pages/online-chat/OnlineChatPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  ChatMessage,
  ChatSession,
  fetchChatMessages,
  fetchChatSessions,
  sendChatMessage,
  deleteChatSession,
} from '../../api/onlineChat';

const POLL_MS_OPEN = 2000;
const POLL_MS_BG = 5000;

const OnlineChatPage: React.FC = () => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
      // обновляем список
      await loadSessions();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || t('crm.chat.errors.deleteFailed'));
    }
  };

  const loadMessages = async (sessionId: string, silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);

      const data = await fetchChatMessages(sessionId);
      if (!aliveRef.current) return;

      setMessages(data);
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

    // тик раз в 1 секунду, но реальные запросы делаем по интервалу (OPEN/BG)
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

    // сразу один запрос при старте
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

    if (selectedId) {
      loadMessages(selectedId);
      startPolling(selectedId);
    } else {
      setMessages([]);
      stopPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, t]);

  // при возврате фокуса/видимости — быстро подтянуть
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

      // сразу подтянем с сервера (на случай автоответов/вложений/нормализации)
      lastPollAtRef.current = 0;
      await loadMessages(selectedId, true);
    } finally {
      setSending(false);
    }
  };

  const headerLabel = useMemo(() => {
    if (!selectedId) return '';
    return t('crm.chat.dialogTitle', { id: selectedId.slice(0, 8) });
  }, [selectedId]);

  return (
    <MainLayout>
      {/* заголовок страницы */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">{t('crm.chat.title')}</h1>
        <p className="mt-1 text-xs text-slate-500 max-w-xl">
          {t('crm.chat.subtitle')}
        </p>
      </div>

      {/* основная панель чата */}
      <div className="flex h-[calc(100vh-220px)] min-h-[480px] rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* ЛЕВАЯ КОЛОНКА — список диалогов */}
        <div className="w-[320px] border-r border-slate-200 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Online chat
            </div>
            <div className="mt-2">
              <input
                className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-400"
                placeholder={t('crm.chat.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingSessions && (
              <div className="p-4 text-xs text-slate-500">{t('crm.chat.loadingChats')}</div>
            )}

            {!loadingSessions && sessions.length === 0 && (
              <div className="p-4 text-xs text-slate-500">{t('crm.chat.empty')}</div>
            )}

            {sessions.map((s) => {
              const isActive = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={
                    'w-full text-left px-4 py-3 border-b border-slate-100 text-xs transition-colors ' +
                    (isActive ? 'bg-sky-50 text-slate-900' : 'hover:bg-slate-50')
                  }
                >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate">
                      {s.visitorName || s.visitorEmail || t('crm.chat.visitorFallback')}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{s.siteHost}</div>
                    </div>
                  <div
                    className={
                      'mt-1 text-[11px] truncate ' +
                      (isActive ? 'text-slate-600' : 'text-slate-500')
                    }
                    >
                    {s.status === 'open' ? t('crm.chat.statusOpen') : t('crm.chat.statusClosed')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА — переписка */}
        <div className="flex-1 flex flex-col bg-slate-50">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              {t('crm.chat.selectPrompt')}
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="text-xs font-medium text-slate-900">{headerLabel}</div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => selectedId && loadMessages(selectedId)}
                    className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-900"
                  >
                    {t('crm.chat.refresh')}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="text-[11px] text-rose-600 hover:text-rose-700"
                  >
                    {t('crm.chat.delete')}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50">
                {loadingMessages && (
                  <div className="text-xs text-slate-500">{t('crm.chat.loadingMessages')}</div>
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
                              ? 'bg-sky-500 text-white'
                              : isBot
                              ? 'bg-slate-100 text-slate-900 border border-slate-200'
                              : 'bg-white text-slate-900 border border-slate-200')
                          }
                        >
                          {!isMe && (
                            <div className="mb-1 text-[10px] text-slate-500 uppercase tracking-[0.16em]">
                              {isBot ? t('crm.chat.assistant') : t('crm.chat.visitor')}
                            </div>
                          )}

                          <div className="whitespace-pre-wrap break-words">
                            {file ? (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className={
                                  'block max-w-full truncate underline underline-offset-2 ' +
                                  (isMe ? 'text-white' : 'text-sky-600')
                                }
                                title={file.name}
                              >
                                📎 {file.name}
                              </a>
                            ) : null}

                            {m.text ? (
                              <div className={file ? 'mt-2' : ''}>{m.text}</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <form
                onSubmit={handleSend}
                className="border-t border-slate-200 px-4 py-3 flex items-end gap-3 bg-white"
              >
                <textarea
                  className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-400 max-h-32 min-h-[40px]"
                  placeholder={t('crm.chat.replyPlaceholder')}
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="rounded-full !bg-slate-900 !text-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] disabled:opacity-40 shadow-sm hover:!bg-slate-800 hover:shadow"
                  style={{ backgroundColor: '#0f172a', color: '#fff' }}
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

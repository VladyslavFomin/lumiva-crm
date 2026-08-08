// src/pages/whatsapp-crm/WhatsappInboxPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchWhatsappContacts,
  fetchWhatsappMessages,
  fetchWhatsappConnections,
  sendWhatsappMessage,
  markWhatsappContactRead,
  type WhatsappContactWithPreview,
  type WhatsappMessage,
  type WhatsappConnection,
} from '../../api/whatsapp-crm';
import { useAlertModal } from '../../contexts/AlertModalContext';

const ACCENT = '#25D366'; // WhatsApp green

const POLL_MS_OPEN = 5000; // no live push here (no polling loop like Telegram) — inbound only arrives via webhook
const POLL_MS_BG = 12000;

const contactDisplayName = (c: WhatsappContactWithPreview, fallback: string): string => {
  if (c.waProfileName) return c.waProfileName;
  return c.waPhoneDigits ? `+${c.waPhoneDigits}` : fallback;
};

const messagePreview = (m: WhatsappMessage | null, t: (k: string) => string): string => {
  if (!m) return '';
  if (m.messageType && m.messageType !== 'text') {
    const labelKey: Record<string, string> = {
      image: 'crm.whatsapp.inbox.attachmentPhoto',
      document: 'crm.whatsapp.inbox.attachmentDocument',
      audio: 'crm.whatsapp.inbox.attachmentVoice',
      video: 'crm.whatsapp.inbox.attachmentVideo',
      sticker: 'crm.whatsapp.inbox.attachmentSticker',
      location: 'crm.whatsapp.inbox.attachmentLocation',
    };
    return t(labelKey[m.messageType] || 'crm.whatsapp.inbox.attachmentOther');
  }
  return m.text || '';
};

const WhatsappInboxPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [contacts, setContacts] = useState<WhatsappContactWithPreview[]>([]);
  const [connections, setConnections] = useState<WhatsappConnection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
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

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedId) ?? null,
    [contacts, selectedId],
  );

  const sendConnectionId = selectedContact?.connectionId || connections[0]?.id || null;

  const loadContacts = async (silent = false) => {
    try {
      if (!silent) setLoadingContacts(true);
      const data = await fetchWhatsappContacts({ search: search || undefined });
      if (!aliveRef.current) return;
      setContacts(data);
    } finally {
      if (!silent && aliveRef.current) setLoadingContacts(false);
    }
  };

  const loadMessages = async (contactId: string, silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      const data = await fetchWhatsappMessages({ contactId, limit: 200 });
      if (!aliveRef.current) return;
      setMessages([...data.items].reverse());
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

  const startPolling = (contactId: string) => {
    stopPolling();
    pollTimerRef.current = window.setInterval(() => {
      if (!aliveRef.current) return;
      const cid = selectedIdRef.current;
      if (!cid) return;
      const now = Date.now();
      const interval = isVisible() ? POLL_MS_OPEN : POLL_MS_BG;
      if (now - lastPollAtRef.current < interval) return;
      lastPollAtRef.current = now;
      loadMessages(cid, true);
      loadContacts(true);
    }, 1000);
    lastPollAtRef.current = 0;
    loadMessages(contactId, true);
  };

  useEffect(() => {
    aliveRef.current = true;
    fetchWhatsappConnections().then((c) => aliveRef.current && setConnections(c)).catch(() => undefined);
    return () => {
      aliveRef.current = false;
      stopPolling();
    };
  }, []);

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (aliveRef.current && isVisible()) loadContacts(true);
    }, POLL_MS_BG);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (selectedId) {
      loadMessages(selectedId);
      startPolling(selectedId);
      markWhatsappContactRead(selectedId)
        .then(() => loadContacts(true))
        .catch(() => undefined);
    } else {
      setMessages([]);
      stopPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !text.trim() || !sendConnectionId) return;
    try {
      setSending(true);
      const msg = await sendWhatsappMessage({
        connectionId: sendConnectionId,
        contactId: selectedContact.id,
        text: text.trim(),
      });
      setMessages((prev) => [...prev, msg]);
      setText('');
      lastPollAtRef.current = 0;
      loadContacts(true);
    } catch (err: any) {
      showAlert(err?.message || t('crm.whatsapp.inbox.errors.sendFailed'), { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const accentButton =
    'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition hover:opacity-90 disabled:opacity-40';

  return (
    <MainLayout>
      <div className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: ACCENT }}>
          {t('crm.whatsapp.inbox.title')}
        </h1>
        <p className="mt-1 text-xs text-neutral-500 max-w-xl leading-relaxed">
          {t('crm.whatsapp.inbox.subtitle')}
        </p>
      </div>

      {connections.length === 0 && !loadingContacts ? (
        <div
          className="mb-4 rounded-2xl border px-4 py-3 text-xs text-neutral-700"
          style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}08` }}
        >
          {t('crm.whatsapp.inbox.noConnections')}{' '}
          <Link to="/integrations-hub" className="underline underline-offset-2" style={{ color: ACCENT }}>
            {t('crm.whatsapp.inbox.noConnectionsLink')}
          </Link>
        </div>
      ) : null}

      <div
        className="flex h-[calc(100vh-220px)] min-h-[480px] overflow-hidden rounded-2xl border bg-white shadow-sm"
        style={{ borderColor: `${ACCENT}18` }}
      >
        {/* Список диалогов */}
        <div className="flex w-[320px] flex-col border-r bg-white" style={{ borderColor: `${ACCENT}14` }}>
          <div className="border-b px-4 py-3" style={{ borderColor: `${ACCENT}12`, background: `${ACCENT}06` }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
              {t('crm.whatsapp.inbox.listHeading')}
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
                placeholder={t('crm.whatsapp.inbox.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingContacts && (
              <div className="p-4 text-xs text-neutral-500">{t('crm.whatsapp.inbox.loadingContacts')}</div>
            )}
            {!loadingContacts && contacts.length === 0 && (
              <div className="p-4 text-xs text-neutral-500">{t('crm.whatsapp.inbox.empty')}</div>
            )}

            {contacts.map((c) => {
              const isActive = c.id === selectedId;
              const name = contactDisplayName(c, t('crm.whatsapp.inbox.contactFallback'));
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={
                    'w-full border-b px-4 py-3 text-left text-xs transition ' +
                    (isActive ? 'bg-neutral-50' : 'border-neutral-100 hover:bg-neutral-50/80')
                  }
                  style={
                    isActive
                      ? { borderLeftWidth: 3, borderLeftColor: ACCENT, borderBottomColor: `${ACCENT}10` }
                      : { borderLeftWidth: 3, borderLeftColor: 'transparent', borderBottomColor: `${ACCENT}08` }
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-neutral-900">{name}</div>
                      <div className="mt-1 truncate text-[11px] text-neutral-500">
                        {c.lastMessage?.direction === 'outgoing' ? `${t('crm.whatsapp.inbox.you')}: ` : ''}
                        {messagePreview(c.lastMessage, t)}
                      </div>
                    </div>
                    {c.unreadCount > 0 ? (
                      <span
                        className="ml-auto shrink-0 min-h-5 min-w-5 rounded-full px-1.5 text-[10px] font-semibold text-white flex items-center justify-center"
                        style={{ backgroundColor: ACCENT }}
                      >
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Переписка */}
        <div className="flex flex-1 flex-col bg-neutral-50">
          {!selectedId || !selectedContact ? (
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-500">
              {t('crm.whatsapp.inbox.selectPrompt')}
            </div>
          ) : (
            <>
              <div
                className="flex flex-col gap-2 border-b bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: `${ACCENT}14` }}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-xs font-medium text-neutral-900">
                    {contactDisplayName(selectedContact, t('crm.whatsapp.inbox.contactFallback'))}
                  </div>
                  {selectedContact.waProfileName ? (
                    <div className="text-[11px] text-neutral-500">+{selectedContact.waPhoneDigits}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {selectedContact.leadId ? (
                    <Link
                      to={`/leads/${selectedContact.leadId}`}
                      className={`${accentButton} shrink-0`}
                      style={{ backgroundColor: ACCENT }}
                    >
                      {t('crm.whatsapp.inbox.openLead')}
                    </Link>
                  ) : (
                    <p className="text-[11px] text-neutral-500">{t('crm.whatsapp.inbox.noLeadYet')}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => loadMessages(selectedId)}
                    className="text-[11px] text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
                  >
                    {t('crm.whatsapp.inbox.refresh')}
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {loadingMessages && (
                  <div className="text-xs text-neutral-500">{t('crm.whatsapp.inbox.loadingMessages')}</div>
                )}

                {!loadingMessages &&
                  messages.map((m) => {
                    const isOutgoing = m.direction === 'outgoing';
                    const preview = messagePreview(m, t);
                    return (
                      <div key={m.id} className={'flex ' + (isOutgoing ? 'justify-end' : 'justify-start')}>
                        <div
                          className={
                            'max-w-[70%] rounded-2xl px-3 py-2 text-xs shadow-sm ' +
                            (isOutgoing ? 'text-white' : 'border border-neutral-200 bg-white text-neutral-900')
                          }
                          style={isOutgoing ? { backgroundColor: ACCENT } : undefined}
                        >
                          <div className="break-words whitespace-pre-wrap">{preview}</div>
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
                  placeholder={t('crm.whatsapp.inbox.replyPlaceholder')}
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim() || !sendConnectionId}
                  className={accentButton}
                  style={{ backgroundColor: ACCENT }}
                >
                  {t('crm.whatsapp.inbox.send')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default WhatsappInboxPage;

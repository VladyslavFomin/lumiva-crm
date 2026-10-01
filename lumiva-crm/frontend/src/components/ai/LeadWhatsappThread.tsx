import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CollapsibleCard } from '../../pages/leads/LeadFormPage';
import {
  fetchWhatsappContacts,
  fetchWhatsappMessages,
  sendWhatsappMessage,
  type WhatsappContactWithPreview,
  type WhatsappMessage,
} from '../../api/whatsapp-crm';

/**
 * Переписка WhatsApp этого лида (whatsapp_contact.leadId) — рядом с Telegram и email. Входящие приходят
 * через вебхук Meta (контакт привязывается к лиду по номеру телефона), ответ уходит через Cloud API.
 */
export function LeadWhatsappThread({ leadId, isNew, locale }: { leadId: string; isNew: boolean; locale?: string }) {
  const { t } = useTranslation();
  const [contact, setContact] = useState<WhatsappContactWithPreview | null | undefined>(undefined); // undefined = ещё грузится
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const contacts = await fetchWhatsappContacts({ leadId });
      const c = contacts[0] ?? null;
      setContact(c);
      if (c) {
        const res = await fetchWhatsappMessages({ contactId: c.id, limit: 100 });
        setMessages([...res.items].reverse());
      } else {
        setMessages([]);
      }
    } catch {
      setContact(null);
    }
  }, [isNew, leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const send = async () => {
    if (!contact || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      if (!contact.connectionId) throw new Error(t('crm.leads.form.sections.whatsappNoConnection'));
      const sent = await sendWhatsappMessage({ connectionId: contact.connectionId, contactId: contact.id, text: draft.trim() });
      setMessages((prev) => [...prev, sent]);
      setDraft('');
    } catch (e: any) {
      setError(e?.message || t('crm.aiEmployees.errors.generic'));
    } finally {
      setSending(false);
    }
  };

  const contactName = contact && (contact.waProfileName || `+${contact.waPhoneDigits}`);

  return (
    <CollapsibleCard
      title={t('crm.leads.form.sections.whatsappTitle')}
      right={contact && messages.length > 0 ? <span style={{ fontSize: 10, color: '#b5b5b5' }}>{t('crm.leads.form.sections.whatsappCount', { count: messages.length })}</span> : undefined}
    >
      {isNew ? (
        <div style={{ fontSize: 12, color: '#b5b5b5', fontStyle: 'italic' }}>{t('crm.leads.form.sections.projectsNeedSave')}</div>
      ) : contact === undefined ? (
        <div style={{ fontSize: 11, color: '#b5b5b5' }}>{t('crm.leads.form.sections.historyLoading')}</div>
      ) : contact === null ? (
        <div style={{ fontSize: 12, color: '#b5b5b5', fontStyle: 'italic' }}>{t('crm.leads.form.sections.whatsappEmpty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#888' }}>{t('crm.leads.form.sections.whatsappWith', { name: contactName })}</div>
          <div ref={scrollRef} style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
            {messages.length === 0 ? (
              <div style={{ fontSize: 12, color: '#b5b5b5', fontStyle: 'italic' }}>{t('crm.leads.form.sections.whatsappNoMessages')}</div>
            ) : (
              messages.map((m) => {
                const isOut = m.direction === 'outgoing';
                const isAi = false;
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOut ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        maxWidth: '78%',
                        border: `1px solid ${isOut ? '#dbeafe' : '#e7e7e7'}`,
                        background: isAi ? 'linear-gradient(135deg,#f3eeff,#eaf2ff)' : isOut ? '#eff6ff' : '#fafafa',
                        borderRadius: 10,
                        padding: '8px 10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: '#222' }}>
                          {isOut ? (isAi ? `✦ ${t('crm.aiEmployees.assignee.badge')}` : t('crm.leads.form.sections.emailsFromUs')) : contactName}
                        </span>
                        <span style={{ fontSize: 9, color: '#b5b5b5' }}>{new Date(m.date).toLocaleString(locale)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{m.text || `[${m.messageType}]`}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="ai-input"
              style={{ flex: 1, padding: '8px 10px', fontSize: 12, border: '1px solid #e7e7e7', borderRadius: 9 }}
              value={draft}
              placeholder={t('crm.leads.form.sections.whatsappPlaceholder')}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={send}
              style={{ padding: '8px 14px', borderRadius: 9, border: 0, background: '#222', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}
            >
              {t('crm.leads.form.sections.whatsappSend')}
            </button>
          </div>
          {error ? <div style={{ fontSize: 11, color: '#9a1f31' }}>{error}</div> : null}
        </div>
      )}
    </CollapsibleCard>
  );
}

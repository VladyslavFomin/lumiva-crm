// src/pages/instagram-crm/InstagramInboxPage.tsx
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createLeadFromInstagramContact,
  fetchInstagramAccounts,
  fetchInstagramContacts,
  fetchInstagramMessages,
  markInstagramContactRead,
  sendInstagramMessage,
  type InstagramContactWithPreview,
  type InstagramMessage,
} from '../../api/instagram-crm';
import { ChatInbox, type ChatAttachmentKind, type ChatChannelAdapter, type ChatContact, type ChatMsg } from '../chat-inbox/ChatInbox';

const KIND: Record<string, ChatAttachmentKind> = { image: 'photo', video: 'video', audio: 'voice', file: 'document' };

const InstagramInboxPage: React.FC = () => {
  const { t } = useTranslation();
  const adapter = useMemo<ChatChannelAdapter>(() => {
    // CDN-ссылки вложений приходят прямо в вебхуке — отдаём их без отдельного запроса
    const urls = new Map<string, string[]>();
    const toMsg = (m: InstagramMessage): ChatMsg => {
      const att = (m.attachments || []).filter((a) => a.url);
      urls.set(m.id, att.map((a) => a.url!));
      return {
        id: m.id,
        direction: m.direction,
        text: m.text,
        type: m.text || att.length ? 'text' : m.kind,
        date: m.date,
        source: 'manual',
        attachments: att.map((a, index) => ({ kind: KIND[a.type] || 'other', index })),
        context:
          m.kind === 'comment'
            ? { label: t('crm.instagram.inbox.commentContext'), href: m.mediaPermalink }
            : m.rawData?.privateReplyTo
              ? { label: t('crm.instagram.inbox.privateReplyContext') }
              : undefined,
      };
    };
    const toContact = (c: InstagramContactWithPreview): ChatContact => ({
      id: c.id,
      name: c.name || (c.username ? `@${c.username}` : 'Instagram'),
      handle: c.username ? `@${c.username}` : '',
      channelId: c.username ? `@${c.username}` : c.igsid || '—',
      senderId: c.accountId,
      unread: c.unreadCount,
      lastMessage: c.lastMessage ? toMsg(c.lastMessage) : null,
      lead: c.lead ?? null,
      crmContact: c.crmContact ?? null,
      crmCompany: c.crmCompany ?? null,
      messageCount: c.messageCount ?? 0,
      firstMessageAt: c.firstMessageAt ?? null,
    });
    return {
      key: 'instagram',
      accent: '#E1306C',
      settingsHref: '/instagram',
      loadSenders: async () =>
        (await fetchInstagramAccounts())
          .filter((a) => a.status !== 'disconnected')
          .map((a) => ({ id: a.id, name: a.igUsername ? `@${a.igUsername}` : 'Instagram', handle: a.pageName || '' })),
      loadContacts: async (search) => (await fetchInstagramContacts({ search: search || undefined })).map(toContact),
      loadMessages: async (contactId) => [...(await fetchInstagramMessages(contactId))].reverse().map(toMsg),
      markRead: (contactId) => markInstagramContactRead(contactId),
      sendText: (contact, _senderId, text) => sendInstagramMessage(contact.id, text),
      attachmentUrl: async (messageId, index) => {
        const u = urls.get(messageId)?.[index];
        if (!u) throw new Error(t('crm.instagram.inbox.attachmentGone'));
        return u;
      },
      createLead: (contactId) => createLeadFromInstagramContact(contactId),
    };
  }, [t]);
  return <ChatInbox adapter={adapter} />;
};

export default InstagramInboxPage;

// src/pages/telegram-crm/TelegramInboxPage.tsx
import React, { useMemo } from 'react';
import {
  createLeadFromTelegramContact,
  fetchTelegramAttachmentUrl,
  fetchTelegramBots,
  fetchTelegramContacts,
  fetchTelegramMessages,
  markTelegramContactRead,
  sendTelegramFile,
  sendTelegramMessage,
  type TelegramContactWithPreview,
  type TelegramMessage,
} from '../../api/telegram-crm';
import { ChatInbox, type ChatAttachmentKind, type ChatChannelAdapter, type ChatContact, type ChatMsg } from '../chat-inbox/ChatInbox';

const KIND: Record<string, ChatAttachmentKind> = {
  photo: 'photo',
  document: 'document',
  voice: 'voice',
  audio: 'voice',
  video: 'video',
};

const toMsg = (m: TelegramMessage): ChatMsg => {
  const src = m.meta?.source;
  return {
    id: m.id,
    direction: m.direction,
    text: m.text,
    type: m.messageType || 'text',
    date: m.date,
    source: src === 'ai' ? 'ai' : src === 'flow' || src === 'system' ? 'flow' : 'manual',
    attachments: (m.attachments || []).map((a, index) => ({
      kind: KIND[a.type] || 'other',
      fileName: a.fileName,
      fileSize: a.fileSize,
      index,
    })),
  };
};

const toContact = (c: TelegramContactWithPreview): ChatContact => {
  const full = [c.telegramFirstName, c.telegramLastName].filter(Boolean).join(' ').trim();
  const handle = c.telegramUsername ? `@${c.telegramUsername}` : `ID ${c.telegramUserId}`;
  return {
    id: c.id,
    name: full || (c.telegramUsername ? `@${c.telegramUsername}` : `Telegram ${c.telegramUserId}`),
    handle,
    channelId: c.telegramUserId,
    senderId: c.botId,
    unread: c.unreadCount,
    lastMessage: c.lastMessage ? toMsg(c.lastMessage) : null,
    lead: c.lead ?? null,
    crmContact: c.crmContact ?? null,
    crmCompany: c.crmCompany ?? null,
    messageCount: c.messageCount ?? 0,
    firstMessageAt: c.firstMessageAt ?? null,
  };
};

/** telegramUserId нужен API отправки — держим исходные контакты рядом с общими. */
const raw = new Map<string, TelegramContactWithPreview>();

const TelegramInboxPage: React.FC = () => {
  const adapter = useMemo<ChatChannelAdapter>(
    () => ({
      key: 'telegram',
      accent: '#229ED9',
      settingsHref: '/telegram',
      loadSenders: async () =>
        (await fetchTelegramBots()).map((b) => ({
          id: b.id,
          name: b.botName || b.botUsername || 'Telegram bot',
          handle: b.botUsername ? `@${b.botUsername}` : '',
        })),
      loadContacts: async (search) => {
        const list = await fetchTelegramContacts({ search: search || undefined });
        list.forEach((c) => raw.set(c.id, c));
        return list.map(toContact);
      },
      loadMessages: async (contactId) => [...(await fetchTelegramMessages({ contactId, limit: 200 })).items].reverse().map(toMsg),
      markRead: (contactId) => markTelegramContactRead(contactId),
      sendText: (contact, senderId, text) =>
        sendTelegramMessage({
          botId: senderId,
          telegramUserId: contact.channelId,
          text,
          contactId: raw.get(contact.id)?.contactId || undefined,
          leadId: contact.lead?.id,
        }),
      sendFile: (contact, senderId, file, caption) =>
        sendTelegramFile({
          botId: senderId,
          telegramUserId: contact.channelId,
          file,
          caption: caption || undefined,
          leadId: contact.lead?.id,
          contactId: raw.get(contact.id)?.contactId || undefined,
        }),
      attachmentUrl: (messageId, index) => fetchTelegramAttachmentUrl(messageId, index),
      createLead: (contactId) => createLeadFromTelegramContact(contactId),
    }),
    [],
  );
  return <ChatInbox adapter={adapter} />;
};

export default TelegramInboxPage;

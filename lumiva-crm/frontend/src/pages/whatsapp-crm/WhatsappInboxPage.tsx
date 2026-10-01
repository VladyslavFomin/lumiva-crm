// src/pages/whatsapp-crm/WhatsappInboxPage.tsx
import React, { useMemo } from 'react';
import {
  createLeadFromWhatsappContact,
  fetchWhatsappAttachmentUrl,
  fetchWhatsappConnections,
  fetchWhatsappContacts,
  fetchWhatsappMessages,
  markWhatsappContactRead,
  sendWhatsappFile,
  sendWhatsappMessage,
  type WhatsappContactWithPreview,
  type WhatsappMessage,
} from '../../api/whatsapp-crm';
import { ChatInbox, type ChatAttachmentKind, type ChatChannelAdapter, type ChatContact, type ChatMsg } from '../chat-inbox/ChatInbox';

const KIND: Record<string, ChatAttachmentKind> = {
  image: 'photo',
  sticker: 'photo',
  document: 'document',
  audio: 'voice',
  video: 'video',
};

const toMsg = (m: WhatsappMessage): ChatMsg => ({
  id: m.id,
  direction: m.direction,
  text: m.text,
  type: m.messageType || 'text',
  date: m.date,
  source: m.direction === 'outgoing' && m.rawData?.source === 'ai' ? 'ai' : 'manual',
  attachments: (m.attachments || []).map((a, index) => ({
    kind: KIND[a.type] || 'other',
    fileName: a.fileName,
    fileSize: a.fileSize,
    index,
  })),
});

const toContact = (c: WhatsappContactWithPreview): ChatContact => {
  const phone = c.waPhoneDigits ? `+${c.waPhoneDigits}` : '';
  return {
    id: c.id,
    name: c.waProfileName || phone || 'WhatsApp',
    handle: phone,
    channelId: phone,
    senderId: c.connectionId,
    unread: c.unreadCount,
    lastMessage: c.lastMessage ? toMsg(c.lastMessage) : null,
    lead: c.lead ?? null,
    crmContact: c.crmContact ?? null,
    crmCompany: c.crmCompany ?? null,
    messageCount: c.messageCount ?? 0,
    firstMessageAt: c.firstMessageAt ?? null,
  };
};

const WhatsappInboxPage: React.FC = () => {
  const adapter = useMemo<ChatChannelAdapter>(
    () => ({
      key: 'whatsapp',
      accent: '#1FA855',
      settingsHref: '/integrations-hub',
      loadSenders: async () =>
        (await fetchWhatsappConnections()).map((c) => ({ id: c.id, name: c.name, handle: c.phoneNumberId ? `ID ${c.phoneNumberId}` : '' })),
      loadContacts: async (search) => (await fetchWhatsappContacts({ search: search || undefined })).map(toContact),
      loadMessages: async (contactId) => [...(await fetchWhatsappMessages({ contactId, limit: 200 })).items].reverse().map(toMsg),
      markRead: (contactId) => markWhatsappContactRead(contactId),
      sendText: (contact, senderId, text) => sendWhatsappMessage({ connectionId: senderId, contactId: contact.id, text }),
      sendFile: (contact, senderId, file, caption) =>
        sendWhatsappFile({ connectionId: senderId, contactId: contact.id, file, caption: caption || undefined }),
      attachmentUrl: (messageId, index) => fetchWhatsappAttachmentUrl(messageId, index),
      createLead: (contactId) => createLeadFromWhatsappContact(contactId),
    }),
    [],
  );
  return <ChatInbox adapter={adapter} />;
};

export default WhatsappInboxPage;

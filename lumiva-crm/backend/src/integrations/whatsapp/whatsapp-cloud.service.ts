import { Injectable } from '@nestjs/common';
import axios from 'axios';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0';

/**
 * WhatsApp Cloud API — текстовое сообщение
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 */
@Injectable()
export class WhatsappCloudService {
  normalizeE164(to: string): string {
    const digits = String(to || '').replace(/\D/g, '');
    return digits;
  }

  async sendTextMessage(params: {
    phoneNumberId: string;
    accessToken: string;
    to: string;
    body: string;
  }): Promise<{ messageId?: string }> {
    const { phoneNumberId, accessToken, to, body } = params;
    const toDigits = this.normalizeE164(to);
    if (!toDigits) {
      throw new Error('WhatsApp: укажите номер получателя (to) в формате E.164 без + или с +');
    }
    if (!phoneNumberId?.trim()) {
      throw new Error('WhatsApp: не указан Phone number ID');
    }
    if (!accessToken?.trim()) {
      throw new Error('WhatsApp: не указан access token');
    }

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId.trim()}/messages`;

    const res = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: toDigits,
        type: 'text',
        text: { body: body.slice(0, 4096) },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
        validateStatus: () => true,
      },
    );

    const data = res.data as { error?: { message?: string }; messages?: { id?: string }[] };
    if (res.status < 200 || res.status >= 300 || data?.error) {
      const msg = data?.error?.message || JSON.stringify(data).slice(0, 500);
      throw new Error(`WhatsApp API ${res.status}: ${msg}`);
    }

    const messageId = data?.messages?.[0]?.id;
    return { messageId };
  }

  /** GET phone-number-id — проверка токена без отправки сообщения */
  async verifyPhoneNumberAccess(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<void> {
    const res = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId.trim()}`,
      {
        headers: { Authorization: `Bearer ${accessToken.trim()}` },
        timeout: 15000,
        validateStatus: () => true,
      },
    );
    if (res.status < 200 || res.status >= 300) {
      const body =
        typeof res.data === 'string' ? res.data : JSON.stringify(res.data || {}).slice(0, 400);
      throw new Error(`WhatsApp API ${res.status}: ${body}`);
    }
  }
}

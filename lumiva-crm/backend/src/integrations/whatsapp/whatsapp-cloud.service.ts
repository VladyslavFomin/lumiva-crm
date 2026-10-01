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

  /** GET phone-number-id — проверка токена без отправки сообщения; возвращает номер и его статус */
  async verifyPhoneNumberAccess(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<{ displayPhoneNumber?: string; verifiedName?: string; status?: string }> {
    const res = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId.trim()}?fields=display_phone_number,verified_name,status`,
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
    return {
      displayPhoneNumber: res.data?.display_phone_number,
      verifiedName: res.data?.verified_name,
      status: res.data?.status,
    };
  }

  /**
   * Подписать приложение (владельца токена) на вебхуки аккаунта WhatsApp Business. Без этого Meta
   * не присылает входящие сообщения, даже если вебхук в приложении настроен и подтверждён: реальный
   * случай — тестовый аккаунт был подписан только на служебное приложение Meta. Повторный вызов безопасен.
   */
  async subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
    const res = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId.trim()}/subscribed_apps`,
      null,
      { headers: { Authorization: `Bearer ${accessToken.trim()}` }, timeout: 15000, validateStatus: () => true },
    );
    if (res.status < 200 || res.status >= 300 || res.data?.success === false) {
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || {}).slice(0, 400);
      throw new Error(`WhatsApp API ${res.status}: ${body}`);
    }
  }

  /** Загрузить файл в Meta (POST /{phone-number-id}/media) → media id для отправки. */
  async uploadMedia(params: {
    phoneNumberId: string;
    accessToken: string;
    buffer: Buffer;
    mime: string;
    fileName: string;
  }): Promise<string> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', params.mime);
    form.append('file', new Blob([new Uint8Array(params.buffer)], { type: params.mime }), params.fileName);
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${params.phoneNumberId.trim()}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${params.accessToken.trim()}` },
      body: form,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      throw new Error(`WhatsApp media upload ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
    }
    return String(data.id);
  }

  /** Отправить загруженный файл сообщением: image — картинкой в чате, document — файлом с именем. */
  async sendMediaMessage(params: {
    phoneNumberId: string;
    accessToken: string;
    to: string;
    kind: 'image' | 'document';
    mediaId: string;
    fileName?: string;
    caption?: string;
  }): Promise<{ messageId?: string }> {
    const media: Record<string, string> = { id: params.mediaId };
    if (params.caption) media.caption = params.caption.slice(0, 1024);
    if (params.kind === 'document' && params.fileName) media.filename = params.fileName;
    const res = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${params.phoneNumberId.trim()}/messages`,
      { messaging_product: 'whatsapp', recipient_type: 'individual', to: params.to, type: params.kind, [params.kind]: media },
      { headers: { Authorization: `Bearer ${params.accessToken.trim()}` }, timeout: 30000, validateStatus: () => true },
    );
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`WhatsApp API ${res.status}: ${JSON.stringify(res.data || {}).slice(0, 400)}`);
    }
    return { messageId: res.data?.messages?.[0]?.id };
  }

  /** Скачать файл по media id (входящий или ранее отправленный): GET /{media-id} → временный url → байты. */
  async downloadMedia(mediaId: string, accessToken: string): Promise<{ buffer: Buffer; contentType: string }> {
    const auth = { Authorization: `Bearer ${accessToken.trim()}` };
    const meta = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
      headers: auth,
      timeout: 15000,
      validateStatus: () => true,
    });
    if (meta.status < 200 || meta.status >= 300 || !meta.data?.url) {
      throw new Error(`WhatsApp media ${meta.status}: ${JSON.stringify(meta.data || {}).slice(0, 300)}`);
    }
    const file = await axios.get(meta.data.url, { headers: auth, responseType: 'arraybuffer', timeout: 60000 });
    return {
      buffer: Buffer.from(file.data),
      contentType: String(meta.data.mime_type || file.headers['content-type'] || 'application/octet-stream'),
    };
  }
}

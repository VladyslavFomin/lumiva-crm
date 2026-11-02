import { Injectable } from '@nestjs/common';
import axios from 'axios';

// v25: отправка по BSUID (поле `recipient`) — для клиентов, скрывших номер за username
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v25.0';
/** WHATSAPP_GRAPH_HOST — только для тестового стенда (имитация Graph API) */
const GRAPH_HOST = () => (process.env.WHATSAPP_GRAPH_HOST || 'https://graph.facebook.com').replace(/\/+$/, '');

/** Ошибка Graph API с кодом Meta: по нему отличаем «токен недействителен» от «закрыто окно 24 ч». */
export class WhatsappApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: number | null,
  ) {
    super(message);
  }

  /** Токен отозван / истёк / нет прав на номер — подключение сломано, а не конкретное сообщение */
  get authFailed(): boolean {
    return this.httpStatus === 401 || this.code === 190 || this.code === 10 || this.code === 200;
  }

  /** Клиент не писал больше 24 ч — свободный текст запрещён, нужен шаблон */
  get outsideWindow(): boolean {
    return this.code === 131047;
  }
}

function apiError(status: number, data: any, prefix = 'WhatsApp API'): WhatsappApiError {
  const e = data?.error || {};
  const msg = e.error_user_msg || e.message || (typeof data === 'string' ? data : JSON.stringify(data || {})).slice(0, 400);
  return new WhatsappApiError(`${prefix} ${status}: ${msg}`, status, typeof e.code === 'number' ? e.code : null);
}

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

  /** Адресат для /messages: BSUID ("TR.123…") уходит в `recipient`, номер — в `to` цифрами. */
  private addressee(to: string): { to: string } | { recipient: string } | null {
    const raw = String(to || '').trim();
    if (/^[A-Z]{2}\./.test(raw)) return { recipient: raw };
    const digits = this.normalizeE164(raw);
    return digits ? { to: digits } : null;
  }

  async sendTextMessage(params: {
    phoneNumberId: string;
    accessToken: string;
    to: string;
    body: string;
  }): Promise<{ messageId?: string }> {
    const { phoneNumberId, accessToken, to, body } = params;
    const addressee = this.addressee(to);
    if (!addressee) {
      throw new Error('WhatsApp: укажите номер получателя (to) в формате E.164 без + или с +');
    }
    if (!phoneNumberId?.trim()) {
      throw new Error('WhatsApp: не указан Phone number ID');
    }
    if (!accessToken?.trim()) {
      throw new Error('WhatsApp: не указан access token');
    }

    const url = `${GRAPH_HOST()}/${GRAPH_VERSION}/${phoneNumberId.trim()}/messages`;

    const res = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        ...addressee,
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
      throw apiError(res.status, data);
    }

    const messageId = data?.messages?.[0]?.id;
    return { messageId };
  }

  /**
   * Сообщение по утверждённому шаблону Meta (template) — им можно написать первым, вне 24-часового окна.
   * Параметры тела шаблона — {{1}}, {{2}}… по порядку.
   */
  async sendTemplateMessage(params: {
    phoneNumberId: string;
    accessToken: string;
    to: string;
    name: string;
    language: string;
    bodyParams: string[];
  }): Promise<{ messageId?: string }> {
    const { phoneNumberId, accessToken, to, name, language, bodyParams } = params;
    const addressee = this.addressee(to);
    if (!addressee) throw new Error('WhatsApp: укажите номер получателя (to) в формате E.164 без + или с +');
    if (!phoneNumberId?.trim()) throw new Error('WhatsApp: не указан Phone number ID');
    if (!accessToken?.trim()) throw new Error('WhatsApp: не указан access token');
    if (!/^[a-z0-9_]{1,512}$/.test(name)) throw new Error('WhatsApp: имя шаблона — латиница в нижнем регистре, цифры и _');
    const res = await axios.post(
      `${GRAPH_HOST()}/${GRAPH_VERSION}/${phoneNumberId.trim()}/messages`,
      {
        messaging_product: 'whatsapp',
        ...addressee,
        type: 'template',
        template: {
          name,
          language: { code: language || 'en' },
          ...(bodyParams.length ? { components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text: text.slice(0, 1024) })) }] } : {}),
        },
      },
      { headers: { Authorization: `Bearer ${accessToken.trim()}`, 'Content-Type': 'application/json' }, timeout: 20000, validateStatus: () => true },
    );
    const data = res.data as { error?: { message?: string }; messages?: { id?: string }[] };
    if (res.status < 200 || res.status >= 300 || data?.error) throw apiError(res.status, data);
    return { messageId: data?.messages?.[0]?.id };
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
      throw apiError(res.status, data, 'WhatsApp media upload');
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
      { messaging_product: 'whatsapp', recipient_type: 'individual', ...(this.addressee(params.to) ?? { to: params.to }), type: params.kind, [params.kind]: media },
      { headers: { Authorization: `Bearer ${params.accessToken.trim()}` }, timeout: 30000, validateStatus: () => true },
    );
    if (res.status < 200 || res.status >= 300) {
      throw apiError(res.status, res.data);
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

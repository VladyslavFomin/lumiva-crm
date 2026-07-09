import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SapApiService {
  async testConnection(
    apiUrl: string | undefined,
    apiKey: string,
  ): Promise<{ ok: boolean; message: string }> {
    if (!apiKey || apiKey.length < 8) {
      return { ok: false, message: 'SAP: укажите API key (не менее 8 символов) — используется для авторизации входящих вебхуков из SAP в Lumiva CRM.' };
    }
    if (apiUrl) {
      // Optionally ping the SAP endpoint to verify connectivity
      try {
        await axios.get(apiUrl, {
          headers: { 'X-API-Key': apiKey, Authorization: `Bearer ${apiKey}` },
          timeout: 8000,
          validateStatus: (s) => s < 500,
        });
        const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
        return {
          ok: true,
          message: `SAP: сервер ответил на ${apiUrl}. Настройте в SAP отправку событий на входящий URL Lumiva CRM (появится в карточке подключения после сохранения).`,
        };
      } catch (e) {
        return { ok: false, message: `SAP: не удалось подключиться к ${apiUrl}: ${(e as Error).message}` };
      }
    }
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const hint = base
      ? ` Настройте в SAP отправку данных на: {URL подключения}/webhooks/sap/{connectionId} с заголовком X-SAP-Token: {ваш apiKey}.`
      : ' Укажите PUBLIC_API_URL в env — тогда в карточке подключения появится готовый Inbound URL.';
    return {
      ok: true,
      message: 'SAP: ключ авторизации сохранён. SAP отправляет данные в Lumiva CRM через входящий вебхук.' + hint,
    };
  }
}

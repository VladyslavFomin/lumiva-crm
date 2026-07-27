// src/api/client.ts
import axios from "axios";
import { getPanelToken, clearPanelSession } from "../auth/panelSession";

const baseURL =
  import.meta.env.VITE_PLATFORM_API_URL?.trim() ||
  "https://crm.lumiva.agency/v1";

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: false,
});

// Добавляем токен аутентификации в заголовки
apiClient.interceptors.request.use(
  (config) => {
    // Не добавляем токен для запросов на логин
    if (config.url?.includes('/platform/auth/login')) {
      return config;
    }
    
    const token = getPanelToken();
    if (token) {
      if (!config.headers) {
        config.headers = {} as any;
      }
      // Устанавливаем заголовок Authorization
      config.headers['Authorization'] = `Bearer ${token}`;
      if (import.meta.env.DEV) {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
          hasToken: !!token,
          tokenPreview: token.substring(0, 20) + '...',
        });
      }
    } else {
      console.warn('[API] Request without token:', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Простой лог + прокидка ошибки дальше
apiClient.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`[API] ✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }
    return response;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error("[API] ❌ Error:", {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
    }
    // На 401 (в т.ч. протухший токен — см. platform-admin.guard.ts) сбрасываем сессию
    // и уводим на логин глобально, а не полагаемся на то, что каждая страница сама
    // обработает эту ошибку (раньше это делали только 2 из 9 страниц).
    // Исключение — сам запрос логина: там 401 означает "неверный пароль", это должна
    // показать форма логина, а не перезагрузка страницы.
    const isLoginRequest = error.config?.url?.includes("/platform/auth/login");
    const alreadyOnLogin = window.location.pathname === "/panel-login";
    if (error.response?.status === 401 && !isLoginRequest && !alreadyOnLogin) {
      clearPanelSession();
      window.location.href = "/panel-login";
    }
    return Promise.reject(error);
  }
);

// маленький helper, чтобы красиво показывать ошибки в UI
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      const status = err.response.status;
      const data = err.response.data as any;
      const msg =
        (data && (data.message || data.error)) ||
        err.message ||
        "Ошибка запроса";
      return `HTTP ${status}: ${msg}`;
    }
    if (err.request) {
      // запрос ушёл, ответа нет
      return "Сервер не отвечает или блокируется (CORS / сеть)";
    }
    return err.message || "Ошибка запроса";
  }
  if (err instanceof Error) return err.message;
  return "Неизвестная ошибка";
}

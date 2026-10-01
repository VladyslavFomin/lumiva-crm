// Виджет онлайн-чата поддержки Lumiva (public/lumiva-chat.js) на crm.lumiva.agency.
// Сообщения попадают в «Онлайн-чат» (/chat) тенанта admin (LUMIVA AGENCY).
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAccessToken, getSession } from '../../auth/session';

const SUPPORT_TENANT_KEY = 'admin';
const SUPPORT_HOSTS = ['crm.lumiva.agency'];

// Страницы, которые видят не клиенты Lumiva, а клиенты наших клиентов
// (встраиваемые формы, портал, подпись документов, публичная аналитика, оплата).
function isForeignAudiencePath(pathname: string): boolean {
  return (
    /^\/(embed|portal|pay)(\/|$)/.test(pathname) ||
    /^\/esign\/[^/]+/.test(pathname) ||
    /^\/workspace\/[^/]+\/[^/]+\/analytics/.test(pathname)
  );
}

type LumivaChatApi = {
  setBottom: (px: number) => void;
  hide: () => void;
  show: () => void;
};

function chatApi(): LumivaChatApi | undefined {
  return (window as unknown as { LumivaChat?: LumivaChatApi }).LumivaChat;
}

export function LumivaSupportChat() {
  const { pathname } = useLocation();
  // White-label домены клиентов работают на той же сборке — там наш чат не нужен.
  const enabledHost = SUPPORT_HOSTS.includes(window.location.hostname);

  const loggedIn = !!getAccessToken();
  // Сам тенант поддержки отвечает из /chat, писать самому себе незачем.
  const isSupportTenant = loggedIn && getSession()?.clientKey === SUPPORT_TENANT_KEY;
  const visible = enabledHost && !isSupportTenant && !isForeignAudiencePath(pathname);
  // Внутри приложения справа снизу уже стоят «?» (24px) и AI-кнопка (84px) — встаём над ними.
  const bottom = loggedIn ? 144 : 20;

  useEffect(() => {
    if (!visible) {
      chatApi()?.hide();
      return;
    }
    const existing = chatApi();
    if (existing) {
      existing.show();
      existing.setBottom(bottom);
      return;
    }
    if (document.getElementById('lumiva-chat-script')) return;
    const s = document.createElement('script');
    s.id = 'lumiva-chat-script';
    s.src = '/lumiva-chat.js';
    s.async = true;
    s.dataset.tenantKey = SUPPORT_TENANT_KEY;
    s.dataset.bottom = String(bottom);
    document.body.appendChild(s);
  }, [visible, bottom]);

  return null;
}

// src/components/ai/MessengerAiCard.tsx
// Блок «ИИ-сотрудник» в карточке диалога WhatsApp/Telegram: кто отвечает клиентам, как (сам / черновики /
// выключен / не нанят), на паузе ли после ручного ответа и подключены ли «Мозг» ИИ-офиса и «Медиа».
// Отвечает только нанятый консультант мессенджеров с включённым каналом — без него ИИ молчит.
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchMessengerAiPause, type MessengerAiChannel, type MessengerAiPause } from '../../api/onlineChat';

const POLL_MS = 60_000;

export const MessengerAiCard: React.FC<{ channel: MessengerAiChannel; contactId: string; bump?: number }> = ({ channel, contactId, bump }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.chatInbox.ai.${key}`, o) as string;
  const [st, setSt] = useState<MessengerAiPause | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setSt(await fetchMessengerAiPause(channel, contactId));
      setFailed(false);
    } catch {
      setFailed(true); // нет прав на ИИ / канал — блок не показываем
    }
  }, [channel, contactId]);

  useEffect(() => {
    setSt(null);
    void load();
  }, [load, bump]);

  useEffect(() => {
    const id = window.setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  if (failed || !st) return null;
  const mode = st.mode || (st.handles ? 'auto' : 'none');
  const channelName = channel === 'telegram' ? 'Telegram' : 'WhatsApp';
  const settings = st.agentId ? `/ai-employees/${st.agentId}?tab=chat` : '/ai-employees/choose';
  const paused = st.pausedUntil && new Date(st.pausedUntil).getTime() > Date.now() ? new Date(st.pausedUntil) : null;

  return (
    <div className="ix-blk">
      <div className="kick">{k('title')}</div>
      {mode === 'none' ? (
        <>
          <p className="ix-note">{k('none', { channel: channelName })}</p>
          <Link className="e2b gh sm" to={settings}>{k('hire')}</Link>
        </>
      ) : (
        <>
          <Link className="ix-link" to={settings}>
            <span>{st.agentName || 'AI'}</span>
          </Link>
          <div className="ix-kv">
            <span>{k('modeLabel')}</span>
            <b className={mode === 'off' ? 'mute' : undefined}>
              {paused
                ? k('paused', { time: paused.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) })
                : k(`mode.${mode}`, { channel: channelName })}
            </b>
          </div>
          <div className="ix-kv">
            <span>{k('brain')}</span>
            <b className={st.office?.brain ? undefined : 'mute'}>{st.office?.brain ? k('on') : k('off')}</b>
          </div>
          <div className="ix-kv">
            <span>{k('media')}</span>
            <b className={st.office?.media ? undefined : 'mute'}>{st.office?.media ? k('on') : k('off')}</b>
          </div>
          <Link className="e2b gh sm" to={settings}>{mode === 'off' ? k('enable', { channel: channelName }) : k('configure')}</Link>
        </>
      )}
    </div>
  );
};

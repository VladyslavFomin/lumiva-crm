// src/components/ai/MessengerAiPauseBar.tsx
// Плашка над полем ввода WhatsApp/Telegram: ИИ-консультант замолчал, потому что сотрудник ответил вручную,
// и кнопка «Вернуть ИИ». Без плашки пауза выглядела как поломка консультанта.
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMessengerAiPause, resumeMessengerAi, type MessengerAiChannel, type MessengerAiPause } from '../../api/onlineChat';
import './messenger-ai-pause.css';

const POLL_MS = 60_000;

export const MessengerAiPauseBar: React.FC<{
  channel: MessengerAiChannel;
  contactId: string | null | undefined;
  /** Меняется после ручной отправки — перечитываем статус сразу. */
  bump?: number;
}> = ({ channel, contactId, bump }) => {
  const { t, i18n } = useTranslation();
  const [st, setSt] = useState<MessengerAiPause | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!contactId) return setSt(null);
    try {
      setSt(await fetchMessengerAiPause(channel, contactId));
    } catch {
      setSt(null); // нет прав на канал / консультанта — просто не показываем
    }
  }, [channel, contactId]);

  useEffect(() => {
    setSt(null);
    setErr('');
  }, [channel, contactId]);

  useEffect(() => {
    void load();
  }, [load, bump]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  if (!contactId || !st?.handles || !st.pausedUntil) return null;
  const until = new Date(st.pausedUntil);
  if (until.getTime() <= now) return null;

  const sameDay = until.toDateString() === new Date(now).toDateString();
  const time = until.toLocaleString(i18n.language, sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const resume = async () => {
    setBusy(true);
    setErr('');
    try {
      setSt(await resumeMessengerAi(channel, contactId));
    } catch (e) {
      setErr((e as Error)?.message || t('crm.messengerAiPause.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mai-pause" role="status">
      <span className="dot" aria-hidden />
      <span className="txt">
        {t('crm.messengerAiPause.text', { name: st.agentName || 'AI', time })}
        {err && <span className="err"> {err}</span>}
      </span>
      <button type="button" onClick={() => void resume()} disabled={busy} title={t('crm.messengerAiPause.resumeHint')}>
        {busy ? t('crm.messengerAiPause.resuming') : t('crm.messengerAiPause.resume')}
      </button>
    </div>
  );
};

export default MessengerAiPauseBar;

// src/pages/telephony/TelephonySmsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { TelephonySubnav } from './TelephonySubnav';
import { fetchSmsMessages, sendSms, type SmsMessage } from '../../api/sms';
import { useAlertModal } from '../../contexts/AlertModalContext';
import './telephony-design.css';

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

interface Thread {
  phone: string;
  messages: SmsMessage[];
  lastMessage: SmsMessage;
}

function buildThreads(messages: SmsMessage[]): Thread[] {
  const byPhone = new Map<string, SmsMessage[]>();
  for (const m of messages) {
    const phone = m.direction === 'outbound' ? m.toPhone : (m.fromPhone || m.toPhone);
    if (!phone) continue;
    if (!byPhone.has(phone)) byPhone.set(phone, []);
    byPhone.get(phone)!.push(m);
  }
  const threads: Thread[] = [];
  for (const [phone, msgs] of byPhone) {
    const sorted = [...msgs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    threads.push({ phone, messages: sorted, lastMessage: sorted[sorted.length - 1] });
  }
  return threads.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
}

export const TelephonySmsPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSmsMessages({ limit: 500 });
      setMessages(data.items);
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось загрузить SMS', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const threads = useMemo(() => buildThreads(messages), [messages]);
  useEffect(() => {
    if (!activePhone && threads.length) setActivePhone(threads[0].phone);
  }, [threads, activePhone]);
  const active = threads.find((t) => t.phone === activePhone) || null;

  const totalSent = messages.filter((m) => m.direction === 'outbound').length;
  const totalDelivered = messages.filter((m) => m.direction === 'outbound' && (m.status === 'delivered' || m.status === 'sent')).length;
  const deliveryRate = totalSent ? Math.round((totalDelivered / totalSent) * 1000) / 10 : 0;
  const totalReceived = messages.filter((m) => m.direction === 'inbound').length;

  const handleSend = async () => {
    if (!draft.trim() || !activePhone) return;
    setSending(true);
    try {
      const msg = await sendSms({ to: activePhone, body: draft.trim() });
      setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось отправить SMS', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />{messages.length} СООБЩЕНИЙ</div>
            <h1>SMS-переписки</h1>
            <p className="sub">Все входящие и исходящие SMS в одном месте.</p>
          </div>
        </div>

        <TelephonySubnav active="sms" />

        <div className="tel-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="tel-kpi"><div className="l">Отправлено</div><div className="v">{totalSent}</div></div>
          <div className="tel-kpi"><div className="l">Доставлено</div><div className="v">{deliveryRate}%</div></div>
          <div className="tel-kpi"><div className="l">Получено</div><div className="v">{totalReceived}</div></div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>Загрузка…</div>
        ) : threads.length === 0 ? (
          <div className="bk-table-wrap" style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13, marginTop: 14 }}>
            SMS-переписок пока нет
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden', marginTop: 14, background: '#fff' }}>
            <div style={{ borderRight: '1px solid var(--line-2)', maxHeight: 560, overflowY: 'auto' }}>
              {threads.map((t) => (
                <div
                  key={t.phone}
                  className="sms-thread-row"
                  style={{ background: activePhone === t.phone ? 'var(--bg-muted)' : undefined }}
                  onClick={() => setActivePhone(t.phone)}
                >
                  <div className="sms-ava">{t.phone.slice(-2)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--ff-mono)' }}>{t.phone}</div>
                    <div className="sms-preview">{t.lastMessage.direction === 'outbound' ? 'Вы: ' : ''}{t.lastMessage.body}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', textAlign: 'right' }}>{new Date(t.lastMessage.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>

            {active && (
              <div className="sms-chat-wrap">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="sms-ava">{active.phone.slice(-2)}</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, fontFamily: 'var(--ff-mono)' }}>{active.phone}</div>
                </div>
                <div className="sms-chat-msgs">
                  {active.messages.map((m) => (
                    <div key={m.id} className={cx('sms-bubble', m.direction, m.status === 'failed' && 'failed')}>
                      {m.body}
                      <span className="meta">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {m.direction === 'outbound' && m.status === 'failed' ? ' · не доставлено' : ''}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="sms-chat-input">
                  <input placeholder="Написать сообщение…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }} />
                  <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending || !draft.trim()}>Отправить</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

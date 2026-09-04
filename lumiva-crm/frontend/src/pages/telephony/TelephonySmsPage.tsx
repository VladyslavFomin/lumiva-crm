// src/pages/telephony/TelephonySmsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
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
  const { t } = useTranslation();
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
      showAlert(e?.message || t('crm.telephony.sms.loadError'), { variant: 'error' });
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
      showAlert(e?.message || t('crm.telephony.sms.sendError'), { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <MainLayout>
      <PageHelpButton topic="telephonySms" />
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.telephony.sms.kicker', { count: messages.length })}</div>
            <h1>{t('crm.telephony.sms.title')}</h1>
            <p className="sub">{t('crm.telephony.sms.subtitle')}</p>
          </div>
        </div>

        <TelephonySubnav active="sms" />

        <div className="tel-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="tel-kpi"><div className="l">{t('crm.telephony.sms.kpis.sent')}</div><div className="v">{totalSent}</div></div>
          <div className="tel-kpi"><div className="l">{t('crm.telephony.sms.kpis.delivered')}</div><div className="v">{deliveryRate}%</div></div>
          <div className="tel-kpi"><div className="l">{t('crm.telephony.sms.kpis.received')}</div><div className="v">{totalReceived}</div></div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{t('crm.telephony.sms.loading')}</div>
        ) : threads.length === 0 ? (
          <div className="bk-table-wrap" style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13, marginTop: 14 }}>
            {t('crm.telephony.sms.emptyThreads')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden', marginTop: 14, background: '#fff' }}>
            <div style={{ borderRight: '1px solid var(--line-2)', maxHeight: 560, overflowY: 'auto' }}>
              {threads.map((th) => (
                <div
                  key={th.phone}
                  className="sms-thread-row"
                  style={{ background: activePhone === th.phone ? 'var(--bg-muted)' : undefined }}
                  onClick={() => setActivePhone(th.phone)}
                >
                  <div className="sms-ava">{th.phone.slice(-2)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--ff-mono)' }}>{th.phone}</div>
                    <div className="sms-preview">{th.lastMessage.direction === 'outbound' ? t('crm.telephony.sms.youPrefix') : ''}{th.lastMessage.body}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', textAlign: 'right' }}>{new Date(th.lastMessage.createdAt).toLocaleDateString()}</div>
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
                        {m.direction === 'outbound' && m.status === 'failed' ? ` · ${t('crm.telephony.sms.notDelivered')}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="sms-chat-input">
                  <input placeholder={t('crm.telephony.sms.inputPlaceholder')} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }} />
                  <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending || !draft.trim()}>{t('crm.telephony.sms.sendBtn')}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

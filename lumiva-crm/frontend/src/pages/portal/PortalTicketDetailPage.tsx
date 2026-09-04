// src/pages/portal/PortalTicketDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchPortalTicket, replyToPortalTicket, type PortalTicket, type TicketMessage } from '../../api/portal';

const STATUS_KEYS = ['open', 'pending', 'resolved', 'closed'];

export const PortalTicketDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const statusLabel = (status: string) => (STATUS_KEYS.includes(status) ? t(`crm.portal.ticketStatus.${status}`) : status);

  const { clientKey = '', ticketId = '' } = useParams<{ clientKey: string; ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<PortalTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetchPortalTicket(ticketId)
      .then((res) => {
        setTicket(res.ticket);
        setMessages(res.messages);
      })
      .catch((e: any) => setError(e?.message || t('crm.portal.ticketDetail.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      await replyToPortalTicket(ticketId, reply.trim());
      setReply('');
      load();
    } catch (e: any) {
      setError(e?.message || t('crm.portal.ticketDetail.sendError'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">{t('crm.portal.ticketDetail.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <button
          type="button"
          onClick={() => navigate(`/portal/${clientKey}/tickets`)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          {t('crm.portal.ticketDetail.backToTickets')}
        </button>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>
        )}

        {ticket && (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-lumiva-accent">{ticket.subject}</h1>
              <span className="text-xs font-medium px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
                {statusLabel(ticket.status)}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.direction === 'incoming' ? 'bg-slate-100 text-slate-800 ml-auto' : 'bg-lumiva-accent/5 text-slate-800 border border-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-400 mb-1">
                    {m.authorName} · {new Date(m.createdAt).toLocaleString(dateLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleReply} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-2">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t('crm.portal.ticketDetail.replyPlaceholder')}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent"
              />
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sending ? '…' : t('crm.portal.ticketDetail.sendBtn')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default PortalTicketDetailPage;

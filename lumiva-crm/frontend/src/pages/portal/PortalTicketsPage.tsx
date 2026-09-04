// src/pages/portal/PortalTicketsPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchPortalTickets, createPortalTicket, type PortalTicket } from '../../api/portal';

const STATUS_CLASS: Record<string, string> = {
  open: 'bg-sky-50 text-sky-700',
  pending: 'bg-amber-50 text-amber-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-slate-100 text-slate-500',
};
const STATUS_KEYS = ['open', 'pending', 'resolved', 'closed'];

export const PortalTicketsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const statusLabel = (status: string) => (STATUS_KEYS.includes(status) ? t(`crm.portal.ticketStatus.${status}`) : status);

  const { clientKey = '' } = useParams<{ clientKey: string }>();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<PortalTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchPortalTickets()
      .then(setTickets)
      .catch((e: any) => setError(e?.message || t('crm.portal.tickets.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await createPortalTicket(subject.trim(), message.trim());
      setShowForm(false);
      setSubject('');
      setMessage('');
      navigate(`/portal/${clientKey}/tickets/${ticket.id}`);
    } catch (e: any) {
      setError(e?.message || t('crm.portal.tickets.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(`/portal/${clientKey}/dashboard`)}
              className="text-xs text-slate-400 hover:text-slate-600 mb-2"
            >
              {t('crm.portal.tickets.backToDashboard')}
            </button>
            <h1 className="text-2xl font-semibold text-lumiva-accent">{t('crm.portal.tickets.title')}</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft px-4 py-2 text-sm font-semibold text-white"
          >
            {showForm ? t('crm.portal.tickets.cancelBtn') : t('crm.portal.tickets.newTicketBtn')}
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('crm.portal.tickets.subjectPlaceholder')}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent"
              autoFocus
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('crm.portal.tickets.messagePlaceholder')}
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent"
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? t('crm.portal.tickets.sendingBtn') : t('crm.portal.tickets.sendBtn')}
            </button>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          {loading ? (
            <div className="text-sm text-slate-500">{t('crm.portal.tickets.loading')}</div>
          ) : tickets.length === 0 ? (
            <div className="text-sm text-slate-500">{t('crm.portal.tickets.empty')}</div>
          ) : (
            <div className="space-y-2">
              {tickets.map((tk) => (
                <button
                  key={tk.id}
                  type="button"
                  onClick={() => navigate(`/portal/${clientKey}/tickets/${tk.id}`)}
                  className="w-full text-left flex items-center justify-between rounded-xl border border-slate-100 hover:border-slate-300 px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">{tk.subject}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(tk.updatedAt).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${STATUS_CLASS[tk.status] || 'bg-slate-100 text-slate-600'}`}>
                    {statusLabel(tk.status)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortalTicketsPage;

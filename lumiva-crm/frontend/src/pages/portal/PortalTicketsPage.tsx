// src/pages/portal/PortalTicketsPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchPortalTickets, createPortalTicket, type PortalTicket } from '../../api/portal';

const STATUS_LABEL: Record<string, string> = {
  open: 'Открыт',
  pending: 'В обработке',
  resolved: 'Решён',
  closed: 'Закрыт',
};
const STATUS_CLASS: Record<string, string> = {
  open: 'bg-sky-50 text-sky-700',
  pending: 'bg-amber-50 text-amber-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-slate-100 text-slate-500',
};

export const PortalTicketsPage: React.FC = () => {
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
      .catch((e: any) => setError(e?.message || 'Не удалось загрузить обращения'))
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
      setError(e?.message || 'Не удалось создать обращение');
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
              ← Личный кабинет
            </button>
            <h1 className="text-2xl font-semibold text-lumiva-accent">Обращения в поддержку</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft px-4 py-2 text-sm font-semibold text-white"
          >
            {showForm ? 'Отмена' : 'Новое обращение'}
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
              placeholder="Тема обращения"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent"
              autoFocus
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Опишите ваш вопрос"
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent"
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Отправляем…' : 'Отправить'}
            </button>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          {loading ? (
            <div className="text-sm text-slate-500">Загрузка…</div>
          ) : tickets.length === 0 ? (
            <div className="text-sm text-slate-500">У вас пока нет обращений</div>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/portal/${clientKey}/tickets/${t.id}`)}
                  className="w-full text-left flex items-center justify-between rounded-xl border border-slate-100 hover:border-slate-300 px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">{t.subject}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(t.updatedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${STATUS_CLASS[t.status] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABEL[t.status] || t.status}
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

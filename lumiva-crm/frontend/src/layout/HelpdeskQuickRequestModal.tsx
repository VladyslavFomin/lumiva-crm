// src/layout/HelpdeskQuickRequestModal.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createInternalHelpdeskRequest, type TicketPriority } from '../api/helpdesk';
import { useAlertModal } from '../contexts/AlertModalContext';

const PRIORITY_KEYS: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export interface HelpdeskQuickRequestModalProps {
  open: boolean;
  onClose: () => void;
}

/** "Создать заявку" — any employee (any department) can raise an internal request to
 * support straight from the notifications panel. No channel/contact picker: it's always
 * an internal ticket, and the reply comes back as a notification here, not an external message. */
export const HelpdeskQuickRequestModal: React.FC<HelpdeskQuickRequestModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setSubject('');
    setCategory('');
    setPriority('medium');
    setMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await createInternalHelpdeskRequest({
        subject: subject.trim(),
        message: message.trim(),
        category: category.trim() || undefined,
        priority,
      });
      reset();
      onClose();
      showAlert(t('crm.helpdesk.quickRequest.successMsg'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e?.message || t('crm.helpdesk.quickRequest.errorMsg'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={submitting ? undefined : onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{t('crm.helpdesk.quickRequest.kicker')}</div>
            <div className="text-sm font-semibold text-slate-900">{t('crm.helpdesk.quickRequest.title')}</div>
          </div>
          <button
            type="button"
            onClick={submitting ? undefined : onClose}
            className="h-8 w-8 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900"
          >
            ✕
          </button>
        </div>
        <div className="text-xs text-slate-500">
          {t('crm.helpdesk.quickRequest.body')}
        </div>

        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('crm.helpdesk.quickRequest.subjectPlaceholder')}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
          required
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t('crm.helpdesk.quickRequest.categoryPlaceholder')}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            {PRIORITY_KEYS.map((p) => (
              <option key={p} value={p}>
                {t(`crm.helpdesk.priority.${p}`)}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('crm.helpdesk.quickRequest.messagePlaceholder')}
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
          required
        />
        <button
          type="submit"
          disabled={submitting || !subject.trim() || !message.trim()}
          className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl bg-lumiva-accent text-white hover:bg-lumiva-accent-hover disabled:opacity-60"
        >
          {submitting ? t('crm.helpdesk.quickRequest.sendingBtn') : t('crm.helpdesk.quickRequest.sendBtn')}
        </button>
      </form>
    </div>
  );
};

export default HelpdeskQuickRequestModal;

import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { downloadRepReport, sendRepReport, type RepAnalyticsQuery } from '../../../api/hotelReputation';
import { useRepT } from './ReputationShared';
import { TenantMailNotice, useNotificationSender } from '../../../components/mail/TenantMailNotice';

const LANGS = [
  ['ru', 'Русский'],
  ['en', 'English'],
  ['tr', 'Türkçe'],
] as const;
type Lang = (typeof LANGS)[number][0];

/** PDF-отчёт по текущим фильтрам дашборда: язык, ИИ-вывод, скачать или отправить на почту. */
export const RepReportModal: React.FC<{ open: boolean; onClose: () => void; query: RepAnalyticsQuery; scopeText: string }> = ({ open, onClose, query, scopeText }) => {
  const { r, lang: uiLang } = useRepT();
  const { showAlert } = useAlertModal();
  const [lang, setLang] = useState<Lang>(uiLang.startsWith('tr') ? 'tr' : uiLang.startsWith('en') ? 'en' : 'ru');
  const [aiSummary, setAiSummary] = useState(true);
  const [emails, setEmails] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'pdf' | 'send' | null>(null);
  // письма уходят с почты компании: не подключена — кнопка «Отправить» недоступна
  const sender = useNotificationSender();

  const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  const bad = list.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const body = { ...query, lang, aiSummary };

  const download = async () => {
    setBusy('pdf');
    try {
      await downloadRepReport(body);
    } catch (e: any) {
      showAlert(e?.message || r('report.error'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const send = async () => {
    setBusy('send');
    try {
      const res = await sendRepReport({ ...body, emails: list, message: message.trim() || undefined });
      const failed = res.results.filter((x) => !x.ok);
      if (failed.length) showAlert(r('report.sentPartial', { n: res.sent, failed: failed.map((x) => x.email).join(', ') }), { variant: 'error' });
      else {
        showAlert(r('report.sent', { n: res.sent }), { variant: 'success' });
        onClose();
      }
    } catch (e: any) {
      showAlert(e?.message || r('report.error'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={r('report.title')} size="lg">
      <div className="rp-report-modal">
        <div className="scope">{scopeText}</div>
        <div className="rp-modal-row">
          <label>{r('report.lang')}</label>
          <div className="langs">
            {LANGS.map(([code, name]) => (
              <button key={code} type="button" className={lang === code ? 'on' : ''} onClick={() => setLang(code)}>{name}</button>
            ))}
          </div>
        </div>
        <div className="rp-modal-row">
          <label className="chk"><input type="checkbox" checked={aiSummary} onChange={(e) => setAiSummary(e.target.checked)} />{r('report.ai')}</label>
          <div className="hint">{r('report.aiHint')}</div>
        </div>
        <div className="rp-modal-row">
          <label htmlFor="rp-report-emails">{r('report.emails')}</label>
          <input id="rp-report-emails" type="text" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="gm@hotel.com, marketing@hotel.com" />
          {bad.length > 0 ? <div className="hint" style={{ color: '#cc2f47' }}>{r('report.badEmail', { e: bad.join(', ') })}</div> : <div className="hint">{r('report.emailsHint')}</div>}
          <TenantMailNotice />
        </div>
        {list.length > 0 && (
          <div className="rp-modal-row">
            <label htmlFor="rp-report-msg">{r('report.message')}</label>
            <textarea id="rp-report-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={r('report.messagePh')} />
          </div>
        )}
        <div className="hint">{r('report.contents')}</div>
        <div className="acts">
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={download}>
            {busy === 'pdf' ? r('report.building') : r('report.download')}
          </button>
          <button type="button" className="btn-primary" disabled={!!busy || !list.length || bad.length > 0 || (!!sender && !sender.account)} onClick={send}>
            {busy === 'send' ? r('report.sending') : r('report.send', { n: list.length || '' })}
          </button>
        </div>
      </div>
    </Modal>
  );
};

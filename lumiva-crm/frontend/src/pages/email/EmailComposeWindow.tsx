import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { EmailRichEditor } from './EmailRichEditor';
import { sendEmail, type EmailAccount } from '../../api/email';

const BTN_DARK = '#222222';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export type EmailComposeWindowProps = {
  open: boolean;
  mode: 'new' | 'reply';
  accounts: EmailAccount[];
  accountId: string;
  onAccountChange: (id: string) => void;
  initialTo: string;
  initialSubject: string;
  initialHtml: string;
  resetKey: string | number;
  leadId?: string | null;
  onClose: () => void;
  onSent: () => void;
};

export const EmailComposeWindow: React.FC<EmailComposeWindowProps> = ({
  open,
  mode,
  accounts,
  accountId,
  onAccountChange,
  initialTo,
  initialSubject,
  initialHtml,
  resetKey,
  leadId,
  onClose,
  onSent,
}) => {
  const { t } = useTranslation();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('<p></p>');
  const [plainBody, setPlainBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 48, y: 48 });
  const prevOpenRef = useRef(false);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const posRef = useRef(pos);
  posRef.current = pos;

  useLayoutEffect(() => {
    if (!open) return;
    setTo(initialTo);
    setSubject(initialSubject);
    setHtmlBody(initialHtml || '<p></p>');
    setPlainBody('');
    setFiles([]);
    setErr(null);
  }, [open, initialTo, initialSubject, initialHtml, resetKey]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (open && !prevOpenRef.current) {
      const w = 680;
      setPos({
        x: Math.floor(Math.max(12, (window.innerWidth - w) / 2)),
        y: Math.floor(Math.max(12, window.innerHeight * 0.06)),
      });
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPos({
        x: d.px + e.clientX - d.sx,
        y: d.py + e.clientY - d.sy,
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const p = posRef.current;
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: p.x, py: p.y };
  };

  const onEditorChange = useCallback((html: string, plain: string) => {
    setHtmlBody(html);
    setPlainBody(plain);
  }, []);

  const parseTo = (raw: string) =>
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSend = async () => {
    setErr(null);
    if (!accountId) {
      setErr(t('crm.email.inbox.pickAccount'));
      return;
    }
    const recipients = parseTo(to);
    if (!recipients.length) {
      setErr(t('crm.email.inbox.toRequired'));
      return;
    }
    setBusy(true);
    try {
      const attachments =
        files.length > 0
          ? await Promise.all(
              files.map(async (f) => ({
                filename: f.name,
                contentType: f.type || 'application/octet-stream',
                contentBase64: await fileToBase64(f),
              })),
            )
          : undefined;
      await sendEmail({
        accountId,
        to: recipients,
        subject: subject.trim() || undefined,
        htmlBody: htmlBody.replace(/<p><\/p>/g, '').trim() ? htmlBody : undefined,
        textBody: plainBody.trim() || undefined,
        leadId: leadId || undefined,
        attachments,
      });
      onSent();
      onClose();
    } catch (e: any) {
      setErr(e?.message || t('crm.email.inbox.sendError'));
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  const ui = (
    <>
      <div className="fixed inset-0 z-[8500] bg-slate-900/25" aria-hidden />
      <div
        className="fixed z-[8600] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        style={{
          left: pos.x,
          top: pos.y,
          width: 680,
          height: 560,
          minWidth: 360,
          minHeight: 380,
          maxWidth: '96vw',
          maxHeight: '92vh',
          resize: 'both',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-compose-win-title"
      >
        <div
          className="flex shrink-0 cursor-grab select-none items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 active:cursor-grabbing"
          onMouseDown={onHeaderMouseDown}
        >
          <span id="email-compose-win-title" className="text-sm font-semibold text-slate-800">
            {mode === 'reply' ? t('crm.email.inbox.replyTitle') : t('crm.email.inbox.composeTitle')}
          </span>
          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('crm.common.cancel')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSend()}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: BTN_DARK }}
            >
              {busy ? t('crm.email.inbox.sending') : t('crm.email.inbox.send')}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {err ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{err}</div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {t('crm.aiAssistant.emailComposer.account')}
              </label>
              <select
                value={accountId}
                onChange={(e) => onAccountChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 shadow-sm"
              >
                <option value="">{t('crm.aiAssistant.emailComposer.pickAccount')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ? `${a.name} · ${a.email}` : a.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {t('crm.email.inbox.to')}
              </label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 shadow-sm"
                placeholder="email@…"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {t('crm.email.inbox.subject')}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 shadow-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {t('crm.email.inbox.body')}
            </label>
            <EmailRichEditor
              key={resetKey}
              variant="light"
              content={htmlBody}
              onChange={onEditorChange}
              placeholder={t('crm.email.inbox.body')}
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {t('crm.email.inbox.attachments')}
            </label>
            <input
              type="file"
              multiple
              className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-slate-800"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                {files.map((f) => (
                  <li key={f.name + f.size}>{f.name}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(ui, document.body);
};

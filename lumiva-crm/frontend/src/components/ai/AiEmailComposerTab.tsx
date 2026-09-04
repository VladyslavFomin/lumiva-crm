import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchEmailAccounts,
  fetchEmailTemplates,
  previewStyledMail,
  sendStyledMail,
  type EmailAccount,
  type EmailTemplate,
} from '../../api/email';
import { fetchContact } from '../../api/contacts';
import { fetchLeadById } from '../../api/leads';
import { createAiSession, postAiChat } from '../../api/ai';
import { EmailRichEditor } from '../../pages/email/EmailRichEditor';

export type AiEmailComposerInitialDraft = {
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  to?: string;
};

export type AiEmailComposerTabProps = {
  /** Вкладка активна — используется, чтобы (пере)загрузить аккаунты/шаблоны при каждом открытии */
  active: boolean;
  initialDraft?: AiEmailComposerInitialDraft | null;
};

type Attachment = { filename: string; contentType: string; contentBase64: string; size: number };

const DEFAULT_VARS = '{\n  "name": "",\n  "email": ""\n}';
const DRAFT_STORAGE_KEY = 'lumiva_ai_email_draft_v1';
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const VARIABLE_CHIPS: Array<{ key: string; label: string }> = [
  { key: 'имя', label: 'Имя' },
  { key: 'компания', label: 'Компания' },
  { key: 'сделка', label: 'Сделка' },
  { key: 'менеджер', label: 'Менеджер' },
];

function wrapEmailHtmlFragment(html: string): string {
  const raw = html.trim();
  if (!raw) return '';
  if (/^\s*<!DOCTYPE/i.test(raw) || /<html[\s>]/i.test(raw)) {
    return raw;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"></head><body>${raw}</body></html>`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} КБ`;
  return `${(kb / 1024).toFixed(1)} МБ`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type DraftShape = {
  accountId?: string;
  to?: string;
  subject?: string;
  headline?: string;
  bodyHtmlFragment?: string;
  contactId?: string;
  leadId?: string;
  varsJson?: string;
};

function loadDraft(): DraftShape | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftShape;
  } catch {
    return null;
  }
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.6} />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  );
}

export const AiEmailComposerTab: React.FC<AiEmailComposerTabProps> = ({ active, initialDraft }) => {
  const { t } = useTranslation();
  const [view, setView] = useState<'editor' | 'preview'>('editor');
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [to, setTo] = useState('');
  const [contactId, setContactId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [varsJson, setVarsJson] = useState(DEFAULT_VARS);
  const [headline, setHeadline] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtmlFragment, setBodyHtmlFragment] = useState('');
  const [bodyPlain, setBodyPlain] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [sent, setSent] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rewriteSessionIdRef = useRef<string | null>(null);
  const draftLoadedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (initialDraft) {
      if (initialDraft.subject != null) setSubject(initialDraft.subject);
      if (initialDraft.textBody != null) {
        setBodyPlain(initialDraft.textBody);
        setBodyHtmlFragment('');
        setEditorKey((k) => k + 1);
      }
      if (initialDraft.htmlBody != null) {
        setBodyHtmlFragment(initialDraft.htmlBody);
        setEditorKey((k) => k + 1);
        setShowAdvanced(true);
      }
      if (initialDraft.to) setTo(initialDraft.to);
    } else if (!draftLoadedRef.current) {
      draftLoadedRef.current = true;
      const d = loadDraft();
      if (d) {
        setTo(d.to || '');
        setSubject(d.subject || '');
        setHeadline(d.headline || '');
        setContactId(d.contactId || '');
        setLeadId(d.leadId || '');
        setVarsJson(d.varsJson || DEFAULT_VARS);
        if (d.bodyHtmlFragment) {
          setBodyHtmlFragment(d.bodyHtmlFragment);
          setEditorKey((k) => k + 1);
        }
      }
    }
    let cancelled = false;
    (async () => {
      try {
        const acc = await fetchEmailAccounts();
        if (cancelled) return;
        setAccounts(acc);
        setAccountId((prev) => prev || (acc.find((a) => a.status === 'active') || acc[0])?.id || '');
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || 'load_failed');
      }
      try {
        const tpl = await fetchEmailTemplates(true);
        if (!cancelled) setTemplates(tpl);
      } catch {
        if (!cancelled) setTemplates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const previewSrcDoc = useMemo(() => {
    const wrapped = wrapEmailHtmlFragment(previewHtml);
    if (wrapped) return wrapped;
    const msg = t('crm.aiAssistant.emailComposer.previewEmptyStyled');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:20px;color:#94a3b8;font-size:13px;line-height:1.5}</style></head><body>${msg}</body></html>`;
  }, [previewHtml, t]);

  const parseVariables = (): Record<string, unknown> => {
    const raw = varsJson.trim();
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(t('crm.aiAssistant.emailComposer.varsInvalid'));
    }
    return data;
  };

  const mergeEntitiesIntoVariables = async (
    base: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const out = { ...base };
    if (leadId.trim()) {
      const lead = await fetchLeadById(leadId.trim());
      out.name = out.name || lead.name || '';
      out.email = out.email || lead.email || '';
      out.lead = { id: lead.id, name: lead.name, email: lead.email, phone: lead.phone, status: lead.status };
    }
    if (contactId.trim()) {
      const c = await fetchContact(contactId.trim());
      const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      out.name = out.name || full;
      out.email = out.email || c.email || '';
      out.contact = { id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone };
    }
    return out;
  };

  const applyEntityToVars = async () => {
    setActionError(null);
    try {
      const base = parseVariables();
      const merged = await mergeEntitiesIntoVariables(base);
      setVarsJson(JSON.stringify(merged, null, 2));
      if (!to.trim()) {
        const em =
          (typeof merged.email === 'string' && merged.email) ||
          (merged.lead as { email?: string } | undefined)?.email ||
          (merged.contact as { email?: string } | undefined)?.email;
        if (em) setTo(em);
      }
    } catch (e: any) {
      setActionError(e?.message || t('crm.aiAssistant.emailComposer.applyEntityFailed'));
    }
  };

  const buildStyledPayload = async () => {
    const variables = await mergeEntitiesIntoVariables(parseVariables());
    return {
      subject: subject.trim(),
      bodyText: bodyHtmlFragment.trim() ? undefined : bodyPlain.trim() || undefined,
      bodyHtml: bodyHtmlFragment.trim() || undefined,
      headline: headline.trim() || undefined,
      contactId: contactId.trim() || undefined,
      leadId: leadId.trim() || undefined,
      variables,
    };
  };

  const handlePreview = async () => {
    setActionError(null);
    setSent(false);
    if (!subject.trim()) {
      setActionError(t('crm.aiAssistant.emailComposer.subjectRequired'));
      return;
    }
    if (!bodyPlain.trim() && !bodyHtmlFragment.trim()) {
      setActionError(t('crm.aiAssistant.emailComposer.bodyRequired'));
      return;
    }
    setBusy(true);
    try {
      const base = await buildStyledPayload();
      const res = await previewStyledMail(base);
      setPreviewHtml(res.htmlBody || '');
      setView('preview');
    } catch (e: any) {
      setActionError(e?.message || 'preview_failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    setActionError(null);
    setSent(false);
    if (!accountId) {
      setActionError(t('crm.aiAssistant.emailComposer.pickAccount'));
      return;
    }
    const recipients = to
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!recipients.length) {
      setActionError(t('crm.aiAssistant.emailComposer.toRequired'));
      return;
    }
    if (!subject.trim()) {
      setActionError(t('crm.aiAssistant.emailComposer.subjectRequired'));
      return;
    }
    if (!bodyPlain.trim() && !bodyHtmlFragment.trim()) {
      setActionError(t('crm.aiAssistant.emailComposer.bodyRequired'));
      return;
    }
    setBusy(true);
    try {
      const base = await buildStyledPayload();
      await sendStyledMail({
        ...base,
        accountId,
        to: recipients,
        attachments: attachments.length
          ? attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, contentBase64: a.contentBase64 }))
          : undefined,
      });
      setSent(true);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        /* noop */
      }
    } catch (e: any) {
      setActionError(e?.message || 'send_failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = () => {
    const draft: DraftShape = {
      accountId,
      to,
      subject,
      headline,
      bodyHtmlFragment,
      contactId,
      leadId,
      varsJson,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch {
      /* noop */
    }
  };

  const insertVariable = (key: string) => {
    setEditorKey((k) => k + 1);
    setBodyHtmlFragment((prev) => `${prev || '<p></p>'}<p>{{${key}}}</p>`);
  };

  const applyTemplate = (tpl: EmailTemplate) => {
    setTemplatesOpen(false);
    if (tpl.subject) setSubject(tpl.subject);
    if (tpl.htmlBody) {
      setBodyHtmlFragment(tpl.htmlBody);
      setEditorKey((k) => k + 1);
    } else if (tpl.textBody) {
      setBodyPlain(tpl.textBody);
      setBodyHtmlFragment('');
      setEditorKey((k) => k + 1);
    }
  };

  const handleRewriteWithAi = async () => {
    const currentText = bodyPlain.trim();
    if (!currentText || rewriting) return;
    setActionError(null);
    setRewriting(true);
    try {
      let sid = rewriteSessionIdRef.current;
      if (!sid) {
        const s = await createAiSession({ title: t('crm.aiAssistant.emailComposer.title') });
        sid = s.id;
        rewriteSessionIdRef.current = sid;
      }
      const res = await postAiChat({
        sessionId: sid,
        message: `Перепиши текст письма клиенту ниже: сохрани смысл и все переменные вида {{имя}}, сделай текст яснее и вежливее, без markdown-разметки и заголовков — просто финальный текст письма с абзацами.\n\n---\n${currentText}`,
      });
      rewriteSessionIdRef.current = res.sessionId;
      const rewritten = (res.reply || '').trim();
      if (rewritten) {
        setBodyPlain(rewritten);
        setBodyHtmlFragment('');
        setEditorKey((k) => k + 1);
      }
    } catch (e: any) {
      setActionError(e?.message || 'rewrite_failed');
    } finally {
      setRewriting(false);
    }
  };

  const onFilesSelected = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setActionError(null);
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setActionError(`${file.name}: файл больше 25 МБ`);
        continue;
      }
      try {
        const contentBase64 = await fileToBase64(file);
        next.push({ filename: file.name, contentType: file.type || 'application/octet-stream', contentBase64, size: file.size });
      } catch {
        setActionError(`${file.name}: не удалось прочитать файл`);
      }
    }
    if (next.length) setAttachments((prev) => [...prev, ...next]);
  };

  const fieldCls =
    'ai-assistant-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] !text-slate-900 outline-none transition placeholder:!text-slate-400 focus:border-[#c9c3ff] focus:ring-2 focus:ring-[#5b4bec]/10';
  const labelCls = 'mb-1 block font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400';

  const fromAccount = accounts.find((a) => a.id === accountId);
  const fromLabel = fromAccount ? fromAccount.email : '—';
  const toLabel = to.trim() || '—';
  const bodyHtmlForEditor = bodyHtmlFragment || (bodyPlain ? bodyPlain.split(/\n\n+/).map((p) => `<p>${p}</p>`).join('') : '<p></p>');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2.5">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-[3px]">
          <button
            type="button"
            onClick={() => setView('editor')}
            className={`rounded-full px-3 py-[5px] text-[12px] font-medium transition ${
              view === 'editor' ? 'bg-[#0f172a] text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t('crm.aiAssistant.emailComposer.editorTab')}
          </button>
          <button
            type="button"
            onClick={() => void handlePreview()}
            className={`rounded-full px-3 py-[5px] text-[12px] font-medium transition ${
              view === 'preview' ? 'bg-[#0f172a] text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t('crm.aiAssistant.emailComposer.previewTab')}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setTemplatesOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-[#0f172a]"
            >
              <DocIcon className="h-3.5 w-3.5 text-slate-400" />
              {t('crm.aiAssistant.emailComposer.templates')}
            </button>
            {templatesOpen && (
              <div className="absolute right-0 top-full z-10 mt-1.5 max-h-64 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                {templates.length === 0 ? (
                  <div className="px-2.5 py-2 text-[12px] text-slate-400">
                    {t('crm.aiAssistant.emailComposer.noTemplates')}
                  </div>
                ) : (
                  templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="block w-full truncate rounded-lg px-2.5 py-2 text-left text-[12.5px] text-slate-800 transition hover:bg-slate-50"
                    >
                      {tpl.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-[#0f172a]"
          >
            {draftSaved ? '✓' : t('crm.aiAssistant.emailComposer.saveDraft')}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {loadError && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-900">
            {loadError}
          </div>
        )}
        {actionError && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-900">
            {actionError}
          </div>
        )}
        {sent && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
            {t('crm.aiAssistant.emailComposer.send')} ✓
          </div>
        )}

        {view === 'preview' ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="truncate border-b border-slate-100 bg-slate-50 px-3.5 py-2 font-mono text-[10px] text-slate-500">
              {fromLabel} → {toLabel}
            </div>
            <iframe
              title={t('crm.aiAssistant.emailComposer.previewTitle')}
              className="h-[420px] w-full bg-white"
              sandbox=""
              srcDoc={previewSrcDoc}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={labelCls}>{t('crm.aiAssistant.emailComposer.account')}</span>
                <div className="relative">
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-7 text-[13px] text-slate-900 outline-none focus:border-[#c9c3ff]"
                  >
                    <option value="">{t('crm.aiAssistant.emailComposer.pickAccount')}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name ? `${a.name} <${a.email}>` : a.email} · {a.status}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div>
                <span className={labelCls}>{t('crm.aiAssistant.emailComposer.to')}</span>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={fieldCls}
                  placeholder="client@example.com"
                />
              </div>
            </div>

            <div>
              <span className={labelCls}>{t('crm.aiAssistant.emailComposer.subject')}</span>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldCls} />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className={labelCls}>{t('crm.aiAssistant.emailComposer.messagePlain')}</span>
                <span className="text-[10.5px] text-slate-400">{t('crm.aiAssistant.emailComposer.messagePlainHint')}</span>
              </div>
              <EmailRichEditor
                key={editorKey}
                variant="light"
                content={bodyHtmlForEditor}
                placeholder={t('crm.aiAssistant.emailComposer.messagePlainPh')}
                onChange={(html, plain) => {
                  setBodyHtmlFragment(html === '<p></p>' ? '' : html);
                  setBodyPlain(plain);
                }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">
                  {t('crm.aiAssistant.emailComposer.variables')}
                </span>
                {VARIABLE_CHIPS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600 transition hover:border-[#0f172a] hover:text-slate-900"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={rewriting || !bodyPlain.trim()}
                  onClick={() => void handleRewriteWithAi()}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#ddd8ff] bg-[#f1efff] px-3 py-1 text-[11.5px] font-medium text-[#5b4bec] transition hover:bg-[#e9e5ff] disabled:opacity-50"
                >
                  <SparkleIcon className={`h-3 w-3 ${rewriting ? 'animate-pulse' : ''}`} />
                  {rewriting ? t('crm.aiAssistant.thinking') : t('crm.aiAssistant.emailComposer.rewriteWithAi')}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="self-start text-[11px] font-medium text-slate-400 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-900"
            >
              {showAdvanced
                ? t('crm.aiAssistant.emailComposer.hideAdvanced')
                : t('crm.aiAssistant.emailComposer.showAdvanced')}
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <span className={labelCls}>{t('crm.aiAssistant.emailComposer.headlineField')}</span>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className={fieldCls}
                    placeholder={t('crm.aiAssistant.emailComposer.headlinePlaceholder')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className={labelCls}>{t('crm.aiAssistant.emailComposer.contactId')}</span>
                    <input
                      type="text"
                      value={contactId}
                      onChange={(e) => setContactId(e.target.value)}
                      className={`${fieldCls} font-mono text-[11px]`}
                      placeholder="UUID"
                    />
                  </div>
                  <div>
                    <span className={labelCls}>{t('crm.aiAssistant.emailComposer.leadId')}</span>
                    <input
                      type="text"
                      value={leadId}
                      onChange={(e) => setLeadId(e.target.value)}
                      className={`${fieldCls} font-mono text-[11px]`}
                      placeholder="UUID"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || (!contactId.trim() && !leadId.trim())}
                  onClick={() => void applyEntityToVars()}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 text-[11.5px] font-medium text-slate-800 transition hover:border-[#0f172a] disabled:opacity-50"
                >
                  {t('crm.aiAssistant.emailComposer.fillFromEntity')}
                </button>
                <div>
                  <span className={labelCls}>{t('crm.aiAssistant.emailComposer.variablesJson')}</span>
                  <textarea
                    value={varsJson}
                    onChange={(e) => setVarsJson(e.target.value)}
                    rows={4}
                    className={`${fieldCls} font-mono text-[11px]`}
                  />
                </div>
              </div>
            )}

            <div>
              <span className={labelCls}>{t('crm.aiAssistant.emailComposer.attachments')}</span>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void onFilesSelected(e.dataTransfer.files);
                }}
                className={`flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2.5 transition ${
                  dragOver ? 'border-[#5b4bec] bg-[#f1efff]' : 'border-slate-200 bg-white'
                }`}
              >
                {attachments.map((a, i) => (
                  <span
                    key={`${a.filename}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1.5 text-[11.5px] text-slate-700"
                  >
                    <DocIcon className="h-3 w-3 text-slate-400" />
                    <span className="max-w-[160px] truncate font-medium">{a.filename}</span>
                    <span className="text-slate-400">{formatFileSize(a.size)}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <CloseIcon className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 transition hover:border-[#0f172a]"
                >
                  <PaperclipIcon className="h-3.5 w-3.5" />
                  {t('crm.aiAssistant.emailComposer.attachFile')}
                </button>
                <span className="text-[10.5px] text-slate-400">
                  {t('crm.aiAssistant.emailComposer.attachHint')}
                </span>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-3.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handlePreview()}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-800 transition hover:border-[#0f172a] disabled:opacity-50"
              >
                {t('crm.aiAssistant.emailComposer.refreshPreview')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSend()}
                className="ml-auto rounded-lg bg-[#0f172a] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-black disabled:opacity-50"
              >
                {t('crm.aiAssistant.emailComposer.send')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

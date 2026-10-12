import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiOfficeApi, type OfficeDepartment, type OfficeEvent, type OfficeTask, type OfficeTaskDetail } from '../../api/aiOffice';
import { IssueFix, fmtEur, useAgo, useNotify } from './officeShared';
import { previewStyledMail } from '../../api/email';

type Detail = OfficeTaskDetail;
type Act = Detail['actions'][number];

/** Куда ведёт результат действия агента (запись CRM или ссылка сервиса). */
export function actionHref(a: { resultUrl?: string | null; url?: string | null; targetType?: string | null; targetId?: string | null }): string | null {
  if (a.resultUrl) return a.resultUrl;
  if (a.url) return a.url;
  const id = a.targetId;
  if (!id) return null;
  switch (a.targetType) {
    case 'lead':
      return `/leads/${id}`;
    case 'project':
      return `/projects/${id}`;
    case 'contact':
      return `/contacts/${id}`;
    case 'company':
      return `/companies/${id}`;
    case 'sale':
    case 'sales':
      return `/sales/${id}`;
    default:
      return null;
  }
}

/** Поля, которые показываем человеку как «что именно уйдёт» (остальное — служебные id). */
const SHOWN = ['to', 'subject', 'textBody', 'bodyText', 'text', 'title', 'description', 'content', 'contentMd', 'body', 'status', 'dueDate', 'priority', 'startsAt', 'labels'];
const LONG = new Set(['textBody', 'bodyText', 'text', 'description', 'content', 'contentMd', 'body']);

function ActionCard({ a, taskId, onChanged }: { a: Act; taskId: string; onChanged: (d: Detail) => void }) {
  const { t } = useTranslation();
  const notify = useNotify();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; htmlBody: string } | null>(null);
  const dirty = Object.keys(draft).length > 0;
  const isEmail = /email/.test(a.actionType);
  const textKey = ['textBody', 'bodyText', 'text'].find((k) => typeof a.payload[k] === 'string') ?? 'text';
  const showPreview = async () => {
    try {
      const subject = String(draft.subject ?? a.payload.subject ?? a.title);
      const r = await previewStyledMail({ subject, bodyText: String(draft[textKey] ?? a.payload[textKey] ?? ''), leadId: typeof a.payload.leadId === 'string' ? a.payload.leadId : a.targetType === 'lead' ? a.targetId ?? undefined : undefined });
      setPreview({ subject: r.subject, htmlBody: r.htmlBody });
    } catch (e) {
      notify.error(e);
    }
  };
  const sendNow = async () => {
    const ok = await notify.confirm(t('aiOffice.drawer.sendConfirmText', { to: Array.isArray(a.payload.to) ? (a.payload.to as string[]).join(', ') : String(a.payload.to ?? '') }), { title: t('aiOffice.drawer.sendConfirmTitle'), confirmLabel: t('aiOffice.drawer.sendNow') });
    if (!ok) return;
    setSaving(true);
    try {
      onChanged(await aiOfficeApi.sendDraft(taskId, a.id, draft));
      setDraft({});
      notify.success(t('aiOffice.drawer.sentOk'));
    } catch (e) {
      notify.error(e);
    } finally {
      setSaving(false);
    }
  };
  const href = actionHref(a);
  const save = async () => {
    setSaving(true);
    try {
      onChanged(await aiOfficeApi.editAction(taskId, a.id, draft));
      setDraft({});
      notify.success(t('aiOffice.drawer.editSaved'));
    } catch (e) {
      notify.error(e);
    } finally {
      setSaving(false);
    }
  };
  const fields = SHOWN.filter((k) => a.payload[k] !== undefined && a.payload[k] !== '');
  return (
    <div className={`td-act ${a.status}`}>
      <div className="td-act-h">
        <span className={`ofp-tag ${a.status === 'executed' ? 'ok' : a.status === 'pending' ? 'warn' : a.status === 'failed' ? 'err' : ''}`}>
          <i />
          {t(`aiOffice.actStatus.${a.status}`, a.status)}
        </span>
        <b>{t(`aiOffice.actType.${a.actionType}`, a.actionType)}</b>
        {href && (href.startsWith('http') ? <a href={href} target="_blank" rel="noreferrer">{t('aiOffice.drawer.openResult')} ↗</a> : <Link to={href}>{t('aiOffice.drawer.openResult')} ↗</Link>)}
      </div>
      <div className="td-act-t">{a.title}</div>
      {a.sends && a.status === 'pending' && (
        <div className="td-send warn">
          {t('aiOffice.drawer.willSend')}
          {typeof a.payload.maxRecipients === 'number' ? ` ${t('aiOffice.drawer.upTo', { n: a.payload.maxRecipients })}` : ''}
        </div>
      )}
      {a.sendResult && (
        <div className={`td-send ${a.sendResult.failed ? 'warn' : 'ok'}`}>
          {t('aiOffice.drawer.sentResult', { sent: a.sendResult.sent, total: a.sendResult.total })}
          {a.sendResult.failed > 0 && ` · ${t('aiOffice.drawer.notDelivered', { n: a.sendResult.failed })}`}
        </div>
      )}
      {a.reason && <div className="td-act-r">{a.reason}</div>}
      {fields.map((k) => {
        const editable = a.editable.includes(k) || (!!a.sendable && ['subject', 'textBody', 'bodyText', 'text'].includes(k));
        const val = draft[k] ?? String(Array.isArray(a.payload[k]) ? (a.payload[k] as string[]).join(', ') : a.payload[k]);
        return (
          <label key={k} className="td-f">
            <span>{t(`aiOffice.field.${k}`, k)}</span>
            {editable ? (
              LONG.has(k) ? (
                <textarea className="ofp-ta" style={{ fontFamily: 'var(--of-sans)', fontSize: 13, minHeight: 110 }} value={val} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              ) : (
                <input className="ofp-in" value={val} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              )
            ) : (
              <div className={LONG.has(k) ? 'td-long' : 'td-short'}>{val}</div>
            )}
          </label>
        );
      })}
      {Array.isArray(a.payload.posts) &&
        (a.payload.posts as Array<{ publishAt?: string; channel?: string; text?: string }>).map((p, i) => {
          const k = `posts.${i}.text`;
          return (
            <label key={k} className="td-f">
              <span>
                {t('aiOffice.posts.item', { n: i + 1 })} · {p.publishAt} · {p.channel}
              </span>
              {a.status === 'pending' ? (
                <textarea className="ofp-ta" style={{ fontFamily: 'var(--of-sans)', fontSize: 13, minHeight: 90 }} value={draft[k] ?? String(p.text ?? '')} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              ) : (
                <div className="td-long">{p.text}</div>
              )}
            </label>
          );
        })}
      {a.error && <div className="td-err">{a.error}</div>}
      {a.rejectionReason && <div className="td-act-r">{t('aiOffice.drawer.rejectReason')}: {a.rejectionReason}</div>}
      {a.sentFromDraft && <div className="td-send ok">{t('aiOffice.drawer.sentByYou')}</div>}
      {a.approvedByCurator && <div className="td-send ok">{t('aiOffice.curator.approvedBy', { name: a.approvedByCurator })}{a.curatorComment ? ` — ${a.curatorComment}` : ''}</div>}
      {a.curatorNote && a.status === 'pending' && <div className="td-send warn">⚑ {a.curatorNote}</div>}
      {(a.sendable || (a.sends && a.status === 'pending')) && isEmail && (
        <div className="td-acts">
          <button className="ofp-btn" onClick={showPreview}>{t('aiOffice.drawer.preview')}</button>
          {a.sendable && <button className="ofp-btn pri" disabled={saving} onClick={sendNow}>{t('aiOffice.drawer.sendNow')}</button>}
        </div>
      )}
      {a.sendable && !isEmail && (
        <div className="td-acts">
          <button className="ofp-btn pri" disabled={saving} onClick={sendNow}>{t('aiOffice.drawer.sendNow')}</button>
        </div>
      )}
      {preview && (
        <div className="lv-backdrop td-prev-back" onClick={() => setPreview(null)}>
          <div className="td-prev" onClick={(e) => e.stopPropagation()}>
            <div className="td-prev-h">
              <b>{preview.subject}</b>
              <button className="ed-x" onClick={() => setPreview(null)}>✕</button>
            </div>
            <iframe title="preview" sandbox="" srcDoc={preview.htmlBody} />
          </div>
        </div>
      )}
      {dirty && !a.sendable && (
        <div className="td-acts">
          <button className="ofp-btn pri" disabled={saving} onClick={save}>{t('aiOffice.drawer.saveEdits')}</button>
          <button className="ofp-btn" onClick={() => setDraft({})}>{t('aiOffice.common.cancel')}</button>
        </div>
      )}
    </div>
  );
}

/** Карточка задачи: что поручено, как идёт, что получилось и что именно ждёт вашего решения. */
export function TaskDrawer({ taskId, dept, onClose, onChanged }: { taskId: string; dept?: OfficeDepartment; onClose: () => void; onChanged?: (t: OfficeTask) => void }) {
  const { t, i18n } = useTranslation();
  const notify = useNotify();
  const ago = useAgo();
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => aiOfficeApi.taskDetail(taskId).then(setD).catch((e) => notify.error(e)), [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
    const id = window.setInterval(() => !document.hidden && void load(), 4000);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', esc);
    };
  }, [load, onClose]);

  const run = async (fn: () => Promise<OfficeTask | { task: OfficeTask; errors?: string[] }>) => {
    setBusy(true);
    try {
      const r = await fn();
      const task = 'task' in r ? r.task : r;
      if ('errors' in r && r.errors?.length) notify.error(r.errors.join('; '));
      onChanged?.(task);
      await load();
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };
  const reject = async () => {
    const reason = await notify.prompt({ title: t('aiOffice.drawer.rejectTitle'), label: t('aiOffice.drawer.rejectLabel'), placeholder: t('aiOffice.drawer.rejectPh') });
    if (reason === null) return;
    await run(() => aiOfficeApi.reject(taskId, reason || undefined));
  };

  const task = d?.task;
  const pending = (d?.actions ?? []).filter((a) => a.status === 'pending');
  const others = (d?.actions ?? []).filter((a) => a.status !== 'pending');
  return (
    <div className="lv-backdrop td-back" onClick={onClose}>
      <aside className="td" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {!task ? (
          <div className="of-none">{t('aiOffice.common.loading')}</div>
        ) : (
          <>
            <div className="td-h">
              <div>
                <div className="ofp-k">
                  {dept && <i className="td-dot" style={{ background: dept.color }} />}
                  {dept?.name} · {t(`aiOffice.source.${task.source}`)} · {ago(task.createdAt)}
                </div>
                <h2>{task.title}</h2>
              </div>
              <button className="ed-x" onClick={onClose} aria-label={t('aiOffice.common.close')}>✕</button>
            </div>
            <div className="td-b">
              <div className="td-status">
                <span className={`of-pc ${task.status}`}>{task.status === 'progress' ? `${task.progress}%` : t(`aiOffice.taskStatus.${task.status}`)}</span>
                <span>
                  {task.agentTitle ? <b>{task.agentTitle}</b> : t('aiOffice.dept.unassigned')}
                  {task.status === 'progress' && <> · {t(`aiOffice.step.${task.step}`)}…</>}
                </span>
                {task.costCents > 0 && <span className="td-cost">{fmtEur(task.costCents)}</span>}
              </div>
              {task.status === 'progress' && <div className="ofp-prog"><i style={{ width: task.progress + '%' }} /></div>}

              {d?.issue && (
                <section className="td-issue">
                  <b>{d.issue.title}</b>
                  {d.issue.detail && <p>{d.issue.detail}</p>}
                  <div className="td-acts">
                    <IssueFix className="ofp-btn pri" issue={d.issue as any} onDone={() => void load()} />
                  </div>
                </section>
              )}
              {task.status === 'foreign' && (
                <section className="td-foreign">
                  <b>{t('aiOffice.drawer.foreign')}</b>
                  <p>{task.resultSummary}</p>
                </section>
              )}

              {task.details && (
                <section>
                  <span className="ofp-k">{t('aiOffice.drawer.assigned')}</span>
                  <p className="td-p">{task.details}</p>
                </section>
              )}

              {pending.length > 0 && (
                <section className="td-wait">
                  <span className="ofp-k">{t('aiOffice.drawer.waitingYou', { count: pending.length })}</span>
                  <p className="td-hint">{t('aiOffice.drawer.waitingHint')}</p>
                  {pending.map((a) => <ActionCard key={a.id} a={a} taskId={taskId} onChanged={setD} />)}
                  <div className="td-acts">
                    <button className="ofp-btn pri" disabled={busy} onClick={() => run(() => aiOfficeApi.approve(taskId))}>{t('aiOffice.drawer.approveAll')}</button>
                    <button className="ofp-btn" disabled={busy} onClick={reject}>{t('aiOffice.drawer.rejectAll')}</button>
                  </div>
                </section>
              )}

              {task.resultSummary && task.status !== 'foreign' && (
                <section>
                  <span className="ofp-k">{t('aiOffice.drawer.result')}</span>
                  <p className="td-p">{task.resultSummary}</p>
                </section>
              )}

              {task.resultReport && (
                <section>
                  <div className="td-sec-h">
                    <span className="ofp-k">{t('aiOffice.drawer.report')}</span>
                    <button
                      className="ofp-btn"
                      onClick={() => {
                        void navigator.clipboard?.writeText(task.resultReport ?? '').then(() => notify.success(t('aiOffice.drawer.copied')), () => undefined);
                      }}
                    >
                      {t('aiOffice.drawer.copy')}
                    </button>
                  </div>
                  <div className="td-report">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.resultReport}</ReactMarkdown>
                  </div>
                </section>
              )}

              {(task.dataUsed ?? []).length > 0 && (
                <section>
                  <span className="ofp-k">{t('aiOffice.drawer.data')}</span>
                  <div className="td-data">
                    {task.dataUsed!.map((u) => (
                      <span key={u.key}>
                        <b>{u.key === 'sales' ? t('aiOffice.drawer.dataSales') : u.key === 'ads' ? `${t('aiOffice.drawer.dataAds')}: ${u.label}` : u.label}</b>
                        {u.period && <em>{u.period}</em>}
                      </span>
                    ))}
                  </div>
                </section>
              )}
              {task.error && task.status !== 'done' && <div className="td-err">{task.error}</div>}

              {others.length > 0 && (
                <section>
                  <span className="ofp-k">{t('aiOffice.drawer.actions')}</span>
                  {others.map((a) => <ActionCard key={a.id} a={a} taskId={taskId} onChanged={setD} />)}
                </section>
              )}

              <section>
                <span className="ofp-k">{t('aiOffice.drawer.timeline')}</span>
                <ol className="td-tl">
                  {(d?.events ?? []).map((e: OfficeEvent) => (
                    <li key={e.id} className={e.level}>
                      <time>{new Date(e.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}</time>
                      <span>
                        {e.agentTitle && <b>{e.agentTitle}{e.toAgentTitle ? ` → ${e.toAgentTitle}` : ''}: </b>}
                        {e.text}
                      </span>
                    </li>
                  ))}
                  {(d?.events ?? []).length === 0 && <li><span>{t('aiOffice.drawer.noSteps')}</span></li>}
                </ol>
              </section>

              <div className="td-acts">
                {['failed', 'rejected', 'blocked'].includes(task.status) && <button className="ofp-btn" disabled={busy} onClick={() => run(() => aiOfficeApi.retry(taskId))}>{t('aiOffice.dept.retry')}</button>}
                {['backlog', 'blocked', 'waiting'].includes(task.status) && <button className="ofp-btn" disabled={busy} onClick={() => run(() => aiOfficeApi.cancel(taskId))}>{t('aiOffice.dept.cancel')}</button>}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

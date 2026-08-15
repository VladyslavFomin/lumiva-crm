// src/pages/esign/EsignPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchEsignDocuments,
  fetchEsignDocument,
  createEsignDocument,
  updateEsignDocument,
  deleteEsignDocument,
  sendEsignDocument,
  remindEsignDocument,
  duplicateEsignDocument,
  fetchEsignTemplates,
  createEsignTemplate,
  deleteEsignTemplate,
  searchEsignLinkOptions,
  type EsignDocumentRow,
  type EsignDocumentDetail,
  type EsignTemplate,
  type EsignLinkOption,
  type EsignLinkType,
  type EsignStatus,
} from '../../api/esign';
import { fetchContacts } from '../../api/contacts';
import type { Contact } from '../../api/contacts';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, ESN_ICON } from './EsignIcons';
import './esign-design.css';

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

const STATUS: Record<EsignStatus, { label: string; cls: string }> = {
  draft: { label: 'Черновик', cls: 'draft' },
  sent: { label: 'Отправлен', cls: 'sent' },
  viewed: { label: 'Просмотрен', cls: 'viewed' },
  signed: { label: 'Подписан', cls: 'signed' },
  declined: { label: 'Отклонён', cls: 'declined' },
  expired: { label: 'Просрочен', cls: 'expired' },
};

const KIND_OPTIONS = ['Договор', 'Счёт', 'NDA', 'Акт', 'Доверенность', 'Другое'];
const LINK_TYPE_LABEL: Record<EsignLinkType, string> = { lead: 'Лид', company: 'Компания', project: 'Проект' };
const LINK_TYPE_ROUTE: Record<EsignLinkType, string> = { lead: '/leads', company: '/companies', project: '/projects' };

const TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'draft', label: 'Черновики' },
  { key: 'sent', label: 'На подписи' },
  { key: 'signed', label: 'Подписаны' },
  { key: 'expired', label: 'Просрочены' },
];

const STEPS: Array<{ key: 'created' | 'sent' | 'viewed' | 'signed'; label: string }> = [
  { key: 'created', label: 'Создан' },
  { key: 'sent', label: 'Отправлен' },
  { key: 'viewed', label: 'Просмотрен' },
  { key: 'signed', label: 'Подписан' },
];

const TEMPLATE_PLACEHOLDER = `Настоящим подтверждается соглашение между {{tenant.name}} и {{contact.name}} от {{date}}.

Опишите условия документа здесь...`;

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

function stepDoneIndex(d: { sentAt: string | null; viewedAt: string | null; signedAt: string | null }): number {
  if (d.signedAt) return 3;
  if (d.viewedAt) return 2;
  if (d.sentAt) return 1;
  return 0;
}

export const EsignPage: React.FC = () => {
  const { showAlert, showConfirm } = useAlertModal();
  const [documents, setDocuments] = useState<EsignDocumentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EsignDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  const [templates, setTemplates] = useState<EsignTemplate[]>([]);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplKind, setTplKind] = useState('Договор');
  const [tplDesc, setTplDesc] = useState('');
  const [tplBody, setTplBody] = useState(TEMPLATE_PLACEHOLDER);
  const [savingTpl, setSavingTpl] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactId, setContactId] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('Договор');
  const [bodyTemplate, setBodyTemplate] = useState(TEMPLATE_PLACEHOLDER);
  const [entityType, setEntityType] = useState<EsignLinkType | ''>('');
  const [entitySearch, setEntitySearch] = useState('');
  const [entityOptions, setEntityOptions] = useState<EsignLinkOption[]>([]);
  const [entityId, setEntityId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadList = () => {
    setLoading(true);
    fetchEsignDocuments()
      .then(setDocuments)
      .catch((e: any) => showAlert(e?.message || 'Не удалось загрузить документы', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  const loadTemplates = () => {
    fetchEsignTemplates().then(setTemplates).catch(() => {});
  };

  useEffect(() => {
    loadList();
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetchEsignDocument(selectedId)
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (!showForm) return;
    fetchContacts({ search: contactSearch || undefined, limit: 10 })
      .then((res) => setContacts(res.items))
      .catch(() => {});
  }, [showForm, contactSearch]);

  useEffect(() => {
    if (!entityType) {
      setEntityOptions([]);
      return;
    }
    searchEsignLinkOptions(entityType, entitySearch).then(setEntityOptions).catch(() => {});
  }, [entityType, entitySearch]);

  const filtered = useMemo(
    () =>
      documents.filter((d) => {
        if (tab === 'sent' && !(d.status === 'sent' || d.status === 'viewed')) return false;
        if (tab !== 'all' && tab !== 'sent' && d.status !== tab) return false;
        if (q && !d.title.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [documents, tab, q],
  );

  const tabCount = (key: string) => {
    if (key === 'all') return documents.length;
    if (key === 'sent') return documents.filter((d) => d.status === 'sent' || d.status === 'viewed').length;
    return documents.filter((d) => d.status === key).length;
  };

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const counts = {
    total: documents.length,
    pending: documents.filter((d) => d.status === 'sent' || d.status === 'viewed').length,
    signed30: documents.filter((d) => d.status === 'signed' && d.signedAt && new Date(d.signedAt).getTime() >= thirtyDaysAgo).length,
    expired: documents.filter((d) => d.status === 'expired').length,
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setKind('Договор');
    setBodyTemplate(TEMPLATE_PLACEHOLDER);
    setContactId('');
    setContactSearch('');
    setEntityType('');
    setEntityId('');
    setEntitySearch('');
  };

  const useTemplate = (t: EsignTemplate) => {
    setEditingId(null);
    setShowForm(true);
    setTitle(t.name);
    setKind(t.kind);
    setBodyTemplate(t.bodyTemplate);
    setContactId('');
    setContactSearch('');
    setEntityType('');
    setEntityId('');
    setEntitySearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditStart = (doc: EsignDocumentDetail) => {
    setEditingId(doc.id);
    setTitle(doc.title);
    setKind(doc.kind);
    setBodyTemplate(doc.bodyText);
    setContactId(doc.contactId || '');
    setContactSearch('');
    setEntityType((doc.entityType as EsignLinkType) || '');
    setEntityId(doc.entityId || '');
    setEntitySearch('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !bodyTemplate.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await updateEsignDocument(editingId, {
          title: title.trim(),
          kind,
          bodyText: bodyTemplate.trim(),
          contactId: contactId || null,
          entityType: entityType || null,
          entityId: entityType && entityId ? entityId : null,
        });
        setShowForm(false);
        resetForm();
        loadList();
        setDetail(updated);
        setSelectedId(updated.id);
      } else {
        const doc = await createEsignDocument({
          contactId: contactId || undefined,
          title: title.trim(),
          bodyTemplate: bodyTemplate.trim(),
          kind,
          entityType: entityType || undefined,
          entityId: entityType && entityId ? entityId : undefined,
        });
        setShowForm(false);
        resetForm();
        loadList();
        setSelectedId(doc.id);
      }
    } catch (e: any) {
      showAlert(e?.message || (editingId ? 'Не удалось сохранить изменения' : 'Не удалось создать документ'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const ok = await showConfirm('Черновик и его PDF будут удалены без возможности восстановления.', {
      title: 'Удалить документ?',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteEsignDocument(selectedId);
      setSelectedId(null);
      setDetail(null);
      loadList();
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось удалить документ', { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleSend = async () => {
    if (!selectedId) return;
    setSending(true);
    try {
      const fresh = await sendEsignDocument(selectedId);
      setDetail(fresh);
      loadList();
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось отправить документ', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleRemind = async () => {
    if (!selectedId) return;
    setReminding(true);
    try {
      const fresh = await remindEsignDocument(selectedId);
      setDetail(fresh);
      loadList();
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось отправить напоминание', { variant: 'error' });
    } finally {
      setReminding(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedId) return;
    setDuplicating(true);
    try {
      const copy = await duplicateEsignDocument(selectedId);
      loadList();
      setSelectedId(copy.id);
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось дублировать документ', { variant: 'error' });
    } finally {
      setDuplicating(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim() || !tplBody.trim()) return;
    setSavingTpl(true);
    try {
      await createEsignTemplate({ name: tplName.trim(), description: tplDesc.trim() || undefined, kind: tplKind, bodyTemplate: tplBody.trim() });
      setShowNewTemplate(false);
      setTplName('');
      setTplDesc('');
      setTplKind('Договор');
      setTplBody(TEMPLATE_PLACEHOLDER);
      loadTemplates();
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось сохранить шаблон', { variant: 'error' });
    } finally {
      setSavingTpl(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const ok = await showConfirm('Удалить шаблон? Действие необратимо.', {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEsignTemplate(id);
      loadTemplates();
    } catch (e: any) {
      showAlert(e?.message || 'Не удалось удалить шаблон', { variant: 'error' });
    }
  };

  const sel = detail;

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="esn-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              ХРАНИЛИЩЕ ДОКУМЕНТОВ
            </div>
            <h1>Подпись документов</h1>
            <p className="sub">Составляйте документы, отправляйте на подпись по email и прикрепляйте к лидам, компаниям и проектам.</p>
          </div>
          <div className="esn-hero-r">
            <button type="button" className="btn btn-sm" onClick={() => document.getElementById('esn-templates-section')?.scrollIntoView({ behavior: 'smooth' })}>
              <Ic d={ESN_ICON.doc} size={13} />
              Шаблоны
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowForm((v) => !v);
                if (!showForm) resetForm();
              }}
            >
              <Ic d={ESN_ICON.plus} size={13} />
              {showForm ? 'Отмена' : 'Создать документ'}
            </button>
          </div>
        </div>

        <div className="esn-kpis">
          <div className="esn-kpi">
            <div className="l">Всего документов</div>
            <div className="v">{counts.total}</div>
            <div className="d">во всех статусах</div>
          </div>
          <div className="esn-kpi">
            <div className="l">Ожидают подписи</div>
            <div className="v">{counts.pending}</div>
            <div className="d warn">отправлены, ответ не получен</div>
          </div>
          <div className="esn-kpi">
            <div className="l">Подписано</div>
            <div className="v">{counts.signed30}</div>
            <div className="d up">за последние 30 дней</div>
          </div>
          <div className="esn-kpi">
            <div className="l">Просрочено</div>
            <div className="v">{counts.expired}</div>
            <div className="d warn">ссылка истекла без ответа</div>
          </div>
        </div>

        {showForm && (
          <form className="esn-panel" onSubmit={handleCreate}>
            {editingId && (
              <div className="kicker" style={{ marginBottom: 12 }}>
                <span className="dot" />
                РЕДАКТИРОВАНИЕ ЧЕРНОВИКА
              </div>
            )}
            <div className="esn-row2">
              <div className="esn-field">
                <span className="l">Название документа</span>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Договор оказания услуг №…" required />
              </div>
              <div className="esn-field">
                <span className="l">Тип документа</span>
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {KIND_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="esn-row2">
              <div className="esn-field">
                <span className="l">Контакт-подписант</span>
                <input type="text" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Поиск контакта…" />
                <select value={contactId} onChange={(e) => setContactId(e.target.value)} style={{ marginTop: 4 }}>
                  <option value="">Без привязки к контакту</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ')} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="esn-field">
                <span className="l">Привязка к записи CRM</span>
                <select
                  value={entityType}
                  onChange={(e) => {
                    setEntityType(e.target.value as EsignLinkType | '');
                    setEntityId('');
                    setEntitySearch('');
                  }}
                >
                  <option value="">Без привязки</option>
                  <option value="lead">Лид</option>
                  <option value="company">Компания</option>
                  <option value="project">Проект</option>
                </select>
                {entityType && (
                  <>
                    <input
                      type="text"
                      value={entitySearch}
                      onChange={(e) => setEntitySearch(e.target.value)}
                      placeholder={`Поиск: ${LINK_TYPE_LABEL[entityType].toLowerCase()}…`}
                      style={{ marginTop: 4 }}
                    />
                    <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ marginTop: 4 }}>
                      <option value="">— выберите —</option>
                      {entityOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>

            <div className="esn-field">
              <span className="l">Текст документа</span>
              <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} rows={8} required />
            </div>
            {editingId ? (
              <div className="esn-hint">Текст уже подставлен — плейсхолдеры вида {'{{contact.name}}'} здесь больше не заменяются автоматически.</div>
            ) : (
              <div className="esn-hint">
                Плейсхолдеры: <code>{'{{contact.name}}'}</code> <code>{'{{contact.email}}'}</code> <code>{'{{tenant.name}}'}</code> <code>{'{{date}}'}</code>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Сохраняем…' : editingId ? 'Сохранить изменения' : 'Создать (сгенерирует PDF)'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Отмена
                </button>
              )}
            </div>
          </form>
        )}

        <div className="view-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={cx('view-tab', tab === t.key && 'active')} onClick={() => setTab(t.key)}>
              {t.label}
              <span className="badge">{tabCount(t.key)}</span>
            </button>
          ))}
          <div className="toolbar-spacer" />
          <div className="tb-search" style={{ width: 220 }}>
            <Ic d={ESN_ICON.search} size={13} />
            <input placeholder="Найти документ…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="ds-layout">
          <div className="ds-list">
            {loading && <div className="ds-empty">Загрузка…</div>}
            {!loading && filtered.length === 0 && <div className="ds-empty">{documents.length === 0 ? 'Пока нет документов' : 'Ничего не найдено'}</div>}
            {!loading &&
              filtered.map((d) => (
                <div key={d.id} className={cx('ds-doc', selectedId === d.id && 'active')} onClick={() => setSelectedId(d.id)}>
                  <div className="ds-doc-top">
                    <div className="ds-doc-title">{d.title}</div>
                    <span className={cx('ds-status', STATUS[d.status].cls)}>{STATUS[d.status].label}</span>
                  </div>
                  <div className="ds-doc-link">
                    {d.entityLabel ? `${LINK_TYPE_LABEL[d.entityType as EsignLinkType]} · ${d.entityLabel}` : d.contactName || 'Без привязки'}
                  </div>
                  <div className="ds-doc-foot">
                    <span>{d.pageCount} стр.</span>
                    <span className="sep">·</span>
                    <span>{fmtDate(d.createdAt)}</span>
                  </div>
                </div>
              ))}
          </div>

          <div className="ds-detail">
            {!selectedId && (
              <div className="ds-empty" style={{ margin: 'auto' }}>
                Выберите документ
              </div>
            )}
            {selectedId && detailLoading && (
              <div className="ds-empty" style={{ margin: 'auto' }}>
                Загрузка…
              </div>
            )}
            {sel && !detailLoading && (
              <>
                <div className="ds-detail-head">
                  <div>
                    <div className="ds-detail-kind">{sel.kind}</div>
                    <h2>{sel.title}</h2>
                    <div className="ds-detail-link">
                      {sel.entityType && sel.entityLabel ? (
                        <>
                          {LINK_TYPE_LABEL[sel.entityType]} ·{' '}
                          <Link to={`${LINK_TYPE_ROUTE[sel.entityType]}/${sel.entityId}`}>{sel.entityLabel}</Link>
                        </>
                      ) : (
                        'Без привязки к лиду, компании или проекту'
                      )}
                    </div>
                  </div>
                  <span className={cx('ds-status', 'lg', STATUS[sel.status].cls)}>{STATUS[sel.status].label}</span>
                </div>

                {!sel.signerEmail && sel.status === 'draft' && (
                  <div className="esn-alert warn" style={{ marginTop: 14 }}>
                    У документа нет email получателя — привяжите контакт с email, чтобы отправить.
                  </div>
                )}
                {sel.signedAt && (
                  <div className="esn-alert ok" style={{ marginTop: 14 }}>
                    Подписано {sel.signerName} · {fmtDate(sel.signedAt)}
                  </div>
                )}

                <div className="ds-detail-body">
                  <div className="ds-preview">
                    <div className="ds-preview-page">
                      <div className="txt">{sel.bodyText}</div>
                    </div>
                    <div className="ds-preview-foot">{sel.pageCount} стр. · PDF</div>
                  </div>

                  <div className="ds-side">
                    <div className="ds-timeline">
                      {STEPS.map((s, i) => {
                        const doneIdx = stepDoneIndex(sel);
                        const isWarn = (sel.status === 'expired' || sel.status === 'declined') && i === doneIdx + 1;
                        const time = s.key === 'created' ? sel.createdAt : s.key === 'sent' ? sel.sentAt : s.key === 'viewed' ? sel.viewedAt : sel.signedAt;
                        return (
                          <div key={s.key} className={cx('ds-tl-step', i <= doneIdx && 'done', isWarn && 'warn')}>
                            <span className="ds-tl-dot">
                              <Ic d={ESN_ICON.check} size={10} />
                            </span>
                            <span className="ds-tl-label">{s.label}</span>
                            <span className="ds-tl-time">{time ? fmtDate(time) : '—'}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="ds-meta">
                      <div className="ds-meta-row">
                        <span className="l">Подписант</span>
                        <span className="v">{sel.signerName || sel.contactName || '—'}</span>
                      </div>
                      {sel.signerEmail && (
                        <div className="ds-meta-row">
                          <span className="l">Email</span>
                          <span className="v mono">{sel.signerEmail}</span>
                        </div>
                      )}
                      <div className="ds-meta-row">
                        <span className="l">Создан</span>
                        <span className="v">{fmtDate(sel.createdAt)}</span>
                      </div>
                    </div>

                    <div className="ds-actions">
                      {sel.status === 'draft' && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending || !sel.signerEmail}>
                          <Ic d={ESN_ICON.sign} size={13} />
                          {sending ? 'Отправляем…' : 'Отправить на подпись'}
                        </button>
                      )}
                      {sel.status === 'draft' && (
                        <button type="button" className="btn btn-sm" onClick={() => handleEditStart(sel)}>
                          <Ic d={ESN_ICON.pencil} size={13} />
                          Редактировать
                        </button>
                      )}
                      {(sel.status === 'sent' || sel.status === 'viewed' || sel.status === 'expired') && (
                        <button type="button" className="btn btn-sm" onClick={handleRemind} disabled={reminding}>
                          <Ic d={ESN_ICON.email} size={13} />
                          {reminding ? 'Отправляем…' : sel.status === 'expired' ? 'Отправить повторно' : 'Напомнить подписанту'}
                        </button>
                      )}
                      {sel.draftPdfUrl && (
                        <a className="btn btn-sm" href={sel.draftPdfUrl} target="_blank" rel="noreferrer">
                          <Ic d={ESN_ICON.download} size={13} />
                          Черновик PDF
                        </a>
                      )}
                      {sel.signedPdfUrl && (
                        <a className="btn btn-sm" href={sel.signedPdfUrl} target="_blank" rel="noreferrer">
                          <Ic d={ESN_ICON.download} size={13} />
                          Подписанный PDF
                        </a>
                      )}
                      <button type="button" className="btn btn-sm" onClick={handleDuplicate} disabled={duplicating}>
                        <Ic d={ESN_ICON.copy} size={13} />
                        {duplicating ? 'Дублируем…' : 'Дублировать'}
                      </button>
                      {sel.status === 'draft' && (
                        <button type="button" className="btn btn-sm btn-danger" onClick={handleDelete} disabled={deleting}>
                          <Ic d={ESN_ICON.trash} size={13} />
                          {deleting ? 'Удаляем…' : 'Удалить'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="ha-section" id="esn-templates-section">
          <div className="ha-section-head">
            <div>
              <h3>
                <Ic d={ESN_ICON.doc} size={15} />
                Шаблоны документов
              </h3>
              <div className="sub">Начните новый документ с готового шаблона — текст и тип уже настроены.</div>
            </div>
          </div>
          <div className="ds-templates">
            {templates.map((t) => (
              <div key={t.id} className="ds-template" onClick={() => useTemplate(t)}>
                <button
                  type="button"
                  className="del"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTemplate(t.id);
                  }}
                  title="Удалить шаблон"
                >
                  <Ic d={ESN_ICON.trash} size={11} />
                </button>
                <span className="ic">
                  <Ic d={ESN_ICON.doc} size={15} />
                </span>
                <div className="nm">{t.name}</div>
                <div className="desc">{t.description || t.kind}</div>
                <span className="use">Создать →</span>
              </div>
            ))}
            <div className="ds-template-add" onClick={() => setShowNewTemplate((v) => !v)}>
              <Ic d={ESN_ICON.plus} size={16} />
              Новый шаблон
            </div>
          </div>

          {showNewTemplate && (
            <form className="esn-panel" style={{ marginTop: 14, marginBottom: 0 }} onSubmit={handleSaveTemplate}>
              <div className="esn-row2">
                <div className="esn-field">
                  <span className="l">Название шаблона</span>
                  <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Договор оказания услуг" required />
                </div>
                <div className="esn-field">
                  <span className="l">Тип документа</span>
                  <select value={tplKind} onChange={(e) => setTplKind(e.target.value)}>
                    {KIND_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="esn-field">
                <span className="l">Описание</span>
                <input type="text" value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} placeholder="Короткое описание для карточки шаблона" />
              </div>
              <div className="esn-field">
                <span className="l">Текст шаблона</span>
                <textarea value={tplBody} onChange={(e) => setTplBody(e.target.value)} rows={6} required />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingTpl}>
                  {savingTpl ? 'Сохраняем…' : 'Сохранить шаблон'}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setShowNewTemplate(false)}>
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default EsignPage;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  createEmbedForm,
  deleteEmbedForm,
  fetchEmbedForms,
  updateEmbedForm,
  EMBED_FORM_KINDS,
  type EmbedFieldConfigItem,
  type EmbedFormRow,
  type EmbedFormKind,
} from '../../api/embedForms';
import { withTimeout, DEFAULT_FETCH_TIMEOUT_MS } from '../../utils/withTimeout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import './WebForms.css';

const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

const KIND_META: Record<EmbedFormKind, { label: string; description: string }> = {
  lead: { label: 'Заявка (лид)', description: 'Классическая форма — заполненные поля попадают в CRM как лид.' },
  product_order: { label: 'Заказ товаров', description: 'Клиент выбирает товары из вашего каталога — заказ попадает в Продажи.' },
  booking: { label: 'Запись на услугу', description: 'Клиент выбирает услугу и время — заявка попадает в Бронирования.' },
  hotel_reservation: { label: 'Бронирование отеля', description: 'Клиент выбирает отель, номер и даты — бронь попадает в Систему резервации.' },
};

const FALLBACK_DESIGN = {
  backgroundColor: '#ffffff',
  textColor: '#111827',
  fieldBackground: '#f9fafb',
  borderColor: '#e5e7eb',
  buttonBackground: '#111827',
  buttonTextColor: '#ffffff',
};

const TEXTISH_TYPES = new Set([
  'text', 'email', 'url', 'tel', 'number', 'date', 'time', 'datetime', 'range', 'rating', 'guests', 'promo_code',
]);
const CHOICE_TYPES = new Set(['select', 'radio', 'multi_checkbox', 'service', 'specialist']);
const COMPOSITE_TYPES = new Set(['product_cart', 'service_booking', 'hotel_booking']);

function PreviewField({ f, design }: { f: EmbedFieldConfigItem; design: Record<string, unknown> }) {
  const d = { ...FALLBACK_DESIGN, ...design } as Record<string, string>;
  if (TEXTISH_TYPES.has(f.type)) {
    return (
      <div className="lv-embed-pv-field">
        <div className="lv-embed-pv-label" style={{ color: d.textColor }}>{f.label}</div>
        <div className="lv-embed-pv-input" style={{ background: d.fieldBackground, border: `1px solid ${d.borderColor}`, color: d.textColor, opacity: 0.55 }}>
          {f.placeholder || '—'}
        </div>
      </div>
    );
  }
  if (f.type === 'textarea' || f.type === 'html') {
    return (
      <div className="lv-embed-pv-field">
        <div className="lv-embed-pv-label" style={{ color: d.textColor }}>{f.label}</div>
        <div className="lv-embed-pv-ta" style={{ background: d.fieldBackground, border: `1px solid ${d.borderColor}` }} />
      </div>
    );
  }
  if (CHOICE_TYPES.has(f.type)) {
    const opts = (f.options && f.options.length ? f.options : [{ value: 'opt1', label: 'Вариант 1' }, { value: 'opt2', label: 'Вариант 2' }]).slice(0, 3);
    return (
      <div className="lv-embed-pv-field">
        <div className="lv-embed-pv-label" style={{ color: d.textColor }}>{f.label}</div>
        <div className="lv-embed-pv-choice">
          {opts.map((o, i) => (
            <span key={i} className="lv-embed-pv-chip" style={{ background: d.fieldBackground, border: `1px solid ${d.borderColor}`, color: d.textColor }}>
              {o.label || o.value}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (f.type === 'checkbox' || f.type === 'checkbox_consent') {
    return (
      <div className="lv-embed-pv-field lv-embed-pv-check">
        <span className="box" style={{ border: `1px solid ${d.borderColor}` }} />
        <span style={{ color: d.textColor }}>{f.label}</span>
      </div>
    );
  }
  if (COMPOSITE_TYPES.has(f.type)) {
    return (
      <div className="lv-embed-pv-field lv-embed-pv-composite" style={{ borderColor: d.borderColor, color: d.textColor }}>
        {f.label}
      </div>
    );
  }
  return null;
}

function MiniPreview({ row }: { row: EmbedFormRow }) {
  const d = { ...FALLBACK_DESIGN, ...(row.design || {}) } as Record<string, string>;
  const fields = row.fieldConfig?.fields || [];
  return (
    <div className="lv-embed-mini">
      <div className="lv-embed-mini-inner" style={{ background: d.backgroundColor }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: d.textColor }}>{row.name}</div>
        {fields.map((f, i) => <PreviewField key={f.id || i} f={f} design={d} />)}
        <div className="lv-embed-pv-btn" style={{ background: d.buttonBackground, color: d.buttonTextColor }}>
          Отправить
        </div>
      </div>
    </div>
  );
}

export const WebFormsListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const navigate = useNavigate();
  const [rows, setRows] = useState<EmbedFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | EmbedFormKind>('all');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    withTimeout(
      fetchEmbedForms(),
      DEFAULT_FETCH_TIMEOUT_MS,
      'embed forms list',
    )
      .then((r) => {
        setRows(r);
        setSelId((prev) => prev && r.some((x) => x.id === prev) ? prev : (r[0]?.id ?? null));
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : t('crm.embedForms.list.loadError')),
      )
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const fmtDate = useCallback((iso: string) => {
    try {
      return new Intl.DateTimeFormat(i18n.language || 'ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    } catch {
      return iso;
    }
  }, [i18n.language]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (tab !== 'all' && r.kind !== tab) return false;
    if (q && !r.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, tab, q]);

  const sel = rows.find((r) => r.id === selId) || filtered[0];

  const kpis = {
    total: rows.length,
    published: rows.filter((r) => r.published).length,
    draft: rows.filter((r) => !r.published).length,
    sites: new Set(rows.map((r) => r.siteId)).size,
  };

  const onDelete = async (id: string) => {
    const ok = await showConfirm(t('crm.embedForms.list.deleteConfirm'), {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    setDeleting(id);
    try {
      await deleteEmbedForm(id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showAlert(msg, { variant: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const onDuplicate = async (row: EmbedFormRow) => {
    setDuplicating(row.id);
    try {
      const dup = await createEmbedForm({
        siteId: row.siteId,
        kind: row.kind,
        templateKey: row.kind === 'lead' ? row.templateKey : undefined,
        name: `${row.name} (копия)`,
      });
      await updateEmbedForm(dup.id, {
        fieldConfig: row.fieldConfig as unknown as Record<string, unknown>,
        design: row.design,
        successMessage: row.successMessage,
        privacyPolicyUrl: row.privacyPolicyUrl,
      });
      navigate(`/web-forms/${dup.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showAlert(msg, { variant: 'error' });
    } finally {
      setDuplicating(null);
    }
  };

  const copyEmbed = (row: EmbedFormRow) => {
    const url = `${window.location.origin}/embed/${row.publicId}`;
    const code = `<iframe id="lumiva-form-${row.publicId}" title="${row.name}" src="${url}" width="100%" height="700" style="border:0;width:100%" loading="lazy"></iframe>`;
    try {
      navigator.clipboard.writeText(code);
    } catch {
      // ignore
    }
  };

  return (
    <MainLayout>
      <div className="lv-embed-page w-full min-w-0 max-w-none px-2 sm:px-4 md:px-6 lg:px-8 py-6 md:py-8 pb-16">
        <div className="lv-embed-hero">
          <div>
            <div className="lv-embed-kicker"><span className="dot" />{t('crm.embedForms.kicker')}</div>
            <h1>{t('crm.embedForms.list.title')}</h1>
            <p className="lv-embed-sub" style={{ maxWidth: 620 }}>{t('crm.embedForms.list.subtitle')}</p>
          </div>
          <div className="lv-embed-hero-r">
            <button type="button" onClick={() => navigate('/web-forms/new')} className="lv-embed-btn lv-embed-btn--primary">
              + {t('crm.embedForms.list.create')}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 my-4">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500 mt-4">{t('crm.embedForms.list.loading')}</p>
        ) : rows.length === 0 ? (
          <div className="lv-embed-empty" style={{ border: '1px solid var(--line-2)', borderRadius: 14, background: '#fff', marginTop: 16 }}>
            {t('crm.embedForms.list.empty')}
          </div>
        ) : (
          <React.Fragment>
            <div className="lv-embed-kpis">
              <div className="lv-embed-kpi"><div className="l">Всего форм</div><div className="v">{kpis.total}</div><div className="d">во всех статусах</div></div>
              <div className="lv-embed-kpi"><div className="l">Опубликовано</div><div className="v">{kpis.published}</div><div className="d">на сайтах клиентов</div></div>
              <div className="lv-embed-kpi"><div className="l">Черновиков</div><div className="v">{kpis.draft}</div><div className="d">ждут публикации</div></div>
              <div className="lv-embed-kpi"><div className="l">Сайтов подключено</div><div className="v">{kpis.sites}</div><div className="d">уникальных доменов</div></div>
            </div>

            <div className="lv-embed-viewtabs">
              <button type="button" className={cx('lv-embed-viewtab', tab === 'all' && 'is-active')} onClick={() => setTab('all')}>
                Все<span className="badge">{rows.length}</span>
              </button>
              {EMBED_FORM_KINDS.map((k) => (
                <button key={k} type="button" className={cx('lv-embed-viewtab', tab === k && 'is-active')} onClick={() => setTab(k)}>
                  {KIND_META[k].label}<span className="badge">{rows.filter((r) => r.kind === k).length}</span>
                </button>
              ))}
              <div className="lv-embed-toolbar-spacer" />
            </div>
            <div className="lv-embed-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
              <input placeholder="Найти форму…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            <div className="lv-embed-layout">
              <div className="lv-embed-list">
                {filtered.length === 0 && <div className="lv-embed-empty">Ничего не найдено</div>}
                {filtered.map((r) => (
                  <div key={r.id} className={cx('lv-embed-row', sel && r.id === sel.id && 'is-active')} onClick={() => setSelId(r.id)}>
                    <div className="lv-embed-row-top">
                      <div className="lv-embed-row-name">{r.name}</div>
                      <span className={cx('lv-embed-pub', r.published ? 'on' : 'off')}>
                        <span className="dot" />{r.published ? t('crm.embedForms.list.published') : t('crm.embedForms.list.draft')}
                      </span>
                    </div>
                    <div className="lv-embed-row-meta">
                      <span className={cx('lv-embed-kindtag', r.kind)}>{KIND_META[r.kind].label}</span>
                      <span>{r.site?.domain || r.siteId}</span>
                    </div>
                    <div className="lv-embed-row-foot">
                      <span>обновлена {fmtDate(r.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lv-embed-detail">
                {!sel && <div className="lv-embed-empty" style={{ margin: 'auto' }}>Выберите форму</div>}
                {sel && (
                  <React.Fragment>
                    <div className="lv-embed-detail-head">
                      <div>
                        <span className={cx('lv-embed-kindtag', 'lg', sel.kind)}>{KIND_META[sel.kind].label}</span>
                        <h2>{sel.name}</h2>
                        <div className="lv-embed-detail-sub">{sel.site?.domain || sel.siteId}{sel.templateKey ? ` · шаблон «${sel.templateKey}»` : ''}</div>
                      </div>
                      <span className={cx('lv-embed-pub', 'lg', sel.published ? 'on' : 'off')}>
                        <span className="dot" />{sel.published ? t('crm.embedForms.list.published') : t('crm.embedForms.list.draft')}
                      </span>
                    </div>

                    <div className="lv-embed-detail-body">
                      <MiniPreview row={sel} />

                      <div className="lv-embed-side">
                        <div className="lv-embed-meta">
                          <div className="lv-embed-meta-row"><span className="l">Сайт</span><span className="v">{sel.site?.domain || sel.siteId}</span></div>
                          <div className="lv-embed-meta-row"><span className="l">ID формы</span><span className="v mono">{sel.publicId}</span></div>
                          <div className="lv-embed-meta-row"><span className="l">Создана</span><span className="v">{fmtDate(sel.createdAt)}</span></div>
                          <div className="lv-embed-meta-row"><span className="l">Полей в форме</span><span className="v">{sel.fieldConfig?.fields?.length || 0}</span></div>
                        </div>

                        <div className="lv-embed-embedrow">
                          <span>&lt;iframe src=".../embed/{sel.publicId}"&gt;</span>
                          <button type="button" onClick={() => copyEmbed(sel)}>Копировать</button>
                        </div>

                        <div className="lv-embed-detail-actions">
                          <button type="button" className="lv-embed-btn lv-embed-btn--primary" onClick={() => navigate(`/web-forms/${sel.id}`)}>
                            {t('crm.embedForms.list.edit')}
                          </button>
                          <button type="button" className="lv-embed-btn" disabled={duplicating === sel.id} onClick={() => onDuplicate(sel)}>
                            {duplicating === sel.id ? '…' : 'Дублировать'}
                          </button>
                          <button type="button" className="lv-embed-btn is-danger" disabled={deleting === sel.id} onClick={() => onDelete(sel.id)}>
                            {t('crm.embedForms.list.delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>
          </React.Fragment>
        )}

        <div className="lv-embed-section">
          <div className="lv-embed-section-head">
            <h3>Типы форм</h3>
            <div className="lv-embed-sub">Каждый тип автоматически направляет заявку в нужный модуль CRM.</div>
          </div>
          <div className="lv-embed-kinds-grid">
            {EMBED_FORM_KINDS.map((k) => (
              <a key={k} className="lv-embed-kind-card" href={`/web-forms/new?kind=${k}`} onClick={(e) => { e.preventDefault(); navigate(`/web-forms/new?kind=${k}`); }}>
                <div className="nm">{KIND_META[k].label}</div>
                <div className="desc">{KIND_META[k].description}</div>
                <span className="go">Создать →</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

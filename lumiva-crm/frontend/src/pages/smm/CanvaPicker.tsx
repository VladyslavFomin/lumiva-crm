/** Выбор из Canva: свои дизайны (экспорт в пост) или брендовый шаблон (автозаполнение полями поста). */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { contentApi, type CanvaDesign, type CanvaTemplate } from '../../api/content';
import { IC, Ico } from './smmShared';

type Props = {
  mode: 'designs' | 'templates';
  /** подсказки для полей шаблона: заголовок и текст поста */
  defaults: { title: string; text: string };
  busy: boolean;
  onClose: () => void;
  onPickDesign: (designId: string) => void;
  onAutofill: (templateId: string, fields: Record<string, string>) => void;
};

export function CanvaPicker({ mode, defaults, busy, onClose, onPickDesign, onAutofill }: Props) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.smm2.canva.${key}`, o) as string;
  const [query, setQuery] = useState('');
  const [designs, setDesigns] = useState<CanvaDesign[]>([]);
  const [templates, setTemplates] = useState<CanvaTemplate[]>([]);
  const [cont, setCont] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tpl, setTpl] = useState<CanvaTemplate | null>(null);
  const [fields, setFields] = useState<Array<{ name: string; type: string }> | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const load = async (q: string, more?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'designs') {
        const r = await contentApi.canvaDesigns(q, more || undefined);
        setDesigns((x) => (more ? [...x, ...r.items] : r.items));
        setCont(r.continuation);
      } else {
        setTemplates(await contentApi.canvaTemplates(q));
      }
    } catch (e: any) {
      setError(e?.message || k('loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load('');
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickTemplate = async (x: CanvaTemplate) => {
    setTpl(x);
    setFields(null);
    try {
      const f = await contentApi.canvaTemplateFields(x.id);
      setFields(f);
      // текстовые поля по порядку: первое — заголовок поста, второе — начало текста
      const texts = f.filter((y) => y.type === 'text');
      const init: Record<string, string> = {};
      texts.forEach((y, i) => {
        init[y.name] = i === 0 ? defaults.title || defaults.text.split('\n')[0] || '' : i === 1 ? defaults.text.slice(0, 220) : '';
      });
      setValues(init);
    } catch (e: any) {
      setError(e?.message || k('loadError'));
    }
  };

  return createPortal(
    <div className="sc-back lv-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sc-cv lv-dialog" role="dialog" aria-modal="true">
        <header className="sc-cv-hd">
          <b>{mode === 'designs' ? k('designsTitle') : k('templatesTitle')}</b>
          <button type="button" className="btn-icon" aria-label={k('close')} onClick={onClose} disabled={busy}>
            <Ico d={IC.x} size={14} />
          </button>
        </header>

        {tpl && fields ? (
          <div className="sc-cv-body">
            <p className="sc-hint">{k('fillHint', { name: tpl.title || '' })}</p>
            {fields.filter((f) => f.type === 'text').map((f) => (
              <label key={f.name} className="sc-cv-field">
                <span>{f.name}</span>
                <textarea className="sc-in" rows={2} value={values[f.name] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
              </label>
            ))}
            {fields.some((f) => f.type === 'image') ? <p className="sc-hint">{k('imagesFromPost')}</p> : null}
            <div className="sc-cv-ft">
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setTpl(null)}>
                {k('back')}
              </button>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => onAutofill(tpl.id, values)}>
                {busy ? k('making') : k('make')}
              </button>
            </div>
          </div>
        ) : (
          <div className="sc-cv-body">
            <form
              className="sc-cv-search"
              onSubmit={(e) => {
                e.preventDefault();
                void load(query);
              }}
            >
              <input className="sc-in" value={query} placeholder={k('search')} onChange={(e) => setQuery(e.target.value)} />
              <button type="submit" className="btn-secondary" disabled={loading}>
                {k('find')}
              </button>
            </form>
            {error ? <p className="sc-hint sc-err-t">{error}</p> : null}
            <div className="sc-cv-grid">
              {(mode === 'designs' ? designs : templates).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="sc-cv-item"
                  disabled={busy}
                  onClick={() => (mode === 'designs' ? onPickDesign(d.id) : void pickTemplate(d as CanvaTemplate))}
                >
                  {d.thumbnail ? <img src={d.thumbnail} alt="" loading="lazy" /> : <span className="ph" />}
                  <span className="tx">{d.title || k('untitled')}</span>
                  {mode === 'designs' && Number((d as CanvaDesign).pages || 0) > 1 ? <span className="n">{k('pages', { count: Number((d as CanvaDesign).pages) })}</span> : null}
                </button>
              ))}
            </div>
            {!loading && !error && !(mode === 'designs' ? designs : templates).length ? (
              <p className="sc-hint">{mode === 'designs' ? k('noDesigns') : k('noTemplates')}</p>
            ) : null}
            {loading ? <p className="sc-hint">{k('loading')}</p> : null}
            {mode === 'designs' && cont && !loading ? (
              <button type="button" className="btn-ghost" onClick={() => void load(query, cont)}>
                {k('more')}
              </button>
            ) : null}
            {busy ? <p className="sc-hint">{k('exporting')}</p> : null}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Вкладка «Мозг» в профиле ИИ-сотрудника: файлы, которые он читает перед каждым действием
 * (md-документы людей — целиком, его заметки — свежие сверху, загруженные файлы — по теме),
 * и связка с «Мозгом» ИИ-офиса (читает отделы, которые курирует или к которым подключён, и может
 * записывать туда выводы). Бэкенд — AiEmployeeBrainService.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAlertModal } from '../../contexts/AlertModalContext';
import type { BrainFile } from '../../api/aiOffice';
import {
  downloadEmployeeBrainFile,
  employeeBrainApi,
  type EmployeeBrainOverview,
  type EmployeeBrainSettings,
} from '../../api/aiEmployeeBrain';
import './ai-employee-brain.css';

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

type Editor = { id: string | null; name: string; bodyMd: string; source: string; saving: boolean };

export function AiEmployeeBrainPanel({ agentId, agentName }: { agentId: string; agentName: string }) {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.aiEmployees.brain.${key}`, o) as string;
  const { showAlert, showConfirm } = useAlertModal();
  const [data, setData] = useState<EmployeeBrainOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [previewQ, setPreviewQ] = useState('');
  const [preview, setPreview] = useState<{ block: string; loading: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(() => {
    employeeBrainApi
      .overview(agentId)
      .then((d) => {
        setData(d);
        setErr(null);
      })
      .catch((e) => setErr(e?.message || k('loadError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);
  useEffect(load, [load]);

  // пока файлы индексируются — обновляем статус
  const indexing = data?.files.some((f) => f.indexStatus === 'pending' || f.indexStatus === 'indexing');
  useEffect(() => {
    if (!indexing) return;
    const id = window.setTimeout(load, 2500);
    return () => window.clearTimeout(id);
  }, [indexing, load, data]);

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleString(i18n.language, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  const groups = useMemo(() => {
    const files = data?.files || [];
    return {
      owner: files.filter((f) => f.type === 'md' && f.source !== 'agent'),
      ai: files.filter((f) => f.type === 'md' && f.source === 'agent'),
      uploads: files.filter((f) => f.type !== 'md'),
    };
  }, [data]);

  const openFile = async (f: BrainFile) => {
    if (f.type !== 'md') {
      await downloadEmployeeBrainFile(agentId, f.id, f.name).catch((e) => showAlert(e?.message || k('downloadError'), { variant: 'error' }));
      return;
    }
    try {
      const full = await employeeBrainApi.file(agentId, f.id);
      setEditor({ id: f.id, name: f.name, bodyMd: full.bodyMd ?? '', source: f.source, saving: false });
    } catch (e: any) {
      showAlert(e?.message || k('loadError'), { variant: 'error' });
    }
  };

  const saveEditor = async () => {
    if (!editor) return;
    const name = editor.name.trim() || k('untitled');
    setEditor({ ...editor, saving: true });
    try {
      if (editor.id) await employeeBrainApi.update(agentId, editor.id, { name, bodyMd: editor.bodyMd });
      else await employeeBrainApi.createDoc(agentId, { name, bodyMd: editor.bodyMd });
      setEditor(null);
      showAlert(k('saved'), { variant: 'success' });
      load();
    } catch (e: any) {
      setEditor((cur) => (cur ? { ...cur, saving: false } : cur));
      showAlert(e?.message || k('saveError'), { variant: 'error' });
    }
  };

  const removeFile = async (f: { id: string; name: string }) => {
    const ok = await showConfirm(k('deleteConfirm', { name: f.name }), { title: k('deleteTitle'), confirmLabel: k('delete'), cancelLabel: k('cancel'), danger: true });
    if (!ok) return;
    try {
      await employeeBrainApi.remove(agentId, f.id);
      setEditor(null);
      load();
    } catch (e: any) {
      showAlert(e?.message || k('saveError'), { variant: 'error' });
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) await employeeBrainApi.upload(agentId, f);
      load();
    } catch (e: any) {
      showAlert(e?.message || k('uploadError'), { variant: 'error' });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const patchSettings = async (patch: Partial<EmployeeBrainSettings>) => {
    if (!data) return;
    setData({ ...data, settings: { ...data.settings, ...patch } });
    setSavingSettings(true);
    try {
      setData(await employeeBrainApi.saveSettings(agentId, patch));
    } catch (e: any) {
      showAlert(e?.message || k('saveError'), { variant: 'error' });
      load();
    } finally {
      setSavingSettings(false);
    }
  };

  const runPreview = async () => {
    setPreview({ block: '', loading: true });
    try {
      const r = await employeeBrainApi.preview(agentId, previewQ);
      setPreview({ block: r.block, loading: false });
    } catch (e: any) {
      setPreview({ block: e?.message || k('loadError'), loading: false });
    }
  };

  if (err && !data) return <div className="e2-panel" style={{ padding: 18 }}>{err}</div>;
  if (!data) return <div className="e2-panel" style={{ padding: 18 }}>…</div>;

  const s = data.settings;
  const toggleDept = (id: string) =>
    patchSettings({ departmentIds: s.departmentIds.includes(id) ? s.departmentIds.filter((x) => x !== id) : [...s.departmentIds, id] });

  const FileRow = ({ f, hint }: { f: BrainFile; hint: string }) => (
    <div className="ebr-row">
      <button type="button" className="ebr-row-main" onClick={() => void openFile(f)}>
        <span className={`ebr-ic t-${f.type}`}>{f.type === 'md' ? 'MD' : f.type.toUpperCase().slice(0, 4)}</span>
        <span className="ebr-nm">
          <b>{f.name}</b>
          <small>
            {hint} · {fmtSize(f.sizeBytes)} · {k('updated')} {fmtDate(f.updatedAt)}
            {f.indexStatus !== 'ready' ? ` · ${f.indexStatus === 'failed' ? k('indexFailed') : k('indexing', { p: f.indexProgress })}` : ''}
          </small>
        </span>
      </button>
      <span className="ebr-read" title={k('lastReadHint')}>
        {f.lastReadAt ? k('readAt', { time: fmtDate(f.lastReadAt) }) : k('notReadYet')}
      </span>
      <button type="button" className="btn-icon" aria-label={k('download')} onClick={() => void downloadEmployeeBrainFile(agentId, f.id, f.name)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" /></svg>
      </button>
      <button type="button" className="btn-icon btn-icon-danger" aria-label={k('delete')} onClick={() => void removeFile(f)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
      </button>
    </div>
  );

  const Section = ({ title, hint, files, empty, rowHint }: { title: string; hint: string; files: BrainFile[]; empty: string; rowHint: string }) => (
    <div className="ebr-sec">
      <div className="ebr-sec-hd">
        <span className="ebr-kicker">{title}</span>
        <span className="ebr-count">{files.length}</span>
      </div>
      <p className="ebr-sec-hint">{hint}</p>
      {files.length ? files.map((f) => <FileRow key={f.id} f={f} hint={rowHint} />) : <div className="ebr-empty">{empty}</div>}
    </div>
  );

  return (
    <div className="ebr-grid">
      <div className="e2-panel">
        <div className="e2-panel-hd">
          <span className="h">{k('title')}</span>
          <div className="r">
            <input ref={fileInput} type="file" hidden multiple accept=".md,.txt,.pdf,.csv,.xlsx,.xls,.docx,.png,.jpg,.jpeg,.webp" onChange={(e) => void upload(e.target.files)} />
            <button type="button" className="e2b gh sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? k('uploading') : k('upload')}
            </button>
            <button type="button" className="e2b sm" onClick={() => setEditor({ id: null, name: '', bodyMd: '', source: 'editor', saving: false })}>
              + {k('newDoc')}
            </button>
          </div>
        </div>
        <div className="e2-panel-bd">
          <p className="ebr-intro">{k('intro', { name: agentName })}</p>
          <Section title={k('secOwner')} hint={k('secOwnerHint')} files={groups.owner} empty={k('emptyOwner')} rowHint={k('alwaysRead')} />
          <Section title={k('secAi')} hint={k('secAiHint')} files={groups.ai} empty={k('emptyAi')} rowHint={k('aiWrote')} />
          <Section title={k('secUploads')} hint={k('secUploadsHint')} files={groups.uploads} empty={k('emptyUploads')} rowHint={k('byTopic')} />
        </div>
      </div>

      <div className="ebr-side">
        <div className="e2-panel">
          <div className="e2-panel-hd">
            <span className="h">{k('settingsTitle')}</span>
          </div>
          <div className="e2-panel-bd ebr-opts">
            <label className="ebr-opt">
              <input type="checkbox" checked={s.aiWrites} disabled={savingSettings} onChange={(e) => void patchSettings({ aiWrites: e.target.checked })} />
              <span>
                <b>{k('aiWrites')}</b>
                <small>{k('aiWritesHint')}</small>
              </span>
            </label>
          </div>
        </div>

        <div className="e2-panel">
          <div className="e2-panel-hd">
            <span className="h">{k('officeTitle')}</span>
          </div>
          <div className="e2-panel-bd ebr-opts">
            {!data.officeAvailable ? (
              <p className="ebr-sec-hint">{k('officeOff')}</p>
            ) : (
              <>
                <p className="ebr-sec-hint">{k('officeHint')}</p>
                {data.departments.length ? (
                  data.departments.map((d) => (
                    <label key={d.id} className={`ebr-opt${d.curated ? ' locked' : ''}`}>
                      <input type="checkbox" checked={d.curated || d.linked} disabled={d.curated || savingSettings} onChange={() => toggleDept(d.id)} />
                      <span>
                        <b>
                          <i className="ebr-dot" style={{ background: d.color || '#222' }} />
                          {d.name}
                        </b>
                        {d.curated ? <small>{k('curated')}</small> : null}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="ebr-sec-hint">
                    {k('noDepts')} <Link to="/ai-office">{k('openOffice')}</Link>
                  </p>
                )}
                <label className="ebr-opt">
                  <input type="checkbox" checked={s.includeShared} disabled={savingSettings} onChange={(e) => void patchSettings({ includeShared: e.target.checked })} />
                  <span>
                    <b>{k('shared')}</b>
                    <small>{k('sharedHint')}</small>
                  </span>
                </label>
                <label className="ebr-opt">
                  <input
                    type="checkbox"
                    checked={s.writeToDepartments}
                    disabled={savingSettings || !s.aiWrites}
                    onChange={(e) => void patchSettings({ writeToDepartments: e.target.checked })}
                  />
                  <span>
                    <b>{k('writeDepts')}</b>
                    <small>{k('writeDeptsHint')}</small>
                  </span>
                </label>
              </>
            )}
          </div>
        </div>

        <div className="e2-panel">
          <div className="e2-panel-hd">
            <span className="h">{k('previewTitle')}</span>
          </div>
          <div className="e2-panel-bd">
            <p className="ebr-sec-hint">{k('previewHint')}</p>
            <div className="ebr-prev-row">
              <input className="ebr-input" value={previewQ} placeholder={k('previewPlaceholder')} onChange={(e) => setPreviewQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void runPreview()} />
              <button type="button" className="e2b gh sm" disabled={preview?.loading} onClick={() => void runPreview()}>
                {k('previewRun')}
              </button>
            </div>
            {preview && !preview.loading ? <pre className="ebr-pre">{preview.block || k('previewEmpty')}</pre> : null}
          </div>
        </div>
      </div>

      {editor &&
        createPortal(
          <div className="ebr-back lv-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !editor.saving && setEditor(null)}>
            <aside className="ebr-drawer lv-sheet-right" role="dialog" aria-label={k('editorTitle')}>
              <header className="ebr-dr-hd">
                <div>
                  <div className="ebr-kicker">{editor.source === 'agent' ? k('aiNote') : k('editorTitle')}</div>
                  <input className="ebr-title-in" value={editor.name} placeholder={k('namePlaceholder')} onChange={(e) => setEditor({ ...editor, name: e.target.value })} autoFocus={!editor.id} />
                </div>
                <button type="button" className="btn-icon" aria-label={k('cancel')} onClick={() => setEditor(null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </header>
              <textarea className="ebr-ta" value={editor.bodyMd} placeholder={k('bodyPlaceholder')} onChange={(e) => setEditor({ ...editor, bodyMd: e.target.value })} />
              <footer className="ebr-dr-ft">
                {editor.id ? (
                  <button type="button" className="btn-danger" onClick={() => void removeFile({ id: editor.id!, name: editor.name })}>
                    {k('delete')}
                  </button>
                ) : null}
                <span className="ebr-ft-hint">{k('editorHint')}</span>
                <button type="button" className="btn-ghost" onClick={() => setEditor(null)}>
                  {k('cancel')}
                </button>
                <button type="button" className="btn-primary" disabled={editor.saving} onClick={() => void saveEditor()}>
                  {editor.saving ? k('saving') : k('save')}
                </button>
              </footer>
            </aside>
          </div>,
          document.body,
        )}
    </div>
  );
}

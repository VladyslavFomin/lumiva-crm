import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { aiOfficeApi, downloadBrainFile, type BrainFile, type OfficeConnector, type OfficeDepartment, type OfficeIssue } from '../../api/aiOffice';
import { ISSUE_COLOR, OfficeLogo, OfficeShell, useAgo, useNotify } from './officeShared';

const brx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');
const TYPES: Record<string, string> = { md: 'MD', txt: 'TXT', pdf: 'PDF', csv: 'CSV', xlsx: 'XLS', docx: 'DOC', img: 'IMG' };
const ACCEPT = '.md,.txt,.pdf,.csv,.xlsx,.xls,.docx,.png,.jpg,.jpeg,.webp';

/** Простой и безопасный рендер markdown (без HTML). */
function Md({ src }: { src: string }) {
  return (
    <div className="br-md">
      {src.split('\n').map((l, i) =>
        l.startsWith('# ') ? <h3 key={i}>{l.slice(2)}</h3>
        : l.startsWith('## ') ? <h4 key={i}>{l.slice(3)}</h4>
        : /^(- |\* |\d+\. )/.test(l) ? <li key={i}>{l.replace(/^(- |\* |\d+\. )/, '')}</li>
        : l ? <p key={i}>{l}</p>
        : <br key={i} />,
      )}
    </div>
  );
}

function Scope({ ids, depts, t }: { ids: string[]; depts: OfficeDepartment[]; t: (k: string) => string }) {
  return (
    <span className="br-scope">
      {ids.includes('all') ? (
        <span className="ofp-tag">{t('aiOffice.brain.allDepts')}</span>
      ) : (
        ids.map((id) => {
          const d = depts.find((x) => x.id === id);
          return d ? <i key={id} title={d.name} style={{ background: d.color }} /> : null;
        })
      )}
    </span>
  );
}

const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function AiBrainPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const notify = useNotify();
  const ago = useAgo();
  const q = new URLSearchParams(location.search);
  const [tab, setTab] = useState<'files' | 'access'>(q.get('tab') === 'access' ? 'access' : 'files');
  const [folder, setFolder] = useState<string>(q.get('folder') || 'all');
  const [files, setFiles] = useState<BrainFile[]>([]);
  const [depts, setDepts] = useState<OfficeDepartment[]>([]);
  const [issues, setIssues] = useState<OfficeIssue[]>([]);
  const [conns, setConns] = useState<OfficeConnector[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [sel, setSel] = useState<BrainFile | null>(null);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState('');
  const [hot, setHot] = useState<string | null>(q.get('req'));
  const [drag, setDrag] = useState<string | false>(false);
  const [grant, setGrant] = useState({ connector: q.get('connector') || 'github', token: '', extra: '', scope: q.get('dept') ? [q.get('dept')!] : ([] as string[]) });
  const [busy, setBusy] = useState(false);
  const inp = useRef<HTMLInputElement>(null);
  const pickCtx = useRef<{ folder: string; req?: string }>({ folder: 'common' });

  const loadFiles = useCallback(() => aiOfficeApi.brainFiles().then(setFiles).catch(() => undefined), []);
  const loadAll = useCallback(() => {
    void loadFiles();
    aiOfficeApi.departments().then(setDepts).catch(() => undefined);
    aiOfficeApi.issues().then(setIssues).catch(() => undefined);
    aiOfficeApi.connectors().then(setConns).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // индексация и «кто читает» обновляются сами
  useEffect(() => {
    const id = window.setInterval(() => !document.hidden && void loadFiles(), 5000);
    return () => window.clearInterval(id);
  }, [loadFiles]);

  useEffect(() => {
    if (!selId) {
      setSel(null);
      return;
    }
    aiOfficeApi.brainFile(selId).then((f) => {
      setSel(f);
      setDraft(f.bodyMd ?? '');
    }).catch((e) => notify.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  const agentTitle = (id: string | null) => {
    if (!id) return null;
    for (const d of depts) {
      const a = d.agents.find((x) => x.id === id);
      if (a) return a.title;
    }
    return null;
  };
  const folders = [{ id: 'common', n: t('aiOffice.brain.common'), c: '#8b867c' }, ...depts.map((d) => ({ id: d.id, n: d.name, c: d.color }))];
  const list = files.filter((f) => folder === 'all' || f.folder === folder);
  const reqs = issues.filter((i) => i.fix === 'upload' || i.fix === 'access');
  const tokenConns = conns.filter((c) => c.tokenGrant);

  const upload = async (fl: FileList | File[] | null, toFolder: string, reqId?: string) => {
    if (!fl || !(fl as FileList).length) return;
    for (const f of Array.from(fl)) {
      try {
        const scope = toFolder === 'common' ? ['all'] : [toFolder];
        const row = await aiOfficeApi.brainUpload(f, toFolder, { scope, requestId: reqId });
        setFiles((fs) => [row, ...fs]);
      } catch (e) {
        notify.error(e);
      }
    }
    if (reqId) {
      setIssues((is) => is.filter((i) => i.id !== reqId));
      setHot(null);
    }
    setTab('files');
    setFolder(toFolder);
  };
  const pick = (f: string, req?: string) => {
    pickCtx.current = { folder: f, req };
    inp.current?.click();
  };
  const newDoc = async () => {
    const f = folder === 'all' ? 'common' : folder;
    try {
      const row = await aiOfficeApi.brainCreateDoc({ name: t('aiOffice.brain.newDocName'), folder: f, bodyMd: `# ${t('aiOffice.brain.newDocTitle')}\n\n` });
      setFiles((fs) => [row, ...fs]);
      setSelId(row.id);
      setEdit(true);
      setTab('files');
    } catch (e) {
      notify.error(e);
    }
  };
  const saveDoc = async () => {
    if (!sel) return;
    try {
      const row = await aiOfficeApi.brainUpdate(sel.id, { bodyMd: draft });
      setFiles((fs) => fs.map((x) => (x.id === row.id ? row : x)));
      setSel({ ...sel, ...row, bodyMd: draft });
      setEdit(false);
      notify.success(t('aiOffice.common.saved'));
    } catch (e) {
      notify.error(e);
    }
  };
  const rename = async () => {
    if (!sel) return;
    const name = await notify.prompt({ title: t('aiOffice.brain.rename'), defaultValue: sel.name });
    if (!name || name === sel.name) return;
    try {
      const row = await aiOfficeApi.brainUpdate(sel.id, { name });
      setFiles((fs) => fs.map((x) => (x.id === row.id ? row : x)));
      setSel({ ...sel, name: row.name });
    } catch (e) {
      notify.error(e);
    }
  };
  const setScope = async (scope: string[]) => {
    if (!sel) return;
    try {
      const row = await aiOfficeApi.brainUpdate(sel.id, { scope });
      setFiles((fs) => fs.map((x) => (x.id === row.id ? row : x)));
      setSel({ ...sel, scope: row.scope });
    } catch (e) {
      notify.error(e);
    }
  };
  const toggleScope = (id: string) => {
    if (!sel) return;
    if (id === 'all') return setScope(sel.scope.includes('all') ? [sel.folder === 'common' ? depts[0]?.id ?? 'all' : sel.folder] : ['all']);
    const cur = sel.scope.includes('all') ? depts.map((d) => d.id) : sel.scope;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    return setScope(next.length ? next : ['all']);
  };
  const remove = async () => {
    if (!sel) return;
    if (!(await notify.confirm(t('aiOffice.brain.deleteConfirm', { name: sel.name }), { danger: true }))) return;
    try {
      await aiOfficeApi.brainDelete(sel.id);
      setFiles((fs) => fs.filter((x) => x.id !== sel.id));
      setSelId(null);
    } catch (e) {
      notify.error(e);
    }
  };
  const doGrant = async () => {
    setBusy(true);
    try {
      await aiOfficeApi.grant({
        connector: grant.connector,
        token: grant.token,
        departmentIds: grant.scope,
        settings: grant.connector === 'github' ? { repo: grant.extra } : { parentPageId: grant.extra },
        requestId: hot ?? undefined,
      });
      notify.success(t('aiOffice.connect.connected', { name: grant.connector }));
      setGrant({ ...grant, token: '', extra: '' });
      setHot(null);
      loadAll();
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };
  const setInstScope = async (connector: string, connectionId: string, ids: string[]) => {
    try {
      await aiOfficeApi.setScope({ connector, connectionId, departmentIds: ids });
      setConns((cs) => cs.map((c) => (c.key !== connector ? c : { ...c, instances: c.instances.map((i) => (i.connectionId === connectionId ? { ...i, departmentIds: ids } : i)) })));
    } catch (e) {
      notify.error(e);
    }
  };

  return (
    <OfficeShell
      title={t('aiOffice.brain.title')}
      sub={t('aiOffice.brain.sub')}
      right={
        <>
          <button className="ofp-btn" onClick={() => pick(folder === 'all' ? 'common' : folder)}>{t('aiOffice.brain.upload')}</button>
          <button className="ofp-btn pri" onClick={newDoc}>+ {t('aiOffice.brain.newDoc')}</button>
        </>
      }
    >
      <input ref={inp} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { void upload(e.target.files, pickCtx.current.folder, pickCtx.current.req); e.target.value = ''; }} />

      {reqs.length > 0 && (
        <div className="ofp-card br-reqs">
          <div className="ofp-card-h">
            <h2>{t('aiOffice.brain.requests')} <small>{reqs.length}</small></h2>
            <span className="ofp-k">{t('aiOffice.brain.requestsHint')}</span>
          </div>
          {reqs.map((r) => {
            const d = depts.find((x) => x.id === r.departmentId);
            const target = r.target && r.target !== 'common' ? r.departmentId : 'common';
            return (
              <div key={r.id} className={brx('br-req', hot === r.id && 'hot')} style={{ ['--ic' as any]: ISSUE_COLOR[r.kind] }}>
                <span className="ofp-tag" style={{ color: ISSUE_COLOR[r.kind], borderColor: ISSUE_COLOR[r.kind] }}><i />{t(`aiOffice.issueKind.${r.kind}`)}</span>
                <div className="m">
                  <b>{r.title}</b>
                  <span>{agentTitle(r.agentId) ?? ''} · {d?.name} · {ago(r.createdAt)}{r.detail ? ` — ${r.detail}` : ''}</span>
                </div>
                {r.fix === 'upload' ? (
                  <div
                    className={brx('br-drop sm', drag === r.id && 'on')}
                    onDragOver={(e) => { e.preventDefault(); setDrag(r.id); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files, target, r.id); }}
                    onClick={() => pick(target, r.id)}
                  >
                    {t('aiOffice.brain.dropFor', { folder: target === 'common' ? t('aiOffice.brain.common') : d?.name ?? '' })}
                  </div>
                ) : (
                  <button className="ofp-btn pri" onClick={() => { setTab('access'); setHot(r.id); setGrant({ ...grant, connector: r.target && tokenConns.some((c) => c.key === r.target) ? r.target : grant.connector, scope: [r.departmentId] }); }}>
                    {t('aiOffice.fix.access')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="br-tabs ofp-seg">
        <button className={tab === 'files' ? 'on' : ''} onClick={() => setTab('files')}>{t('aiOffice.brain.tabFiles', { count: files.length })}</button>
        <button className={tab === 'access' ? 'on' : ''} onClick={() => setTab('access')}>{t('aiOffice.brain.tabAccess')}</button>
      </div>

      {tab === 'files' ? (
        <div className="br-grid">
          <div className="ofp-card br-tree">
            <button className={folder === 'all' ? 'on' : ''} onClick={() => setFolder('all')}><i style={{ background: 'var(--of-ink)' }} />{t('aiOffice.brain.allFiles')}<b>{files.length}</b></button>
            {folders.map((fd) => (
              <button key={fd.id} className={folder === fd.id ? 'on' : ''} onClick={() => setFolder(fd.id)}>
                <i style={{ background: fd.c }} />
                {fd.n}
                <b>{files.filter((f) => f.folder === fd.id).length}</b>
              </button>
            ))}
          </div>
          <div
            className="ofp-card br-files"
            onDragOver={(e) => { e.preventDefault(); setDrag('list'); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files, folder === 'all' ? 'common' : folder); }}
          >
            {drag === 'list' && <div className="br-over">{t('aiOffice.brain.dropHere', { folder: folder === 'all' || folder === 'common' ? t('aiOffice.brain.common') : folders.find((f) => f.id === folder)?.n })}</div>}
            <div className="br-fh">
              <span>{t('aiOffice.brain.colFile')}</span>
              <span>{t('aiOffice.brain.colWho')}</span>
              <span>{t('aiOffice.brain.colRead')}</span>
              <span>{t('aiOffice.brain.colChanged')}</span>
            </div>
            {list.map((f) => {
              const readingNow = f.lastReadAt && Date.now() - new Date(f.lastReadAt).getTime() < 60_000;
              return (
                <button key={f.id} className={brx('br-f', selId === f.id && 'on', readingNow && 'reading')} onClick={() => { setSelId(f.id); setEdit(false); }}>
                  <span className="nm">
                    <span className={'br-ty ' + f.type}>{TYPES[f.type] ?? f.type.toUpperCase()}</span>
                    <span className="t">{f.name}</span>
                    {f.indexStatus !== 'ready' && (
                      <span className={brx('br-idx', f.indexStatus === 'failed' && 'err')}>
                        {f.indexStatus === 'failed' ? t('aiOffice.brain.indexFailed') : t('aiOffice.brain.indexing', { p: f.indexProgress })}
                      </span>
                    )}
                  </span>
                  <Scope ids={f.scope} depts={depts} t={t} />
                  <span className="rd">
                    {readingNow ? <span className="live">{t('aiOffice.brain.readsNow', { who: agentTitle(f.lastReadAgentId) ?? '' })}</span> : f.lastReadAt ? `${agentTitle(f.lastReadAgentId) ?? ''} · ${ago(f.lastReadAt)}` : '—'}
                  </span>
                  <span className="up">{ago(f.updatedAt)}</span>
                </button>
              );
            })}
            <div className="br-drop" onClick={() => pick(folder === 'all' ? 'common' : folder)}>{t('aiOffice.brain.dropHint')}</div>
          </div>
          <div className="ofp-card br-prev">
            {sel ? (
              <>
                <div className="ofp-card-h">
                  <h2 style={{ fontSize: 15, overflowWrap: 'anywhere' }}>{sel.name}</h2>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {sel.editable && (edit ? <button className="ofp-btn pri" onClick={saveDoc}>{t('aiOffice.common.save')}</button> : <button className="ofp-btn" onClick={() => setEdit(true)}>{t('aiOffice.brain.edit')}</button>)}
                    {edit && <button className="ofp-btn" onClick={() => { setEdit(false); setDraft(sel.bodyMd ?? ''); }}>{t('aiOffice.common.cancel')}</button>}
                  </div>
                </div>
                <div className="ofp-card-b br-body">
                  {sel.editable ? (
                    edit ? <textarea className="ofp-ta" style={{ minHeight: 260 }} value={draft} onChange={(e) => setDraft(e.target.value)} /> : <Md src={sel.bodyMd ?? ''} />
                  ) : (
                    <div className="br-bin">
                      <span className={'br-ty big ' + sel.type}>{TYPES[sel.type] ?? sel.type}</span>
                      <span>{t('aiOffice.brain.binMeta', { size: fmtSize(sel.sizeBytes), n: sel.chunkCount })}</span>
                      {sel.indexError && <span style={{ color: 'var(--of-warn)' }}>{sel.indexError}</span>}
                      {sel.preview && <pre>{sel.preview}</pre>}
                    </div>
                  )}
                  <div className="br-meta">
                    <span className="ofp-k">{t('aiOffice.brain.whoCanRead')}</span>
                    <div className="br-scopes">
                      {[{ id: 'all', n: t('aiOffice.brain.all'), c: 'var(--of-ink)' }, ...depts.map((d) => ({ id: d.id, n: d.name, c: d.color }))].map((d) => {
                        const on = sel.scope.includes(d.id) || (d.id !== 'all' && sel.scope.includes('all'));
                        return (
                          <button key={d.id} className={on ? 'on' : ''} onClick={() => toggleScope(d.id)}>
                            <i style={{ background: d.c }} />
                            {d.n}
                          </button>
                        );
                      })}
                    </div>
                    <span className="ofp-k">{t('aiOffice.brain.colRead')}</span>
                    <span>{sel.lastReadAt ? `${agentTitle(sel.lastReadAgentId) ?? ''} · ${ago(sel.lastReadAt)}` : '—'}</span>
                    {sel.source === 'agent' && <span className="ofp-tag">{t('aiOffice.brain.byAgent', { who: agentTitle(sel.authorAgentId) ?? '' })}</span>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      <button className="ofp-btn" onClick={() => downloadBrainFile(sel.id, sel.name).catch((e) => notify.error(e))}>{t('aiOffice.brain.download')}</button>
                      <button className="ofp-btn" onClick={rename}>{t('aiOffice.brain.renameBtn')}</button>
                      <button className="ofp-btn danger" onClick={remove}>{t('aiOffice.brain.delete')}</button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="of-none">{t('aiOffice.brain.pickFile')}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="br-acc">
          <div className="ofp-card">
            <div className="ofp-card-h"><h2>{t('aiOffice.brain.tabAccess')} <small>{t('aiOffice.brain.accessHint')}</small></h2></div>
            {conns.filter((c) => c.key !== 'crm' && c.instances.length).flatMap((c) =>
              c.instances.map((i) => (
                <div key={c.key + i.connectionId} className="br-sec">
                  <OfficeLogo c={c} size={28} off={i.status !== 'ok'} />
                  <div className="m">
                    <b>{i.label || c.name}</b>
                    <span className="key">{c.name}</span>
                  </div>
                  <div className="br-scopes">
                    {depts.map((d) => {
                      const on = i.departmentIds.length === 0 ? d.connectors.includes(c.key) : i.departmentIds.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          className={on ? 'on' : ''}
                          title={i.departmentIds.length === 0 ? t('aiOffice.brain.scopeAllHint') : ''}
                          onClick={() => {
                            const base = i.departmentIds.length === 0 ? depts.filter((x) => x.connectors.includes(c.key)).map((x) => x.id) : i.departmentIds;
                            void setInstScope(c.key, i.connectionId, on ? base.filter((x) => x !== d.id) : [...base, d.id]);
                          }}
                        >
                          <i style={{ background: d.color }} />
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                  <span className={brx('ofp-tag', i.status === 'ok' ? 'ok' : i.status === 'off' ? '' : 'err')}>
                    {i.status === 'ok' && i.expiresAt ? t('aiOffice.brain.until', { date: new Date(i.expiresAt).toLocaleDateString() }) : t(`aiOffice.connStatus.${i.status}`)}
                  </span>
                  <span />
                </div>
              )),
            )}
          </div>
          <div className={brx('ofp-card ofp-card-b br-grant', hot && 'hot')}>
            <span className="ofp-k">{t('aiOffice.brain.grantTitle')}</span>
            {hot && issues.find((r) => r.id === hot) && <p className="br-hint">{t('aiOffice.brain.byRequest', { title: issues.find((r) => r.id === hot)!.title })}</p>}
            <label className="ofp-lbl">
              <span>{t('aiOffice.brain.service')}</span>
              <select className="ofp-sel" value={grant.connector} onChange={(e) => setGrant({ ...grant, connector: e.target.value })}>
                {tokenConns.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
              <em>{t('aiOffice.brain.grantOthers')}</em>
            </label>
            <label className="ofp-lbl">
              <span>{t('aiOffice.connect.token')}</span>
              <input className="ofp-in" type="password" autoComplete="off" value={grant.token} onChange={(e) => setGrant({ ...grant, token: e.target.value })} />
            </label>
            <label className="ofp-lbl">
              <span>{grant.connector === 'github' ? t('aiOffice.connect.repo') : t('aiOffice.connect.notionPage')}</span>
              <input className="ofp-in" value={grant.extra} onChange={(e) => setGrant({ ...grant, extra: e.target.value })} placeholder={grant.connector === 'github' ? 'owner/repo' : 'https://www.notion.so/…'} />
            </label>
            <div className="ofp-lbl">
              <span>{t('aiOffice.brain.whichDepts')}</span>
              <div className="br-scopes">
                {depts.map((d) => {
                  const on = grant.scope.includes(d.id);
                  return (
                    <button key={d.id} className={on ? 'on' : ''} onClick={() => setGrant({ ...grant, scope: on ? grant.scope.filter((x) => x !== d.id) : [...grant.scope, d.id] })}>
                      <i style={{ background: d.color }} />
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <button className="ofp-btn pri" style={{ justifyContent: 'center' }} disabled={busy || grant.token.length < 10 || !grant.extra} onClick={doGrant}>
              {busy ? t('aiOffice.connect.checking') : t('aiOffice.brain.saveAccess')}
            </button>
          </div>
        </div>
      )}
    </OfficeShell>
  );
}

export default AiBrainPage;

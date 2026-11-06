/**
 * Редактор поста: общий текст + свой текст под каждый канал (со счётчиком по лимиту сети), время,
 * картинки (загрузка / ИИ, согласование каждой картинки), ИИ-подготовка, превью, комментарии и
 * действия по статусу (черновик → согласование → одобрен/в расписании → опубликован).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { getSession } from '../../auth/session';
import { CanvaPicker } from './CanvaPicker';
import { contentApi, type CanvaPreset, type CanvaStatus, type ContentChannel, type ContentPlan, type ContentPost, type MediaItem, type PostFormat, type SavePostBody } from '../../api/content';
import { fmtDateTime, fromLocalInput, IC, Ico, localeOf, NET_NAME, NetIcon, Pill, POST_STATUS_TONE, toLocalInput, VARIANT_STATUS_TONE } from './smmShared';

type VariantDraft = { channelId: string; text: string; publishAt: string };

export const canApproveContent = () => ['owner', 'admin', 'manager'].includes(String(getSession()?.user?.role || '').toLowerCase());

export function PostEditorDrawer({
  postId,
  initial,
  channels,
  plans,
  onClose,
  onSaved,
  onOpenPost,
}: {
  postId: string | null;
  initial?: { publishAt?: string; channelIds?: string[]; planId?: string | null };
  channels: ContentChannel[];
  plans: ContentPlan[];
  onClose: () => void;
  onSaved: (p: ContentPost | null) => void;
  /** открыть другой пост в этом же редакторе (после «Повторить») */
  onOpenPost?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.smm2.editor.${key}`, o) as string;
  const locale = localeOf(i18n.language);
  const { showAlert, showConfirm, showPrompt } = useAlertModal();
  const approver = canApproveContent();
  const [post, setPost] = useState<ContentPost | null>(null);
  const [loading, setLoading] = useState(!!postId);
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [rubric, setRubric] = useState('');
  const [format, setFormat] = useState<PostFormat>('post');
  const [text, setText] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [canva, setCanva] = useState<CanvaStatus | null>(null);
  const [canvaPick, setCanvaPick] = useState<'designs' | 'templates' | null>(null);
  const [canvaPreset, setCanvaPreset] = useState<CanvaPreset>('square');
  useEffect(() => {
    contentApi.canvaStatus().then(setCanva).catch(() => setCanva(null));
  }, []);
  const [planId, setPlanId] = useState<string | null>(initial?.planId ?? null);
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    (initial?.channelIds || []).map((id) => ({ channelId: id, text: '', publishAt: initial?.publishAt ? toLocalInput(initial.publishAt) : '' })),
  );
  const [active, setActive] = useState<string>('main');
  const [brief, setBrief] = useState('');
  const [withImage, setWithImage] = useState(true);
  const [imgPrompt, setImgPrompt] = useState('');
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const chById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const fill = (p: ContentPost) => {
    setPost(p);
    setTitle(p.title || '');
    setRubric(p.rubric || '');
    setFormat(p.format);
    setText(p.text || '');
    setMedia(p.media || []);
    setPlanId(p.planId);
    setVariants(p.variants.map((v) => ({ channelId: v.channelId, text: v.text || '', publishAt: toLocalInput(v.publishAt) })));
  };

  useEffect(() => {
    if (!postId) return;
    contentApi
      .post(postId)
      .then(fill)
      .catch((e) => showAlert(e?.message || k('loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [busy, onClose]);

  const published = post?.status === 'published';
  const locked = published || post?.variants.some((v) => v.status === 'publishing');
  const status = post?.status ?? 'draft';

  const toggleChannel = (id: string) =>
    setVariants((cur) =>
      cur.some((v) => v.channelId === id) ? cur.filter((v) => v.channelId !== id) : [...cur, { channelId: id, text: '', publishAt: cur[0]?.publishAt || '' }],
    );
  const setVar = (id: string, patch: Partial<VariantDraft>) => setVariants((cur) => cur.map((v) => (v.channelId === id ? { ...v, ...patch } : v)));
  const setAllTimes = (val: string) => setVariants((cur) => cur.map((v) => ({ ...v, publishAt: val })));

  const body = (): SavePostBody => ({
    title,
    rubric: rubric || null,
    format: media.length > 1 && format === 'post' ? 'carousel' : format,
    text,
    media,
    planId,
    variants: variants.map((v) => ({ channelId: v.channelId, text: v.text.trim() ? v.text : null, publishAt: fromLocalInput(v.publishAt) })),
  });

  const run = async (label: string, fn: () => Promise<ContentPost | null | void>, okMsg?: string) => {
    setBusy(label);
    try {
      const r = await fn();
      if (r) fill(r);
      if (okMsg) showAlert(okMsg, { variant: 'success' });
      onSaved(r || null);
      return r;
    } catch (e: any) {
      showAlert(e?.message || k('saveError'), { variant: 'error' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const save = () => run('save', () => (post ? contentApi.update(post.id, body()) : contentApi.create(body())), k('saved'));
  // Canva работает с сохранённым постом: сначала сохраняем правки, потом экспорт/автозаполнение
  const canvaRun = (label: string, fn: (id: string) => Promise<ContentPost>, okMsg?: string) =>
    run(label, async () => {
      if (!post) return null;
      await contentApi.update(post.id, body());
      return fn(post.id);
    }, okMsg);
  const openInCanva = async () => {
    if (!post) return;
    setBusy('canva');
    try {
      await contentApi.update(post.id, body());
      const r = await contentApi.canvaOpen(post.id, canvaPreset);
      window.location.href = r.editUrl;
    } catch (e: any) {
      showAlert(e?.message || k('saveError'), { variant: 'error' });
      setBusy(null);
    }
  };
  const saveThen = async (fn: (id: string) => Promise<ContentPost>, label: string, ok: string) => {
    const saved = await run('save', () => (post ? contentApi.update(post.id, body()) : contentApi.create(body())));
    if (saved) await run(label, () => fn(saved.id), ok);
  };

  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('upload');
    try {
      const added: MediaItem[] = [];
      for (const f of Array.from(files).slice(0, 10 - media.length)) {
        if (f.type.startsWith('video/')) {
          // пост с видео = одно видео: заменяем картинки
          setUploadPct(0);
          const v = await contentApi.uploadVideo(f, (x) => setUploadPct(Math.round(x * 100)));
          setUploadPct(null);
          setMedia([v]);
          if (format === 'carousel') setFormat('post');
          return;
        }
        const r = await contentApi.uploadMedia(f);
        added.push({ url: r.url, kind: 'image', approved: null });
      }
      setMedia((m) => [...m.filter((x) => x.kind !== 'video'), ...added]);
    } catch (e: any) {
      showAlert(e?.message || k('uploadError'), { variant: 'error' });
    } finally {
      setBusy(null);
      setUploadPct(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const genImage = async () => {
    const prompt = imgPrompt.trim() || brief.trim() || text.slice(0, 400);
    if (!prompt) return showAlert(k('needPrompt'), { variant: 'error' });
    setBusy('image');
    try {
      const r = await contentApi.image(prompt);
      if (r.error) throw new Error(r.error === 'provider_quota' ? k('quota') : r.error);
      setMedia((m) => [...m, { url: r.url, kind: 'image', approved: null }]);
    } catch (e: any) {
      showAlert(e?.message || k('aiError'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const compose = async () => {
    if (!brief.trim()) return showAlert(k('needBrief'), { variant: 'error' });
    setBusy('compose');
    try {
      const r = await contentApi.compose({ brief, channelIds: variants.map((v) => v.channelId), format, withImage, imagePrompt: imgPrompt || undefined, lang: i18n.language });
      if (r.title && !title) setTitle(r.title);
      if (r.text) setText(r.text);
      setVariants((cur) => cur.map((v) => ({ ...v, text: r.variants[v.channelId] ?? v.text })));
      if (r.media?.length) setMedia((m) => [...m, ...r.media]);
      if (r.imagePrompt) setImgPrompt(r.imagePrompt);
      if (r.imageError) showAlert(`${k('imageFailed')}: ${r.imageError}`, { variant: 'error' });
    } catch (e: any) {
      showAlert(e?.message || k('aiError'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const reviewImage = async (i: number, ok: boolean) => {
    if (!post) {
      setMedia((m) => m.map((x, j) => (j === i ? { ...x, approved: ok } : x)));
      return;
    }
    let why = '';
    if (!ok) {
      why = (await showPrompt({ title: k('rejectImage'), label: k('imageWhy'), confirmLabel: k('rejectImage'), cancelLabel: k('cancel') })) || '';
      if (!why.trim()) return;
    }
    await run('media', () => contentApi.mediaReview(post.id, i, ok, why));
  };

  const activeVar = variants.find((v) => v.channelId === active);
  const activeCh = activeVar ? chById.get(activeVar.channelId) : null;
  const curText = activeVar ? activeVar.text || text : text;
  const limit = activeCh?.caps?.maxText ?? null;
  const hashCount = (curText.match(/#[^\s#]+/g) || []).length;

  if (loading) return createPortal(<div className="sc-back lv-backdrop"><aside className="sc-drawer lv-sheet-right"><div className="sc-pad">…</div></aside></div>, document.body);

  return createPortal(
    <div className="sc-back lv-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <aside className="sc-drawer lv-sheet-right" role="dialog" aria-label={k('title')}>
        <header className="sc-dr-hd">
          <div className="sc-dr-hd-main">
            <div className="sc-kicker">
              {post ? k('kickerEdit') : k('kickerNew')}
              {post ? <Pill tone={POST_STATUS_TONE[status]}>{t(`crm.smm2.status.${status}`)}</Pill> : null}
              {post?.source && post.source !== 'manual' ? <span className="sc-src">{t(`crm.smm2.source.${post.source}`)}</span> : null}
              {post?.abLabel ? <span className="sc-src">{k('abBadge', { label: post.abLabel })}</span> : null}
            </div>
            <input className="sc-title-in" value={title} placeholder={k('titlePlaceholder')} onChange={(e) => setTitle(e.target.value)} disabled={!!locked} />
          </div>
          <button type="button" className="btn-icon" aria-label={k('close')} onClick={onClose}>
            <Ico d={IC.x} size={16} />
          </button>
        </header>

        {post?.reviewNote && ['changes', 'rejected'].includes(status) ? (
          <div className="sc-note warn">
            <b>{k('reviewNote')}</b> {post.reviewNote}
          </div>
        ) : null}

        <div className="sc-dr-body">
          <div className="sc-dr-main">
            {/* каналы */}
            <section className="sc-sec">
              <div className="sc-sec-hd">{k('channels')}</div>
              {channels.length ? (
                <div className="sc-chips">
                  {channels.map((c) => {
                    const on = variants.some((v) => v.channelId === c.id);
                    return (
                      <button key={c.id} type="button" className={`sc-chip${on ? ' on' : ''}`} disabled={!!locked || !c.enabled} onClick={() => toggleChannel(c.id)}>
                        <NetIcon network={c.network} size={13} />
                        {c.accountName}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="sc-hint">{k('noChannels')}</p>
              )}
            </section>

            {/* ИИ */}
            {!locked ? (
              <section className="sc-sec sc-ai">
                <div className="sc-sec-hd">
                  <Ico d={IC.spark} size={13} /> {k('aiTitle')}
                </div>
                <textarea className="sc-in sc-area-sm" rows={2} value={brief} placeholder={k('briefPlaceholder')} onChange={(e) => setBrief(e.target.value)} />
                <div className="sc-ai-row">
                  <label className="sc-check">
                    <input type="checkbox" checked={withImage} onChange={(e) => setWithImage(e.target.checked)} /> {k('withImage')}
                  </label>
                  <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => void compose()}>
                    <Ico d={IC.spark} size={13} /> {busy === 'compose' ? k('composing') : k('compose')}
                  </button>
                </div>
                <p className="sc-hint">{k('aiHint')}</p>
              </section>
            ) : null}

            {/* тексты */}
            <section className="sc-sec">
              <div className="sc-tabs">
                <button type="button" className={active === 'main' ? 'on' : ''} onClick={() => setActive('main')}>
                  {k('mainText')}
                </button>
                {variants.map((v) => {
                  const c = chById.get(v.channelId);
                  if (!c) return null;
                  return (
                    <button key={v.channelId} type="button" className={active === v.channelId ? 'on' : ''} onClick={() => setActive(v.channelId)}>
                      <NetIcon network={c.network} size={12} /> {NET_NAME[c.network]}
                      {v.text.trim() ? <i className="dot" /> : null}
                    </button>
                  );
                })}
              </div>
              {active === 'main' || !activeVar ? (
                <textarea className="sc-in sc-area" value={text} placeholder={k('textPlaceholder')} onChange={(e) => setText(e.target.value)} disabled={!!locked} />
              ) : (
                <>
                  <textarea
                    className="sc-in sc-area"
                    value={activeVar.text}
                    placeholder={k('variantPlaceholder', { network: activeCh ? NET_NAME[activeCh.network] : '' })}
                    onChange={(e) => setVar(activeVar.channelId, { text: e.target.value })}
                    disabled={!!locked}
                  />
                  {!activeVar.text.trim() ? <p className="sc-hint">{k('usesMain')}</p> : null}
                </>
              )}
              <div className="sc-count">
                <span className={limit && curText.length > limit ? 'over' : ''}>
                  {curText.length}
                  {limit ? ` / ${limit}` : ''}
                </span>
                {activeCh?.network === 'instagram' ? <span className={hashCount > 30 ? 'over' : ''}>#{hashCount} / 30</span> : null}
              </div>
            </section>

            {/* картинки */}
            <section className="sc-sec">
              <div className="sc-sec-hd">
                {k('media')} <span className="sc-mut">{media.length} / 10</span>
              </div>
              <div className="sc-media">
                {media.map((m, i) => (
                  <figure key={m.url} className={`sc-thumb${m.approved === false ? ' rej' : m.approved ? ' ok' : ''}`}>
                    {m.kind === 'video' ? <video src={m.url} muted playsInline preload="metadata" /> : <img src={m.url} alt="" />}
                    {m.kind === 'video' ? <span className="sc-thumb-kind">{k('video')}{m.size ? ` · ${Math.round(m.size / 1048576)} ${k('mb')}` : ''}</span> : null}
                    <figcaption>
                      {approver && !locked ? (
                        <>
                          <button type="button" title={k('approveImage')} className={m.approved ? 'on' : ''} onClick={() => void reviewImage(i, true)}>
                            <Ico d={IC.check} size={12} />
                          </button>
                          <button type="button" title={k('rejectImage')} className={m.approved === false ? 'on' : ''} onClick={() => void reviewImage(i, false)}>
                            <Ico d={IC.x} size={12} />
                          </button>
                        </>
                      ) : null}
                      {!locked ? (
                        <button type="button" title={k('removeImage')} onClick={() => setMedia((x) => x.filter((_, j) => j !== i))}>
                          <Ico d={IC.trash} size={12} />
                        </button>
                      ) : null}
                    </figcaption>
                    {m.note ? <span className="sc-thumb-note">{m.note}</span> : null}
                  </figure>
                ))}
                {!locked && media.length < 10 ? (
                  <button type="button" className="sc-thumb add" disabled={!!busy} onClick={() => fileRef.current?.click()}>
                    <Ico d={IC.upload} size={18} />
                    <span>{busy === 'upload' ? (uploadPct !== null ? `${uploadPct}%` : k('uploading')) : k('upload')}</span>
                  </button>
                ) : null}
              </div>
              <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={(e) => void upload(e.target.files)} />
              {!locked ? (
                <div className="sc-img-ai">
                  <input className="sc-in" value={imgPrompt} placeholder={k('imagePromptPlaceholder')} onChange={(e) => setImgPrompt(e.target.value)} />
                  <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => void genImage()}>
                    <Ico d={IC.image} size={13} /> {busy === 'image' ? k('generating') : k('generateImage')}
                  </button>
                </div>
              ) : null}
              {!locked && canva?.connected ? (
                <div className="sc-canva">
                  <span className="sc-canva-lb">Canva</span>
                  {post ? (
                    <>
                      <button type="button" className="btn-secondary" disabled={!!busy || media.length >= 10} onClick={() => setCanvaPick('designs')}>
                        {k('canvaFrom')}
                      </button>
                      <select className="sc-in sc-canva-size" value={canvaPreset} onChange={(e) => setCanvaPreset(e.target.value as CanvaPreset)} aria-label={k('canvaSize')}>
                        {(['square', 'portrait', 'story', 'landscape'] as CanvaPreset[]).map((x) => (
                          <option key={x} value={x}>
                            {t(`crm.smm2.canva.preset.${x}`)}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => void openInCanva()}>
                        {busy === 'canva' ? k('canvaOpening') : k('canvaOpen')}
                      </button>
                      <button type="button" className="btn-ghost" disabled={!!busy || media.length >= 10} onClick={() => setCanvaPick('templates')}>
                        {k('canvaTemplate')}
                      </button>
                    </>
                  ) : (
                    <span className="sc-mut">{k('canvaSaveFirst')}</span>
                  )}
                </div>
              ) : null}
            </section>

            {canvaPick && post ? (
              <CanvaPicker
                mode={canvaPick}
                defaults={{ title, text }}
                busy={busy === 'canvaImport'}
                onClose={() => setCanvaPick(null)}
                onPickDesign={(id) =>
                  void canvaRun('canvaImport', (pid) => contentApi.canvaImport(pid, id), k('canvaImported')).then((r) => r && setCanvaPick(null))
                }
                onAutofill={(tid, fields) =>
                  void canvaRun('canvaImport', (pid) => contentApi.canvaAutofill(pid, tid, fields), k('canvaImported')).then((r) => r && setCanvaPick(null))
                }
              />
            ) : null}

            {/* комментарии */}
            {post ? (
              <section className="sc-sec">
                <div className="sc-sec-hd">{k('history')}</div>
                <div className="sc-comments">
                  {post.comments.length ? (
                    post.comments
                      .slice()
                      .reverse()
                      .map((c) => (
                        <div key={c.id} className="sc-cmt">
                          <b>{c.by || '—'}</b> <span className="sc-mut">{fmtDateTime(c.at, locale)}</span>
                          <div>
                            {c.kind !== 'comment' ? <em>{t(`crm.smm2.commentKind.${c.kind}`, c.kind)}</em> : null} {c.text}
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="sc-hint">{k('noComments')}</p>
                  )}
                </div>
                <div className="sc-img-ai">
                  <input className="sc-in" value={comment} placeholder={k('commentPlaceholder')} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && comment.trim() && void run('comment', () => contentApi.comment(post.id, comment)).then(() => setComment(''))} />
                  <button type="button" className="btn-secondary" disabled={!comment.trim() || !!busy} onClick={() => void run('comment', () => contentApi.comment(post.id, comment)).then(() => setComment(''))}>
                    {k('send')}
                  </button>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="sc-dr-side">
            <section className="sc-sec">
              <div className="sc-sec-hd">{k('settings')}</div>
              <label className="sc-f">
                <span>{k('format')}</span>
                <select className="sc-in" value={format} disabled={!!locked} onChange={(e) => setFormat(e.target.value as PostFormat)}>
                  {(['post', 'carousel', 'reel', 'story'] as PostFormat[]).map((f) => (
                    <option key={f} value={f}>
                      {t(`crm.smm2.format.${f}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sc-f">
                <span>{k('rubric')}</span>
                <input className="sc-in" value={rubric} disabled={!!locked} placeholder={k('rubricPlaceholder')} onChange={(e) => setRubric(e.target.value)} />
              </label>
              <label className="sc-f">
                <span>{k('plan')}</span>
                <select className="sc-in" value={planId || ''} disabled={!!locked} onChange={(e) => setPlanId(e.target.value || null)}>
                  <option value="">{k('noPlan')}</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="sc-sec">
              <div className="sc-sec-hd">{k('when')}</div>
              {variants.length > 1 && !locked ? (
                <label className="sc-f">
                  <span>{k('allChannels')}</span>
                  <input type="datetime-local" className="sc-in" onChange={(e) => setAllTimes(e.target.value)} />
                </label>
              ) : null}
              {variants.map((v) => {
                const c = chById.get(v.channelId);
                const pv = post?.variants.find((x) => x.channelId === v.channelId);
                if (!c) return null;
                return (
                  <div key={v.channelId} className="sc-when">
                    <div className="sc-when-hd">
                      <NetIcon network={c.network} size={13} />
                      <b>{c.accountName}</b>
                      {pv ? <Pill tone={VARIANT_STATUS_TONE[pv.status]}>{t(`crm.smm2.vstatus.${pv.status}`)}</Pill> : null}
                    </div>
                    <input type="datetime-local" className="sc-in" value={v.publishAt} disabled={!!locked || pv?.status === 'published'} onChange={(e) => setVar(v.channelId, { publishAt: e.target.value })} />
                    <div className="sc-mut sc-mode">{t(`crm.smm2.autonomy.${c.autonomy}`)}</div>
                    {pv?.error ? <div className="sc-err">{pv.error}</div> : null}
                    {pv?.url ? (
                      <a className="sc-link" href={pv.url} target="_blank" rel="noreferrer">
                        <Ico d={IC.link} size={12} /> {k('openPost')}
                      </a>
                    ) : null}
                  </div>
                );
              })}
              {!variants.length ? <p className="sc-hint">{k('pickChannels')}</p> : null}
            </section>

            <section className="sc-sec">
              <div className="sc-sec-hd">{k('preview')}</div>
              <PostPreview
                network={activeCh?.network ?? chById.get(variants[0]?.channelId || '')?.network ?? 'instagram'}
                name={activeCh?.accountName ?? chById.get(variants[0]?.channelId || '')?.accountName ?? ''}
                text={activeVar ? curText : variants[0]?.text || text}
                media={media}
              />
            </section>
          </aside>
        </div>

        <footer className="sc-dr-ft">
          {post && !locked ? (
            <button
              type="button"
              className="btn-danger"
              disabled={!!busy}
              onClick={async () => {
                if (!(await showConfirm(k('deleteConfirm'), { title: k('delete'), confirmLabel: k('delete'), cancelLabel: k('cancel'), danger: true }))) return;
                await run('delete', async () => {
                  await contentApi.remove(post.id);
                  return null;
                });
                onClose();
              }}
            >
              {k('delete')}
            </button>
          ) : null}
          {post && onOpenPost && post.abLabel !== 'B' ? (
            <button
              type="button"
              className="btn-ghost"
              disabled={!!busy}
              title={k('abHint')}
              onClick={async () => {
                const b = await run('ab', () => contentApi.abVariant(post.id), k('abCreated'));
                if (b) onOpenPost(b.id);
              }}
            >
              {post.abGroup ? k('abOpenB') : k('abCreate')}
            </button>
          ) : null}
          {post && onOpenPost ? (
            <button
              type="button"
              className="btn-ghost"
              disabled={!!busy}
              title={k('duplicateHint')}
              onClick={async () => {
                const copy = await run('duplicate', () => contentApi.duplicate(post.id), k('duplicated'));
                if (copy) onOpenPost(copy.id);
              }}
            >
              {k('duplicate')}
            </button>
          ) : null}
          {approver && post && ['review', 'changes'].includes(status) ? (
            <div className="sc-ft-note">
              <input className="sc-in" value={note} placeholder={k('notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
              <button type="button" className="btn-secondary" disabled={!note.trim() || !!busy} onClick={() => void run('changes', () => contentApi.changes(post.id, note), k('sentBack')).then(() => setNote(''))}>
                {k('requestChanges')}
              </button>
            </div>
          ) : (
            <span className="sc-ft-spacer" />
          )}
          {!locked ? (
            <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => void save()}>
              {busy === 'save' ? k('saving') : k('saveDraft')}
            </button>
          ) : null}
          {!locked && (!post || ['draft', 'changes', 'rejected'].includes(status)) && !approver ? (
            <button type="button" className="btn-primary" disabled={!!busy || !variants.length} onClick={() => void saveThen((id) => contentApi.submit(id), 'submit', k('submitted'))}>
              {k('submit')}
            </button>
          ) : null}
          {!locked && approver && !['approved', 'scheduled', 'published'].includes(status) ? (
            <button type="button" className="btn-primary" disabled={!!busy || !variants.length} onClick={() => void saveThen((id) => contentApi.approve(id), 'approve', k('approved'))}>
              {variants.some((v) => v.publishAt) ? k('approveSchedule') : k('approve')}
            </button>
          ) : null}
          {approver && post && ['approved', 'scheduled', 'partial', 'failed'].includes(status) ? (
            <>
              {!locked ? (
                <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => void save()}>
                  {k('saveSchedule')}
                </button>
              ) : null}
              <button type="button" className="btn-primary" disabled={!!busy} onClick={() => void run('publish', () => contentApi.publishNow(post.id), k('publishing'))}>
                <Ico d={IC.send} size={13} /> {k('publishNow')}
              </button>
            </>
          ) : null}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

/** Превью «как увидят в ленте» — упрощённая раскладка каждой сети. */
export function PostPreview({ network, name, text, media }: { network: string; name: string; text: string; media: MediaItem[] }) {
  const img = media.find((m) => m.approved !== false);
  const short = text.length > 260 ? `${text.slice(0, 260)}…` : text;
  return (
    <div className={`sc-pv n-${network}`}>
      <div className="sc-pv-hd">
        <span className="sc-pv-av" />
        <b>{name || '—'}</b>
      </div>
      {network === 'instagram' ? (
        <>
          <div className="sc-pv-img sq">{img ? img.kind === 'video' ? <video src={img.url} muted playsInline preload="metadata" /> : <img src={img.url} alt="" /> : null}{media.length > 1 ? <span className="sc-pv-n">1/{media.length}</span> : null}</div>
          <p className="sc-pv-tx">
            <b>{name}</b> {short}
          </p>
        </>
      ) : (
        <>
          <p className="sc-pv-tx">{short}</p>
          {img ? <div className="sc-pv-img">{img.kind === 'video' ? <video src={img.url} muted playsInline preload="metadata" /> : <img src={img.url} alt="" />}{media.length > 1 ? <span className="sc-pv-n">+{media.length - 1}</span> : null}</div> : null}
        </>
      )}
    </div>
  );
}

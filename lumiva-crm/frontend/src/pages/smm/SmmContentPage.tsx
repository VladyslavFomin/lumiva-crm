/**
 * Маркетинг → SMM: контент и публикации. Один движок для всех сетей (бэкенд content/*):
 * Обзор · Контент-план · Согласование · Посты · Каналы · Аналитика. Посты готовят люди, SMM-сотрудник
 * и контент-отдел ИИ-офиса; что публикуется само — решает режим канала.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { PageHero } from '../../components/ui/PageHero';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { contentApi, type ContentChannel, type ContentPlan, type ContentPost, type Overview, type PostStatus } from '../../api/content';
import { PostEditorDrawer, canApproveContent, PostPreview } from './PostEditorDrawer';
import { SmmChannelsTab } from './SmmChannelsTab';
import { SmmAnalyticsTab } from './SmmAnalyticsTab';
import { fmtDateTime, IC, Ico, localeOf, NET_NAME, NetIcon, Pill, POST_STATUS_TONE, VARIANT_STATUS_TONE } from './smmShared';
import './smm-content.css';

type Tab = 'overview' | 'plan' | 'review' | 'posts' | 'channels' | 'analytics';
const TABS: Tab[] = ['overview', 'plan', 'review', 'posts', 'channels', 'analytics'];

type EditorState = { postId: string | null; initial?: { publishAt?: string; channelIds?: string[]; planId?: string | null } } | null;

export const SmmContentPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.smm2.${key}`, o) as string;
  const locale = localeOf(i18n.language);
  const { showAlert } = useAlertModal();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'overview';
  const setTab = (x: Tab) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set('tab', x);
      n.delete('meta');
      n.delete('linkedin');
      n.delete('vk');
      n.delete('threads');
      n.delete('youtube');
      n.delete('tiktok');
      n.delete('canva');
      n.delete('post');
      return n;
    }, { replace: true });
  const [channels, setChannels] = useState<ContentChannel[]>([]);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [posts, setPosts] = useState<ContentPost[] | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [rev, setRev] = useState(0);

  const reload = useCallback(() => setRev((x) => x + 1), []);

  useEffect(() => {
    contentApi.channels().then(setChannels).catch(() => setChannels([]));
    contentApi.plans().then(setPlans).catch(() => setPlans([]));
    contentApi.overview().then(setOverview).catch(() => setOverview(null));
    contentApi.posts().then(setPosts).catch((e) => {
      setPosts([]);
      showAlert(e?.message || k('loadError'), { variant: 'error' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  // возврат из OAuth Meta/LinkedIn/VK → вкладка «Каналы»
  useEffect(() => {
    const meta = params.get('meta');
    const li = params.get('linkedin') || params.get('vk') || params.get('threads') || params.get('youtube') || params.get('tiktok');
    // возврат из Canva: подключение (→ «Каналы») или из редактора дизайна (→ открыть пост)
    const cv = params.get('canva');
    const cvPost = params.get('post');
    if (cv) {
      if (cv === 'connected' || cv === 'imported') showAlert(k(cv === 'imported' ? 'canvaImported' : 'connected'), { variant: 'success' });
      else showAlert(k('connectFailed', { code: cv }), { variant: 'error' });
      if (cvPost && /^[0-9a-f-]{36}$/i.test(cvPost)) {
        setTab('posts');
        setEditor({ postId: cvPost });
      } else setTab('channels');
      return;
    }
    if (meta || li) {
      if ((meta || li) === 'connected') showAlert(k('connected'), { variant: 'success' });
      else showAlert(k('connectFailed', { code: meta || li }), { variant: 'error' });
      setTab('channels');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reviewCount = (posts || []).filter((p) => p.status === 'review' || p.status === 'changes').length;
  const openNew = (initial?: NonNullable<EditorState>['initial']) => setEditor({ postId: null, initial });

  return (
    <MainLayout>
      <div className="sc-page">
        <PageHero
          kicker={k('kicker')}
          title={k('title')}
          subtitle={k('subtitle')}
          actions={
            <button type="button" className="btn-primary" onClick={() => openNew({ channelIds: channels.filter((c) => c.enabled).slice(0, 1).map((c) => c.id) })}>
              <Ico d={IC.plus} size={14} /> {k('newPost')}
            </button>
          }
        />

        <nav className="sc-tabsbar" role="tablist">
          {TABS.map((x) => (
            <button key={x} type="button" role="tab" aria-selected={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>
              {k(`tabs.${x}`)}
              {x === 'review' && reviewCount ? <span className="n">{reviewCount}</span> : null}
              {x === 'channels' && overview?.channels?.broken ? <span className="n err">!</span> : null}
            </button>
          ))}
        </nav>

        {tab === 'overview' ? <OverviewTab overview={overview} channels={channels} onOpen={(id) => setEditor({ postId: id })} onTab={setTab} locale={locale} /> : null}
        {tab === 'plan' ? <PlanTab posts={posts} channels={channels} plans={plans} onOpen={(id) => setEditor({ postId: id })} onNew={(at) => openNew({ publishAt: at, channelIds: channels.filter((c) => c.enabled).slice(0, 1).map((c) => c.id) })} onPlansChanged={reload} locale={locale} /> : null}
        {tab === 'review' ? <ReviewTab posts={posts} channels={channels} onOpen={(id) => setEditor({ postId: id })} onChanged={reload} locale={locale} /> : null}
        {tab === 'posts' ? <PostsTab posts={posts} channels={channels} onOpen={(id) => setEditor({ postId: id })} locale={locale} /> : null}
        {tab === 'channels' ? <SmmChannelsTab channels={channels} onChanged={reload} /> : null}
        {tab === 'analytics' ? <SmmAnalyticsTab onOpen={(id) => setEditor({ postId: id })} /> : null}
      </div>

      {editor ? (
        <PostEditorDrawer
          key={editor.postId || 'new'}
          postId={editor.postId}
          initial={editor.initial}
          channels={channels}
          plans={plans}
          onClose={() => setEditor(null)}
          onOpenPost={(id) => {
            reload();
            setEditor({ postId: id });
          }}
          onSaved={(p) => {
            reload();
            if (p && !editor.postId) setEditor({ postId: p.id });
          }}
        />
      ) : null}
    </MainLayout>
  );
};

export default SmmContentPage;

// ───────────────────────── Обзор ─────────────────────────

function OverviewTab({ overview, channels, onOpen, onTab, locale }: { overview: Overview | null; channels: ContentChannel[]; onOpen: (id: string) => void; onTab: (t: Tab) => void; locale: string }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.smm2.overview.${key}`, o) as string;
  if (!overview) return <div className="sc-empty">…</div>;
  if (!channels.length) {
    return (
      <div className="sc-empty">
        <b>{k('noChannelsTitle')}</b>
        <span>{k('noChannelsText')}</span>
        <button type="button" className="btn-primary" onClick={() => onTab('channels')}>
          <Ico d={IC.plug} size={14} /> {k('connect')}
        </button>
      </div>
    );
  }
  const kpis: Array<[string, number, Tab | null]> = [
    ['review', overview.review + overview.changes, 'review'],
    ['scheduled', overview.scheduled7, 'plan'],
    ['published', overview.published7, 'analytics'],
    ['drafts', overview.drafts, 'posts'],
  ];
  return (
    <div className="sc-stack">
      <div className="sc-kpis">
        {kpis.map(([id, v, to]) => (
          <button key={id} type="button" className="sc-kpi" onClick={() => to && onTab(to)}>
            <div className="l">{k(`kpi.${id}`)}</div>
            <div className="v">{v}</div>
            <div className="s">{k(`kpiHint.${id}`)}</div>
          </button>
        ))}
      </div>
      <div className="sc-grid2">
        <section className="sc-card">
          <div className="sc-card-hd">
            <h3>{k('upcoming')}</h3>
            <button type="button" className="btn-ghost" onClick={() => onTab('plan')}>
              {k('openPlan')} →
            </button>
          </div>
          {overview.upcoming.length ? (
            overview.upcoming.map((u) => (
              <button key={u.id} type="button" className="sc-row" onClick={() => onOpen(u.postId)}>
                {u.thumb ? <img className="sc-row-img" src={u.thumb} alt="" /> : <span className="sc-row-img ph" />}
                <span className="sc-row-tx">
                  <b>{u.title || u.excerpt || '—'}</b>
                  <small>
                    <NetIcon network={u.network} size={11} /> {u.channelName} · {fmtDateTime(u.publishAt, locale)}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="sc-hint">{k('nothingScheduled')}</p>
          )}
        </section>
        <section className="sc-card">
          <div className="sc-card-hd">
            <h3>{k('attention')}</h3>
          </div>
          {overview.failedList.length || overview.channels.broken ? (
            <>
              {overview.channels.broken ? (
                <button type="button" className="sc-row" onClick={() => onTab('channels')}>
                  <span className="sc-row-tx">
                    <b className="sc-err-t">{k('brokenChannels', { count: overview.channels.broken })}</b>
                    <small>{k('brokenHint')}</small>
                  </span>
                </button>
              ) : null}
              {overview.failedList.map((f) => (
                <button key={f.id} type="button" className="sc-row" onClick={() => onOpen(f.postId)}>
                  <span className="sc-row-tx">
                    <b>{f.title || '—'}</b>
                    <small className="sc-err-t">
                      <NetIcon network={f.network} size={11} /> {f.channelName}: {f.error}
                    </small>
                  </span>
                </button>
              ))}
            </>
          ) : (
            <p className="sc-hint">{k('allGood')}</p>
          )}
        </section>
      </div>
    </div>
  );
}

// ───────────────────────── Контент-план (календарь) ─────────────────────────

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function PlanTab({
  posts,
  channels,
  plans,
  onOpen,
  onNew,
  onPlansChanged,
  locale,
}: {
  posts: ContentPost[] | null;
  channels: ContentChannel[];
  plans: ContentPlan[];
  onOpen: (id: string) => void;
  onNew: (atIso: string) => void;
  onPlansChanged: () => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.smm2.plan.${key}`, o) as string;
  const { showAlert, showPrompt } = useAlertModal();
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [channelFilter, setChannelFilter] = useState('');
  const chById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const days = useMemo(() => {
    const out: Date[] = [];
    if (mode === 'week') {
      const start = new Date(anchor);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      for (let i = 0; i < 7; i++) out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    } else {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const start = new Date(first);
      start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
      for (let i = 0; i < 42; i++) out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return out;
  }, [mode, anchor]);

  const items = useMemo(() => {
    const m = new Map<string, Array<{ post: ContentPost; v: ContentPost['variants'][number] }>>();
    for (const p of posts || []) {
      for (const v of p.variants) {
        if (!v.publishAt) continue;
        if (channelFilter && v.channelId !== channelFilter) continue;
        const key = dayKey(new Date(v.publishAt));
        m.set(key, [...(m.get(key) || []), { post: p, v }]);
      }
    }
    for (const list of m.values()) list.sort((a, b) => String(a.v.publishAt).localeCompare(String(b.v.publishAt)));
    return m;
  }, [posts, channelFilter]);

  const unscheduled = (posts || []).filter((p) => !['published', 'rejected'].includes(p.status) && p.variants.every((v) => !v.publishAt));
  const shift = (dir: number) => setAnchor((a) => (mode === 'week' ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));
  const today = dayKey(new Date());
  const label = mode === 'week' ? `${days[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} — ${days[6].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}` : anchor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const newPlan = async () => {
    const title = await showPrompt({ title: k('newPlan'), label: k('planName'), confirmLabel: k('create'), cancelLabel: k('cancel') });
    if (!title?.trim()) return;
    try {
      await contentApi.createPlan({ title: title.trim() });
      onPlansChanged();
    } catch (e: any) {
      showAlert(e?.message || k('error'), { variant: 'error' });
    }
  };

  return (
    <div className="sc-plan">
      <div className="sc-plan-main">
        <div className="sc-toolbar">
          <div className="sc-seg">
            {(['week', 'month'] as const).map((m) => (
              <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {k(m)}
              </button>
            ))}
          </div>
          <button type="button" className="btn-icon" aria-label="‹" onClick={() => shift(-1)}>
            <Ico d={IC.left} />
          </button>
          <b className="sc-range">{label}</b>
          <button type="button" className="btn-icon" aria-label="›" onClick={() => shift(1)}>
            <Ico d={IC.right} />
          </button>
          <button type="button" className="btn-ghost" onClick={() => setAnchor(new Date())}>
            {k('today')}
          </button>
          <span className="sc-sp" />
          <select className="sc-in sc-in-sm" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
            <option value="">{k('allChannels')}</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {NET_NAME[c.network]} · {c.accountName}
              </option>
            ))}
          </select>
        </div>
        <div className={`sc-cal ${mode}`}>
          {days.slice(0, 7).map((d) => (
            <div key={`h${d.getDay()}`} className="sc-cal-dow">
              {d.toLocaleDateString(locale, { weekday: 'short' })}
            </div>
          ))}
          {days.map((d) => {
            const key = dayKey(d);
            const list = items.get(key) || [];
            const other = mode === 'month' && d.getMonth() !== anchor.getMonth();
            const past = key < today;
            return (
              <div key={key} className={`sc-cal-day${other ? ' other' : ''}${key === today ? ' today' : ''}`}>
                <div className="sc-cal-num">
                  {d.getDate()}
                  {!past ? (
                    <button
                      type="button"
                      className="sc-cal-add"
                      aria-label={k('addPost')}
                      onClick={() => {
                        const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0);
                        onNew(at.toISOString());
                      }}
                    >
                      +
                    </button>
                  ) : null}
                </div>
                <div className="sc-cal-items">
                  {list.slice(0, mode === 'month' ? 3 : 12).map(({ post, v }) => {
                    const c = chById.get(v.channelId);
                    return (
                      <button key={v.id} type="button" className={`sc-cal-it t-${VARIANT_STATUS_TONE[v.status]} p-${post.status}`} onClick={() => onOpen(post.id)} title={post.title || post.text.slice(0, 80)}>
                        {c ? <NetIcon network={c.network} size={11} /> : null}
                        <span className="tm">{new Date(v.publishAt!).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="nm">{post.title || post.text.slice(0, 40) || '—'}</span>
                      </button>
                    );
                  })}
                  {list.length > (mode === 'month' ? 3 : 12) ? <span className="sc-mut">+{list.length - (mode === 'month' ? 3 : 12)}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="sc-legend">
          {(['draft', 'review', 'scheduled', 'published', 'failed'] as PostStatus[]).map((s) => (
            <span key={s}>
              <Pill tone={POST_STATUS_TONE[s]}>{t(`crm.smm2.status.${s}`)}</Pill>
            </span>
          ))}
        </div>
      </div>

      <aside className="sc-plan-side">
        <section className="sc-card">
          <div className="sc-card-hd">
            <h3>{k('plans')}</h3>
            <button type="button" className="btn-ghost" onClick={() => void newPlan()}>
              + {k('newPlan')}
            </button>
          </div>
          <p className="sc-hint">{k('plansHint')}</p>
          {plans.length ? (
            plans.map((p) => (
              <div key={p.id} className="sc-planrow">
                <div>
                  <b>{p.title}</b>
                  <small>
                    {k('postsCount', { count: p.posts })} · {t(`crm.smm2.source.${p.source}`, p.source)}
                  </small>
                </div>
                {p.status === 'approved' ? (
                  <Pill tone="ok">{k('approved')}</Pill>
                ) : canApproveContent() ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={async () => {
                      try {
                        await contentApi.approvePlan(p.id);
                        showAlert(k('planApproved'), { variant: 'success' });
                        onPlansChanged();
                      } catch (e: any) {
                        showAlert(e?.message || k('error'), { variant: 'error' });
                      }
                    }}
                  >
                    {k('approve')}
                  </button>
                ) : (
                  <Pill tone="warn">{k('onReview')}</Pill>
                )}
              </div>
            ))
          ) : (
            <p className="sc-hint">{k('noPlans')}</p>
          )}
        </section>
        <section className="sc-card">
          <div className="sc-card-hd">
            <h3>{k('unscheduled')}</h3>
            <span className="sc-mut">{unscheduled.length}</span>
          </div>
          {unscheduled.slice(0, 12).map((p) => (
            <button key={p.id} type="button" className="sc-row" onClick={() => onOpen(p.id)}>
              <span className="sc-row-tx">
                <b>{p.title || p.text.slice(0, 60) || '—'}</b>
                <small>
                  <Pill tone={POST_STATUS_TONE[p.status]}>{t(`crm.smm2.status.${p.status}`)}</Pill>
                </small>
              </span>
            </button>
          ))}
          {!unscheduled.length ? <p className="sc-hint">{k('noUnscheduled')}</p> : null}
        </section>
      </aside>
    </div>
  );
}

// ───────────────────────── Согласование ─────────────────────────

function ReviewTab({ posts, channels, onOpen, onChanged, locale }: { posts: ContentPost[] | null; channels: ContentChannel[]; onOpen: (id: string) => void; onChanged: () => void; locale: string }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.smm2.review.${key}`, o) as string;
  const { showAlert } = useAlertModal();
  const chById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const [busy, setBusy] = useState<string | null>(null);
  const queue = (posts || []).filter((p) => p.status === 'review' || p.status === 'changes');
  const approver = canApproveContent();
  if (!posts) return <div className="sc-empty">…</div>;
  if (!queue.length)
    return (
      <div className="sc-empty">
        <b>{k('emptyTitle')}</b>
        <span>{k('emptyText')}</span>
      </div>
    );
  return (
    <div className="sc-review lv-stagger">
      {queue.map((p) => {
        const first = chById.get(p.variants[0]?.channelId || '');
        return (
          <article key={p.id} className="sc-rv">
            <PostPreview network={first?.network || 'instagram'} name={first?.accountName || ''} text={p.variants[0]?.text || p.text} media={p.media} />
            <div className="sc-rv-body">
              <div className="sc-rv-hd">
                <b>{p.title || '—'}</b>
                <Pill tone={POST_STATUS_TONE[p.status]}>{t(`crm.smm2.status.${p.status}`)}</Pill>
                {p.source !== 'manual' ? <span className="sc-src">{t(`crm.smm2.source.${p.source}`)}</span> : null}
              </div>
              <div className="sc-rv-ch">
                {p.variants.map((v) => {
                  const c = chById.get(v.channelId);
                  return c ? (
                    <span key={v.id} className="sc-rv-chip">
                      <NetIcon network={c.network} size={12} /> {c.accountName} · {fmtDateTime(v.publishAt, locale)}
                    </span>
                  ) : null;
                })}
              </div>
              {p.media.length ? (
                <div className="sc-rv-media">
                  {p.media.map((m) => (
                    <img key={m.url} src={m.url} alt="" className={m.approved === false ? 'rej' : m.approved ? 'ok' : ''} />
                  ))}
                </div>
              ) : null}
              {p.reviewNote ? <div className="sc-note warn">{p.reviewNote}</div> : null}
              <div className="sc-rv-actions">
                <button type="button" className="btn-secondary" onClick={() => onOpen(p.id)}>
                  <Ico d={IC.edit} size={13} /> {k('open')}
                </button>
                {approver && p.status === 'review' ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy === p.id}
                    onClick={async () => {
                      setBusy(p.id);
                      try {
                        await contentApi.approve(p.id);
                        showAlert(k('approved'), { variant: 'success' });
                        onChanged();
                      } catch (e: any) {
                        showAlert(e?.message || k('error'), { variant: 'error' });
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <Ico d={IC.check} size={13} /> {k('approve')}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ───────────────────────── Посты (библиотека) ─────────────────────────

const STATUS_FILTERS: Array<'all' | PostStatus> = ['all', 'draft', 'review', 'changes', 'approved', 'scheduled', 'published', 'failed', 'rejected'];

function PostsTab({ posts, channels, onOpen, locale }: { posts: ContentPost[] | null; channels: ContentChannel[]; onOpen: (id: string) => void; locale: string }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.smm2.posts.${key}`, o) as string;
  const [filter, setFilter] = useState<'all' | PostStatus>('all');
  const [q, setQ] = useState('');
  const chById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const list = (posts || []).filter((p) => (filter === 'all' || p.status === filter) && (!q.trim() || `${p.title} ${p.text} ${p.rubric || ''}`.toLowerCase().includes(q.toLowerCase())));
  if (!posts) return <div className="sc-empty">…</div>;
  return (
    <div className="sc-stack">
      <div className="sc-toolbar">
        <input className="sc-in sc-search" value={q} placeholder={k('search')} onChange={(e) => setQ(e.target.value)} />
        <div className="sc-filters">
          {STATUS_FILTERS.map((s) => (
            <button key={s} type="button" className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
              {s === 'all' ? k('all') : t(`crm.smm2.status.${s}`)}
              <span>{s === 'all' ? posts.length : posts.filter((p) => p.status === s).length}</span>
            </button>
          ))}
        </div>
      </div>
      {list.length ? (
        <div className="sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th />
                <th>{k('col.post')}</th>
                <th>{k('col.channels')}</th>
                <th>{k('col.status')}</th>
                <th>{k('col.when')}</th>
                <th>{k('col.updated')}</th>
              </tr>
            </thead>
            <tbody className="lv-stagger">
              {list.map((p) => {
                const next = p.variants.map((v) => v.publishAt).filter(Boolean).sort()[0] || null;
                return (
                  <tr key={p.id} onClick={() => onOpen(p.id)}>
                    <td className="th">{p.media[0] ? <img src={p.media[0].url} alt="" /> : <span className="ph" />}</td>
                    <td className="nm">
                      <b>{p.title || p.text.slice(0, 60) || '—'}</b>
                      <small>
                        {p.rubric ? `${p.rubric} · ` : ''}
                        {t(`crm.smm2.format.${p.format}`)}
                        {p.source !== 'manual' ? ` · ${t(`crm.smm2.source.${p.source}`)}` : ''}
                      </small>
                    </td>
                    <td>
                      <span className="sc-nets">
                        {p.variants.map((v) => {
                          const c = chById.get(v.channelId);
                          return c ? (
                            <span key={v.id} title={`${c.accountName}: ${t(`crm.smm2.vstatus.${v.status}`)}`} className={`t-${VARIANT_STATUS_TONE[v.status]}`}>
                              <NetIcon network={c.network} size={13} />
                            </span>
                          ) : null;
                        })}
                      </span>
                    </td>
                    <td>
                      <Pill tone={POST_STATUS_TONE[p.status]}>{t(`crm.smm2.status.${p.status}`)}</Pill>
                    </td>
                    <td className="mono">{fmtDateTime(next, locale)}</td>
                    <td className="mono mut">{fmtDateTime(p.updatedAt, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="sc-empty">
          <b>{k('emptyTitle')}</b>
          <span>{k('emptyText')}</span>
        </div>
      )}
    </div>
  );
}

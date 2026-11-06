/**
 * Каналы публикаций: подключённые аккаунты (режим «Предложения / Помощник / Авто», правила, отделы
 * ИИ-офиса) и подключение новых — Instagram и Facebook через Meta, Telegram-канал через бота компании,
 * LinkedIn (профиль и страница компании) через OAuth.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { contentApi, type Autonomy, type CanvaStatus, type ConnectOptions, type ContentChannel } from '../../api/content';
import { getMetaAuthUrl } from '../../api/smm';
import { aiOfficeApi } from '../../api/aiOffice';
import { canApproveContent } from './PostEditorDrawer';
import { AUTONOMY_ORDER, IC, Ico, NET_NAME, NetIcon, Pill } from './smmShared';

export function SmmChannelsTab({ channels, onChanged }: { channels: ContentChannel[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.smm2.channels.${key}`, o) as string;
  const { showAlert, showConfirm } = useAlertModal();
  const manager = canApproveContent();
  const [opts, setOpts] = useState<ConnectOptions | null>(null);
  const [optsErr, setOptsErr] = useState<string | null>(null);
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tgBot, setTgBot] = useState('');
  const [tgChannel, setTgChannel] = useState('');

  const loadOpts = () =>
    contentApi
      .options()
      .then((o) => {
        setOpts(o);
        setOptsErr(null);
        if (!tgBot && o.telegram.bots[0]) setTgBot(o.telegram.bots[0].id);
      })
      .catch((e) => setOptsErr(e?.message || k('loadError')));
  useEffect(() => {
    void loadOpts();
    aiOfficeApi
      .departments()
      .then((d) => setDepts(d.map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => setDepts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (label: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(label);
    try {
      await fn();
      if (ok) showAlert(ok, { variant: 'success' });
      onChanged();
      await loadOpts();
    } catch (e: any) {
      showAlert(e?.message || k('error'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const connectMeta = async () => {
    try {
      const r = await getMetaAuthUrl('/marketing/smm');
      window.location.href = r.url;
    } catch (e: any) {
      showAlert(e?.message || k('error'), { variant: 'error' });
    }
  };
  const [canva, setCanva] = useState<CanvaStatus | null>(null);
  useEffect(() => {
    contentApi.canvaStatus().then(setCanva).catch(() => setCanva(null));
  }, []);
  const connectCanva = async () => {
    try {
      const r = await contentApi.canvaAuthUrl();
      window.location.href = r.url;
    } catch (e: any) {
      showAlert(e?.message || k('error'), { variant: 'error' });
    }
  };
  const disconnectCanva = async () => {
    try {
      await contentApi.canvaDisconnect();
      setCanva((c) => (c ? { ...c, connected: false, name: null } : c));
    } catch (e: any) {
      showAlert(e?.message || k('error'), { variant: 'error' });
    }
  };
  const connectVideo = async (net: 'youtube' | 'tiktok') => {
    try {
      const r = net === 'youtube' ? await contentApi.youtubeAuthUrl() : await contentApi.tiktokAuthUrl();
      window.location.href = r.url;
    } catch (e: any) {
      showAlert(e?.message || k('error'), { variant: 'error' });
    }
  };
  const connectThreads = async () => {
    try {
      const r = await contentApi.threadsAuthUrl();
      window.location.href = r.url;
    } catch (e: any) {
      showAlert(e?.message || k('error'), { variant: 'error' });
    }
  };
  const connectVk = async () => {
    try {
      const r = await contentApi.vkAuthUrl();
      window.location.href = r.url;
    } catch (e: any) {
      showAlert(e?.message || k('error'), { variant: 'error' });
    }
  };
  const connectLinkedin = async () => {
    try {
      const r = await contentApi.linkedinAuthUrl();
      window.location.href = r.url;
    } catch (e: any) {
      showAlert(e?.message || k('error'), { variant: 'error' });
    }
  };

  return (
    <div className="sc-stack">
      {/* подключённые */}
      <section className="sc-card">
        <div className="sc-card-hd">
          <h3>{k('connectedTitle')}</h3>
          <span className="sc-mut">{channels.length}</span>
        </div>
        <p className="sc-hint">{k('modesHint')}</p>
        {channels.length ? (
          <div className="sc-chlist">
            {channels.map((c) => (
              <ChannelCard
                key={c.id}
                c={c}
                depts={depts}
                manager={manager}
                onPatch={(body) => run(`ch:${c.id}`, () => contentApi.updateChannel(c.id, body))}
                onRemove={async () => {
                  if (!(await showConfirm(k('removeConfirm', { name: c.accountName }), { title: k('remove'), confirmLabel: k('remove'), cancelLabel: k('cancel'), danger: true }))) return;
                  await run(`rm:${c.id}`, () => contentApi.removeChannel(c.id));
                }}
              />
            ))}
          </div>
        ) : (
          <p className="sc-hint">{k('noneYet')}</p>
        )}
      </section>

      {/* подключить */}
      <section className="sc-card">
        <div className="sc-card-hd">
          <h3>{k('addTitle')}</h3>
        </div>
        {optsErr ? <div className="sc-note err">{optsErr}</div> : null}
        {!opts ? (
          <p className="sc-hint">…</p>
        ) : (
          <div className="sc-connect">
            {/* Instagram + Facebook */}
            <div className="sc-conn">
              <div className="sc-conn-hd">
                <span className="sc-conn-ic">
                  <NetIcon network="instagram" size={17} />
                </span>
                <span className="sc-conn-ic">
                  <NetIcon network="facebook" size={17} />
                </span>
                <div>
                  <b>Instagram · Facebook</b>
                  <small>{k('metaHint')}</small>
                </div>
                {opts.meta.connected ? <Pill tone="ok">{k('connected')}</Pill> : null}
              </div>
              {!opts.meta.connected ? (
                <button type="button" className="btn-secondary" disabled={!manager} onClick={() => void connectMeta()}>
                  <Ico d={IC.plug} size={13} /> {k('connectMeta')}
                </button>
              ) : opts.meta.pages.length ? (
                <div className="sc-targets">
                  {opts.meta.pages.map((p) => (
                    <div key={p.pageId} className="sc-target">
                      {p.picture ? <img src={p.picture} alt="" /> : <span className="ph" />}
                      <span className="sc-target-tx">
                        <b>{p.name}</b>
                        <small>{p.instagram ? `Instagram @${p.instagram.username ?? p.instagram.id}` : k('noInstagram')}</small>
                      </span>
                      {p.instagram ? (
                        <button type="button" className="btn-secondary" disabled={!manager || p.instagram.added || !!busy} onClick={() => void run('ig', () => contentApi.addChannel({ network: 'instagram', pageId: p.pageId, igUserId: p.instagram!.id }), k('added'))}>
                          <NetIcon network="instagram" size={12} /> {p.instagram.added ? k('isAdded') : k('addInstagram')}
                        </button>
                      ) : null}
                      <button type="button" className="btn-secondary" disabled={!manager || p.facebookAdded || !!busy} onClick={() => void run('fb', () => contentApi.addChannel({ network: 'facebook', pageId: p.pageId }), k('added'))}>
                        <NetIcon network="facebook" size={12} /> {p.facebookAdded ? k('isAdded') : k('addFacebook')}
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn-ghost" disabled={!manager} onClick={() => void connectMeta()}>
                    {k('reconnectMeta')}
                  </button>
                </div>
              ) : (
                <>
                  <p className="sc-hint">{opts.meta.error || k('noPages')}</p>
                  <button type="button" className="btn-ghost" disabled={!manager} onClick={() => void connectMeta()}>
                    {k('reconnectMeta')}
                  </button>
                </>
              )}
            </div>

            {/* Telegram */}
            <div className="sc-conn">
              <div className="sc-conn-hd">
                <span className="sc-conn-ic">
                  <NetIcon network="telegram" size={17} />
                </span>
                <div>
                  <b>{k('telegramTitle')}</b>
                  <small>{k('telegramHint')}</small>
                </div>
              </div>
              {opts.telegram.bots.length ? (
                <div className="sc-tg-form">
                  <select className="sc-in" value={tgBot} onChange={(e) => setTgBot(e.target.value)}>
                    {opts.telegram.bots.map((b) => (
                      <option key={b.id} value={b.id}>
                        @{b.username || b.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <input className="sc-in" value={tgChannel} placeholder="@my_channel" onChange={(e) => setTgChannel(e.target.value)} />
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!manager || !tgChannel.trim() || !!busy}
                    onClick={() => void run('tg', () => contentApi.addChannel({ network: 'telegram', botId: tgBot, channel: tgChannel.trim() }), k('added')).then(() => setTgChannel(''))}
                  >
                    {k('add')}
                  </button>
                </div>
              ) : (
                <p className="sc-hint">
                  {k('noBots')} <a href="/telegram">{k('openTelegram')}</a>
                </p>
              )}
            </div>

            {/* LinkedIn */}
            <div className="sc-conn">
              <div className="sc-conn-hd">
                <span className="sc-conn-ic">
                  <NetIcon network="linkedin" size={17} />
                </span>
                <div>
                  <b>LinkedIn</b>
                  <small>{opts.linkedin.orgEnabled ? k('linkedinHintOrg') : k('linkedinHint')}</small>
                </div>
              </div>
              {!opts.linkedin.configured ? (
                <p className="sc-hint">{k('linkedinNotConfigured')}</p>
              ) : (
                <div className="sc-targets">
                  {opts.linkedin.connections.flatMap((c) =>
                    c.targets.map((tg) => (
                      <div key={tg.urn} className="sc-target">
                        {tg.kind === 'person' && c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : <span className="ph" />}
                        <span className="sc-target-tx">
                          <b>{tg.name}</b>
                          <small>
                            {tg.kind === 'person' ? k('linkedinPerson') : k('linkedinOrg')}
                            {c.expiresAt ? ` · ${k('until', { date: new Date(c.expiresAt).toLocaleDateString() })}` : ''}
                          </small>
                        </span>
                        <button type="button" className="btn-secondary" disabled={!manager || tg.added || !!busy} onClick={() => void run('li', () => contentApi.addChannel({ network: 'linkedin', connectionId: c.id, urn: tg.urn }), k('added'))}>
                          {tg.added ? k('isAdded') : k('add')}
                        </button>
                      </div>
                    )),
                  )}
                  <button type="button" className={opts.linkedin.connections.length ? 'btn-ghost' : 'btn-secondary'} disabled={!manager} onClick={() => void connectLinkedin()}>
                    <Ico d={IC.plug} size={13} /> {opts.linkedin.connections.length ? k('reconnectLinkedin') : k('connectLinkedin')}
                  </button>
                </div>
              )}
            </div>

            {/* YouTube */}
            <div className="sc-conn">
              <div className="sc-conn-hd">
                <span className="sc-conn-ic">
                  <NetIcon network="youtube" size={17} />
                </span>
                <div>
                  <b>YouTube</b>
                  <small>{k('youtubeHint')}</small>
                </div>
              </div>
              {!opts.youtube?.configured ? (
                <p className="sc-hint">{k('youtubeNotConfigured')}</p>
              ) : (
                <div className="sc-targets">
                  {opts.youtube.connections.map((c) => (
                    <div key={c.id} className="sc-target">
                      {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : <span className="ph" />}
                      <span className="sc-target-tx">
                        <b>{c.name || 'YouTube'}</b>
                        <small>{c.username || k('youtubeAccount')}</small>
                      </span>
                      <button type="button" className="btn-secondary" disabled={!manager || c.added || !!busy} onClick={() => void run('youtube', () => contentApi.addChannel({ network: 'youtube', connectionId: c.id }), k('added'))}>
                        {c.added ? k('isAdded') : k('add')}
                      </button>
                    </div>
                  ))}
                  <button type="button" className={opts.youtube.connections.length ? 'btn-ghost' : 'btn-secondary'} disabled={!manager} onClick={() => void connectVideo('youtube')}>
                    <Ico d={IC.plug} size={13} /> {opts.youtube.connections.length ? k('reconnectYouTube') : k('connectYouTube')}
                  </button>
                </div>
              )}
            </div>

            {/* TikTok */}
            <div className="sc-conn">
              <div className="sc-conn-hd">
                <span className="sc-conn-ic">
                  <NetIcon network="tiktok" size={17} />
                </span>
                <div>
                  <b>TikTok</b>
                  <small>{k('tiktokHint')}</small>
                </div>
              </div>
              {!opts.tiktok?.configured ? (
                <p className="sc-hint">{k('tiktokNotConfigured')}</p>
              ) : (
                <div className="sc-targets">
                  {opts.tiktok.connections.map((c) => (
                    <div key={c.id} className="sc-target">
                      {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : <span className="ph" />}
                      <span className="sc-target-tx">
                        <b>{c.name || 'TikTok'}</b>
                        <small>{c.username || k('tiktokAccount')}</small>
                      </span>
                      <button type="button" className="btn-secondary" disabled={!manager || c.added || !!busy} onClick={() => void run('tiktok', () => contentApi.addChannel({ network: 'tiktok', connectionId: c.id }), k('added'))}>
                        {c.added ? k('isAdded') : k('add')}
                      </button>
                    </div>
                  ))}
                  <button type="button" className={opts.tiktok.connections.length ? 'btn-ghost' : 'btn-secondary'} disabled={!manager} onClick={() => void connectVideo('tiktok')}>
                    <Ico d={IC.plug} size={13} /> {opts.tiktok.connections.length ? k('reconnectTikTok') : k('connectTikTok')}
                  </button>
                </div>
              )}
            </div>

            {/* Threads */}
            <div className="sc-conn">
              <div className="sc-conn-hd">
                <span className="sc-conn-ic">
                  <NetIcon network="threads" size={17} />
                </span>
                <div>
                  <b>Threads</b>
                  <small>{k('threadsHint')}</small>
                </div>
              </div>
              {!opts.threads?.configured ? (
                <p className="sc-hint">{k('threadsNotConfigured')}</p>
              ) : (
                <div className="sc-targets">
                  {opts.threads.connections.map((c) => (
                    <div key={c.id} className="sc-target">
                      {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : <span className="ph" />}
                      <span className="sc-target-tx">
                        <b>{c.name || 'Threads'}</b>
                        <small>{c.expiresAt ? k('until', { date: new Date(c.expiresAt).toLocaleDateString() }) : k('threadsProfile')}</small>
                      </span>
                      <button type="button" className="btn-secondary" disabled={!manager || c.added || !!busy} onClick={() => void run('th', () => contentApi.addChannel({ network: 'threads', connectionId: c.id }), k('added'))}>
                        {c.added ? k('isAdded') : k('add')}
                      </button>
                    </div>
                  ))}
                  <button type="button" className={opts.threads.connections.length ? 'btn-ghost' : 'btn-secondary'} disabled={!manager} onClick={() => void connectThreads()}>
                    <Ico d={IC.plug} size={13} /> {opts.threads.connections.length ? k('reconnectThreads') : k('connectThreads')}
                  </button>
                </div>
              )}
            </div>

            {/* Canva — источник картинок, не канал */}
            <div className="sc-conn">
              <div className="sc-conn-hd">
                <span className="sc-conn-ic sc-canva-ic">C</span>
                <div>
                  <b>Canva</b>
                  <small>{k('canvaHint')}</small>
                </div>
              </div>
              {!canva?.configured ? (
                <p className="sc-hint">{k('canvaNotConfigured')}</p>
              ) : canva.connected ? (
                <div className="sc-targets">
                  <div className="sc-target">
                    <span className="ph" />
                    <span className="sc-target-tx">
                      <b>{canva.name || 'Canva'}</b>
                      <small>{k('canvaConnected')}</small>
                    </span>
                    <button type="button" className="btn-ghost" disabled={!manager} onClick={() => void disconnectCanva()}>
                      {k('remove')}
                    </button>
                  </div>
                  <button type="button" className="btn-ghost" disabled={!manager} onClick={() => void connectCanva()}>
                    <Ico d={IC.plug} size={13} /> {k('reconnectCanva')}
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-secondary" disabled={!manager} onClick={() => void connectCanva()}>
                  <Ico d={IC.plug} size={13} /> {k('connectCanva')}
                </button>
              )}
            </div>

            {/* VK */}
            <div className="sc-conn">
              <div className="sc-conn-hd">
                <span className="sc-conn-ic">
                  <NetIcon network="vk" size={17} />
                </span>
                <div>
                  <b>VK</b>
                  <small>{k('vkHint')}</small>
                </div>
              </div>
              {!opts.vk?.configured ? (
                <p className="sc-hint">{k('vkNotConfigured')}</p>
              ) : (
                <div className="sc-targets">
                  {opts.vk.connections.flatMap((c) =>
                    c.groups.map((g) => (
                      <div key={`${c.id}-${g.id}`} className="sc-target">
                        {g.photo ? <img src={g.photo} alt="" /> : <span className="ph" />}
                        <span className="sc-target-tx">
                          <b>{g.name}</b>
                          <small>{g.screenName ? `vk.com/${g.screenName}` : k('vkGroup')}{c.name ? ` · ${c.name}` : ''}</small>
                        </span>
                        <button type="button" className="btn-secondary" disabled={!manager || g.added || !!busy} onClick={() => void run('vk', () => contentApi.addChannel({ network: 'vk', connectionId: c.id, groupId: g.id }), k('added'))}>
                          {g.added ? k('isAdded') : k('add')}
                        </button>
                      </div>
                    )),
                  )}
                  {opts.vk.connections.length && !opts.vk.connections.some((c) => c.groups.length) ? <p className="sc-hint">{k('vkNoGroups')}</p> : null}
                  <button type="button" className={opts.vk.connections.length ? 'btn-ghost' : 'btn-secondary'} disabled={!manager} onClick={() => void connectVk()}>
                    <Ico d={IC.plug} size={13} /> {opts.vk.connections.length ? k('reconnectVk') : k('connectVk')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ChannelCard({
  c,
  depts,
  manager,
  onPatch,
  onRemove,
}: {
  c: ContentChannel;
  depts: Array<{ id: string; name: string }>;
  manager: boolean;
  onPatch: (body: Partial<Pick<ContentChannel, 'autonomy' | 'enabled' | 'rules' | 'departmentIds'>>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.smm2.channels.${key}`, o) as string;
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(String(c.rules.dailyLimit ?? ''));
  const [hashtags, setHashtags] = useState(c.rules.hashtags ?? '');
  const [signature, setSignature] = useState(c.rules.signature ?? '');
  return (
    <div className={`sc-ch${c.enabled ? '' : ' off'}${c.status !== 'ok' ? ' broken' : ''}`}>
      <div className="sc-ch-hd">
        {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="sc-ch-av" /> : <span className="sc-ch-av ph"><NetIcon network={c.network} size={16} /></span>}
        <div className="sc-ch-tx">
          <b>
            <NetIcon network={c.network} size={12} /> {c.accountName}
          </b>
          <small>
            {NET_NAME[c.network]}
            {c.rules.kind === 'organization' ? ` · ${k('linkedinOrg')}` : c.rules.kind === 'person' ? ` · ${k('linkedinPerson')}` : ''}
          </small>
        </div>
        {c.status !== 'ok' ? <Pill tone="err">{k('broken')}</Pill> : null}
        <label className="sc-switch" title={c.enabled ? k('enabled') : k('disabled')}>
          <input type="checkbox" className="lv-native" checked={c.enabled} disabled={!manager} onChange={(e) => onPatch({ enabled: e.target.checked })} />
          <i />
        </label>
      </div>
      {c.lastError && c.status !== 'ok' ? <div className="sc-err">{c.lastError}</div> : null}
      <div className="sc-modes" role="radiogroup" aria-label={k('mode')}>
        {AUTONOMY_ORDER.map((m: Autonomy) => (
          <button key={m} type="button" role="radio" aria-checked={c.autonomy === m} disabled={!manager} className={c.autonomy === m ? 'on' : ''} onClick={() => onPatch({ autonomy: m })}>
            <b>{t(`crm.smm2.autonomy.${m}`)}</b>
            <small>{t(`crm.smm2.autonomyHint.${m}`)}</small>
          </button>
        ))}
      </div>
      <button type="button" className="sc-more" onClick={() => setOpen((x) => !x)}>
        {open ? k('less') : k('more')}
      </button>
      {open ? (
        <div className="sc-ch-more">
          <label className="sc-f">
            <span>{k('dailyLimit')}</span>
            <input className="sc-in" type="number" min={0} max={50} value={limit} disabled={!manager} onChange={(e) => setLimit(e.target.value)} onBlur={() => onPatch({ rules: { dailyLimit: Number(limit) || 0 } })} />
          </label>
          <label className="sc-f">
            <span>{k('hashtags')}</span>
            <input className="sc-in" value={hashtags} disabled={!manager} placeholder="#brand #city" onChange={(e) => setHashtags(e.target.value)} onBlur={() => onPatch({ rules: { hashtags } })} />
          </label>
          <label className="sc-f">
            <span>{k('signature')}</span>
            <input className="sc-in" value={signature} disabled={!manager} onChange={(e) => setSignature(e.target.value)} onBlur={() => onPatch({ rules: { signature } })} />
          </label>
          {depts.length ? (
            <div className="sc-f">
              <span>{k('departments')}</span>
              <div className="sc-chips">
                {depts.map((d) => {
                  const on = c.departmentIds.includes(d.id);
                  return (
                    <button key={d.id} type="button" className={`sc-chip${on ? ' on' : ''}`} disabled={!manager} onClick={() => onPatch({ departmentIds: on ? c.departmentIds.filter((x) => x !== d.id) : [...c.departmentIds, d.id] })}>
                      {d.name}
                    </button>
                  );
                })}
              </div>
              <small className="sc-mut">{c.departmentIds.length ? k('departmentsSome') : k('departmentsAll')}</small>
            </div>
          ) : null}
          {manager ? (
            <button type="button" className="btn-danger" onClick={onRemove}>
              {k('remove')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

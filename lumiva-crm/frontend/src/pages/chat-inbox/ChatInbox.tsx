import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import './chat-inbox.css';
import { MessengerAiPauseBar } from '../../components/ai/MessengerAiPauseBar';

/**
 * Диалоги WhatsApp / Telegram — порт Claude Design (whatsapp-inbox.html / telegram-inbox.html,
 * components/inbox-chat.jsx). Один компонент на оба канала: всё, что отличается (API, подписи,
 * цвет), приходит через ChatChannelAdapter из страниц WhatsappInboxPage / TelegramInboxPage.
 */

export type ChatAttachmentKind = 'photo' | 'document' | 'voice' | 'video' | 'other';

export type ChatMsg = {
  id: string;
  direction: 'incoming' | 'outgoing';
  text: string | null;
  type: string;
  date: string;
  source: 'manual' | 'ai' | 'flow';
  attachments: Array<{ kind: ChatAttachmentKind; fileName?: string; fileSize?: number; index: number }>;
};

export type ChatContact = {
  id: string;
  name: string;
  handle: string;
  channelId: string; // Telegram ID / номер телефона — для строки «Канал»
  senderId: string | null;
  unread: number;
  lastMessage: ChatMsg | null;
  lead: { id: string; name: string | null; status: string | null; ownerName: string | null } | null;
  crmContact: { id: string; name: string | null } | null;
  crmCompany: { id: string; name: string | null } | null;
  messageCount: number;
  firstMessageAt: string | null;
};

export type ChatSender = { id: string; name: string; handle: string };

export type ChatChannelAdapter = {
  key: 'whatsapp' | 'telegram';
  accent: string;
  loadSenders: () => Promise<ChatSender[]>;
  loadContacts: (search: string) => Promise<ChatContact[]>;
  loadMessages: (contactId: string) => Promise<ChatMsg[]>;
  markRead: (contactId: string) => Promise<unknown>;
  sendText: (contact: ChatContact, senderId: string, text: string) => Promise<unknown>;
  sendFile: (contact: ChatContact, senderId: string, file: File, caption: string) => Promise<unknown>;
  attachmentUrl: (messageId: string, index: number) => Promise<string>;
  createLead: (contactId: string) => Promise<{ leadId: string }>;
  settingsHref: string;
};

const CHANNELS: Array<{ key: 'telegram' | 'whatsapp'; href: string; accent: string; name: string }> = [
  { key: 'telegram', href: '/telegram/inbox', accent: '#229ED9', name: 'Telegram' },
  { key: 'whatsapp', href: '/whatsapp/inbox', accent: '#1FA855', name: 'WhatsApp' },
];

const FILE_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'];
const FILE_MAX = 50 * 1024 * 1024;
const POLL_VISIBLE_MS = 4000;
const POLL_HIDDEN_MS = 12000;

const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

const XI: Record<string, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  send: <path d="M4 12l16-7-7 16-2.5-6.5z" />,
  clip: <path d="M20.5 11.5 12.3 19.7a4.8 4.8 0 0 1-6.8-6.8l8.2-8.2a3.2 3.2 0 0 1 4.5 4.5l-8.2 8.2a1.6 1.6 0 0 1-2.2-2.2l7.5-7.5" />,
  refresh: <><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5" /><path d="M20 20v-4.5h-4.5" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M15 4v16" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  img: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-9 9" /></>,
  play: <path d="M8 5v14l11-7z" />,
  ai: <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" />,
  bot: <><rect x="5" y="8" width="14" height="11" rx="2" /><path d="M12 4v4M9 13h.01M15 13h.01" /></>,
  lead: <><path d="M3 12c0-5 4-9 9-9s9 4 9 9-4 9-9 9" /><path d="M3 12l4-4M3 12l4 4" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" /></>,
  co: <><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h6" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  check2: <><path d="M2 12.5l4 4L14 8" /><path d="M10 16.5l1 0L20 8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
};

function Ic({ d, size = 16 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d}
    </svg>
  );
}

const initials = (n: string) =>
  /^\+/.test(n)
    ? n.replace(/\D/g, '').slice(-2)
    : n.replace(/^@/, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '··';

function Ava({ n, size }: { n: string; size: number }) {
  return <div className="ix-ava" style={{ width: size, height: size }}>{initials(n)}</div>;
}

const fmtSize = (b?: number) => (!b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function ChatInbox({ adapter }: { adapter: ChatChannelAdapter }) {
  const { t, i18n } = useTranslation();
  const k = (key: string, opts?: Record<string, unknown>) => t(`crm.chatInbox.${key}`, opts);
  const channelName = adapter.key === 'telegram' ? 'Telegram' : 'WhatsApp';
  const locale = i18n.language || 'ru';

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [senders, setSenders] = useState<ChatSender[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  /** Ручной ответ ставит ИИ-консультанта на паузу — перечитываем плашку сразу после отправки. */
  const [aiBump, setAiBump] = useState(0);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState<'all' | 'unread' | 'nolead'>('all');
  const [sender, setSender] = useState('all');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [rail, setRail] = useState(true);
  const [mobileThread, setMobileThread] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [media, setMedia] = useState<Record<string, string>>({});
  const scRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const selRef = useRef<string | null>(null);
  const searchRef = useRef('');
  const mediaRef = useRef<Record<string, string>>({});
  selRef.current = sel;
  searchRef.current = q;

  const cur = contacts.find((c) => c.id === sel) || null;

  // ─── загрузка ───
  const loadContacts = useCallback(async () => {
    try {
      const list = await adapter.loadContacts(searchRef.current.trim());
      setContacts(list);
    } catch {
      /* список останется прежним — следующая попытка через интервал */
    } finally {
      setLoadingList(false);
    }
  }, [adapter]);

  const loadMsgs = useCallback(
    async (contactId: string, silent = false) => {
      if (!silent) setLoadingMsgs(true);
      try {
        const list = await adapter.loadMessages(contactId);
        if (selRef.current === contactId) setMsgs(list);
      } catch {
        /* no-op */
      } finally {
        if (!silent) setLoadingMsgs(false);
      }
    },
    [adapter],
  );

  useEffect(() => {
    adapter.loadSenders().then(setSenders).catch(() => setSenders([]));
    void loadContacts();
  }, [adapter, loadContacts]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadContacts(), 300);
    return () => window.clearTimeout(id);
  }, [q, loadContacts]);

  // Живых пушей нет — входящие приходят вебхуком, поэтому опрос: чаще, пока вкладка открыта.
  useEffect(() => {
    let last = 0;
    const id = window.setInterval(() => {
      const every = document.visibilityState === 'visible' ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
      if (Date.now() - last < every) return;
      last = Date.now();
      void loadContacts();
      if (selRef.current) void loadMsgs(selRef.current, true);
    }, 1000);
    return () => window.clearInterval(id);
  }, [loadContacts, loadMsgs]);

  useEffect(() => {
    if (!sel && contacts.length && window.innerWidth > 760) setSel(contacts[0].id);
  }, [contacts, sel]);

  useEffect(() => {
    if (!sel) return;
    setMsgs([]);
    setErr('');
    void loadMsgs(sel);
    adapter
      .markRead(sel)
      .then(() => setContacts((l) => l.map((c) => (c.id === sel ? { ...c, unread: 0 } : c))))
      .catch(() => undefined);
  }, [sel, adapter, loadMsgs]);

  useEffect(() => {
    if (scRef.current) scRef.current.scrollTop = scRef.current.scrollHeight;
  }, [sel, msgs.length]);

  useEffect(
    () => () => {
      Object.values(mediaRef.current).forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  // ─── вложения ───
  const pendingRef = useRef<Map<string, Promise<string>>>(new Map());
  const getMedia = useCallback(
    (msgId: string, index: number): Promise<string> => {
      const key = `${msgId}:${index}`;
      if (mediaRef.current[key]) return Promise.resolve(mediaRef.current[key]);
      const pending = pendingRef.current.get(key);
      if (pending) return pending;
      const p = adapter
        .attachmentUrl(msgId, index)
        .then((url) => {
          mediaRef.current = { ...mediaRef.current, [key]: url };
          setMedia(mediaRef.current);
          return url;
        })
        .finally(() => pendingRef.current.delete(key));
      pendingRef.current.set(key, p);
      return p;
    },
    [adapter],
  );

  // Превью фото — подгружаются, как только сообщения на экране
  useEffect(() => {
    msgs.forEach((m) =>
      m.attachments.forEach((a) => {
        if (a.kind === 'photo') void getMedia(m.id, a.index).catch(() => undefined);
      }),
    );
  }, [msgs, getMedia]);

  const openDoc = async (m: ChatMsg, a: ChatMsg['attachments'][number]) => {
    try {
      const url = await getMedia(m.id, a.index);
      const link = document.createElement('a');
      link.href = url;
      if (a.fileName && !/\.pdf$/i.test(a.fileName)) link.download = a.fileName;
      else link.target = '_blank';
      link.click();
    } catch {
      setErr(k('errors.fileUnavailable'));
    }
  };

  // ─── производные ───
  const unreadTotal = contacts.reduce((a, c) => a + c.unread, 0);
  const counts = {
    all: contacts.length,
    unread: contacts.filter((c) => c.unread).length,
    nolead: contacts.filter((c) => !c.lead).length,
  };
  const shown = useMemo(
    () =>
      contacts.filter((c) => {
        if (flt === 'unread' && !c.unread) return false;
        if (flt === 'nolead' && c.lead) return false;
        if (sender !== 'all' && c.senderId !== sender) return false;
        return true;
      }),
    [contacts, flt, sender],
  );
  const senderOf = (c: ChatContact | null) => (c && senders.find((s) => s.id === c.senderId)) || senders[0] || null;
  const snd = senderOf(cur);

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const y = new Date();
    y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return k('today');
    if (d.toDateString() === y.toDateString()) return k('yesterday');
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  };
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const listTime = (iso: string) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString() ? timeOf(iso) : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  };
  const typeLabel = (m: ChatMsg) => {
    const a = m.attachments[0];
    const base = k(`type.${a?.kind || (m.type === 'location' ? 'location' : 'other')}`);
    return a?.fileName ? `${base} · ${a.fileName}` : base;
  };
  const preview = (m: ChatMsg | null) => {
    if (!m) return '';
    const body = m.attachments.length || m.type !== 'text' ? (m.text ? `${typeLabel(m)} · ${m.text}` : typeLabel(m)) : m.text || '';
    if (m.direction !== 'outgoing') return body;
    return `${k(`src.${m.source}`)}: ${body}`;
  };
  const leadStatus = (s: string | null) => (s ? t(`crm.chatInbox.leadStatus.${s}`, { defaultValue: s }) : '');

  // ─── действия ───
  const open = (id: string) => {
    setSel(id);
    setMobileThread(true);
  };

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!FILE_EXT.includes(ext)) return setErr(k('errors.fileType'));
    if (f.size > FILE_MAX) return setErr(k('errors.fileSize'));
    setErr('');
    setFile(f);
  };

  const send = async () => {
    const body = text.trim();
    if (!cur || !snd || sending || (!body && !file)) return;
    setSending(true);
    setErr('');
    try {
      if (file) await adapter.sendFile(cur, snd.id, file, body);
      else await adapter.sendText(cur, snd.id, body);
      setAiBump((n) => n + 1);
      setText('');
      setFile(null);
      if (taRef.current) taRef.current.style.height = '';
      await loadMsgs(cur.id, true);
      void loadContacts();
    } catch (e) {
      setErr((e as Error)?.message || k('errors.send'));
    } finally {
      setSending(false);
    }
  };

  const createLead = async () => {
    if (!cur || creatingLead) return;
    setCreatingLead(true);
    try {
      await adapter.createLead(cur.id);
      await loadContacts();
    } catch (e) {
      setErr((e as Error)?.message || k('errors.lead'));
    } finally {
      setCreatingLead(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };
  const grow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  // ─── рендер ───
  const renderAttachment = (m: ChatMsg, a: ChatMsg['attachments'][number]) => {
    const key = `${m.id}:${a.index}`;
    if (a.kind === 'photo') {
      const url = media[key];
      return (
        <button key={key} type="button" className="ix-att photo" onClick={() => url && setLightbox(url)}>
          {url ? <img src={url} alt={a.fileName || ''} /> : <div className="ph"><Ic d={XI.img} size={22} /><span>{k('loading')}</span></div>}
        </button>
      );
    }
    if (a.kind === 'voice' || a.kind === 'video') {
      const url = media[key];
      return (
        <div key={key} className="ix-att doc">
          {url ? (
            a.kind === 'voice' ? <audio src={url} controls autoPlay /> : <video src={url} controls style={{ maxWidth: 260, borderRadius: 8 }} />
          ) : (
            <>
              <button type="button" className="ix-ib" onClick={() => void getMedia(m.id, a.index).catch(() => setErr(k('errors.fileUnavailable')))}>
                <Ic d={XI.play} size={12} />
              </button>
              <div><div className="nm">{k(`type.${a.kind}`)}</div></div>
            </>
          )}
        </div>
      );
    }
    return (
      <button key={key} type="button" className="ix-att doc" onClick={() => void openDoc(m, a)}>
        <div className="ic"><Ic d={XI.file} size={16} /></div>
        <div>
          <div className="nm">{a.fileName || k('type.document')}</div>
          <div className="sz">{fmtSize(a.fileSize) || k('open')}</div>
        </div>
      </button>
    );
  };

  const bubbles: React.ReactNode[] = [];
  let lastDay = '';
  msgs.forEach((m) => {
    const day = dayLabel(m.date);
    if (day !== lastDay) {
      bubbles.push(<div key={`d-${m.id}`} className="ix-day"><span>{day}</span></div>);
      lastDay = day;
    }
    const out = m.direction === 'outgoing';
    const auto = out && m.source !== 'manual';
    bubbles.push(
      <div key={m.id} className={cx('ix-msg', out ? 'out' : 'in', auto && 'auto')}>
        <div className="b">
          {auto && (
            <div className="src">
              <Ic d={m.source === 'ai' ? XI.ai : XI.bot} size={11} />
              {m.source === 'ai' ? k('aiReply') : k('botReply')}
            </div>
          )}
          {m.attachments.map((a) => renderAttachment(m, a))}
          {!m.attachments.length && m.type !== 'text' && !m.text && <div className="tx">[{typeLabel(m)}]</div>}
          {m.text && <div className="tx">{m.text}</div>}
          <div className="meta">
            {timeOf(m.date)}
            {out && <Ic d={XI.check2} size={13} />}
          </div>
        </div>
      </div>,
    );
  });

  const accentOf = (key: string) => CHANNELS.find((c) => c.key === key)?.accent || adapter.accent;

  return (
    <MainLayout>
      <div className="ix" style={{ ['--ch' as string]: adapter.accent }}>
        <div className="ix-head">
          <div>
            <div className="kick"><span className="chd" />{k('kicker', { channel: channelName })}</div>
            <h1>{k('title', { channel: channelName })}</h1>
          </div>
          <div className="ix-head-r">
            <div className="ix-seg">
              {CHANNELS.map((o) => (
                <Link key={o.key} to={o.href} className={cx(o.key === adapter.key && 'on')} style={{ ['--ch' as string]: accentOf(o.key) }}>
                  <span className="chd" />
                  {o.name}
                  {o.key === adapter.key && unreadTotal > 0 && <span className="n">{unreadTotal}</span>}
                </Link>
              ))}
            </div>
            <Link className="e2b gh sm" to={adapter.settingsHref}>{k(`settings.${adapter.key}`)}</Link>
          </div>
        </div>

        <div className={cx('ix-wrap', !rail && 'norail', mobileThread && 'm-thread')}>
          {/* список */}
          <aside className="ix-list">
            <div className="ix-list-top">
              <label className="ix-search">
                <Ic d={XI.search} size={14} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={k(`searchPlaceholder.${adapter.key}`)} />
              </label>
              <div className="ix-flt">
                {(['all', 'unread', 'nolead'] as const).map((f) => (
                  <button key={f} type="button" className={cx(flt === f && 'on')} onClick={() => setFlt(f)}>
                    {k(`filter.${f}`)}
                    <span>{counts[f]}</span>
                  </button>
                ))}
              </div>
              {senders.length > 1 && (
                <select className="ix-sel" value={sender} onChange={(e) => setSender(e.target.value)}>
                  <option value="all">{k(`allSenders.${adapter.key}`)}</option>
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>{s.handle ? `${s.name} · ${s.handle}` : s.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="ix-rows">
              {loadingList && <div className="ix-empty-s">{k('loading')}</div>}
              {!loadingList && !contacts.length && <div className="ix-empty-s">{k(`emptyList.${adapter.key}`)}</div>}
              {!loadingList && !!contacts.length && !shown.length && <div className="ix-empty-s">{k('emptyFilter')}</div>}
              {shown.map((c) => (
                <button key={c.id} type="button" className={cx('ix-row', c.id === sel && 'sel', c.unread > 0 && 'un')} onClick={() => open(c.id)}>
                  <Ava n={c.name} size={38} />
                  <div className="mid">
                    <div className="l1">
                      <span className="nm">{c.name}</span>
                      <span className="tm">{c.lastMessage ? listTime(c.lastMessage.date) : ''}</span>
                    </div>
                    <div className="l2">
                      <span className="pv">{preview(c.lastMessage)}</span>
                      {c.unread > 0 && <span className="badge">{c.unread}</span>}
                    </div>
                    <div className="l3">
                      {c.lead ? (
                        <span className="lt">{c.lead.name || k('lead')} · {leadStatus(c.lead.status)}</span>
                      ) : (
                        <span className="lt none">{k('noLead')}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* переписка */}
          <section
            className="ix-thread"
            onDragOver={(e) => {
              if (!cur) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (cur) pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            {dragOver && <div className="ix-drop">{k('dropFile')}</div>}
            {!cur ? (
              <div className="ix-empty">{k('selectDialog')}</div>
            ) : (
              <>
                <div className="ix-th-head">
                  <button type="button" className="ix-ib m-only" onClick={() => setMobileThread(false)} title={k('back')}>
                    <Ic d={XI.back} size={16} />
                  </button>
                  <Ava n={cur.name} size={36} />
                  <div className="who">
                    <div className="nm">{cur.name}</div>
                    <div className="hd">
                      {cur.handle}
                      {snd && (
                        <>
                          <span className="sep" />
                          {k('via', { sender: snd.name })}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="acts">
                    {cur.lead ? (
                      <Link className="e2b sm" to={`/leads/${cur.lead.id}`}><Ic d={XI.lead} size={13} />{k('openLead')}</Link>
                    ) : (
                      <button type="button" className="e2b sm" onClick={() => void createLead()} disabled={creatingLead}>
                        <Ic d={XI.plus} size={13} />{k('createLead')}
                      </button>
                    )}
                    <button type="button" className="ix-ib" title={k('refresh')} onClick={() => { void loadMsgs(cur.id); void loadContacts(); }}>
                      <Ic d={XI.refresh} size={15} />
                    </button>
                    <button type="button" className={cx('ix-ib', rail && 'on')} onClick={() => setRail(!rail)} title={k('card')}>
                      <Ic d={XI.panel} size={15} />
                    </button>
                  </div>
                </div>
                <div className="ix-msgs" ref={scRef}>
                  {loadingMsgs && !msgs.length && <div className="ix-empty">{k('loading')}</div>}
                  {!loadingMsgs && !msgs.length && <div className="ix-empty">{k('noMessages')}</div>}
                  {bubbles}
                </div>
                <div className="ix-comp">
                  <MessengerAiPauseBar channel={adapter.key} contactId={cur.id} bump={aiBump} />
                  {file && (
                    <div className="ix-file">
                      <div className="ic"><Ic d={/\.(jpe?g|png)$/i.test(file.name) ? XI.img : XI.file} size={15} /></div>
                      <span className="nm">{file.name}</span>
                      <span className="sz">{fmtSize(file.size)}</span>
                      <button type="button" className="ix-ib" style={{ width: 26, height: 26 }} onClick={() => setFile(null)} title={k('removeFile')}>
                        <Ic d={XI.x} size={13} />
                      </button>
                    </div>
                  )}
                  <div className="box">
                    <input
                      ref={fileRef}
                      type="file"
                      hidden
                      accept={FILE_EXT.map((e) => `.${e}`).join(',')}
                      onChange={(e) => {
                        pickFile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    <button type="button" className="ix-ib" title={k('attach')} onClick={() => fileRef.current?.click()} disabled={sending}>
                      <Ic d={XI.clip} size={16} />
                    </button>
                    <textarea
                      ref={taRef}
                      rows={1}
                      value={text}
                      onChange={grow}
                      onKeyDown={onKey}
                      placeholder={file ? k('captionPlaceholder') : k('messagePlaceholder', { channel: channelName })}
                    />
                    <button type="button" className="ix-send" disabled={sending || (!text.trim() && !file) || !snd} onClick={() => void send()} title={k('send')}>
                      <Ic d={XI.send} size={15} />
                    </button>
                  </div>
                  {err && <div className="err">{err}</div>}
                  <div className="hint">
                    <span>{snd ? <>{k('sendingFrom')} <b>{snd.name}</b>{snd.handle ? ` · ${snd.handle}` : ''}</> : k(`noSender.${adapter.key}`)}</span>
                    <span className="kb">{k('keyboardHint')}</span>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* карточка */}
          {cur && rail && (
            <aside className="ix-rail">
              <div className="ix-card-id">
                <Ava n={cur.name} size={56} />
                <div className="nm">{cur.name}</div>
                <div className="hd">{cur.handle}</div>
              </div>
              <div className="ix-blk">
                <div className="kick">{k('lead')}</div>
                {cur.lead ? (
                  <>
                    <Link className="ix-link" to={`/leads/${cur.lead.id}`}>
                      <Ic d={XI.lead} size={14} />
                      <span>{cur.lead.name || k('lead')}</span>
                      <Ic d={XI.arrow} size={13} />
                    </Link>
                    <div className="ix-kv"><span>{k('stage')}</span><b>{leadStatus(cur.lead.status) || '—'}</b></div>
                    <div className="ix-kv"><span>{k('owner')}</span><b className={cx(!cur.lead.ownerName && 'mute')}>{cur.lead.ownerName || k('notAssigned')}</b></div>
                  </>
                ) : (
                  <>
                    <p className="ix-note">{k('noLeadNote')}</p>
                    <button type="button" className="e2b gh sm" onClick={() => void createLead()} disabled={creatingLead}>
                      <Ic d={XI.plus} size={13} />{k('createLead')}
                    </button>
                  </>
                )}
              </div>
              <div className="ix-blk">
                <div className="kick">{k('crmContact')}</div>
                {cur.crmContact ? (
                  <Link className="ix-link" to={`/contacts/${cur.crmContact.id}`}>
                    <Ic d={XI.user} size={14} /><span>{cur.crmContact.name || k('contact')}</span><Ic d={XI.arrow} size={13} />
                  </Link>
                ) : (
                  <div className="ix-kv"><span>{k('contact')}</span><b className="mute">{k('notLinked')}</b></div>
                )}
                {cur.crmCompany ? (
                  <Link className="ix-link" to={`/companies/${cur.crmCompany.id}`}>
                    <Ic d={XI.co} size={14} /><span>{cur.crmCompany.name || k('company')}</span><Ic d={XI.arrow} size={13} />
                  </Link>
                ) : (
                  <div className="ix-kv"><span>{k('company')}</span><b className="mute">—</b></div>
                )}
              </div>
              <div className="ix-blk">
                <div className="kick">{k('channel')}</div>
                <div className="ix-kv"><span>{k(`senderLabel.${adapter.key}`)}</span><b>{snd ? snd.handle || snd.name : '—'}</b></div>
                <div className="ix-kv"><span>{k(`idLabel.${adapter.key}`)}</span><b className="mono">{cur.channelId}</b></div>
                <div className="ix-kv"><span>{k('firstMessage')}</span><b>{cur.firstMessageAt ? new Date(cur.firstMessageAt).toLocaleDateString(locale) : '—'}</b></div>
                <div className="ix-kv"><span>{k('messages')}</span><b>{cur.messageCount}</b></div>
              </div>
            </aside>
          )}
        </div>
      </div>
      {lightbox && (
        <div className="ix-lightbox" onClick={() => setLightbox(null)} role="presentation">
          <img src={lightbox} alt="" />
        </div>
      )}
    </MainLayout>
  );
}

// src/pages/leads/LeadComms.tsx
// Единая лента переписки лида: WhatsApp + Telegram + Почта в одном окне (макет lead-detail.html).
// Данные — те же, что раньше показывали три отдельные панели (LeadWhatsappThread / LeadTelegramThread /
// блок писем): контакт канала привязан к лиду через leadId, письма — через leadId + адрес лида.
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchEmailAccounts,
  fetchEmailMessages,
  patchEmailMessage,
  sendEmail,
  type EmailAccount,
  type EmailMessage,
} from '../../api/email';
import {
  fetchTelegramAttachmentUrl,
  fetchTelegramContacts,
  fetchTelegramMessages,
  markTelegramContactRead,
  sendTelegramFile,
  sendTelegramMessage,
  type TelegramContactWithPreview,
  type TelegramMessage,
} from '../../api/telegram-crm';
import {
  fetchWhatsappAttachmentUrl,
  fetchWhatsappContacts,
  fetchWhatsappMessages,
  markWhatsappContactRead,
  sendWhatsappFile,
  sendWhatsappMessage,
  type WhatsappContactWithPreview,
  type WhatsappMessage,
} from '../../api/whatsapp-crm';
import { postAiEmailReplySuggest } from '../../api/ai';
import { isForbiddenError } from '../../api/client';
import { MessengerAiPauseBar } from '../../components/ai/MessengerAiPauseBar';

export type ChannelKey = 'whatsapp' | 'telegram' | 'email';
type Filter = 'all' | ChannelKey;
const CHANNELS: ChannelKey[] = ['whatsapp', 'telegram', 'email'];

export const CH_ACCENT: Record<ChannelKey, string> = {
  whatsapp: '#1FA855',
  telegram: '#229ED9',
  email: '#5B6470',
};

export const CH_ICON: Record<ChannelKey, React.ReactNode> = {
  whatsapp: (
    <>
      <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z" />
    </>
  ),
  telegram: (
    <>
      <path d="M21 4L3 11l5.5 2.5L11 20l3-4.5" />
      <path d="M8.5 13.5L20 5" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
};

const IC = {
  send: <path d="M4 12l16-7-7 16-2.5-6.5z" />,
  clip: <path d="M20.5 11.5 12.3 19.7a4.8 4.8 0 0 1-6.8-6.8l8.2-8.2a3.2 3.2 0 0 1 4.5 4.5l-8.2 8.2a1.6 1.6 0 0 1-2.2-2.2l7.5-7.5" />,
  refresh: (
    <>
      <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5" />
      <path d="M4 4v4.5h4.5" />
      <path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5" />
      <path d="M20 20v-4.5h-4.5" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  play: <path d="M8 5v14l11-7z" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 17l-5-5-9 8" />
    </>
  ),
  ai: <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" />,
  bot: (
    <>
      <rect x="5" y="8" width="14" height="11" rx="2" />
      <path d="M12 4v4M9 13h.01M15 13h.01" />
    </>
  ),
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  check2: (
    <>
      <path d="M2 12.5l4 4L14 8" />
      <path d="M10 16.5l1 0L20 8" />
    </>
  ),
  reply: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 6 6v4" />
    </>
  ),
  ext: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </>
  ),
};

export function Ico({ d, size = 14 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

type AttKind = 'voice' | 'image' | 'video' | 'file';
interface Att {
  name: string;
  size?: number;
  kind: AttKind;
  index: number;
  url?: string;
}

interface Item {
  key: string;
  id: string;
  ch: ChannelKey;
  dir: 'in' | 'out';
  date: string;
  text: string;
  src: 'manual' | 'ai' | 'flow' | 'system';
  unread: boolean;
  atts: Att[];
  msgType?: string | null;
  subject?: string | null;
  from?: string;
  fromName?: string | null;
  to?: string[];
  accountId?: string;
}

export interface CommsActivity {
  ch: ChannelKey;
  dir: 'in' | 'out';
  date: string;
}

export interface CommsContacts {
  whatsapp: string | null;
  telegram: string | null;
  email: string | null;
}

export interface LeadCommsHandle {
  compose(opts: { ch: ChannelKey; subject?: string; body?: string }): void;
}

interface Props {
  leadId: string;
  leadEmail: string;
  leadName: string;
  locale: string;
  onActivity?: (a: CommsActivity | null) => void;
  onUnread?: (n: number) => void;
  onContacts?: (c: CommsContacts) => void;
}

const POLL_MS = 20000;

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function fmtSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function attKind(type: string | undefined, mime?: string): AttKind {
  const t = (type || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  if (t === 'voice' || t === 'audio' || m.startsWith('audio/')) return 'voice';
  if (t === 'photo' || t === 'image' || m.startsWith('image/')) return 'image';
  if (t === 'video' || t === 'video_note' || m.startsWith('video/')) return 'video';
  return 'file';
}

function fromEmail(m: EmailMessage): Item {
  const text = (m.textBody && m.textBody.trim()) || (m.htmlBody ? stripHtml(m.htmlBody) : '');
  return {
    key: `email:${m.id}`,
    id: m.id,
    ch: 'email',
    dir: m.direction === 'incoming' ? 'in' : 'out',
    date: m.date,
    text,
    src: 'manual',
    unread: m.direction === 'incoming' && !m.isRead,
    atts: (m.attachments || []).map((a, i) => ({
      name: a.filename,
      size: a.size,
      kind: attKind(undefined, a.contentType) === 'image' ? 'image' : 'file',
      index: i,
      url: a.url,
    })),
    subject: m.subject,
    from: m.from,
    fromName: m.fromName,
    to: [...(m.to || []), ...(m.cc || [])],
    accountId: m.accountId,
  };
}

function fromTelegram(m: TelegramMessage): Item {
  const src = (m.meta?.source as Item['src']) || 'manual';
  return {
    key: `telegram:${m.id}`,
    id: m.id,
    ch: 'telegram',
    dir: m.direction === 'incoming' ? 'in' : 'out',
    date: m.date,
    text: m.text || '',
    src,
    unread: m.direction === 'incoming' && !m.isRead,
    atts: (m.attachments || []).map((a, i) => ({
      name: a.fileName || a.type,
      size: a.fileSize,
      kind: attKind(a.type),
      index: i,
    })),
    msgType: m.messageType,
  };
}

function fromWhatsapp(m: WhatsappMessage): Item {
  return {
    key: `whatsapp:${m.id}`,
    id: m.id,
    ch: 'whatsapp',
    dir: m.direction === 'incoming' ? 'in' : 'out',
    date: m.date,
    text: m.text || '',
    src: m.rawData?.source === 'ai' ? 'ai' : 'manual',
    unread: m.direction === 'incoming' && !m.isRead,
    atts: (m.attachments || []).map((a, i) => ({
      name: a.fileName || a.caption || a.type,
      size: a.fileSize,
      kind: attKind(a.type, a.mimeType),
      index: i,
    })),
    msgType: m.messageType,
  };
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      resolve(s.includes(',') ? s.slice(s.indexOf(',') + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export const LeadComms = forwardRef<LeadCommsHandle, Props>(function LeadComms(
  { leadId, leadEmail, leadName, locale, onActivity, onUnread, onContacts },
  ref,
) {
  const { t } = useTranslation();
  const chName = (k: ChannelKey) => t(`crm.leadCard.comms.ch.${k}`);

  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncAt, setSyncAt] = useState<Date | null>(null);
  const [chErrors, setChErrors] = useState<Partial<Record<ChannelKey, string>>>({});
  const [tgContact, setTgContact] = useState<TelegramContactWithPreview | null>(null);
  const [waContact, setWaContact] = useState<WhatsappContactWithPreview | null>(null);
  /** Ручной ответ в мессенджере ставит ИИ-консультанта на паузу — перечитываем плашку сразу после отправки. */
  const [aiBump, setAiBump] = useState(0);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountId, setAccountId] = useState('');

  const [flt, setFlt] = useState<Filter>('all');
  const [cc, setCc] = useState<ChannelKey | null>(null);
  const [text, setText] = useState('');
  const [subj, setSubj] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sendErr, setSendErr] = useState('');

  const [atBottom, setAtBottom] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [divKey, setDivKey] = useState<string | null>(null);
  const [openMail, setOpenMail] = useState<Record<string, boolean>>({});
  const [media, setMedia] = useState<Record<string, string>>({});

  const scRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const initialScrollDone = useRef(false);
  const mediaRef = useRef<Record<string, string>>({});
  mediaRef.current = media;

  const leadEmailNorm = (leadEmail || '').trim().toLowerCase();

  const isAtBottom = () => {
    const el = scRef.current;
    return !!el && el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };
  const toBottom = (smooth = true) => {
    const el = scRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  const friendly = useCallback(
    (e: unknown) => (isForbiddenError(e) ? t('crm.leadCard.comms.noAccess') : (e as Error)?.message || t('crm.leadCard.comms.loadError')),
    [t],
  );

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setSyncing(true);
      const [em, tg, wa] = await Promise.allSettled([
        fetchEmailMessages({ leadId, limit: 100 }),
        fetchTelegramContacts({ leadId }).then(async (cs) => {
          const c = cs[0] ?? null;
          const msgs = c ? (await fetchTelegramMessages({ contactId: c.id, limit: 100 })).items : [];
          return { c, msgs };
        }),
        fetchWhatsappContacts({ leadId }).then(async (cs) => {
          const c = cs[0] ?? null;
          const msgs = c ? (await fetchWhatsappMessages({ contactId: c.id, limit: 100 })).items : [];
          return { c, msgs };
        }),
      ]);
      const next: Item[] = [];
      const errs: Partial<Record<ChannelKey, string>> = {};
      if (em.status === 'fulfilled') {
        // leadId на письме значит лишь «связано с лидом» (например, внутреннее уведомление сотруднику) —
        // в переписку попадают только письма, реально адресованные лиду или полученные от него.
        const relevant = leadEmailNorm
          ? em.value.items.filter((m) =>
              m.direction === 'incoming'
                ? (m.from || '').trim().toLowerCase() === leadEmailNorm
                : [...(m.to || []), ...(m.cc || [])].some((a) => (a || '').trim().toLowerCase() === leadEmailNorm),
            )
          : em.value.items;
        relevant.forEach((m) => next.push(fromEmail(m)));
      } else errs.email = friendly(em.reason);
      if (tg.status === 'fulfilled') {
        setTgContact(tg.value.c);
        tg.value.msgs.forEach((m) => next.push(fromTelegram(m)));
      } else errs.telegram = friendly(tg.reason);
      if (wa.status === 'fulfilled') {
        setWaContact(wa.value.c);
        wa.value.msgs.forEach((m) => next.push(fromWhatsapp(m)));
      } else errs.whatsapp = friendly(wa.reason);
      next.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const fresh = seenRef.current.size ? next.filter((x) => !seenRef.current.has(x.key) && x.dir === 'in') : [];
      next.forEach((x) => seenRef.current.add(x.key));
      const bottom = isAtBottom();
      setItems(next);
      setChErrors(errs);
      setSyncAt(new Date());
      setLoaded(true);
      setSyncing(false);
      if (fresh.length) {
        if (bottom) requestAnimationFrame(() => toBottom());
        else setNewBelow((n) => n + fresh.length);
      }
    },
    [leadId, leadEmailNorm, friendly],
  );

  useEffect(() => {
    seenRef.current = new Set();
    initialScrollDone.current = false;
    setLoaded(false);
    setItems([]);
    void load(false);
    fetchEmailAccounts()
      .then((accs) => {
        setAccounts(accs);
        if (accs.length) setAccountId((cur) => cur || accs[0].id);
      })
      .catch(() => setAccounts([]));
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // освобождаем blob-URL вложений
  useEffect(() => () => Object.values(mediaRef.current).forEach((u) => u.startsWith('blob:') && URL.revokeObjectURL(u)), []);

  const available: Record<ChannelKey, boolean> = {
    whatsapp: !!waContact?.connectionId,
    telegram: !!tgContact,
    email: !!leadEmailNorm && accounts.length > 0,
  };
  const handles: CommsContacts = {
    whatsapp: waContact ? (waContact.waPhoneDigits ? `+${waContact.waPhoneDigits}` : waContact.waProfileName) : null,
    telegram: tgContact
      ? tgContact.telegramUsername
        ? `@${tgContact.telegramUsername}`
        : [tgContact.telegramFirstName, tgContact.telegramLastName].filter(Boolean).join(' ') || tgContact.telegramUserId
      : null,
    email: leadEmailNorm ? leadEmail.trim() : null,
  };

  useEffect(() => {
    onContacts?.(handles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handles.whatsapp, handles.telegram, handles.email]);

  const lastIn = useMemo(() => [...items].reverse().find((x) => x.dir === 'in') || null, [items]);
  const last = items.length ? items[items.length - 1] : null;
  useEffect(() => {
    onActivity?.(last ? { ch: last.ch, dir: last.dir, date: last.date } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.key]);

  const unread = (k: Filter) => items.filter((x) => x.unread && (k === 'all' || x.ch === k)).length;
  const count = (k: Filter) => items.filter((x) => k === 'all' || x.ch === k).length;
  const uAll = unread('all');
  useEffect(() => {
    onUnread?.(uAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uAll]);

  // канал отправки по умолчанию — там, где клиент писал последним
  useEffect(() => {
    if (cc && available[cc]) return;
    const pref = lastIn && available[lastIn.ch] ? lastIn.ch : CHANNELS.find((k) => available[k]) || null;
    setCc(pref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available.whatsapp, available.telegram, available.email, lastIn?.key]);

  useEffect(() => {
    if (flt !== 'all' && available[flt]) setCc(flt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flt]);

  const shown = useMemo(() => items.filter((x) => flt === 'all' || x.ch === flt), [items, flt]);

  // якорь «Новые сообщения» фиксируется при входе в вид и после первой загрузки
  useLayoutEffect(() => {
    if (!loaded) return;
    const f = shown.find((x) => x.unread);
    setDivKey(f ? f.key : null);
    setNewBelow(0);
    requestAnimationFrame(() => {
      const el = scRef.current;
      if (!el) return;
      const d = el.querySelector('.ld-new') as HTMLElement | null;
      el.scrollTop = d ? d.offsetTop - 70 : el.scrollHeight;
      initialScrollDone.current = true;
      onScroll();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flt, loaded]);

  const onScroll = () => {
    const b = isAtBottom();
    setAtBottom(b);
    if (b) setNewBelow(0);
  };

  const markRead = useCallback(
    async (k: Filter) => {
      const targets = items.filter((x) => x.unread && (k === 'all' || x.ch === k));
      if (!targets.length) return;
      const keys = new Set(targets.map((x) => x.key));
      setItems((l) => l.map((x) => (keys.has(x.key) ? { ...x, unread: false } : x)));
      const chs = new Set(targets.map((x) => x.ch));
      const jobs: Promise<unknown>[] = [];
      if (chs.has('telegram') && tgContact) jobs.push(markTelegramContactRead(tgContact.id));
      if (chs.has('whatsapp') && waContact) jobs.push(markWhatsappContactRead(waContact.id));
      targets.filter((x) => x.ch === 'email').forEach((x) => jobs.push(patchEmailMessage(x.id, { isRead: true })));
      await Promise.allSettled(jobs);
    },
    [items, tgContact, waContact],
  );

  // дочитали до конца — через секунду помечаем прочитанными (и на сервере)
  useEffect(() => {
    if (!atBottom || !initialScrollDone.current || !shown.some((x) => x.unread)) return;
    const tm = window.setTimeout(() => void markRead(flt), 1200);
    return () => window.clearTimeout(tm);
  }, [atBottom, shown, flt, markRead]);

  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  useImperativeHandle(ref, () => ({
    compose({ ch, subject, body }) {
      if (!available[ch]) {
        setSendErr(unavailableReason(ch));
        return;
      }
      setSendErr('');
      setCc(ch);
      if (subject !== undefined) setSubj(subject);
      if (body !== undefined) setText(body);
      if (flt !== 'all' && flt !== ch) setFlt(ch);
      requestAnimationFrame(() => {
        grow(taRef.current);
        taRef.current?.focus();
      });
    },
  }));

  const pushSent = (it: Item) => {
    seenRef.current.add(it.key);
    setItems((l) => [...l, it]);
    requestAnimationFrame(() => toBottom());
  };

  const send = async () => {
    if (!cc || sending) return;
    const body = text.trim();
    if (!body && !files.length) return;
    setSending(true);
    setSendErr('');
    try {
      if (cc === 'telegram' && tgContact) {
        if (files.length) {
          for (let i = 0; i < files.length; i++) {
            const m = await sendTelegramFile({
              botId: tgContact.botId || '',
              telegramUserId: tgContact.telegramUserId,
              file: files[i],
              caption: i === 0 && body ? body : undefined,
              leadId,
              contactId: tgContact.id,
            });
            pushSent(fromTelegram(m));
          }
        } else {
          const m = await sendTelegramMessage({
            botId: tgContact.botId || '',
            telegramUserId: tgContact.telegramUserId,
            text: body,
            contactId: tgContact.id,
            leadId,
          });
          pushSent(fromTelegram(m));
        }
      } else if (cc === 'whatsapp' && waContact?.connectionId) {
        if (files.length) {
          for (let i = 0; i < files.length; i++) {
            const m = await sendWhatsappFile({
              connectionId: waContact.connectionId,
              contactId: waContact.id,
              file: files[i],
              caption: i === 0 && body ? body : undefined,
            });
            pushSent(fromWhatsapp(m));
          }
        } else {
          const m = await sendWhatsappMessage({ connectionId: waContact.connectionId, contactId: waContact.id, text: body });
          pushSent(fromWhatsapp(m));
        }
      } else if (cc === 'email') {
        if (!accountId) throw new Error(t('crm.leadCard.comms.noMailbox'));
        const attachments = await Promise.all(
          files.map(async (f) => ({ filename: f.name, contentType: f.type || 'application/octet-stream', contentBase64: await readAsBase64(f) })),
        );
        const m = await sendEmail({
          accountId,
          to: [leadEmail.trim()],
          subject: subj.trim() || undefined,
          textBody: body || undefined,
          leadId,
          attachments: attachments.length ? attachments : undefined,
        });
        pushSent(fromEmail(m));
      }
      // ответили в канале — входящие этого канала считаем прочитанными
      void markRead(cc);
      if (cc !== 'email') setAiBump((n) => n + 1);
      setText('');
      setSubj('');
      setFiles([]);
      if (taRef.current) taRef.current.style.height = '';
    } catch (e) {
      setSendErr(isForbiddenError(e) ? t('crm.leadCard.comms.noAccess') : (e as Error)?.message || t('crm.leadCard.comms.sendError'));
    } finally {
      setSending(false);
    }
  };

  const aiDraft = async () => {
    const src = (cc && [...items].reverse().find((x) => x.dir === 'in' && x.ch === cc)) || lastIn;
    if (!src || !src.text.trim()) {
      setSendErr(t('crm.leadCard.comms.aiNoIncoming'));
      return;
    }
    setDrafting(true);
    setSendErr('');
    try {
      const r = await postAiEmailReplySuggest({
        subject: src.subject || undefined,
        body: src.text.slice(0, 4000),
        senderName: src.fromName || leadName || undefined,
      });
      const s = r.ok ? r.suggestions?.find((x) => x && x.trim()) : undefined;
      if (!s) throw new Error(r.error || t('crm.leadCard.comms.aiError'));
      setText(s);
      if (cc === 'email' && !subj && src.subject) setSubj(src.subject.startsWith('Re:') ? src.subject : `Re: ${src.subject}`);
      requestAnimationFrame(() => {
        grow(taRef.current);
        taRef.current?.focus();
      });
    } catch (e) {
      setSendErr((e as Error)?.message || t('crm.leadCard.comms.aiError'));
    } finally {
      setDrafting(false);
    }
  };

  const replyMail = (x: Item) => {
    if (!available.email) return;
    setCc('email');
    const s = x.subject || '';
    setSubj(s ? (s.startsWith('Re:') ? s : `Re: ${s}`) : '');
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const openAtt = async (x: Item, a: Att) => {
    const k = `${x.key}:${a.index}`;
    try {
      let url = media[k] || a.url;
      if (!url) {
        if (x.ch === 'telegram') url = await fetchTelegramAttachmentUrl(x.id, a.index);
        else if (x.ch === 'whatsapp') url = await fetchWhatsappAttachmentUrl(x.id, a.index);
      }
      if (!url) return;
      if (a.kind === 'voice' || a.kind === 'image') {
        setMedia((m) => ({ ...m, [k]: url as string }));
      } else {
        if (!media[k]) setMedia((m) => ({ ...m, [k]: url as string }));
        window.open(url, '_blank', 'noopener');
      }
    } catch (e) {
      setSendErr(friendly(e));
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && (cc !== 'email' || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  };

  const tm = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const y = new Date();
    y.setDate(today.getDate() - 1);
    if (dayKey(iso) === dayKey(today.toISOString())) return t('crm.leadCard.comms.today');
    if (dayKey(iso) === dayKey(y.toISOString())) return t('crm.leadCard.comms.yesterday');
    return d.toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    });
  };

  const renderAtt = (x: Item, a: Att, dark: boolean) => {
    const k = `${x.key}:${a.index}`;
    const url = media[k];
    if (a.kind === 'voice' && url) return <audio key={k} src={url} controls autoPlay />;
    if (a.kind === 'image' && url)
      return <img key={k} className="ph" src={url} alt={a.name} onClick={() => window.open(url, '_blank', 'noopener')} />;
    const icon = a.kind === 'voice' ? IC.play : a.kind === 'image' ? IC.image : IC.file;
    const label =
      a.kind === 'voice'
        ? t('crm.leadCard.comms.att.voice')
        : a.kind === 'image'
          ? t('crm.leadCard.comms.att.photo')
          : a.kind === 'video'
            ? t('crm.leadCard.comms.att.video')
            : a.name || t('crm.leadCard.comms.att.file');
    const canOpen = x.ch !== 'email' || !!a.url;
    return (
      <button
        key={k}
        type="button"
        className={cx('ld-file', dark && 'dk')}
        onClick={() => canOpen && void openAtt(x, a)}
        disabled={!canOpen}
        title={canOpen ? a.name : t('crm.leadCard.comms.att.inMailbox')}
      >
        <span className="ic">
          <Ico d={icon} size={14} />
        </span>
        <span className="nm">{label}</span>
        {a.size ? <span className="sz">{fmtSize(a.size)}</span> : null}
      </button>
    );
  };

  const renderBubble = (x: Item) => {
    const out = x.dir === 'out';
    const auto = out && x.src !== 'manual';
    const dark = out && !auto;
    const fallback = !x.text && !x.atts.length ? `[${x.msgType || t('crm.leadCard.comms.att.message')}]` : '';
    return (
      <div key={x.key} className={cx('ld-msg', out ? 'out' : 'in', auto && 'auto', x.unread && 'un')} style={{ ['--ch' as string]: CH_ACCENT[x.ch] }}>
        <div className="b">
          {auto && (
            <div className="src">
              <Ico d={x.src === 'ai' ? IC.ai : IC.bot} size={11} />
              {t(`crm.leadCard.comms.src.${x.src}`)}
            </div>
          )}
          {x.atts.length > 0 && <div className="atts">{x.atts.map((a) => renderAtt(x, a, dark))}</div>}
          {(x.text || fallback) && <div className="tx">{x.text || fallback}</div>}
          <div className="meta">
            <span>{tm(x.date)}</span>
            {out && <Ico d={IC.check2} size={13} />}
          </div>
        </div>
      </div>
    );
  };

  const renderMail = (x: Item) => {
    const out = x.dir === 'out';
    const open = openMail[x.key] ?? x.unread;
    const toggle = () => setOpenMail((m) => ({ ...m, [x.key]: !open }));
    return (
      <div key={x.key} className={cx('ld-mailrow', out ? 'out' : 'in')}>
        <article className={cx('ld-mail', x.unread && 'un')} style={{ ['--ch' as string]: CH_ACCENT.email }}>
          <header onClick={toggle}>
            <span className="mi">
              <Ico d={CH_ICON.email} size={14} />
            </span>
            <div className="hd">
              <div className="sj">{x.subject || t('crm.leadCard.comms.noSubject')}</div>
              <div className="fr">
                {out ? t('crm.leadCard.comms.you') : x.fromName || x.from} <span>→</span> {out ? (x.to || []).join(', ') : x.to?.[0] || ''}
              </div>
            </div>
            <span className="tm">{tm(x.date)}</span>
          </header>
          <div className={cx('body', !open && 'clamp')}>{x.text || t('crm.leadCard.comms.noBody')}</div>
          {x.atts.length > 0 && <div className="atts">{x.atts.map((a) => renderAtt(x, a, false))}</div>}
          <footer>
            <button type="button" className="lk" onClick={toggle}>
              {open ? t('crm.leadCard.comms.collapse') : t('crm.leadCard.comms.expand')}
            </button>
            <span className="sp" />
            {!out && available.email && (
              <button type="button" className="lk" onClick={() => replyMail(x)}>
                <Ico d={IC.reply} size={12} />
                {t('crm.leadCard.comms.reply')}
              </button>
            )}
            <a className="lk" href={`/email/inbox?messageId=${x.id}&accountId=${x.accountId || ''}`} target="_blank" rel="noreferrer">
              <Ico d={IC.ext} size={12} />
              {t('crm.leadCard.comms.inMailbox')}
            </a>
          </footer>
        </article>
      </div>
    );
  };

  const emptyText = () => {
    if (flt === 'all') return t('crm.leadCard.comms.emptyAll');
    if (chErrors[flt]) return chErrors[flt];
    if (flt === 'email') return leadEmailNorm ? t('crm.leadCard.comms.emptyEmail') : t('crm.leadCard.comms.noLeadEmail');
    if (flt === 'telegram' && !tgContact) return t('crm.leadCard.comms.noDialog.telegram');
    if (flt === 'whatsapp' && !waContact) return t('crm.leadCard.comms.noDialog.whatsapp');
    return t('crm.leadCard.comms.emptyChannel');
  };

  const inboxHref: Record<ChannelKey, string> = { whatsapp: '/whatsapp/inbox', telegram: '/telegram/inbox', email: '/email/inbox' };

  let prevCh: ChannelKey | null = null;
  let prevDay = '';
  const errList = CHANNELS.filter((k) => chErrors[k] && (flt === 'all' || flt === k));

  const unavailableReason = (k: ChannelKey) => {
    if (k === 'email') return !leadEmailNorm ? t('crm.leadCard.comms.noLeadEmail') : t('crm.leadCard.comms.noMailbox');
    if (k === 'whatsapp' && waContact && !waContact.connectionId) return t('crm.leads.form.sections.whatsappNoConnection');
    return t(`crm.leadCard.comms.noDialog.${k}`);
  };

  return (
    <div className="ld-comms">
      <div className="ld-cm-top">
        <div className="ld-chs" role="tablist">
          {(['all', ...CHANNELS] as Filter[]).map((k) => {
            const u = unread(k);
            const isCh = k !== 'all';
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={flt === k}
                className={cx(flt === k && 'on', u > 0 && 'hasu')}
                style={isCh ? { ['--ch' as string]: CH_ACCENT[k as ChannelKey] } : undefined}
                onClick={() => setFlt(k)}
              >
                {isCh ? <Ico d={CH_ICON[k as ChannelKey]} size={14} /> : null}
                <span>{isCh ? chName(k as ChannelKey) : t('crm.leadCard.comms.allChannels')}</span>
                {u > 0 ? <b className="u">{u}</b> : <span className="c">{count(k)}</span>}
              </button>
            );
          })}
        </div>
        <div className="ld-sync">
          {unread(flt) > 0 && (
            <button type="button" className="lk" onClick={() => void markRead(flt)}>
              {t('crm.leadCard.comms.markRead')}
            </button>
          )}
          {syncAt && <span>{t('crm.leadCard.comms.synced', { time: tm(syncAt.toISOString()) })}</span>}
          <button
            type="button"
            className={cx('ld-ib', syncing && 'spin')}
            title={t('crm.leadCard.comms.refresh')}
            aria-label={t('crm.leadCard.comms.refresh')}
            onClick={() => void load(false)}
            disabled={syncing}
          >
            <Ico d={IC.refresh} size={14} />
          </button>
        </div>
      </div>

      {flt !== 'all' && handles[flt] && (
        <div className="ld-conn" style={{ ['--ch' as string]: CH_ACCENT[flt] }}>
          <span className="chd" />
          <b>{handles[flt]}</b>
          {flt === 'email' && accounts.length > 0 && (
            <span className="mut">{t('crm.leadCard.comms.via', { from: accounts.find((a) => a.id === accountId)?.email || accounts[0].email })}</span>
          )}
          <a href={inboxHref[flt]}>
            {t('crm.leadCard.comms.openSection')} <Ico d={IC.ext} size={12} />
          </a>
        </div>
      )}

      <div className="ld-msgs-wrap">
        <div className="ld-msgs" ref={scRef} onScroll={onScroll}>
          {errList.map((k) => (
            <div key={`err-${k}`} className="ld-err">
              {chName(k)}: {chErrors[k]}
            </div>
          ))}
          {!loaded && <div className="ld-empty">{t('crm.leadCard.comms.loading')}</div>}
          {loaded && shown.length === 0 && <div className="ld-empty">{emptyText()}</div>}
          {shown.map((x) => {
            const dk = dayKey(x.date);
            const newDay = dk !== prevDay;
            if (newDay) {
              prevDay = dk;
              prevCh = null;
            }
            const run = flt === 'all' && x.ch !== prevCh;
            prevCh = x.ch;
            return (
              <React.Fragment key={x.key}>
                {newDay && (
                  <div className="ld-day">
                    <span>{dayLabel(x.date)}</span>
                  </div>
                )}
                {x.key === divKey && (
                  <div className="ld-new">
                    <span>{t('crm.leadCard.comms.newMessages')}</span>
                  </div>
                )}
                {run && (
                  <div className={cx('ld-run', x.dir === 'out' && 'r')} style={{ ['--ch' as string]: CH_ACCENT[x.ch] }}>
                    <Ico d={CH_ICON[x.ch]} size={12} />
                    {chName(x.ch)}
                    {handles[x.ch] ? <span>{handles[x.ch]}</span> : null}
                  </div>
                )}
                {x.ch === 'email' ? renderMail(x) : renderBubble(x)}
              </React.Fragment>
            );
          })}
        </div>
        {newBelow > 0 && (
          <button type="button" className="ld-below" onClick={() => toBottom()}>
            <Ico d={IC.down} size={13} />
            {t('crm.leadCard.comms.newBelow', { count: newBelow })}
          </button>
        )}
      </div>

      <div className="ld-comp" style={cc ? { ['--ch' as string]: CH_ACCENT[cc] } : undefined}>
        {cc === 'whatsapp' && <MessengerAiPauseBar channel="whatsapp" contactId={waContact?.id} bump={aiBump} />}
        {cc === 'telegram' && <MessengerAiPauseBar channel="telegram" contactId={tgContact?.id} bump={aiBump} />}
        <div className="ld-comp-top">
          <div className="ld-send-ch">
            {CHANNELS.map((k) => (
              <button
                key={k}
                type="button"
                className={cx(cc === k && 'on')}
                style={{ ['--ch' as string]: CH_ACCENT[k] }}
                onClick={() => setCc(k)}
                disabled={!available[k]}
                title={available[k] ? undefined : unavailableReason(k)}
              >
                <Ico d={CH_ICON[k]} size={13} />
                {chName(k)}
              </button>
            ))}
          </div>
          {cc && (
            <span className="via">
              {cc === 'email' ? (
                <>
                  {t('crm.leadCard.comms.to')} <b>{handles.email}</b>
                  {accounts.length > 1 && (
                    <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label={t('crm.leadCard.comms.fromMailbox')}>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.email}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              ) : (
                <>
                  {t('crm.leadCard.comms.to')} <b>{handles[cc]}</b>
                </>
              )}
            </span>
          )}
        </div>
        {cc === 'email' && (
          <input className="ld-subj" value={subj} onChange={(e) => setSubj(e.target.value)} placeholder={t('crm.leadCard.comms.subjectPh')} />
        )}
        {files.length > 0 && (
          <div className="pend">
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} className="ld-file">
                <span className="ic">
                  <Ico d={IC.file} size={14} />
                </span>
                <span className="nm">{f.name}</span>
                <span className="sz">{fmtSize(f.size)}</span>
                <button type="button" className="x" aria-label={t('crm.leadCard.comms.removeFile')} onClick={() => setFiles((l) => l.filter((_, j) => j !== i))}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="box">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,image/*,application/pdf"
            onChange={(e) => {
              const list = Array.from(e.target.files || []);
              if (list.length) setFiles((l) => [...l, ...list]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="ld-ib"
            title={t('crm.leadCard.comms.attach')}
            aria-label={t('crm.leadCard.comms.attach')}
            disabled={!cc}
            onClick={() => fileRef.current?.click()}
          >
            <Ico d={IC.clip} size={15} />
          </button>
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            disabled={!cc}
            onChange={(e) => {
              setText(e.target.value);
              grow(e.target);
            }}
            onKeyDown={onKey}
            placeholder={cc ? t(`crm.leadCard.comms.ph.${cc}`) : t('crm.leadCard.comms.noChannels')}
          />
          <button type="button" className="ld-ai" onClick={() => void aiDraft()} disabled={!cc || drafting} title={t('crm.leadCard.comms.aiDraftHint')}>
            <Ico d={IC.ai} size={13} />
            {drafting ? t('crm.leadCard.comms.aiDrafting') : t('crm.leadCard.comms.aiDraft')}
          </button>
          <button
            type="button"
            className="ld-sendb"
            disabled={!cc || sending || (!text.trim() && !files.length)}
            onClick={() => void send()}
            title={t('crm.leadCard.comms.send')}
            aria-label={t('crm.leadCard.comms.send')}
          >
            <Ico d={IC.send} size={15} />
          </button>
        </div>
        {sendErr && <div className="ld-err">{sendErr}</div>}
        <div className="hint">
          <span>
            {lastIn && cc && lastIn.ch !== cc && available[lastIn.ch] ? (
              <>
                {t('crm.leadCard.comms.lastReplyIn')} <b>{chName(lastIn.ch)}</b>{' '}
                <button type="button" className="lk" onClick={() => setCc(lastIn.ch)}>
                  {t('crm.leadCard.comms.switch')}
                </button>
              </>
            ) : (
              t('crm.leadCard.comms.savedHint')
            )}
          </span>
          <span className="kb">{cc === 'email' ? t('crm.leadCard.comms.kbEmail') : t('crm.leadCard.comms.kbChat')}</span>
        </div>
      </div>
    </div>
  );
});

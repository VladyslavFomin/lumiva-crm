import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auraApi, type AuraSourceKey } from '../../api/aura';
import { AU_I, AuIc } from './auraShared';

/* Модули, выключенные у клиента в pl1: их блоки и шаблоны в Aura закрыты.
   «Разблокировать» открывает окно с обращением в поддержку Lumiva (чат поддержки с готовым текстом). */

/** Компонент тарифа (pl1) для раздела Aura — зеркало backend AURA_SOURCE_COMPONENT. */
export const AU_SOURCE_COMPONENT: Record<AuraSourceKey, string> = {
  leads: 'leads',
  deals: 'sales',
  team: 'sales',
  calls: 'phone_system',
  booking: 'bookings',
  stock: 'products',
  finance: 'sales',
  marketing: 'marketing',
};
export const AU_DATASET_COMPONENT: Record<string, string> = {
  leads: 'leads',
  sales: 'sales',
  calls: 'phone_system',
  bookings: 'bookings',
  hotel_bookings: 'hotels',
  products: 'products',
  contacts: 'contacts',
  companies: 'companies',
  ads: 'marketing',
};

export type AuAccess = { loaded: boolean; lockedSources: Set<AuraSourceKey>; lockedComponents: Set<string> };
const EMPTY: AuAccess = { loaded: false, lockedSources: new Set(), lockedComponents: new Set() };
let cached: AuAccess | null = null;
let inflight: Promise<AuAccess> | null = null;

function load(): Promise<AuAccess> {
  if (cached) return Promise.resolve(cached);
  inflight ||= auraApi
    .access()
    .then((r) => (cached = { loaded: true, lockedSources: new Set(r.lockedSources), lockedComponents: new Set(r.lockedComponents) }))
    .catch(() => ({ ...EMPTY, loaded: true }))
    .finally(() => (inflight = null));
  return inflight;
}

/** Что закрыто у клиента. Пока не загрузилось — ничего не считается закрытым (сервер всё равно не отдаст данные). */
export function useAuraAccess(): AuAccess {
  const [a, setA] = useState<AuAccess>(cached || EMPTY);
  useEffect(() => {
    let alive = true;
    void load().then((x) => alive && setA(x));
    return () => {
      alive = false;
    };
  }, []);
  return a;
}

/** Компоненты, нужные списку разделов, которые сейчас закрыты. */
export const lockedFor = (acc: AuAccess, sources: AuraSourceKey[]) => [...new Set(sources.filter((s) => acc.lockedSources.has(s)).map((s) => AU_SOURCE_COMPONENT[s]))];

const EVT = 'lumiva-aura-unlock';
/** Открыть окно «Разблокировать» из любого места Aura. */
export function openUnlock(components: string[]) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: components }));
}

type ChatApi = { open?: () => void; compose?: (t: string) => void };

/** Одно окно на страницу Aura — слушает openUnlock(). */
export function AuraUnlockHost() {
  const { t } = useTranslation();
  const [comps, setComps] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const h = (e: Event) => {
      setCopied(false);
      setComps((e as CustomEvent<string[]>).detail || []);
    };
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  useEffect(() => {
    if (!comps) return;
    // в фазе захвата — раньше панели блока, чтобы Escape закрыл только это окно
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setComps(null);
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [comps]);
  if (!comps) return null;
  const names = comps.map((c) => t(`crm.aura.comp.${c}`, { defaultValue: c }));
  const text = t('crm.aura.unlock.message', { list: names.join(', ') });
  const chat = (window as unknown as { LumivaChat?: ChatApi }).LumivaChat;
  const write = () => {
    if (chat?.compose) chat.compose(text);
    else chat?.open?.();
    setComps(null);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="au-modal-bg lv-backdrop" onClick={() => setComps(null)}>
      <div className="au-modal au-unlock lv-dialog" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="au-unlock-ic">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0" />
          </svg>
        </div>
        <h3>{t('crm.aura.unlock.title')}</h3>
        <p>{t('crm.aura.unlock.sub', { count: names.length })}</p>
        <div className="au-unlock-mods">
          {names.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <p className="au-muted">{t('crm.aura.unlock.how')}</p>
        <div className="au-unlock-f">
          {chat ? (
            <button type="button" className="btn btn-primary" onClick={write}>
              <AuIc d={AU_I.send} size={14} />
              {t('crm.aura.unlock.write')}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void copy()}>
              <AuIc d={AU_I.copy} size={14} />
              {copied ? t('crm.aura.unlock.copied') : t('crm.aura.unlock.copy')}
            </button>
          )}
          <button type="button" className="btn" onClick={() => setComps(null)}>
            {t('crm.aura.close')}
          </button>
        </div>
        {!chat && <p className="au-unlock-txt">{text}</p>}
      </div>
    </div>
  );
}

/** Небольшая кнопка-замок для карточек/строк каталога. */
export function UnlockButton({ components, compact }: { components: string[]; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={'au-unlock-btn' + (compact ? ' sm' : '')}
      onClick={(e) => {
        e.stopPropagation();
        openUnlock(components);
      }}
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 7.5-2" />
      </svg>
      {t('crm.aura.unlock.btn')}
    </button>
  );
}

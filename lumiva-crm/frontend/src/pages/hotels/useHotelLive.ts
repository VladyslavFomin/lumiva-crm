import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../api/client';
import { issueLiveTicket, type HotelEditLock, type HotelLiveEntity, type HotelLiveEvent } from '../../api/hotels';

type Listener = (e: Extract<HotelLiveEvent, { type: 'changed' }>) => void;

/**
 * Один поток событий PMS на вкладку (общий для всех страниц/компонентов): изменения броней, номеров, уборки, OOO и
 * блокировки «бронь редактирует N». Переподключение с паузой 2→30 с и новым одноразовым билетом.
 */
const shared = {
  es: null as EventSource | null,
  listeners: new Set<Listener>(),
  lockListeners: new Set<(l: HotelEditLock[]) => void>(),
  stateListeners: new Set<(c: boolean) => void>(),
  locks: [] as HotelEditLock[],
  connected: false,
  retry: 2000,
  timer: 0 as number | undefined,
  users: 0,
};

function setConnected(c: boolean) {
  shared.connected = c;
  shared.stateListeners.forEach((f) => f(c));
}

async function connect() {
  if (shared.es || !shared.users) return;
  try {
    const { ticket } = await issueLiveTicket();
    if (!shared.users) return;
    const es = new EventSource(`${API_BASE.replace(/\/$/, '')}/hotels/live/stream?ticket=${encodeURIComponent(ticket)}`);
    shared.es = es;
    es.onopen = () => { shared.retry = 2000; setConnected(true); };
    es.onmessage = (m) => {
      let ev: HotelLiveEvent;
      try { ev = JSON.parse(m.data); } catch { return; }
      if (ev.type === 'changed') shared.listeners.forEach((f) => f(ev as Extract<HotelLiveEvent, { type: 'changed' }>));
      else if (ev.type === 'locks') { shared.locks = ev.locks; shared.lockListeners.forEach((f) => f(ev.locks)); }
    };
    es.onerror = () => {
      // билет одноразовый — EventSource сам переподключиться не сможет: закрываем и берём новый
      es.close();
      shared.es = null;
      setConnected(false);
      scheduleReconnect();
    };
  } catch (e) {
    // нет права на модуль отелей — не долбим сервер
    if ((e as { status?: number }).status === 403) return;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!shared.users) return;
  window.clearTimeout(shared.timer);
  shared.timer = window.setTimeout(() => void connect(), shared.retry);
  shared.retry = Math.min(30_000, shared.retry * 2);
}

function retain() {
  shared.users += 1;
  void connect();
}

function release() {
  shared.users = Math.max(0, shared.users - 1);
  if (!shared.users) {
    window.clearTimeout(shared.timer);
    shared.es?.close();
    shared.es = null;
    setConnected(false);
  }
}

/**
 * Подписка страницы: onChange вызывается (с паузой debounceMs, пачкой) при изменениях нужных сущностей.
 * Возвращает состояние соединения и текущие блокировки броней.
 */
export function useHotelLive(entities: HotelLiveEntity[], onChange: () => void, debounceMs = 400) {
  const [connected, setConn] = useState(shared.connected);
  const [locks, setLocks] = useState<HotelEditLock[]>(shared.locks);
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = entities.join(',');
  useEffect(() => {
    let t: number | undefined;
    const want = new Set(key.split(','));
    const onEv: Listener = (e) => {
      if (!want.has(e.entity)) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => cb.current(), debounceMs);
    };
    shared.listeners.add(onEv);
    shared.lockListeners.add(setLocks);
    shared.stateListeners.add(setConn);
    retain();
    return () => {
      window.clearTimeout(t);
      shared.listeners.delete(onEv);
      shared.lockListeners.delete(setLocks);
      shared.stateListeners.delete(setConn);
      release();
    };
  }, [key, debounceMs]);
  return { connected, locks };
}

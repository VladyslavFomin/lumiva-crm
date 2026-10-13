import { useSyncExternalStore } from 'react';
import { fetchUserPreferences, updateUserPreferences } from '../../../api/userPreferences';
import type { TourStep } from '../../../api/helpContent';

/**
 * Подсказки-туры: одно активное окно на экране + очередь автозапусков.
 * Автозапуск — один раз на страницу (preferences.tours.seen[topic] на сервере,
 * плюс localStorage-зеркало, чтобы не мигать до ответа). preferences.tours.off — выключил сам.
 */

type ActiveTour = { topic: string; steps: TourStep[]; index: number };
type Queued = { topic: string; steps: TourStep[]; front: boolean };

let active: ActiveTour | null = null;
let queue: Queued[] = [];
let startTimer: number | null = null;
/** Причины подождать с турами: мастер первичной настройки, окно оплаты тарифа — иначе окна наложатся. */
const blockers = new Set<string>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useActiveTour() {
  return useSyncExternalStore(subscribe, () => active, () => null);
}

// ── «уже видел» ─────────────────────────────────────────────────────────────
const LS_KEY = 'lumiva.tours.v1';
type ToursPrefs = { seen: Record<string, string>; off?: boolean };

function readLocal(): ToursPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return { seen: v.seen || {}, off: !!v.off };
  } catch {
    return { seen: {} };
  }
}
function writeLocal(p: ToursPrefs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* приватный режим — не критично, сервер помнит */
  }
}

let prefsPromise: Promise<ToursPrefs | null> | null = null;
/** null — не удалось узнать (сеть/ошибка): тогда автозапуск не делаем, чтобы не надоедать. */
function loadPrefs(): Promise<ToursPrefs | null> {
  if (!prefsPromise) {
    prefsPromise = fetchUserPreferences()
      .then((r) => {
        const t = r?.preferences?.tours || {};
        const local = readLocal();
        const merged: ToursPrefs = { seen: { ...local.seen, ...(t.seen || {}) }, off: !!t.off || !!local.off };
        writeLocal(merged);
        return merged;
      })
      .catch(() => {
        prefsPromise = null;
        return null;
      });
  }
  return prefsPromise;
}

export function markTourSeen(topic: string) {
  const at = new Date().toISOString();
  const local = readLocal();
  local.seen[topic] = at;
  writeLocal(local);
  prefsPromise = Promise.resolve(local);
  void updateUserPreferences({ tours: { seen: { [topic]: at } } }).catch(() => undefined);
}

/** «Не показывать подсказки автоматически» — кнопка «?» → «Пройти обучение» продолжает работать. */
export function disableAutoTours() {
  const local = { ...readLocal(), off: true };
  writeLocal(local);
  prefsPromise = Promise.resolve(local);
  queue = [];
  void updateUserPreferences({ tours: { off: true } }).catch(() => undefined);
}

// ── управление ──────────────────────────────────────────────────────────────

/** Ручной запуск (кнопка «Пройти обучение»): сразу, поверх очереди. */
export function startTour(topic: string, steps: TourStep[]) {
  if (!steps.length) return;
  queue = queue.filter((q) => q.topic !== topic);
  active = { topic, steps, index: 0 };
  emit();
}

/** Автозапуск при первом заходе. front — общий тур «Первый вход» идёт раньше тура страницы. */
export async function requestAutoTour(topic: string, steps: TourStep[], opts?: { front?: boolean }) {
  if (!steps.length) return;
  if (readLocal().seen[topic]) return;
  const prefs = await loadPrefs();
  if (!prefs || prefs.off || prefs.seen[topic]) return;
  if (active?.topic === topic || queue.some((q) => q.topic === topic)) return;
  const item = { topic, steps, front: !!opts?.front };
  queue = item.front ? [item, ...queue] : [...queue, item];
  scheduleNext();
}

/** Ушли со страницы — её тур больше не к месту (не отмечаем пройденным: покажем при следующем заходе). */
export function cancelTour(topic: string) {
  queue = queue.filter((q) => q.topic !== topic);
  if (active?.topic === topic) {
    active = null;
    emit();
    scheduleNext();
  }
}

/** Открыто/закрыто окно, поверх которого туры не показываем. Начатый тур вернётся в очередь и покажется после. */
export function setToursBlocked(reason: string, value: boolean) {
  if (blockers.has(reason) === value) return;
  if (value) blockers.add(reason);
  else blockers.delete(reason);
  if (value) {
    if (startTimer != null) {
      window.clearTimeout(startTimer);
      startTimer = null;
    }
    if (active) {
      queue = [{ topic: active.topic, steps: active.steps, front: true }, ...queue];
      active = null;
      emit();
    }
  } else if (!blockers.size) {
    scheduleNext();
  }
}

function scheduleNext() {
  if (blockers.size || active || startTimer != null || !queue.length) return;
  // Пауза, чтобы страница успела отрисовать элементы, к которым привязаны шаги.
  startTimer = window.setTimeout(() => {
    startTimer = null;
    if (active || blockers.size) return;
    const next = queue.shift();
    if (!next) return;
    // Одна тема «?» бывает на нескольких страницах (список и его вариант). Если на этой странице нет
    // ни одного элемента, к которому привязаны шаги, тур не про неё — не запускаем сам и не отмечаем
    // пройденным (кнопка «Пройти обучение» по-прежнему работает).
    if (!next.front && !hasAnyTarget(next.steps)) {
      scheduleNext();
      return;
    }
    active = { topic: next.topic, steps: next.steps, index: 0 };
    emit();
  }, 900);
}

function hasAnyTarget(steps: TourStep[]) {
  const targets = steps.map((s) => s.target).filter(Boolean) as string[];
  if (!targets.length) return true;
  return targets.some((t) => document.querySelector(`[data-tour="${CSS.escape(t)}"]`));
}

export function goToStep(index: number) {
  if (!active) return;
  active = { ...active, index: Math.max(0, Math.min(index, active.steps.length - 1)) };
  emit();
}

/** Закрыть тур (пройден или пропущен) — больше автоматически не показываем. */
export function finishTour() {
  if (!active) return;
  markTourSeen(active.topic);
  active = null;
  emit();
  scheduleNext();
}

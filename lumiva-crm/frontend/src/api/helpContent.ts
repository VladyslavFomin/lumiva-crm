import { api } from './client';

export type HelpMedia = { kind: 'video' | 'gif' | string; url: string };

export type TourStep = {
  id: string;
  /** data-tour="<target>" у элемента страницы; null — окно по центру */
  target: string | null;
  title: string;
  body: string;
  media: HelpMedia | null;
};

export type PageTour = {
  topic: string;
  title?: string;
  steps: TourStep[];
  /** Видео-гайд всей страницы (окно «?»), задаётся в pl1 → «Контент» */
  pageMedia: HelpMedia | null;
};

const cache = new Map<string, Promise<PageTour | null>>();

/** Тур страницы: шаги + видео/gif. Кэш на сессию вкладки (по теме и языку). */
export function fetchPageTour(topic: string, lang: string): Promise<PageTour | null> {
  const key = `${topic}:${lang}`;
  let p = cache.get(key);
  if (!p) {
    p = api
      .get<PageTour>(`/help-content/tours/${encodeURIComponent(topic)}`, { params: { lang } })
      .catch(() => {
        cache.delete(key);
        return null;
      });
    cache.set(key, p);
  }
  return p;
}
